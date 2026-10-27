import { describe, expect, it } from "vitest";
import { makeAnimal } from "@tests/factories/animal";
import { detailRows } from "./detail-rows";

// 주소·전화는 지어낸 값이다
const ADDRESS = "가상특별시 예시구 테스트로 12 (샘플동)";
const TEL = "000-1234-5678";
const full = makeAnimal({
  foundPlaceText: "서귀포시 남원읍",
  shelterName: "제2동물보호센터",
  shelterAddressText: ADDRESS,
  shelterTelText: TEL,
  noticePeriodText: "09.21 ~ 10.01",
  specialMarkText: "가상 특이사항",
});

describe("detailRows", () => {
  it("발견 장소 → 보호소 → 공고 기간 → 특이사항. 주소·전화 줄은 없고(#62), 보호소 줄 끝에 [보호소 정보]", () => {
    expect(detailRows(full)).toEqual([
      { label: "발견 장소", value: "서귀포시 남원읍", action: null },
      { label: "보호소", value: "제2동물보호센터", action: "shelterInfo" },
      { label: "공고 기간", value: "09.21 ~ 10.01", action: null },
      { label: "특이사항", value: "가상 특이사항", action: null },
    ]);
  });

  it("공고 번호는 보호소 뒤, 공고 기간 바로 앞에 원문 그대로 둔다(#59, 지어낸 값)", () => {
    const rows = detailRows({ ...full, noticeNoText: "가상-예시-2026-00001" });
    expect(rows.map((row) => row.label)).toEqual(["발견 장소", "보호소", "공고 번호", "공고 기간", "특이사항"]);
    expect(rows[2]).toEqual({ label: "공고 번호", value: "가상-예시-2026-00001", action: null });
  });

  it("값이 없는 줄은 뺀다", () => {
    expect(detailRows(makeAnimal({ shelterName: "제2동물보호센터" })).map((row) => row.label)).toEqual(["보호소"]);
  });

  it("[보호소 정보]는 주소나 전화 중 하나라도 있으면 붙는다", () => {
    const shelter = (overrides: Parameters<typeof makeAnimal>[0]) =>
      detailRows(makeAnimal({ shelterName: "제2동물보호센터", ...overrides })).find((row) => row.label === "보호소")?.action;
    expect(shelter({ shelterAddressText: ADDRESS })).toBe("shelterInfo");
    expect(shelter({ shelterTelText: TEL })).toBe("shelterInfo");
    expect(shelter({ shelterTelText: "미정" })).toBe("shelterInfo");
    expect(shelter({})).toBeNull();
  });

  it("종료: [보호소 정보]가 없고 보호소 이름 줄은 둔다", () => {
    const rows = detailRows({ ...full, status: "ended" });
    expect(rows.map((row) => row.label)).toEqual(["발견 장소", "보호소", "공고 기간", "특이사항"]);
    expect(rows.every((row) => row.action === null)).toBe(true);
  });

  it("종료 사유가 있으면 공고 기간 뒤, 특이사항 앞에 원문 그대로 둔다(이슈 #41)", () => {
    const rows = detailRows({ ...full, status: "ended", endReasonText: "가상 종료 사유" });
    expect(rows.map((row) => row.label)).toEqual(["발견 장소", "보호소", "공고 기간", "종료 사유", "특이사항"]);
    expect(rows[3]).toEqual({ label: "종료 사유", value: "가상 종료 사유", action: null });
  });
});
