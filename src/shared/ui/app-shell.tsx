import type { ReactNode } from "react";

/**
 * 뷰포트 전체 canvas 배경 위에 최대 480px(--column-max) 컬럼을 가운데 둔다.
 * 390px 기준 화면은 그대로 들어가고, PC에서는 480px로 고정된다(두 번째 반응형 레이아웃 없음).
 *
 * 컬럼은 화면 높이(100dvh)로 고정하고 스크롤은 안쪽 `app-scroll`이 맡는다(내부 스크롤 컨테이너, handoff (c)).
 * 컬럼은 `position: relative` + `overflow: hidden`이라 하단 CTA, 바텀시트, 토스트, 뷰어는 `position: fixed` 대신
 * 컬럼 기준 `absolute`로 두면 항상 화면 안에 보인다(CLAUDE.md). 포털은 useAppColumn()이 찾는 이 컬럼에 붙인다.
 */
export const APP_COLUMN_SELECTOR = '[data-slot="app-column"]';
export const APP_SCROLL_SELECTOR = '[data-slot="app-scroll"]';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div
        data-slot="app-column"
        className="relative mx-auto flex h-dvh w-full max-w-column flex-col overflow-hidden bg-bg"
      >
        <div data-slot="app-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
