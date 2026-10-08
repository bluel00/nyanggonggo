import { unstable_cache } from "next/cache";
import type { ImageSizeCache } from "./image-size";

/**
 * 사진 크기 캐시의 서버 구현(Next 데이터 캐시). 키는 사진 URL(서비스키 없음)이고, `unstable_cache`는 콜백이 성공한 결과만
 * 저장하므로 시간 초과·실패는 남지 않는다(다음 요청에서 다시 읽는다). 사진 파일은 URL별로 바뀌지 않아 재검증 주기를 길게 둔다.
 * Next 런타임 밖(단위 테스트)에서는 쓸 수 없다. 테스트는 cache를 주입한다.
 */
export function createNextImageSizeCache(revalidateSeconds: number): ImageSizeCache {
  return (key, load) => unstable_cache(load, ["image-size", key], { revalidate: revalidateSeconds })();
}
