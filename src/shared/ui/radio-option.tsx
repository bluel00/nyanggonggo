import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Radio(bundle.css .cn-radio). 44px 행, 20px 원(2px control-border), 선택 시 text 테두리 + 10px 점 */
export function RadioOption({
  checked,
  onSelect,
  children,
  className,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "group flex min-h-touch w-full items-center gap-2 text-left text-body text-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <i
        aria-hidden
        className={cn(
          "flex size-5 flex-none items-center justify-center rounded-full border-2 border-control-border",
          "transition-transform duration-press ease-out group-active:scale-press",
          "group-aria-checked:border-text group-aria-checked:after:size-2.5 group-aria-checked:after:rounded-full group-aria-checked:after:bg-text group-aria-checked:after:content-['']",
        )}
      />
      {children}
    </button>
  );
}
