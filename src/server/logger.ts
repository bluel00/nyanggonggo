/**
 * 서버 로거. 컨텍스트에 서비스키, 요청 URL(쿼리스트링), 연락처 값을 넣지 않는다.
 */
export type Logger = {
  warn(message: string, context?: Record<string, unknown>): void;
};

export const noopLogger: Logger = { warn: () => {} };

export const consoleLogger: Logger = {
  warn: (message, context) => console.warn(`[server] ${message}`, context ?? {}),
};
