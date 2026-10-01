"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimalCard, SPECIES_COPY, useAnimalsInfinite, type AnimalListFilter } from "@/entities/animal";
import { FavoriteButton } from "@/features/animal-favorite";
import { FOCUS_KEY } from "@/features/animal-filter";
import { markListVisited } from "@/shared/lib/app-navigation";
import {
  rememberSelectedAnimal,
  scrollAppToAnimalWhenReady,
  scrollAppToTop,
  useAnimalScrollRestoration,
} from "@/shared/ui/app-column";
import { Button } from "@/shared/ui/button";
import { SkeletonCard } from "@/shared/ui/skeleton-card";

/** 다음 페이지를 미리 부를 거리(sentinel이 화면 아래 이만큼 앞에 오면) */
const PREFETCH_MARGIN = "600px 0px";
const INITIAL_SKELETONS = 3;
/**
 * focus로 들어온 공고를 찾으려고 더 받을 수 있는 최대 페이지 수. 한 페이지가 20건이라 100건까지 본다.
 * 한 시군구의 공고가 대개 이보다 적고, 더 받을수록 서버 요청과 렌더가 늘어 기다림이 길어진다(architecture.md 12절 40).
 */
const MAX_FOCUS_PAGES = 5;
/** 첫 화면에 보이는 카드는 eager 로딩 */
const EAGER_CARDS = 2;

/**
 * 무한 스크롤 목록(명세 4.1.4). 필터는 URL에서 파싱한 값을 prop으로 받는다. page는 URL에 없고 useInfiniteQuery의 커서다.
 * - 로딩: SkeletonCard 3개(handoff 화면 6), 다음 페이지 로딩도 스켈레톤을 이어 붙인다
 * - 끝: 아무것도 표시하지 않는다(명세 옵션 A, "끝났다"는 느낌을 주지 않음)
 * - 빈 결과 / 오류 문구는 handoff 화면 6. 다음 페이지 오류의 표시 방식은 디자인 미정이라 최소로 둔다
 */
export function AnimalList({ filter, focusId = null }: { filter: AnimalListFilter; focusId?: string | null }) {
  const query = useAnimalsInfinite(filter);
  const [now] = useState(() => new Date());
  const copy = SPECIES_COPY[filter.species];

  // 목록을 거쳤다는 표시. 상세의 뒤로가기가 목록으로 돌아갈지 판단한다(shared/lib/app-navigation)
  useEffect(() => markListVisited(), []);
  useScrollTopOnFilterChange(filter);
  const clearFocus = useClearFocus();
  // 공유 링크로 들어온 상세에서 왔으면 그 공고로 스크롤한다. focus가 있으면 이쪽이 우선이다
  useFocusAnimal({
    focusId,
    ready: query.isSuccess,
    found: query.data?.pages.some((page) => page.items.some((item) => item.id === focusId)) ?? false,
    // 페이지가 늘어난 것을 알아야 다음 페이지를 이어 받을지 다시 판단한다
    pageCount: query.data?.pages.length ?? 0,
    canFetchMore: query.hasNextPage && !query.isFetchNextPageError,
    isFetchingMore: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    onSettled: clearFocus,
  });
  // 상세에서 뒤로 오면 캐시된 페이지(같은 쿼리 키)와 함께 열었던 카드로 되돌아간다
  const listKey = filterKey(filter);
  useAnimalScrollRestoration(listKey, query.isSuccess && focusId === null);
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
      <StateMessage title={copy.errorTitle}>
        <Button variant="primary" size="touch" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      </StateMessage>
    );
  }

  const animals = query.data.pages.flatMap((page) => page.items);
  if (animals.length === 0) {
    return <StateMessage title={copy.emptyTitle} description="필터를 바꿔서 다시 찾아보세요" />;
  }

  return (
    <FeedList>
      {animals.map((animal, index) => (
        <AnimalCard
          key={animal.id}
          animal={animal}
          now={now}
          priority={index < EAGER_CARDS}
          href={`/animals/${animal.id}`}
          onSelect={() => rememberSelectedAnimal(listKey, animal.id)}
          action={<FavoriteButton animalId={animal.id} variant="overlay" />}
        />
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

/** 처리한 focus를 URL에서 지운다. 새로고침이나 뒤로가기로 다시 발동하지 않게 한다 */
function useClearFocus() {
  const router = useRouter();
  return useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(FOCUS_KEY)) return;
    params.delete(FOCUS_KEY);
    const query = params.toString();
    router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname, { scroll: false });
  }, [router]);
}

/**
 * focus로 지정된 공고를 찾아 그 카드로 스크롤한다.
 * 받아 둔 페이지에 없으면 최대 MAX_FOCUS_PAGES까지 이어 받고, 그래도 없으면 조용히 맨 위에 둔다.
 * 찾는 동안 사용자가 직접 스크롤하면 중단한다(보고 있는 화면이 갑자기 튀지 않게).
 */
function useFocusAnimal({
  focusId,
  ready,
  found,
  pageCount,
  canFetchMore,
  isFetchingMore,
  fetchNextPage,
  onSettled,
}: {
  focusId: string | null;
  ready: boolean;
  found: boolean;
  pageCount: number;
  canFetchMore: boolean;
  isFetchingMore: boolean;
  fetchNextPage: () => void;
  onSettled: () => void;
}) {
  const settled = useRef(false);
  const fetchedPages = useRef(0);
  const cancelled = useRef(false);
  const settle = useRef(onSettled);
  useEffect(() => {
    settle.current = onSettled;
  });

  useEffect(() => {
    if (!focusId) return;
    const cancel = () => {
      cancelled.current = true;
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [focusId]);

  useEffect(() => {
    if (!focusId || !ready || settled.current) return;
    const finish = () => {
      settled.current = true;
      settle.current();
    };
    if (cancelled.current) {
      finish();
      return;
    }
    if (found) return scrollAppToAnimalWhenReady(focusId, finish);
    if (isFetchingMore) return; // 받는 중이면 기다린다
    if (canFetchMore && fetchedPages.current < MAX_FOCUS_PAGES) {
      fetchedPages.current += 1;
      fetchNextPage();
      return;
    }
    finish(); // 더 받을 수 없거나 상한에 닿았다. 못 찾으면 맨 위 그대로
  }, [focusId, ready, found, pageCount, canFetchMore, isFetchingMore, fetchNextPage]);
}

/** 필터가 바뀌면 내부 스크롤 컨테이너를 맨 위로(첫 렌더는 제외) */
function filterKey(filter: AnimalListFilter): string {
  return `${filter.species}|${filter.region ?? ""}|${filter.district ?? ""}|${filter.status}|${filter.sort}`;
}

function useScrollTopOnFilterChange(filter: AnimalListFilter) {
  const key = filterKey(filter);
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    scrollAppToTop();
  }, [key]);
}
