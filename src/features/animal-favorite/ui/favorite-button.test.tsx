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
    const button = screen.getByRole("button", { name: "관심 공고에 담기" });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "관심 공고에서 빼기" }).getAttribute("aria-pressed")).toBe("true");
    expect(showToast).toHaveBeenLastCalledWith("관심 공고에 담았어요");

    fireEvent.click(screen.getByRole("button", { name: "관심 공고에서 빼기" }));
    expect(showToast).toHaveBeenLastCalledWith("관심 공고에서 뺐어요");
  });

  it("같은 id의 버튼 두 개(카드와 상세)는 상태를 함께 쓴다", () => {
    render(
      <>
        <FavoriteButton animalId="1" variant="overlay" />
        <FavoriteButton animalId="1" />
        <FavoriteButton animalId="2" />
      </>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "관심 공고에 담기" })[0]);
    expect(screen.getAllByRole("button", { name: "관심 공고에서 빼기" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "관심 공고에 담기" })).toHaveLength(1);
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

  describe("움직임(README 움직임 표)", () => {
    const heart = () => document.querySelector("[data-slot=favorite-button] svg")!;

    it("켤 때만 하트가 튄다(누른 버튼만). 끄면 튀지 않고, 다시 켜면 또 튄다", () => {
      render(
        <>
          <FavoriteButton animalId="1" variant="overlay" />
          <FavoriteButton animalId="1" />
        </>,
      );
      const [card, detail] = screen.getAllByRole("button");
      fireEvent.click(card);
      expect(card.querySelector("svg")!.hasAttribute("data-heart-pop")).toBe(true);
      expect(card.querySelector("svg")!.getAttribute("fill-opacity")).toBe("1");
      expect(detail.querySelector("svg")!.hasAttribute("data-heart-pop")).toBe(false);

      fireEvent.click(card);
      expect(card.querySelector("svg")!.hasAttribute("data-heart-pop")).toBe(false);
      expect(card.querySelector("svg")!.getAttribute("fill-opacity")).toBe("0");
      fireEvent.click(card);
      expect(card.querySelector("svg")!.hasAttribute("data-heart-pop")).toBe(true);
    });

    it("이미 찜한 공고를 열면 튀지 않는다", () => {
      localStorage.setItem("nyanggonggo:favorites", JSON.stringify(["1"]));
      render(<FavoriteButton animalId="1" />);
      expect(screen.getByRole("button", { name: "관심 공고에서 빼기" })).toBeTruthy();
      expect(heart().hasAttribute("data-heart-pop")).toBe(false);
    });

    it("종료 공고는 채움만: 튐·끄기 페이드·누름 효과가 없다", () => {
      render(<FavoriteButton animalId="1" variant="overlay" still />);
      const button = screen.getByRole("button");
      expect(button.className).not.toContain("scale-press");
      fireEvent.click(button);
      expect(heart().getAttribute("fill-opacity")).toBe("1");
      expect(heart().hasAttribute("data-heart-pop")).toBe(false);
      fireEvent.click(button);
      expect(heart().getAttribute("class")).not.toContain("transition");
    });

    it("카드용(overlay)은 흰 원 40px, 누르는 영역 44px", () => {
      render(<FavoriteButton animalId="1" variant="overlay" />);
      expect(screen.getByRole("button").className).toContain("size-touch");
      const circle = document.querySelector("[data-slot=favorite-circle]")!;
      expect(circle.className).toContain("size-10");
      expect(circle.className).toContain("bg-photo-pill");
    });
  });
});
