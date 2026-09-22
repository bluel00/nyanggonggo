import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Chip(bundle.css .cn-chip). 높이 36px, 좌우 14px, pill, 1px border. 선택되면 text 배경 / on-text 글자.
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
        "relative inline-flex min-h-9 items-center gap-1 rounded-pill border border-border bg-bg px-3.5 text-body text-text",
        "transition-transform duration-press ease-out active:not-disabled:scale-press",
        "after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-['']",
        "aria-pressed:border-text aria-pressed:bg-text aria-pressed:text-on-text",
        "disabled:cursor-not-allowed disabled:border-disabled-bg disabled:bg-disabled-bg disabled:text-disabled-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
