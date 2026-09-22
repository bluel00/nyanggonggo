"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
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

const SCROLL_KEY_PREFIX = "nyanggonggo:scroll:";

/**
 * 내부 스크롤 컨테이너의 위치를 key별로 sessionStorage에 저장하고, 화면이 다시 마운트되어 ready가 되면 한 번 복원한다.
 * 목록 → 상세 → 뒤로가기 때 목록 위치를 되살린다(architecture.md 7절). 저장소 접근이 막혀도 동작은 계속한다.
 */
export function useAppScrollRestoration(key: string, ready: boolean): void {
  const restored = useRef(false);

  useEffect(() => {
    const container = document.querySelector<HTMLElement>(APP_SCROLL_SELECTOR);
    if (!container) return;
    const save = () => {
      try {
        sessionStorage.setItem(SCROLL_KEY_PREFIX + key, String(container.scrollTop));
      } catch {
        // 저장 실패는 무시(복원만 안 된다)
      }
    };
    container.addEventListener("scroll", save, { passive: true });
    return () => container.removeEventListener("scroll", save);
  }, [key]);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const container = document.querySelector<HTMLElement>(APP_SCROLL_SELECTOR);
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(SCROLL_KEY_PREFIX + key);
    } catch {
      return;
    }
    if (container && saved) container.scrollTop = Number(saved);
  }, [ready, key]);
}
