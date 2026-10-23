import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Chip(bundle.css .cn-chip). 높이 36px, 좌우 14px, pill, 흰 바탕(surface) + shadow-chip(테두리 없음). 선택되면 text 배경 / on-text 글자, 그림자 없음.
 * 터치 영역은 위아래 4px 확장해 44px(::after).
 * 선택 모양은 data-selected를 본다. 토글이 아닌 버튼(예: 시트 트리거)은 `aria-pressed={undefined}`로 토글 의미만 뺀다.
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
      data-selected={selected || undefined}
      data-slot="chip"
      className={cn(
        "relative inline-flex min-h-9 items-center gap-1 rounded-pill border border-transparent bg-surface px-3.5 text-body text-text shadow-chip",
        "transition-transform duration-press ease-out active:not-disabled:scale-press",
        "after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-['']",
        "data-selected:border-text data-selected:bg-text data-selected:text-on-text data-selected:shadow-none",
        "disabled:cursor-not-allowed disabled:border-disabled-bg disabled:bg-disabled-bg disabled:text-disabled-text disabled:shadow-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
