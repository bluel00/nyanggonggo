// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAVORITES_STORAGE_KEY, readFavoriteIds, subscribeFavorites, toggleFavorite } from "./favorites-store";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const stored = () => JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "null");

describe("favorites store", () => {
  it("토글로 저장/해제하고 localStorage에는 id 배열만 둔다", () => {
    expect(toggleFavorite("1")).toBe(true);
    expect(stored()).toEqual(["1"]);
    expect(toggleFavorite("1")).toBe(false);
    expect(stored()).toEqual([]);
  });

  it("최근에 찜한 것이 앞, 같은 id는 중복 저장하지 않는다", () => {
    toggleFavorite("1");
    toggleFavorite("2");
    expect(readFavoriteIds()).toEqual(["2", "1"]);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(["3", "3", "1"]));
    expect(readFavoriteIds()).toEqual(["3", "1"]);
    toggleFavorite("4");
    expect(stored()).toEqual(["4", "3", "1"]);
  });

  it.each([
    ["JSON 아님", "not json"],
    ["배열 아님", JSON.stringify({ ids: ["1"] })],
    ["숫자 id", JSON.stringify([1, 2])],
    ["형식이 다른 id", JSON.stringify(["abc"])],
  ])("검증 실패(%s)는 빈 배열로 보고, 다음 토글에서 올바른 값으로 덮는다", (_label, raw) => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, raw);
    expect(readFavoriteIds()).toEqual([]);
    toggleFavorite("7");
    expect(stored()).toEqual(["7"]);
  });

  it("같은 저장값이면 같은 배열 참조를 돌려준다", () => {
    toggleFavorite("1");
    expect(readFavoriteIds()).toBe(readFavoriteIds());
  });

  it("localStorage 접근이 막혀도 죽지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readFavoriteIds()).toEqual([]);
    expect(() => toggleFavorite("1")).not.toThrow();
  });

  it("같은 탭의 토글과 다른 탭의 storage 이벤트를 구독자에게 알린다", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeFavorites(onChange);
    toggleFavorite("1");
    window.dispatchEvent(new StorageEvent("storage", { key: FAVORITES_STORAGE_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
    toggleFavorite("1");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
