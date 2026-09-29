"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
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

/** 목록에서 연 카드를 기억한다. 뒤로 왔을 때 그 카드로 돌아가기 위한 것이라 목록(필터)별로 따로 둔다. */
export function rememberSelectedAnimal(listKey: string, animalId: string): void {
  try {
    sessionStorage.setItem(SELECTED_KEY_PREFIX + listKey, animalId);
  } catch {
    // 저장 실패는 무시(복원만 안 된다)
  }
}

function takeSelectedAnimal(listKey: string): string | null {
  try {
    const id = sessionStorage.getItem(SELECTED_KEY_PREFIX + listKey);
    sessionStorage.removeItem(SELECTED_KEY_PREFIX + listKey);
    return id;
  } catch {
    return null;
  }
}

/**
 * id로 카드를 찾아 스크롤 컨테이너의 가운데쯤 오게 한다. 카드가 아직 없으면 false.
 * 뒤로가기 복원과 (앞으로 추가할) 공유 링크의 focus 파라미터가 같이 쓴다.
 */
export function scrollAppToAnimal(animalId: string): boolean {
  const container = appScrollContainer();
  // 선택자에 id를 넣지 않고(이스케이프 규칙에 기대지 않는다) 속성값을 직접 비교한다
  const cards = container?.querySelectorAll<HTMLElement>(`[${ANIMAL_ID_ATTRIBUTE}]`) ?? [];
  const card = [...cards].find((element) => element.getAttribute(ANIMAL_ID_ATTRIBUTE) === animalId);
  if (!container || !card) return false;

  const containerBox = container.getBoundingClientRect();
  const cardBox = card.getBoundingClientRect();
  const centered = cardBox.top - containerBox.top - (containerBox.height - cardBox.height) / 2;
  container.scrollTop += centered; // 브라우저가 0 ~ 최대 스크롤로 잘라 준다
  return true;
}

/**
 * 목록 → 상세 → 뒤로 왔을 때, 열었던 카드가 보이도록 되돌린다(architecture.md 7절).
 *
 * 픽셀(scrollTop) 대신 **카드 id**를 기억한다. 내부 스크롤 컨테이너는 화면이 바뀌는 순간 내용이 비어
 * 스크롤 값이 0으로 눌리고, 복원 시점에는 아직 높이가 모자라 픽셀 값이 자주 틀어졌다(12절 37).
 * 카드가 그려질 때까지 몇 프레임 기다렸다가 찾고, 찾으면(또는 시간이 지나면) 기억한 값을 지운다.
 * 데이터에서 빠진 공고(상태가 바뀐 경우 등)는 조용히 포기하고 맨 위에 둔다.
 */
export function useAnimalScrollRestoration(listKey: string, ready: boolean): void {
  /** 아직 찾는 중인 카드. 저장소에서는 바로 지우고 여기에 들고 있는다(effect가 다시 붙어도 이어서 찾는다) */
  const pending = useRef<{ listKey: string; animalId: string } | null>(null);
  const finishedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || finishedKey.current === listKey) return;
    if (pending.current?.listKey !== listKey) {
      const animalId = takeSelectedAnimal(listKey);
      if (!animalId) {
        finishedKey.current = listKey;
        return;
      }
      pending.current = { listKey, animalId };
    }

    const { animalId } = pending.current;
    let frames = 0;
    let id = 0;
    const finish = () => {
      pending.current = null;
      finishedKey.current = listKey;
    };
    const find = () => {
      if (scrollAppToAnimal(animalId) || frames >= FIND_FRAMES) {
        finish(); // 찾았거나, 데이터에서 빠진 공고라 포기한다(맨 위에 그대로 둔다)
        return;
      }
      frames += 1;
      id = requestAnimationFrame(find);
    };
    find();
    return () => {
      if (id) cancelAnimationFrame(id);
    };
  }, [ready, listKey]);
}
