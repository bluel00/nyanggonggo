"use client";

import { BackButton, useGoBack } from "@/shared/ui/back-button";
import { routes } from "@/shared/config/routes";
import { PHOTO_BOX_RATIO } from "../model/photo-box";
import { BottomCtaBar, DetailPhotoArea } from "./detail-frame";

/**
 * 상세 뼈대(명세 7.1, 스켈레톤은 SkeletonCard와 같은 status-ended-bg 면, 움직임 없음).
 *
 * 두 곳이 같은 뼈대를 쓴다: 라우트 로딩 경계(`app/animals/[id]/loading.tsx`, 카드를 누른 즉시)와
 * 상세 위젯의 조회 대기(`useAnimal`이 pending). 그래서 뼈대 → 실제 상세로 바뀔 때 레이아웃이 튀지 않게
 * 실제 상세(`AnimalDetail`)와 같은 구조·치수로 둔다:
 * - 사진 칸(좌우 24px 안쪽, radius-card, 그림자 없음) + 캐러셀 점 줄 자리(pt-3 + 6px). 실제 공고는 모두 사진 2장 이상이라 점 줄이 늘 있다(12.A P7).
 *   칸은 기본 1:1(라우트 로딩 경계는 공고를 몰라 크기를 모를 때의 칸과 같게), 위젯 조회 대기에서는 이미 아는 칸 비율(PRD v1.3)
 * - 사진 위 Back 버튼: 실제 상세와 같다(`useGoBack(routes.entry())`, 진입 경로). 앱 안에서 들어왔으면(목록을 거쳐 옴) 뒤로, 아니면(공유 링크·북마크) `/`.
 *   갈 곳이 공고와 상관없어 공고를 몰라도 늘 버튼을 보인다(PRD-v1.4 R2, PRD-v1.3 6절 결정 대체). 서버 렌더에도 있다.
 *   진입 경로(`href={routes.entry()}`, 값은 `/`) 링크로 그린다: 바로 들어온 첫 화면의 뼈대는 하이드레이션되지 않아(BackButton 주석) 링크로 `/`에 간다.
 *   그 경우는 목록을 거치지 않은 것이라 `/`가 맞다. 예외: 목록에서 온 탭이 상세에서 새로고침해 뼈대가 뜬 동안 누르면 원래 목록이
 *   아니라 `/`로 간다(뼈대가 떠 있는 동안만)
 * - 상태 줄(D-day가 title 크기라 28px) · 제목(32px: 보호중·종료 임박의 display-detail, 종료 공고도 줄 높이 32px) · 성별/나이(body 20px) · 정보 줄
 * - 하단 CTA 바(sticky, 찜 44px 원 + 공유 버튼)
 */
export function AnimalDetailSkeleton({ photoRatio = PHOTO_BOX_RATIO.unknown }: { photoRatio?: number }) {
  const goBack = useGoBack(routes.entry());

  return (
    <div data-slot="detail-skeleton" aria-busy="true" className="flex min-h-full flex-col">
      <DetailPhotoArea back={<BackButton onClick={goBack} href={routes.entry()} />}>
        <div aria-hidden data-slot="detail-skeleton-photo" className="rounded-card bg-status-ended-bg" style={{ aspectRatio: photoRatio }} />
        <div aria-hidden className="pt-3">
          <div className="h-1.5" />
        </div>
      </DetailPhotoArea>

      <div aria-hidden className="flex-1 px-page pt-4 pb-6">
        <div className="flex h-7 items-center">
          <div className="h-6 w-24 rounded-pill bg-status-ended-bg" />
        </div>
        <div data-slot="detail-title" className="mt-3 h-8 w-2/3 rounded-[7px] bg-status-ended-bg" />
        <div className="mt-1 h-5 w-1/3 rounded-[6px] bg-status-ended-bg" />
        <div className="mt-6 flex flex-col gap-3">
          {["w-3/4", "w-2/3", "w-1/2"].map((width) => (
            <div key={width} className={`h-5 rounded-[6px] bg-status-ended-bg ${width}`} />
          ))}
        </div>
      </div>

      <BottomCtaBar aria-hidden>
        <div className="size-touch flex-none rounded-pill bg-status-ended-bg" />
        <div className="min-h-touch flex-1 rounded-pill bg-status-ended-bg" />
      </BottomCtaBar>
    </div>
  );
}
