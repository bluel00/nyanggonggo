// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAVORITES_STORAGE_KEY } from "@/features/animal-favorite";
import { createQueryClient } from "@/shared/api/query-client";
import { FavoriteList } from "./favorite-list";
import { makeWire } from "@tests/factories/animal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@/shared/ui/toast", () => ({ showToast: vi.fn() }));

const wire = (id: string) => makeWire({ id, regionText: `지역${id}` });

/** 업스트림 오류가 나는 id. 테스트가 바꾼다 */
let failing = new Set<string>();

/**
 * 서버처럼: 요청 순서를 유지하고 없는 id(9로 시작)는 빼며, failing의 id는 failedIds에 담는다.
 * 하나도 못 불러오고 실패가 있으면 502.
 */
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const ids = new URL(String(input), "http://localhost").searchParams.get("ids")!.split(",");
  const items = ids.filter((id) => !id.startsWith("9") && !failing.has(id)).map(wire);
  const failedIds = ids.filter((id) => failing.has(id));
  if (items.length === 0 && failedIds.length > 0) {
    return Response.json({ error: { code: "upstream_error", message: "x" } }, { status: 502 });
  }
  return Response.json({ items, failedIds });
});

const requestedIds = () =>
  fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost").searchParams.get("ids"));

beforeEach(() => {
  failing = new Set();
  localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

function renderList(saved: string[]) {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(saved));
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<FavoriteList />, { wrapper });
}

const cardTitles = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-slot="animal-card"] p.text-card-title')].map((p) => p.textContent);

describe("FavoriteList", () => {
  it("찜이 없으면 빈 상태 문구(요청하지 않음)", async () => {
    renderList([]);
    expect(await screen.findByText("아직 관심 공고가 없어요")).toBeTruthy();
    expect(screen.getByText("하트를 눌러 관심 공고에 담아 보세요")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("저장 순서(최근 순)대로 조회해 같은 카드로 그리고, 카드는 상세로 링크된다", async () => {
    const { container } = renderList(["3", "1", "2"]);
    await screen.findByText("지역3");
    expect(cardTitles(container)).toEqual(["지역3", "지역1", "지역2"]);
    expect(new URL(String(fetchMock.mock.calls[0][0]), "http://localhost").searchParams.get("ids")).toBe("3,1,2");
    expect(container.querySelector('a[href="/animals/3"]')).toBeTruthy();
  });

  it("조회되지 않는 id는 화면에서 빼고 저장은 유지한다", async () => {
    const { container } = renderList(["1", "999"]);
    await screen.findByText("지역1");
    expect(cardTitles(container)).toEqual(["지역1"]);
    expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY)!)).toEqual(["1", "999"]);
  });

  it("모두 조회되지 않으면 빈 상태", async () => {
    renderList(["999"]);
    expect(await screen.findByText("아직 관심 공고가 없어요")).toBeTruthy();
  });

  it("여기서 찜을 해제하면 카드가 바로 빠진다(스켈레톤으로 돌아가지 않음)", async () => {
    const { container } = renderList(["1", "2"]);
    await screen.findByText("지역2");
    fireEvent.click(screen.getAllByRole("button", { name: "관심 공고에서 빼기" })[0]);
    expect(cardTitles(container)).toEqual(["지역2"]);
    expect(container.querySelector('[data-slot="skeleton-card"]')).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(cardTitles(container)).toEqual(["지역2"]);
  });

  it("오류면 문구와 [다시 시도]", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "upstream_error", message: "x" } }, { status: 502 }));
    renderList(["1"]);
    expect(await screen.findByText("지금은 관심 공고를 불러오지 못했어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("지역1")).toBeTruthy();
  });

  describe("일부 실패(이슈 #5)", () => {
    it("받은 카드는 보이고, 목록 위 한 줄과 [다시 시도]가 보이며, 실패한 id는 저장에 남는다", async () => {
      failing = new Set(["2"]);
      const { container } = renderList(["3", "2", "1"]);
      expect(await screen.findByText("일부 공고를 불러오지 못했어요")).toBeTruthy();
      expect(cardTitles(container)).toEqual(["지역3", "지역1"]);
      expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY)!)).toEqual(["3", "2", "1"]);
    });

    it("[다시 시도]는 실패한 것만 다시 받고, 성공하면 저장 순서대로 끼워 넣고 줄이 사라진다", async () => {
      failing = new Set(["2"]);
      const { container } = renderList(["3", "2", "1"]);
      await screen.findByText("일부 공고를 불러오지 못했어요");
      failing = new Set();
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
      await screen.findByText("지역2");
      expect(requestedIds()).toEqual(["3,2,1", "2"]);
      expect(cardTitles(container)).toEqual(["지역3", "지역2", "지역1"]);
      expect(screen.queryByText("일부 공고를 불러오지 못했어요")).toBeNull();
    });

    it("다시 시도가 또 실패하면 카드와 줄을 그대로 둔다", async () => {
      failing = new Set(["2"]);
      const { container } = renderList(["3", "2", "1"]);
      await screen.findByText("일부 공고를 불러오지 못했어요");
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole("button", { name: "다시 시도" }).hasAttribute("disabled")).toBe(false));
      expect(cardTitles(container)).toEqual(["지역3", "지역1"]);
      expect(screen.getByText("일부 공고를 불러오지 못했어요")).toBeTruthy();
    });

    it("전부 실패하면 지금의 오류 화면이고 저장은 그대로다", async () => {
      failing = new Set(["1", "2"]);
      renderList(["1", "2"]);
      expect(await screen.findByText("지금은 관심 공고를 불러오지 못했어요")).toBeTruthy();
      expect(screen.queryByText("일부 공고를 불러오지 못했어요")).toBeNull();
      expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY)!)).toEqual(["1", "2"]);
    });

    it("못 찾은 id는 지금처럼 조용히 빠진다(줄 없음)", async () => {
      const { container } = renderList(["1", "999"]);
      await screen.findByText("지역1");
      expect(cardTitles(container)).toEqual(["지역1"]);
      expect(screen.queryByText("일부 공고를 불러오지 못했어요")).toBeNull();
    });
  });
});
