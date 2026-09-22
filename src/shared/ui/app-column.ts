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

/** 내부 스크롤 컨테이너를 맨 위로 */
export function scrollAppToTop(): void {
  document.querySelector<HTMLElement>(APP_SCROLL_SELECTOR)?.scrollTo({ top: 0 });
}
