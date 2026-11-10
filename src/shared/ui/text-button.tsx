import type { ComponentProps, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/shared/lib/utils";

export type TextButtonVariant = "underline" | "arrow" | "clear";

/**
 * 글자 버튼(디자인 시스템 `TextButton`, handoff (l), 이슈 #127). 틀 없이 글자로 그리는 동작이고 공용 Button과 별개다(토스 TDS와 같은 구분).
 * - 글자 caption 크기 600 `text`, 앞 아이콘 14px(`icon`). 누르면, 호버 가능한 기기에서는 호버도 `text-2`. 크기 변화 없음.
 *   호버: Tailwind v4의 `hover:`는 `@media (hover: hover)` 안에서만 걸리므로 터치 기기에서 눌린 색이 남지 않는다.
 * - variant: `underline`(기본) 글자에만 1px 밑줄(아래 3px) / `arrow` 글자 뒤 ChevronRight 14px("더 보기·이동"에만) / `clear` 단서 없음.
 *   일반 글자 옆의 글자 버튼은 `clear`를 쓰지 않는다(옆 라벨과 구분되지 않았던 원인).
 * - 누르는 영역은 44×44px이고, 위아래 음수 여백으로 줄 높이(20px)는 그대로 둔다.
 * - 기본은 `<button type="button">`. 링크는 공용 Button처럼 `asChild`로 `<a>`를 넘긴다(아이콘·글자·화살표는 그 `<a>` 안에 들어간다).
 */
const TEXT_BUTTON =
  "-my-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-sm text-caption font-semibold text-text active:text-text-2 hover:text-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0";

const LABEL: Record<TextButtonVariant, string | undefined> = {
  underline: "underline decoration-1 underline-offset-3",
  arrow: undefined,
  clear: undefined,
};

export function TextButton({
  variant = "underline",
  icon,
  asChild = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: TextButtonVariant; icon?: ReactNode; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  // 밑줄이 아이콘에 걸리지 않게 글자만 감싼다
  const label = (content: ReactNode) => (
    <span data-slot="text-button-label" className={LABEL[variant]}>
      {content}
    </span>
  );
  return (
    <Comp
      data-slot="text-button"
      data-variant={variant}
      {...(asChild ? {} : { type: "button" as const })}
      className={cn(TEXT_BUTTON, className)}
      {...props}
    >
      {icon}
      {asChild ? <Slot.Slottable child={children}>{label}</Slot.Slottable> : label(children)}
      {variant === "arrow" && <ChevronRight aria-hidden data-slot="text-button-arrow" />}
    </Comp>
  );
}
