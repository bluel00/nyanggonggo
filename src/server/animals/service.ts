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
      const anchor = cursor === undefined ? null : decodeCursor(cursor);
      const all = await source.list({ species, uprCd: region ?? "all", ...(district ? { orgCd: district } : {}) });

      const compare = sort === "latest" ? compareLatest : compareEndingSoon(kstYmd(options.now()));
      const sorted = all.filter((animal) => status === "all" || animal.wire.status === status).sort(compare);

      const start = anchor === null ? 0 : firstIndexAfter(sorted, compare, anchor);
      const page = sorted.slice(start, start + options.pageSize);
      const last = page.at(-1);
      return {
        items: page.map((animal) => animal.wire),
        nextCursor: last && start + page.length < sorted.length ? encodeCursor(toAnchor(last)) : null,
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

/** 정렬에 쓰는 최소 형태. MappedAnimal과 커서가 가리키는 항목(anchor)이 모두 이 모양이다. */
type SortItem = { sortKeys: MappedAnimal["sortKeys"]; wire: { id: string } };

type Comparator = (a: SortItem, b: SortItem) => number;

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

/**
 * 커서는 **앞 페이지 마지막 항목의 정렬 키**를 base64url로 감싼 불투명 문자열이다(offset이 아니다).
 * 목록은 요청마다 업스트림에서 새로 조립하므로, 두 요청 사이에 공고가 하나만 추가되거나 상태가 바뀌어도
 * offset은 한 칸씩 밀려 경계의 항목이 다음 페이지에 또 나오거나(중복 key) 빠졌다(12절 38).
 * 정렬 키를 기준으로 하면 "이 항목보다 뒤"를 정확히 집어낼 수 있어 밀림에 영향받지 않는다.
 */
export type CursorAnchor = SortItem;

const CURSOR_SEPARATOR = "|";

function toAnchor({ sortKeys, wire }: SortItem): CursorAnchor {
  return { sortKeys: { ...sortKeys }, wire: { id: wire.id } };
}

export function encodeCursor(anchor: CursorAnchor): string {
  const { noticeSdt, noticeEdt, updTm } = anchor.sortKeys;
  const raw = [anchor.wire.id, noticeSdt, noticeEdt, updTm].join(CURSOR_SEPARATOR);
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorAnchor {
  const parts = Buffer.from(cursor, "base64url").toString("utf8").split(CURSOR_SEPARATOR);
  const [id, noticeSdt, noticeEdt, updTm] = parts;
  if (parts.length !== 4 || !id) throw new InvalidRequestError("Invalid cursor");
  const anchor: CursorAnchor = { wire: { id }, sortKeys: { noticeSdt: noticeSdt!, noticeEdt: noticeEdt!, updTm: updTm! } };
  // 같은 값으로 다시 만들어 보고 다르면(잘못된 base64, 덧붙은 문자 등) 거부한다
  if (encodeCursor(anchor) !== cursor) throw new InvalidRequestError("Invalid cursor");
  return anchor;
}

/** 정렬된 목록에서 anchor보다 뒤에 오는 첫 항목의 위치(이분 탐색). 없으면 목록 길이 */
function firstIndexAfter(sorted: SortItem[], compare: Comparator, anchor: CursorAnchor): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(anchor, sorted[mid]!) < 0) high = mid;
    else low = mid + 1;
  }
  return low;
}
