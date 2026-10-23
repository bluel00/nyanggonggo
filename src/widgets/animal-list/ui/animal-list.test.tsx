// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalListFilter } from "@/entities/animal";
import { createQueryClient } from "@/shared/api/query-client";
import { AnimalList } from "./animal-list";
import { makeWire } from "@tests/factories/animal";

/** 가짜 IntersectionObserver: 테스트가 trigger()로 교차를 흉내 낸다 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  /** true면 실제 IntersectionObserver처럼 observe 직후 지금 상태(범위 안)를 한 번 알려 준다 */
  static inRange = false;
  observe(target: Element) {
    this.targets.add(target);
    if (FakeIntersectionObserver.inRange) queueMicrotask(() => this.trigger());
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

const wire = (id: string) => makeWire({ id, regionText: `지역${id}`, shelterName: `보호소${id}` });

const fetchMock = vi.fn<(input: string | URL | Request) => Promise<Response>>();
const listRequests = () =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/animals");

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  FakeIntersectionObserver.inRange = false;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function renderList(filter: AnimalListFilter = { species: "cat", status: "protected", sex: "all", sort: "latest" }) {
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

  it("다음 페이지를 붙인 뒤에도 sentinel이 범위 안이면 이어서 부른다(감시를 페이지마다 새로 건다)", async () => {
    // 감시는 상태가 바뀔 때만 알리므로, 한 감시를 계속 쓰면 범위 안에 머무는 sentinel로는 다시 부르지 않는다
    FakeIntersectionObserver.inRange = true;
    fetchMock.mockImplementation(async (input) => {
      const cursor = new URL(String(input), "http://localhost").searchParams.get("cursor");
      if (cursor === null) return Response.json({ items: [wire("1")], nextCursor: "Mg" });
      if (cursor === "Mg") return Response.json({ items: [wire("2")], nextCursor: "Mw" });
      return Response.json({ items: [wire("3")], nextCursor: null });
    });
    renderList();

    await screen.findByText("지역3");
    expect(listRequests().map((url) => url.searchParams.get("cursor"))).toEqual([null, "Mg", "Mw"]);
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

  it("fetchpriority high는 첫 카드 사진 한 장뿐이다", async () => {
    const ids = ["411300202600527", "411300202600526", "411300202600525"];
    const withPhoto = (id: string) => ({ ...wire(id), images: [`http://openapi.animal.go.kr/openapi/files/${id}.jpg`] });
    fetchMock.mockResolvedValue(Response.json({ items: ids.map(withPhoto), nextCursor: null }));
    const { container } = renderList();
    await screen.findByText("지역411300202600527");
    const high = container.querySelectorAll('img[fetchpriority="high"]');
    expect(high).toHaveLength(1);
    expect(high[0].closest(`[data-animal-id]`)?.getAttribute("data-animal-id")).toBe(ids[0]);
    expect(high[0].getAttribute("loading")).toBe("eager");
  });

  it("결과가 0건이면 빈 상태 문구", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [], nextCursor: null }));
    renderList({ species: "dog", status: "ended", sex: "all", sort: "latest" });
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

describe("AnimalList 상세로 갈 때(PRD-v1.5 R6)", () => {
  // 상세는 목록 위에 얹히고 목록은 내려가지 않는다. 그래서 목록은 떠날 때 아무것도 기억하지 않고 스크롤도 건드리지 않는다
  afterEach(() => sessionStorage.clear());

  it("카드를 눌러도 스크롤 위치를 바꾸거나 저장하지 않는다(복원 코드·키 없음)", async () => {
    fetchMock.mockImplementation(async () => Response.json({ items: [wire("1"), wire("2"), wire("3")], nextCursor: null }));
    document.body.innerHTML = `<div data-slot="app-column"><div data-slot="app-scroll"></div></div>`;
    const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
    const host = document.createElement("div");
    scroll.appendChild(host);
    const client = createQueryClient();
    render(<AnimalList filter={{ species: "cat", status: "protected", sex: "all", sort: "latest" }} />, {
      container: host,
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await screen.findByText("지역3");
    scroll.scrollTop = 800;
    const keysBefore = Object.keys(sessionStorage).sort();

    fireEvent.click(screen.getByText("지역3"));

    expect(scroll.scrollTop).toBe(800);
    expect(Object.keys(sessionStorage).sort()).toEqual(keysBefore);
  });
});
