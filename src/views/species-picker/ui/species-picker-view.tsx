import { ANIMAL_COPY } from "@/entities/animal";
import { SpeciesChoice, type AnimalArea } from "@/features/animal-filter";

/**
 * 홈(축종 선택) 화면. 배치만 한다(로직 없음). area는 `app/home/page.tsx`가 URL과 쿠키로 정해 넘긴다.
 * 사진이 없는 화면이고, 캐릭터와 레이아웃은 시안 전 임시다(architecture.md 12절).
 */
export function SpeciesPickerView({ area }: { area: AnimalArea }) {
  return (
    <main className="flex flex-col px-page pt-[calc(var(--space-6)+env(safe-area-inset-top,0px))] pb-6">
      <h1 className="text-title">{ANIMAL_COPY.homeTitle}</h1>
      <p className="mt-2 text-body text-text-2">{ANIMAL_COPY.homeDescription}</p>
      <SpeciesChoice area={area} />
    </main>
  );
}
