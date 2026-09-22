import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type SelectOption = { value: string; label: string };

/** Select(bundle.css .cn-select). 네이티브 select, 높이 44px, radius-control, control-border, 오른쪽 chevron */
export function NativeSelect({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "min-h-touch w-full appearance-none rounded-control border border-control-border bg-bg pr-10 pl-4 text-body text-text",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-text-2"
      />
    </label>
  );
}
