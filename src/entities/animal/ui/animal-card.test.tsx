// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Animal } from "../model/animal";
import { AnimalCard } from "./animal-card";
import { makeAnimal } from "@tests/factories/animal";

afterEach(cleanup);

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");
const IMG = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1%5B1%5D.jpg";

const animal = (overrides: Partial<Animal> = {}): Animal =>
  makeAnimal({
    id: "450650202602282",
    images: [IMG, "http://openapi.animal.go.kr/b.jpg"],
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
  describe("기타 축종", () => {
    const rabbit = animal({ species: "other", kindText: "토끼", regionText: "경기도 성남시" });

    it("어떤 동물인지를 지역 앞에 보여 준다", () => {
      renderCard(rabbit);
      expect(screen.getByText("토끼 · 경기도 성남시")).toBeTruthy();
    });

    it("사진 alt에도 동물 이름을 쓴다", () => {
      renderCard(rabbit);
      expect(screen.getByRole("img").getAttribute("alt")).toBe("토끼 사진, 경기도 성남시");
    });

    it("동물 이름이 없으면 기본 문구", () => {
      renderCard(animal({ species: "other", kindText: null, regionText: "경기도 성남시" }));
      expect(screen.getByText("기타 동물 · 경기도 성남시")).toBeTruthy();
    });

    it("고양이 카드는 지역만 보여 준다(바뀌지 않는다)", () => {
      renderCard(animal({ kindText: "한국 고양이" }));
      expect(screen.getByText("제주특별자치도")).toBeTruthy();
      expect(screen.getByRole("img").getAttribute("alt")).toBe("고양이 사진, 제주특별자치도");
    });
  });

  it("보호중(D-10): 초록 배지 + 마감 D-N, 사진은 프록시 경유 첫 사진", () => {
    const { card, badge } = renderCard(animal());
    expect(card.getAttribute("data-status-variant")).toBe("protected");
    expect(badge.textContent).toBe("보호중 · 마감 D-10");
    expect(badge.className).toContain("text-status-protected-text");
    // 글자 크기 토큰이 색 토큰과 병합되며 사라지지 않는다(cn 테마 설정)
    expect(badge.className).toContain("text-badge");
    const img = screen.getByRole("img", { name: "고양이 사진, 제주특별자치도" }) as HTMLImageElement;
    // 기본 src는 828 폭, srcset은 허용 폭 전부(480/828/1080), sizes는 카드 폭(컬럼 − 좌우 여백)
    expect(img.getAttribute("src")).toBe(`/api/image-proxy?src=${encodeURIComponent(IMG)}&w=828`);
    expect(img.getAttribute("srcset")).toBe(
      [480, 828, 1080].map((w) => `/api/image-proxy?src=${encodeURIComponent(IMG)}&w=${w} ${w}w`).join(", "),
    );
    expect(img.getAttribute("sizes")).toBe("(min-width: 480px) 448px, calc(100vw - 32px)");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.className).not.toContain("saturate-70");
  });

  it("사진 칸은 1:1, 사진은 가운데 기준 cover(architecture.md 12절 51)", () => {
    renderCard(animal());
    const img = screen.getByRole("img");
    expect(img.parentElement!.className).toContain("aspect-square");
    expect(img.className).toContain("object-cover");
    expect(img.className).toContain("object-center");
    expect(img.className).not.toContain("object-[");
  });

  it("마감이 가까운 공고(D-3 이하): 주황 배지, 문구는 '보호중'(색으로만 구분)", () => {
    const { card, badge } = renderCard(animal({ noticeEndAt: kst("2026-09-23T00:00:00") }));
    expect(card.getAttribute("data-status-variant")).toBe("nearDeadline");
    expect(badge.textContent).toBe("보호중 · 마감 D-2");
    expect(badge.className).toContain("text-status-soon-text");
  });

  it("종료: 회색 배지 '종료'만(마감 표기 없음), 사진 saturate(.7)", () => {
    const { card, badge } = renderCard(animal({ status: "ended", noticeEndAt: kst("2026-09-30T00:00:00") }));
    expect(card.getAttribute("data-status-variant")).toBe("ended");
    expect(badge.textContent).toBe("종료");
    expect(badge.className).toContain("text-status-ended-text");
    expect(screen.getByRole("img").className).toContain("saturate-70");
  });

  it("종료일이 지난 보호중은 '보호중'만(마감 표기 없음)", () => {
    const { badge } = renderCard(animal({ noticeEndAt: kst("2026-09-20T00:00:00") }));
    expect(badge.textContent).toBe("보호중");
  });

  it("텍스트: 1줄 지역, 2줄 보호소(없으면 발견 장소)", () => {
    renderCard(animal({ shelterName: null }));
    expect(screen.getByText("제주특별자치도")).toBeTruthy();
    expect(screen.getByText("서귀포시 남원읍")).toBeTruthy();
  });

  it("3줄: 공고 번호(작은 보조 글자), 값이 없으면 줄이 없다(#59, 지어낸 값)", () => {
    const { card } = renderCard(animal({ noticeNoText: "가상-예시-2026-00001" }));
    const line = card.querySelector('[data-slot="notice-no"]')!;
    expect(line.textContent).toBe("공고 번호 가상-예시-2026-00001");
    expect(line.className).toContain("text-caption");
    cleanup();
    expect(renderCard(animal({ noticeNoText: null })).card.querySelector('[data-slot="notice-no"]')).toBeNull();
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

  it("누름(README 움직임 표): 보호중은 scale .98 + shadow-card-pressed(움직임 줄이기 제외), 종료는 누름 효과가 없다", () => {
    const { container } = render(<AnimalCard animal={animal()} now={NOW} href="/animals/1" />);
    const link = container.querySelector("a")!;
    expect(link.className).toContain("motion-safe:active:scale-press");
    expect(link.className).toContain("motion-safe:active:shadow-card-pressed");
    expect(link.className).toContain("duration-press");
    cleanup();

    const ended = render(
      <AnimalCard animal={animal({ status: "ended", noticeEndAt: kst("2026-09-30T00:00:00") })} now={NOW} href="/animals/1" />,
    ).container.querySelector("a")!;
    expect(ended.className).not.toMatch(/scale-press|shadow-card-pressed|transition/);
  });

  it("href가 있으면 링크", () => {
    const { container } = render(<AnimalCard animal={animal()} now={NOW} href="/animals/1" />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/animals/1");
  });

  it("action은 링크 밖(형제)에 두어 클릭이 카드 이동을 일으키지 않는다", () => {
    const linkClick = vi.fn();
    const actionClick = vi.fn();
    const { container } = render(
      <AnimalCard
        animal={animal()}
        now={NOW}
        href="/animals/1"
        action={
          <button type="button" onClick={actionClick}>
            관심 공고에 담기
          </button>
        }
      />,
    );
    const link = container.querySelector("a")!;
    link.addEventListener("click", linkClick);
    const action = screen.getByRole("button", { name: "관심 공고에 담기" });
    expect(link.contains(action)).toBe(false);

    fireEvent.click(action);
    expect(actionClick).toHaveBeenCalledOnce();
    expect(linkClick).not.toHaveBeenCalled();
  });
});
