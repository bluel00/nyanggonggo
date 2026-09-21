import { describe, expect, it, vi } from "vitest";
import { createHttpClient, HttpError, stripQuery, type FetchLike } from "./http-client";

const FAKE_KEY = "test-key-SECRET123";
const URL_WITH_KEY = `http://api.test/path/list?serviceKey=${FAKE_KEY}&pageNo=1`;

const respond = (body: string, status = 200): FetchLike =>
  vi.fn(async () => new Response(body, { status }));

/** signal이 abort될 때까지 끝나지 않는 fetch */
const hanging: FetchLike = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected rejection");
}

function expectNoQuery(error: unknown) {
  expect(error).toBeInstanceOf(HttpError);
  const serialized = `${String(error)} ${JSON.stringify(error)} ${(error as Error).stack ?? ""}`;
  expect(serialized).not.toContain(FAKE_KEY);
  expect(serialized).not.toContain("serviceKey");
  expect((error as HttpError).endpoint).toBe("http://api.test/path/list");
}

describe("httpClient", () => {
  it("2xx JSON을 파싱한다", async () => {
    const client = createHttpClient({ fetch: respond('{"a":1}') });
    await expect(client.getJson(URL_WITH_KEY)).resolves.toEqual({ status: 200, data: { a: 1 } });
  });

  it("타임아웃이면 kind=timeout", async () => {
    const client = createHttpClient({ fetch: hanging, timeoutMs: 5 });
    const error = await catchError(client.getText(URL_WITH_KEY));
    expect((error as HttpError).kind).toBe("timeout");
    expectNoQuery(error);
  });

  it("호출별 timeoutMs가 기본값을 덮어쓴다", async () => {
    const client = createHttpClient({ fetch: hanging, timeoutMs: 60_000 });
    const error = await catchError(client.getText(URL_WITH_KEY, { timeoutMs: 5 }));
    expect((error as HttpError).kind).toBe("timeout");
  });

  it("비 2xx면 kind=status와 status 코드", async () => {
    const client = createHttpClient({ fetch: respond("Service Unavailable", 503) });
    const error = await catchError(client.getText(URL_WITH_KEY));
    expect(error).toMatchObject({ kind: "status", status: 503, bodySnippet: "Service Unavailable" });
    expectNoQuery(error);
  });

  it("JSON 파싱 실패면 kind=parse, 본문 앞 200자만 담는다", async () => {
    const xml = `<OpenAPI_ServiceResponse>${"x".repeat(500)}</OpenAPI_ServiceResponse>`;
    const client = createHttpClient({ fetch: respond(xml) });
    const error = await catchError(client.getJson(URL_WITH_KEY));
    expect(error).toMatchObject({ kind: "parse", status: 200 });
    expect((error as HttpError).bodySnippet).toHaveLength(200);
    expectNoQuery(error);
  });

  it("네트워크 오류면 kind=network, 원래 오류 메시지(URL 포함)를 싣지 않는다", async () => {
    const fetch: FetchLike = async (input) => {
      throw new TypeError(`fetch failed: ${input}`);
    };
    const error = await catchError(createHttpClient({ fetch }).getText(URL_WITH_KEY));
    expect((error as HttpError).kind).toBe("network");
    expect((error as Error).cause).toBeUndefined();
    expectNoQuery(error);
  });

  it("호출한 쪽의 취소는 AbortError 그대로 전달한다", async () => {
    const controller = new AbortController();
    const promise = createHttpClient({ fetch: hanging }).getText(URL_WITH_KEY, {
      signal: controller.signal,
    });
    controller.abort();
    const error = await catchError(promise);
    expect(error).not.toBeInstanceOf(HttpError);
    expect((error as Error).name).toBe("AbortError");
  });

  it("Next fetch 옵션(next, cache)을 그대로 전달한다", async () => {
    const fetch = respond("ok");
    await createHttpClient({ fetch }).getText(URL_WITH_KEY, {
      cache: "force-cache",
      next: { revalidate: 300 },
    });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit & { next?: unknown };
    expect(init.cache).toBe("force-cache");
    expect(init.next).toEqual({ revalidate: 300 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("stripQuery", () => {
  it("쿼리스트링과 해시를 뗀다", () => {
    expect(stripQuery("http://a.test/x?serviceKey=k#h")).toBe("http://a.test/x");
    expect(stripQuery("/api/animals?species=cat")).toBe("/api/animals");
    expect(stripQuery("http://a.test/x")).toBe("http://a.test/x");
  });
});
