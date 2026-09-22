import { cn } from "@/shared/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string };

/** Segmented(bundle.css .cn-seg). radiogroup, 버튼 높이 36px, 선택은 bg 배경 + text 글자 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1 rounded-pill bg-status-ended-bg p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-9 flex-1 rounded-pill text-body text-text-2",
            "aria-checked:bg-bg aria-checked:text-text",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
