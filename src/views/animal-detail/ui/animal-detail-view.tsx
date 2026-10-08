import { AnimalDetail, type PhotoSize } from "@/widgets/animal-detail";

/** 상세 화면. 배치만 한다(로직 없음). id와 첫 사진 크기는 app/animals/[id]/page.tsx가 넘긴다. */
export function AnimalDetailView({ id, firstPhotoSize = null }: { id: string; firstPhotoSize?: PhotoSize | null }) {
  return <AnimalDetail id={id} firstPhotoSize={firstPhotoSize} />;
}
