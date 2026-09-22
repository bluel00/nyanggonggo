import { describe, expect, it } from "vitest";
import { ApiError } from "./api-request";
import { HttpError } from "./http-client";
import { createQueryClient, isRetryableError, QUERY_STALE_TIME_MS } from "./query-client";

describe("createQueryClient", () => {
  it("staleTime은 서버 재검증 주기(300초)보다 길지 않다", () => {
    expect(QUERY_STALE_TIME_MS).toBeLessThanOrEqual(300_000);
    const defaults = createQueryClient().getDefaultOptions().queries!;
    expect(defaults.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(defaults.refetchOnWindowFocus).toBe(false);
  });

  it("재시도는 일시적 오류에 1회만", () => {
    const retry = createQueryClient().getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean;
    const timeout = new HttpError({ kind: "timeout", endpoint: "/api/animals" });
    const badGateway = new HttpError({ kind: "status", endpoint: "/api/animals", status: 502 });
    const notFound = new HttpError({ kind: "status", endpoint: "/api/animals/1", status: 404 });
    expect(retry(0, timeout)).toBe(true);
    expect(retry(0, badGateway)).toBe(true);
    expect(retry(1, badGateway)).toBe(false);
    expect(retry(0, notFound)).toBe(false);
    expect(retry(0, new Error("x"))).toBe(false);
  });
});

describe("isRetryableError", () => {
  it("ApiError: 타임아웃/네트워크/5xx만 재시도, 4xx와 계약 위반은 재시도하지 않는다", () => {
    expect(isRetryableError(new ApiError({ kind: "timeout", endpoint: "/x" }))).toBe(true);
    expect(isRetryableError(new ApiError({ kind: "http", endpoint: "/x", status: 504 }))).toBe(true);
    expect(isRetryableError(new ApiError({ kind: "http", endpoint: "/x", status: 404 }))).toBe(false);
    expect(isRetryableError(new ApiError({ kind: "contract", endpoint: "/x", status: 200 }))).toBe(false);
  });

  it("네트워크 오류는 재시도, 400은 재시도하지 않는다", () => {
    expect(isRetryableError(new HttpError({ kind: "network", endpoint: "/x" }))).toBe(true);
    expect(isRetryableError(new HttpError({ kind: "status", endpoint: "/x", status: 400 }))).toBe(false);
  });
});
