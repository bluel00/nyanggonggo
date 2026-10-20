"use client";

import { useSyncExternalStore } from "react";
import { APP_COLUMN_SELECTOR, APP_SCROLL_SELECTOR } from "./app-shell";

const subscribe = () => () => {};

/** 포털 대상(480px 컬럼). 서버 렌더와 컬럼이 없는 환경(테스트 등)에서는 null이며, 이때 포털은 body로 간다. */
export function useAppColumn(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => document.querySelector<HTMLElement>(APP_COLUMN_SELECTOR),
    () => null,
  );
}

function appScrollContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(APP_SCROLL_SELECTOR);
}

/** 내부 스크롤 컨테이너가 화면에서 차지하는 영역(보이는 범위). 컨테이너가 없으면 null */
export function appScrollViewport(): DOMRect | null {
  return appScrollContainer()?.getBoundingClientRect() ?? null;
}

/** 내부 스크롤 컨테이너를 맨 위로 */
export function scrollAppToTop(): void {
  const container = appScrollContainer();
  if (!container) return;
  // jsdom 등 scrollTo가 없는 환경도 있다
  if (typeof container.scrollTo === "function") container.scrollTo({ top: 0 });
  else container.scrollTop = 0;
}
