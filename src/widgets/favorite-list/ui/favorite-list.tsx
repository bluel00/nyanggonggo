"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimalCard, animalsByIdsOptions } from "@/entities/animal";
import { FavoriteButton, useFavoriteIds } from "@/features/animal-favorite";
import { scrollAppToTop } from "@/shared/ui/app-column";
import { BackButton, useGoBack } from "@/shared/ui/back-button";
import { Button } from "@/shared/ui/button";
import { SkeletonCard } from "@/shared/ui/skeleton-card";

const subscribeNothing = () => () => {};

/**
 * 찜 목록(명세 4.5). 저장된 id로 서버에서 다시 조회한다(사본 저장 안 함). 목록과 같은 카드, 카드 탭 → 상세.
 * - 순서: 최근에 찜한 것이 앞(by-ids는 요청 순서를 유지)
 * - 조회되지 않는 id는 화면에서 빼고 저장은 유지한다(architecture.md 8절)
 * - 여기서 찜을 해제하면 카드가 바로 빠진다. 새 id 목록으로 다시 조회하는 동안 이전 결과를 유지해 깜빡이지 않는다
 * - 서버 렌더에서는 찜 목록을 모르므로 클라이언트에서 저장값을 읽기 전까지 스켈레톤(빈 상태가 잠깐 보이지 않게)
 */
export function FavoriteList() {
  const ids = useFavoriteIds();
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const query = useQuery({ ...animalsByIdsOptions(ids), placeholderData: keepPreviousData });
  const [now] = useState(() => new Date());
  const goBack = useGoBack();

  useEffect(() => scrollAppToTop(), []);

  const header = (
    <header className="sticky top-0 z-10 flex items-center gap-1 bg-bg px-2 pt-[calc(var(--space-3)+env(safe-area-inset-top,0px))] pb-3">
      <BackButton onClick={goBack} className="bg-bg" />
      <h1 className="text-title">찜한 고양이</h1>
    </header>
  );

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
        <p className="text-card-title">지금은 고양이를 불러오지 못했어요</p>
        <Button variant="primary" size="touch" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  } else {
    const animals = (ids.length > 0 ? (query.data ?? []) : []).filter((animal) => ids.includes(animal.id));
    body =
      animals.length === 0 ? (
        // 명세 4.5.2 문구. 🐾는 README가 허용한 유일한 이모지(찜 빈 상태)
        <div role="status" className="flex flex-col items-center gap-2 px-page py-20 text-center">
          <p className="text-card-title">아직 찜한 고양이가 없어요</p>
          <p className="text-body text-text-2">마음에 드는 고양이를 저장해보세요 🐾</p>
        </div>
      ) : (
        <FeedList>
          {animals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              now={now}
              href={`/animals/${animal.id}`}
              action={<FavoriteButton animalId={animal.id} variant="overlay" />}
            />
          ))}
        </FeedList>
      );
  }

  return (
    <main>
      {header}
      {body}
    </main>
  );
}

function FeedList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-feed-gap px-page pb-page">{children}</div>;
}
