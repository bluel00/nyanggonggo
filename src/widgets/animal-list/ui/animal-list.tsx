"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  AnimalCard,
  chooseDetailEntryMode,
  ANIMAL_COPY,
  detailDisplayText,
  getStatusVariant,
  listFilterKey,
  seedAnimalDetail,
  SPECIES_COPY,
  startDetailEntry,
  useAnimalsInfinite,
  type Animal,
  type AnimalListFilter,
  type CardSelection,
} from "@/entities/animal";
import { FavoriteButton } from "@/features/animal-favorite";
import { SHARE_BUTTON_LABEL } from "@/features/animal-share";
import { warmFonts, warmFontsAfterImages } from "@/shared/lib/font-warm";
import { markListVisited } from "@/shared/lib/app-navigation";
import { appScrollViewport, scrollAppToTop } from "@/shared/ui/app-column";
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
  const queryClient = useQueryClient();
  /**
   * 카드를 누를 때(architecture.md 14.2 4단계): 사진이 로드된 카드면 그 공고를 상세 캐시에 넣고 진입 정보를 남긴다. 그러면 상세의 로딩 화면이 뼈대 대신 실제 상세를 그려 사진이 이어진다. 사진이 아직 없으면
   * 실제 비율을 몰라 지금처럼 뼈대로 간다.
   */
  /**
   * 상세 화면의 글꼴 조각을 미리 받는다. 카드 → 상세 전환은 새 화면의 글꼴을 다 받을 때까지 커밋을 기다리므로(측정 약 +270ms),
   * 상세의 고정 글자는 목록 첫 화면 사진을 다 받은 뒤 유휴 시간에(아래 effect), 그 공고의 글자는 누르기 시작할 때(pointerdown)와 누를 때 받는다
   */
  const warmDetail = (animal: Animal) => warmFonts(`${detailDisplayText(animal)} ${SHARE_BUTTON_LABEL}`);
  const select = (animal: Animal, selection: CardSelection) => {
    warmDetail(animal);
    if (!selection) return;
    seedAnimalDetail(queryClient, animal);
    startDetailEntry({ id: animal.id, ...selection, mode: chooseDetailEntryMode(getStatusVariant(animal, now) === "ended") });
  };
  const [now] = useState(() => new Date());
  const copy = SPECIES_COPY[filter.species];

  // 목록을 거쳤다는 표시. 상세의 뒤로가기가 목록으로 돌아갈지 판단한다(shared/lib/app-navigation)
  useEffect(() => markListVisited(), []);
  useScrollTopOnFilterChange(filter);
  // 상세는 이 목록 위에 얹히고(PRD-v1.5) 목록은 내려가지 않으므로, 돌아왔을 때 따로 되돌릴 것이 없다
  const listKey = listFilterKey(filter);
  const feedRef = useFirstScreenEntrance(listKey, query.isPending);
  useEffect(() => {
    if (!query.isSuccess) return;
    const firstScreen = [...(feedRef.current?.querySelectorAll<HTMLImageElement>('[data-slot="animal-card"] img') ?? [])].slice(0, EAGER_CARDS);
    return warmFontsAfterImages(
      firstScreen,
      `${Object.values(ANIMAL_COPY.detailRowLabels).join(" ")} ${ANIMAL_COPY.ageUnknown} ${SHARE_BUTTON_LABEL}`,
    );
  }, [query.isSuccess, feedRef]);
  const sentinelRef = useLoadMore({
    enabled: query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError,
    pages: query.data?.pages.length ?? 0,
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
          onSelect={(selection) => select(animal, selection)}
          onPress={() => warmDetail(animal)}
          transition
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
 * 효과가 없는 경우: 스크롤로 새로 보이는 카드·다음 페이지(붙이지 않음), 상세에서 돌아온 목록(상세가 위에 얹혔다 걷힐 뿐 목록은 그대로다),
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

/**
 * sentinel이 화면 아래 PREFETCH_MARGIN 안에 들어오면 다음 페이지를 부른다. 네이티브 IntersectionObserver만 쓴다.
 * 감시는 페이지를 받을 때마다(pages) 새로 건다. IntersectionObserver는 상태가 바뀔 때만 알려 주므로, 한 감시를 계속 쓰면
 * 다음 페이지를 붙인 뒤에도 sentinel이 범위 안에 남거나 감시가 '범위 밖'을 보기 전에 다시 끝까지 내린 경우 아무 알림이 없어 멈춘다
 * (응답이 빨라 isFetchingNextPage가 한 번도 그려지지 않으면 enabled도 바뀌지 않는다. WebKit E2E에서 3페이지에서 멈춤).
 * 새 감시는 처음에 지금 상태를 한 번 알려 준다.
 */
function useLoadMore({ enabled, pages, onLoadMore }: { enabled: boolean; pages: number; onLoadMore: () => void }) {
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
  }, [enabled, pages]);

  return ref;
}

/** 필터가 바뀌면 내부 스크롤 컨테이너를 맨 위로(첫 렌더는 제외) */
function useScrollTopOnFilterChange(filter: AnimalListFilter) {
  const key = listFilterKey(filter);
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    scrollAppToTop();
  }, [key]);
}
