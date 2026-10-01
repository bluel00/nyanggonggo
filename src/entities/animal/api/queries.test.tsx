// @vitest-environment jsdom
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
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
  specialMarkText: null,
  kindText: null,
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
  vi.restoreAllMocks();
  fetchMock.mockClear();
});

function providerFor(client: QueryClient) {
  return function TestQueryProvider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function wrapper() {
  return providerFor(createQueryClient());
}

const LIST_FILTER = { species: "cat", status: "protected", sort: "latest" } as const;

describe("animalKeys", () => {
  it("목록 키는 필터 4종으로 정해지고 region이 없으면 null로 고정된다", () => {
    expect(animalKeys.list({ species: "cat", status: "protected", sort: "latest" })).toEqual([
      "animals",
      "list",
      { species: "cat", region: null, district: null, status: "protected", sort: "latest" },
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

  /**
   * 무한쿼리 refetch는 쌓인 페이지를 처음 커서부터 전부 순차로 다시 받는다(50페이지면 51번).
   * 그래서 목록 쿼리는 재요청을 아예 끈다(architecture.md 5절, 12절 42).
   */
  describe("재요청하지 않는다", () => {
    /** 2페이지까지 받아 둔 상태를 만든다 */
    async function setup() {
      const client = createQueryClient();
      const view = renderHook(() => useAnimalsInfinite(LIST_FILTER), { wrapper: providerFor(client) });
      // data를 먼저 읽어 둔다. TanStack은 렌더에서 읽은 필드만 추적해 다시 그리므로(notifyOnChangeProps: tracked)
      // data를 한 번도 읽지 않으면 페이지가 늘어도 result.current가 갱신되지 않는다
      await waitFor(() => expect(view.result.current.data?.pages).toHaveLength(1));
      await act(() => view.result.current.fetchNextPage());
      await waitFor(() => expect(view.result.current.data?.pages).toHaveLength(2));
      return { client, view };
    }

    /** staleTime(60초)이 지난 시각으로 옮긴다. gcTime(5분)은 넘기지 않는다 */
    function goStale() {
      const past = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(past + 2 * 60_000);
    }

    it("상세에서 돌아와 다시 마운트해도(데이터가 오래됐어도) 다시 받지 않는다", async () => {
      const { client, view } = await setup();
      view.unmount();
      const calls = fetchMock.mock.calls.length;
      goStale();

      const again = renderHook(() => useAnimalsInfinite(LIST_FILTER), { wrapper: providerFor(client) });
      await waitFor(() => expect(again.result.current.data?.pages).toHaveLength(2));
      expect(again.result.current.isStale, "오래된 데이터 그대로 쓴다").toBe(true);
      expect(fetchMock.mock.calls.length, "페이지마다 다시 받지 않는다").toBe(calls);
    });

    it("앱으로 복귀하거나(focus) 네트워크가 돌아와도(reconnect) 다시 받지 않는다", async () => {
      const { view } = await setup();
      const calls = fetchMock.mock.calls.length;
      goStale();

      await act(async () => {
        window.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("online"));
      });
      await waitFor(() => expect(view.result.current.isFetching).toBe(false));
      expect(fetchMock.mock.calls.length).toBe(calls);
    });

    it("데이터가 없으면(첫 진입, 필터 변경, 새로고침) 그대로 받는다", async () => {
      const { client } = await setup();
      const calls = fetchMock.mock.calls.length;
      goStale();

      // 필터가 바뀌면 쿼리 키가 달라 캐시가 없다
      const other = renderHook(() => useAnimalsInfinite({ ...LIST_FILTER, sort: "endingSoon" }), {
        wrapper: providerFor(client),
      });
      await waitFor(() => expect(other.result.current.isSuccess).toBe(true));
      expect(fetchMock.mock.calls.length).toBe(calls + 1);
    });
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
