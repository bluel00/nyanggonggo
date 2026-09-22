import { z } from "zod";

/**
 * 찜 저장소. localStorage에 animal id 배열만 저장한다(architecture.md 8절, 스냅샷 저장 안 함).
 * 읽을 때 Zod로 검증하고, 깨진 값(JSON 아님, 모양 다름)은 빈 배열로 본다. 저장은 다음 쓰기에서 올바른 값으로 덮인다.
 * 순서는 최근에 찜한 것이 앞이다. 같은 id는 한 번만 둔다.
 */
export const FAVORITES_STORAGE_KEY = "nyanggonggo:favorites";
const CHANGE_EVENT = "nyanggonggo:favorites-change";
const IdsSchema = z.array(z.string().regex(/^\d{1,32}$/));
const EMPTY: readonly string[] = Object.freeze([]);

let cachedRaw: string | null | undefined;
let cachedIds: readonly string[] = EMPTY;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // 접근이 막힌 환경(사생활 보호 모드 등)
  }
}

function parse(raw: string | null): readonly string[] {
  if (raw === null) return EMPTY;
  try {
    const result = IdsSchema.safeParse(JSON.parse(raw));
    return result.success ? Object.freeze([...new Set(result.data)]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** 같은 저장값이면 같은 배열(참조)을 돌려준다(useSyncExternalStore 요구 사항) */
export function readFavoriteIds(): readonly string[] {
  let raw: string | null;
  try {
    raw = storage()?.getItem(FAVORITES_STORAGE_KEY) ?? null;
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parse(raw);
  }
  return cachedIds;
}

function writeFavoriteIds(ids: readonly string[]): void {
  try {
    storage()?.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 저장 공간 부족 등. 화면은 다음 읽기 결과를 따른다
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 찜을 토글하고 토글 후 상태(찜이면 true)를 돌려준다 */
export function toggleFavorite(id: string): boolean {
  const current = readFavoriteIds();
  const next = current.includes(id) ? current.filter((v) => v !== id) : [id, ...current];
  writeFavoriteIds(next);
  return next.includes(id);
}

/** 같은 탭(CHANGE_EVENT)과 다른 탭(storage 이벤트)의 변경을 구독한다 */
export function subscribeFavorites(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FAVORITES_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export const EMPTY_FAVORITES = EMPTY;
