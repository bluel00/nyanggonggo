import { describe, expect, it, vi } from "vitest";
import { AnimalListResponseSchema } from "@/contract/animals";
import fixture from "../../../docs/fixtures/upstream-items.json";
import { mapUpstreamItem, type MappedAnimal } from "../mapper";
import type { AnimalSource } from "../source/animal-source";
import { UpstreamAnimalItemSchema } from "../upstream/dto";
import { InvalidRequestError, NotFoundError } from "./errors";
import { createAnimalService, decodeCursor, encodeCursor, type AnimalListParams } from "./service";

const dtos = fixture.items.map((item) => UpstreamAnimalItemSchema.parse(item));
const mapped = dtos.map((dto) => mapUpstreamItem(dto)!);

const ID = {
  protectedCat: "450650202602282", // noticeSdt 0921, noticeEdt 1001, updTm 11:29
  sexQ: "448536202600859", // 0921, 0928, 12:44
  optionalSfe: "445470202600976", // 0921, 1001, 11:08
  ended: "427346202600847", // 0908, 0918, 종료(안락사)
  twoBrackets: "448537202601421", // 0921, 1001, 11:35
  dog: "448539202600280", // 0921, 1006, 13:18
};

function fakeSource(list: MappedAnimal[] = mapped): AnimalSource {
  return {
    list: vi.fn(async () => list),
    getById: vi.fn(async (id: string) => list.find((m) => m.wire.id === id) ?? null),
  };
}

/** 픽스처 스냅샷 날짜 2026-09-21 09:00 KST */
const NOW = new Date("2026-09-21T09:00:00+09:00");

const service = (source = fakeSource(), pageSize = 20, now = NOW) =>
  createAnimalService(source, { pageSize, byIdsConcurrency: 2, now: () => now });

const params = (overrides: Partial<AnimalListParams> = {}): AnimalListParams => ({
  species: "cat",
  status: "protected",
  sort: "latest",
  ...overrides,
});

const ids = (response: { items: { id: string }[] }) => response.items.map((i) => i.id);

describe("list: 상태 필터", () => {
  it("protected는 종료 공고를 뺀다", async () => {
    const result = await service().list(params());
    expect(ids(result)).not.toContain(ID.ended);
    expect(result.items).toHaveLength(5);
  });

  it("ended는 종료(안락사)만", async () => {
    expect(ids(await service().list(params({ status: "ended" })))).toEqual([ID.ended]);
  });

  it("all은 전부", async () => {
    expect(await service().list(params({ status: "all" }))).toMatchObject({ nextCursor: null });
    expect((await service().list(params({ status: "all" }))).items).toHaveLength(6);
  });

  it("region은 소스 키의 uprCd로, 없으면 all", async () => {
    const source = fakeSource();
    await service(source).list(params({ region: "6260000" }));
    await service(source).list(params());
    expect(source.list).toHaveBeenNthCalledWith(1, { species: "cat", uprCd: "6260000" });
    expect(source.list).toHaveBeenNthCalledWith(2, { species: "cat", uprCd: "all" });
  });

  it("district는 소스 키의 orgCd로 전달한다", async () => {
    const source = fakeSource();
    await service(source).list(params({ region: "6110000", district: "3000000" }));
    expect(source.list).toHaveBeenCalledWith({ species: "cat", uprCd: "6110000", orgCd: "3000000" });
  });
});

describe("list: 정렬", () => {
  it("latest: noticeSdt 내림차순, 동률이면 updTm 내림차순", async () => {
    expect(ids(await service().list(params({ status: "all" })))).toEqual([
      ID.dog, // 0921 13:18
      ID.sexQ, // 0921 12:44
      ID.twoBrackets, // 0921 11:35
      ID.protectedCat, // 0921 11:29
      ID.optionalSfe, // 0921 11:08
      ID.ended, // 0908
    ]);
  });

  it("endingSoon: 미만료는 noticeEdt 오름차순(동률은 desertionNo 오름차순), 만료는 뒤로", async () => {
    expect(ids(await service().list(params({ status: "all", sort: "endingSoon" })))).toEqual([
      ID.sexQ, // 0928
      ID.optionalSfe, // 1001, 445...
      ID.twoBrackets, // 1001, 448...
      ID.protectedCat, // 1001, 450...
      ID.dog, // 1006
      ID.ended, // 0918, 오늘(0921)보다 이전
    ]);
  });

  describe("endingSoon: 만료/미만료가 섞인 입력", () => {
    const at = (id: string, noticeEdt: string): MappedAnimal => ({
      ...mapped[0],
      wire: { ...mapped[0].wire, id },
      sortKeys: { ...mapped[0].sortKeys, noticeEdt },
    });
    const mixed = [
      at("1", "20260915"), // 만료
      at("2", "20260925"),
      at("3", "20260921"), // 당일 → 미만료
      at("4", "20260920"), // 만료(어제)
      at("5", "20260930"),
      at("6", "20260910"), // 만료
      at("7", "20260925"), // 2와 동률
      at("8", ""), // 날짜 형식 아님
    ];
    const run = (now: Date) =>
      service(fakeSource(mixed), 20, now)
        .list(params({ status: "all", sort: "endingSoon" }))
        .then(ids);

    it("미만료 오름차순 → 만료 내림차순 → 날짜 없음, 당일은 미만료", async () => {
      expect(await run(NOW)).toEqual(["3", "2", "7", "5", "4", "1", "6", "8"]);
    });

    it("KST 자정 직전과 직후로 결과가 바뀐다(UTC가 아니라 KST 기준)", async () => {
      // 2026-09-21 23:59 KST = 14:59Z → 오늘은 0921
      expect(await run(new Date("2026-09-21T14:59:00Z"))).toEqual(["3", "2", "7", "5", "4", "1", "6", "8"]);
      // 2026-09-22 00:01 KST = 15:01Z → 0921도 만료
      expect(await run(new Date("2026-09-21T15:01:00Z"))).toEqual(["2", "7", "5", "3", "4", "1", "6", "8"]);
    });

    it("기준 시각을 옮기면 만료 경계가 옮겨진다", async () => {
      expect(await run(new Date("2026-09-10T12:00:00+09:00"))).toEqual(["6", "1", "4", "3", "2", "7", "5", "8"]);
      expect(await run(new Date("2026-10-01T12:00:00+09:00"))).toEqual(["5", "2", "7", "3", "4", "1", "6", "8"]);
    });

    it("latest는 기준 시각과 무관하다", async () => {
      const latest = (now: Date) =>
        service(fakeSource(mapped), 20, now).list(params({ status: "all" })).then(ids);
      expect(await latest(new Date("2030-01-01T00:00:00Z"))).toEqual(await latest(NOW));
    });
  });

  it("입력 순서와 무관하게 결과가 같다", async () => {
    const reversed = [...mapped].reverse();
    const a = await service(fakeSource(reversed)).list(params({ status: "all" }));
    const b = await service().list(params({ status: "all" }));
    expect(ids(a)).toEqual(ids(b));
  });
});

describe("list: 커서", () => {
  it("커서를 따라가면 전체를 중복 없이 순서대로 받고, 마지막은 nextCursor null", async () => {
    const svc = service(fakeSource(), 4);
    const first = await svc.list(params({ status: "all" }));
    expect(first.items).toHaveLength(4);
    expect(first.nextCursor).not.toBeNull();

    const second = await svc.list(params({ status: "all", cursor: first.nextCursor! }));
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();

    const full = await service().list(params({ status: "all" }));
    expect([...ids(first), ...ids(second)]).toEqual(ids(full));
  });

  it("정확히 나눠떨어지는 마지막 페이지도 nextCursor null", async () => {
    const svc = service(fakeSource(), 3);
    const first = await svc.list(params({ status: "all" }));
    const second = await svc.list(params({ status: "all", cursor: first.nextCursor! }));
    expect(second.items).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
  });

  it("범위를 넘는 커서는 빈 목록", async () => {
    const result = await service().list(params({ cursor: encodeCursor(100) }));
    expect(result).toEqual({ items: [], nextCursor: null });
  });

  it.each(["", "!!!", "abc", encodeCursor(1) + "x", Buffer.from("-1").toString("base64url"), Buffer.from("1.5").toString("base64url")])(
    "잘못된 커서 %j → InvalidRequestError",
    async (cursor) => {
      await expect(service().list(params({ cursor }))).rejects.toBeInstanceOf(InvalidRequestError);
    },
  );

  it("encode/decode 왕복", () => {
    for (const offset of [0, 20, 12345]) expect(decodeCursor(encodeCursor(offset))).toBe(offset);
  });
});

describe("응답 계약", () => {
  it("계약 스키마를 통과하고 sortKeys, 연락처, 종료 사유가 없다", async () => {
    const result = await service().list(params({ status: "all" }));
    expect(AnimalListResponseSchema.parse(result)).toEqual(result);
    const serialized = JSON.stringify(result);
    for (const key of ["sortKeys", "noticeSdt", "updTm", "careTel", "careAddr", "careOwnerNm", "endReason"]) {
      expect(serialized).not.toContain(key);
    }
    for (const dto of dtos) {
      expect(serialized).not.toContain(dto.careTel!);
      if (dto.endReason) expect(serialized).not.toContain(dto.endReason);
    }
  });
});

describe("getById", () => {
  it("있으면 WireDto", async () => {
    await expect(service().getById(ID.dog)).resolves.toMatchObject({ id: ID.dog, species: "dog" });
  });

  it("없으면 NotFoundError", async () => {
    await expect(service().getById("1")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getByIds", () => {
  it("입력 순서를 유지하고 못 찾은 id는 조용히 제외한다", async () => {
    const result = await service().getByIds([ID.dog, "000", ID.ended, "111", ID.sexQ]);
    expect(ids({ items: result })).toEqual([ID.dog, ID.ended, ID.sexQ]);
  });

  it("중복 id는 한 번만 조회한다", async () => {
    const source = fakeSource();
    const result = await service(source).getByIds([ID.dog, ID.dog, ID.sexQ]);
    expect(ids({ items: result })).toEqual([ID.dog, ID.sexQ]);
    expect(source.getById).toHaveBeenCalledTimes(2);
  });

  it("동시 조회 수를 넘지 않는다", async () => {
    let running = 0;
    let peak = 0;
    const source: AnimalSource = {
      list: vi.fn(),
      getById: vi.fn(async (id: string) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 1));
        running -= 1;
        return mapped.find((m) => m.wire.id === id) ?? null;
      }),
    };
    await service(source).getByIds(mapped.map((m) => m.wire.id));
    expect(peak).toBe(2);
  });

  it("조회 중 업스트림 오류는 전체 실패로 전달한다", async () => {
    const source: AnimalSource = { list: vi.fn(), getById: vi.fn(async () => Promise.reject(new Error("boom"))) };
    await expect(service(source).getByIds([ID.dog])).rejects.toThrow("boom");
  });
});
