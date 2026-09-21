import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SERVICE_NAME } from "@/shared/config/service";
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
