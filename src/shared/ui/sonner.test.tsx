// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toaster } from "./sonner";
import { showToast } from "./toast";

afterEach(cleanup);

describe("Toaster / showToast", () => {
  it("문구를 띄우고, 토스트 목록은 fixed가 아니라 absolute(컬럼 기준)", async () => {
    const { container } = render(<Toaster />);
    act(() => showToast("링크가 복사됐어요"));
    expect(await screen.findByText("링크가 복사됐어요")).toBeTruthy();
    const list = container.querySelector<HTMLElement>("[data-sonner-toaster]")!;
    expect(list.style.position).toBe("absolute");
  });

  it("같은 문구는 쌓지 않는다", async () => {
    render(<Toaster />);
    act(() => {
      showToast("찜에 저장했어요");
      showToast("찜에 저장했어요");
    });
    await screen.findByText("찜에 저장했어요");
    expect(screen.getAllByText("찜에 저장했어요")).toHaveLength(1);
  });
});
