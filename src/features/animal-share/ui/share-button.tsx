"use client";

import Script from "next/script";
import { useState } from "react";
import type { Animal } from "@/entities/animal";
import { KAKAO_JS_KEY } from "@/shared/config/public-env";
import { copyText } from "@/shared/lib/clipboard";
import { cn } from "@/shared/lib/utils";
import { showToast } from "@/shared/ui/toast";
import { shareAnimal, type KakaoSdk } from "../model/share";
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

/**
 * 카카오톡 공유 버튼(bundle.css .cn-btn--share: kakao 배경, on-kakao 글자, 남은 폭).
 * 키가 있을 때만 SDK를 불러오고, 없으면 바로 링크 복사로 동작한다.
 */
export function ShareButton({ animal, kakaoKey = KAKAO_JS_KEY }: { animal: Animal; kakaoKey?: string }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const content = buildShareContent(animal, window.location.origin, new Date());
      await shareAnimal(content, { kakaoKey, getKakao, copy: copyText, notify: showToast });
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
          strategy="lazyOnload"
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
