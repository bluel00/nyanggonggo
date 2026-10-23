/**
 * 검증을 통과한 업스트림 페이지를 캐시한다. load가 성공해야만 저장하고, 실패(예외)는 저장하지 않는다.
 * key에는 서비스키가 없다(요청 파라미터만). 서버에서는 Next 캐시(`next-page-cache.ts`), 테스트에서는 가짜를 쓴다.
 * 타입만 둔 파일이다: 계측(`perf/request-perf.ts`)이 클라이언트 구현을 import하지 않고 캐시를 감쌀 수 있게 한다(이슈 #31).
 */
export type UpstreamPageCache = <T>(key: string, load: () => Promise<T>) => Promise<T>;
