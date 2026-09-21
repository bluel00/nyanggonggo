import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("mapWithConcurrency", () => {
  it("입력 순서대로 결과를 돌려주고 동시 실행 수를 넘지 않는다", async () => {
    let running = 0;
    let peak = 0;
    const result = await mapWithConcurrency([5, 1, 3, 2, 4], 2, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(n);
      running -= 1;
      return n * 10;
    });
    expect(result).toEqual([50, 10, 30, 20, 40]);
    expect(peak).toBe(2);
  });

  it("빈 입력은 빈 결과", async () => {
    await expect(mapWithConcurrency([], 3, async () => 1)).resolves.toEqual([]);
  });

  it("하나라도 실패하면 전체가 실패한다", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("fail");
        return n;
      }),
    ).rejects.toThrow("fail");
  });
});
