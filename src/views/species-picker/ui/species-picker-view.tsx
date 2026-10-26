import { ANIMAL_COPY } from "@/entities/animal";
import { SpeciesChoice, type AnimalArea } from "@/features/animal-filter";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/shared/config/service";
import { enterOrder } from "@/shared/lib/motion";
import { DisplayText } from "@/shared/ui/display-text";
import { ScreenHeader, ScreenShell } from "@/shared/ui/screen-shell";

/**
 * 홈(축종 선택) 화면. 배치만 한다(로직 없음). area는 `app/home/page.tsx`가 URL과 쿠키로 정해 넘긴다.
 * 사진이 없는 화면이다(시안 "냥공고 홈 · 축종 선택"의 Main 390 / Home-PC 480).
 *
 * 위에 서비스 이름과 한 줄 소개(목록 헤더와 같은 헤더 줄 틀, 등장 효과 없음), 그 아래 제목·선택지가 화면 전체의 세로 가운데에 온다(ScreenShell center).
 * 등장 순서는 여기서 정한다: 제목(부제 포함) 0 → 고양이 1 → 강아지 2 → 링크 3(SpeciesChoice가 1부터 이어 붙인다).
 */
export function SpeciesPickerView({ area }: { area: AnimalArea }) {
  return (
    <ScreenShell
      center
      header={
        <ScreenHeader
          start={
            <div className="flex flex-col gap-1">
              <DisplayText as="p" size="logo" className="text-logo">
                {SERVICE_NAME}
              </DisplayText>
              <p className="whitespace-pre-line text-body text-text-2">{SERVICE_TAGLINE}</p>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6 px-page">
        <HomeIntro />
        <SpeciesChoice area={area} enterFrom={1} />
      </div>
    </ScreenShell>
  );
}

/** 제목과 부제. 함께 등장한다(순서 0) */
function HomeIntro() {
  return (
    // data-enter="home"은 app/globals.css의 [data-enter="home"]이 읽는다
    <div data-enter="home" style={enterOrder(0)} className="flex flex-col gap-2 text-center">
      <DisplayText as="h1" size="home">
        {ANIMAL_COPY.homeTitle}
      </DisplayText>
      <p className="whitespace-pre-line text-body text-text-2">{ANIMAL_COPY.homeDescription}</p>
    </div>
  );
}
