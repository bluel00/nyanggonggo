import { AnimalDetailLoading } from "@/widgets/animal-detail";

/**
 * 상세 화면의 라우트 로딩(`app/@modal/(.)animals/[id]/loading.tsx`). 배치만 한다(로직 없음).
 * 카드를 누르면 서버 렌더를 기다리지 않고 바로 보인다: 목록 카드에서 왔으면 목록 데이터로 그린 상세, 아니면 뼈대
 * (architecture.md 7절 상세 로딩, 14.2 4단계).
 */
export function AnimalDetailLoadingView({ origin }: { origin: string }) {
  return <AnimalDetailLoading origin={origin} />;
}
