"use client";

import { Toaster as Sonner } from "sonner";

/**
 * 토스트(bundle.css .cn-toast). body가 아니라 480px 컬럼 안에 두고 `position: fixed` 대신 absolute로 띄운다(CLAUDE.md).
 * AppShell의 overlay 자리(스크롤 영역 밖, 컬럼 안)에 렌더한다.
 *
 * 아래쪽 여백은 --toast-offset(기본 space-6)에 safe area를 더한다. 하단 CTA가 있는 화면은 globals.css에서
 * 이 값을 CTA 높이만큼 올린다(handoff 화면 6: CTA 바 위로 뜬다). 라이트 모드만 다룬다(next-themes 미사용).
 */
const BOTTOM = "calc(var(--toast-offset, var(--space-6)) + env(safe-area-inset-bottom, 0px))";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: BOTTOM, left: "var(--space-4)", right: "var(--space-4)" }}
      mobileOffset={{ bottom: BOTTOM, left: "var(--space-4)", right: "var(--space-4)" }}
      style={{ position: "absolute" }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-full justify-center pointer-events-none",
          title: "rounded-control bg-text px-5 py-3 text-center text-body text-on-text",
        },
      }}
    />
  );
}
