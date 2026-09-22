import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, getValidated } from "./api-request";
import { createHttpClient, type FetchLike } from "./http-client";

const Schema = z.object({ id: z.string() });
const client = (fetch: FetchLike) => createHttpClient({ fetch });
const respond = (body: string, status = 200) => vi.fn<FetchLike>(async () => new Response(body, { status }));

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("expected rejection");
}

describe("getValidated", () => {
  it("계약에 맞으면 파싱한 값을 돌려준다", async () => {
    await expect(getValidated(client(respond('{"id":"1","extra":true}')), "/api/x", Schema)).resolves.toEqual({ id: "1" });
  });

  it("계약과 다르면 contract 오류: 원인(경로)은 알리고 서버 원문은 싣지 않는다", async () => {
    const error = await failure(getValidated(client(respond('{"id":123,"secret":"raw-body"}')), "/api/x?a=1", Schema));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "contract", endpoint: "/api/x", issues: ["id"] });
    expect(error.message).toContain("형식");
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain("raw-body");
  });

  it("2xx인데 JSON이 아니면 contract 오류", async () => {
    const error = await failure(getValidated(client(respond("<html>oops</html>")), "/api/x", Schema));
    expect(error).toMatchObject({ kind: "contract", issues: ["(not json)"] });
    expect(error.message).not.toContain("oops");
  });

  it("서버 오류 본문이 계약에 맞으면 그 code와 message를 쓴다", async () => {
    const body = JSON.stringify({ error: { code: "not_found", message: "공고를 찾을 수 없어요." } });
    const error = await failure(getValidated(client(respond(body, 404)), "/api/animals/1", Schema));
    expect(error).toMatchObject({ kind: "http", status: 404, code: "not_found", message: "공고를 찾을 수 없어요." });
  });

  it("서버 오류 본문이 계약과 다르면 일반 문구(원문을 싣지 않는다)", async () => {
    const error = await failure(getValidated(client(respond("<h1>Bad Gateway internal detail</h1>", 502)), "/api/x", Schema));
    expect(error).toMatchObject({ kind: "http", status: 502, code: null });
    expect(error.message).not.toContain("internal detail");
  });

  it("타임아웃과 네트워크 오류", async () => {
    const hanging: FetchLike = (_i, init) =>
      new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const timeout = await failure(getValidated(createHttpClient({ fetch: hanging, timeoutMs: 5 }), "/api/x", Schema));
    expect(timeout.kind).toBe("timeout");
    const network = await failure(
      getValidated(client(async () => Promise.reject(new TypeError("fetch failed"))), "/api/x", Schema),
    );
    expect(network.kind).toBe("network");
  });

  it("호출한 쪽의 취소는 ApiError로 바꾸지 않는다", async () => {
    const controller = new AbortController();
    const hanging: FetchLike = (_i, init) =>
      new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const promise = getValidated(client(hanging), "/api/x", Schema, { signal: controller.signal });
    controller.abort();
    const error = await failure(promise);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe("AbortError");
  });
});
