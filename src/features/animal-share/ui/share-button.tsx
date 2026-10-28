"use client";

import Script from "next/script";
import { useCallback, useState } from "react";
import type { Animal } from "@/entities/animal";
import { KAKAO_JS_KEY } from "@/shared/config/public-env";
import { routes } from "@/shared/config/routes";
import { copyText } from "@/shared/lib/clipboard";
import { describeError, fingerprint, infoClientDev, warnClient } from "@/shared/lib/client-log";
import { cn } from "@/shared/lib/utils";
import { showToast } from "@/shared/ui/toast";
import { initKakao, shareAnimal, toShareCard, type KakaoSdk } from "../model/share";
import { buildShareContent } from "../model/share-content";

/**
 * 카카오 JavaScript SDK(Full SDK, minified). 2.8.3으로 고정한다.
 * integrity는 카카오 개발자 다운로드 페이지의 "integrity 값만 복사"로 받은 값이다(2026-09-22). 재계산하거나 고치지 않는다.
 * **SDK 버전을 바꾸면 URL과 integrity를 반드시 같이 갱신한다.** 해시가 맞지 않으면 브라우저가 스크립트를 차단하고,
 * 공유는 조용히 링크 복사로 폴백한다(SRI 오류는 개발자 도구 콘솔에만 보인다).
 */
export const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js";
export const KAKAO_SDK_INTEGRITY = "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";

const getKakao = () => (window as unknown as { Kakao?: KakaoSdk }).Kakao;

/** 공유 버튼 글자 */
export const SHARE_BUTTON_LABEL = "카카오톡 공유";

/**
 * 카카오톡 공유 버튼(bundle.css .cn-btn--share: kakao 배경, on-kakao 글자, 남은 폭). 옆에 두 번째 공유 버튼이 있어
 * 양옆 안쪽 여백은 space-2다(두 버튼이 375 폭에 들어가게, ShareButton README). 누름은 움직임이 허용될 때만 press-scale이다.
 *
 * 키가 있을 때만 SDK를 불러오고, **불러온 직후 바로 Kakao.init을 호출한다**(onLoad/onReady).
 * 예전에는 공유를 누를 때만 init해서 새로고침 직후 `Kakao.isInitialized()`가 계속 false였다.
 * 로드 전략도 lazyOnload(아주 늦게 로드)에서 afterInteractive로 바꿔, 버튼을 일찍 눌러도 SDK가 준비되게 한다.
 * 실패는 조용히 넘어가지 않고 콘솔 경고로 남긴다.
 *
 * 공유 카드와 링크 복사의 주소 기준(origin)은 서버의 siteOrigin()을 상세 페이지가 받아 넘긴 값이다(링크 미리보기 og:url과 같은 기준, #73).
 * 배포 도메인은 카카오 개발자 콘솔 [플랫폼 > Web 사이트 도메인]에도 등록되어 있어야 카드의 링크가 동작한다.
 */
export function ShareButton({
  animal,
  origin,
  kakaoKey = KAKAO_JS_KEY,
}: {
  animal: Animal;
  /** 공유 주소 기준(서버 siteOrigin의 origin, 끝 슬래시 없음) */
  origin: string;
  kakaoKey?: string;
}) {
  const [busy, setBusy] = useState(false);

  const onIssue = useCallback((message: string, detail?: Record<string, unknown>) => {
    warnClient("share", message, detail);
  }, []);

  const initialize = useCallback(() => {
    if (initKakao(kakaoKey, getKakao(), onIssue)) {
      infoClientDev("share", "카카오 SDK 초기화 완료", { key: fingerprint(kakaoKey) });
    }
  }, [kakaoKey, onIssue]);

  async function handleClick() {
    setBusy(true);
    try {
      // 공유 요약의 기준 시각은 버튼을 누른 기기의 시각이다(링크 미리보기는 서버 시각, #57)
      const content = buildShareContent(animal, { origin, now: new Date() });
      const card = toShareCard(content, { origin, fallbackImagePath: routes.detailOgImage(animal.id) });
      infoClientDev("share", "공유 링크", { url: card.url, imageUrl: card.imageUrl });
      await shareAnimal(card, { kakaoKey, getKakao, copy: copyText, notify: showToast, onIssue });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {kakaoKey && (
        <Script
          id="kakao-sdk"
          src={KAKAO_SDK_URL}
          integrity={KAKAO_SDK_INTEGRITY}
          crossOrigin="anonymous"
          strategy="afterInteractive"
          onLoad={initialize}
          onReady={initialize}
          onError={(error) => onIssue("카카오 SDK를 불러오지 못했습니다(SRI 불일치, 네트워크 차단 등)", describeError(error))}
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        data-slot="share-button"
        className={cn(
          "inline-flex min-h-touch min-w-0 flex-1 items-center justify-center gap-1 rounded-pill bg-kakao px-2 text-card-title text-kakao-fg",
          "transition-[scale] duration-press ease-out motion-safe:active:not-disabled:scale-press active:not-disabled:brightness-95",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <KakaoIcon />
        {SHARE_BUTTON_LABEL}
      </button>
    </>
  );
}

/** 말풍선(bundle.js ChatIcon) */
function KakaoIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 3.5c-5.2 0-9.3 3.3-9.3 7.4 0 2.6 1.7 4.9 4.3 6.2l-.9 3.3c-.1.3.2.5.5.4l3.9-2.6c.5.1 1 .1 1.5.1 5.2 0 9.3-3.3 9.3-7.4S17.2 3.5 12 3.5z" />
    </svg>
  );
}
