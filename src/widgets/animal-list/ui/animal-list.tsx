"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { AnimalCard, getStatusVariant, SPECIES_COPY, useAnimalsInfinite, type AnimalListFilter } from "@/entities/animal";
import { FavoriteButton } from "@/features/animal-favorite";
import { markListVisited } from "@/shared/lib/app-navigation";
import {
  appScrollViewport,
  rememberSelectedAnimal,
  scrollAppToTop,
  useAnimalScrollRestoration,
} from "@/shared/ui/app-column";
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
  const copy = SPECIES_COPY[filter.species];

  // 목록을 거쳤다는 표시. 상세의 뒤로가기가 목록으로 돌아갈지 판단한다(shared/lib/app-navigation)
  useEffect(() => markListVisited(), []);
  useScrollTopOnFilterChange(filter);
  // 상세에서 뒤로 오면 캐시된 페이지(같은 쿼리 키)와 함께 열었던 카드로 되돌아간다
  const listKey = filterKey(filter);
  useAnimalScrollRestoration(listKey, query.isSuccess);
  const feedRef = useFirstScreenEntrance(listKey, query.isPending);
  const sentinelRef = useLoadMore({
    enabled: query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError,
    onLoadMore: () => void query.fetchNextPage(),
  });

  if (query.isPending) {
    return (
      <FeedList ref={feedRef}>
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
    <FeedList ref={feedRef}>
      {animals.map((animal, index) => (
        <AnimalCard
          key={animal.id}
          animal={animal}
          now={now}
          priority={index < EAGER_CARDS}
          // 첫 카드 사진만 다른 요청보다 먼저 받는다(fetchpriority high는 화면당 한 장)
          highPriority={index === 0}
          href={`/animals/${animal.id}`}
          onSelect={() => rememberSelectedAnimal(listKey, animal.id)}
          action={
            <FavoriteButton animalId={animal.id} variant="overlay" ended={getStatusVariant(animal, now) === "ended"} />
          }
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

function FeedList({ children, ref }: { children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="flex flex-col gap-feed-gap px-page pb-page">
      {children}
    </div>
  );
}

/**
 * 목록 첫 화면 등장(README 움직임 표): 뼈대 다음에 첫 페이지가 그려지는 순간, 첫 화면에 들어가는 카드에만 한 번 data-enter="list"와
 * 순서를 붙인다(globals.css). 종료 카드는 뺀다. 칠하기 전(layout effect)에 붙여 카드가 한 번 보였다 사라지는 깜빡임이 없다.
 *
 * 몇 장이 첫 화면인지는 **뼈대가 칠해진 뒤**(effect) 뼈대 위치로 정해 두고, 카드를 그릴 때는 레이아웃을 읽지 않는다.
 * 카드를 그리는 커밋 안에서 위치를 읽으면 레이아웃이 강제로 앞당겨져 지연 로딩 사진까지 첫 사진과 함께 받기 시작해
 * 첫 사진(LCP)이 약 0.3초 늦었다(2026-10-19 실측). 뼈대(SkeletonCard)는 카드보다 글자 칸이 10px 낮아 경계에서 화면 바로 아래의
 * 카드가 하나 더 들어갈 수는 있어도(보이지 않는 곳에서 돈다) 보이는 카드를 빠뜨리지는 않는다.
 *
 * 효과가 없는 경우: 스크롤로 새로 보이는 카드·다음 페이지(붙이지 않음), 상세에서 돌아온 목록(캐시가 있어 뼈대를 거치지 않는다),
 * 움직임 줄이기(CSS가 no-preference에서만 돈다). 다 돈 카드에서는 속성을 지운다.
 */
function useFirstScreenEntrance(listKey: string, pending: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  /** 뼈대를 보인 목록과 그 화면에 들어가는 카드 수. 이 목록의 첫 페이지가 그려질 때 한 번 등장한다 */
  const awaiting = useRef<{ listKey: string; count: number } | null>(null);

  useEffect(() => {
    if (!pending) return;
    const skeletons = ref.current?.querySelectorAll<HTMLElement>('[data-slot="skeleton-card"]') ?? [];
    const viewport = appScrollViewport();
    if (skeletons.length < 2 || !viewport) return;
    const top = skeletons[0].getBoundingClientRect().top;
    const step = skeletons[1].getBoundingClientRect().top - top;
    if (step <= 0) return;
    awaiting.current = { listKey, count: Math.max(0, Math.ceil((viewport.bottom - top) / step)) };
  }, [listKey, pending]);

  useLayoutEffect(() => {
    if (pending || awaiting.current?.listKey !== listKey) return;
    const { count } = awaiting.current;
    awaiting.current = null;
    const cards = ref.current?.querySelectorAll<HTMLElement>('[data-slot="animal-card"]') ?? [];
    let order = 0;
    for (const card of [...cards].slice(0, count)) {
      if (card.dataset.status === "ended") continue;
      card.dataset.enter = "list";
      card.style.setProperty("--enter-i", String(order++));
      const done = (event: AnimationEvent) => {
        if (event.target !== card) return;
        card.removeEventListener("animationend", done);
        delete card.dataset.enter;
        card.style.removeProperty("--enter-i");
      };
      card.addEventListener("animationend", done);
    }
  }, [listKey, pending]);

  return ref;
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
