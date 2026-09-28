"use client";

import Script from "next/script";
import { useCallback, useState } from "react";
import type { Animal } from "@/entities/animal";
import { KAKAO_JS_KEY, SITE_URL } from "@/shared/config/public-env";
import { copyText } from "@/shared/lib/clipboard";
import { describeError, fingerprint, infoClientDev, warnClient } from "@/shared/lib/client-log";
import { cn } from "@/shared/lib/utils";
import { showToast } from "@/shared/ui/toast";
import { initKakao, shareAnimal, type KakaoSdk } from "../model/share";
import { buildShareContent, resolveShareOrigin } from "../model/share-content";

/**
 * 카카오 JavaScript SDK(Full SDK, minified). 2.8.3으로 고정한다.
 * integrity는 카카오 개발자 다운로드 페이지의 "integrity 값만 복사"로 받은 값이다(2026-09-22). 재계산하거나 고치지 않는다.
 * **SDK 버전을 바꾸면 URL과 integrity를 반드시 같이 갱신한다.** 해시가 맞지 않으면 브라우저가 스크립트를 차단하고,
 * 공유는 조용히 링크 복사로 폴백한다(SRI 오류는 개발자 도구 콘솔에만 보인다).
 */
export const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js";
export const KAKAO_SDK_INTEGRITY = "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";

const getKakao = () => (window as unknown as { Kakao?: KakaoSdk }).Kakao;

/**
 * 카카오톡 공유 버튼(bundle.css .cn-btn--share: kakao 배경, on-kakao 글자, 남은 폭).
 *
 * 키가 있을 때만 SDK를 불러오고, **불러온 직후 바로 Kakao.init을 호출한다**(onLoad/onReady).
 * 예전에는 공유를 누를 때만 init해서 새로고침 직후 `Kakao.isInitialized()`가 계속 false였다.
 * 로드 전략도 lazyOnload(아주 늦게 로드)에서 afterInteractive로 바꿔, 버튼을 일찍 눌러도 SDK가 준비되게 한다.
 * 실패는 조용히 넘어가지 않고 콘솔 경고로 남긴다.
 */
export function ShareButton({
  animal,
  kakaoKey = KAKAO_JS_KEY,
  siteUrl = SITE_URL,
}: {
  animal: Animal;
  kakaoKey?: string;
  /** 공유 링크의 기준 주소. 비면 현재 접속한 주소 */
  siteUrl?: string;
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
      const content = buildShareContent(animal, resolveShareOrigin(window.location.origin, siteUrl), new Date());
      infoClientDev("share", "공유 링크", { url: content.url, imageUrl: content.imageUrl });
      await shareAnimal(content, { kakaoKey, getKakao, copy: copyText, notify: showToast, onIssue });
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
          "inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-pill bg-kakao px-6 text-card-title text-kakao-fg",
          "transition-transform duration-press ease-out active:not-disabled:scale-press active:not-disabled:brightness-95",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <KakaoIcon />
        카카오톡 공유
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
