// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

/** 모듈을 새로 불러온다(새로고침 흉내). "목록을 거쳤다" 표시는 sessionStorage라 afterEach에서 비운다 */
async function load() {
  vi.resetModules();
  const { markListVisited } = await import("@/shared/lib/app-navigation");
  const { AnimalDetailSkeleton } = await import("./animal-detail-skeleton");
  return { markListVisited, AnimalDetailSkeleton };
}

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, "length", { configurable: true, value: length });
}

afterEach(() => {
  cleanup();
  back.mockReset();
  push.mockReset();
  sessionStorage.clear();
});

describe("AnimalDetailSkeleton 뒤로가기(공고를 아직 모른다)", () => {
  it("앱 안에서 들어왔으면 브라우저 뒤로가기(원래 화면으로)", async () => {
    const { markListVisited, AnimalDetailSkeleton } = await load();
    markListVisited();
    setHistoryLength(3);
    render(<AnimalDetailSkeleton />);

    fireEvent.click(screen.getByRole("link", { name: "뒤로가기" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("바로 들어왔으면 실제 상세와 같이 `/`로 간다(PRD-v1.4 R2)", async () => {
    const { AnimalDetailSkeleton } = await load();
    setHistoryLength(5); // 카카오톡 인앱 브라우저 등은 히스토리가 쌓여 있다
    render(<AnimalDetailSkeleton />);

    fireEvent.click(screen.getByRole("link", { name: "뒤로가기" }));
    expect(push).toHaveBeenCalledWith("/");
    expect(back).not.toHaveBeenCalled();
  });

  it("서버 렌더(바로 들어온 첫 화면)에도 버튼이 있다(갈 곳이 공고와 상관없다)", async () => {
    const { AnimalDetailSkeleton } = await load();
    const html = renderToString(<AnimalDetailSkeleton />);
    expect(html).toContain('aria-label="뒤로가기"');
    // 하이드레이션 전(바로 들어와 상세가 아직 오지 않음)에도 눌리도록 `/` 링크다
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*aria-label="뒤로가기"/);
    expect(html).not.toContain("back-placeholder");
  });
});

describe("AnimalDetailSkeleton 로딩 시머(handoff (j) L1·L3)", () => {
  it("모든 블록·줄(사진, 상태, 제목, 성별·나이, 정보 줄 셋, CTA 둘)에 시머가 있고 로딩 캐릭터는 없다", async () => {
    const { AnimalDetailSkeleton } = await load();
    const { container } = render(<AnimalDetailSkeleton />);
    expect(container.querySelectorAll("[data-shimmer]")).toHaveLength(9);
    expect(container.querySelector("[data-slot=\"detail-skeleton-photo\"]")!.hasAttribute("data-shimmer")).toBe(true);
    expect(container.querySelector("[data-slot=\"loading-character\"]")).toBeNull();
    // 색 면이 있는 블록은 모두 시머다
    for (const block of container.querySelectorAll(".bg-status-ended-bg")) expect(block.hasAttribute("data-shimmer")).toBe(true);
  });
});
