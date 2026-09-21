import type { AnimalWireDto } from "@/contract/animals";
import { HttpError, type HttpClient } from "@/shared/api/http-client";
import { mapWithConcurrency } from "../lib/concurrency";
import { noopLogger, type Logger } from "../logger";
import type { UpstreamAnimalItemDto } from "./dto";
import { extractPage } from "./extract";
import { parseUpstreamItems } from "./parse";

/** 서버에서만 호출하므로 http를 허용한다. */
export const UPSTREAM_ENDPOINT =
  "http://apis.data.go.kr/1543061/abandonmentPublicService_v2/abandonmentPublic_v2";

export const UPKIND_BY_SPECIES: Record<AnimalWireDto["species"], string> = {
  cat: "422400",
  dog: "417000",
};

/**
 * 명백한 오류로 보는 resultCode. 공공데이터포털 공통 오류 코드 목록을 따른 것이며
 * 이 API에서 검증되지 않았다(architecture.md 12절). 목록에 없는 코드는 오류로 보지 않는다.
 * `03`(NODATA_ERROR)은 빈 결과로 본다.
 */
const KNOWN_ERROR_CODES = new Set([
  "01", "02", "04", "05", "10", "11", "12", "20", "22", "30", "31", "32", "33", "99",
]);

export type UpstreamErrorReason = "timeout" | "failed";

/** 업스트림 실패. detail은 서버 로그용이며 비밀값이 가려져 있다. 클라이언트에 노출하지 않는다. */
export class UpstreamError extends Error {
  constructor(
    readonly reason: UpstreamErrorReason,
    readonly detail: Record<string, unknown>,
  ) {
    super(`Upstream request failed (${reason})`);
    this.name = "UpstreamError";
  }
}

export type UpstreamClientOptions = {
  http: HttpClient;
  serviceKey: string;
  logger?: Logger;
  revalidateSeconds: number;
  timeoutMs: number;
  pageSize: number;
  /** 첫 페이지 이후 나머지 페이지의 동시 호출 수 */
  concurrency: number;
  maxPages: number;
};

export type UpstreamListParams = {
  species: AnimalWireDto["species"];
  /** 시도 코드. 없으면 전체 */
  uprCd?: string;
};

export type UpstreamClient = {
  /**
   * (upkind, upr_cd) 조합의 전체 목록. 첫 페이지로 totalCount를 얻은 뒤 나머지 페이지를
   * 동시성 상한 안에서 병렬로 받는다. 한 페이지라도 실패하면 전체가 실패한다.
   */
  fetchAll(params: UpstreamListParams): Promise<UpstreamAnimalItemDto[]>;
  /** desertion_no 단건. 없으면 null. */
  fetchByDesertionNo(desertionNo: string): Promise<UpstreamAnimalItemDto | null>;
};

export function createUpstreamClient(options: UpstreamClientOptions): UpstreamClient {
  const { http, serviceKey, logger = noopLogger } = options;

  async function fetchPage(params: Record<string, string>) {
    // state 파라미터는 쓰지 않는다. 상태는 processState로 서버에서 판정한다(architecture.md 5절).
    const search = new URLSearchParams({ serviceKey, _type: "json", ...params });
    const url = `${UPSTREAM_ENDPOINT}?${search}`;

    let json: unknown;
    try {
      ({ data: json } = await http.getJson(url, {
        timeoutMs: options.timeoutMs,
        next: { revalidate: options.revalidateSeconds },
      }));
    } catch (error) {
      if (error instanceof HttpError) {
        throw new UpstreamError(error.kind === "timeout" ? "timeout" : "failed", {
          kind: error.kind,
          status: error.status,
          endpoint: error.endpoint,
          bodySnippet: redact(error.bodySnippet, serviceKey),
        });
      }
      throw error;
    }

    const page = extractPage(json);
    if (page === null) {
      throw new UpstreamError("failed", {
        kind: "shape",
        bodySnippet: redact(JSON.stringify(json)?.slice(0, 200) ?? null, serviceKey),
      });
    }
    if (page.resultCode !== null && KNOWN_ERROR_CODES.has(page.resultCode)) {
      throw new UpstreamError("failed", { kind: "resultCode", resultCode: page.resultCode });
    }
    return page;
  }

  async function fetchAll({ species, uprCd }: UpstreamListParams) {
    const base: Record<string, string> = {
      upkind: UPKIND_BY_SPECIES[species],
      numOfRows: String(options.pageSize),
      ...(uprCd ? { upr_cd: uprCd } : {}),
    };

    const fetchPageNo = (pageNo: number) => fetchPage({ ...base, pageNo: String(pageNo) });
    const first = await fetchPageNo(1);
    const raw: unknown[] = [...first.items];
    let complete: boolean;

    if (first.items.length === 0) {
      complete = true;
    } else if (first.totalCount !== null) {
      const needed = Math.ceil(first.totalCount / options.pageSize);
      const last = Math.min(needed, options.maxPages);
      const rest = Array.from({ length: Math.max(0, last - 1) }, (_, i) => i + 2);
      const pages = await mapWithConcurrency(rest, options.concurrency, fetchPageNo);
      for (const page of pages) raw.push(...page.items);
      complete = needed <= options.maxPages;
    } else {
      // totalCount를 모르면 빈 페이지가 나올 때까지 순서대로 받는다.
      complete = false;
      for (let pageNo = 2; pageNo <= options.maxPages; pageNo += 1) {
        const page = await fetchPageNo(pageNo);
        raw.push(...page.items);
        if (page.items.length === 0) {
          complete = true;
          break;
        }
      }
    }
    if (!complete) {
      logger.warn("upstream max pages reached, list truncated", {
        species,
        uprCd: uprCd ?? "all",
        maxPages: options.maxPages,
        collected: raw.length,
      });
    }

    const { items, skippedCount } = parseUpstreamItems(raw, logger);
    if (skippedCount > 0) {
      logger.warn("upstream items skipped", { species, uprCd: uprCd ?? "all", skippedCount });
    }
    return items;
  }

  async function fetchByDesertionNo(desertionNo: string) {
    const page = await fetchPage({ desertion_no: desertionNo, pageNo: "1", numOfRows: "10" });
    const { items } = parseUpstreamItems(page.items, logger);
    // 파라미터가 무시되고 다른 목록이 오는 경우를 대비해 id로 한 번 더 거른다.
    return items.find((item) => item.desertionNo === desertionNo) ?? null;
  }

  return { fetchAll, fetchByDesertionNo };
}

/** 로그용 문자열에서 서비스키(원문, URL 인코딩 형태)를 가린다. */
function redact(text: string | null, serviceKey: string): string | null {
  if (text === null) return null;
  const forms = new Set([
    serviceKey,
    encodeURIComponent(serviceKey),
    new URLSearchParams({ k: serviceKey }).toString().slice(2),
  ]);
  let result = text;
  for (const form of forms) result = result.replaceAll(form, "[REDACTED]");
  return result;
}
