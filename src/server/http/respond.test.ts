import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiErrorResponseSchema } from "@/contract/animals";
import { InvalidRequestError, NotFoundError } from "../animals/errors";
import { ServerConfigError } from "../config";
import { UpstreamError } from "../upstream/client";
import { errorResponse, jsonResponse } from "./respond";

const FAKE_KEY = "test-key-SECRET";

async function run(error: unknown) {
  const logger = { warn: vi.fn() };
  const response = errorResponse(error, logger);
  return { response, body: await response.json(), logger };
}

describe("errorResponse", () => {
  it.each([
    [new InvalidRequestError("Invalid cursor"), 400, "invalid_request"],
    [new NotFoundError(), 404, "not_found"],
    [new UpstreamError("failed", { kind: "status", status: 500 }), 502, "upstream_error"],
    [new UpstreamError("timeout", { kind: "timeout" }), 504, "upstream_timeout"],
    [new UpstreamError("auth", { kind: "auth", status: 403 }), 502, "upstream_error"],
    [new ServerConfigError(["DATA_GO_KR_SERVICE_KEY"]), 500, "internal_error"],
    [new Error("boom"), 500, "internal_error"],
  ])("%s → %i %s", async (error, status, code) => {
    const { response, body } = await run(error);
    expect(response.status).toBe(status);
    expect(body).toEqual({ error: { code, message: expect.any(String) } });
    expect(ApiErrorResponseSchema.strict().safeParse(body).success).toBe(true);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("auth는 설정/인증 오류 메시지로 로그를 남기고 detail만 싣는다", async () => {
    const { logger } = await run(new UpstreamError("auth", { kind: "auth", status: 403, returnReasonCode: "30", errMsg: "SERVICE ERROR" }));
    expect(logger.warn).toHaveBeenCalledWith("upstream auth/config error", {
      reason: "auth",
      kind: "auth",
      status: 403,
      returnReasonCode: "30",
      errMsg: "SERVICE ERROR",
    });
  });

  it("계약 검증 실패(ZodError)는 500, 로그에는 경로만 남긴다", async () => {
    const zodError = z.object({ id: z.string() }).safeParse({ id: 1 }).error!;
    const { response, logger } = await run(zodError);
    expect(response.status).toBe(500);
    expect(logger.warn).toHaveBeenCalledWith("response contract violation", { issues: ["id"] });
  });

  it("응답 본문에 업스트림 상세, 설정 변수명, 원래 오류 메시지를 노출하지 않는다", async () => {
    const errors = [
      new UpstreamError("failed", { kind: "parse", bodySnippet: `<xml>${FAKE_KEY}</xml>`, endpoint: "http://x.test/p" }),
      new ServerConfigError(["DATA_GO_KR_SERVICE_KEY"]),
      new Error(`fetch failed http://x.test/p?serviceKey=${FAKE_KEY}`),
    ];
    for (const error of errors) {
      const text = JSON.stringify((await run(error)).body);
      for (const secret of [FAKE_KEY, "serviceKey", "DATA_GO_KR", "x.test", "<xml>"]) {
        expect(text).not.toContain(secret);
      }
    }
  });

  it("예상하지 못한 오류는 메시지(URL이 있을 수 있음)가 아니라 이름만 로그에 남긴다", async () => {
    const { logger } = await run(new TypeError(`failed ${FAKE_KEY}`));
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(FAKE_KEY);
    expect(logger.warn).toHaveBeenCalledWith("unexpected error", { name: "TypeError" });
  });
});

describe("jsonResponse", () => {
  it("Cache-Control을 붙인다", async () => {
    const response = jsonResponse({ a: 1 }, "public, s-maxage=60");
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60");
    expect(await response.json()).toEqual({ a: 1 });
  });
});
