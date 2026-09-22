// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Animal } from "../model/animal";
import { AnimalCard } from "./animal-card";
import { statusBadgeText } from "./status-badge";

afterEach(cleanup);

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");
const IMG = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1%5B1%5D.jpg";

const animal = (overrides: Partial<Animal> = {}): Animal => ({
  id: "450650202602282",
  species: "cat",
  images: [IMG, "http://openapi.animal.go.kr/b.jpg"],
  status: "protected",
  noticeEndAt: kst("2026-10-01T00:00:00"),
  sex: "female",
  ageText: "2024(년생)",
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: "서귀포시 남원읍",
  noticePeriodText: "09.21 ~ 10.01",
  ...overrides,
});

function renderCard(a: Animal) {
  const { container } = render(<AnimalCard animal={a} now={NOW} />);
  const card = container.querySelector('[data-slot="animal-card"]')!;
  const badge = container.querySelector('[data-slot="status-badge"]')!;
  return { card, badge };
}

describe("AnimalCard", () => {
  it("보호중(D-10): 초록 배지 + D-day, 사진은 프록시 경유 첫 사진", () => {
    const { card, badge } = renderCard(animal());
    expect(card.getAttribute("data-status")).toBe("protected");
    expect(badge.textContent).toBe("보호중 · D-10");
    expect(badge.className).toContain("text-status-protected-text");
    // 글자 크기 토큰이 색 토큰과 병합되며 사라지지 않는다(cn 테마 설정)
    expect(badge.className).toContain("text-badge");
    const img = screen.getByRole("img", { name: "고양이 사진, 제주특별자치도" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`/api/image-proxy?src=${encodeURIComponent(IMG)}`);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.className).not.toContain("saturate-70");
  });

  it("임박(D-3 이하): 주황 배지", () => {
    const { card, badge } = renderCard(animal({ noticeEndAt: kst("2026-09-23T00:00:00") }));
    expect(card.getAttribute("data-status")).toBe("soon");
    expect(badge.textContent).toBe("임박 · D-2");
    expect(badge.className).toContain("text-status-soon-text");
  });

  it("종료: 회색 배지 '종료'만(D-day 없음), 사진 saturate(.7)", () => {
    const { card, badge } = renderCard(animal({ status: "ended", noticeEndAt: kst("2026-09-30T00:00:00") }));
    expect(card.getAttribute("data-status")).toBe("ended");
    expect(badge.textContent).toBe("종료");
    expect(badge.className).toContain("text-status-ended-text");
    expect(screen.getByRole("img").className).toContain("saturate-70");
  });

  it("종료일이 지난 보호중은 '보호중'만(D-day 없음)", () => {
    const { badge } = renderCard(animal({ noticeEndAt: kst("2026-09-20T00:00:00") }));
    expect(badge.textContent).toBe("보호중");
  });

  it("텍스트: 1줄 지역, 2줄 보호소(없으면 발견 장소)", () => {
    renderCard(animal({ shelterName: null }));
    expect(screen.getByText("제주특별자치도")).toBeTruthy();
    expect(screen.getByText("서귀포시 남원읍")).toBeTruthy();
  });

  it("이미지 로딩 실패 시 대체 UI(같은 alt를 가진 role=img)", () => {
    renderCard(animal({ species: "dog" }));
    fireEvent.error(screen.getByRole("img"));
    const fallback = screen.getByRole("img", { name: "강아지 사진, 제주특별자치도" });
    expect(fallback.tagName).toBe("DIV");
  });

  it("사진이 없거나 허용되지 않은 원본이면 처음부터 대체 UI", () => {
    renderCard(animal({ images: [] }));
    expect(screen.getByRole("img").tagName).toBe("DIV");
    cleanup();
    renderCard(animal({ images: ["http://example.com/a.jpg"] }));
    expect(screen.getByRole("img").tagName).toBe("DIV");
  });

  it("href가 있으면 링크", () => {
    const { container } = render(<AnimalCard animal={animal()} now={NOW} href="/animals/1" />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/animals/1");
  });
});

describe("statusBadgeText", () => {
  it("당일은 D-day, 종료는 D-day를 붙이지 않는다", () => {
    expect(statusBadgeText("soon", 0)).toBe("임박 · D-day");
    expect(statusBadgeText("ended", 5)).toBe("종료");
    expect(statusBadgeText("protected", null)).toBe("보호중");
  });
});
