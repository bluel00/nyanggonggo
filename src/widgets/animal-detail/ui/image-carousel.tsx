"use client";

import { useEffect, useRef } from "react";
import { AnimalPhoto, PHOTO_SIZES } from "@/entities/animal";
import { cn } from "@/shared/lib/utils";

/**
 * 상세 메인 사진(폭 가득). 네이티브 CSS scroll-snap으로 좌우 스와이프한다(라이브러리 없음).
 * 사진은 잘리지 않는다(PRD v1.3): 모든 슬라이드가 같은 칸 비율(boxRatio, 첫 사진 비율을 3:4~4:3으로 제한, 모르면 1:1)이고
 * 사진은 그 칸 안에 contain, 빈 곳은 bg다. 칸 비율은 서버 HTML에 들어 있어 사진이 로드될 때 화면이 밀리지 않고, 넘겨도 높이가 같다.
 * 현재 위치(index)는 부모가 들고 있다(뷰어를 닫으면 그 위치로 맞춘다, 명세 4.4.2).
 * 사진을 탭하면 onOpen(index). 1장이면 도트 없이 정적, 0장이면 카드와 같은 대체 UI.
 * 도트는 사진 아래(handoff 화면 3: 6px, 현재 text, 나머지 control-border, 간격 space-2).
 */
export function ImageCarousel({
  images,
  boxRatio,
  alt,
  ended,
  index,
  onIndexChange,
  onOpen,
}: {
  images: readonly string[];
  /** 사진 칸 비율(가로/세로). photoBoxRatio */
  boxRatio: number;
  alt: string;
  ended: boolean;
  index: number;
  onIndexChange: (index: number) => void;
  onOpen: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  // 부모가 index를 바꾸면(뷰어를 닫은 뒤 등) 그 사진으로 스크롤한다
  useEffect(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    if (Math.round(track.scrollLeft / track.clientWidth) !== index) {
      track.scrollTo({ left: index * track.clientWidth });
    }
  }, [index]);

  if (images.length === 0) {
    return (
      <div className="bg-status-ended-bg" style={{ aspectRatio: boxRatio }}>
        <AnimalPhoto src={null} alt={alt} />
      </div>
    );
  }

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== index && next >= 0 && next < images.length) onIndexChange(next);
  };

  return (
    <div>
      <div
        ref={trackRef}
        data-slot="image-carousel"
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <button
            key={src}
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
              priority={i === 0}
              highPriority={i === 0}
              fit="contain"
              sizes={PHOTO_SIZES.detail}
            />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <div data-slot="carousel-dots" aria-hidden className="flex justify-center gap-2 pt-3">
          {images.map((src, i) => (
            <span
              key={src}
              data-current={i === index}
              className={cn("size-1.5 rounded-full", i === index ? "bg-text" : "bg-control-border")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
