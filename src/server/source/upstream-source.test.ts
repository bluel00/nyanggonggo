import { describe, expect, it, vi } from "vitest";
import fixture from "../../../docs/fixtures/upstream-items.json";
import type { UpstreamClient } from "../upstream/client";
import { UpstreamAnimalItemSchema } from "../upstream/dto";
import { createUpstreamAnimalSource } from "./upstream-source";

const dtos = fixture.items.map((item) => UpstreamAnimalItemSchema.parse(item));

const fakeUpstream = (overrides: Partial<UpstreamClient> = {}): UpstreamClient => ({
  fetchAll: vi.fn(async () => dtos),
  fetchByDesertionNo: vi.fn(async (id: string) => dtos.find((d) => d.desertionNo === id) ?? null),
  ...overrides,
});

describe("createUpstreamAnimalSource", () => {
  it("list: 전체 수집 결과를 Mapper로 변환한다", async () => {
    const upstream = fakeUpstream();
    const result = await createUpstreamAnimalSource(upstream).list({ species: "cat", uprCd: "all" });
    expect(result.map((r) => r.wire.id)).toEqual(dtos.map((d) => d.desertionNo));
    expect(result[0].sortKeys).toEqual({ noticeSdt: "20260921", noticeEdt: "20261001", updTm: "2026-09-21 11:29:37.0" });
  });

  it("list: uprCd 'all'은 upr_cd 없이, 코드는 그대로 전달한다", async () => {
    const upstream = fakeUpstream();
    const source = createUpstreamAnimalSource(upstream);
    await source.list({ species: "cat", uprCd: "all" });
    await source.list({ species: "dog", uprCd: "6260000" });
    expect(upstream.fetchAll).toHaveBeenNthCalledWith(1, { species: "cat", uprCd: undefined });
    expect(upstream.fetchAll).toHaveBeenNthCalledWith(2, { species: "dog", uprCd: "6260000" });
  });

  it("list: orgCd는 시도가 있을 때만 전달하고, 시도 전체(all)에는 붙이지 않는다", async () => {
    const upstream = fakeUpstream();
    const source = createUpstreamAnimalSource(upstream);
    await source.list({ species: "cat", uprCd: "6110000", orgCd: "3000000" });
    await source.list({ species: "cat", uprCd: "all", orgCd: "3000000" });
    expect(upstream.fetchAll).toHaveBeenNthCalledWith(1, { species: "cat", uprCd: "6110000", orgCd: "3000000" });
    expect(upstream.fetchAll).toHaveBeenNthCalledWith(2, { species: "cat", uprCd: undefined });
  });

  it("list: species를 판정할 수 없는 item은 빼고 로그를 남긴다", async () => {
    const logger = { warn: vi.fn() };
    const upstream = fakeUpstream({
      fetchAll: vi.fn(async () => [{ ...dtos[0], upKindNm: "기타축종" }, dtos[1]]),
    });
    const result = await createUpstreamAnimalSource(upstream, logger).list({ species: "cat", uprCd: "all" });
    expect(result.map((r) => r.wire.id)).toEqual([dtos[1].desertionNo]);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("getById: 있으면 변환, 없으면 null", async () => {
    const source = createUpstreamAnimalSource(fakeUpstream());
    expect((await source.getById(dtos[2].desertionNo))?.wire.id).toBe(dtos[2].desertionNo);
    expect(await source.getById("000")).toBeNull();
  });
});
