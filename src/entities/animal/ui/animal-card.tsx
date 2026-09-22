"use client";

import { ImageOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toImageProxyUrl } from "@/contract/images";
import { cn } from "@/shared/lib/utils";
import type { Animal } from "../model/animal";
import { getDDay } from "../model/dDay";
import { getPrimaryImage, getStatusVariant } from "../model/status";
import { SPECIES_LABEL } from "./labels";
import { StatusBadge } from "./status-badge";

/**
 * 공고 카드(bundle.css .cn-card). Domain Animal만 받는다.
 *
 * - 사진 4:5 cover, 초점 center 35%. 이미지 프록시 경유 plain img(lazy). 종료 공고는 saturate(.7), 딤 없음
 * - 배지: 사진 좌상단(12px), photo-pill 배경. 종료 공고는 "종료"만, 그 외는 D-day가 있을 때만 붙인다
 * - 텍스트: Domain에 이름이 없어 1줄은 지역(regionText), 2줄은 보호소(없으면 발견 장소). 명세의 "지역 · 보호소"를
 *   그대로 쓰면 1줄과 지역이 겹쳐서 2줄에는 보호소만 둔다
 * - href가 있으면 링크(상세 화면은 다음 단계), 없으면 정적 article
 */
export function AnimalCard({
  animal,
  now,
  href,
  priority = false,
}: {
  animal: Animal;
  /** D-day 기준 시각 */
  now: Date;
  href?: string;
  /** 첫 화면 카드는 eager 로딩 */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const variant = getStatusVariant(animal, now);
  const ended = variant === "ended";
  const primary = getPrimaryImage(animal);
  const src = primary ? toImageProxyUrl(primary) : null;
  const alt = `${SPECIES_LABEL[animal.species]} 사진, ${animal.regionText}`;
  const sub = animal.shelterName ?? animal.foundPlaceText;

  const body = (
    <>
      <div className="relative aspect-4/5 overflow-hidden rounded-card bg-status-ended-bg">
        {src && !failed ? (
          // next/image 대신 프록시 캐시를 쓴다(이중 최적화 비용 회피, architecture.md 12절 23)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailed(true)}
            className={cn("block size-full object-cover object-[center_35%]", ended && "saturate-70")}
          />
        ) : (
          // 사진이 없거나 불러오지 못함. 플레이스홀더 디자인은 미정(handoff): 배경 + 아이콘만 둔다
          <div role="img" aria-label={alt} className="flex size-full items-center justify-center text-text-2">
            <ImageOff aria-hidden className="size-6" strokeWidth={1.8} />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge variant={variant} dDay={ended ? null : getDDay(animal, now)} onPhoto />
        </div>
      </div>
      <div className="px-1 pt-3">
        <p className="truncate text-card-title">{animal.regionText}</p>
        {sub && <p className="mt-0.5 truncate text-body text-text-2">{sub}</p>}
      </div>
    </>
  );

  const className = "block w-full overflow-hidden rounded-card bg-bg text-left text-inherit";
  if (href) {
    return (
      <Link
        href={href}
        data-slot="animal-card"
        data-status={variant}
        className={cn(
          className,
          "transition-transform duration-press ease-out active:scale-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {body}
      </Link>
    );
  }
  return (
    <article data-slot="animal-card" data-status={variant} className={className}>
      {body}
    </article>
  );
}
