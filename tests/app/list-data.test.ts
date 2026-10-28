/**
 * app/list-data.ts: 목록 첫 페이지(서버, #109)가 /api/animals와 같은 경로·같은 모양인지, 실패하면 페이지를 깨지 않고 실패만 알리는지.
 * 네트워크를 쓰지 않도록 전역 fetch를 가짜로 바꾸고 서비스키는 가짜 값만 쓴다. 업스트림 래퍼는 합성 데이터다(tests/api/animals-routes.test.ts와 같다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getList } from "@/app/api/animals/route";
import { loadFirstListPage } from "@/app/list-data";
import { toAnimalListQuery, type AnimalListFilter } from "@/entities/animal";
import fixture from "../../docs/fixtures/upstream-items.json";

// 업스트림 페이지 캐시(unstable_cache)는 Next 런타임 밖에서 쓸 수 없어 매번 부르게 한다
vi.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>) => load }));

const FAKE_KEY = "test-key-list-data-123";

async function fixtureUpstream(input: string | URL | Request) {
  void input;
  return Response.json({ response: { header: { resultCode: "00" }, body: { items: { item: fixture.items }, totalCount: fixture.items.length } } });
}

const upstreamFetch = vi.fn(fixtureUpstream);

beforeEach(() => {
  vi.stubEnv("DATA_GO_KR_SERVICE_KEY", FAKE_KEY);
  vi.stubGlobal("fetch", upstreamFetch);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  upstreamFetch.mockClear();
  upstreamFetch.mockImplementation(fixtureUpstream);
});

const FILTERS: AnimalListFilter[] = [
  { species: "cat", region: "6110000", status: "protected", sex: "all", sort: "latest" },
  { species: "dog", status: "all", sex: "female", sort: "deadline" },
];

describe("loadFirstListPage", () => {
  it.each(FILTERS)("같은 필터의 /api/animals 응답과 같다(필드를 더하지 않는다): %o", async (filter) => {
    const fromApi = await (await getList(new Request(`http://localhost/api/animals?${toAnimalListQuery(filter)}`))).json();
    const first = await loadFirstListPage(filter);
    expect(first).toEqual({ ok: true, response: fromApi });
  });

  it("필터 값이 업스트림 요청에 그대로 간다(축종·지역)", async () => {
    await loadFirstListPage(FILTERS[0]!);
    const url = new URL(String(upstreamFetch.mock.calls[0]![0]));
    expect(url.searchParams.get("upkind")).toBe("422400");
    expect(url.searchParams.get("upr_cd")).toBe("6110000");
  });

  it("업스트림이 실패하면 예외 없이 { ok: false }이고 원인은 로그에만 남는다(키 없음)", async () => {
    upstreamFetch.mockImplementation(async () => new Response("oops", { status: 500 }));
    await expect(loadFirstListPage(FILTERS[0]!)).resolves.toEqual({ ok: false });
    const warned = vi.mocked(console.warn).mock.calls.map((call) => JSON.stringify(call));
    expect(warned.some((line) => line.includes("upstream failure"))).toBe(true);
    expect(warned.join("")).not.toContain(FAKE_KEY);
  });

  it("계측 줄을 하나 남긴다(목록 API와 같은 list)", async () => {
    await loadFirstListPage(FILTERS[0]!);
    const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).filter((l) => l.includes("\"perf\""));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ perf: "list", status: 200 });
  });
});
