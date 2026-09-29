// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import type { AnimalListFilter } from "@/entities/animal";
import { createQueryClient } from "@/shared/api/query-client";
import { AnimalList } from "./animal-list";

/** 가짜 IntersectionObserver: 테스트가 trigger()로 교차를 흉내 낸다 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords() {
    return [];
  }
  trigger() {
    const entries = [...this.targets].map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry);
    if (entries.length) this.callback(entries, this as unknown as IntersectionObserver);
  }
}
const triggerSentinel = () => act(() => FakeIntersectionObserver.instances.forEach((o) => o.trigger()));

const wire = (id: string): AnimalWireDto => ({
  id,
  species: "cat",
  images: [],
  status: "protected",
  noticeEndDate: "2026-10-01",
  sex: "unknown",
  ageText: null,
  regionText: `지역${id}`,
  shelterName: `보호소${id}`,
  foundPlaceText: null,
  noticePeriodText: null,
  specialMarkText: null,
});

const fetchMock = vi.fn<(input: string | URL | Request) => Promise<Response>>();
const listRequests = () =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/animals");

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function renderList(filter: AnimalListFilter = { species: "cat", status: "protected", sort: "latest" }) {
  const client = createQueryClient();
  // 테스트에서는 재시도 지연을 없앤다(재시도 정책 자체는 query-client 테스트가 확인)
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<AnimalList filter={filter} />, { wrapper });
}

describe("AnimalList", () => {
  it("첫 페이지를 그리고, sentinel이 보이면 nextCursor로 다음 페이지를 요청한다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const cursor = new URL(String(input), "http://localhost").searchParams.get("cursor");
      return Response.json(
        cursor === null ? { items: [wire("1"), wire("2")], nextCursor: "Mg" } : { items: [wire("3")], nextCursor: null },
      );
    });
    const { container } = renderList();

    // 로딩 중에는 스켈레톤 3개
    expect(container.querySelectorAll('[data-slot="skeleton-card"]')).toHaveLength(3);
    await screen.findByText("지역1");
    expect(listRequests()).toHaveLength(1);
    expect(listRequests()[0].searchParams.has("page")).toBe(false);

    triggerSentinel();
    await screen.findByText("지역3");
    expect(listRequests()).toHaveLength(2);
    expect(listRequests()[1].searchParams.get("cursor")).toBe("Mg");

    // 마지막 페이지 뒤에는 더 요청하지 않는다
    triggerSentinel();
    await waitFor(() => expect(container.querySelectorAll('[data-slot="animal-card"]')).toHaveLength(3));
    expect(listRequests()).toHaveLength(2);
  });

  it("오류 상태에서 [다시 시도]를 누르면 다시 요청하고 목록을 그린다", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: "upstream_error", message: "공고 정보를 불러오지 못했어요." } }, { status: 502 }),
    );
    fetchMock.mockResolvedValueOnce(Response.json({ items: [wire("1")], nextCursor: null }));
    renderList();

    await screen.findByText("지금은 고양이를 불러오지 못했어요");
    expect(listRequests()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("지역1");
    expect(listRequests()).toHaveLength(2);
  });

  it("응답의 항목을 빠짐없이 그린다(2026-09-28 종로구 5건 회귀)", async () => {
    const ids = ["411300202600527", "411300202600526", "411300202600525", "411300202600524", "411300202600523"];
    fetchMock.mockResolvedValue(Response.json({ items: ids.map(wire), nextCursor: null }));
    const { container } = renderList();
    await screen.findByText("지역411300202600527");
    expect(container.querySelectorAll('[data-slot="animal-card"]')).toHaveLength(ids.length);
  });

  it("결과가 0건이면 빈 상태 문구", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [], nextCursor: null }));
    renderList({ species: "dog", status: "ended", sort: "latest" });
    await screen.findByText("조건에 맞는 강아지가 없어요");
    expect(screen.getByText("필터를 바꿔서 다시 찾아보세요")).toBeTruthy();
  });

  it("다음 페이지 요청이 실패하면 받은 카드는 두고 재시도 버튼을 보인다", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ items: [wire("1")], nextCursor: "MQ" }));
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "upstream_timeout", message: "x" } }, { status: 504 }));
    fetchMock.mockResolvedValueOnce(Response.json({ items: [wire("2")], nextCursor: null }));
    renderList();

    await screen.findByText("지역1");
    triggerSentinel();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(screen.getByText("지역1")).toBeTruthy();

    fireEvent.click(retry);
    await screen.findByText("지역2");
    expect(listRequests()).toHaveLength(3);
  });
});

describe("AnimalList 찜 하트", () => {
  it("카드마다 찜 버튼이 있고 누르면 찜 상태가 바뀐다", async () => {
    localStorage.clear();
    fetchMock.mockResolvedValue(Response.json({ items: [wire("1"), wire("2")], nextCursor: null }));
    renderList();
    await screen.findByText("지역1");
    const buttons = screen.getAllByRole("button", { name: "찜하기" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(screen.getAllByRole("button", { name: "찜 해제" })).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("nyanggonggo:favorites")!)).toEqual(["1"]);
  });
});

describe("AnimalList 스크롤 복원", () => {
  const filter: AnimalListFilter = { species: "cat", status: "protected", sort: "latest" };
  const CARD_HEIGHT = 400;
  const CONTAINER_HEIGHT = 600;
  const realRect = Element.prototype.getBoundingClientRect;

  /** AppShell과 같은 구조를 만들고, 화면마다 별도 host에 그려 이동을 흉내 낸다 */
  function openShell() {
    document.body.innerHTML = `<div data-slot="app-column"><div data-slot="app-scroll"></div></div>`;
    const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
    // jsdom에는 레이아웃이 없다. 카드가 400px씩 쌓인 목록을 흉내 낸다
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this === scroll) return { top: 0, height: CONTAINER_HEIGHT } as DOMRect;
      const cards = [...scroll.querySelectorAll("[data-animal-id]")];
      const index = cards.indexOf(this);
      if (index < 0) return { top: 0, height: 0 } as DOMRect;
      return { top: index * CARD_HEIGHT - scroll.scrollTop, height: CARD_HEIGHT } as DOMRect;
    };
    const client = createQueryClient();
    const open = () => {
      const host = document.createElement("div");
      scroll.appendChild(host);
      return render(<AnimalList filter={filter} />, {
        container: host,
        wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
      });
    };
    return { scroll, open };
  }

  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect;
    sessionStorage.clear();
  });

  it("무한 스크롤로 2페이지를 본 뒤 상세로 갔다 돌아오면 카드가 그대로 있고 열었던 카드로 돌아간다", async () => {
    fetchMock.mockImplementation(async (input) => {
      const cursor = new URL(String(input), "http://localhost").searchParams.get("cursor");
      return Response.json(
        cursor === null
          ? { items: [wire("1"), wire("2"), wire("3")], nextCursor: "c2" }
          : { items: [wire("4"), wire("5")], nextCursor: null },
      );
    });
    const { scroll, open } = openShell();

    const list = open();
    await screen.findByText("지역1");
    await triggerSentinel();
    await screen.findByText("지역5"); // 2페이지까지 로드

    // 2페이지의 카드를 눌러 상세로 간다
    fireEvent.click(screen.getByText("지역4"));
    const requestsBeforeBack = listRequests().length;
    list.unmount();
    scroll.scrollTop = 0; // 상세 화면(맨 위)

    // 뒤로가기: 같은 QueryClient라 캐시된 2페이지가 그대로 나온다
    await act(async () => {
      open();
    });
    expect(screen.getByText("지역5")).toBeTruthy();
    // 지역4는 네 번째 카드(1200~1600). 가운데가 컨테이너 가운데에 오도록
    expect(scroll.scrollTop).toBe(1100);
    expect(listRequests()).toHaveLength(requestsBeforeBack); // 다시 불러오지 않는다(staleTime)
  });

  it("카드를 누르지 않고 돌아오면 맨 위에 둔다", async () => {
    fetchMock.mockImplementation(async () => Response.json({ items: [wire("1"), wire("2")], nextCursor: null }));
    const { scroll, open } = openShell();

    const list = open();
    await screen.findByText("지역1");
    list.unmount();
    scroll.scrollTop = 0;

    await act(async () => {
      open();
    });
    expect(scroll.scrollTop).toBe(0);
  });
});
