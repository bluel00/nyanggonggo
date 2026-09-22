"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimalPhoto } from "@/entities/animal";
import { useAppColumn } from "@/shared/ui/app-column";
import { Button } from "@/shared/ui/button";

/**
 * 풀스크린 사진 뷰어(명세 4.4, handoff 화면 4). handoff는 widgets/image-viewer로 두었지만 FSD에서 같은 레이어의
 * 다른 slice를 import하지 않도록 상세 위젯 slice 안에 둔다(다른 화면에서 쓰게 되면 그때 옮긴다).
 * - 480px 컬럼에 포털하고 컬럼 전체를 absolute로 덮는다. PC에서도 뷰포트가 아니라 컬럼 안이다(handoff 화면 8c).
 * - viewer-bg 배경, 원본 비율(contain), 우상단 X, 상단 가운데 "2/3"(caption, on-viewer), 좌우 스와이프(scroll-snap)
 * - 닫으면 onClose(마지막 위치)로 상세에 돌려준다(명세 4.4.2). Esc와 좌우 화살표 키도 받는다
 * - 스와이프로 닫기, 더블탭/핀치줌은 만들지 않는다(명세 후순위)
 */
export function ImageViewer({
  images,
  alt,
  initialIndex,
  onClose,
}: {
  images: readonly string[];
  alt: string;
  initialIndex: number;
  onClose: (lastIndex: number) => void;
}) {
  const column = useAppColumn();
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(initialIndex);

  // 열리면 누른 사진 위치로 바로(애니메이션 없이) 이동하고 닫기 버튼에 초점
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track && track.clientWidth > 0) track.scrollLeft = initialIndex * track.clientWidth;
    closeRef.current?.focus();
  }, [initialIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const track = trackRef.current;
      if (event.key === "Escape") onClose(index);
      else if (track && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        const next = Math.min(images.length - 1, Math.max(0, index + (event.key === "ArrowRight" ? 1 : -1)));
        track.scrollTo({ left: next * track.clientWidth });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, index, onClose]);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next >= 0 && next < images.length) setIndex(next);
  };

  const viewer = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      data-slot="image-viewer"
      className="absolute inset-0 z-50 flex flex-col bg-viewer-bg text-viewer-fg"
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={src} className="h-full w-full shrink-0 snap-center">
            <AnimalPhoto src={src} alt={`${alt} ${i + 1}`} fit="contain" priority={i === initialIndex} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center px-page pt-[calc(var(--space-3)+env(safe-area-inset-top,0px))]">
        {images.length > 1 && (
          <p data-slot="viewer-page" aria-live="polite" className="text-caption text-viewer-fg">
            {index + 1}/{images.length}
          </p>
        )}
        <Button
          ref={closeRef}
          variant="overlay"
          size="icon-touch"
          aria-label="닫기"
          onClick={() => onClose(index)}
          className="pointer-events-auto absolute top-[calc(var(--space-3)+env(safe-area-inset-top,0px))] right-page"
        >
          <X aria-hidden strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  );

  // 컬럼이 없는 환경(테스트 등)에서는 body로
  return createPortal(viewer, column ?? document.body);
}
