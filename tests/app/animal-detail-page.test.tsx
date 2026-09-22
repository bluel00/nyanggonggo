// @vitest-environment jsdom
/**
 * app/animals/[id]/page.tsx: id 형식 검증, 서버에서 조회한 공고를 TanStack Query 캐시로 넘겨 클라이언트가 다시 조회하지 않는지.
 * 서비스는 가짜로 바꿔 공공 API를 호출하지 않는다.
 */
import { QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { createQueryClient } from "@/shared/api/query-client";
import { AnimalDetailView } from "@/views/animal-detail";

const getById = vi.fn<(id: string) => Promise<AnimalWireDto>>();
vi.mock("@/server/animals/container", () => ({ getAnimalService: () => ({ getById }) }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

const { default: Page } = await import("@/app/animals/[id]/page");

const wire: AnimalWireDto = {
  id: "450650202602282",
  species: "cat",
  images: [],
  status: "protected",
  noticeEndDate: "2026-10-01",
  sex: "female",
  ageText: "2024(년생)",
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: null,
  noticePeriodText: null,
};

const clientFetch = vi.fn();
beforeEach(() => {
  getById.mockReset();
  vi.stubGlobal("fetch", clientFetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clientFetch.mockReset();
});

type BoundaryProps = { state: DehydratedState; children: ReactElement<{ id: string }> };

async function renderPage(id: string) {
  const element = await Page({ params: Promise.resolve({ id }) });
  expect(isValidElement(element)).toBe(true);
  return element as ReactElement<BoundaryProps>;
}

describe("app/animals/[id]", () => {
  it("서버에서 조회한 공고를 상세 쿼리 키로 미리 채워 view와 함께 넘긴다", async () => {
    getById.mockResolvedValue(wire);
    const element = await renderPage(wire.id);
    const { state, children } = element.props;
    expect(children.type).toBe(AnimalDetailView);
    expect(children.props.id).toBe(wire.id);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].queryKey).toEqual(["animals", "detail", wire.id]);
    expect(state.queries[0].state.data).toMatchObject({ id: wire.id, regionText: "제주특별자치도" });
    expect(getById).toHaveBeenCalledWith(wire.id);
  });

  it("넘겨받은 데이터로 바로 그리고 클라이언트는 /api를 다시 부르지 않는다", async () => {
    getById.mockResolvedValue(wire);
    const element = await renderPage(wire.id);
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    render(element, { wrapper });
    expect(screen.getByRole("heading", { name: "제주특별자치도" })).toBeTruthy();
    expect(clientFetch).not.toHaveBeenCalled();
  });

  it("서버 조회가 실패하면 쿼리를 넘기지 않고(클라이언트가 조회) 화면은 그대로 렌더한다", async () => {
    getById.mockRejectedValue(new Error("upstream"));
    const element = await renderPage(wire.id);
    expect(element.props.state.queries).toHaveLength(0);
    expect(element.props.children.type).toBe(AnimalDetailView);
  });

  it("형식이 다르면 notFound(조회하지 않음)", async () => {
    await expect(Page({ params: Promise.resolve({ id: "../etc" }) })).rejects.toThrow();
    expect(getById).not.toHaveBeenCalled();
  });
});
