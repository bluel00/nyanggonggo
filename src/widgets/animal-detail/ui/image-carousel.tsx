"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimalPhoto, PHOTO_SIZES, photoTransition } from "@/entities/animal";
import { cn } from "@/shared/lib/utils";
import { ViewTransition } from "@/shared/ui/view-transition";

/**
 * 상세 메인 사진. 칸은 부모가 좌우 24px 안쪽으로 두고, 여기서 radius-card로 자르고 칸 바깥 둘레에 shadow-photo를 둔다
 * (사진 위·안에는 그림자를 넣지 않는다. 종료 공고는 그림자 없음, 방향 A). 네이티브 CSS scroll-snap으로 좌우 스와이프한다(라이브러리 없음).
 * 사진은 잘리지 않는다(PRD v1.3): 모든 슬라이드가 같은 칸 비율(boxRatio, 첫 사진 비율을 3:4~4:3으로 제한, 모르면 1:1)이고
 * 사진은 그 칸 안에 contain, 빈 곳은 bg다. 칸 비율은 서버 HTML에 들어 있어 사진이 로드될 때 화면이 밀리지 않고, 넘겨도 높이가 같다.
 * 현재 위치(index)는 부모가 들고 있다(뷰어를 닫으면 그 위치로 맞춘다, 명세 4.4.2).
 * 사진을 탭하면 onOpen(index). 1장이면 도트 없이 정적, 0장이면 카드와 같은 대체 UI.
 * 도트는 사진 아래(handoff 화면 3: 6px, 현재 text, 나머지 control-border, 간격 space-2). 도트 줄 자리(위 12px + 6px)는 사진 수와
 * 상관없이 늘 두고 1장 이하면 비워 둔다: 로딩 뼈대가 같은 자리를 두어 뼈대 → 상세에서 사진 아래가 움직이지 않는다(12절 B 54 결정).
 *
 * 카드 → 상세 전환(architecture.md 14.2 4단계): 사진 칸(track)은 목록 카드 사진과 같은 전환 이름을 갖는다(transitionId).
 * firstPhotoSrc가 있으면(카드에서 들어옴) 첫 장은 카드가 받아 둔 주소를 그대로 쓰고, 처음 보이는 장(index)은 바로 받고 바로 디코드한다:
 * 로딩 화면 → 서버 페이지로 다시 마운트돼도 보던 사진이 비는 프레임 없이 그려진다. 나머지 장은 지금처럼 지연 로딩이다: 전환은 새 화면의
 * 사진이 로드될 때까지 커밋을 기다리므로, 아직 받지 않은 장까지 바로 받게 하면 상세가 그만큼 늦게 뜬다(2026-10-20 실측 약 +200ms).
 * enter는 전환을 지원하지 않는 브라우저의 사진 페이드.
 * 처음 그릴 때 index가 0이 아니면(로딩 화면에서 넘긴 뒤 서버 페이지로 바뀐 경우) 칠하기 전에 그 장으로 옮긴다.
 */
export function ImageCarousel({
  images,
  boxRatio,
  alt,
  ended,
  index,
  onIndexChange,
  onOpen,
  transitionId,
  firstPhotoSrc,
  enter,
}: {
  images: readonly string[];
  /** 사진 칸 비율(가로/세로). photoBoxRatio */
  boxRatio: number;
  alt: string;
  ended: boolean;
  index: number;
  onIndexChange: (index: number) => void;
  onOpen: (index: number) => void;
  /** 카드 → 상세 전환의 짝(공고 id) */
  transitionId?: string;
  /** 첫 장에 쓸, 이미 받아 둔 주소 */
  firstPhotoSrc?: string;
  /** 사진 칸에 붙일 진입 효과 속성(globals.css [data-detail-enter]) */
  enter?: { "data-detail-enter": string; style: CSSProperties };
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // 처음 그릴 때 보이는 장(로딩 화면 → 서버 페이지로 바뀐 경우 보던 장)
  const [shownAtMount] = useState(index);

  // 부모가 index를 바꾸면(뷰어를 닫은 뒤 등) 그 사진으로 스크롤한다. 칠하기 전에 옮겨 첫 장이 한 프레임 보이지 않게 한다
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    if (Math.round(track.scrollLeft / track.clientWidth) !== index) {
      track.scrollTo({ left: index * track.clientWidth });
    }
  }, [index]);

  if (images.length === 0) {
    return (
      <div>
        <div className="overflow-hidden rounded-card bg-status-ended-bg" style={{ aspectRatio: boxRatio }}>
          <AnimalPhoto src={null} alt={alt} />
        </div>
        <CarouselDots count={0} index={0} />
      </div>
    );
  }

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== index && next >= 0 && next < images.length) onIndexChange(next);
  };

  const track = (
      <div
        ref={trackRef}
        data-slot="image-carousel"
        onScroll={handleScroll}
        {...enter}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto rounded-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          !ended && "shadow-photo",
        )}
      >
        {images.map((src, i) => (
          <button
            key={`${i}-${src}`}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={images.length > 1 ? `사진 크게 보기 (${i + 1}/${images.length})` : "사진 크게 보기"}
            style={{ aspectRatio: boxRatio }}
            className="w-full shrink-0 snap-center bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <AnimalPhoto
              src={src}
              alt={`${alt} ${i + 1}`}
              ended={ended}
              priority={i === 0 || (Boolean(firstPhotoSrc) && i === shownAtMount)}
              highPriority={i === 0}
              fit="contain"
              sizes={PHOTO_SIZES.detail}
              knownSrc={i === 0 ? firstPhotoSrc : undefined}
              decodeSync={Boolean(firstPhotoSrc) && i === shownAtMount}
            />
          </button>
        ))}
      </div>
  );

  return (
    <div>
      {transitionId ? <ViewTransition {...photoTransition(transitionId)}>{track}</ViewTransition> : track}
      <CarouselDots count={images.length} index={index} />
    </div>
  );
}

/** 도트 줄. 자리(pt-3 + 6px)는 늘 두고, 사진이 2장 이상일 때만 도트를 그린다 */
function CarouselDots({ count, index }: { count: number; index: number }) {
  return (
    <div data-slot="carousel-dots" aria-hidden className="box-content flex h-1.5 justify-center gap-2 pt-3">
      {count > 1 &&
        Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            data-current={i === index}
            className={cn("size-1.5 rounded-full", i === index ? "bg-text" : "bg-control-border")}
          />
        ))}
    </div>
  );
}
