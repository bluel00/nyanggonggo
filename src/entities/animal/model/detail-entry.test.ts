// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseDetailEntryMode } from "./detail-entry";

/** 카드 → 상세 진입 효과 선택을 고정한다(이슈 #29): 종료·움직임 줄이기면 없음, 전환을 지원하면 morph, 아니면 fade */
function setEnvironment({ reducedMotion, viewTransitions }: { reducedMotion: boolean; viewTransitions: boolean }) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reducedMotion && query === "(prefers-reduced-motion: reduce)" }));
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: viewTransitions ? () => {} : undefined,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("chooseDetailEntryMode", () => {
  it("보호 중: 전환을 지원하면 morph, 아니면 fade", () => {
    setEnvironment({ reducedMotion: false, viewTransitions: true });
    expect(chooseDetailEntryMode({ status: "protected" })).toBe("morph");
    setEnvironment({ reducedMotion: false, viewTransitions: false });
    expect(chooseDetailEntryMode({ status: "protected" })).toBe("fade");
  });

  it("종료 공고는 효과 없음", () => {
    setEnvironment({ reducedMotion: false, viewTransitions: true });
    expect(chooseDetailEntryMode({ status: "ended" })).toBe("none");
  });

  it("움직임 줄이기면 효과 없음", () => {
    setEnvironment({ reducedMotion: true, viewTransitions: true });
    expect(chooseDetailEntryMode({ status: "protected" })).toBe("none");
  });
});
