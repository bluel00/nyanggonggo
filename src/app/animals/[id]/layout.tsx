import type { ReactNode } from "react";

/**
 * 상세 전체 페이지(공유 링크 직접 진입·새로고침)의 주 랜드마크. 목록·찜에서 얹은 상세(층)는 `@modal/(.)animals/[id]`의 자기 레이아웃을 써서
 * 이 레이아웃을 거치지 않는다. 그래서 층을 띄워도 `<main>`은 아래 화면(ScreenShell)의 것 하나다.
 * 높이는 스크롤 영역 전체라(h-full) 상세(min-h-full)의 하단 바가 지금처럼 화면 아래에 붙는다.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return <main className="h-full">{children}</main>;
}
