import { beforeEach, describe, expect, it } from "vitest";
import type { UpstreamPageCache } from "../upstream/client";
import { createRequestPerf, resetColdFlagForTest, type RequestPerfOptions } from "./request-perf";

/** 부를 때마다 정해진 시각을 돌려주는 시계. 시각은 테스트가 clock.t로 옮긴다 */
function setup(extra: RequestPerfOptions = {}) {
  const clock = { t: 0 };
  const lines: string[] = [];
  const options: RequestPerfOptions = { now: () => clock.t, uptimeMs: () => 1234.4, write: (l) => lines.push(l), ...extra };
  return { clock, lines, options };
}

/** unstable_cache 흉내: 있으면 load를 부르지 않고, 없으면 load를 기다려 저장한다 */
function memoryCache(clock: { t: number }, loadMs: number): UpstreamPageCache {
  const store = new Map<string, unknown>();
  return async <T,>(key: string, load: () => Promise<T>) => {
    if (store.has(key)) return store.get(key) as T;
    const value = await load();
    clock.t += loadMs;
    store.set(key, value);
    return value;
  };
}

beforeEach(() => resetColdFlagForTest());

describe("createRequestPerf(요청 단위 계측, architecture.md 12절 52)", () => {
  it("모듈의 첫 요청만 cold", () => {
    const { options } = setup();
    expect(createRequestPerf("list", options).finish().cold).toBe(true);
    expect(createRequestPerf("list", options).finish().cold).toBe(false);
  });

  it("업스트림 페이지 시간, 캐시 miss/hit, 사진 크기, 전체 시간을 JSON 한 줄로 남긴다", async () => {
    const { clock, lines, options } = setup({ id: "441403202600232" });
    const perf = createRequestPerf("detail", options);
    const cache = perf.observePageCache(memoryCache(clock, 40));
    clock.t = 5;
    await cache("a", async () => 1);
    await perf.measureImageSize(async (onResult) => {
      clock.t += 12;
      onResult("miss");
      return null;
    });
    clock.t += 3;
    perf.finish({ ok: true });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      perf: "detail",
      id: "441403202600232",
      cold: true,
      uptimeMs: 1234,
      upstreamMs: 40,
      upstreamCache: "miss",
      upstreamPages: 1,
      upstreamMisses: 1,
      imageSizeMs: 12,
      imageSize: "miss",
      totalMs: 60,
      ok: true,
    });
  });

  it("여러 페이지는 첫 시작부터 마지막 끝까지이고, 하나라도 miss면 miss", async () => {
    const { clock, options } = setup();
    const perf = createRequestPerf("list", options);
    const base = memoryCache(clock, 10);
    await base("p1", async () => 1);
    const cache = perf.observePageCache(base);
    await cache("p1", async () => 1);
    await cache("p2", async () => 2);
    expect(perf.finish({ status: 200 })).toMatchObject({ upstreamMs: 10, upstreamCache: "miss", upstreamPages: 2, upstreamMisses: 1 });
  });

  it("모두 캐시에 있으면 hit", async () => {
    const { clock, options } = setup();
    const base = memoryCache(clock, 10);
    await base("p1", async () => 1);
    const perf = createRequestPerf("list", options);
    await perf.observePageCache(base)("p1", async () => 1);
    expect(perf.finish()).toMatchObject({ upstreamCache: "hit", upstreamMisses: 0 });
  });

  it("만료된 값을 바로 주고 load를 기다리지 않으면 stale", async () => {
    const { options } = setup();
    const perf = createRequestPerf("list", options);
    const staleCache: UpstreamPageCache = async <T,>(_key: string, load: () => Promise<T>) => {
      void load().catch(() => {});
      return 1 as T;
    };
    await perf.observePageCache(staleCache)("p1", () => new Promise(() => {}));
    expect(perf.finish()).toMatchObject({ upstreamCache: "stale", upstreamMisses: 0 });
  });

  it("업스트림이 실패해도 시간과 miss를 남긴다", async () => {
    const { clock, options } = setup();
    const perf = createRequestPerf("list", options);
    const cache = perf.observePageCache(memoryCache(clock, 10));
    await expect(cache("p1", async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(perf.finish({ status: 502 })).toMatchObject({ upstreamCache: "miss", status: 502 });
  });

  it("업스트림·사진 요청이 없으면 그 필드를 넣지 않고, 사진이 없으면 skip", () => {
    const { options } = setup();
    const perf = createRequestPerf("detail", options);
    perf.skipImageSize();
    const record = perf.finish({ ok: false });
    expect(record).not.toHaveProperty("upstreamMs");
    expect(record).toMatchObject({ imageSize: "skip", imageSizeMs: 0 });
  });

  it("finish는 로그를 한 번만 남긴다", () => {
    const { lines, options } = setup();
    const perf = createRequestPerf("list", options);
    perf.finish();
    perf.finish();
    expect(lines).toHaveLength(1);
  });

  it("Server-Timing 값", async () => {
    const { clock, options } = setup();
    const perf = createRequestPerf("list", options);
    await perf.observePageCache(memoryCache(clock, 25))("p1", async () => 1);
    perf.finish();
    expect(perf.serverTiming()).toBe('upstream;dur=25;desc="miss", total;dur=25, cold');
  });
});
