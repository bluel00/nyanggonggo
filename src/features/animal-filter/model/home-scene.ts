/**
 * 홈 첫인상 "부르고 답하기"(handoff (k) "언제", "장면의 0초와 Rive", 구현 순서 6단계, characters.md "올려다보기", #115).
 *
 * - 홈에 들어올 때마다 장면을 돈다(새로고침, 축종을 바꾸러 다시 옴 포함). 장면이 홈의 등장 효과를 대신한다.
 * - 장면의 0초는 홈이 처음 그려지는 순간이다. CSS 장면(app/globals.css)은 Rive를 기다리지 않고 그때 바로 시작한다. 하이드레이션에도
 *   기대지 않는다(서버 HTML과 CSS만으로 돈다).
 * - 캐릭터 Rive는 장면 0.92초(강아지 올려다보기 시각)에 두 캐릭터가 모두 준비돼 있으면 그 순간 withLookUp = true로 재생한다. Rive가
 *   시작 즉시 강아지, 0.12초 뒤 고양이가 올려다본 뒤 인사한다. 0.92초까지 준비되지 않으면 준비되는 대로 withLookUp = false(지금 인사)다.
 * - 홈 HTML이 Rive 런타임(wasm)과 .riv를 처음부터 미리 받는다(HOME_RIVE_PRELOAD). 움직임 줄이기면 받지 않는다(media).
 *
 * 이전 규칙(세션 첫 진입에서만, 세션 저장소 `nyanggonggo:home-scene-seen` 기록, 0.3초 대기)은 없앴다. 이미 저장된 값은 읽지도 지우지도 않는다.
 */

/** 장면에서 강아지가 올려다보는 시각. 이때 두 캐릭터가 준비돼 있으면 withLookUp = true로 재생한다 */
export const LOOK_UP_AT_MS = 920;

/** Rive 자산을 미리 받는 조건. 움직임 줄이기면 캐릭터 애니메이션을 받지 않는다(SpeciesCharacter와 같은 규칙) */
const MOTION_ALLOWED = "(prefers-reduced-motion: no-preference)";

/**
 * 홈 HTML의 미리 받기(`<link rel="preload" as="fetch" crossorigin="anonymous">`). 앱은 둘을 `fetch(url)`(기본: cors, 같은 출처 자격)로
 * 받으므로(entities/animal/lib/character-animation.ts) 같은 요청으로 맞춰야 한 번만 받는다.
 */
export const HOME_RIVE_PRELOAD = { as: "fetch", crossOrigin: "anonymous", media: MOTION_ALLOWED } as const;

/**
 * 이 화면의 장면 0초(document timeline 시각, performance.now()와 같은 기준). 장면 CSS 애니메이션이 시작된 시각을 읽는다:
 * 문서로 처음 열면 첫 그림 때, 앱 안 이동이면 홈이 그려질 때다. 아직 시작 전(대기 중)이거나 없으면 지금.
 */
export function homeSceneStartTime(sceneElement: Element | null): number {
  const animation = sceneElement?.getAnimations?.()[0];
  const start = animation?.startTime;
  return typeof start === "number" ? start : performance.now();
}
