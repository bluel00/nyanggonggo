import { z } from "zod";

/**
 * 서버 설정. 이 파일만 process.env를 읽는다.
 * import 시점에는 읽지 않고, 요청 처리 중 getServerConfig()를 부를 때 검증한다(빌드가 깨지지 않게).
 */

/** 서버 튜닝값. 초기값은 스파이크에서 조정한다(architecture.md 12절). */
export const SERVER_TUNING = {
  /** 공공 API fetch의 Next 데이터 캐시 재검증 주기(초) */
  upstreamRevalidateSeconds: 300,
  /** 공공 API 호출 타임아웃(ms) */
  upstreamTimeoutMs: 10_000,
  /**
   * 공공 API 페이지 크기(numOfRows, 최대 1000). 1000건 페이지는 base64 추정 1.98MB로
   * Next fetch 캐시 항목 한도(2MB)의 94.5%라 500으로 낮췄다(architecture.md 12절 3).
   */
  upstreamPageSize: 500,
  /** 첫 페이지 이후 나머지 페이지의 동시 호출 수 */
  upstreamConcurrency: 3,
  /** 한 (upkind, upr_cd) 조합의 최대 페이지 수. 무한 루프 방지 */
  upstreamMaxPages: 20,
  /** 목록 응답의 페이지 크기 */
  listPageSize: 20,
  /** by-ids 동시 조회 수 */
  byIdsConcurrency: 5,
  /** /api/animals 응답의 Cache-Control */
  cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
  /**
   * /api/image-proxy 성공 응답의 Cache-Control. 원본 파일명에 등록 시각이 들어 있어 URL별로 내용이 바뀌지 않는다고 보고
   * 길게 둔다(검증 필요, architecture.md 12절).
   */
  imageProxyCacheControl: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
  /** 원본 실패 시 대체 이미지 응답은 캐시하지 않는다(다음 요청에서 다시 시도) */
  imageProxyFallbackCacheControl: "no-store",
  /** 원본 이미지 호출 타임아웃(ms) */
  imageProxyTimeoutMs: 8_000,
  /** 원본 이미지 최대 크기(바이트). 넘으면 대체 이미지 */
  imageProxyMaxBytes: 10 * 1024 * 1024,
} as const;

const EnvSchema = z.object({
  DATA_GO_KR_SERVICE_KEY: z.string().trim().min(1),
});

export type ServerConfig = {
  /** 디코딩된 서비스키. 인코딩은 URLSearchParams가 한다. */
  serviceKey: string;
};

/** 설정 누락. 메시지에 값을 넣지 않는다. 클라이언트 응답에는 상세를 노출하지 않는다. */
export class ServerConfigError extends Error {
  constructor(readonly variables: string[]) {
    super(`Missing or invalid server environment variables: ${variables.join(", ")}`);
    this.name = "ServerConfigError";
  }
}

export function getServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const result = EnvSchema.safeParse({ DATA_GO_KR_SERVICE_KEY: env.DATA_GO_KR_SERVICE_KEY });
  if (!result.success) {
    throw new ServerConfigError([...new Set(result.error.issues.map((i) => String(i.path[0])))]);
  }
  return { serviceKey: result.data.DATA_GO_KR_SERVICE_KEY };
}
