/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Script from "next/script";
import { createSite } from "@/app/projects/[id]/actions";
import { env } from "@/lib/env";

declare global {
  interface Window {
    naver: any;
    navermap_authFailure?: () => void;
  }
}

// SiteList에 넘기는 것과 같은 데이터를 재사용 (여기선 마커에 필요한 필드만)
interface RegisteredSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  orderIndex: number;
}

interface SiteRegisterMapProps {
  projectId: string;
  sites: RegisteredSite[];
}

interface SearchResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// 등록된 장소 마커: 차분한 슬레이트 + 번호(목록 번호와 동일). 미등록 위치와 헷갈리지 않게 한다.
function registeredMarkerContent(num: number): string {
  return `
    <div style="
      width: 28px; height: 28px;
      background: #64748b; color: white;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 13px;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    ">${num}</div>
  `;
}

// 검색/클릭으로 방금 찍은 미등록 위치: 눈에 띄는 빨강 핀(물방울) 모양 (아직 저장 전이라는 신호).
// 인라인 SVG — 위는 둥글고 아래로 뾰족, 가운데 흰 원 구멍. 뾰족한 끝(12,28)이 실제 좌표.
const PICKED_MARKER_CONTENT = `
  <svg width="24" height="30" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg"
       style="display:block; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
    <path d="M12 0 C5.373 0 0 5.373 0 12 C0 20 12 28 12 28 C12 28 24 20 24 12 C24 5.373 18.627 0 12 0 Z"
          fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
    <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
  </svg>
`;
// 핀의 뾰족한 하단 끝 = anchor. 중앙이 아니라 이 끝이 좌표를 정확히 가리킨다.
const PICKED_MARKER_ANCHOR = { x: 12, y: 28 };

export default function SiteRegisterMap({
  projectId,
  sites,
}: SiteRegisterMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  // 등록된 장소 마커들 (sites 갱신 시 정리 후 재생성하려고 따로 보관)
  const siteMarkersRef = useRef<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [isPending, startTransition] = useTransition();

  // SDK 로드 후 지도 초기화
  useEffect(() => {
    if (!isLoaded) return;
    if (!mapContainerRef.current) return;
    if (!window.naver) return;

    // 대한민국 중심 좌표로 시작
    const map = new window.naver.maps.Map(mapContainerRef.current, {
      center: new window.naver.maps.LatLng(36.5, 127.8),
      zoom: 7,
    });
    mapRef.current = map;

    // 인증 실패 콜백
    window.navermap_authFailure = () => {
      setError("네이버 지도 인증 실패. Client ID나 도메인 등록을 확인하세요.");
    };
    // 지도 클릭 리스너 - 좌표 직접 지정용.
    // 마커는 항상 mapRef.current(현재 살아있는 지도)에 그린다 — 클로저에 잡힌
    // 옛 인스턴스를 참조하지 않도록.
    const clickListener = window.naver.maps.Event.addListener(
      map,
      "click",
      (e: any) => {
        const lat = e.coord.lat();
        const lng = e.coord.lng();

        const result: SearchResult = {
          name: "",
          address: `직접 지정한 위치 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          latitude: lat,
          longitude: lng,
        };

        setSearchResult(result);
        setSiteName(""); // 사용자가 이름 직접 입력하도록 비움

        // 클릭 마커(markerRef)만 갱신 — 등록 마커(siteMarkersRef)와 독립.
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }
        markerRef.current = new window.naver.maps.Marker({
          position: e.coord,
          map: mapRef.current,
          icon: {
            content: PICKED_MARKER_CONTENT,
            anchor: new window.naver.maps.Point(
              PICKED_MARKER_ANCHOR.x,
              PICKED_MARKER_ANCHOR.y
            ),
          },
          zIndex: 1000,
        });
      }
    );

    // 정리: 리스너 해제 + 지도 파괴 + 마커 참조 리셋.
    // StrictMode 이중 마운트/탭 전환 재마운트 때 이전 인스턴스가 남아
    // 리스너와 mapRef가 서로 다른 지도를 가리키는 걸 막는다.
    return () => {
      window.naver.maps.Event.removeListener(clickListener);
      // 지도를 파괴하면 위에 올린 마커들도 함께 사라지므로 참조만 비운다.
      siteMarkersRef.current = [];
      markerRef.current = null;
      if (mapRef.current) {
        mapRef.current.destroy?.();
        mapRef.current = null;
      }
    };
  }, [isLoaded]);

  // 등록된 장소 마커: sites가 바뀌면 이전 마커 정리 후 재생성 (중복 생성 방지)
  useEffect(() => {
    if (!isLoaded) return;
    if (!window.naver) return;
    if (!mapRef.current) return;

    siteMarkersRef.current.forEach((m) => m.setMap(null));
    siteMarkersRef.current = [];

    sites.forEach((site) => {
      const num = site.orderIndex + 1; // 목록 번호와 동일
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(site.latitude, site.longitude),
        map: mapRef.current,
        icon: {
          content: registeredMarkerContent(num),
          anchor: new window.naver.maps.Point(14, 14),
        },
        title: `${num}. ${site.name}`,
      });
      siteMarkersRef.current.push(marker);
    });
  }, [isLoaded, sites]);

  // 검색 실행 - 네이버 Geocoding submodule 사용
  function handleSearch() {
    if (!window.naver?.maps?.Service) {
      setError("지도 SDK가 아직 준비 안 됐어요. 잠시만요.");
      return;
    }
    if (!query.trim()) return;

    setError(null);

    window.naver.maps.Service.geocode(
      { query: query.trim() },
      (status: any, response: any) => {
        if (status !== window.naver.maps.Service.Status.OK) {
          setError("검색에 실패했어요. 다시 시도해주세요.");
          return;
        }

        const items = response.v2.addresses;
        if (!items || items.length === 0) {
          setError("검색 결과가 없어요. 다른 키워드를 시도해보세요.");
          return;
        }

        // 첫 번째 결과 사용
        const item = items[0];
        const lat = parseFloat(item.y);
        const lng = parseFloat(item.x);
        const displayName = item.roadAddress || item.jibunAddress || query;

        const result: SearchResult = {
          name: query.trim(), // 검색어를 임시 이름으로
          address: displayName,
          latitude: lat,
          longitude: lng,
        };

        setSearchResult(result);
        setSiteName(""); // 장소 이름 기본값

        // 지도 이동 + 마커 표시
        const position = new window.naver.maps.LatLng(lat, lng);
        mapRef.current.setCenter(position);
        mapRef.current.setZoom(16);

        if (markerRef.current) {
          markerRef.current.setMap(null); // 기존 마커 제거
        }
        markerRef.current = new window.naver.maps.Marker({
          position,
          map: mapRef.current,
          icon: {
            content: PICKED_MARKER_CONTENT,
            anchor: new window.naver.maps.Point(
              PICKED_MARKER_ANCHOR.x,
              PICKED_MARKER_ANCHOR.y
            ),
          },
          zIndex: 1000,
        });
      }
    );
  }

  // 저장 실행
  function handleSave() {
    if (!searchResult) return;
    if (!siteName.trim()) {
      setError("장소 이름을 입력하세요");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await createSite({
        projectId,
        name: siteName.trim(),
        latitude: searchResult.latitude,
        longitude: searchResult.longitude,
        address: searchResult.address,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // 성공 - 폼 초기화
      setQuery("");
      setSearchResult(null);
      setSiteName("");
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    });
  }

  const clientId = env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`}
        onReady={() => setIsLoaded(true)}
        onError={() => setError("네이버 지도 SDK 로드 실패")}
      />

      <div className="space-y-3">
        {/* 검색창 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="주소로 검색 (예: 경복궁 ~> 사직로 161)"
            className="flex-1 rounded border px-3 py-2 text-gray-900"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!isLoaded}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            검색
          </button>
        </div>

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 지도 */}
        <p className="text-xs text-gray-500">
            주소로 검색이 어려운 곳은 지도를 직접 클릭해서 좌표를 지정할 수 있어요.
        </p>
        <div
          ref={mapContainerRef}
          style={{ width: "100%", height: "400px" }}
          className="rounded border"
        />

        {/* 검색 결과 표시 + 저장 폼 */}
        {searchResult && (
          <div className="rounded border bg-gray-50 p-4">
            <p className="mb-1 text-xs text-gray-500">
              위도 {searchResult.latitude.toFixed(6)} · 경도{" "}
              {searchResult.longitude.toFixed(6)}
            </p>
            <p className="mb-3 text-sm text-gray-700">
              주소: {searchResult.address}
            </p>

            <label className="mb-1 block text-sm font-medium text-gray-900">
              장소 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              maxLength={100}
              className="mb-3 w-full rounded border px-3 py-2 text-gray-900"
              placeholder="예: 근정전, 광화문"
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="w-full rounded bg-black py-2 text-sm text-white disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "이 위치를 장소로 등록"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}