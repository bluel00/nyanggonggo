// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearListEnterWhenDone, LIST_ENTER_ATTR, LIST_ENTER_SCRIPT, markListEnterFrom } from "./list-enter";

/** 뼈대 목록: 카드 top이 100, 100 + step, ... 이고 스크롤 영역 아래가 bottom이다 */
function setup({ skeletons, step, bottom }: { skeletons: number; step: number; bottom: number }) {
  document.body.innerHTML = `<div data-slot="app-scroll"><div id="feed">${'<div data-slot="skeleton-card"></div>'.repeat(skeletons)}</div></div>`;
  const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
  scroll.getBoundingClientRect = () => ({ bottom }) as DOMRect;
  document.querySelectorAll<HTMLElement>('[data-slot="skeleton-card"]').forEach((el, i) => {
    el.getBoundingClientRect = () => ({ top: 100 + i * step }) as DOMRect;
  });
  return document.getElementById("feed")!;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(LIST_ENTER_ATTR);
  document.body.innerHTML = "";
});

describe("첫 화면 등장 표시(#109)", () => {
  it("뼈대가 칠해진 뒤 남아 있으면 뼈대 간격으로 잰 첫 화면 카드 수를 <html>에 단다", () => {
    markListEnterFrom(setup({ skeletons: 3, step: 500, bottom: 844 }));
    expect(document.documentElement.getAttribute(LIST_ENTER_ATTR)).toBe("2");
  });

  it("그 사이 카드로 바뀌어 뼈대가 없으면 달지 않는다(뼈대를 본 적이 없다)", () => {
    const feed = setup({ skeletons: 3, step: 500, bottom: 844 });
    feed.remove();
    markListEnterFrom(feed);
    expect(document.documentElement.hasAttribute(LIST_ENTER_ATTR)).toBe(false);
  });

  it("상한은 6장이다(CSS 규칙 수)", () => {
    markListEnterFrom(setup({ skeletons: 3, step: 50, bottom: 2000 }));
    expect(document.documentElement.getAttribute(LIST_ENTER_ATTR)).toBe("6");
  });

  it("인라인 스크립트는 바깥 이름 없이 같은 계산을 한다(뼈대 목록 맨 끝에서 돈다)", () => {
    const feed = setup({ skeletons: 3, step: 500, bottom: 844 });
    const script = document.createElement("script");
    feed.append(script);
    Object.defineProperty(document, "currentScript", { configurable: true, get: () => script });
    new Function(LIST_ENTER_SCRIPT)();
    expect(document.documentElement.getAttribute(LIST_ENTER_ATTR)).toBe("2");
    Reflect.deleteProperty(document, "currentScript");
  });

  it("등장이 다 돌면 표시를 지운다", async () => {
    const feed = setup({ skeletons: 0, step: 0, bottom: 0 });
    document.documentElement.setAttribute(LIST_ENTER_ATTR, "2");
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    // 끝나지 않는 로딩 시머(사진이 아직 로드되지 않은 칸, #111)는 기다리지 않는다
    const never = new Promise<void>(() => {});
    feed.getAnimations = () =>
      [
        { animationName: "enter-rise", playState: "running", finished },
        { animationName: "shimmer", playState: "running", finished: never },
      ] as unknown as Animation[];
    clearListEnterWhenDone(feed);
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(LIST_ENTER_ATTR)).toBe(true);
    finish();
    await finished;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.documentElement.hasAttribute(LIST_ENTER_ATTR)).toBe(false);
  });
});
