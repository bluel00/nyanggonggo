import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { displayFont } from "./display-font";

const SIZE = {
  home: "text-display-home",
  title: "text-display-title",
  logo: "text-display-logo",
} as const;

/**
 * 제목 글꼴 Jua로 쓰는 고정 문구(display-font.ts). 글꼴(`displayFont.className`)과 크기(`text-display-*`)를 함께 붙인다.
 * 데이터에서 오는 글자에는 쓰지 않는다. 상세 제목(`text-display-detail`)은 Pretendard라 여기 없다.
 *
 * 화면 틀(screen-shell)과 나눈 파일이다: 글꼴 미리 불러오기는 이 모듈을 가져오는 화면(홈, 목록)에만 붙어야 한다.
 */
export function DisplayText({
  as: Tag = "span",
  size,
  className,
  children,
}: {
  as?: "h1" | "p" | "span";
  size: keyof typeof SIZE;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn(displayFont.className, SIZE[size], className)}>{children}</Tag>;
}
