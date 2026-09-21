/** 개발 환경에서만 남기는 로그. 서비스키 등 비밀값을 넘기지 않는다. */
export function devLog(message: string, detail?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  console.warn(`[server] ${message}`, detail ?? "");
}
