"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimalCard, ANIMAL_COPY, animalsByIdsOptions, getStatusVariant, useRetryFailedAnimals } from "@/entities/animal";
import { FavoriteButton, useFavoriteIds } from "@/features/animal-favorite";
import { markListVisited } from "@/shared/lib/app-navigation";
import { scrollAppToTop } from "@/shared/ui/app-column";
import { BackButton, useGoBack } from "@/shared/ui/back-button";
import { Button } from "@/shared/ui/button";
import { ScreenHeader } from "@/shared/ui/screen-shell";
import { SkeletonCard } from "@/shared/ui/skeleton-card";

const subscribeNothing = () => () => {};

/**
 * 찜 목록(명세 4.5). 저장된 id로 서버에서 다시 조회한다(사본 저장 안 함). 목록과 같은 카드, 카드 탭 → 상세.
 * - 순서: 최근에 찜한 것이 앞(by-ids는 요청 순서를 유지)
 * - 조회되지 않는 id는 화면에서 빼고 저장은 유지한다(architecture.md 8절)
 * - 일부만 오류로 받지 못하면 받은 카드는 두고 목록 위 한 줄과 [다시 시도](실패한 것만 다시 받음)를 보인다.
 *   전부 실패하면 오류 화면. 어느 쪽이든 저장은 그대로다(이슈 #5)
 * - 여기서 찜을 해제하면 카드가 바로 빠진다. 새 id 목록으로 다시 조회하는 동안 이전 결과를 유지해 깜빡이지 않는다
 * - 서버 렌더에서는 찜 목록을 모르므로 클라이언트에서 저장값을 읽기 전까지 스켈레톤(빈 상태가 잠깐 보이지 않게)
 * 헤더는 FavoriteListHeader, 둘을 화면 틀에 놓는 것은 views/favorites다.
 */
export function FavoriteList() {
  const ids = useFavoriteIds();
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const query = useQuery({ ...animalsByIdsOptions(ids), placeholderData: keepPreviousData });
  const retry = useRetryFailedAnimals();
  const [now] = useState(() => new Date());

  useEffect(() => {
    markListVisited(); // 상세의 뒤로가기가 이 화면으로 돌아올 수 있게(shared/lib/app-navigation)
    scrollAppToTop();
  }, []);

  let body;
  if (!isClient || (ids.length > 0 && query.isPending)) {
    body = (
      <FeedList>
        {Array.from({ length: Math.min(Math.max(ids.length, 1), 3) }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </FeedList>
    );
  } else if (ids.length > 0 && query.isError && !query.data) {
    body = (
      <div role="status" className="flex flex-col items-center gap-4 px-page py-20 text-center">
        <p className="text-card-title">{ANIMAL_COPY.favoritesErrorTitle}</p>
        <Button variant="primary" size="touch" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  } else {
    const animals = (ids.length > 0 ? (query.data?.items ?? []) : []).filter((animal) => ids.includes(animal.id));
    // 이전 ids의 결과를 잠시 보여 주는 동안(placeholder)은 그 실패를 다시 받을 캐시가 없어 줄을 숨긴다
    const failedIds =
      ids.length > 0 && !query.isPlaceholderData ? (query.data?.failedIds ?? []).filter((id) => ids.includes(id)) : [];
    const partialError = failedIds.length > 0 && animals.length > 0 && (
      // 디자인 미정: 목록 위 한 줄 문구와 텍스트 버튼
      <div role="status" className="flex items-center justify-between gap-2 px-page">
        <p className="text-body text-text-2">{ANIMAL_COPY.favoritesPartialError}</p>
        <Button
          variant="ghost"
          size="touch"
          className="-mr-3 px-3"
          disabled={retry.isPending}
          onClick={() => retry.mutate({ ids, failedIds })}
        >
          다시 시도
        </Button>
      </div>
    );
    body =
      animals.length === 0 ? (
        // 명세 4.5.2 문구를 축종 중립으로 바꿔 쓴다(여러 축종이 섞인다, entities/animal/ui/labels.ts)
        <div role="status" className="flex flex-col items-center gap-2 px-page py-20 text-center">
          <p className="text-card-title">{ANIMAL_COPY.favoritesEmptyTitle}</p>
          <p className="text-body text-text-2">{ANIMAL_COPY.favoritesEmptyDescription}</p>
        </div>
      ) : (
        <>
          {partialError}
          <FeedList>
            {animals.map((animal) => (
              <AnimalCard
                key={animal.id}
                animal={animal}
                now={now}
                href={`/animals/${animal.id}`}
                action={
                  <FavoriteButton animalId={animal.id} variant="overlay" ended={getStatusVariant(animal, now) === "ended"} />
                }
              />
            ))}
          </FeedList>
        </>
      );
  }

  return body;
}

/** 찜 목록 헤더: 뒤로가기 + 제목. 헤더 줄 틀(ScreenHeader, sticky)에 채운다. 뒤로가기는 터치 영역 안쪽 여백만큼 왼쪽으로 당긴다 */
export function FavoriteListHeader() {
  const goBack = useGoBack();
  return (
    <ScreenHeader
      sticky
      start={
        <div className="flex items-center gap-1">
          <BackButton onClick={goBack} className="-ml-2 bg-bg" />
          <h1 className="text-title">{ANIMAL_COPY.favoritesTitle}</h1>
        </div>
      }
    />
  );
}

function FeedList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-feed-gap px-page pb-page">{children}</div>;
}
