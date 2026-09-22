import { describe, expect, it } from "vitest";
import { DISTRICTS, findDistrict, findSido, SIDO } from "./regions";

describe("정적 지역 데이터(2026-09-22 실측)", () => {
  it("시도 16개, 시군구 237개, 모든 코드는 7자리 숫자이고 전체에서 중복이 없다", () => {
    expect(SIDO).toHaveLength(16);
    const districts = Object.values(DISTRICTS).flat();
    expect(districts).toHaveLength(237);
    const codes = [...SIDO.map((s) => s.code), ...districts.map((d) => d.code)];
    for (const code of codes) expect(code).toMatch(/^\d{7}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("모든 시도에 시군구 목록(빈 배열 포함)이 있다", () => {
    for (const sido of SIDO) expect(DISTRICTS[sido.code]).toBeDefined();
    expect(Object.keys(DISTRICTS).sort()).toEqual(SIDO.map((s) => s.code).sort());
  });

  it("실제 구가 아닌 항목(시도 자기 자신, ddd99dd 코드, 이름 없음)이 남아 있지 않다", () => {
    for (const sido of SIDO) {
      for (const district of DISTRICTS[sido.code]) {
        expect(district.code).not.toBe(sido.code);
        expect(district.code).not.toMatch(/^\d{3}99\d{2}$/);
        expect(district.name.trim()).not.toBe("");
        expect(district.name).not.toBe("가정보호");
      }
    }
  });

  it("기본 지역(서울/종로구)이 있고, 강원·전북은 특별자치도 코드, 세종은 시군구가 없다", () => {
    expect(findSido("6110000")?.name).toBe("서울특별시");
    expect(findDistrict("6110000", "3000000")?.name).toBe("종로구");
    expect(findSido("6530000")?.name).toBe("강원특별자치도");
    expect(findSido("6540000")?.name).toBe("전북특별자치도");
    expect(findSido("6420000")).toBeNull();
    expect(DISTRICTS["5690000"]).toEqual([]);
  });

  it("findDistrict는 시도에 속한 시군구만 찾는다", () => {
    expect(findDistrict("6260000", "3000000")).toBeNull();
    expect(findDistrict(undefined, "3000000")).toBeNull();
  });
});
