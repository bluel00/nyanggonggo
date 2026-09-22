"use client";

import { Heart } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useFavorite } from "../model/use-favorites";

/**
 * 찜 버튼(44x44). variant:
 * - outline: 상세 하단 CTA(bundle.css .cn-btn--fav, bg + 1px border)
 * - overlay: 카드 사진 위(photo-pill 배경, .cn-btn--overlay). 카드 하트는 디자인 시안에 없어 overlay 버튼 모양을 따른다(디자인 미정)
 */
export function FavoriteButton({
  animalId,
  variant = "outline",
  className,
}: {
  animalId: string;
  variant?: "outline" | "overlay";
  className?: string;
}) {
  const { isFavorite, toggle } = useFavorite(animalId);
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "찜 해제" : "찜하기"}
      data-slot="favorite-button"
      onClick={(event) => {
        // 카드 링크나 사진 탭(뷰어)으로 이벤트가 번지지 않게 한다
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      className={cn(
        "inline-flex size-touch flex-none items-center justify-center rounded-pill text-text",
        "transition-transform duration-press ease-out active:scale-press",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        variant === "outline" ? "border border-border bg-bg active:bg-canvas" : "bg-photo-pill active:bg-bg",
        className,
      )}
    >
      <Heart aria-hidden className="size-[22px]" strokeWidth={1.8} fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
}
