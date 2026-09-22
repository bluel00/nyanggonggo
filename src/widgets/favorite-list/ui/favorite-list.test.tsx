// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { FAVORITES_STORAGE_KEY } from "@/features/animal-favorite";
import { createQueryClient } from "@/shared/api/query-client";
import { FavoriteList } from "./favorite-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@/shared/ui/toast", () => ({ showToast: vi.fn() }));

const wire = (id: string): AnimalWireDto => ({
  id,
  species: "cat",
  images: [],
  status: "protected",
  noticeEndDate: "2026-10-01",
  sex: "unknown",
  ageText: null,
  regionText: `지역${id}`,
  shelterName: null,
  foundPlaceText: null,
  noticePeriodText: null,
});

/** 서버처럼: 요청 순서를 유지하고 없는 id(9로 시작)는 뺀다 */
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const ids = new URL(String(input), "http://localhost").searchParams.get("ids")!.split(",");
  return Response.json({ items: ids.filter((id) => !id.startsWith("9")).map(wire) });
});

beforeEach(() => {
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
    expect(await screen.findByText("아직 찜한 고양이가 없어요")).toBeTruthy();
    expect(screen.getByText("마음에 드는 고양이를 저장해보세요 🐾")).toBeTruthy();
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
    expect(await screen.findByText("아직 찜한 고양이가 없어요")).toBeTruthy();
  });

  it("여기서 찜을 해제하면 카드가 바로 빠진다(스켈레톤으로 돌아가지 않음)", async () => {
    const { container } = renderList(["1", "2"]);
    await screen.findByText("지역2");
    fireEvent.click(screen.getAllByRole("button", { name: "찜 해제" })[0]);
    expect(cardTitles(container)).toEqual(["지역2"]);
    expect(container.querySelector('[data-slot="skeleton-card"]')).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(cardTitles(container)).toEqual(["지역2"]);
  });

  it("오류면 문구와 [다시 시도]", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "upstream_error", message: "x" } }, { status: 502 }));
    renderList(["1"]);
    expect(await screen.findByText("지금은 고양이를 불러오지 못했어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("지역1")).toBeTruthy();
  });
});
