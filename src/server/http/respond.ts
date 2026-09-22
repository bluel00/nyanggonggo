import { z } from "zod";
import { ApiErrorResponseSchema, type ApiErrorResponse } from "@/contract/animals";
import { InvalidRequestError, NotFoundError } from "../animals/errors";
import { ServerConfigError } from "../config";
import type { Logger } from "../logger";
import { UpstreamError } from "../upstream/client";

/**
 * Route Handler 공용 응답. 오류 응답은 계약 `ApiErrorResponse`(`{ error: { code, message } }`, src/contract)로 통일하고,
 * 메시지에 키, URL, 업스트림 본문, 설정 상세를 넣지 않는다. 상세는 서버 로그에만 남긴다.
 */

export type ErrorCode = "invalid_request" | "not_found" | "upstream_error" | "upstream_timeout" | "internal_error";

const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  invalid_request: { status: 400, message: "요청 값이 올바르지 않아요." },
  not_found: { status: 404, message: "공고를 찾을 수 없어요." },
  upstream_error: { status: 502, message: "공고 정보를 불러오지 못했어요." },
  upstream_timeout: { status: 504, message: "공고 정보를 불러오는 데 시간이 너무 걸려요." },
  internal_error: { status: 500, message: "일시적인 오류가 발생했어요." },
};

export function jsonResponse(body: unknown, cacheControl: string): Response {
  return Response.json(body, { headers: { "Cache-Control": cacheControl } });
}

export function errorResponse(error: unknown, logger: Logger): Response {
  const code = classify(error, logger);
  const { status, message } = ERRORS[code];
  // 성공 응답처럼 보내기 직전에 계약으로 검증한다.
  const body: ApiErrorResponse = ApiErrorResponseSchema.parse({ error: { code, message } });
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function classify(error: unknown, logger: Logger): ErrorCode {
  if (error instanceof InvalidRequestError) return "invalid_request";
  if (error instanceof NotFoundError) return "not_found";
  if (error instanceof UpstreamError) {
    const message = error.reason === "auth" ? "upstream auth/config error" : "upstream failure";
    logger.warn(message, { reason: error.reason, ...error.detail });
    return error.reason === "timeout" ? "upstream_timeout" : "upstream_error";
  }
  if (error instanceof ServerConfigError) {
    logger.warn("server misconfigured", { variables: error.variables });
    return "internal_error";
  }
  if (error instanceof z.ZodError) {
    // 응답 직전 계약 검증 실패. 값이 아니라 경로만 남긴다.
    logger.warn("response contract violation", {
      issues: error.issues.map((issue) => issue.path.join(".")),
    });
    return "internal_error";
  }
  logger.warn("unexpected error", { name: error instanceof Error ? error.name : typeof error });
  return "internal_error";
}
