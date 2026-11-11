"use client";

import { Link as LinkIcon, Share2 } from "lucide-react";
import type { Animal } from "@/entities/animal";
import { copyText } from "@/shared/lib/clipboard";
import { warnClient } from "@/shared/lib/client-log";
import { Button } from "@/shared/ui/button";
import { showToast } from "@/shared/ui/toast";
import { buildShareContent } from "../model/share-content";
import { shareViaSheet } from "../model/share-sheet";

/** 두 번째 공유 버튼 이름표(용어 사전 "다른 앱으로 공유", "링크 복사") */
export const SHARE_SHEET_LABEL = "다른 앱으로 공유";
export const COPY_LINK_LABEL = "링크 복사";

/** 이름표 하나(아이콘 + 6 + 글자). 아이콘은 숨기고 보이는 글자가 접근성 이름이다. 아이콘 크기(18)는 Button의 compact-touch가 정한다 */
const LABEL = "items-center gap-1.5";

/**
 * 상세 하단 바의 두 번째 공유 버튼(디자인 시스템 `ShareButton variant="other"`, #94). 모양은 공용 Button의 `surface` + `compact-touch`이고
 * (handoff (m), #126), 여기서는 이름표·아이콘·동작과 바 안의 자리(내용 폭, shrink-0)만 정한다.
 *
 * 공유 시트를 열 수 있으면 "다른 앱으로 공유"(Share2), 없으면 "링크 복사"(Link)다. 열 수 있는지는 브라우저에서만 알 수 있어
 * 두 이름표를 모두 그리고, 첫 그림 전에 `<head>` 스크립트(SHARE_SHEET_SCRIPT, app/layout.tsx)가 단 `<html data-share-sheet>`로
 * CSS가 하나만 보인다. 숨긴 쪽은 display:none이라 접근성 이름에도 들어가지 않는다. 서버 렌더와 첫 클라이언트 렌더가 같고,
 * 이름표가 바뀌며 바가 흔들리지 않는다.
 */
export function ShareSheetButton({
  animal,
  origin,
}: {
  animal: Animal;
  /** 공유 주소 기준(서버 siteOrigin의 origin, 끝 슬래시 없음). og:url과 같은 기준이다 */
  origin: string;
}) {
  async function handleClick() {
    const content = buildShareContent(animal, { origin, now: new Date() });
    await shareViaSheet(
      { title: content.title, url: content.url },
      { nav: navigator, copy: copyText, notify: showToast, onIssue: (message, detail) => warnClient("share", message, detail) },
    );
  }

  return (
    <Button
      type="button"
      variant="surface"
      size="compact-touch"
      onClick={handleClick}
      data-slot="share-sheet-button"
      className="shrink-0"
    >
      <span data-share-mode="sheet" className={`hidden ${LABEL} [:root[data-share-sheet]_&]:inline-flex`}>
        <Share2 aria-hidden />
        {SHARE_SHEET_LABEL}
      </span>
      <span data-share-mode="copy" className={`inline-flex ${LABEL} [:root[data-share-sheet]_&]:hidden`}>
        <LinkIcon aria-hidden />
        {COPY_LINK_LABEL}
      </span>
    </Button>
  );
}
