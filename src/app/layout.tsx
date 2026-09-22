import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SERVICE_NAME } from "@/shared/config/service";
// Pretendard Variable dynamic subset: 유니코드 범위별 woff2 92개 중 페이지에 쓰인 글자의 범위만 내려받는다.
// 폰트 파일은 저장소에 두지 않고 pretendard 패키지에서 번들한다. font-family는 토큰 --font-sans의 첫 항목과 같다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: SERVICE_NAME,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
