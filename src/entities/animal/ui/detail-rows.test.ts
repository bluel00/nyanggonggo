import { describe, expect, it } from "vitest";
import { makeAnimal } from "@tests/factories/animal";
import { detailRowHref, detailRows } from "./detail-rows";

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
  it("발견 장소 → 보호소 → 주소 → 전화 → 공고 기간 → 특이사항, 주소는 지도·전화는 전화 동작", () => {
    expect(detailRows(full)).toEqual([
      { label: "발견 장소", value: "서귀포시 남원읍", action: null },
      { label: "보호소", value: "제2동물보호센터", action: null },
      { label: "주소", value: ADDRESS, action: "map" },
      { label: "전화", value: TEL, action: "call" },
      { label: "공고 기간", value: "09.21 ~ 10.01", action: null },
      { label: "특이사항", value: "가상 특이사항", action: null },
    ]);
  });

  it("공고 번호는 전화 뒤, 공고 기간 바로 앞에 원문 그대로 둔다(#59, 지어낸 값)", () => {
    const rows = detailRows({ ...full, noticeNoText: "가상-예시-2026-00001" });
    expect(rows.map((row) => row.label)).toEqual(["발견 장소", "보호소", "주소", "전화", "공고 번호", "공고 기간", "특이사항"]);
    expect(rows[4]).toEqual({ label: "공고 번호", value: "가상-예시-2026-00001", action: null });
  });

  it("값이 없는 줄은 뺀다", () => {
    expect(detailRows(makeAnimal({ shelterName: "제2동물보호센터" })).map((row) => row.label)).toEqual(["보호소"]);
  });

  it("종료: 주소·전화 줄을 숨기고 보호소 이름은 둔다", () => {
    expect(detailRows({ ...full, status: "ended" }).map((row) => row.label)).toEqual([
      "발견 장소",
      "보호소",
      "공고 기간",
      "특이사항",
    ]);
  });

  it("종료 사유가 있으면 공고 기간 뒤, 특이사항 앞에 원문 그대로 둔다(이슈 #41)", () => {
    const rows = detailRows({ ...full, status: "ended", endReasonText: "가상 종료 사유" });
    expect(rows.map((row) => row.label)).toEqual(["발견 장소", "보호소", "공고 기간", "종료 사유", "특이사항"]);
    expect(rows[3]).toEqual({ label: "종료 사유", value: "가상 종료 사유", action: null });
  });

  it("전화에 숫자가 없으면 줄은 두고 동작만 뺀다", () => {
    const tel = detailRows({ ...full, shelterTelText: "미정" }).find((row) => row.label === "전화");
    expect(tel).toEqual({ label: "전화", value: "미정", action: null });
  });
});

describe("detailRowHref", () => {
  it("지도는 주소 검색, 전화는 tel: 숫자만, 동작이 없으면 null", () => {
    const [found, , address, tel] = detailRows(full);
    expect(detailRowHref(address)).toBe(`https://map.kakao.com/link/search/${encodeURIComponent(ADDRESS)}`);
    expect(detailRowHref(tel)).toBe("tel:00012345678");
    expect(detailRowHref(found)).toBeNull();
  });
});
