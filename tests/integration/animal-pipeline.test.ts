/**
 * 픽스처 6건을 서버 Mapper → 계약(Zod) → 클라이언트 Mapper로 통과시킨다.
 * 서버와 FSD 계층을 함께 import하므로 src 밖에 둔다.
 */
import { describe, expect, it } from "vitest";
import { AnimalListResponseSchema } from "@/contract/animals";
import { getDDay, isSoon, toAnimal, type Animal } from "@/entities/animal";
import { mapUpstreamItem } from "@/server/mapper";
import { UpstreamAnimalItemSchema } from "@/server/upstream/dto";
import fixture from "../../docs/fixtures/upstream-items.json";

const dtos = fixture.items.map((item) => UpstreamAnimalItemSchema.parse(item));
const response = AnimalListResponseSchema.parse(
  JSON.parse(
    JSON.stringify({
      items: dtos.map((dto) => mapUpstreamItem(dto)?.wire),
      nextCursor: null,
    }),
  ),
);
const animals = response.items.map(toAnimal);
const byId = (id: string): Animal => animals.find((a) => a.id === id)!;
const NOW = new Date("2026-09-21T00:00:00+09:00");

describe("Upstream → Wire → Animal", () => {
  it("6건이 모두 Domain으로 변환된다", () => {
    expect(animals.map((a) => a.id)).toEqual(dtos.map((d) => d.desertionNo));
  });

  it("연락처와 종료 사유가 Domain 어디에도 없다", () => {
    for (const [i, animal] of animals.entries()) {
      const dto = dtos[i];
      const serialized = JSON.stringify(animal);
      for (const key of ["careTel", "careAddr", "careOwnerNm", "endReason"] as const) {
        expect(animal).not.toHaveProperty(key);
        const value = dto[key]?.trim();
        // careOwnerNm은 orgNm(regionText로 공개)과 같은 값일 수 있다(픽스처 1: 제주특별자치도).
        if (value && value !== dto.orgNm.trim()) expect(serialized).not.toContain(value);
      }
    }
  });

  it("종료(안락사) → ended, 임박 아님", () => {
    const ended = byId("427346202600847");
    expect(ended.status).toBe("ended");
    expect(getDDay(ended, NOW)).toBeNull();
    expect(isSoon(ended, NOW)).toBe(false);
  });

  it("species, sex, 이미지 인코딩이 유지된다", () => {
    expect(byId("448539202600280").species).toBe("dog");
    expect(byId("450650202602282").species).toBe("cat");
    expect(byId("448536202600859").sex).toBe("unknown");
    expect(byId("448537202601421").images.every((u) => u.includes("%5B1%5D"))).toBe(true);
  });

  it("기준일 2026-09-21, noticeEdt=20261001 → dDay 10, 임박 아님", () => {
    const animal = byId("450650202602282");
    expect(getDDay(animal, NOW)).toBe(10);
    expect(isSoon(animal, NOW)).toBe(false);
  });

  it("noticeEdt=20260928 → dDay 7", () => {
    expect(getDDay(byId("448536202600859"), NOW)).toBe(7);
  });
});
