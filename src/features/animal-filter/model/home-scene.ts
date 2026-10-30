/**
 * 홈 첫인상 "부르고 답하기"(handoff (k), characters.md "올려다보기", #115 4단계).
 *
 * 세션의 첫 홈 진입에서만 장면을 돈다. 상태는 `<html data-home-scene>` 하나로 둔다(CSS가 읽는다, app/globals.css).
 * - `pending`: 첫 진입. 질문·보조 문구·카드는 안 보이는 첫 프레임으로 기다린다(최대 HOME_SCENE_WAIT_MS)
 * - `play`: 장면 0초. 두 캐릭터 Rive가 그릴 준비가 된 순간 앱이 단다. 같은 순간 Rive를 firstVisit = true로 재생한다
 * - `off`: 기다리는 동안 Rive가 준비되지 않아 대체로 넘어갔다. 지금 등장 + firstVisit = false(속성이 없을 때와 같다)
 * 속성이 없으면(두 번째 진입, 새로고침, 움직임 줄이기, 저장소를 못 씀) 지금 등장과 인사 그대로다.
 *
 * 하이드레이션을 기다리지 않는다: 문서로 처음 열 때는 홈 HTML 안의 인라인 스크립트(HOME_SCENE_SCRIPT)가 첫 그림 전에 정하고
 * 대체 타이머도 건다. 그래서 JS 번들이 늦거나 실패해도 0.3초 뒤에는 지금 등장으로 보인다. 앱 안에서 이동해 홈이 클라이언트에서
 * 그려질 때는 같은 함수를 effect에서 부른다(인라인 스크립트는 클라이언트 렌더에서 돌지 않는다).
 *
 * 첫 진입 기록은 정하는 순간 남긴다(장면을 돌든, 대체로 넘어가든, 움직임 줄이기든). 키는 handoff (k)대로 `nyanggonggo.` 접두어다.
 */
export const HOME_SCENE_ATTR = "data-home-scene";

/** 이 세션에서 홈 첫 진입을 썼는지(sessionStorage, 값 "1") */
export const HOME_SCENE_SEEN_KEY = "nyanggonggo.home-scene-seen";

/** 홈이 보인 뒤 Rive를 기다리는 최대 시간. 넘으면 장면 없이 지금처럼 보인다(handoff (k) "장면의 0초와 대체 규칙") */
export const HOME_SCENE_WAIT_MS = 300;

export type HomeSceneState = "pending" | "play" | "off" | null;

/**
 * 이 홈 진입에서 장면을 돌지 정하고 기록한다. 이미 정했으면(속성이 있으면) 아무것도 하지 않는다.
 * 이 함수는 HOME_SCENE_SCRIPT에 문자열로 들어가 브라우저에서 그대로 돈다. 그래서 바깥 이름(import, 상수)을 쓰지 않는다.
 */
export function decideHomeScene(attr: string, key: string, waitMs: number): void {
  const root = document.documentElement;
  if (root.hasAttribute(attr)) return;
  let first = false;
  try {
    first = sessionStorage.getItem(key) === null;
    sessionStorage.setItem(key, "1");
  } catch {
    // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 첫 진입인지 알 수 없어 장면을 돌지 않는다
    first = false;
  }
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!first || reduce) return;
  root.setAttribute(attr, "pending");
  setTimeout(() => {
    if (root.getAttribute(attr) === "pending") root.setAttribute(attr, "off");
  }, waitMs);
}

const ARGS = [HOME_SCENE_ATTR, HOME_SCENE_SEEN_KEY].map((value) => JSON.stringify(value)).join(",");

/** 홈 HTML의 맨 앞(질문·카드보다 먼저)에 두는 인라인 스크립트 */
export const HOME_SCENE_SCRIPT = `try{(${decideHomeScene.toString()})(${ARGS},${HOME_SCENE_WAIT_MS})}catch(e){}`;

/** 홈이 클라이언트에서 그려졌을 때(앱 안 이동, 하이드레이션 뒤). 이미 정했으면 그대로 둔다 */
export function decideHomeSceneFromApp(): void {
  decideHomeScene(HOME_SCENE_ATTR, HOME_SCENE_SEEN_KEY, HOME_SCENE_WAIT_MS);
}

export function homeSceneState(): HomeSceneState {
  const value = document.documentElement.getAttribute(HOME_SCENE_ATTR);
  return value === "pending" || value === "play" || value === "off" ? value : null;
}

/** 기다리던 장면을 시작한다(0초). 대체로 이미 넘어갔으면 false */
export function startHomeScene(): boolean {
  if (homeSceneState() !== "pending") return false;
  document.documentElement.setAttribute(HOME_SCENE_ATTR, "play");
  return true;
}

/** 상태가 바뀔 때마다 부른다(대체 타이머가 off로 바꾸는 것을 듣는다) */
export function watchHomeScene(onChange: (state: HomeSceneState) => void): () => void {
  const observer = new MutationObserver(() => onChange(homeSceneState()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [HOME_SCENE_ATTR] });
  return () => observer.disconnect();
}

/**
 * 홈을 떠나면 속성을 지운다(다른 화면에 남지 않게, CSS 장면은 이동과 함께 끝난다). 개발 모드의 effect 두 번 실행(마운트 → 정리 → 마운트)에서는
 * 지우지 않도록 한 틱 뒤에 아직 홈이 없을 때만 지운다.
 */
let mountedHomes = 0;
export function holdHomeScene(): () => void {
  mountedHomes += 1;
  return () => {
    mountedHomes -= 1;
    setTimeout(() => {
      if (mountedHomes === 0) document.documentElement.removeAttribute(HOME_SCENE_ATTR);
    }, 0);
  };
}
