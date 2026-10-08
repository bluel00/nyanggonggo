// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

/** 모듈 변수(목록을 거쳤는지)를 테스트마다 초기화한다 */
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
});

describe("AnimalDetailSkeleton 뒤로가기(공고를 아직 모른다)", () => {
  it("앱 안에서 들어왔으면 브라우저 뒤로가기(원래 화면으로)", async () => {
    const { markListVisited, AnimalDetailSkeleton } = await load();
    markListVisited();
    setHistoryLength(3);
    render(<AnimalDetailSkeleton />);

    fireEvent.click(screen.getByRole("button", { name: "뒤로가기" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("바로 들어왔으면 버튼 없이 같은 크기(44×44) 자리만 비워 둔다(기본 목록으로 보내지 않는다)", async () => {
    const { AnimalDetailSkeleton } = await load();
    setHistoryLength(5); // 카카오톡 인앱 브라우저 등은 히스토리가 쌓여 있다
    const { container } = render(<AnimalDetailSkeleton />);

    expect(screen.queryByRole("button", { name: "뒤로가기" })).toBeNull();
    expect(container.querySelector('[data-slot="back-placeholder"]')?.className).toContain("size-touch");
  });

  it("서버 렌더(바로 들어온 첫 화면)에는 버튼이 없다", async () => {
    const { markListVisited, AnimalDetailSkeleton } = await load();
    markListVisited();
    setHistoryLength(3);
    const html = renderToString(<AnimalDetailSkeleton />);
    expect(html).not.toContain("뒤로가기");
    expect(html).toContain('data-slot="back-placeholder"');
  });
});
