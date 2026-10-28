"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Suspense, use, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  allowsMotion,
  animalKeys,
  ANIMAL_CARD_SELECTOR,
  ANIMAL_CARD_STILL_SELECTOR,
  AnimalCard,
  chooseDetailEntryMode,
  ANIMAL_COPY,
  DETAIL_ROW_LABELS,
  detailDisplayText,
  listFilterKey,
  seedAnimalDetail,
  seedAnimalsFirstPage,
  SPECIES_COPY,
  startDetailEntry,
  useAnimalsInfinite,
  type Animal,
  type AnimalListFilter,
  type AnimalListFirstPage,
  type CardSelection,
} from "@/entities/animal";
import { FavoriteButton } from "@/features/animal-favorite";
import { SHARE_BUTTON_LABEL } from "@/features/animal-share";
import { warmFonts, warmFontsAfterImages } from "@/shared/lib/font-warm";
import { markListVisited } from "@/shared/lib/app-navigation";
import { appScrollViewport, scrollAppToTop } from "@/shared/ui/app-column";
import { Button } from "@/shared/ui/button";
import { SKELETON_CARD_SELECTOR, SkeletonCard } from "@/shared/ui/skeleton-card";
import { routes } from "@/shared/config/routes";
import { clearListEnterWhenDone, LIST_ENTER_SCRIPT, LIST_FIRST_ATTR, markListEnterFrom } from "../model/list-enter";

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
export function AnimalList({ filter, firstPage }: { filter: AnimalListFilter; firstPage?: Promise<AnimalListFirstPage> }) {
  if (!firstPage) return <AnimalFeed filter={filter} />;
  return (
    // 목록(필터)마다 새 경계: 필터를 바꾸면 이 목록의 첫 페이지를 기다리는 동안 뼈대가 보인다
    <Suspense key={listFilterKey(filter)} fallback={<FirstPageSkeleton />}>
      <ServerFirstPage filter={filter} firstPage={firstPage} />
    </Suspense>
  );
}

/**
 * 서버가 읽은 첫 페이지(이슈 #109, app/list-data.ts)를 목록 캐시에 넣고 목록을 그린다. 첫 페이지를 위해 /api/animals를 부르지 않는다.
 * - 같은 목록을 이미 받아 둔 적이 있으면(30분 안) 서버 응답을 기다리지 않고 받아 둔 것을 그린다(지금처럼 다시 받지 않는다)
 * - 서버가 읽지 못했으면 넣지 않는다: 목록이 지금처럼 클라이언트에서 조회하고, 그것도 실패하면 목록 오류 화면(다시 시도)이다
 */
function ServerFirstPage({ filter, firstPage }: { filter: AnimalListFilter; firstPage: Promise<AnimalListFirstPage> }) {
  const queryClient = useQueryClient();
  // 이 promise로 캐시를 채운 뒤의 렌더(StrictMode 이중 렌더, 다시 그리기)도 같은 판단을 하도록, 채운 promise를 기억한다.
  // 캐시만 보면 두 번째 렌더가 "이미 받아 둔 목록"으로 보여 서버 HTML과 달라진다(하이드레이션 불일치)
  const seededHere = seededFirstPages.has(firstPage);
  const cached = !seededHere && queryClient.getQueryData(animalKeys.list(filter)) !== undefined;
  const result = cached ? null : use(firstPage);
  if (result?.ok && !seededHere) {
    seedAnimalsFirstPage(queryClient, filter, result.response);
    seededFirstPages.add(firstPage);
  }
  return <AnimalFeed filter={filter} serverFirstPage={result?.ok === true} />;
}

/** 목록 캐시를 채운 서버 첫 페이지 promise(ServerFirstPage) */
const seededFirstPages = new WeakSet<Promise<AnimalListFirstPage>>();

/**
 * 서버 첫 페이지를 기다리는 동안의 뼈대(첫 로드와 같은 3장). 뼈대가 실제로 칠해지면 첫 화면 등장 표시를 단다(model/list-enter.ts):
 * 문서로 처음 열 때는 맨 끝의 인라인 스크립트가, 앱 안에서 이동해 클라이언트가 그릴 때는 effect가 단다.
 */
function FirstPageSkeleton() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => markListEnterFrom(ref.current), []);
  return (
    <FeedList ref={ref}>
      {Array.from({ length: INITIAL_SKELETONS }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
      <script dangerouslySetInnerHTML={{ __html: LIST_ENTER_SCRIPT }} />
    </FeedList>
  );
}

function AnimalFeed({ filter, serverFirstPage = false }: { filter: AnimalListFilter; serverFirstPage?: boolean }) {
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
    startDetailEntry({ id: animal.id, ...selection, mode: chooseDetailEntryMode(animal) });
  };
  const [now] = useState(() => new Date());
  const copy = SPECIES_COPY[filter.species];

  // 목록을 거쳤다는 표시. 상세의 뒤로가기가 목록으로 돌아갈지 판단한다(shared/lib/app-navigation)
  useEffect(() => markListVisited(), []);
  useScrollTopOnFilterChange(filter);
  // 상세는 이 목록 위에 얹히고(PRD-v1.5) 목록은 내려가지 않으므로, 돌아왔을 때 따로 되돌릴 것이 없다
  const listKey = listFilterKey(filter);
  const feedRef = useFirstScreenEntrance(listKey, query.isPending);
  // 서버 첫 페이지의 등장(CSS, 뼈대가 보였을 때만)이 다 돌면 표시를 지운다
  useEffect(() => (serverFirstPage ? clearListEnterWhenDone(feedRef.current) : undefined), [serverFirstPage, feedRef]);
  useEffect(() => {
    if (!query.isSuccess) return;
    const firstScreen = [...(feedRef.current?.querySelectorAll<HTMLImageElement>(`${ANIMAL_CARD_SELECTOR} img`) ?? [])].slice(0, EAGER_CARDS);
    return warmFontsAfterImages(
      firstScreen,
      `${Object.values(DETAIL_ROW_LABELS).join(" ")} ${ANIMAL_COPY.ageUnknown} ${SHARE_BUTTON_LABEL}`,
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
    <FeedList ref={feedRef} first={serverFirstPage}>
      {animals.map((animal, index) => (
        <AnimalCard
          key={animal.id}
          animal={animal}
          now={now}
          priority={index < EAGER_CARDS}
          // 첫 카드 사진만 다른 요청보다 먼저 받는다(fetchpriority high는 화면당 한 장)
          highPriority={index === 0}
          href={routes.detail(animal.id)}
          onSelect={(selection) => select(animal, selection)}
          onPress={() => warmDetail(animal)}
          transition
          // 하트 튐·누름은 CSS(motion-safe:, no-preference)가 움직임 줄이기를 거르므로 false
          action={<FavoriteButton animalId={animal.id} variant="overlay" still={!allowsMotion(animal, false)} />}
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

/** first: 서버가 그린 첫 페이지(첫 화면 등장 CSS가 읽는다, app/globals.css) */
function FeedList({ children, ref, first = false }: { children: ReactNode; ref?: Ref<HTMLDivElement>; first?: boolean }) {
  return (
    <div ref={ref} {...(first ? { [LIST_FIRST_ATTR]: "" } : {})} className="flex flex-col gap-feed-gap px-page pb-page">
      {children}
    </div>
  );
}

/**
 * 목록 첫 화면 등장(README 움직임 표): 뼈대 다음에 첫 페이지가 그려지는 순간, 첫 화면에 들어가는 카드에만 한 번 data-enter="list"와
 * 순서를 붙인다(globals.css). 움직이지 않는 카드(ANIMAL_CARD_STILL_SELECTOR, 종료 카드)는 뺀다. 칠하기 전(layout effect)에 붙여 카드가 한 번 보였다 사라지는 깜빡임이 없다.
 *
 * 몇 장이 첫 화면인지는 **뼈대가 칠해진 뒤**(effect) 뼈대 위치로 정해 두고, 카드를 그릴 때는 레이아웃을 읽지 않는다.
 * 카드를 그리는 커밋 안에서 위치를 읽으면 레이아웃이 강제로 앞당겨져 지연 로딩 사진까지 첫 사진과 함께 받기 시작해
 * 첫 사진(LCP)이 약 0.3초 늦었다(2026-10-19 실측). 뼈대(SkeletonCard)는 공고 번호가 있는 카드와 높이가 같다(#84).
 * 공고 번호가 없는 카드는 16px + 2px 낮아 보이는 카드를 하나 빠뜨릴 수 있지만, 운영에서 그런 카드는 없었다(2026-10-27, 0개).
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
    const skeletons = ref.current?.querySelectorAll<HTMLElement>(SKELETON_CARD_SELECTOR) ?? [];
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
    const cards = ref.current?.querySelectorAll<HTMLElement>(ANIMAL_CARD_SELECTOR) ?? [];
    let order = 0;
    for (const card of [...cards].slice(0, count)) {
      if (card.matches(ANIMAL_CARD_STILL_SELECTOR)) continue;
      // app/globals.css의 [data-enter="list"]가 읽는다
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
