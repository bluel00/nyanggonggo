import { AnimalDetail } from "@/widgets/animal-detail";

/** 상세 화면. 배치만 한다(로직 없음). id는 app/animals/[id]/page.tsx가 검증해 넘긴다. */
export function AnimalDetailView({ id }: { id: string }) {
  return <AnimalDetail id={id} />;
}
