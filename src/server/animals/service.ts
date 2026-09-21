import type { AnimalListResponse, AnimalWireDto } from "@/contract/animals";
import type { MappedAnimal } from "../mapper";
import { mapWithConcurrency } from "../lib/concurrency";
import type { AnimalSource } from "../source/animal-source";
import { InvalidRequestError, NotFoundError } from "./errors";

/**
 * 목록/단건/다건 조회. 순수 로직이며 소스를 주입받는다. Next API를 import하지 않는다.
 */

export type AnimalListParams = {
  species: AnimalWireDto["species"];
  region?: string;
  status: AnimalWireDto["status"] | "all";
  sort: "latest" | "endingSoon";
  cursor?: string;
};

export type AnimalServiceOptions = {
  pageSize: number;
  byIdsConcurrency: number;
};

export type AnimalService = {
  list(params: AnimalListParams): Promise<AnimalListResponse>;
  getById(id: string): Promise<AnimalWireDto>;
  getByIds(ids: string[]): Promise<AnimalWireDto[]>;
};

export function createAnimalService(source: AnimalSource, options: AnimalServiceOptions): AnimalService {
  return {
    async list({ species, region, status, sort, cursor }) {
      const offset = cursor === undefined ? 0 : decodeCursor(cursor);
      const all = await source.list({ species, uprCd: region ?? "all" });

      const sorted = all
        .filter((animal) => status === "all" || animal.wire.status === status)
        .sort(COMPARATORS[sort]);

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

const COMPARATORS: Record<AnimalListParams["sort"], Comparator> = {
  // noticeSdt 내림차순, 동률이면 updTm 내림차순, 그다음 id 내림차순
  latest: (a, b) =>
    compareText(b.sortKeys.noticeSdt, a.sortKeys.noticeSdt) ||
    compareText(b.sortKeys.updTm, a.sortKeys.updTm) ||
    compareText(b.wire.id, a.wire.id),
  // noticeEdt 오름차순, 동률이면 id 오름차순
  endingSoon: (a, b) =>
    compareText(a.sortKeys.noticeEdt, b.sortKeys.noticeEdt) || compareText(a.wire.id, b.wire.id),
};

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
