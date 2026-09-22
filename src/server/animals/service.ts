import type { AnimalListResponse, AnimalWireDto } from "@/contract/animals";
import type { MappedAnimal } from "../mapper";
import { mapWithConcurrency } from "@/shared/lib/concurrency";
import type { AnimalSource } from "../source/animal-source";
import { InvalidRequestError, NotFoundError } from "./errors";

/**
 * 목록/단건/다건 조회. 순수 로직이며 소스를 주입받는다. Next API를 import하지 않는다.
 */

export type AnimalListParams = {
  species: AnimalWireDto["species"];
  /** 시도 코드(upr_cd) */
  region?: string;
  /** 시군구 코드(org_cd). region과 함께만 온다 */
  district?: string;
  status: AnimalWireDto["status"] | "all";
  sort: "latest" | "endingSoon";
  cursor?: string;
};

export type AnimalServiceOptions = {
  pageSize: number;
  byIdsConcurrency: number;
  /** 기준 시각. endingSoon 정렬의 "오늘(KST)" 판정에 쓴다. */
  now: () => Date;
};

export type AnimalService = {
  list(params: AnimalListParams): Promise<AnimalListResponse>;
  getById(id: string): Promise<AnimalWireDto>;
  getByIds(ids: string[]): Promise<AnimalWireDto[]>;
};

export function createAnimalService(source: AnimalSource, options: AnimalServiceOptions): AnimalService {
  return {
    async list({ species, region, district, status, sort, cursor }) {
      const offset = cursor === undefined ? 0 : decodeCursor(cursor);
      const all = await source.list({ species, uprCd: region ?? "all", ...(district ? { orgCd: district } : {}) });

      const today = kstYmd(options.now());
      const sorted = all
        .filter((animal) => status === "all" || animal.wire.status === status)
        .sort(sort === "latest" ? compareLatest : compareEndingSoon(today));

      const end = offset + options.pageSize;
      return {
        items: sorted.slice(offset, end).map((animal) => animal.wire),
        nextCursor: end < sorted.length ? encodeCursor(end) : null,
      };
    },

    async getById(id) {
      const found = await source.getById(id);
      if (!found) throw new NotFoundError();
      return found.wire;
    },

    async getByIds(ids) {
      const unique = [...new Set(ids)];
      const found = await mapWithConcurrency(unique, options.byIdsConcurrency, (id) => source.getById(id));
      // 못 찾은 id는 조용히 제외하고 입력 순서를 유지한다.
      return found.flatMap((animal) => (animal ? [animal.wire] : []));
    },
  };
}

type Comparator = (a: MappedAnimal, b: MappedAnimal) => number;

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** noticeSdt 내림차순, 동률이면 updTm 내림차순, 그다음 id 내림차순 */
const compareLatest: Comparator = (a, b) =>
  compareText(b.sortKeys.noticeSdt, a.sortKeys.noticeSdt) ||
  compareText(b.sortKeys.updTm, a.sortKeys.updTm) ||
  compareText(b.wire.id, a.wire.id);

/**
 * 종료일이 오늘(KST) 이후인 공고(당일 포함)를 noticeEdt 오름차순으로 먼저,
 * 지난 공고를 그 뒤에 noticeEdt 내림차순으로, 날짜 형식이 아닌 것은 맨 뒤에 둔다.
 * 동률은 id 오름차순(architecture.md 5절).
 */
function compareEndingSoon(today: string): Comparator {
  const group = (edt: string) => (!/^\d{8}$/.test(edt) ? 2 : edt < today ? 1 : 0);
  return (a, b) => {
    const ga = group(a.sortKeys.noticeEdt);
    const gb = group(b.sortKeys.noticeEdt);
    if (ga !== gb) return ga - gb;
    const byDate =
      ga === 1
        ? compareText(b.sortKeys.noticeEdt, a.sortKeys.noticeEdt)
        : compareText(a.sortKeys.noticeEdt, b.sortKeys.noticeEdt);
    return byDate || compareText(a.wire.id, b.wire.id);
  };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 기준 시각의 KST 달력 날짜 `YYYYMMDD` */
function kstYmd(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10).replaceAll("-", "");
}

/** 커서는 정렬된 결과의 offset을 base64url로 감싼 불투명 문자열이다. */
export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): number {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const offset = /^\d{1,9}$/.test(decoded) ? Number(decoded) : NaN;
  if (!Number.isSafeInteger(offset) || encodeCursor(offset) !== cursor) {
    throw new InvalidRequestError("Invalid cursor");
  }
  return offset;
}
