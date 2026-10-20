/**
 * 목록 카드 → 상세 진입 정보(architecture.md 14.2 4단계, 구조 D1). 카드를 누르는 순간 목록 위젯이 남기고 상세 위젯이 읽는다.
 *
 * 상세의 라우트 로딩(loading.tsx)은 이 정보와 목록 데이터(상세 쿼리 캐시에 미리 채움)로 뼈대 대신 실제 상세를 그린다. 그래서
 * 카드 사진과 상세 사진 칸이 같은 커밋에 있어 View Transition이 짝을 이룬다. 서버 페이지가 오면 Next가 로딩을 페이지로
 * 바꾸는데(다시 마운트), 그때 이어 그릴 것도 여기 둔다: 카드에서 이미 받은 사진 주소(새로 받거나 비지 않게), 보던 사진 위치,
 * 전환 시작 시각(정보 페이드를 끊기지 않게 이어 간다).
 *
 * 메모리에만 둔다(새로고침·공유 링크 직접 진입에는 없어 지금처럼 뼈대가 보인다).
 */

/** 카드 사진의 실제 가로·세로(로드된 img의 natural 크기. 프록시는 비율을 유지한다) */
export type CardPhotoSize = { width: number; height: number };

/**
 * 진입 효과. morph: 카드 사진이 상세 사진 칸으로 커진다(View Transitions). fade: 전환을 지원하지 않는 브라우저, 사진과
 * 정보만 200ms 페이드. none: 효과 없음(종료 공고, 움직임 줄이기).
 */
export type DetailEntryMode = "morph" | "fade" | "none";

export type DetailEntry = {
  id: string;
  /** 카드 img가 실제로 쓴 주소(currentSrc). 상세 첫 사진이 같은 주소를 써 새로 받거나 디코드를 기다리지 않는다 */
  photoSrc: string;
  photoSize: CardPhotoSize;
  mode: DetailEntryMode;
  /** 누른 시각(performance.now()). 정보 페이드를 이 시각 기준으로 이어 그린다 */
  startedAt: number;
  /** 상세에서 보던 사진 위치. 로딩 화면 → 서버 페이지로 바뀔 때 이어 받는다 */
  photoIndex: number;
  /** 상세가 이미 한 번 그려졌다(로딩 화면). 서버 페이지로 바뀔 때 스크롤을 다시 맨 위로 올리지 않는다 */
  shown: boolean;
};

const entries = new Map<string, DetailEntry>();

export function startDetailEntry(entry: Omit<DetailEntry, "startedAt" | "photoIndex" | "shown">): DetailEntry {
  const started: DetailEntry = { ...entry, startedAt: performance.now(), photoIndex: 0, shown: false };
  entries.set(entry.id, started);
  return started;
}

export function getDetailEntry(id: string): DetailEntry | null {
  return entries.get(id) ?? null;
}

export function setDetailEntryPhotoIndex(id: string, photoIndex: number): void {
  const entry = entries.get(id);
  if (entry) entry.photoIndex = photoIndex;
}

/** 상세를 떠날 때 지운다(다음 진입은 다시 카드에서 시작한다) */
export function clearDetailEntry(id: string): void {
  entries.delete(id);
}

/** 테스트용 */
export function resetDetailEntriesForTest(): void {
  entries.clear();
}

/** 진입 효과를 고른다. 종료 공고·움직임 줄이기는 효과 없음, View Transitions가 없으면 페이드 */
export function chooseDetailEntryMode(ended: boolean): DetailEntryMode {
  if (ended || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "none";
  return typeof document.startViewTransition === "function" ? "morph" : "fade";
}
