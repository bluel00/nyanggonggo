/**
 * Route Handler 통합 테스트. 네트워크를 쓰지 않도록 전역 fetch를 가짜로 바꾸고,
 * 서비스키는 가짜 값만 쓴다. 업스트림 래퍼는 합성 데이터다(architecture.md 12절 2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getById } from "@/app/api/animals/[id]/route";
import { GET as getByIds } from "@/app/api/animals/by-ids/route";
import { GET as getList } from "@/app/api/animals/route";
import fixture from "../../docs/fixtures/upstream-items.json";

// 업스트림 페이지 캐시(unstable_cache)는 Next 런타임 밖에서 쓸 수 없다. 여기서는 캐시 없이 매번 부르게 한다
// (테스트마다 가짜 업스트림 응답이 다르다). 캐시 동작 자체는 src/server/upstream/client.test.ts가 본다.
vi.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>) => load }));

const FAKE_KEY = "test-key-route-123";

function upstreamBody(items: unknown[]) {
  return { response: { header: { resultCode: "00" }, body: { items: { item: items }, totalCount: items.length } } };
}

async function fixtureUpstream(input: string | URL | Request) {
  const url = new URL(String(input));
  const id = url.searchParams.get("desertion_no");
  const items = id ? fixture.items.filter((i) => i.desertionNo === id) : fixture.items;
  return Response.json(upstreamBody(items));
}

const upstreamFetch = vi.fn(fixtureUpstream);

/** 이 desertion_no들의 단건 조회만 업스트림 500 */
function failUpstreamFor(ids: string[]) {
  upstreamFetch.mockImplementation(async (input) => {
    const id = new URL(String(input)).searchParams.get("desertion_no");
    return id && ids.includes(id) ? new Response("oops", { status: 500 }) : fixtureUpstream(input);
  });
}

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

const req = (path: string) => new Request(`http://localhost${path}`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/animals", () => {
  it("계측: 요청마다 JSON 한 줄을 남기고 Server-Timing 헤더를 붙인다(키·URL 없음, 12절 52)", async () => {
    const response = await getList(req("/api/animals?species=dog"));
    expect(response.headers.get("Server-Timing")).toMatch(/upstream;dur=\d+;desc="(hit|stale|miss)", total;dur=\d+/);
    const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).filter((l) => l.includes("\"perf\""));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ perf: "list", upstreamCache: "miss", upstreamPages: 1, status: 200 });
    expect(lines[0]).not.toContain(FAKE_KEY);
    expect(lines[0]).not.toContain("data.go.kr");
  });

  it("계측: 오류 응답에도 Server-Timing을 붙인다", async () => {
    const response = await getList(req("/api/animals?species=bird"));
    expect(response.status).toBe(400);
    expect(response.headers.get("Server-Timing")).toMatch(/total;dur=\d+/);
  });

  it("기본값(cat, protected, latest)으로 목록을 돌려준다", async () => {
    const response = await getList(req("/api/animals"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage");
    const body = await response.json();
    expect(body.items).toHaveLength(5);
    expect(body.nextCursor).toBeNull();
    expect(new URL(String(upstreamFetch.mock.calls[0][0])).searchParams.get("upkind")).toBe("422400");
  });

  it("응답에 담당자 이름, 종료 사유, sortKeys가 없다", async () => {
    const text = await (await getList(req("/api/animals?status=all"))).text();
    for (const key of ["careTel", "careAddr", "careOwnerNm", "endReason", "sortKeys"]) {
      expect(text).not.toContain(key);
    }
    for (const item of fixture.items) {
      // careOwnerNm은 orgNm(regionText로 공개)과 같은 값일 수 있다(픽스처 1: 제주특별자치도).
      if (item.careOwnerNm !== item.orgNm) expect(text).not.toContain(item.careOwnerNm);
      if (item.endReason) expect(text).not.toContain(item.endReason);
    }
  });

  it("잘못된 파라미터는 400", async () => {
    const response = await getList(req("/api/animals?status=notice"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("region과 district를 upr_cd, org_cd로 전달한다. district만 있으면 400", async () => {
    await getList(req("/api/animals?region=6110000&district=3000000"));
    const url = new URL(String(upstreamFetch.mock.calls[0][0]));
    expect(url.searchParams.get("upr_cd")).toBe("6110000");
    expect(url.searchParams.get("org_cd")).toBe("3000000");
    expect((await getList(req("/api/animals?district=3000000"))).status).toBe(400);
  });

  it("잘못된 커서는 400", async () => {
    expect((await getList(req("/api/animals?cursor=!!"))).status).toBe(400);
  });

  it("업스트림이 XML(인증 오류 등)을 주면 502이고 본문과 키를 노출하지 않는다", async () => {
    upstreamFetch.mockImplementationOnce(async () => new Response(`<error>${FAKE_KEY}</error>`));
    const response = await getList(req("/api/animals"));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain("<error>");
    // 서버 로그에도 키가 없다
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(FAKE_KEY);
  });

  it("업스트림 403 인증 오류는 502이고, 서버 로그에는 코드와 errMsg만 있고 키가 없다", async () => {
    const body = JSON.stringify({
      OpenAPI_ServiceResponse: {
        cmmMsgHeader: { errMsg: "SERVICE ERROR", returnAuthMsg: `MSG ${FAKE_KEY}`, returnReasonCode: "30" },
      },
    });
    upstreamFetch.mockImplementationOnce(async () => new Response(body, { status: 403 }));
    const response = await getList(req("/api/animals"));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("upstream_error");
    const calls = vi.mocked(console.warn).mock.calls;
    const authLog = calls.find(([message]) => String(message).includes("upstream auth/config error"));
    expect(authLog?.[1]).toMatchObject({ returnReasonCode: "30", errMsg: "SERVICE ERROR" });
    const logs = JSON.stringify(calls);
    expect(logs).not.toContain(FAKE_KEY);
    expect(logs).not.toContain("serviceKey");
  });

  it("서비스키가 없으면 500이고 설정 상세를 노출하지 않는다", async () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "");
    const response = await getList(req("/api/animals"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("DATA_GO_KR");
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
});

describe("GET /api/animals/[id]", () => {
  it("있으면 200", async () => {
    const response = await getById(req("/api/animals/448539202600280"), ctx("448539202600280"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "448539202600280", species: "dog" });
  });

  it("없으면 404, 형식이 틀리면 400", async () => {
    expect((await getById(req("/api/animals/1"), ctx("1"))).status).toBe(404);
    expect((await getById(req("/api/animals/abc"), ctx("abc"))).status).toBe(400);
  });
});

describe("GET /api/animals/by-ids", () => {
  it("입력 순서를 유지하고 못 찾은 id는 뺀다", async () => {
    const response = await getByIds(req("/api/animals/by-ids?ids=448539202600280,1,427346202600847"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["448539202600280", "427346202600847"]);
    expect(body.failedIds).toEqual([]);
    expect(response.headers.get("Cache-Control")).not.toBe("no-store");
  });

  it("일부 id만 업스트림 오류면 200으로 나머지와 failedIds를 주고 캐시하지 않는다(이슈 #5)", async () => {
    failUpstreamFor(["427346202600847"]);
    const response = await getByIds(req("/api/animals/by-ids?ids=448539202600280,1,427346202600847"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["448539202600280"]);
    expect(body.failedIds).toEqual(["427346202600847"]);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("모든 id가 업스트림 오류면 지금처럼 502", async () => {
    failUpstreamFor(["448539202600280", "427346202600847"]);
    const response = await getByIds(req("/api/animals/by-ids?ids=448539202600280,427346202600847"));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("upstream_error");
  });

  it("ids가 없거나 51개 이상이면 400", async () => {
    expect((await getByIds(req("/api/animals/by-ids"))).status).toBe(400);
    const many = Array.from({ length: 51 }, (_, i) => String(i + 1)).join(",");
    expect((await getByIds(req(`/api/animals/by-ids?ids=${many}`))).status).toBe(400);
  });
});
