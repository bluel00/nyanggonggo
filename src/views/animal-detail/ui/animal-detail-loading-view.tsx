import { AnimalDetailSkeleton } from "@/widgets/animal-detail";

/**
 * 상세 화면의 라우트 로딩(`app/animals/[id]/loading.tsx`). 배치만 한다(로직 없음).
 * 카드를 누르면 서버 렌더를 기다리지 않고 바로 이 뼈대가 보인다(architecture.md 7절 상세 로딩).
 */
export function AnimalDetailLoadingView() {
  return <AnimalDetailSkeleton />;
}
