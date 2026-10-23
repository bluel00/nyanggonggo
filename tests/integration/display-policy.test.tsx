// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildOgModel } from "@/app/animals/[id]/og-model";
import { AnimalCard, animalSummaryText, detailDisplayText, type Animal } from "@/entities/animal";
import { makeAnimal } from "@tests/factories/animal";

/**
 * 표시 정책 고정(이슈 #29). 같은 규칙을 쓰는 화면(카드, OG 이미지, 공유·링크 미리보기 요약)이 상태마다 같은 글자를 내는지
 * 리팩터 전에 고정한다. 기대값은 코드를 읽지 않고 글자로 적는다. 상세 화면은 animal-detail.test.tsx가 같은 경우를 본다.
 */
afterEach(cleanup);

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");

const CASES: { name: string; animal: Partial<Animal>; card: string; ogBadge: string; ogDDay: string | null }[] = [
  { name: "보호 중 D-10", animal: { noticeEndAt: kst("2026-10-01T00:00:00") }, card: "보호중 · D-10", ogBadge: "보호중", ogDDay: "D-10" },
  { name: "임박 D-2", animal: { noticeEndAt: kst("2026-09-23T00:00:00") }, card: "임박 · D-2", ogBadge: "임박", ogDDay: "D-2" },
  { name: "당일", animal: { noticeEndAt: kst("2026-09-21T00:00:00") }, card: "임박 · D-day", ogBadge: "임박", ogDDay: "D-day" },
  { name: "종료", animal: { status: "ended", noticeEndAt: kst("2026-10-01T00:00:00") }, card: "종료", ogBadge: "종료", ogDDay: null },
  { name: "만료된 보호 중", animal: { noticeEndAt: kst("2026-09-20T00:00:00") }, card: "보호중", ogBadge: "보호중", ogDDay: null },
];

function renderCard(animal: Animal) {
  const { container } = render(<AnimalCard animal={animal} now={NOW} />);
  return container.querySelector('[data-slot="animal-card"]')!;
}

describe("D-day 표기: 카드 배지, OG, 공유 요약이 상태마다 같다", () => {
  it.each(CASES)("$name", ({ animal: overrides, card, ogBadge, ogDDay }) => {
    const animal = makeAnimal(overrides);
    expect(renderCard(animal).querySelector('[data-slot="status-badge"]')?.textContent).toBe(card);
    const og = buildOgModel(animal, NOW);
    expect(og.badgeText).toBe(ogBadge);
    expect(og.dDayText).toBe(ogDDay);
    // 요약의 상태 부분은 카드 배지와 같은 글자다
    expect(animalSummaryText(animal, NOW)).toBe(`성별 미상 · 나이 미상 · ${card}`);
  });
});

describe("사진 alt", () => {
  it("고양이: '<축종> 사진, <지역>'", () => {
    const card = renderCard(makeAnimal({ images: ["http://openapi.animal.go.kr/a.jpg"], regionText: "제주특별자치도" }));
    expect(card.querySelector("img")?.getAttribute("alt")).toBe("고양이 사진, 제주특별자치도");
  });

  it("기타 축종: 실제 동물 이름", () => {
    const card = renderCard(makeAnimal({ species: "other", kindText: "토끼", regionText: "경기도 성남시" }));
    expect(card.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("토끼 사진, 경기도 성남시");
  });
});

describe("상세 글꼴 예열 문자열(이슈 #30)", () => {
  // 글꼴 예열은 글자 집합이 의미라 순서가 아니라 글자 집합으로 고정한다. 주소·전화는 지어낸 값이다
  const ADDRESS = "가상특별시 예시구 테스트로 12 (샘플동)";
  const TEL = "000-1234-5678";
  const animal = (status: Animal["status"]) =>
    makeAnimal({
      status,
      sex: "female",
      ageText: "2024(년생)",
      regionText: "제주특별자치도",
      shelterName: "제2동물보호센터",
      foundPlaceText: "서귀포시 남원읍",
      shelterAddressText: ADDRESS,
      shelterTelText: TEL,
      noticePeriodText: "09.21 ~ 10.01",
      specialMarkText: "가상 특이사항",
    });
  const glyphs = (text: string) => [...new Set(text)].sort().join("");
  const FIXED = [
    "제주특별자치도",
    "보호중 임박 종료 · D-day 0123456789",
    "암컷 · 2024(년생)",
    "발견 장소 보호소 주소 전화 공고 기간 특이사항",
    "지도 전화",
    "제2동물보호센터 서귀포시 남원읍 09.21 ~ 10.01 가상 특이사항",
  ].join(" ");

  it("보호 중: 제목, 상태 글자, 성별·나이, 줄 이름, 링크 글자, 모든 줄 값", () => {
    expect(glyphs(detailDisplayText(animal("protected")))).toBe(glyphs(`${FIXED} ${ADDRESS} ${TEL}`));
  });

  it("종료: 화면에 숨기는 주소·전화 글자도 받는다", () => {
    expect(glyphs(detailDisplayText(animal("ended")))).toBe(glyphs(`${FIXED} ${ADDRESS} ${TEL}`));
  });
});

describe("보조 줄: 보호소, 없으면 발견 장소, 둘 다 없으면 없음(카드와 OG가 같다)", () => {
  const cases = [
    { shelterName: "제2동물보호센터", foundPlaceText: "서귀포시", expected: "제2동물보호센터" },
    { shelterName: null, foundPlaceText: "서귀포시", expected: "서귀포시" },
    { shelterName: null, foundPlaceText: null, expected: null },
  ];
  it.each(cases)("보호소 $shelterName, 발견 장소 $foundPlaceText", ({ shelterName, foundPlaceText, expected }) => {
    const animal = makeAnimal({ shelterName, foundPlaceText, regionText: "제주특별자치도" });
    const lines = [...renderCard(animal).querySelectorAll("p")].map((p) => p.textContent);
    expect(lines).toEqual(expected === null ? ["제주특별자치도"] : ["제주특별자치도", expected]);
    expect(buildOgModel(animal, NOW).sub).toBe(expected);
  });
});
