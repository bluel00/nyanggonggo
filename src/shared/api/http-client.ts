/**
 * 네이티브 fetch를 감싼 얇은 HTTP 클라이언트(서버, 클라이언트 공용).
 * 오류 메시지와 예외에는 요청 URL의 쿼리스트링을 넣지 않는다(서비스키가 들어 있을 수 있다).
 */

export const DEFAULT_TIMEOUT_MS = 10_000;
/** 오류 분류에 쓰도록 보관하는 본문 길이. 로그에 남길 때는 호출한 쪽이 더 줄이고 비밀값을 가린다. */
const BODY_SNIPPET_MAX = 2_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Next의 fetch 확장 옵션. next를 import하지 않도록 필요한 모양만 둔다. */
export type NextFetchOptions = {
  revalidate?: number | false;
  tags?: string[];
};

export type HttpRequestOptions = Omit<RequestInit, "signal"> & {
  next?: NextFetchOptions;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type HttpErrorKind = "timeout" | "network" | "status" | "parse";

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  /** origin + path. 쿼리스트링은 없다. */
  readonly endpoint: string;
  readonly status: number | null;
  /** 응답 본문 앞부분(최대 2,000자). 호출한 쪽이 로그에 남기기 전에 줄이고 비밀값을 가려야 한다. */
  readonly bodySnippet: string | null;

  constructor(params: {
    kind: HttpErrorKind;
    endpoint: string;
    status?: number | null;
    bodySnippet?: string | null;
  }) {
    const status = params.status ?? null;
    super(`HTTP ${params.kind} error: ${params.endpoint}${status === null ? "" : ` (${status})`}`);
    this.name = "HttpError";
    this.kind = params.kind;
    this.endpoint = params.endpoint;
    this.status = status;
    this.bodySnippet = params.bodySnippet ?? null;
  }
}

export type HttpResponse<T> = { status: number; data: T };

export type HttpBytesResponse = HttpResponse<ArrayBuffer> & { contentType: string | null };

export type HttpClient = {
  getText(url: string, options?: HttpRequestOptions): Promise<HttpResponse<string>>;
  getJson(url: string, options?: HttpRequestOptions): Promise<HttpResponse<unknown>>;
  /** 이미지 등 바이너리 본문 */
  getBytes(url: string, options?: HttpRequestOptions): Promise<HttpBytesResponse>;
};

export function createHttpClient({
  fetch: fetchImpl = (input, init) => globalThis.fetch(input, init),
  timeoutMs: defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
}: { fetch?: FetchLike; timeoutMs?: number } = {}): HttpClient {
  /** GET 요청 공통: 타임아웃, 취소, 오류 정규화. 2xx면 read로 본문을 읽고, 아니면 본문 앞부분을 오류에 담는다. */
  async function send<T>(url: string, options: HttpRequestOptions, read: (response: Response) => Promise<T>) {
    const { timeoutMs = defaultTimeoutMs, signal: callerSignal, ...init } = options;
    const endpoint = stripQuery(url);
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;

    let response: Response;
    let body: T | undefined;
    let errorText = "";
    try {
      response = await fetchImpl(url, { ...init, method: "GET", signal } as RequestInit);
      if (response.ok) body = await read(response);
      else errorText = await response.text();
    } catch {
      if (timeoutSignal.aborted) throw new HttpError({ kind: "timeout", endpoint });
      // 호출한 쪽의 취소(AbortError)는 그대로 전달한다. 쿼리스트링이 담긴 원래 오류는 싣지 않는다.
      if (callerSignal?.aborted) throw callerSignal.reason;
      throw new HttpError({ kind: "network", endpoint });
    }

    if (!response.ok) {
      throw new HttpError({
        kind: "status",
        endpoint,
        status: response.status,
        bodySnippet: snippet(errorText),
      });
    }
    return { response, body: body as T };
  }

  async function getText(url: string, options: HttpRequestOptions = {}) {
    const { response, body } = await send(url, options, (r) => r.text());
    return { status: response.status, data: body };
  }

  async function getJson(url: string, options?: HttpRequestOptions) {
    const { status, data } = await getText(url, options);
    try {
      return { status, data: JSON.parse(data) as unknown };
    } catch {
      throw new HttpError({ kind: "parse", endpoint: stripQuery(url), status, bodySnippet: snippet(data) });
    }
  }

  async function getBytes(url: string, options: HttpRequestOptions = {}) {
    const { response, body } = await send(url, options, (r) => r.arrayBuffer());
    return { status: response.status, data: body, contentType: response.headers.get("content-type") };
  }

  return { getText, getJson, getBytes };
}

/** 쿼리스트링과 해시를 뗀 origin + path. 상대 경로도 처리한다. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function snippet(text: string): string {
  return text.slice(0, BODY_SNIPPET_MAX);
}
