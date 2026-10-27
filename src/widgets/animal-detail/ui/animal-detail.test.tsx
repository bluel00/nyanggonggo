// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { createQueryClient } from "@/shared/api/query-client";
import { AnimalDetail } from "./animal-detail";
import { makeWire } from "@tests/factories/animal";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

const IMG = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1.jpg";
const wire = (overrides: Partial<AnimalWireDto> = {}): AnimalWireDto =>
  makeWire({
    id: "450650202602282",
    images: [IMG],
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
  return render(<AnimalDetail id="450650202602282" origin="https://nyang.test" />, { wrapper });
}

describe("AnimalDetail", () => {
  it("로딩 중 스켈레톤, 이후 정보와 하단 CTA", async () => {
    fetchMock.mockResolvedValue(Response.json(wire()));
    const { container } = renderDetail();
    expect(container.querySelector('[data-slot="detail-skeleton"]')).toBeTruthy();
    // 바로 들어온 경우(목록을 거치지 않음)에도 뼈대에 뒤로가기가 있다(`/`로 간다, animal-detail-skeleton.test.tsx)
    expect(screen.getByRole("link", { name: "뒤로가기" })).toBeTruthy();

    expect(await screen.findByRole("heading", { name: "제주특별자치도" })).toBeTruthy();
    expect(screen.getByText("암컷 · 2024년생")).toBeTruthy();
    expect(container.querySelector('[data-slot="status-badge"]')?.textContent).toBe("보호중");
    expect(container.querySelector('[data-slot="d-day"]')?.textContent).toBe("공고 마감 D-10");
    for (const text of ["보호소", "제2동물보호센터", "발견 장소", "서귀포시 남원읍", "공고 기간", "09.21 ~ 10.01"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    const cta = container.querySelector('[data-slot="bottom-cta"]')!;
    expect(cta.className).toContain("sticky");
    expect(cta.className).not.toContain("fixed");
    expect(cta.querySelector('[data-slot="favorite-button"]')).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toContain("/api/animals/450650202602282");
  });

  it("기타 공고는 타이틀과 사진 alt에 어떤 동물인지 보여 준다", async () => {
    fetchMock.mockResolvedValue(
      Response.json(wire({ species: "other", kindText: "토끼", regionText: "경기도 성남시" })),
    );
    renderDetail();
    expect(await screen.findByRole("heading", { name: "토끼 · 경기도 성남시" })).toBeTruthy();
    expect(screen.getAllByRole("img")[0].getAttribute("alt")).toContain("토끼 사진, 경기도 성남시");
  });

  it("마감이 가까운 공고(D-3 이하)는 주황 마감 표기", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ noticeEndDate: "2026-09-23" })));
    const { container } = renderDetail();
    await screen.findByRole("heading");
    const dDay = container.querySelector('[data-slot="d-day"]')!;
    expect(dDay.textContent).toBe("공고 마감 D-2");
    expect(dDay.className).toContain("text-status-near-deadline-text");
  });

  it("당일은 '오늘 마감'(주황), 배지는 '보호중'", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ noticeEndDate: "2026-09-21" })));
    const { container } = renderDetail();
    await screen.findByRole("heading");
    const dDay = container.querySelector('[data-slot="d-day"]')!;
    expect(dDay.textContent).toBe("오늘 마감");
    expect(dDay.className).toContain("text-status-near-deadline-text");
    expect(container.querySelector('[data-slot="status-badge"]')?.textContent).toBe("보호중");
  });

  it("사진 alt는 카드와 같은 '<축종> 사진, <지역>' 뒤에 사진 번호", async () => {
    fetchMock.mockResolvedValue(Response.json(wire()));
    renderDetail();
    await screen.findByRole("heading");
    expect(screen.getAllByRole("img")[0].getAttribute("alt")).toBe("고양이 사진, 제주특별자치도 1");
  });

  it("만료된 보호중(dDay null)은 마감 표기를 보이지 않는다", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ noticeEndDate: "2026-09-20" })));
    const { container } = renderDetail();
    await screen.findByRole("heading");
    expect(container.querySelector('[data-slot="d-day"]')).toBeNull();
    expect(container.querySelector('[data-slot="status-badge"]')?.textContent).toBe("보호중");
  });

  it("종료 공고는 '종료' 배지만, 마감 표기 없음, 사진 saturate(.7)", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ status: "ended" })));
    const { container } = renderDetail();
    await screen.findByRole("heading");
    expect(container.querySelector('[data-slot="status-badge"]')?.textContent).toBe("종료");
    expect(container.querySelector('[data-slot="d-day"]')).toBeNull();
    expect(screen.getByRole("img").className).toContain("saturate-70");
  });

  it("제목은 Pretendard다: 보호중은 display-detail(24/32/700), 종료는 차분하게 title 크기에 줄 높이 32px(architecture.md 14.1)", async () => {
    fetchMock.mockResolvedValue(Response.json(wire()));
    renderDetail();
    expect((await screen.findByRole("heading")).className).toContain("text-display-detail");
    cleanup();

    fetchMock.mockResolvedValue(Response.json(wire({ status: "ended" })));
    renderDetail();
    const ended = await screen.findByRole("heading");
    expect(ended.className).toContain("text-title");
    expect(ended.className).toContain("leading-8");
    expect(ended.className).not.toContain("text-display-detail");
  });

  it("특이사항이 있으면 정보 행에 보여 준다", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ specialMarkText: "보호센터 내 출산" })));
    renderDetail();
    await screen.findByRole("heading");
    expect(screen.getByText("특이사항")).toBeTruthy();
    expect(screen.getByText("보호센터 내 출산")).toBeTruthy();
  });

  it("특이사항이 없으면 행 자체를 그리지 않는다", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ specialMarkText: null })));
    renderDetail();
    await screen.findByRole("heading");
    expect(screen.queryByText("특이사항")).toBeNull();
  });

  it("비어 있는 정보 행은 그리지 않고, 나이가 없으면 '나이 미상'", async () => {
    fetchMock.mockResolvedValue(Response.json(wire({ shelterName: null, ageText: null, sex: "unknown" })));
    renderDetail();
    await screen.findByRole("heading");
    expect(screen.queryByText("보호소")).toBeNull();
    expect(screen.getByText("성별 미상 · 나이 미상")).toBeTruthy();
  });

  it("모든 정보 줄 값은 띄어쓰기에서만 줄이 바뀌고(keep-all), 띄어쓰기 없는 긴 값은 넘치지 않게 끊는다(이슈 #11)", async () => {
    fetchMock.mockResolvedValue(
      Response.json(wire({ shelterAddressText: "가상특별시 예시구 테스트로 12", shelterTelText: "000-1234-5678", specialMarkText: "보호센터 내 출산" })),
    );
    const { container } = renderDetail();
    await screen.findByRole("heading");
    // 주소·전화는 정보 줄이 아니라 보호소 정보 시트에 있다(#62). 보호소 줄 값은 버튼과 함께 있어 detail-value가 span이다
    const values = [...container.querySelectorAll('[data-slot="detail-value"]')];
    expect(values.map((value) => value.textContent)).toEqual(["서귀포시 남원읍", "제2동물보호센터", "09.21 ~ 10.01", "보호센터 내 출산"]);
    for (const value of values) {
      expect(value.className.split(" ")).toEqual(expect.arrayContaining(["break-keep", "wrap-anywhere"]));
    }
  });

  describe("보호소 정보 시트(이슈 #62, 지어낸 값)", () => {
    const ADDRESS = "가상특별시 예시구 테스트로 12 (샘플동)";
    const TEL = "000-1234-5678";
    const contactWire = (overrides: Partial<AnimalWireDto> = {}) => wire({ shelterAddressText: ADDRESS, shelterTelText: TEL, ...overrides });
    const terms = (container: HTMLElement) => [...container.querySelectorAll("dt")].map((dt) => dt.textContent);
    const openSheet = () => fireEvent.click(screen.getByRole("button", { name: "보호소 정보 보기" }));

    it("정보 줄에 주소·전화가 없고, 보호소 줄 끝에 [보호소 정보](작은 글자, 44px)", async () => {
      fetchMock.mockResolvedValue(Response.json(contactWire({ specialMarkText: "가상 특이사항" })));
      const { container } = renderDetail();
      await screen.findByRole("heading");
      expect(terms(container)).toEqual(["발견 장소", "보호소", "공고 기간", "특이사항"]);
      expect(screen.queryByText(ADDRESS)).toBeNull();
      expect(screen.queryByText(TEL)).toBeNull();
      const button = screen.getByRole("button", { name: "보호소 정보 보기" });
      expect(button.textContent).toBe("보호소 정보");
      expect(button.closest("dd")?.textContent).toContain("제2동물보호센터");
      expect(button.className).toContain("text-text-2");
      expect(button.className).toContain("text-caption");
      expect(button.className.split(" ")).toEqual(expect.arrayContaining(["min-h-11", "min-w-11"]));
    });

    it("버튼을 누르면 시트: 제목은 보호소 이름, 주소 + [지도](새 탭), 전화 + [전화](tel: 숫자만), 값은 그냥 글자", async () => {
      fetchMock.mockResolvedValue(Response.json(contactWire()));
      renderDetail();
      await screen.findByRole("heading");
      openSheet();
      const sheet = await screen.findByRole("dialog", { name: "제2동물보호센터" });
      expect(sheet.textContent).toContain(ADDRESS);
      expect(screen.getByText(ADDRESS).tagName).toBe("SPAN");
      expect(screen.getByText(TEL).tagName).toBe("SPAN");
      const map = screen.getByRole("link", { name: "지도에서 주소 보기(새 탭)" });
      expect(map.getAttribute("href")).toBe(`https://map.kakao.com/link/search/${encodeURIComponent(ADDRESS)}`);
      expect(map.getAttribute("target")).toBe("_blank");
      expect(map.getAttribute("rel")).toBe("noopener");
      const call = screen.getByRole("link", { name: "보호소에 전화" });
      expect(call.getAttribute("href")).toBe("tel:00012345678");
      expect(call.hasAttribute("target")).toBe(false);
    });

    it("값이 없는 줄은 시트에서 빼고, 숫자 없는 전화는 줄만 두고 [전화] 링크를 뺀다", async () => {
      fetchMock.mockResolvedValue(Response.json(contactWire({ shelterAddressText: null, shelterTelText: "미정" })));
      renderDetail();
      await screen.findByRole("heading");
      openSheet();
      const sheet = await screen.findByRole("dialog", { name: "제2동물보호센터" });
      expect([...sheet.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["전화"]);
      expect(screen.getByText("미정")).toBeTruthy();
      expect(screen.queryByRole("link", { name: "보호소에 전화" })).toBeNull();
      expect(screen.queryByRole("link", { name: "지도에서 주소 보기(새 탭)" })).toBeNull();
    });

    it("종료 공고이거나 주소·전화가 모두 없으면 버튼이 없다(보호소 이름 줄은 그대로)", async () => {
      fetchMock.mockResolvedValue(Response.json(contactWire({ status: "ended" })));
      renderDetail();
      await screen.findByRole("heading");
      expect(screen.getByText("제2동물보호센터")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "보호소 정보 보기" })).toBeNull();
      cleanup();

      fetchMock.mockResolvedValue(Response.json(contactWire({ shelterAddressText: null, shelterTelText: "  " })));
      renderDetail();
      await screen.findByRole("heading");
      expect(screen.queryByRole("button", { name: "보호소 정보 보기" })).toBeNull();
    });
  });

  it("사진을 탭하면 뷰어가 열리고, 닫으면 메인 사진이 뷰어의 마지막 위치로 간다", async () => {
    const images = [1, 2, 3].map((n) => `http://openapi.animal.go.kr/openapi/files/${n}.jpg`);
    fetchMock.mockResolvedValue(Response.json(wire({ images })));
    const { container } = renderDetail();
    await screen.findByRole("heading");

    fireEvent.click(screen.getByRole("button", { name: "사진 크게 보기 (2/3)" }));
    expect(screen.getByRole("dialog", { name: "사진 크게 보기" })).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();

    const viewerTrack = document.querySelector<HTMLElement>('[data-slot="image-viewer"] > div')!;
    Object.defineProperty(viewerTrack, "clientWidth", { configurable: true, value: 390 });
    Object.defineProperty(viewerTrack, "scrollLeft", { configurable: true, writable: true, value: 780 });
    fireEvent.scroll(viewerTrack);

    const carousel = container.querySelector<HTMLElement>('[data-slot="image-carousel"]')!;
    Object.defineProperty(carousel, "clientWidth", { configurable: true, value: 390 });
    carousel.scrollTo = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(carousel.scrollTo).toHaveBeenCalledWith({ left: 780 });
    const dots = [...container.querySelectorAll('[data-slot="carousel-dots"] span')].map((d) => d.getAttribute("data-current"));
    expect(dots).toEqual(["false", "false", "true"]);
  });

  it("오류면 문구와 [뒤로가기]", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: "upstream_error", message: "공고 정보를 불러오지 못했어요." } }, { status: 502 }),
    );
    renderDetail();
    expect(await screen.findByText("지금은 공고를 불러오지 못했어요")).toBeTruthy();
    // 상단 아이콘과 본문 버튼 모두 "뒤로가기". 본문 텍스트 버튼을 누른다
    fireEvent.click(screen.getByText("뒤로가기"));
    expect(back.mock.calls.length + push.mock.calls.length).toBe(1);
  });
});
