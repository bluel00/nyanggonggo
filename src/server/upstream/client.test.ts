/**
 * 가짜 fetch로만 검증한다. 응답 래퍼는 합성 데이터이며 검증된 실제 응답이 아니다(architecture.md 12절 2).
 */
import { describe, expect, it, vi } from "vitest";
import { createHttpClient, type FetchLike } from "@/shared/api/http-client";
import fixture from "../../../docs/fixtures/upstream-items.json";
import wrapperFixture from "../../../docs/fixtures/upstream-wrapper.json";
import {
  createUpstreamClient,
  UPSTREAM_ENDPOINT,
  UpstreamError,
  type UpstreamClientOptions,
  type UpstreamPageCache,
} from "./client";

const FAKE_KEY = "test-key-a+b/c==";
const items = fixture.items;

const page = (pageItems: unknown[], totalCount: unknown = items.length) => ({
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: { items: pageItems.length ? { item: pageItems } : "", totalCount, pageNo: 1 },
  },
});

/** pageNo에 따라 pageSize씩 잘라 주는 가짜 업스트림 */
function fakeUpstream(all: unknown[], pageSize: number, totalCount: unknown = all.length) {
  return vi.fn<FetchLike>(async (input) => {
    const pageNo = Number(new URL(input).searchParams.get("pageNo"));
    const slice = all.slice((pageNo - 1) * pageSize, pageNo * pageSize);
    return Response.json(page(slice, totalCount));
  });
}

function client(fetch: FetchLike, overrides: Partial<UpstreamClientOptions> = {}) {
  return createUpstreamClient({
    http: createHttpClient({ fetch }),
    serviceKey: FAKE_KEY,
    timeoutMs: 1000,
    pageSize: 2,
    concurrency: 3,
    maxPages: 10,
    ...overrides,
  });
}

const requestedUrls = (fetch: ReturnType<typeof fakeUpstream>) =>
  fetch.mock.calls.map(([input]) => new URL(input));

describe("upstream client fetchAll", () => {
  it("totalCount에 도달할 때까지 페이지를 순회한다", async () => {
    const fetch = fakeUpstream(items, 2);
    const result = await client(fetch).fetchAll({ species: "cat" });
    expect(result.map((i) => i.desertionNo)).toEqual(items.map((i) => i.desertionNo));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("totalCount가 없으면 빈 페이지에서 멈춘다", async () => {
    const fetch = fakeUpstream(items, 4, null);
    const result = await client(fetch, { pageSize: 4 }).fetchAll({ species: "cat" });
    expect(result).toHaveLength(6);
    expect(fetch).toHaveBeenCalledTimes(3); // 4 + 2 + 빈 페이지
  });

  it("최대 페이지 수에서 멈추고 로그를 남긴다", async () => {
    const logger = { warn: vi.fn() };
    // totalCount가 실제보다 커서 끝나지 않는 상황
    const endless = vi.fn<FetchLike>(async () => Response.json(page([items[0]], 999_999)));
    const result = await client(endless, { maxPages: 3, logger }).fetchAll({ species: "cat" });
    expect(endless).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(logger.warn).toHaveBeenCalledWith(
      "upstream max pages reached, list truncated",
      expect.objectContaining({ maxPages: 3 }),
    );
  });

  describe("병렬 페이지 수집", () => {
    // 12건(6페이지)을 만든다. desertionNo만 바꾼 합성 데이터
    const twelve = Array.from({ length: 12 }, (_, n) => ({
      ...items[n % items.length],
      desertionNo: String(900000000000000 + n),
    }));

    function tracedUpstream(totalCount: unknown, failPage?: number) {
      const events: string[] = [];
      let running = 0;
      let peak = 0;
      const fetch = vi.fn<FetchLike>(async (input) => {
        const pageNo = Number(new URL(input).searchParams.get("pageNo"));
        events.push(`start:${pageNo}`);
        running += 1;
        if (pageNo > 1) peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, pageNo === 1 ? 5 : 2 + (pageNo % 3)));
        running -= 1;
        events.push(`end:${pageNo}`);
        if (pageNo === failPage) return new Response("Bad Gateway", { status: 502 });
        return Response.json(page(twelve.slice((pageNo - 1) * 2, pageNo * 2), totalCount));
      });
      return { fetch, events, peak: () => peak };
    }

    it("6페이지: 첫 호출이 먼저 끝나고, 나머지는 동시성 상한(3) 이내로 나간다", async () => {
      const { fetch, events, peak } = tracedUpstream(12);
      const result = await client(fetch, { pageSize: 2, concurrency: 3 }).fetchAll({ species: "cat" });

      expect(fetch).toHaveBeenCalledTimes(6);
      expect(events.slice(0, 2)).toEqual(["start:1", "end:1"]);
      expect(peak()).toBe(3);
      // 결과는 페이지 순서를 유지한다
      expect(result.map((i) => i.desertionNo)).toEqual(twelve.map((i) => i.desertionNo));
      const pageNos = fetch.mock.calls.map(([input]) => new URL(input).searchParams.get("pageNo"));
      expect([...pageNos].sort()).toEqual(["1", "2", "3", "4", "5", "6"]);
    });

    it("totalCount가 문자열이어도 페이지 수를 계산한다", async () => {
      const { fetch } = tracedUpstream("12");
      const result = await client(fetch, { pageSize: 2 }).fetchAll({ species: "cat" });
      expect(fetch).toHaveBeenCalledTimes(6);
      expect(result).toHaveLength(12);
    });

    it("중간 페이지가 실패하면 전체가 실패한다", async () => {
      const { fetch } = tracedUpstream(12, 4);
      await expect(client(fetch, { pageSize: 2 }).fetchAll({ species: "cat" })).rejects.toBeInstanceOf(
        UpstreamError,
      );
    });

    it("첫 페이지가 비면 추가 호출이 없다", async () => {
      const fetch = vi.fn<FetchLike>(async () => Response.json(page([], 0)));
      await expect(client(fetch).fetchAll({ species: "cat" })).resolves.toEqual([]);
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  it("요청 URL: _type=json, upkind, numOfRows, pageNo가 있고 state는 없다", async () => {
    const fetch = fakeUpstream(items, 2);
    await client(fetch).fetchAll({ species: "dog", uprCd: "6260000" });
    const [url] = requestedUrls(fetch);
    expect(`${url.origin}${url.pathname}`).toBe(UPSTREAM_ENDPOINT);
    expect(url.searchParams.get("_type")).toBe("json");
    expect(url.searchParams.get("upkind")).toBe("417000");
    expect(url.searchParams.get("upr_cd")).toBe("6260000");
    expect(url.searchParams.get("numOfRows")).toBe("2");
    expect(url.searchParams.get("pageNo")).toBe("1");
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("org_cd: 시도와 함께면 보내고, 시도 없이 오면 보내지 않는다", async () => {
    const fetch = fakeUpstream(items, 10);
    // 한 번에 1페이지로 끝나도록 pageSize를 넉넉히 둔다
    await client(fetch, { pageSize: 10 }).fetchAll({ species: "cat", uprCd: "6110000", orgCd: "3000000" });
    await client(fetch, { pageSize: 10 }).fetchAll({ species: "cat", orgCd: "3000000" });
    const [withSido, withoutSido] = requestedUrls(fetch);
    expect(withSido.searchParams.get("upr_cd")).toBe("6110000");
    expect(withSido.searchParams.get("org_cd")).toBe("3000000");
    expect(withoutSido.searchParams.has("org_cd")).toBe(false);
  });

  it("upr_cd가 없으면 파라미터를 보내지 않고, cat은 upkind 422400", async () => {
    const fetch = fakeUpstream(items, 10);
    await client(fetch).fetchAll({ species: "cat" });
    const [url] = requestedUrls(fetch);
    expect(url.searchParams.has("upr_cd")).toBe(false);
    expect(url.searchParams.get("upkind")).toBe("422400");
  });

  it("other는 upkind 429900(기타 축종)", async () => {
    const fetch = fakeUpstream(items, 10);
    await client(fetch).fetchAll({ species: "other" });
    expect(requestedUrls(fetch)[0].searchParams.get("upkind")).toBe("429900");
  });

  it("서비스키는 URLSearchParams로 한 번만 인코딩된다", async () => {
    const fetch = fakeUpstream(items, 10);
    await client(fetch).fetchAll({ species: "cat" });
    const raw = fetch.mock.calls[0][0];
    expect(raw).toContain("serviceKey=test-key-a%2Bb%2Fc%3D%3D");
    expect(raw).not.toContain("%25"); // 이중 인코딩 없음
    expect(new URL(raw).searchParams.get("serviceKey")).toBe(FAKE_KEY);
  });

  it("원본 응답은 캐시하지 않는다(fetch no-store, Next revalidate 없음)", async () => {
    const fetch = fakeUpstream(items, 10);
    await client(fetch).fetchAll({ species: "cat" });
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(fetch.mock.calls[0][1]).not.toHaveProperty("next");
  });

  it("필수 필드가 없는 item은 건너뛰고 나머지를 돌려준다", async () => {
    const { desertionNo: _d, ...broken } = items[0];
    const fetch = fakeUpstream([broken, ...items.slice(1)], 10);
    const result = await client(fetch).fetchAll({ species: "cat" });
    expect(result).toHaveLength(5);
  });
});

describe("upstream client 오류", () => {
  async function failure(fetch: FetchLike) {
    try {
      await client(fetch).fetchAll({ species: "cat" });
    } catch (error) {
      return error as UpstreamError;
    }
    throw new Error("expected rejection");
  }

  it("JSON이 아닌 응답(XML 등)은 failed, 본문은 200자 이하이고 키가 가려진다", async () => {
    const xml = `<OpenAPI_ServiceResponse><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><echo>${FAKE_KEY}</echo>${"x".repeat(300)}</OpenAPI_ServiceResponse>`;
    const error = await failure(async () => new Response(xml, { status: 200 }));
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.reason).toBe("failed");
    const snippet = error.detail.bodySnippet as string;
    expect(snippet.length).toBeLessThanOrEqual(200);
    expect(snippet).toContain("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    expect(snippet).not.toContain(FAKE_KEY);
    expect(snippet).toContain("[REDACTED]");
  });

  it("타임아웃은 timeout", async () => {
    const hanging: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const error = await client(hanging, { timeoutMs: 5 })
      .fetchAll({ species: "cat" })
      .catch((e: UpstreamError) => e);
    expect((error as UpstreamError).reason).toBe("timeout");
  });

  describe("HTTP 403 인증 오류(합성 본문)", () => {
    // 프로브로 확인한 구조의 합성 본문. 값은 지어낸 것이다.
    const authBody = JSON.stringify(
      {
        OpenAPI_ServiceResponse: {
          cmmMsgHeader: {
            errMsg: "SERVICE ERROR",
            returnAuthMsg: `SERVICE_KEY_IS_NOT_REGISTERED_ERROR ${FAKE_KEY}`,
            returnReasonCode: "30",
          },
        },
      },
      null,
      4,
    );

    it("본문이 200자를 넘어도 auth로 분류하고, 로그용 detail에는 returnReasonCode와 errMsg만 둔다", async () => {
      expect(authBody.length).toBeGreaterThan(200);
      const error = await failure(async () => new Response(authBody, { status: 403 }));
      expect(error.reason).toBe("auth");
      expect(error.detail).toEqual({ kind: "auth", status: 403, returnReasonCode: "30", errMsg: "SERVICE ERROR" });
      const serialized = `${error.message} ${JSON.stringify(error.detail)}`;
      expect(serialized).not.toContain(FAKE_KEY);
      expect(serialized).not.toContain("returnAuthMsg");
    });

    it("403이어도 이 구조가 아니면 failed", async () => {
      const error = await failure(async () => new Response("<html>Forbidden</html>", { status: 403 }));
      expect(error.reason).toBe("failed");
      expect(error.detail).toMatchObject({ kind: "status", status: 403 });
    });

    it("같은 구조라도 403이 아니면 failed", async () => {
      const error = await failure(async () => new Response(authBody, { status: 500 }));
      expect(error.reason).toBe("failed");
    });
  });

  describe("프로브로 확인한 구조(docs/fixtures/upstream-wrapper.json, 값은 합성)", () => {
    const { cases } = wrapperFixture;
    const serve = (c: { httpStatus: number; body: unknown }) => async () =>
      Response.json(c.body, { status: c.httpStatus });

    it("다건/1건/0건 응답을 모두 처리한다", async () => {
      expect(await client(serve(cases.multi), { pageSize: 500 }).fetchAll({ species: "cat" })).toHaveLength(2);
      expect(await client(serve(cases.empty), { pageSize: 500 }).fetchAll({ species: "cat" })).toEqual([]);
      const single = await client(serve(cases.single)).fetchByDesertionNo("100000000000003");
      expect(single?.processState).toBe("종료(안락사)");
      expect(await client(serve(cases.empty)).fetchByDesertionNo("999")).toBeNull();
    });

    it("HTTP 403 인증 오류는 auth로 분류한다", async () => {
      const error = await failure(serve(cases.authError));
      expect(error.reason).toBe("auth");
      expect(error.detail).toEqual({ kind: "auth", status: 403, returnReasonCode: "30", errMsg: "SERVICE ERROR" });
    });
  });

  describe("일일 호출 한도 초과(코드 22, 합성 본문)", () => {
    // 응답 모양은 문서에 없어 세 가지를 모두 본다. 값은 지어낸 것이다(서비스키가 섞여 있어도 가려져야 한다)
    const quotaHeader = {
      OpenAPI_ServiceResponse: {
        cmmMsgHeader: {
          errMsg: "SERVICE ERROR",
          returnAuthMsg: `LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR ${FAKE_KEY}`,
          returnReasonCode: "22",
        },
      },
    };
    const resultCode22 = { response: { header: { resultCode: "22", resultMsg: "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR" } } };

    it.each([
      ["HTTP 403 + cmmMsgHeader", () => Response.json(quotaHeader, { status: 403 }), { kind: "cmmMsgHeader", status: 403, code: "22", errMsg: "SERVICE ERROR" }],
      ["HTTP 200 + resultCode 22", () => Response.json(resultCode22), { kind: "resultCode", status: 200, code: "22" }],
      ["HTTP 200 + cmmMsgHeader", () => Response.json(quotaHeader), { kind: "cmmMsgHeader", status: 200, code: "22", errMsg: "SERVICE ERROR" }],
    ])("%s → quota_exceeded", async (_name, respond, detail) => {
      const error = await failure(async () => respond());
      expect(error.reason).toBe("quota_exceeded");
      expect(error.detail).toEqual(detail);
      const serialized = `${error.message} ${JSON.stringify(error.detail)}`;
      expect(serialized).not.toContain(FAKE_KEY);
      expect(serialized).not.toContain("serviceKey");
    });

    it("상세 단건 조회에서도 같다", async () => {
      const error = await client(async () => Response.json(resultCode22))
        .fetchByDesertionNo("1")
        .catch((e: UpstreamError) => e);
      expect((error as UpstreamError).reason).toBe("quota_exceeded");
    });

    it("다른 코드는 기존 분류 그대로다(403 + 30은 auth, 200 + cmmMsgHeader 30은 failed shape)", async () => {
      const header30 = structuredClone(quotaHeader);
      header30.OpenAPI_ServiceResponse.cmmMsgHeader.returnReasonCode = "30";
      expect((await failure(async () => Response.json(header30, { status: 403 }))).reason).toBe("auth");
      const shape = await failure(async () => Response.json(header30));
      expect(shape.reason).toBe("failed");
      expect(shape.detail).toMatchObject({ kind: "shape" });
    });
  });

  it("로그용 bodySnippet은 200자 이하다", async () => {
    const error = await failure(async () => new Response("x".repeat(3000), { status: 500 }));
    expect((error.detail.bodySnippet as string).length).toBe(200);
  });

  it("비 2xx는 failed", async () => {
    const error = await failure(async () => new Response("Bad Gateway", { status: 502 }));
    expect(error.reason).toBe("failed");
    expect(error.detail).toMatchObject({ kind: "status", status: 502 });
  });

  it("알려진 오류 resultCode는 failed", async () => {
    const body = { response: { header: { resultCode: "30", resultMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" } } };
    const error = await failure(async () => Response.json(body));
    expect(error.detail).toMatchObject({ kind: "resultCode", resultCode: "30" });
  });

  it("목록에 없는 resultCode나 03(NODATA)은 오류로 보지 않는다", async () => {
    for (const resultCode of ["00", "0000", "03", "INFO-000"]) {
      const body = { response: { header: { resultCode }, body: { items: "", totalCount: 0 } } };
      await expect(client(async () => Response.json(body)).fetchAll({ species: "cat" })).resolves.toEqual([]);
    }
  });

  it("최상위 response가 없는 JSON은 failed", async () => {
    const error = await failure(async () => Response.json({ unexpected: true }));
    expect(error.detail).toMatchObject({ kind: "shape" });
  });

  it("오류 메시지와 detail 어디에도 서비스키와 쿼리스트링이 없다", async () => {
    const error = await failure(async () => new Response("oops", { status: 500 }));
    const serialized = `${error.message} ${JSON.stringify(error.detail)} ${error.stack ?? ""}`;
    expect(serialized).not.toContain(FAKE_KEY);
    expect(serialized).not.toContain(encodeURIComponent(FAKE_KEY));
    expect(serialized).not.toContain("serviceKey");
  });
});

describe("upstream client 페이지 캐시: 검증을 통과한 페이지만 저장한다", () => {
  /** unstable_cache처럼 load가 성공했을 때만 저장하는 가짜 */
  function fakePageCache() {
    const store = new Map<string, unknown>();
    const pageCache: UpstreamPageCache = async (key, load) => {
      if (store.has(key)) return store.get(key) as never;
      const value = await load();
      store.set(key, value);
      return value;
    };
    return { store, pageCache };
  }

  it("정상 페이지는 저장되고 다음 요청은 업스트림을 부르지 않는다", async () => {
    const { store, pageCache } = fakePageCache();
    const fetch = fakeUpstream(items, 10);
    const upstream = client(fetch, { pageSize: 10, pageCache });
    await upstream.fetchAll({ species: "cat" });
    await upstream.fetchAll({ species: "cat" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(1);
  });

  it.each([
    ["한도 초과(200 + resultCode 22)", () => Response.json({ response: { header: { resultCode: "22" } } })],
    ["알려진 오류 resultCode(200 + 30)", () => Response.json({ response: { header: { resultCode: "30" } } })],
    ["200 + cmmMsgHeader", () => Response.json({ OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: "22" } } })],
    ["모양이 다른 200", () => Response.json({ unexpected: true })],
    ["HTTP 500", () => new Response("oops", { status: 500 })],
  ])("오류 응답(%s)은 저장되지 않고, 다음 요청은 업스트림을 다시 부른다", async (_name, respond) => {
    const { store, pageCache } = fakePageCache();
    const fetch = vi.fn<FetchLike>(async () => respond());
    const upstream = client(fetch, { pageCache });
    await expect(upstream.fetchAll({ species: "cat" })).rejects.toBeInstanceOf(UpstreamError);
    expect(store.size).toBe(0);

    // 업스트림이 회복하면 바로 정상 결과가 나온다(오류가 캐시되어 재검증 주기 동안 남지 않는다)
    fetch.mockImplementation(async () => Response.json(page(items.slice(0, 2), 2)));
    await expect(upstream.fetchAll({ species: "cat" })).resolves.toHaveLength(2);
    expect(store.size).toBe(1);
  });

  it("캐시 키에는 요청 파라미터만 있고 서비스키는 없다", async () => {
    const { store, pageCache } = fakePageCache();
    await client(fakeUpstream(items, 10), { pageSize: 10, pageCache }).fetchAll({ species: "dog", uprCd: "6110000" });
    await client(async () => Response.json(page([items[0]], 1)), { pageCache }).fetchByDesertionNo(items[0].desertionNo);
    const keys = [...store.keys()];
    expect(keys).toEqual([
      "numOfRows=10&pageNo=1&upkind=417000&upr_cd=6110000",
      `desertion_no=${items[0].desertionNo}&numOfRows=10&pageNo=1`,
    ]);
    for (const key of keys) {
      expect(key).not.toContain(FAKE_KEY);
      expect(key).not.toContain(encodeURIComponent(FAKE_KEY));
      expect(key).not.toContain("serviceKey");
    }
  });
});

describe("upstream client fetchByDesertionNo", () => {
  it("desertion_no로 조회하고 id가 일치하는 item을 돌려준다", async () => {
    const target = items[3];
    const fetch = vi.fn<FetchLike>(async () => Response.json(page([target], 1)));
    const result = await client(fetch).fetchByDesertionNo(target.desertionNo);
    expect(result?.desertionNo).toBe(target.desertionNo);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get("desertion_no")).toBe(target.desertionNo);
    expect(url.searchParams.get("_type")).toBe("json");
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("없으면 null, 다른 id만 오면 null", async () => {
    await expect(client(async () => Response.json(page([], 0))).fetchByDesertionNo("1")).resolves.toBeNull();
    await expect(
      client(async () => Response.json(page([items[0]], 1))).fetchByDesertionNo("999"),
    ).resolves.toBeNull();
  });
});
