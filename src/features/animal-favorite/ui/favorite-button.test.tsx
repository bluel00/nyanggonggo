// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "./favorite-button";

const showToast = vi.fn();
vi.mock("@/shared/ui/toast", () => ({ showToast: (message: string) => showToast(message) }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  showToast.mockClear();
});

describe("FavoriteButton", () => {
  it("토글하면 aria-pressed와 라벨이 바뀌고 토스트를 띄운다", () => {
    render(<FavoriteButton animalId="1" />);
    const button = screen.getByRole("button", { name: "찜하기" });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "찜 해제" }).getAttribute("aria-pressed")).toBe("true");
    expect(showToast).toHaveBeenLastCalledWith("찜에 저장했어요");

    fireEvent.click(screen.getByRole("button", { name: "찜 해제" }));
    expect(showToast).toHaveBeenLastCalledWith("찜을 해제했어요");
  });

  it("같은 id의 버튼 두 개(카드와 상세)는 상태를 함께 쓴다", () => {
    render(
      <>
        <FavoriteButton animalId="1" variant="overlay" />
        <FavoriteButton animalId="1" />
        <FavoriteButton animalId="2" />
      </>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "찜하기" })[0]);
    expect(screen.getAllByRole("button", { name: "찜 해제" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "찜하기" })).toHaveLength(1);
  });

  it("클릭 이벤트가 부모(카드 링크, 사진)로 번지지 않는다", () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <FavoriteButton animalId="1" />
      </div>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
