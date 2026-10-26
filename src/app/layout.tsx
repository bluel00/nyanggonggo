import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SERVICE_NAME } from "@/shared/config/service";
import { AppShell } from "@/shared/ui/app-shell";
import { Toaster } from "@/shared/ui/sonner";
import { SITE_METADATA_BASE } from "./site-metadata";
// Pretendard Variable dynamic subset: 유니코드 범위별 woff2 92개 중 페이지에 쓰인 글자의 범위만 내려받는다.
// 폰트 파일은 저장소에 두지 않고 pretendard 패키지에서 번들한다. font-family는 토큰 --font-sans의 첫 항목과 같다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: SERVICE_NAME,
  // 링크 미리보기의 og:url·og:image 절대 주소 기준(app/site-metadata.ts, #69)
  metadataBase: SITE_METADATA_BASE,
};

// safe area(env(safe-area-inset-*))를 쓰기 위해 viewport-fit=cover (docs/design/handoff.md (c))
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: ReactNode; modal: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <AppShell stack={modal} overlay={<Toaster />}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
