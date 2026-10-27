import { AnimalDetail, type PhotoSize } from "@/widgets/animal-detail";

/** 상세 화면. 배치만 한다(로직 없음). id, 공유 주소 기준(origin), 첫 사진 크기는 app/animals/[id]/page.tsx가 넘긴다. */
export function AnimalDetailView({ id, origin, firstPhotoSize = null }: { id: string; origin: string; firstPhotoSize?: PhotoSize | null }) {
  return <AnimalDetail id={id} origin={origin} firstPhotoSize={firstPhotoSize} />;
}
