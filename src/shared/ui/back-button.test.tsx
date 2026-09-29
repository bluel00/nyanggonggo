// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

/** 모듈 변수(목록을 거쳤는지)를 테스트마다 초기화한다 */
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

  it("공유 링크로 바로 열었으면 히스토리가 쌓여 있어도 목록으로 간다(앱 밖으로 나가지 않는다)", async () => {
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
