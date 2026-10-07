import { ANIMAL_COPY } from "@/entities/animal";
import { SpeciesChoice, type AnimalArea } from "@/features/animal-filter";
import { SERVICE_NAME } from "@/shared/config/service";

/**
 * 홈(축종 선택) 화면. 배치만 한다(로직 없음). area는 `app/home/page.tsx`가 URL과 쿠키로 정해 넘긴다.
 * 사진이 없는 화면이다(시안 "냥공고 홈 · 축종 선택"의 Main 390 / Home-PC 480).
 *
 * 위에 서비스명 줄, 그 아래 제목·선택지가 화면 세로 가운데에 온다. 서비스명 줄의 높이는 목록 헤더와 같고
 * (space-3 + touch + space-3), 본문 아래에 같은 높이를 비워 두어 본문이 남은 영역이 아니라 화면 전체의 가운데에 온다.
 */
export function SpeciesPickerView({ area }: { area: AnimalArea }) {
  return (
    <div className="flex min-h-full flex-col px-page pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <header className="flex min-h-touch items-center py-3">
        <p className="text-card-title">{SERVICE_NAME}</p>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-6 pb-[calc(var(--touch)+var(--space-3)*2)]">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-title">{ANIMAL_COPY.homeTitle}</h1>
          <p className="whitespace-pre-line text-body text-text-2">{ANIMAL_COPY.homeDescription}</p>
        </div>
        <SpeciesChoice area={area} />
      </main>
    </div>
  );
}
