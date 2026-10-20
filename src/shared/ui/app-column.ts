"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { APP_COLUMN_SELECTOR, APP_SCROLL_SELECTOR } from "./app-shell";

const subscribe = () => () => {};

/** 포털 대상(480px 컬럼). 서버 렌더와 컬럼이 없는 환경(테스트 등)에서는 null이며, 이때 포털은 body로 간다. */
export function useAppColumn(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => document.querySelector<HTMLElement>(APP_COLUMN_SELECTOR),
    () => null,
  );
}

function appScrollContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(APP_SCROLL_SELECTOR);
}

/** 내부 스크롤 컨테이너가 화면에서 차지하는 영역(보이는 범위). 컨테이너가 없으면 null */
export function appScrollViewport(): DOMRect | null {
  return appScrollContainer()?.getBoundingClientRect() ?? null;
}

/** 내부 스크롤 컨테이너를 맨 위로 */
export function scrollAppToTop(): void {
  const container = appScrollContainer();
  if (!container) return;
  // jsdom 등 scrollTo가 없는 환경도 있다
  if (typeof container.scrollTo === "function") container.scrollTo({ top: 0 });
  else container.scrollTop = 0;
}

/** 카드 요소에 붙는 공고 id 속성. 이 속성으로 카드를 찾아 스크롤한다 */
export const ANIMAL_ID_ATTRIBUTE = "data-animal-id";

const SELECTED_KEY_PREFIX = "nyanggonggo:selected:";
/** 카드가 나타날 때까지 기다리는 최대 프레임(캐시된 페이지가 그려질 시간) */
const FIND_FRAMES = 30;

/** 목록을 떠날 때 기억하는 것: 연 카드와 그때의 스크롤 위치(px). 위치를 못 읽었으면 null */
type SelectedAnimal = { animalId: string; scrollTop: number | null };

/**
 * 목록에서 연 카드와 지금 스크롤 위치를 기억한다. 뒤로 왔을 때 그 자리로 돌아가기 위한 것이라 목록(필터)별로 따로 둔다.
 * 카드를 누르는 순간(목록이 아직 그려져 있을 때) 부른다.
 */
export function rememberSelectedAnimal(listKey: string, animalId: string): void {
  const selected: SelectedAnimal = { animalId, scrollTop: appScrollContainer()?.scrollTop ?? null };
  try {
    sessionStorage.setItem(SELECTED_KEY_PREFIX + listKey, JSON.stringify(selected));
  } catch {
    // 저장 실패는 무시(복원만 안 된다)
  }
}

function takeSelectedAnimal(listKey: string): SelectedAnimal | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_KEY_PREFIX + listKey);
    sessionStorage.removeItem(SELECTED_KEY_PREFIX + listKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SelectedAnimal> | null;
    if (typeof parsed?.animalId !== "string") return null;
    return { animalId: parsed.animalId, scrollTop: typeof parsed.scrollTop === "number" ? parsed.scrollTop : null };
  } catch {
    return null;
  }
}

function findAnimalCard(container: HTMLElement, animalId: string): HTMLElement | undefined {
  // 선택자에 id를 넣지 않고(이스케이프 규칙에 기대지 않는다) 속성값을 직접 비교한다
  const cards = container.querySelectorAll<HTMLElement>(`[${ANIMAL_ID_ATTRIBUTE}]`);
  return [...cards].find((element) => element.getAttribute(ANIMAL_ID_ATTRIBUTE) === animalId);
}

/**
 * 떠날 때의 scrollTop으로 되돌리고, 그 자리에서 카드가 (일부라도) 보이면 true.
 * 안 보이면(레이아웃이 달라짐) false이고, 부르는 쪽이 카드 가운데 맞춤으로 넘어간다.
 */
function restoreScrollTop(scrollTop: number, animalId: string): boolean {
  const container = appScrollContainer();
  const card = container && findAnimalCard(container, animalId);
  if (!container || !card) return false;
  container.scrollTop = scrollTop;
  const containerBox = container.getBoundingClientRect();
  const cardBox = card.getBoundingClientRect();
  return cardBox.bottom > containerBox.top && cardBox.top < containerBox.bottom;
}

/**
 * id로 카드를 찾아 스크롤 컨테이너의 가운데쯤 오게 한다. 카드가 아직 없으면 false.
 * 상세에서 뒤로 왔을 때의 복원(아래)이 쓴다.
 */
export function scrollAppToAnimal(animalId: string): boolean {
  const container = appScrollContainer();
  const card = container && findAnimalCard(container, animalId);
  if (!container || !card) return false;

  const containerBox = container.getBoundingClientRect();
  const cardBox = card.getBoundingClientRect();
  const centered = cardBox.top - containerBox.top - (containerBox.height - cardBox.height) / 2;
  container.scrollTop += centered; // 브라우저가 0 ~ 최대 스크롤로 잘라 준다
  return true;
}

/**
 * 화면(스크롤 영역) 안에 걸친 카드의 사진을 바로 디코드하게 한다(decoding="sync"). 뒤로가기 복원에서만, 그리기 전에 부른다.
 *
 * 아이폰 사파리에서 목록으로 돌아오면 첫 프레임에 카드 사진만 회색 빈칸이었다가 다음 프레임에 나타났다(실기기 화면 기록,
 * architecture.md 12절 56). 사파리는 큰 사진을 비동기로 디코드하고, 화면에서 안 보이던 사진의 디코드 결과를 버린다(추정).
 * 처음 들어올 때와 스크롤로 새로 보이는 카드는 그대로 async다. React는 decoding을 "async"로 기억하지만 같은 값으로 다시
 * 그릴 때는 속성을 건드리지 않으므로, 이 요소들은 목록을 떠날 때까지 sync로 남는다.
 */
function decodeVisibleCardPhotosSync(): void {
  const container = appScrollContainer();
  if (!container) return;
  const containerBox = container.getBoundingClientRect();
  for (const card of container.querySelectorAll<HTMLElement>(`[${ANIMAL_ID_ATTRIBUTE}]`)) {
    const cardBox = card.getBoundingClientRect();
    if (cardBox.bottom <= containerBox.top || cardBox.top >= containerBox.bottom) continue;
    for (const img of card.querySelectorAll("img")) img.setAttribute("decoding", "sync");
  }
}

/**
 * 카드가 그려질 때까지 기다렸다가(최대 FIND_FRAMES 프레임) 그 카드로 스크롤한다.
 * 찾았거나(found true) 포기하면 onSettled를 부른다. 돌려주는 함수를 부르면 기다리기를 멈춘다.
 */
export function scrollAppToAnimalWhenReady(animalId: string, onSettled?: (found: boolean) => void): () => void {
  let frames = 0;
  let frame = 0;
  const find = () => {
    const found = scrollAppToAnimal(animalId);
    if (found || frames >= FIND_FRAMES) {
      onSettled?.(found);
      return;
    }
    frames += 1;
    frame = requestAnimationFrame(find);
  };
  find();
  return () => {
    if (frame) cancelAnimationFrame(frame);
  };
}

/**
 * 목록 → 상세 → 뒤로 왔을 때, 떠날 때의 화면으로 되돌린다(architecture.md 7절, 12절 37).
 *
 * - 목록이 캐시로 첫 렌더부터 그려지면(보통의 뒤로가기) 떠날 때의 scrollTop을 **그리기 전에**(layout effect) 되돌린다.
 *   iOS 사파리의 쓸어넘기기 뒤로가기는 떠날 때 화면의 스냅숏을 보여 주다가 실제 화면으로 바꾸므로, 첫 프레임이 그 스냅숏과
 *   같아야 깜빡이지 않는다. 위치는 카드를 누를 때 읽어 둔다(목록이 지워지면 컨테이너 scrollTop이 0으로 눌린다).
 * - 되돌린 자리에서 열었던 카드가 보이지 않거나(레이아웃이 달라짐), 캐시가 지워져 데이터를 다시 받은 경우(첫 렌더가 뼈대)는
 *   **카드 id**로 찾아 가운데에 맞춘다. 다시 받은 데이터는 순서·높이가 같다는 보장이 없다.
 * - 데이터에서 빠진 공고(상태가 바뀐 경우 등)는 조용히 포기하고 맨 위에 둔다.
 */
export function useAnimalScrollRestoration(listKey: string, ready: boolean): void {
  /** 아직 찾는 중인 카드. 저장소에서는 바로 지우고 여기에 들고 있는다(effect가 다시 붙어도 이어서 찾는다) */
  const pending = useRef<{ listKey: string; animalId: string } | null>(null);
  const finishedKey = useRef<string | null>(null);
  /** 첫 렌더에 이미 데이터가 있었다(캐시). 이때만 픽셀 위치를 쓴다 */
  const readyOnMount = useRef(ready);

  useLayoutEffect(() => {
    if (!ready || finishedKey.current === listKey) return;
    if (pending.current?.listKey !== listKey) {
      const selected = takeSelectedAnimal(listKey);
      if (!selected) {
        finishedKey.current = listKey;
        return;
      }
      if (readyOnMount.current && selected.scrollTop !== null && restoreScrollTop(selected.scrollTop, selected.animalId)) {
        decodeVisibleCardPhotosSync();
        finishedKey.current = listKey;
        return;
      }
      pending.current = { listKey, animalId: selected.animalId };
    }

    return scrollAppToAnimalWhenReady(pending.current.animalId, (found) => {
      // 캐시로 그려진 목록(이미 받은 사진)일 때만. 캐시가 지워져 다시 받는 사진은 처음 들어올 때와 같다(async)
      if (found && readyOnMount.current) decodeVisibleCardPhotosSync();
      pending.current = null;
      finishedKey.current = listKey;
    });
  }, [ready, listKey]);
}
