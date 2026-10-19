import type { CSSProperties } from "react";

/**
 * 요소에 걸린 애니메이션(CSS animation·transition)이 모두 끝나면 풀린다. 애니메이션이 없으면(움직임 줄이기, 이미 끝남,
 * getAnimations가 없는 환경) 바로 풀린다. 취소된 애니메이션도 끝난 것으로 본다.
 */
export function animationsFinished(element: Element): Promise<void> {
  const animations = typeof element.getAnimations === "function" ? element.getAnimations() : [];
  return Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => undefined);
}

/** 등장 순서(--enter-i). globals.css의 [data-enter]가 이 순서 × 간격만큼 늦게 시작한다 */
export function enterOrder(index: number): CSSProperties {
  return { "--enter-i": index } as CSSProperties;
}
