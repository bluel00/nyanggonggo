import type { z } from "zod";
import { ApiErrorResponseSchema } from "@/contract/animals";
import { HttpError, stripQuery, type HttpClient, type HttpRequestOptions } from "./http-client";

/**
 * 자체 /api/** 호출 결과의 오류. 화면에 message를 그대로 보여도 되게 만든다.
 * - http: 서버가 준 오류 본문({ error: { code, message } })이 계약에 맞으면 그 code와 message, 아니면 일반 문구
 * - contract: 응답이 계약(Zod)과 다름. 원인은 감추지 않고 알리되, 서버 원문은 싣지 않고 어긋난 경로(issues)만 담는다
 */
export type ApiErrorKind = "timeout" | "network" | "http" | "contract";

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  timeout: "응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.",
  network: "네트워크에 연결할 수 없어요. 연결을 확인해 주세요.",
  http: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
  contract: "받은 데이터 형식이 올바르지 않아요. 잠시 후 다시 시도해 주세요.",
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP 상태. 응답을 받지 못했으면 null */
  readonly status: number | null;
  /** 서버 오류 코드(invalid_request, not_found, upstream_error, …) */
  readonly code: string | null;
  /** 쿼리스트링을 뗀 경로 */
  readonly endpoint: string;
  /** contract 오류일 때 계약과 어긋난 경로(값은 담지 않는다) */
  readonly issues: string[];

  constructor(params: {
    kind: ApiErrorKind;
    endpoint: string;
    status?: number | null;
    code?: string | null;
    message?: string;
    issues?: string[];
  }) {
    super(params.message ?? DEFAULT_MESSAGES[params.kind]);
    this.name = "ApiError";
    this.kind = params.kind;
    this.endpoint = params.endpoint;
    this.status = params.status ?? null;
    this.code = params.code ?? null;
    this.issues = params.issues ?? [];
  }
}

/** GET 후 응답을 계약 스키마로 검증해 돌려준다. 실패는 모두 ApiError로 바꾼다(호출한 쪽의 취소는 그대로 전달). */
export async function getValidated<T>(
  http: HttpClient,
  url: string,
  schema: z.ZodType<T>,
  options?: HttpRequestOptions,
): Promise<T> {
  const endpoint = stripQuery(url);
  let data: unknown;
  try {
    ({ data } = await http.getJson(url, options));
  } catch (error) {
    if (error instanceof HttpError) throw fromHttpError(error);
    throw error;
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError({
      kind: "contract",
      endpoint,
      status: 200,
      issues: result.error.issues.map((issue) => issue.path.join(".") || "(root)"),
    });
  }
  return result.data;
}

function fromHttpError(error: HttpError): ApiError {
  const { endpoint, status } = error;
  switch (error.kind) {
    case "timeout":
      return new ApiError({ kind: "timeout", endpoint });
    case "network":
      return new ApiError({ kind: "network", endpoint });
    case "parse":
      // 2xx인데 JSON이 아니다. 본문은 싣지 않는다.
      return new ApiError({ kind: "contract", endpoint, status, issues: ["(not json)"] });
    case "status": {
      const body = parseErrorBody(error.bodySnippet);
      return new ApiError({ kind: "http", endpoint, status, code: body?.code, message: body?.message });
    }
  }
}

function parseErrorBody(text: string | null): { code: string; message: string } | null {
  if (text === null) return null;
  try {
    const result = ApiErrorResponseSchema.safeParse(JSON.parse(text));
    return result.success ? result.data.error : null;
  } catch {
    return null;
  }
}
