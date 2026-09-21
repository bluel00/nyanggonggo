import { describe, expect, it, vi } from "vitest";
import fixture from "../../../docs/fixtures/upstream-items.json";
import { parseUpstreamItems } from "./parse";

describe("parseUpstreamItems", () => {
  it("정상 5건 + 필수 필드 없는 1건 → 5건 반환, skippedCount 1", () => {
    const logger = { warn: vi.fn() };
    const [broken, ...valid] = fixture.items;
    const { processState: _omitted, ...missingRequired } = broken;

    const result = parseUpstreamItems([missingRequired, ...valid], logger);

    expect(result.items).toHaveLength(5);
    expect(result.items.map((i) => i.desertionNo)).toEqual(valid.map((i) => i.desertionNo));
    expect(result.skippedCount).toBe(1);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0][1]).toEqual({
      desertionNo: broken.desertionNo,
      issues: ["processState"],
    });
  });

  it("객체가 아니거나 desertionNo를 읽을 수 없는 item도 건너뛴다", () => {
    const logger = { warn: vi.fn() };
    const result = parseUpstreamItems([null, "x", { desertionNo: 1 }], logger);
    expect(result).toEqual({ items: [], skippedCount: 3 });
    for (const [, context] of logger.warn.mock.calls) {
      expect(context.desertionNo).toBeNull();
    }
  });

  it("로그에 item의 값(연락처 등)을 넣지 않는다", () => {
    const logger = { warn: vi.fn() };
    const { orgNm: _o, ...broken } = fixture.items[0];
    parseUpstreamItems([broken], logger);
    const serialized = JSON.stringify(logger.warn.mock.calls);
    expect(serialized).not.toContain(broken.careTel);
    expect(serialized).not.toContain(broken.careAddr.trim());
  });
});
