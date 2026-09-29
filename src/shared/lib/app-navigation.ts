"use client";

/**
 * 이 문서(탭)에서 앱 안의 목록 화면을 거쳐 왔는지. 모듈 변수라 새로고침이나 새 탭이면 false로 시작하고,
 * 앱 안의 이동(클라이언트 내비게이션)에서는 그대로 남는다.
 *
 * `history.length`만으로는 공유 링크로 바로 들어온 경우를 가려낼 수 없다. 카카오톡 인앱 브라우저나
 * 다른 사이트에서 같은 탭으로 들어오면 히스토리가 이미 쌓여 있어, 뒤로가기가 앱 밖으로 나가 버린다.
 */
let visitedList = false;

/** 목록 화면(홈, 찜 목록)이 마운트되면 부른다 */
export function markListVisited(): void {
  visitedList = true;
}

export function hasVisitedList(): boolean {
  return visitedList;
}
