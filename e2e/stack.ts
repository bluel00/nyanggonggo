import type { Page } from "@playwright/test";

/**
 * 상세 층(PRD-v1.5) E2E 도우미. 상세는 지금 화면(목록·찜) 위에 얹히고(`[data-slot="stack-layer"]`), 아래 화면은 내부 스크롤
 * 컨테이너(`[data-slot="app-scroll"]`)에 그대로 남는다.
 */
export const LAYER = '[data-slot="stack-layer"]';
export const LAYER_SCROLL = '[data-slot="stack-layer-scroll"]';
export const BELOW_SCROLL = '[data-slot="app-scroll"]';

/** 아래 화면 스크롤 컨테이너의 scrollTop */
export const belowScrollTop = (page: Page) =>
  page.evaluate((selector) => document.querySelector<HTMLElement>(selector)!.scrollTop, BELOW_SCROLL);

/** 지금 아래 화면의 카드 요소들을 기억한다. 뒤에 sameCards로 같은 요소인지(다시 만들어지지 않았는지) 본다 */
export const rememberCards = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __cards: Element[] }).__cards = [...document.querySelectorAll("[data-animal-id]")];
  });
export const sameCards = (page: Page) =>
  page.evaluate(() => {
    const before = (window as unknown as { __cards: Element[] }).__cards;
    const now = [...document.querySelectorAll("[data-animal-id]")];
    return before.length > 0 && before.length === now.length && before.every((el, i) => el === now[i] && el.isConnected);
  });

/**
 * 한 프레임(rAF, 그리기 직전)의 상태. layer: 층이 있다, scrollTop: 아래 화면 위치,
 * usable: 아래 화면이 스크롤·터치된다(inert 아님, 스크롤 가능, 화면 가운데를 누르면 아래 화면이 맞는다)
 */
export type StackFrame = { layer: boolean; scrollTop: number; usable: boolean };

/** 지금부터 매 프레임 상태를 남긴다. 층이 걷힌 뒤 30프레임까지(최대 600프레임) */
export async function recordStackFrames(page: Page) {
  await page.evaluate((selector) => {
    const w = window as unknown as { __stackFrames: StackFrame[] };
    w.__stackFrames = [];
    const tick = () => {
      const below = document.querySelector<HTMLElement>(selector)!;
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      w.__stackFrames.push({
        layer: document.querySelector('[data-slot="stack-layer"]') !== null,
        scrollTop: below.scrollTop,
        usable: !below.inert && getComputedStyle(below).overflowY === "auto" && below.contains(hit),
      });
      const gone = w.__stackFrames.filter((frame) => !frame.layer).length;
      if (gone < 30 && w.__stackFrames.length < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, BELOW_SCROLL);
}
export const stackFrames = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stackFrames: StackFrame[] }).__stackFrames);
/** 층이 걷힌 뒤 30프레임이 쌓였는지 */
export const stackFramesDone = async (page: Page) => (await stackFrames(page)).filter((frame) => !frame.layer).length >= 30;
