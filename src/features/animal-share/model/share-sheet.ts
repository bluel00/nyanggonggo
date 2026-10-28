import { describeError } from "@/shared/lib/client-log";
import { copyLink, SHARE_MESSAGES, type ShareIssue } from "./share";

/**
 * 다른 앱으로 공유(용어 사전, #94). 기기의 공유 시트(Web Share)를 열어 공유 내용의 제목과 주소만 넘긴다.
 * 공유 시트를 열 수 없으면 같은 자리 버튼이 "링크 복사"다.
 */

/** 공유 시트에 쓰는 navigator 부분 */
export type ShareSheetNavigator = {
  share?: (data: { title?: string; url?: string }) => Promise<void>;
  canShare?: (data: { url?: string }) => boolean;
};

/**
 * 공유 시트를 열 수 있는지. `navigator.share`가 있고, `navigator.canShare`가 있으면 `canShare({ url })`가 참이어야 한다.
 * 기기 종류를 짐작하지 않는다. 이 함수는 SHARE_SHEET_SCRIPT에 문자열로 들어가 첫 그림 전에 브라우저에서 그대로 돈다.
 * 그래서 바깥 이름(import, 상수)을 쓰지 않는다.
 */
export function canOpenShareSheet(nav: ShareSheetNavigator | undefined, url: string): boolean {
  if (!nav || typeof nav.share !== "function") return false;
  if (typeof nav.canShare !== "function") return true;
  try {
    return nav.canShare({ url }) === true;
  } catch {
    return false;
  }
}

/** 공유 시트를 열 수 있으면 `<html>`에 붙는 속성. 두 번째 공유 버튼은 이 속성으로 이름표를 고른다(CSS) */
export const SHARE_SHEET_ATTR = "data-share-sheet";

/**
 * 첫 그림 전에 `<head>`에서 도는 스크립트(app/layout.tsx). 공유 시트를 열 수 있으면 `<html data-share-sheet>`를 단다.
 * 판정은 서버가 알 수 없으므로, 서버 렌더와 하이드레이션은 두 이름표를 모두 그리고 CSS가 이 속성으로 하나만 보인다.
 * 그래서 서버와 첫 클라이언트 렌더가 같고, 그린 뒤에 이름표가 바뀌어 바가 흔들리는 일이 없다.
 * 주소는 지금 페이지 주소로 판정한다(누를 때는 공유 내용의 주소로 다시 판정한다).
 */
export const SHARE_SHEET_SCRIPT = `try{if((${canOpenShareSheet.toString()})(navigator,location.href))document.documentElement.setAttribute(${JSON.stringify(SHARE_SHEET_ATTR)},"")}catch(e){}`;

export type ShareSheetResult = "shared" | "cancelled" | "copied" | "failed";

export type ShareSheetDeps = {
  nav: ShareSheetNavigator | undefined;
  copy: (text: string) => Promise<void>;
  notify: (message: string) => void;
  onIssue?: ShareIssue;
};

/**
 * 두 번째 공유 버튼을 눌렀을 때. 공유 시트를 열 수 있으면 제목과 주소만 넘겨 연다.
 * - 사용자가 시트를 닫음(AbortError): 아무것도 하지 않는다(토스트 없음)
 * - 그 밖의 실패, 또는 시트를 열 수 없음: 링크 복사 + "링크가 복사됐어요"
 */
export async function shareViaSheet(target: { title: string; url: string }, deps: ShareSheetDeps): Promise<ShareSheetResult> {
  const { nav } = deps;
  if (nav?.share && canOpenShareSheet(nav, target.url)) {
    try {
      await nav.share({ title: target.title, url: target.url });
      return "shared";
    } catch (error) {
      // DOMException이 Error를 잇지 않는 환경도 있어 이름으로 본다
      if ((error as { name?: unknown } | null)?.name === "AbortError") return "cancelled";
      deps.onIssue?.("공유 시트가 실패해 링크 복사로 대신합니다", describeError(error));
    }
  }
  return copyLink(target.url, SHARE_MESSAGES.copied, deps);
}
