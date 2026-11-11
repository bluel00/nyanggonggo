import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/lib/utils"
import { Slot } from "radix-ui"

/**
 * 틀이 있는 동작 버튼(디자인 시스템 `Button`, handoff (m), 이슈 #126). 모양은 `variant`, 치수는 `size`로 고른다.
 * 글자로 그린 동작은 TextButton, 상태를 가진 컨트롤(Chip, FavoriteButton)은 자기 컴포넌트다.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** 사진 위 아이콘 버튼(bundle.css .cn-btn--overlay). size="icon-touch"와 함께 쓴다 */
        overlay:
          "rounded-pill bg-photo-pill text-text transition-transform duration-press ease-out active:not-disabled:scale-press active:not-disabled:bg-bg focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        /** 디자인 Primary(bundle.css .cn-btn--primary). size="touch"와 함께 쓴다 */
        primary:
          "rounded-pill bg-primary text-primary-foreground transition-transform duration-press ease-out active:not-disabled:scale-press active:not-disabled:bg-primary-pressed focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:bg-disabled-bg disabled:text-disabled-text disabled:opacity-100",
        /** 필터 시트의 적용하기만(bundle.css .cn-btn--apply): 복숭아색 그라데이션 pill + shadow-apply. size="touch"와 함께 쓴다 */
        apply:
          "rounded-pill bg-linear-135 from-apply-from to-apply-to text-on-apply shadow-apply transition-transform duration-press ease-out active:not-disabled:scale-press focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:shadow-none disabled:opacity-50",
        /** 조용한 두 번째 동작(bundle.css .cn-btn--surface): 흰 surface + shadow-control, 테두리 없음. 누르면 바탕 bg, 비활성은 disabled-bg에 그림자 없음 */
        surface:
          "rounded-pill border-0 bg-surface text-text shadow-control transition-transform duration-press ease-out active:not-disabled:scale-press active:not-disabled:bg-bg focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:bg-disabled-bg disabled:text-disabled-text disabled:opacity-100 disabled:shadow-none",
      },
      size: {
        /** 44px 터치 높이, 좌우 24px, card-title 글자(bundle.css .cn-btn) */
        touch: "min-h-touch gap-1 px-6 text-card-title",
        /** 폭이 빠듯한 바에서 쓰는 44px 높이(디자인 시스템 크기 `compact`, bundle.css .cn-btn--compact): 좌우 12px, 글자 14/20 600, 아이콘 18px, 간격 6px */
        "compact-touch": "min-h-touch gap-1.5 px-3 text-body font-semibold [&_svg:not([class*='size-'])]:size-[18px]",
        /** 44x44 아이콘 버튼 */
        "icon-touch": "size-touch [&_svg:not([class*='size-'])]:size-[22px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "touch",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "touch",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
