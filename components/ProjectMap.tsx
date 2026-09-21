/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { getCurrentPosition, type Coords } from "@/lib/geolocation";
import { env } from "@/lib/env";

declare global {
  interface Window {
    naver: any;
    navermap_authFailure?: () => void;
  }
}

// 지도 Polyline은 캔버스/SVG로 그려져 인라인 style의 CSS var()를 못 읽는다.
// :root에 정의된 팔레트 토큰 값을 런타임에 읽어 hex 하드코딩 없이 strokeColor로 넘긴다.
// (마커는 DOM 요소라 var()가 그대로 동작하므로 이 함수가 필요 없다.)
function cssToken(name: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) {
    console.warn(
      `[ProjectMap] CSS 토큰 "${name}" 값이 비어 있습니다 — globals.css의 :root 정의를 확인하세요.`
    );
  }
  return value;
}

// 일정 순서대로 정렬된 장소 (마커용)
interface RouteStop {
  siteId: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface ProjectMapProps {
  stops: RouteStop[];           // 선택된 날짜의 일정 순 장소
  routePath?: number[][] | null; // 그 날짜의 도로 경로
  height?: string;
  onLocate?: (coords: Coords) => void; // 위치를 잡으면 부모에게 좌표를 알려준다
  myCoords?: Coords | null;            // 부모가 들고 있는 현재 위치 (마커의 유일한 출처)
}

export default function ProjectMap({
  stops,
  routePath,
  height = "400px",
  onLocate,
  myCoords,
}: ProjectMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const myLocationMarkerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!mapContainerRef.current) return;
    if (!window.naver) return;
    if (stops.length === 0) return;

    const bounds = new window.naver.maps.LatLngBounds();
    stops.forEach((stop) => {
      bounds.extend(new window.naver.maps.LatLng(stop.latitude, stop.longitude));
    });

    const map = new window.naver.maps.Map(mapContainerRef.current, {
      center: bounds.getCenter(),
      zoom: 10,
    });
    mapRef.current = map;

    if (stops.length > 1) {
      map.fitBounds(bounds);
    }

    // 일정 순서대로 마커 (stops가 이미 정렬돼 옴)
    stops.forEach((stop, index) => {
      const position = new window.naver.maps.LatLng(
        stop.latitude,
        stop.longitude
      );
      new window.naver.maps.Marker({
        position,
        map,
        icon: {
          content: `
            <div style="
              width: 32px; height: 32px;
              background: var(--color-ink); color: var(--color-card);
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-weight: bold; font-size: 14px;
              border: 2px solid var(--color-card);
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${index + 1}</div>
          `,
          anchor: new window.naver.maps.Point(16, 16),
        },
        title: `${index + 1}. ${stop.name}`,
      });
    });

    // 경로: 저장된 도로 경로 있으면 실선, 없으면 직선 점선
    if (routePath && routePath.length >= 2) {
      const path = routePath.map(
        (coord) => new window.naver.maps.LatLng(coord[1], coord[0])
      );
      new window.naver.maps.Polyline({
        map,
        path,
        strokeColor: cssToken("--color-map-route"),
        strokeWeight: 5,
        strokeOpacity: 0.8,
      });
    } else if (stops.length >= 2) {
      const path = stops.map(
        (s) => new window.naver.maps.LatLng(s.latitude, s.longitude)
      );
      new window.naver.maps.Polyline({
        map,
        path,
        strokeColor: cssToken("--color-ink-faint"),
        strokeWeight: 2,
        strokeOpacity: 0.5,
        strokeStyle: "shortdash",
      });
    }

    window.navermap_authFailure = () => {
      setError("네이버 지도 인증 실패");
    };
  }, [isLoaded, stops, routePath]);

  // 내 위치 마커는 myCoords만 보고 그린다.
  // deps에 stops/routePath가 있는 건, 위 effect가 날짜 전환 때 지도를 새로
  // 만들기 때문. 그때 이 effect도 다시 돌아야 새 지도에 마커가 다시 붙는다.
  useEffect(() => {
    if (!isLoaded) return;
    if (!window.naver) return;
    if (stops.length === 0) return; // 지도 자체가 렌더되지 않는 경우
    if (!mapRef.current) return;

    if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.setMap(null);
      myLocationMarkerRef.current = null;
    }
    if (!myCoords) return;

    myLocationMarkerRef.current = new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(
        myCoords.latitude,
        myCoords.longitude
      ),
      map: mapRef.current,
      icon: {
        content: `
          <div style="
            width: 20px; height: 20px;
            background: var(--color-map-me);
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 0 2px var(--color-map-me), 0 2px 6px rgba(0,0,0,0.4);
          "></div>
        `,
        anchor: new window.naver.maps.Point(10, 10),
      },
      title: "현재 내 위치",
      zIndex: 1000,
    });
  }, [isLoaded, myCoords, stops, routePath]);

  async function handleShowMyLocation() {
    setError(null);
    setLocating(true);
    try {
      const coords = await getCurrentPosition();
      onLocate?.(coords);
      if (!mapRef.current || !window.naver) {
        setError("지도가 아직 준비되지 않았어요");
        return;
      }
      // 마커는 위 effect가 myCoords를 보고 그린다. 여기선 화면만 옮긴다.
      mapRef.current.setCenter(
        new window.naver.maps.LatLng(coords.latitude, coords.longitude)
      );
      mapRef.current.setZoom(15);
    } catch (e) {
      setError(e instanceof Error ? e.message : "위치를 가져오지 못했어요");
    } finally {
      setLocating(false);
    }
  }

  const clientId = env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  if (stops.length === 0) {
    return (
      <div className="rounded border bg-panel p-8 text-center text-sm text-ink-muted">
        이 날짜에는 장소가 연결된 일정이 없어요.
      </div>
    );
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
        onReady={() => setIsLoaded(true)}
        onError={() => setError("네이버 지도 SDK 로드 실패")}
      />

      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleShowMyLocation}
          disabled={!isLoaded || locating}
          className="flex items-center gap-2 rounded-lg border border-secondary bg-secondary-tint px-4 py-2 text-sm font-medium text-secondary-ink shadow-sm hover:bg-secondary-tint-strong disabled:opacity-50"
        >
          <span className="text-base">📍</span>
          {locating ? "위치 확인 중..." : "내 위치"}
        </button>
        <span className="text-xs text-ink-muted">
          버튼을 누르면 현재 위치가 표시됩니다
        </span>
      </div>

      {error && (
        <div className="mb-2 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        ref={mapContainerRef}
        style={{ width: "100%", height }}
        className="rounded border"
      />
    </>
  );
}