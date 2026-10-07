import { AnimalDetailLoadingView } from "@/views/animal-detail";

/**
 * 상세의 로딩 경계. 서버가 공고를 조회하는 동안(지난 측정 0.5~0.9초) 카드를 누른 즉시 상세 뼈대를 보인다.
 * 이 경계가 없으면 목록이 그대로 멈춰 있어 사용자가 여러 번 누른다.
 *
 * 경계가 생기면 `next/link`의 자동 prefetch가 이 경계까지만 받는다(페이지 본문과 공고 조회는 누를 때).
 * 측정과 영향은 architecture.md 7절.
 */
export default function Loading() {
  return <AnimalDetailLoadingView />;
}
