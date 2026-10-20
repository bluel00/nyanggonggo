import type { ReactNode } from "react";
import { APP_OVERLAY_SCROLL_SLOT } from "./app-shell";

/**
 * 시험판(spike-stack-nav): 컬럼 전체를 덮는 층. 아래 목록은 언마운트되지 않고 그대로 남는다.
 * 자기 스크롤 영역을 가진다(scrollAppToTop 등은 이 층이 있으면 이 영역을 쓴다, shared/ui/app-column.ts).
 */
export function StackOverlay({ children }: { children: ReactNode }) {
  return (
    <div data-slot="app-overlay" className="absolute inset-0 z-30 flex flex-col bg-linear-to-b from-bg to-bg-end">
      <div data-slot={APP_OVERLAY_SCROLL_SLOT} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
