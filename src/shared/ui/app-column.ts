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

function appScrollContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(APP_SCROLL_SELECTOR);
}

/** 내부 스크롤 컨테이너를 맨 위로 */
export function scrollAppToTop(): void {
  const container = appScrollContainer();
  if (!container) return;
  // jsdom 등 scrollTo가 없는 환경도 있다
  if (typeof container.scrollTo === "function") container.scrollTo({ top: 0 });
  else container.scrollTop = 0;
}

/**
 * 사용자가 스크롤할 수 있는 상태인지. 화면을 떠나 목록 DOM이 지워지면 scrollHeight가 컨테이너 높이로 줄고
 * 브라우저가 scrollTop을 0으로 누르는데, 그때 오는 이벤트를 사용자의 스크롤로 착각하지 않으려는 판단이다.
 * 레이아웃이 없는 환경(jsdom 등)은 scrollHeight가 0이라 판단할 수 없으므로 그대로 받는다.
 */
function hasScrollableContent(el: HTMLElement): boolean {
  return el.scrollHeight === 0 || el.scrollHeight > el.clientHeight;
}

const SCROLL_KEY_PREFIX = "nyanggonggo:scroll:";
/** 복원할 때 목록 높이가 아직 모자랄 수 있어 몇 프레임까지 다시 시도한다 */
const RESTORE_FRAMES = 10;

function saveScroll(key: string, top: number): void {
  try {
    sessionStorage.setItem(SCROLL_KEY_PREFIX + key, String(top));
  } catch {
    // 저장 실패는 무시(복원만 안 된다)
  }
}

function readScroll(key: string): number {
  try {
    return Number(sessionStorage.getItem(SCROLL_KEY_PREFIX + key) ?? 0);
  } catch {
    return 0;
  }
}

/**
 * 내부 스크롤 컨테이너의 위치를 key별로 sessionStorage에 저장하고, 화면이 다시 마운트되어 ready가 되면 복원한다.
 * 목록 → 상세 → 뒤로가기 때 목록 위치를 되살린다(architecture.md 7절).
 *
 * 복원은 마운트 시점의 key에만 한다(같은 화면에서 필터를 바꾸면 복원하지 않고 맨 위로 간다).
 * 저장은 스크롤할 때(프레임당 한 번)와 화면을 떠날 때(정리 시점, pagehide) 한다.
 *
 * **떠날 때는 스크롤할 내용이 남아 있을 때만 컨테이너를 다시 읽고, 아니면 마지막으로 본 값을 저장한다.**
 * 화면이 사라지는 순간에는 목록 DOM이 이미 지워져 스크롤할 내용이 없고, 브라우저가 scrollTop을 0으로 눌러 버린다.
 * 그때 읽으면 0이 저장된다. 같은 이유로 스크롤할 내용이 없는 상태에서 온 스크롤 이벤트도 무시한다(12절 37).
 *
 * 목록 카드 링크는 `scroll={false}`라 Next가 이동 중에 컨테이너를 건드리지 않는다(그러면 저장값이 덮인다).
 */
export function useAppScrollRestoration(key: string, ready: boolean): void {
  // 복원은 마운트 시점의 key에만 한다. 마운트 중에 필터가 바뀌면 맨 위로 가는 게 맞다(useScrollTopOnFilterChange)
  const mountKey = useRef(key);
  const restored = useRef(false);
  /** 마지막으로 본 스크롤 위치(컨테이너가 비워진 뒤에는 이 값을 저장한다) */
  const lastTop = useRef(0);

  useEffect(() => {
    const container = appScrollContainer();
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      if (!hasScrollableContent(container)) return;
      lastTop.current = container.scrollTop;
      if (frame) return; // 저장은 프레임당 한 번
      frame = requestAnimationFrame(() => {
        frame = 0;
        saveScroll(key, lastTop.current);
      });
    };
    // 아직 스크롤할 수 있으면 지금 위치를, 내용이 지워진 뒤면 마지막으로 본 위치를 저장한다
    const persist = () => {
      if (hasScrollableContent(container)) lastTop.current = container.scrollTop;
      saveScroll(key, lastTop.current);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", persist);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persist);
      persist(); // 화면을 떠나는 시점(상세로 이동, 필터 변경)
    };
  }, [key]);

  useEffect(() => {
    if (!ready || restored.current || key !== mountKey.current) return;
    restored.current = true;
    const target = readScroll(key);
    if (target <= 0) return;

    let frames = 0;
    let id = 0;
    const apply = () => {
      const container = appScrollContainer();
      if (container) {
        container.scrollTop = target;
        // 목록이 충분히 길어 목표 위치에 도달했으면 끝낸다
        if (Math.abs(container.scrollTop - target) < 1) return;
      }
      if (frames >= RESTORE_FRAMES) return;
      frames += 1;
      id = requestAnimationFrame(apply);
    };
    apply();
    return () => {
      if (id) cancelAnimationFrame(id);
      // effect가 다시 붙으면(개발 모드의 이중 호출 등) 다시 복원할 수 있게 둔다
      restored.current = false;
    };
  }, [ready, key]);
}
