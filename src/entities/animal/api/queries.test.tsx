// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { createQueryClient } from "@/shared/api/query-client";
import { animalKeys, useAnimal, useAnimalsByIds, useAnimalsInfinite } from "./queries";

/**
 * 훅은 기본 어댑터(animalRepository)를 그대로 쓴다. 네트워크 대신 전역 fetch를 가짜로 바꾼다.
 */
const wire = (id: string): AnimalWireDto => ({
  id,
  species: "cat",
  images: [],
  status: "protected",
  noticeEndDate: "2026-10-01",
  sex: "unknown",
  ageText: null,
  regionText: "서울특별시",
  shelterName: null,
  foundPlaceText: null,
  noticePeriodText: null,
});

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === "/api/animals") {
    const cursor = url.searchParams.get("cursor");
    return Response.json(
      cursor === null ? { items: [wire("1"), wire("2")], nextCursor: "Mg" } : { items: [wire("3")], nextCursor: null },
    );
  }
  if (url.pathname === "/api/animals/by-ids") return Response.json({ items: [wire("2")] });
  return Response.json(wire(url.pathname.split("/").pop()!));
});

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

function wrapper() {
  const client = createQueryClient();
  return function TestQueryProvider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("animalKeys", () => {
  it("목록 키는 필터 4종으로 정해지고 region이 없으면 null로 고정된다", () => {
    expect(animalKeys.list({ species: "cat", status: "protected", sort: "latest" })).toEqual([
      "animals",
      "list",
      { species: "cat", region: null, status: "protected", sort: "latest" },
    ]);
  });
});

describe("useAnimalsInfinite", () => {
  it("첫 페이지를 받고 nextCursor로 다음 페이지를 이어 받는다", async () => {
    const { result } = renderHook(() => useAnimalsInfinite({ species: "cat", status: "protected", sort: "latest" }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].items.map((a) => a.id)).toEqual(["1", "2"]);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    const secondUrl = new URL(String(fetchMock.mock.calls[1][0]), "http://localhost");
    expect(secondUrl.searchParams.get("cursor")).toBe("Mg");
  });
});

describe("useAnimal", () => {
  it("id로 Domain을 받는다", async () => {
    const { result } = renderHook(() => useAnimal("448539202600280"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("448539202600280");
    expect(result.current.data?.noticeEndAt).toBeInstanceOf(Date);
  });
});

describe("useAnimalsByIds", () => {
  it("ids가 비면 요청하지 않는다(enabled: false)", () => {
    const { result } = renderHook(() => useAnimalsByIds([]), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ids가 있으면 받는다", async () => {
    const { result } = renderHook(() => useAnimalsByIds(["2", "9"]), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((a) => a.id)).toEqual(["2"]);
  });
});
