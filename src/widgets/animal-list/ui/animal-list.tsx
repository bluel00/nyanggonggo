"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimalCard, SPECIES_LABEL, useAnimalsInfinite, type AnimalListFilter } from "@/entities/animal";
import { scrollAppToTop } from "@/shared/ui/app-column";
import { Button } from "@/shared/ui/button";
import { SkeletonCard } from "@/shared/ui/skeleton-card";

/** 다음 페이지를 미리 부를 거리(sentinel이 화면 아래 이만큼 앞에 오면) */
const PREFETCH_MARGIN = "600px 0px";
const INITIAL_SKELETONS = 3;
/** 첫 화면에 보이는 카드는 eager 로딩 */
const EAGER_CARDS = 2;

/**
 * 무한 스크롤 목록(명세 4.1.4). 필터는 URL에서 파싱한 값을 prop으로 받는다. page는 URL에 없고 useInfiniteQuery의 커서다.
 * - 로딩: SkeletonCard 3개(handoff 화면 6), 다음 페이지 로딩도 스켈레톤을 이어 붙인다
 * - 끝: 아무것도 표시하지 않는다(명세 옵션 A, "끝났다"는 느낌을 주지 않음)
 * - 빈 결과 / 오류 문구는 handoff 화면 6. 다음 페이지 오류의 표시 방식은 디자인 미정이라 최소로 둔다
 */
export function AnimalList({ filter }: { filter: AnimalListFilter }) {
  const query = useAnimalsInfinite(filter);
  const [now] = useState(() => new Date());
  const species = SPECIES_LABEL[filter.species];

  useScrollTopOnFilterChange(filter);
  const sentinelRef = useLoadMore({
    enabled: query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError,
    onLoadMore: () => void query.fetchNextPage(),
  });

  if (query.isPending) {
    return (
      <FeedList>
        {Array.from({ length: INITIAL_SKELETONS }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </FeedList>
    );
  }

  if (query.isError && !query.data) {
    return (
      <StateMessage title={`지금은 ${species}를 불러오지 못했어요`}>
        <Button variant="primary" size="touch" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      </StateMessage>
    );
  }

  const animals = query.data.pages.flatMap((page) => page.items);
  if (animals.length === 0) {
    return <StateMessage title={`조건에 맞는 ${species}가 없어요`} description="필터를 바꿔서 다시 찾아보세요" />;
  }

  return (
    <FeedList>
      {animals.map((animal, index) => (
        <AnimalCard key={animal.id} animal={animal} now={now} priority={index < EAGER_CARDS} />
      ))}
      {query.isFetchingNextPage && <SkeletonCard />}
      {query.isFetchNextPageError && (
        // 디자인 미정: 다음 페이지 실패. 이미 받은 카드는 두고 재시도 버튼만 둔다
        <div className="flex justify-center py-4">
          <Button variant="primary" size="touch" onClick={() => void query.fetchNextPage()}>
            다시 시도
          </Button>
        </div>
      )}
      <div ref={sentinelRef} data-slot="load-more-sentinel" aria-hidden className="h-px" />
    </FeedList>
  );
}

function FeedList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-feed-gap px-page pb-page">{children}</div>;
}

/** 빈 상태와 오류: 헤더는 유지하고 메시지와 버튼만 가운데(handoff 화면 6) */
function StateMessage({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 px-page py-20 text-center">
      <p className="text-card-title">{title}</p>
      {description && <p className="text-body text-text-2">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** sentinel이 보이면 onLoadMore. 네이티브 IntersectionObserver만 쓴다 */
function useLoadMore({ enabled, onLoadMore }: { enabled: boolean; onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onLoadMore);
  useEffect(() => {
    callback.current = onLoadMore;
  });

  useEffect(() => {
    const target = ref.current;
    if (!enabled || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

/** 필터가 바뀌면 내부 스크롤 컨테이너를 맨 위로(첫 렌더는 제외) */
function useScrollTopOnFilterChange(filter: AnimalListFilter) {
  const key = `${filter.species}|${filter.region ?? ""}|${filter.status}|${filter.sort}`;
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    scrollAppToTop();
  }, [key]);
}
