import type { CSSProperties } from "react";
import { ANIMAL_COPY } from "@/entities/animal";
import { HOME_SCENE_SCRIPT, SpeciesChoice, type AnimalArea } from "@/features/animal-filter";
import { SERVICE_TAGLINE } from "@/shared/config/service";
import { enterOrder } from "@/shared/lib/motion";
import { DisplayText } from "@/shared/ui/display-text";
import { Logo } from "@/shared/ui/logo";
import { ScreenHeader, ScreenShell } from "@/shared/ui/screen-shell";

/**
 * 홈(축종 선택) 화면. 배치만 한다(로직 없음). area는 `app/home/page.tsx`가 URL과 쿠키로 정해 넘긴다.
 * 사진이 없는 화면이다(시안 "냥공고 홈 · 축종 선택"의 Main 390 / Home-PC 480).
 *
 * 위에 로고(가로 조합 56, 이름은 그림이라 Jua를 쓰지 않는다. 부위를 나눈 인라인 SVG라 그림 요청이 없다, #115)와 한 줄 소개(목록 헤더와 같은 헤더 줄 틀, 등장 효과 없음), 그 아래 제목·선택지가 화면 전체의 세로 가운데에 온다(ScreenShell center).
 * 등장 순서는 여기서 정한다: 제목(부제 포함) 0 → 고양이 1 → 강아지 2 → 기타 동물 카드 3(SpeciesChoice가 1부터 이어 붙인다).
 * 제목과 선택지 사이는 28px다(handoff (g) 홈 배치: 로고 아래 소개 두 줄이 들어갈 높이를 위해 32에서 줄임).
 * 세션의 첫 진입이면 첫인상 장면(handoff (k))이다. 장면을 돌지는 질문·카드보다 먼저 오는 인라인 스크립트가 첫 그림 전에 정한다
 * (features/animal-filter/model/home-scene.ts). 시간표는 app/globals.css의 html[data-home-scene]이 맡는다.
 */
export function SpeciesPickerView({ area }: { area: AnimalArea }) {
  return (
    <ScreenShell
      center
      header={
        <ScreenHeader
          start={
            <div className="flex flex-col gap-1">
              <Logo size={56} combo="lockup" />
              <p className="whitespace-pre-line text-body text-text-2">{SERVICE_TAGLINE}</p>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-7 px-page">
        {/* 문서로 열 때만 돈다: 서버 HTML 안의 <script>는 브라우저가 읽으며 실행하고, 앱 안 이동으로 클라이언트가 그릴 때는 innerHTML이라
            실행되지 않는다(그때는 SpeciesChoice의 effect가 정한다). <script> 요소를 직접 그리면 클라이언트 렌더에서 React가 경고한다 */}
        <div hidden dangerouslySetInnerHTML={{ __html: `<script>${HOME_SCENE_SCRIPT}</script>` }} />
        <HomeIntro />
        <SpeciesChoice area={area} enterFrom={1} />
      </div>
    </ScreenShell>
  );
}

/**
 * 제목과 부제. 함께 등장한다(순서 0). 첫인상 장면에서는 질문 두 줄과 부제가 따로 떠오른다(data-scene, handoff (k)).
 * 제목은 두 줄로 고정한다(handoff (k) "질문 글자"): 줄마다 블록으로 두고 줄 안에서는 끊지 않는다. 두 줄 사이의 공백 글자는 화면에서는
 * 블록 사이라 그려지지 않고, 글자 내용과 접근성 이름은 "오늘은 누구를 보러 왔어요?" 한 문장이 된다.
 */
function HomeIntro() {
  const [first, second] = ANIMAL_COPY.homeTitleLines;
  return (
    // data-enter="home"은 app/globals.css의 [data-enter="home"]이 읽는다
    <div data-enter="home" data-scene="intro" style={enterOrder(0)} className="flex flex-col gap-2 text-center">
      <DisplayText as="h1" size="home">
        <span data-scene="question-line" style={{ "--line-i": 0 } as CSSProperties} className="block whitespace-nowrap">
          {first}
        </span>{" "}
        <span data-scene="question-line" style={{ "--line-i": 1 } as CSSProperties} className="block whitespace-nowrap">
          {second}
        </span>
      </DisplayText>
      <p data-scene="sub" className="whitespace-pre-line text-body text-text-2">
        {ANIMAL_COPY.homeDescription}
      </p>
    </div>
  );
}
