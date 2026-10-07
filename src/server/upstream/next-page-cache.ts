import { unstable_cache } from "next/cache";
import type { UpstreamPageCache } from "./client";

/**
 * 업스트림 페이지 캐시의 서버 구현(Next 데이터 캐시). `unstable_cache`는 콜백이 성공한 결과만 저장하므로
 * 검증을 통과한 페이지만 남는다(오류는 예외라 저장되지 않는다). 키는 요청 파라미터뿐이고 서비스키는 없다.
 *
 * Next 16 문서는 `unstable_cache`를 `use cache`로 대체하라고 권하지만, `use cache`는 Cache Components를 앱 전체에
 * 켜야 해서 범위가 크다. 켜게 되면 이 파일만 바꾼다(architecture.md 5절).
 * Next 런타임 밖(단위 테스트)에서는 쓸 수 없다. 테스트는 `next/cache`를 가짜로 바꾸거나 pageCache를 주입한다.
 */
export function createNextPageCache(revalidateSeconds: number): UpstreamPageCache {
  return (key, load) => unstable_cache(load, ["upstream-page", key], { revalidate: revalidateSeconds })();
}
