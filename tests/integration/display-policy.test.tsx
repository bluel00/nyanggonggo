// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildOgModel } from "@/app/animals/[id]/og-model";
import { AnimalCard, animalSummaryText, detailDisplayText, type Animal } from "@/entities/animal";
import { makeAnimal } from "@tests/factories/animal";

/**
 * 표시 정책 고정(이슈 #29, #57). 같은 규칙을 쓰는 곳(카드, OG 이미지, 공유·링크 미리보기 요약)이 상태마다 내는 글자를 고정한다.
 * 마감 표기는 앱 안(카드)은 상대 표기, 밖으로 나가는 것(OG 이미지, 공유 요약)은 날짜다(#57). 기대값은 코드를 읽지 않고 글자로 적는다. 상세 화면은 animal-detail.test.tsx가 같은 경우를 본다.
 */
afterEach(cleanup);

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");

const CASES: { name: string; animal: Partial<Animal>; card: string; ogBadge: string; ogDeadline: string | null; share: string }[] = [
  { name: "보호 중 D-10", animal: { noticeEndAt: kst("2026-10-01T00:00:00") }, card: "보호중 · 마감 D-10", ogBadge: "보호중", ogDeadline: "공고 마감 10월 1일(목)", share: "보호중 · 공고 마감 10월 1일(목)" },
  { name: "마감이 가까운 D-2(색으로만 구분)", animal: { noticeEndAt: kst("2026-09-23T00:00:00") }, card: "보호중 · 마감 D-2", ogBadge: "보호중", ogDeadline: "공고 마감 9월 23일(수)", share: "보호중 · 공고 마감 9월 23일(수)" },
  { name: "당일", animal: { noticeEndAt: kst("2026-09-21T00:00:00") }, card: "보호중 · 오늘 마감", ogBadge: "보호중", ogDeadline: "공고 마감 9월 21일(월)", share: "보호중 · 공고 마감 9월 21일(월)" },
  { name: "종료", animal: { status: "ended", noticeEndAt: kst("2026-10-01T00:00:00") }, card: "종료", ogBadge: "종료", ogDeadline: null, share: "종료" },
  // 이슈 #41: 종료 결과(processState 괄호 안 원문)를 붙인다. 처음 보는 값도 그대로다
  ...(["입양", "임시보호연계"] as const).map((endResultText) => ({
    name: `종료 · ${endResultText}`,
    animal: { status: "ended", endResultText, noticeEndAt: kst("2026-10-01T00:00:00") } as const,
    card: `종료 · ${endResultText}`,
    ogBadge: `종료 · ${endResultText}`,
    ogDeadline: null,
    share: `종료 · ${endResultText}`,
  })),
  { name: "만료된 보호 중", animal: { noticeEndAt: kst("2026-09-20T00:00:00") }, card: "보호중", ogBadge: "보호중", ogDeadline: null, share: "보호중" },
];

function renderCard(animal: Animal) {
  const { container } = render(<AnimalCard animal={animal} now={NOW} />);
  return container.querySelector('[data-slot="animal-card"]')!;
}

describe("상태·마감 표기: 카드 배지(상대), OG 이미지·공유 요약(날짜)", () => {
  it.each(CASES)("$name", ({ animal: overrides, card, ogBadge, ogDeadline, share }) => {
    const animal = makeAnimal(overrides);
    expect(renderCard(animal).querySelector('[data-slot="status-badge"]')?.textContent).toBe(card);
    const og = buildOgModel(animal, NOW);
    expect(og.badgeText).toBe(ogBadge);
    expect(og.deadlineText).toBe(ogDeadline);
    // 공유 요약의 상태 부분은 밖으로 나가는 표기(날짜)다
    expect(animalSummaryText(animal, NOW)).toBe(`성별 미상 · 나이 미상 · ${share}`);
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
    "보호중 종료 · 오늘 마감 공고 마감 D-1 0123456789",
    "암컷 · 2024(년생)",
    "발견 장소 보호소 주소 전화 공고 기간 종료 사유 특이사항",
    "지도 전화",
    "제2동물보호센터 서귀포시 남원읍 09.21 ~ 10.01 가상 특이사항",
  ].join(" ");

  it("보호 중: 제목, 상태 글자, 성별·나이, 줄 이름, 링크 글자, 모든 줄 값", () => {
    expect(glyphs(detailDisplayText(animal("protected")))).toBe(glyphs(`${FIXED} ${ADDRESS} ${TEL}`));
  });

  // 의도한 변경(이슈 #30): 리팩터 전에는 화면에 숨기는 주소·전화 글자까지 받았다. 이제 보이는 줄의 글자만 받는다(화면은 같다)
  it("종료: 화면에 숨기는 주소·전화 글자는 받지 않는다", () => {
    expect(glyphs(detailDisplayText(animal("ended")))).toBe(glyphs(FIXED));
  });

  it("종료: 결과(상태 글자)와 종료 사유 줄 값도 받는다(이슈 #41)", () => {
    const ended = { ...animal("ended"), endResultText: "반환", endReasonText: "보호자 확인 후 귀가" };
    expect(glyphs(detailDisplayText(ended))).toBe(glyphs(`${FIXED} 반환 보호자 확인 후 귀가`));
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
