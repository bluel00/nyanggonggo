import { QueryClient } from "@tanstack/react-query";
import { HttpError } from "./http-client";

/**
 * 클라이언트 캐시 기본값. 서버 튜닝값(src/server/config.ts SERVER_TUNING)과 별도로 둔다.
 *
 * staleTime 60초: docs/architecture.md 5절 원칙("클라이언트 staleTime은 서버 재검증 주기(upstream revalidate 300초)보다
 * 길지 않게")을 지키고, 성공 응답의 CDN 캐시(`s-maxage=60`)와 맞췄다. 60초 안의 재마운트는 요청하지 않는다.
 */
export const QUERY_STALE_TIME_MS = 60_000;

/** 목록 → 상세 → 뒤로가기 때 로드된 페이지를 되살릴 수 있게 기본값(5분)을 유지한다. */
export const QUERY_GC_TIME_MS = 5 * 60_000;

/** 재시도는 1회, 일시적 오류(타임아웃, 네트워크, 5xx)일 때만. 400/404는 다시 불러도 같다. */
export const QUERY_MAX_RETRIES = 1;

export function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.kind === "timeout" || error.kind === "network" || (error.status ?? 0) >= 500;
  }
  return false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: (failureCount, error) => failureCount < QUERY_MAX_RETRIES && isRetryableError(error),
        // 사진 피드를 보다가 탭을 오가도 목록이 다시 정렬되거나 커서가 밀리지 않게 끈다.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  });
}
