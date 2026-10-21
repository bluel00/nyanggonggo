"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimalCard, ANIMAL_COPY, animalsByIdsOptions, getStatusVariant } from "@/entities/animal";
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
 * - 여기서 찜을 해제하면 카드가 바로 빠진다. 새 id 목록으로 다시 조회하는 동안 이전 결과를 유지해 깜빡이지 않는다
 * - 서버 렌더에서는 찜 목록을 모르므로 클라이언트에서 저장값을 읽기 전까지 스켈레톤(빈 상태가 잠깐 보이지 않게)
 * 헤더는 FavoriteListHeader, 둘을 화면 틀에 놓는 것은 views/favorites다.
 */
export function FavoriteList() {
  const ids = useFavoriteIds();
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const query = useQuery({ ...animalsByIdsOptions(ids), placeholderData: keepPreviousData });
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
    const animals = (ids.length > 0 ? (query.data ?? []) : []).filter((animal) => ids.includes(animal.id));
    body =
      animals.length === 0 ? (
        // 명세 4.5.2 문구를 축종 중립으로 바꿔 쓴다(여러 축종이 섞인다, entities/animal/ui/labels.ts)
        <div role="status" className="flex flex-col items-center gap-2 px-page py-20 text-center">
          <p className="text-card-title">{ANIMAL_COPY.favoritesEmptyTitle}</p>
          <p className="text-body text-text-2">{ANIMAL_COPY.favoritesEmptyDescription}</p>
        </div>
      ) : (
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
