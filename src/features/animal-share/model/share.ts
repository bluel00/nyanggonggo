import { describeError, fingerprint } from "@/shared/lib/client-log";

/**
 * 공유(명세 UC-05). 카카오톡 공유를 먼저 시도하고, 할 수 없거나 실패하면 링크를 복사한다.
 * - 키 없음, SDK 미로드, init 실패, Share 미지원, sendDefault 예외 → 링크 복사 + "링크가 복사됐어요"
 * - 링크 복사도 실패 → "공유에 실패했어요. 링크로 대신 공유해보세요"
 * SDK, 클립보드, 토스트는 인자로 받아 테스트에서 가짜로 바꾼다.
 * 조용히 폴백하지 않도록 실패 경로마다 onIssue로 이유를 남긴다(화면에서는 콘솔 경고).
 */
export type ShareContent = {
  /** 상세 페이지 절대 URL */
  url: string;
  title: string;
  description: string;
  /** 썸네일 절대 URL(https) */
  imageUrl: string;
};

/** 카카오 JavaScript SDK 중 쓰는 부분만 */
export type KakaoSdk = {
  isInitialized(): boolean;
  init(key: string): void;
  Share?: { sendDefault(settings: Record<string, unknown>): void };
};

export type ShareResult = "kakao" | "copied" | "failed";

export const SHARE_MESSAGES = {
  copied: "링크가 복사됐어요",
  failed: "공유에 실패했어요. 링크로 대신 공유해보세요",
} as const;

/** 카카오 공유에 쓸 수 없는 호스트(폰에서 열 수 없다) */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/**
 * 공유 링크로 쓸 수 있는 절대 URL인지. http(s)여야 하고, 로컬 주소는 쓸 수 없다.
 * 링크가 없는(또는 열리지 않는) 카드를 보내느니 링크 복사로 폴백하는 편이 낫다.
 */
export function isShareableLink(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  return !url.includes("undefined") && !url.includes("null");
}

/** 폴백 이유를 알리는 콜백. 키 원문 같은 값은 넣지 않는다 */
export type ShareIssue = (message: string, detail?: Record<string, unknown>) => void;

export type ShareDeps = {
  kakaoKey: string;
  getKakao: () => KakaoSdk | undefined;
  copy: (text: string) => Promise<void>;
  notify: (message: string) => void;
  onIssue?: ShareIssue;
};

/**
 * 카카오 SDK 초기화. SDK를 불러온 직후(Script onLoad/onReady)와 공유 직전에 부른다.
 * 이미 초기화되어 있으면 아무것도 하지 않는다. 실패하면 이유를 남기고 false.
 */
export function initKakao(kakaoKey: string, kakao: KakaoSdk | undefined, onIssue: ShareIssue = () => {}): boolean {
  if (!kakaoKey) {
    onIssue("카카오 키가 비어 있어 초기화를 건너뜁니다(NEXT_PUBLIC_KAKAO_JS_KEY). 링크 복사로 동작합니다");
    return false;
  }
  if (!kakao) {
    onIssue("카카오 SDK가 아직 로드되지 않았습니다(window.Kakao 없음)");
    return false;
  }
  if (kakao.isInitialized()) return true;
  try {
    kakao.init(kakaoKey);
  } catch (error) {
    onIssue("Kakao.init이 실패했습니다", { key: fingerprint(kakaoKey), ...describeError(error) });
    return false;
  }
  if (!kakao.isInitialized()) {
    onIssue("Kakao.init 뒤에도 초기화되지 않았습니다", { key: fingerprint(kakaoKey) });
    return false;
  }
  return true;
}

export async function shareAnimal(content: ShareContent, deps: ShareDeps): Promise<ShareResult> {
  if (tryKakao(content, deps)) return "kakao";
  try {
    await deps.copy(content.url);
    deps.notify(SHARE_MESSAGES.copied);
    return "copied";
  } catch (error) {
    deps.onIssue?.("링크 복사도 실패했습니다", describeError(error));
    deps.notify(SHARE_MESSAGES.failed);
    return "failed";
  }
}

function tryKakao(content: ShareContent, deps: ShareDeps): boolean {
  const onIssue = deps.onIssue ?? (() => {});
  // 키가 없으면 SDK를 보지도 않는다(스크립트를 아예 불러오지 않는 경우)
  if (!deps.kakaoKey) {
    onIssue("카카오 키가 비어 있어 링크 복사로 공유합니다(NEXT_PUBLIC_KAKAO_JS_KEY)");
    return false;
  }
  const kakao = deps.getKakao();
  if (!initKakao(deps.kakaoKey, kakao, onIssue)) return false;
  if (!kakao?.Share) {
    onIssue("이 환경에서는 Kakao.Share를 쓸 수 없습니다");
    return false;
  }
  if (!isShareableLink(content.url)) {
    onIssue("공유 링크가 카카오에서 열 수 없는 주소라 카카오톡 공유를 건너뜁니다(로컬 주소 등). 링크 복사로 대신합니다", {
      url: content.url,
    });
    return false;
  }
  const link = { mobileWebUrl: content.url, webUrl: content.url };
  try {
    kakao.Share.sendDefault({
      objectType: "feed",
      content: { title: content.title, description: content.description, imageUrl: content.imageUrl, link },
      buttons: [{ title: "공고 보기", link }],
    });
    return true;
  } catch (error) {
    onIssue("Kakao.Share.sendDefault가 실패했습니다", { imageUrl: content.imageUrl, ...describeError(error) });
    return false;
  }
}
