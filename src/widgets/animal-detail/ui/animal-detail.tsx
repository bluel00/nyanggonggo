"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  allowsMotion,
  ANIMAL_COPY,
  animalTitle,
  clearDetailEntry,
  detailRows,
  detailDeadlineText,
  getDDay,
  getDetailEntry,
  getStatusVariant,
  photoAlt,
  setDetailEntryPhotoIndex,
  sexAgeText,
  StatusBadge,
  useAnimal,
  type DetailEntry,
} from "@/entities/animal";
import { FavoriteButton } from "@/features/animal-favorite";
import { ShareButton, ShareSheetButton } from "@/features/animal-share";
import { ShelterInfoSheet } from "@/features/shelter-info";
import { cn } from "@/shared/lib/utils";
import { BackButton, useGoBack } from "@/shared/ui/back-button";
import { Button } from "@/shared/ui/button";
import { routes } from "@/shared/config/routes";
import { photoBoxRatio, type PhotoSize } from "../model/photo-box";
import { AnimalDetailSkeleton } from "./animal-detail-skeleton";
import { BottomCtaBar, DetailPhotoArea } from "./detail-frame";
import { ImageCarousel } from "./image-carousel";
import { ImageViewer } from "./image-viewer";

/** 상세 제목의 id. 상세 층(app/@modal)이 이 제목으로 이름을 붙인다(aria-labelledby) */
export const DETAIL_TITLE_ID = "animal-detail-title";

/**
 * 진입 효과가 끝나는 시점(누른 뒤). 정보 페이드가 가장 늦다: detail-info-delay 100ms + detail-info-duration 200ms(tokens).
 * 전환이 없을 때의 페이드(200ms)도 이 안에 끝난다. SETTLE은 마지막 프레임이 그려질 여유
 */
const DETAIL_ENTER_TOTAL_MS = 300;
const DETAIL_ENTER_SETTLE_MS = 50;

/**
 * 정보 줄 값의 줄바꿈(이슈 #11). 한글은 기본으로 글자 단위로 끊겨 주소가 "(노 / 량진동)"처럼 갈라졌다. 띄어쓰기에서만 바꾸고(keep-all),
 * 띄어쓰기가 없는 긴 값(긴 단어, URL)은 줄을 넘치지 않게 어디서든 끊는다(overflow-wrap: anywhere. min-content도 줄어 그리드 칸을 밀지 않는다)
 */
const DETAIL_VALUE_WRAP = "break-keep wrap-anywhere";

const STATUS_TEXT = {
  protected: "text-status-protected-text",
  nearDeadline: "text-status-near-deadline-text",
  ended: "text-status-ended-text",
} as const;

/**
 * 상세 화면(명세 4.3, handoff 화면 3). id로 조회하고 상태별로 그린다.
 * - 제목: Domain에 이름이 없어 카드 1줄과 같은 규칙(지역)
 * - 상태 + D-day: StatusBadge(상태만) 옆에 D-day를 title 크기로 강조. 종료이거나 dDay가 없으면(만료된 보호중) D-day 없음
 * - 하단 CTA: 스크롤 컨테이너 안 sticky bottom-0(fixed 아님). data-slot="bottom-cta"로 토스트를 CTA 위로 올린다
 * - 사진 칸: 서버가 읽은 첫 사진 크기(firstPhotoSize)의 비율을 3:4~4:3으로 제한. 모르면 1:1(PRD v1.3)
 *
 * 목록 카드에서 들어온 경우(architecture.md 14.2 4단계, 진입 정보 DetailEntry가 있음): 라우트 로딩 화면에서 목록 데이터로 먼저
 * 그려지고, 서버 페이지가 오면 Next가 이 위젯을 다시 마운트한다. 두 번 그려도 같은 화면이 되게 진입 정보로 이어 그린다:
 * 사진 칸은 카드 사진의 실제 비율(서버 값과 비율이 같으면 그대로), 첫 사진은 카드가 받아 둔 주소, 보던 사진 위치, 스크롤은
 * 처음 한 번만 맨 위로, 정보 페이드는 누른 시각 기준으로 이어 간다. 데이터는 서버 데이터를 따른다(캐시가 덮인다).
 */
export function AnimalDetail({
  id,
  origin,
  firstPhotoSize = null,
}: {
  id: string;
  /** 공유 주소 기준(서버 siteOrigin, 페이지가 넘긴다, #73) */
  origin: string;
  firstPhotoSize?: PhotoSize | null;
}) {
  const query = useAnimal(id);
  const entry = useDetailEntry(id);
  const boxRatio = photoBoxRatio(entry && (!firstPhotoSize || sameRatio(entry.photoSize, firstPhotoSize)) ? entry.photoSize : firstPhotoSize);
  const [now] = useState(() => new Date());
  // 누른 뒤 지난 시간(마운트 때 한 번). 진입 효과를 다시 마운트해도 끊김 없이 이어 그린다
  const [elapsedMs] = useState(() => (entry ? Math.round(performance.now() - entry.startedAt) : 0));
  // 진입 효과가 아직 남았는지. 끝나면 속성을 떼어 애니메이션이 남긴 합성 레이어가 없게 한다: 그래야 로딩 화면과 서버 페이지가
  // 글자 렌더링까지 같은 화면이 된다(남아 있으면 글자 안티앨리어싱이 달라 보였다)
  const [entering, setEntering] = useState(() => entry !== null && elapsedMs < DETAIL_ENTER_TOTAL_MS);
  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => setEntering(false), DETAIL_ENTER_TOTAL_MS - elapsedMs + DETAIL_ENTER_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [entering, elapsedMs]);
  // 메인 사진의 현재 위치. 뷰어를 닫으면 뷰어의 마지막 위치로 맞춘다
  const [photoIndex, setPhotoIndexState] = useState(() => entry?.photoIndex ?? 0);
  const setPhotoIndex = (index: number) => {
    setPhotoIndexState(index);
    setDetailEntryPhotoIndex(id, index);
  };
  // 열린 뷰어의 시작 위치. null이면 닫힘
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // 목록을 거쳐 왔으면 router.back(), 공유 링크로 바로 들어왔으면 `/`(내 평소 화면: 홈 또는 기억된 목록, PRD-v1.4 R2)
  const goBack = useGoBack(routes.entry());

  // 라우트 로딩 경계(loading.tsx)와 같은 뼈대라 둘 사이에서 화면이 바뀌지 않는다
  if (query.isPending) return <AnimalDetailSkeleton photoRatio={boxRatio} />;

  if (query.isError) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="px-page pt-(--screen-top)">
          <BackButton onClick={goBack} className="bg-bg" />
        </div>
        <div role="status" className="flex flex-col items-center gap-4 px-page py-20 text-center">
          <p className="text-card-title">{ANIMAL_COPY.detailErrorTitle}</p>
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
  const dDay = getDDay(animal, now);
  const alt = photoAlt(animal);
  // 진입 효과(globals.css [data-detail-enter]). 종료 공고(서버 데이터로 종료가 된 경우 포함)와 효과 없음은 붙이지 않는다
  // 움직임 줄이기는 진입 효과 CSS(globals.css no-preference)가 거르고 entry.mode도 이미 none이므로 false
  const enterMode = entering && entry && allowsMotion(animal, false) && entry.mode !== "none" ? entry.mode : null;
  const enterStyle = { "--detail-elapsed": `${elapsedMs}ms` } as CSSProperties;
  // data-detail-enter는 app/globals.css의 [data-detail-enter="info"|"fade"]가 읽는다
  const infoEnter = enterMode ? { "data-detail-enter": enterMode === "morph" ? "info" : "fade", style: enterStyle } : {};
  // 줄 끝 동작: 보호소 줄의 [보호소 정보](보호소 정보 시트, #62). 동작 종류는 detailRows가 정한다
  const rows = detailRows(animal).map((row) => ({ ...row, link: row.action === "shelterInfo" ? <ShelterInfoSheet animal={animal} /> : null }));

  return (
    <article data-slot="animal-detail" className="flex min-h-full flex-col">
      {/* 사진 칸: safe area 아래에서 시작해 좌우 24px 안쪽(방향 A, handoff 화면 3~4). 뒤로가기는 칸 왼쪽 위 */}
      <DetailPhotoArea back={<BackButton onClick={goBack} />}>
        <ImageCarousel
          images={animal.images}
          boxRatio={boxRatio}
          alt={alt}
          ended={ended}
          index={photoIndex}
          onIndexChange={setPhotoIndex}
          onOpen={setViewerIndex}
          transitionId={entry?.mode === "morph" ? animal.id : undefined}
          firstPhotoSrc={entry?.photoSrc}
          enter={enterMode === "fade" ? { "data-detail-enter": "fade", style: enterStyle } : undefined}
        />
      </DetailPhotoArea>

      <div {...infoEnter} className="flex-1 px-page pt-4 pb-6">
        {/* 상태 줄은 D-day(title, 28px) 유무와 상관없이 28px이다. 뼈대(AnimalDetailSkeleton)와 같아 내용이 채워질 때 아래가 움직이지 않는다 */}
        <div data-slot="status-row" className="flex h-7 items-center gap-2">
          <StatusBadge animal={animal} now={now} dDay={false} />
          {dDay !== null && (
            <span data-slot="d-day" className={cn("text-title", STATUS_TEXT[variant])}>
              {detailDeadlineText(dDay)}
            </span>
          )}
        </div>
        {/* 보호중(마감이 가까운 공고 포함)은 display-detail(Pretendard 24/32/700), 종료는 차분하게 title 크기(20/700)다(architecture.md 14.1).
            줄 높이는 상태와 상관없이 32px이라 뼈대(AnimalDetailSkeleton)에서 바뀔 때 제목 아래가 움직이지 않는다 */}
        {/* 상세 층(PRD-v1.5)의 이름이고, 층이 열리면 초점을 받는다(shared/ui/stack-layer.tsx). Tab 순서에는 넣지 않는다(-1).
            초점 테두리는 키보드로 연 층에서 :focus-visible일 때만 그린다(터치·클릭으로 열면 WebKit도 그리지 않게 기본 테두리는 끈다) */}
        <h1
          id={DETAIL_TITLE_ID}
          tabIndex={-1}
          data-slot="detail-title"
          className={cn(
            // in-data-[opened-by=keyboard]: shared/ui/stack-layer.tsx가 층에 붙이는 data-opened-by를 읽는다
            // 색·두께는 카드 링크와 같다. outline-none이 테두리 모양 변수를 none으로 두므로 outline-solid로 다시 켠다
            "mt-3 rounded-sm outline-none in-data-[opened-by=keyboard]:focus-visible:outline-solid in-data-[opened-by=keyboard]:focus-visible:outline-2 in-data-[opened-by=keyboard]:focus-visible:outline-offset-2 in-data-[opened-by=keyboard]:focus-visible:outline-ring",
            ended ? "text-title leading-8" : "text-display-detail",
          )}
        >
          {animalTitle(animal)}
        </h1>
        <p className="mt-1 text-body text-text-2">
          {sexAgeText(animal)}
        </p>
        {rows.length > 0 && (
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-body">
            {rows.map(({ label, value, link: action }) => (
              // 줄 끝 동작은 보호소 줄 하나라 이웃한 누르는 영역이 겹치지 않는다. 줄 간격은 다른 줄과 같다(#7의 "주소·전화 줄만 간격이 넓음"을 없앰)
              <div key={label} data-slot="detail-row" className="contents">
                <dt className="text-text-2">{label}</dt>
                {action ? (
                  // 값은 그냥 글자(선택·복사 가능)이고, 길면 줄바꿈한다. 버튼은 첫 줄 끝에 둔다(items-start)
                  <dd className="flex items-start gap-2">
                    <span data-slot="detail-value" className={cn("min-w-0 flex-1", DETAIL_VALUE_WRAP)}>
                      {value}
                    </span>
                    {action}
                  </dd>
                ) : (
                  <dd data-slot="detail-value" className={DETAIL_VALUE_WRAP}>
                    {value}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* data-slot="bottom-cta"는 app/globals.css의 [data-slot="app-column"]:has([data-slot="bottom-cta"])가 읽는다(토스트를 CTA 위로) */}
      <BottomCtaBar {...infoEnter} data-slot="bottom-cta">
        {/* 하트 튐·누름은 CSS(motion-safe:, no-preference)가 움직임 줄이기를 거르므로 false */}
        <FavoriteButton animalId={animal.id} still={!allowsMotion(animal, false)} />
        <ShareButton animal={animal} origin={origin} />
        <ShareSheetButton animal={animal} origin={origin} />
      </BottomCtaBar>

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

/**
 * 카드에서 들어온 진입 정보(마운트 때 한 번 읽는다). 상세를 떠나면(이 공고의 상세가 하나도 남지 않으면) 지운다. 로딩 화면 →
 * 서버 페이지 교체는 같은 커밋에서 하나가 빠지고 하나가 들어오므로 지우지 않는다.
 */
const mountedDetails = new Map<string, number>();
function useDetailEntry(id: string): DetailEntry | null {
  const [entry] = useState(() => getDetailEntry(id));
  useEffect(() => {
    mountedDetails.set(id, (mountedDetails.get(id) ?? 0) + 1);
    return () => {
      mountedDetails.set(id, (mountedDetails.get(id) ?? 1) - 1);
      setTimeout(() => {
        if ((mountedDetails.get(id) ?? 0) === 0) clearDetailEntry(id);
      }, 0);
    };
  }, [id]);
  return entry;
}

/** 두 크기의 가로세로 비가 1% 안이면 같다고 본다(카드 사진은 프록시가 줄인 같은 사진이라 반올림 차이만 있다) */
function sameRatio(a: PhotoSize, b: PhotoSize): boolean {
  return Math.abs(a.width / a.height / (b.width / b.height) - 1) < 0.01;
}
