import type { ReactNode } from "react";

/**
 * 뷰포트 전체 canvas 배경 위에 최대 480px(--column-max) 컬럼을 가운데 둔다.
 * 390px 기준 화면은 그대로 들어가고, PC에서는 480px로 고정된다(두 번째 반응형 레이아웃 없음).
 *
 * 컬럼은 `position: relative`다. 하단 CTA, 바텀시트, 토스트, 뷰어는 `position: fixed`를 쓰지 않고
 * 이 컬럼 기준 `absolute` 또는 `sticky`로 둔다(CLAUDE.md, docs/design/handoff.md (c)).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div data-slot="app-column" className="relative mx-auto flex min-h-dvh w-full max-w-column flex-col bg-bg">
        {children}
      </div>
    </div>
  );
}
