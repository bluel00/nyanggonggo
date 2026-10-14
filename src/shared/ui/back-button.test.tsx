// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

/** 모듈을 새로 불러온다(새로고침 흉내). "목록을 거쳤다" 표시는 sessionStorage라 afterEach에서 비운다 */
async function load() {
  vi.resetModules();
  const { markListVisited } = await import("../lib/app-navigation");
  const { BackButton, useGoBack } = await import("./back-button");
  function Screen() {
    const goBack = useGoBack();
    return <BackButton onClick={goBack} />;
  }
  return { markListVisited, Screen };
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

describe("useGoBack", () => {
  it("목록을 거쳐 왔으면 뒤로 간다(필터와 스크롤 위치가 살아난다)", async () => {
    const { markListVisited, Screen } = await load();
    markListVisited();
    setHistoryLength(3);
    render(<Screen />);

    fireEvent.click(screen.getByLabelText("뒤로가기"));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("목록을 거쳐 온 뒤 새로고침해도(같은 탭) 표시가 남아 뒤로 간다(PRD-v1.4 R1)", async () => {
    const before = await load();
    before.markListVisited();
    const { Screen } = await load(); // 새로고침: 모듈은 새로 불러오고 sessionStorage는 남는다
    setHistoryLength(3);
    render(<Screen />);

    fireEvent.click(screen.getByLabelText("뒤로가기"));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("공유 링크로 바로 열었으면 히스토리가 쌓여 있어도 `/`로 간다(앱 밖으로 나가지 않는다, PRD-v1.4 R2)", async () => {
    const { Screen } = await load();
    setHistoryLength(5); // 카카오톡 인앱 브라우저 등
    render(<Screen />);

    fireEvent.click(screen.getByLabelText("뒤로가기"));
    expect(push).toHaveBeenCalledWith("/");
    expect(back).not.toHaveBeenCalled();
  });

  it("히스토리가 없으면 목록으로 간다", async () => {
    const { markListVisited, Screen } = await load();
    markListVisited();
    setHistoryLength(1);
    render(<Screen />);

    fireEvent.click(screen.getByLabelText("뒤로가기"));
    expect(push).toHaveBeenCalledWith("/");
    expect(back).not.toHaveBeenCalled();
  });
});
