/**
 * 브라우저에서 조용히 폴백되는 상황을 콘솔에 남긴다(카카오 공유 등).
 * 비밀값을 넣지 않는다. 키 같은 값은 fingerprint()로 식별만 가능하게 남긴다.
 */
export function warnClient(scope: string, message: string, detail?: Record<string, unknown>): void {
  console.warn(`[${scope}] ${message}`, detail ?? {});
}

/** 개발 환경에서만 남기는 안내 로그 */
export function infoClientDev(scope: string, message: string, detail?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[${scope}] ${message}`, detail ?? {});
}

/** 값 자체를 노출하지 않고 비교만 할 수 있게: 길이 + 앞뒤 2자 */
export function fingerprint(value: string): string {
  if (!value) return "(빈 값)";
  return value.length <= 6 ? `len=${value.length}` : `len=${value.length} ${value.slice(0, 2)}…${value.slice(-2)}`;
}

/** Error에서 로그에 남길 부분만 */
export function describeError(error: unknown): Record<string, unknown> {
  return error instanceof Error ? { name: error.name, message: error.message } : { value: typeof error };
}
