"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getDDay,
  getStatusVariant,
  SEX_LABEL,
  SPECIES_LABEL,
  StatusBadge,
  useAnimal,
} from "@/entities/animal";
import { FavoriteButton } from "@/features/animal-favorite";
import { ShareButton } from "@/features/animal-share";
import { cn } from "@/shared/lib/utils";
import { scrollAppToTop } from "@/shared/ui/app-column";
import { Button } from "@/shared/ui/button";
import { ImageCarousel } from "./image-carousel";
import { ImageViewer } from "./image-viewer";

const STATUS_TEXT = {
  protected: "text-status-protected-text",
  soon: "text-status-soon-text",
  ended: "text-status-ended-text",
} as const;

/**
 * 상세 화면(명세 4.3, handoff 화면 3). id로 조회하고 상태별로 그린다.
 * - 제목: Domain에 이름이 없어 카드 1줄과 같은 규칙(지역)
 * - 상태 + D-day: StatusBadge(상태만) 옆에 D-day를 title 크기로 강조. 종료이거나 dDay가 없으면(만료된 보호중) D-day 없음
 * - 하단 CTA: 스크롤 컨테이너 안 sticky bottom-0(fixed 아님). data-slot="bottom-cta"로 토스트를 CTA 위로 올린다
 */
export function AnimalDetail({ id }: { id: string }) {
  const query = useAnimal(id);
  const [now] = useState(() => new Date());
  // 메인 사진의 현재 위치. 뷰어를 닫으면 뷰어의 마지막 위치로 맞춘다
  const [photoIndex, setPhotoIndex] = useState(0);
  // 열린 뷰어의 시작 위치. null이면 닫힘
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const goBack = useGoBack();

  // 내부 스크롤 컨테이너는 화면을 옮겨도 유지되므로 상세 진입 시 맨 위로
  useEffect(() => scrollAppToTop(), [id]);

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="px-page pt-[calc(var(--space-3)+env(safe-area-inset-top,0px))]">
          <BackButton onClick={goBack} className="bg-bg" />
        </div>
        <div role="status" className="flex flex-col items-center gap-4 px-page py-20 text-center">
          <p className="text-card-title">지금은 고양이를 불러오지 못했어요</p>
          <Button variant="primary" size="touch" onClick={goBack}>
            뒤로가기
          </Button>
        </div>
      </div>
    );
  }

  const animal = query.data;
  const variant = getStatusVariant(animal, now);
  const ended = variant === "ended";
  const dDay = ended ? null : getDDay(animal, now);
  const alt = `${SPECIES_LABEL[animal.species]} 사진, ${animal.regionText}`;
  const rows = [
    ["보호소", animal.shelterName],
    ["발견 장소", animal.foundPlaceText],
    ["공고 기간", animal.noticePeriodText],
  ].filter((row): row is [string, string] => row[1] !== null);

  return (
    <article data-slot="animal-detail" className="flex min-h-full flex-col">
      <div className="relative">
        <ImageCarousel
          images={animal.images}
          alt={alt}
          ended={ended}
          index={photoIndex}
          onIndexChange={setPhotoIndex}
          onOpen={setViewerIndex}
        />
        <div className="absolute top-[calc(var(--space-3)+env(safe-area-inset-top,0px))] left-page">
          <BackButton onClick={goBack} />
        </div>
      </div>

      <div className="flex-1 px-page pt-4 pb-6">
        <div className="flex items-center gap-2">
          <StatusBadge variant={variant} dDay={null} />
          {dDay !== null && (
            <span data-slot="d-day" className={cn("text-title", STATUS_TEXT[variant])}>
              {dDay === 0 ? "D-day" : `D-${dDay}`}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-title">{animal.regionText}</h1>
        <p className="mt-1 text-body text-text-2">
          {SEX_LABEL[animal.sex]} · {animal.ageText ?? "나이 미상"}
        </p>
        {rows.length > 0 && (
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-body">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-text-2">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div
        data-slot="bottom-cta"
        className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-bg px-page pt-3 pb-[calc(var(--space-3)+env(safe-area-inset-bottom,0px))]"
      >
        <FavoriteButton animalId={animal.id} />
        <ShareButton animal={animal} />
      </div>

      {viewerIndex !== null && (
        <ImageViewer
          images={animal.images}
          alt={alt}
          initialIndex={viewerIndex}
          onClose={(lastIndex) => {
            setPhotoIndex(lastIndex);
            setViewerIndex(null);
          }}
        />
      )}
    </article>
  );
}

function BackButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button variant="overlay" size="icon-touch" aria-label="뒤로가기" onClick={onClick} className={className}>
      <ChevronLeft aria-hidden strokeWidth={1.8} />
    </Button>
  );
}

/** 명세 7.1: 상단 이미지 영역 + 텍스트 줄 스켈레톤(움직임 없음) */
function DetailSkeleton() {
  return (
    <div aria-hidden data-slot="detail-skeleton">
      <div className="aspect-4/5 bg-status-ended-bg" />
      <div className="px-page pt-4">
        <div className="h-6 w-24 rounded-pill bg-status-ended-bg" />
        <div className="mt-3 h-7 w-2/3 rounded-[7px] bg-status-ended-bg" />
        <div className="mt-2 h-4 w-1/3 rounded-[6px] bg-status-ended-bg" />
      </div>
    </div>
  );
}

/**
 * 뒤로가기. 앱 안에서 들어왔으면(history가 있으면) 이전 화면으로, 링크로 바로 열었으면 목록으로.
 * 외부 사이트에서 같은 탭으로 들어온 경우까지 구분하지는 않는다(12절).
 */
function useGoBack() {
  const router = useRouter();
  return () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };
}
