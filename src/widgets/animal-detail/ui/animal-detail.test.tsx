// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { createQueryClient } from "@/shared/api/query-client";
import { AnimalDetail } from "./animal-detail";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

const IMG = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1.jpg";
const wire = (overrides: Partial<AnimalWireDto> = {}): AnimalWireDto => ({
  id: "450650202602282",
  species: "cat",
  images: [IMG],
  status: "protected",
  noticeEndDate: "2026-10-01",
  sex: "female",
  ageText: "2024(년생)",
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: "서귀포시 남원읍",
  noticePeriodText: "09.21 ~ 10.01",
  ...overrides,
});

const fetchMock = vi.fn<(input: string | URL | Request) => Promise<Response>>();

beforeEach(() => {
  // D-day 기준: 2026-09-21 09:00 KST. 타이머는 실제로 두고 Date만 고정한다
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T09:00:00+09:00"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  back.mockClear();
  push.mockClear();
});

function renderDetail() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<AnimalDetail id="450650202602282" />, { wrapper });
}

describe("AnimalDetail", () => {
  it("로딩 중 스켈레톤, 이후 정보와 하단 CTA", async () => {
    fetchMock.mockResolvedValue(Response.json(wire()));
    const { container } = renderDetail();
    expect(container.querySelector('[data-slot="detail-skeleton"]')).toBeTruthy();

    expect(await screen.findByRole("heading", { name: "제주특별자치도" })).toBeTruthy();
    expect(screen.getByText("암컷 · 2024(년생)")).toBeTruthy();
    expect(container.querySelector('[data-slot="status-badge"]')?.textContent).toBe("보호중");
    expect(container.querySelector('[data-slot="d-day"]')?.textContent).toBe("D-10");
    for (const text of ["보호소", "제2동물보호센터", "발견 장소", "서귀포시 남원읍", "공고 기간", "09.21 ~ 10.01"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    const cta = container.querySelector('[data-slot="bottom-cta"]')!;
    expect(cta.className).toContain("sticky");
    expect(cta.className).not.toContain("fixed");
    expect(cta.querySelector('[data-slot="favorite-button"]')).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toContain("/api/animals/450650202602282");
  });

  it("임박(D-3 이하)은 주황 D-day", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ noticeEndDate: "2026-09-23" })));
    const { container } = renderDetail();
    await screen.findByRole("heading");
    const dDay = container.querySelector('[data-slot="d-day"]')!;
    expect(dDay.textContent).toBe("D-2");
    expect(dDay.className).toContain("text-status-soon-text");
  });

  it("만료된 보호중(dDay null)은 D-day를 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ noticeEndDate: "2026-09-20" })));
    const { container } = renderDetail();
    await screen.findByRole("heading");
    expect(container.querySelector('[data-slot="d-day"]')).toBeNull();
    expect(container.querySelector('[data-slot="status-badge"]')?.textContent).toBe("보호중");
  });

  it("종료 공고는 '종료' 배지만, D-day 없음, 사진 saturate(.7)", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ status: "ended" })));
    const { container } = renderDetail();
    await screen.findByRole("heading");
    expect(container.querySelector('[data-slot="status-badge"]')?.textContent).toBe("종료");
    expect(container.querySelector('[data-slot="d-day"]')).toBeNull();
    expect(screen.getByRole("img").className).toContain("saturate-70");
  });

  it("비어 있는 정보 행은 그리지 않고, 나이가 없으면 '나이 미상'", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ shelterName: null, ageText: null, sex: "unknown" })));
    renderDetail();
    await screen.findByRole("heading");
    expect(screen.queryByText("보호소")).toBeNull();
    expect(screen.getByText("성별 미상 · 나이 미상")).toBeTruthy();
  });

  it("오류면 문구와 [뒤로가기]", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: "upstream_error", message: "공고 정보를 불러오지 못했어요." } }, { status: 502 }),
    );
    renderDetail();
    expect(await screen.findByText("지금은 고양이를 불러오지 못했어요")).toBeTruthy();
    // 상단 아이콘과 본문 버튼 모두 "뒤로가기". 본문 텍스트 버튼을 누른다
    fireEvent.click(screen.getByText("뒤로가기"));
    expect(back.mock.calls.length + push.mock.calls.length).toBe(1);
  });
});
