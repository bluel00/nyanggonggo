"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { useFavorite } from "../model/use-favorites";

/**
 * 찜 버튼(누르는 영역 44x44). variant:
 * - outline: 상세 하단 CTA(bundle.css .cn-btn--fav, 흰 바탕 surface + shadow-control, 테두리 없음)
 * - overlay: 카드 사진 위. 흰 원(photo-pill)은 40px이고 누르는 영역은 44px 그대로다(handoff 찜 하트)
 *
 * 움직임(README 움직임 표): 켤 때 하트를 바로 채우고 아이콘만 1 → 1.2(45%) → 1로 튄다(280ms, globals.css [data-heart-pop]).
 * 흰 원 크기는 그대로다. 끌 때는 채움이 120ms에 걸쳐 사라진다. 종료 공고(`ended`)와 움직임 줄이기는 채움만 바로 바뀌고
 * 튐·페이드·누름 효과가 없다.
 */
export function FavoriteButton({
  animalId,
  variant = "outline",
  ended = false,
  className,
}: {
  animalId: string;
  variant?: "outline" | "overlay";
  /** 종료 공고면 움직임 없이 채움만 바꾼다 */
  ended?: boolean;
  className?: string;
}) {
  const { isFavorite, toggle } = useFavorite(animalId);
  // 켤 때마다 1씩 늘려 아이콘을 다시 그린다(애니메이션을 처음부터). 0이면 아직 켠 적이 없어 튀지 않는다
  const [pops, setPops] = useState(0);
  const pop = pops > 0 && isFavorite && !ended;
  const heart = (
    <Heart
      key={pops}
      aria-hidden
      data-heart-pop={pop ? "" : undefined}
      className={cn("size-[22px]", !ended && !isFavorite && "motion-safe:transition-[fill-opacity] motion-safe:duration-[var(--heart-off-duration)]")}
      strokeWidth={1.8}
      fill="currentColor"
      fillOpacity={isFavorite ? 1 : 0}
    />
  );
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
        if (!isFavorite) setPops((count) => count + 1);
        toggle();
      }}
      className={cn(
        "group inline-flex size-touch flex-none items-center justify-center rounded-pill text-text",
        !ended && "transition-[scale] duration-press ease-out motion-safe:active:scale-press",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        variant === "outline" && "bg-surface shadow-control active:bg-bg",
        className,
      )}
    >
      {variant === "overlay" ? (
        <span data-slot="favorite-circle" className="inline-flex size-10 items-center justify-center rounded-pill bg-photo-pill group-active:bg-bg">
          {heart}
        </span>
      ) : (
        heart
      )}
    </button>
  );
}
