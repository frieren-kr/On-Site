import { env } from "./env";

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface RouteLeg {
  distance: number; // 구간 거리-미터
  duration: number; //구간 시간-밀리초
}

interface RouteResult {
  path: number[][];      // [[lng, lat], ...] 경로 좌표
  distance: number;      // 미터
  duration: number;      // 밀리초
  legs: RouteLeg[];        // 구간별 거리/시간
  usedPointCount: number; //실제 경로에 사용된 지점 수(왕복 제외)
}


export async function calculateRoute(
  points: RoutePoint[]
): Promise<RouteResult | null> {
  // 장소가 2개 미만이면 경로 없음
  if (points.length < 2) {
    return null;
  }

  const clientId = env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("네이버 지도 API 키가 설정되지 않았어요");
  }
  //왕복 감치ㅣ 첫 지점과 마지막 지점이 같으면 마지막 제외
  let routePoints = points;
  if (points.length >= 3) {
    const first =points[0];
    const last = points[points.length -1];
    if (
      first.latitude === last.latitude &&
      first.longitude === last.longitude
    ) {
      routePoints = points.slice(0,-1); // 마지막 지점 제외
    }
  }
  
  const start = routePoints[0];
  const goal = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1); // 중간 장소들

  // 좌표는 "경도,위도" 형식 (네이버 규칙: 경도 먼저)
  const startParam = `${start.longitude},${start.latitude}`;
  const goalParam = `${goal.longitude},${goal.latitude}`;

  // 경유지는 파이프(|)로 구분 (콜론은 한 경유지 내부 좌표 구분자)
  const waypointsParam = waypoints
    .map((w) => `${w.longitude},${w.latitude}`)
    .join("|");

  // API URL 구성
  const url = new URL(
    "https://maps.apigw.ntruss.com/map-direction-15/v1/driving"
  );
  url.searchParams.set("start", startParam);
  url.searchParams.set("goal", goalParam);
  if (waypointsParam) {
    url.searchParams.set("waypoints", waypointsParam);
  }
  url.searchParams.set("option", "trafast"); // 실시간 빠른길, 경유지 순서 유지

  // API 호출 - 헤더에 인증 정보
  const response = await fetch(url.toString(), {
    headers: {
      "x-ncp-apigw-api-key-id": clientId,
      "x-ncp-apigw-api-key": clientSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`경로 계산 실패: ${response.status}`);
  }


  // 응답 코드 확인 (0이 성공)
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`경로를 찾을 수 없어요: ${data.message || "알 수 없는 오류"}`);
  }
  
  // 결과 파싱 - trafast(빠른 경로) 사용
  const route = data.route?.trafast?.[0];
  if (!route) {
    throw new Error("경로 데이터가 없어요");
  }
  //구간별 정보 조립
  //waypoints배열 : 각 경유지까지의 구간정보
  //goal: 마지막 경유지 -> 목적지 구간 정보
  const summary = route.summary;
  const legs: RouteLeg[] = [];

  //경유지들의 구간
  if (summary.waypoints && Array.isArray(summary.waypoints)) {
    for (const wp of summary.waypoints) {
      legs.push({
        distance: wp.distance ?? 0,
        duration: wp.duration ?? 0,
      });
    }
  }

  //마지막 목적지 구간
  legs.push({
    distance: summary.goal.distance ?? 0,
    duration: summary.goal.duration ?? 0,
  });

  return {
    path: route.path,                    // 도로 좌표 배열
    distance: route.summary.distance,    // 미터
    duration: route.summary.duration,    // 밀리초
    legs,
    usedPointCount: routePoints.length, //왕복 제외 실제 지점 수
  };
}