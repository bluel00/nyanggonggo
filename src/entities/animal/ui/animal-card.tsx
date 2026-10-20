"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/shared/lib/use-reduced-motion";
import { cn } from "@/shared/lib/utils";
import { ANIMAL_ID_ATTRIBUTE } from "@/shared/ui/app-column";
import { CARD_TO_DETAIL, photoTransition, ViewTransition } from "@/shared/ui/view-transition";
import type { Animal } from "../model/animal";
import type { CardPhotoSize } from "../model/detail-entry";
import { getDDay } from "../model/dDay";
import { getPrimaryImage, getStatusVariant } from "../model/status";
import { AnimalPhoto, PHOTO_SIZES } from "./animal-photo";
import { animalTitle, speciesText } from "./labels";
import { StatusBadge } from "./status-badge";

/**
 * 공고 카드(bundle.css .cn-card). Domain Animal만 받는다.
 *
 * - 흰 카드(surface, radius-card) + shadow-card, 종료는 납작한 shadow-card-ended. 글자 영역 10/12/12px.
 * - 누름(README 움직임 표): scale .98 + shadow-card-pressed, 100ms. 종료 카드와 움직임 줄이기에는 누름 효과가 없다.
 *   등장 효과는 목록 위젯이 첫 화면 카드에만 붙인다(data-enter, 여기서는 하지 않는다)
 * - 사진 1:1 cover, 가운데(center). 이미지 프록시 경유 plain img(lazy). 종료 공고는 saturate(.7), 딤 없음.
 *   4:5 center 35%는 4:3 가로 사진(약 절반)에서 한쪽에 치우친 동물의 얼굴을 잘라 1:1로 바꿨다(architecture.md 12절 51)
 * - 배지: 사진 좌상단(12px), photo-pill 배경. 종료 공고는 "종료"만, 그 외는 D-day가 있을 때만 붙인다
 * - 텍스트: Domain에 이름이 없어 1줄은 지역(regionText), 2줄은 보호소(없으면 발견 장소). 명세의 "지역 · 보호소"를
 *   그대로 쓰면 1줄과 지역이 겹쳐서 2줄에는 보호소만 둔다
 * - href가 있으면 링크, 없으면 정적 article. 링크를 누르면 onSelect로 알린다(목록이 그 카드를 기억해 뒤로 왔을 때 되돌아간다)
 * - action(예: 찜 버튼)은 사진 우상단에 둔다. 링크 안에 버튼을 넣지 않도록 링크와 형제로 두어 카드 이동과 겹치지 않는다
 * - transition이면 카드 → 상세 전환(architecture.md 14.2 4단계): 사진 칸이 상세 사진 칸과 짝을 이루고(View Transitions) 링크가
 *   이동 종류(CARD_TO_DETAIL)를 싣는다. 종료 공고와 움직임 줄이기는 효과 없이 바로 바뀐다(README 원칙).
 *   누를 때 onSelect에 사진이 로드됐으면 그 주소와 실제 가로·세로를, 아니면 null을 넘긴다(위젯이 상세 로딩 화면을 고른다)
 */
/** 누른 카드의 사진. 로드되지 않았으면 null */
export type CardSelection = { photoSrc: string; photoSize: CardPhotoSize } | null;

function cardSelection(link: HTMLElement): CardSelection {
  const img = link.querySelector("img");
  if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return null;
  return { photoSrc: img.currentSrc || img.src, photoSize: { width: img.naturalWidth, height: img.naturalHeight } };
}

export function AnimalCard({
  animal,
  now,
  href,
  priority = false,
  highPriority = false,
  action,
  onSelect,
  onPress,
  transition = false,
}: {
  animal: Animal;
  /** D-day 기준 시각 */
  now: Date;
  href?: string;
  /** 첫 화면 카드는 eager 로딩 */
  priority?: boolean;
  /** 화면의 첫 사진이면 true(fetchpriority="high", 목록의 첫 카드만) */
  highPriority?: boolean;
  /** 사진 우상단 액션(entities는 features를 모르므로 위젯이 넣는다) */
  action?: ReactNode;
  /** 카드를 눌러 상세로 갈 때 */
  onSelect?: (selection: CardSelection) => void;
  /** 카드를 누르기 시작할 때(pointerdown). 다음 화면에 필요한 것을 미리 받는 데 쓴다 */
  onPress?: () => void;
  /** 카드 → 상세 전환을 쓴다(목록). 종료 공고는 무시한다 */
  transition?: boolean;
}) {
  const variant = getStatusVariant(animal, now);
  const ended = variant === "ended";
  const alt = `${speciesText(animal)} 사진, ${animal.regionText}`;
  const sub = animal.shelterName ?? animal.foundPlaceText;
  // 전환 경계는 실제로 이어질 때만 둔다: 경계가 있으면 React가 전환(0ms라도)을 열고 새 화면의 글꼴·사진을 기다린다
  const reducedMotion = usePrefersReducedMotion();
  const morph = transition && !ended && !reducedMotion;
  const photo = (
    <div className="relative aspect-square overflow-hidden bg-status-ended-bg">
      <AnimalPhoto src={getPrimaryImage(animal)} alt={alt} ended={ended} priority={priority} highPriority={highPriority} sizes={PHOTO_SIZES.card} />
      <div className="absolute top-3 left-3">
        <StatusBadge variant={variant} dDay={ended ? null : getDDay(animal, now)} onPhoto />
      </div>
    </div>
  );

  const body = (
    <>
      {morph ? <ViewTransition {...photoTransition(animal.id)}>{photo}</ViewTransition> : photo}
      <div className="px-3 pt-2.5 pb-3">
        <p className="truncate text-card-title">{animalTitle(animal)}</p>
        {sub && <p className="mt-0.5 truncate text-body text-text-2">{sub}</p>}
      </div>
    </>
  );

  // 흰 카드(surface) + 그림자(방향 A). 사진은 카드 위쪽에 붙고 카드 모서리로 잘린다. 사진 위·안에는 그림자를 넣지 않는다
  const className = cn(
    "block w-full overflow-hidden rounded-card bg-surface text-left text-inherit",
    ended ? "shadow-card-ended" : "shadow-card",
  );
  return (
    <div data-slot="animal-card" data-status={variant} {...{ [ANIMAL_ID_ATTRIBUTE]: animal.id }} className="relative">
      {href ? (
        <Link
          href={href}
          onClick={(event) => onSelect?.(cardSelection(event.currentTarget))}
          onPointerDown={onPress}
          transitionTypes={morph ? [CARD_TO_DETAIL] : undefined}
          // Next가 이동할 때 내부 스크롤 컨테이너를 건드리지 않게 한다(새 화면은 각자 맨 위로 올린다)
          scroll={false}
          className={cn(
            className,
            !ended &&
              "transition-[scale,box-shadow] duration-press ease-out motion-safe:active:scale-press motion-safe:active:shadow-card-pressed",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          {body}
        </Link>
      ) : (
        <article className={className}>{body}</article>
      )}
      {action && (
        <div data-slot="animal-card-action" className="absolute top-2 right-2">
          {action}
        </div>
      )}
    </div>
  );
}
