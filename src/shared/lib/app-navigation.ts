"use client";

/**
 * 이 탭에서 앱 안의 목록 화면을 거쳐 왔는지. sessionStorage에 두어 **같은 탭의 새로고침에도 남고**
 * (카카오톡 공유를 다녀오며 브라우저가 탭을 다시 불러오는 경우 포함), 새 탭이면 false로 시작한다(PRD-v1.4 R1).
 * 메모리 변수였을 때는 상세에서 새로고침하면 표시가 사라져, 목록에서 온 사람의 뒤로가기가 원래 목록으로 가지 못했다.
 *
 * `history.length`만으로는 공유 링크로 바로 들어온 경우를 가려낼 수 없다. 카카오톡 인앱 브라우저나
 * 다른 사이트에서 같은 탭으로 들어오면 히스토리가 이미 쌓여 있어, 뒤로가기가 앱 밖으로 나가 버린다.
 * 저장소를 쓸 수 없으면(사생활 보호 모드 등) 표시가 없는 것으로 본다(화면 안 뒤로가기는 `/`로 간다).
 */
export const VISITED_LIST_KEY = "nyanggonggo:visited-list";

/** 목록 화면(목록, 찜 목록)이 마운트되면 부른다 */
export function markListVisited(): void {
  try {
    sessionStorage.setItem(VISITED_LIST_KEY, "1");
  } catch {
    // 저장 실패는 무시(표시가 없는 것으로 본다)
  }
}

export function hasVisitedList(): boolean {
  try {
    return sessionStorage.getItem(VISITED_LIST_KEY) === "1";
  } catch {
    return false;
  }
}
