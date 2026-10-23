/**
 * 공고 출처(`AnimalSource`)가 실패를 알리는 오류(이슈 #31). 출처 구현(지금은 공공 API 클라이언트 `upstream/client.ts`)이 던지고,
 * 서비스(`animals/service.ts`, by-ids 일부 실패)와 응답(`http/respond.ts`, 502/504 분류)이 받는다.
 * 받는 쪽이 출처 구현 파일을 import하지 않도록 포트 옆에 둔다.
 */

/**
 * timeout: 타임아웃. auth: 서버 설정/인증 오류(서비스키 미등록 등). quota_exceeded: 일일 호출 한도 초과(코드 22).
 * failed: 그 외 업스트림 실패. 클라이언트 응답은 timeout(504)을 빼고 모두 502로 같다(구분은 서버 로그용).
 */
export type UpstreamErrorReason = "timeout" | "auth" | "quota_exceeded" | "failed";

/** 업스트림 실패. detail은 서버 로그용이며 비밀값이 가려져 있다. 클라이언트에 노출하지 않는다. */
export class UpstreamError extends Error {
  constructor(
    readonly reason: UpstreamErrorReason,
    readonly detail: Record<string, unknown>,
  ) {
    super(`Upstream request failed (${reason})`);
    this.name = "UpstreamError";
  }
}
