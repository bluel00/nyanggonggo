import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * 화면 틀: 헤더 줄 + 본문(`main`). 안전 영역 위쪽은 헤더 줄이 맡는다(sticky 헤더가 노치 영역까지 바탕을 칠한다).
 *
 * center: 본문을 남은 영역이 아니라 **화면 전체**의 세로 가운데에 둔다(홈). 본문 아래에 헤더 높이(--header-h)를 비워 위아래를
 * 맞추고, 아래 안전 영역도 비운다. 목록·찜은 아래 안전 영역을 비우지 않는다(handoff: 하단 34px은 시트·CTA 바만).
 */
export function ScreenShell({ header, children, center = false }: { header: ReactNode; children: ReactNode; center?: boolean }) {
  return (
    <div className={cn("flex min-h-full flex-col", center && "pb-[env(safe-area-inset-bottom,0px)]")}>
      {header}
      <main className={cn(center && "flex flex-1 flex-col justify-center pb-(--header-h)")}>{children}</main>
    </div>
  );
}

/**
 * 헤더 줄 틀(handoff 화면 1~2): 높이는 --header-h(space-3 + touch + space-3) 이상이고 내용이 넘치면 늘어난다. 가로 page 여백,
 * 왼쪽(start)·오른쪽(end) 자리. 위 안전 영역만큼 더 높다. 스크롤 구분선은 없다.
 * 44px 터치 영역이 맨 앞에 오면 그 안쪽 여백만큼 왼쪽으로 당겨(-ml-2) 글자·아이콘이 page 여백에 맞게 한다(쓰는 쪽에서).
 *
 * sticky: 스크롤해도 위에 붙고 bg로 칠한다(목록·찜). 홈은 스크롤하지 않고 바탕 그라데이션이 보여야 해서 끈다.
 */
export function ScreenHeader({ start, end, sticky = false }: { start: ReactNode; end?: ReactNode; sticky?: boolean }) {
  return (
    <header
      className={cn(
        "flex min-h-[calc(var(--header-h)+env(safe-area-inset-top,0px))] items-center justify-between gap-2 px-page pt-(--screen-top) pb-3",
        sticky && "sticky top-0 z-10 bg-bg",
      )}
    >
      {start}
      {end && <div className="flex items-center gap-2">{end}</div>}
    </header>
  );
}
