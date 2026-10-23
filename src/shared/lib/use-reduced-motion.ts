"use client";

import { useSyncExternalStore } from "react";

/** 움직임 줄이기 판정의 유일한 기준(이슈 #29). 훅과 일회성 판정이 같은 쿼리를 쓴다 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** 지금 움직임 줄이기 설정인지(이벤트 처리 중 한 번 읽을 때). 서버나 matchMedia가 없는 환경에서는 false */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(QUERY).matches === true;
}

/** 움직임 줄이기 설정. 서버 렌더에서는 false(설정을 모른다) */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
