/**
 * 공유(명세 UC-05). 카카오톡 공유를 먼저 시도하고, 할 수 없거나 실패하면 링크를 복사한다.
 * - 키 없음, SDK 미로드, init 실패, Share 미지원, sendDefault 예외 → 링크 복사 + "링크가 복사됐어요"
 * - 링크 복사도 실패 → "공유에 실패했어요. 링크로 대신 공유해보세요"
 * SDK, 클립보드, 토스트는 인자로 받아 테스트에서 가짜로 바꾼다.
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

export type ShareDeps = {
  kakaoKey: string;
  getKakao: () => KakaoSdk | undefined;
  copy: (text: string) => Promise<void>;
  notify: (message: string) => void;
};

export async function shareAnimal(content: ShareContent, deps: ShareDeps): Promise<ShareResult> {
  if (deps.kakaoKey && tryKakao(content, deps)) return "kakao";
  try {
    await deps.copy(content.url);
    deps.notify(SHARE_MESSAGES.copied);
    return "copied";
  } catch {
    deps.notify(SHARE_MESSAGES.failed);
    return "failed";
  }
}

function tryKakao(content: ShareContent, deps: ShareDeps): boolean {
  try {
    const kakao = deps.getKakao();
    if (!kakao?.Share) return false;
    if (!kakao.isInitialized()) kakao.init(deps.kakaoKey);
    const link = { mobileWebUrl: content.url, webUrl: content.url };
    kakao.Share.sendDefault({
      objectType: "feed",
      content: { title: content.title, description: content.description, imageUrl: content.imageUrl, link },
      buttons: [{ title: "공고 보기", link }],
    });
    return true;
  } catch {
    return false;
  }
}
