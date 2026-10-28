import { SKELETON_CARD_SELECTOR } from "@/shared/ui/skeleton-card";
import { APP_SCROLL_SELECTOR } from "@/shared/ui/app-shell";

/**
 * 서버가 그린 목록 첫 페이지의 첫 화면 등장(이슈 #109, handoff "목록 첫 화면 등장": 뼈대가 실제로 보였을 때만).
 *
 * 첫 페이지는 서버에서 스트리밍으로 온다. 서버 HTML에 카드가 바로 담기면 뼈대가 보이지 않으므로 효과가 없다. 뼈대(Suspense fallback)가
 * 먼저 그려졌다가 카드가 들어오면, 뼈대가 한 번 칠해진 뒤 `<html>`에 이 속성을 단다. 값은 뼈대 위치로 잰 첫 화면 카드 수다.
 * CSS(app/globals.css)가 이 속성이 있을 때만 서버가 그린 첫 페이지(`[data-list-first]`)의 앞 카드들을 올린다.
 *
 * 하이드레이션에 기대지 않는다: 문서로 처음 열 때는 뼈대 HTML 안의 인라인 스크립트(LIST_ENTER_SCRIPT)가 달고, 앱 안에서 이동해 뼈대가
 * 클라이언트에서 그려질 때는 뼈대의 effect가 같은 함수로 단다. 카드가 들어오는 순간(하이드레이션 전일 수 있다)에 CSS만으로 돌아 깜빡이지 않는다.
 * 다 돈 뒤에는 목록이 속성을 지운다(다음에 서버 첫 페이지가 뼈대 없이 바로 그려지면 돌지 않게).
 */
export const LIST_ENTER_ATTR = "data-list-enter";

/** 서버가 그린 첫 페이지 목록에 붙는 속성(CSS가 읽는다) */
export const LIST_FIRST_ATTR = "data-list-first";

/** 첫 화면 카드 수의 상한. CSS 규칙이 이 수까지 있다(app/globals.css) */
export const LIST_ENTER_MAX = 6;

/**
 * 뼈대가 한 번 칠해진 뒤(두 번째 animation frame) 아직 화면에 있으면 첫 화면 카드 수를 재 `<html>`에 단다. 그 사이 카드로 바뀌었으면
 * 달지 않는다(뼈대를 본 적이 없다). 수는 지금 목록의 규칙과 같다: 뼈대 두 장의 간격으로 스크롤 영역 아래까지 들어가는 카드 수.
 * 이 함수는 LIST_ENTER_SCRIPT에 문자열로 들어가 브라우저에서 그대로 돈다. 그래서 바깥 이름(import, 상수)을 쓰지 않는다.
 */
export function markListEnter(feed: Element | null, skeletonSelector: string, scrollSelector: string, attr: string, max: number): void {
  if (!feed) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!feed.isConnected) return;
      const skeletons = feed.querySelectorAll(skeletonSelector);
      const scroll = document.querySelector(scrollSelector);
      if (skeletons.length < 2 || !scroll) return;
      const top = skeletons[0].getBoundingClientRect().top;
      const step = skeletons[1].getBoundingClientRect().top - top;
      if (step <= 0) return;
      const count = Math.min(max, Math.max(0, Math.ceil((scroll.getBoundingClientRect().bottom - top) / step)));
      if (count > 0) document.documentElement.setAttribute(attr, String(count));
    }),
  );
}

const ARGS = [SKELETON_CARD_SELECTOR, APP_SCROLL_SELECTOR, LIST_ENTER_ATTR].map((value) => JSON.stringify(value)).join(",");

/** 뼈대 목록 맨 끝에 두는 인라인 스크립트. 부모(뼈대 목록)를 재서 표시를 단다 */
export const LIST_ENTER_SCRIPT = `try{(${markListEnter.toString()})(document.currentScript&&document.currentScript.parentElement,${ARGS},${LIST_ENTER_MAX})}catch(e){}`;

/** 목록 뼈대가 클라이언트에서 그려졌을 때(앱 안 이동). 인라인 스크립트는 클라이언트 렌더에서 돌지 않는다 */
export function markListEnterFrom(feed: Element | null): void {
  markListEnter(feed, SKELETON_CARD_SELECTOR, APP_SCROLL_SELECTOR, LIST_ENTER_ATTR, LIST_ENTER_MAX);
}

/** 서버 첫 페이지의 등장이 다 돌면(또는 돌 것이 없으면) 표시를 지운다 */
export function clearListEnterWhenDone(feed: Element | null): () => void {
  const root = document.documentElement;
  if (!root.hasAttribute(LIST_ENTER_ATTR) || !feed) return () => {};
  let cancelled = false;
  const running = feed.getAnimations({ subtree: true }).filter((animation) => animation.playState !== "finished");
  void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
    if (!cancelled) root.removeAttribute(LIST_ENTER_ATTR);
  });
  return () => {
    cancelled = true;
  };
}
