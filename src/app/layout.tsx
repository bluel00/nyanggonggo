import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SERVICE_NAME } from "@/shared/config/service";
import { AppShell } from "@/shared/ui/app-shell";
// Pretendard Variable dynamic subset: 유니코드 범위별 woff2 92개 중 페이지에 쓰인 글자의 범위만 내려받는다.
// 폰트 파일은 저장소에 두지 않고 pretendard 패키지에서 번들한다. font-family는 토큰 --font-sans의 첫 항목과 같다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: SERVICE_NAME,
};

// safe area(env(safe-area-inset-*))를 쓰기 위해 viewport-fit=cover (docs/design/handoff.md (c))
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
