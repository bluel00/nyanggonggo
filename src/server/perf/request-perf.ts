import type { ImageSizeResult, ImageSizeTiming } from "../images/image-size";
import type { UpstreamPageCache } from "../upstream/client";

/**
 * 요청 단위 계측(architecture.md 12절 52). 상세 첫 방문의 지연을 콜드 스타트, 공공 API, 사진 크기 읽기로 나눠 보려고 쓴다.
 * 요청마다 JSON 한 줄을 서버 로그(stdout, Vercel에서는 info)에 남긴다. 기록만 하고 동작은 바꾸지 않는다.
 * 서비스키, 공공 API URL, 사진 URL은 넣지 않는다(공고 id는 공개 정보라 남긴다).
 */

export type PerfKind = "detail" | "list";

/**
 * 업스트림 페이지 캐시 결과. miss: 받아서 검증까지 기다렸다. stale: 만료된 값을 바로 받고 갱신은 뒤에서 돈다
 * (`unstable_cache`가 load를 부르지만 결과를 기다리지 않는다). hit: load를 부르지 않았다.
 */
export type UpstreamCacheResult = "hit" | "stale" | "miss";

/** 업스트림 페이지 캐시를 감싸 시간과 적중 여부를 기록한다. 조립 지점(container)이 쓴다 */
export type PageCacheObserver = { observePageCache(cache: UpstreamPageCache): UpstreamPageCache };

export type PerfRecord = {
  perf: PerfKind;
  id?: string;
  /** 이 서버 인스턴스(모듈)가 계측한 첫 요청 */
  cold: boolean;
  /** 프로세스가 뜬 뒤 지난 시간. cold 판정의 보조(같은 함수 인스턴스가 다른 라우트를 먼저 처리했을 수 있다) */
  uptimeMs: number;
  /** 첫 페이지 요청 시작부터 마지막 페이지 끝까지(캐시 조회 포함). 페이지 요청이 없으면 없음 */
  upstreamMs?: number;
  upstreamCache?: UpstreamCacheResult;
  upstreamPages?: number;
  upstreamMisses?: number;
  /** 상세만. skip은 사진이 없거나 허용되지 않은 주소 */
  imageSizeMs?: number;
  imageSize?: ImageSizeResult;
  /** 상세만. imageSizeMs 중 캐시 조회·저장 시간(캐시를 쓸 때) */
  imageSizeCacheMs?: number;
  /** 상세만. imageSizeMs 중 원본 받기와 헤더 읽기 시간(원본을 받으러 갔을 때만) */
  imageSizeFetchMs?: number;
  totalMs: number;
  /** 상세: 공고 조회 성공 여부 */
  ok?: boolean;
  /** 목록: HTTP 상태 */
  status?: number;
};

export type RequestPerf = PageCacheObserver & {
  /** 사진 크기 읽기를 감싸 시간과 결과를 기록한다 */
  measureImageSize<T>(read: (onResult: (result: ImageSizeResult, timing?: ImageSizeTiming) => void) => Promise<T>): Promise<T>;
  skipImageSize(): void;
  /** 끝을 기록하고 로그 한 줄을 남긴다. 두 번째부터는 남기지 않는다 */
  finish(fields?: Pick<PerfRecord, "ok" | "status">): PerfRecord;
  /** Server-Timing 헤더 값. finish 뒤에 부른다 */
  serverTiming(): string;
};

export type RequestPerfOptions = {
  id?: string;
  now?: () => number;
  uptimeMs?: () => number;
  write?: (line: string) => void;
};

let servedFirst = false;

/** 이 모듈 인스턴스의 첫 요청이면 true. 한 번 부르면 이후는 false */
function takeCold(): boolean {
  const cold = !servedFirst;
  servedFirst = true;
  return cold;
}

/** 테스트용: cold 플래그를 처음 상태로 되돌린다 */
export function resetColdFlagForTest() {
  servedFirst = false;
}

export function createRequestPerf(kind: PerfKind, options: RequestPerfOptions = {}): RequestPerf {
  const now = options.now ?? (() => performance.now());
  const uptimeMs = options.uptimeMs ?? (() => process.uptime() * 1000);
  const write = options.write ?? ((line: string) => console.log(line));

  const startedAt = now();
  const cold = takeCold();
  const uptimeAtStart = uptimeMs();
  const pages: { start: number; end: number; result: UpstreamCacheResult }[] = [];
  let image: { ms: number; result: ImageSizeResult; timing: ImageSizeTiming } | undefined;
  let record: PerfRecord | undefined;

  return {
    observePageCache(cache) {
      return async (key, load) => {
        const start = now();
        let loading: "none" | "running" | "done" = "none";
        const observedLoad = async () => {
          loading = "running";
          try {
            return await load();
          } finally {
            loading = "done";
          }
        };
        try {
          return await cache(key, observedLoad);
        } finally {
          const result: UpstreamCacheResult = loading === "none" ? "hit" : loading === "done" ? "miss" : "stale";
          pages.push({ start, end: now(), result });
        }
      };
    },

    async measureImageSize(read) {
      const start = now();
      let result: ImageSizeResult = "error";
      let timing: ImageSizeTiming = {};
      try {
        return await read((value, valueTiming = {}) => {
          result = value;
          timing = valueTiming;
        });
      } finally {
        image = { ms: now() - start, result, timing };
      }
    },

    skipImageSize() {
      image = { ms: 0, result: "skip", timing: {} };
    },

    finish(fields = {}) {
      if (record) return record;
      record = {
        perf: kind,
        ...(options.id === undefined ? {} : { id: options.id }),
        cold,
        uptimeMs: Math.round(uptimeAtStart),
        ...upstreamFields(pages),
        ...(image ? imageFields(image) : {}),
        totalMs: Math.round(now() - startedAt),
        ...fields,
      };
      write(JSON.stringify(record));
      return record;
    },

    serverTiming() {
      const r = record;
      if (!r) return "";
      const metrics = [
        ...(r.upstreamMs === undefined ? [] : [`upstream;dur=${r.upstreamMs};desc="${r.upstreamCache}"`]),
        ...(r.imageSizeMs === undefined ? [] : [`imagesize;dur=${r.imageSizeMs};desc="${r.imageSize}"`]),
        `total;dur=${r.totalMs}`,
        ...(r.cold ? ["cold"] : []),
      ];
      return metrics.join(", ");
    },
  };
}

function upstreamFields(pages: { start: number; end: number; result: UpstreamCacheResult }[]): Partial<PerfRecord> {
  if (pages.length === 0) return {};
  const start = Math.min(...pages.map((p) => p.start));
  const end = Math.max(...pages.map((p) => p.end));
  const misses = pages.filter((p) => p.result === "miss").length;
  const cache: UpstreamCacheResult = misses > 0 ? "miss" : pages.some((p) => p.result === "stale") ? "stale" : "hit";
  return { upstreamMs: Math.round(end - start), upstreamCache: cache, upstreamPages: pages.length, upstreamMisses: misses };
}

function imageFields(image: { ms: number; result: ImageSizeResult; timing: ImageSizeTiming }): Partial<PerfRecord> {
  const { cacheMs, fetchMs } = image.timing;
  return {
    imageSizeMs: Math.round(image.ms),
    imageSize: image.result,
    ...(cacheMs === undefined ? {} : { imageSizeCacheMs: Math.round(cacheMs) }),
    ...(fetchMs === undefined ? {} : { imageSizeFetchMs: Math.round(fetchMs) }),
  };
}
