// @vitest-environment jsdom
/**
 * 홈 첫인상 장면을 정하는 인라인 스크립트(HOME_SCENE_SCRIPT, handoff (k)). 문자열로 들어가 브라우저에서 그대로 돌므로
 * 바깥 이름 없이 돌아가는지를 실제 문자열을 실행해 본다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_SCENE_ATTR, HOME_SCENE_SCRIPT, HOME_SCENE_SEEN_KEY, HOME_SCENE_WAIT_MS } from "./home-scene";

const run = () => new Function(HOME_SCENE_SCRIPT)();
const scene = () => document.documentElement.getAttribute(HOME_SCENE_ATTR);

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: reduce && query.includes("prefers-reduced-motion"), media: query })));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  document.documentElement.removeAttribute(HOME_SCENE_ATTR);
  sessionStorage.clear();
  setReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HOME_SCENE_SCRIPT", () => {
  it("세션의 첫 진입이면 pending으로 기다리고 기록을 남긴다. 0.3초 안에 시작하지 않으면 off(대체)", () => {
    run();
    expect(scene()).toBe("pending");
    expect(sessionStorage.getItem(HOME_SCENE_SEEN_KEY)).toBe("1");
    vi.advanceTimersByTime(HOME_SCENE_WAIT_MS - 1);
    expect(scene()).toBe("pending");
    vi.advanceTimersByTime(1);
    expect(scene()).toBe("off");
  });

  it("이미 시작했으면(play) 대체 타이머가 바꾸지 않는다", () => {
    run();
    document.documentElement.setAttribute(HOME_SCENE_ATTR, "play");
    vi.advanceTimersByTime(HOME_SCENE_WAIT_MS);
    expect(scene()).toBe("play");
  });

  it("같은 세션의 두 번째 진입·새로고침은 아무것도 달지 않는다", () => {
    sessionStorage.setItem(HOME_SCENE_SEEN_KEY, "1");
    run();
    expect(scene()).toBeNull();
  });

  it("움직임 줄이기면 장면 없이 기록만 남긴다", () => {
    setReducedMotion(true);
    run();
    expect(scene()).toBeNull();
    expect(sessionStorage.getItem(HOME_SCENE_SEEN_KEY)).toBe("1");
  });

  it("이미 정했으면(속성이 있으면) 다시 정하지 않는다(하이드레이션 뒤 effect가 같은 함수를 불러도 그대로)", () => {
    run();
    document.documentElement.setAttribute(HOME_SCENE_ATTR, "off");
    run();
    expect(scene()).toBe("off");
  });

  it("저장소를 쓸 수 없으면 장면을 돌지 않는다(오류도 밖으로 나가지 않는다)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(run).not.toThrow();
    expect(scene()).toBeNull();
  });
});
