import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Chip(bundle.css .cn-chip). 높이 36px, 좌우 14px, pill, 흰 바탕(surface) + shadow-chip(테두리 없음). 선택되면 text 배경 / on-text 글자, 그림자 없음.
 * 터치 영역은 위아래 4px 확장해 44px(::after).
 */
export function Chip({
  selected,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      data-slot="chip"
      className={cn(
        "relative inline-flex min-h-9 items-center gap-1 rounded-pill border border-transparent bg-surface px-3.5 text-body text-text shadow-chip",
        "transition-transform duration-press ease-out active:not-disabled:scale-press",
        "after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-['']",
        "aria-pressed:border-text aria-pressed:bg-text aria-pressed:text-on-text aria-pressed:shadow-none",
        "disabled:cursor-not-allowed disabled:border-disabled-bg disabled:bg-disabled-bg disabled:text-disabled-text disabled:shadow-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
