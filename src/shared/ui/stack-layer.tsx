"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { APP_SCROLL_SELECTOR } from "./app-shell";

const LAYER_SLOT = "stack-layer";
/** 층 밖에 열린 다른 대화상자(사진 크게 보기, 바텀시트). 이것이 있으면 Esc는 그쪽이 닫는다 */
const OTHER_DIALOG = `[role="dialog"]:not([data-slot="${LAYER_SLOT}"])`;

/**
 * 지금 화면 위에 얹는 전체 화면 층(PRD-v1.5, 상세). 컬럼 기준 `absolute`로 컬럼을 덮고 자기 스크롤 영역을 가진다.
 *
 * - 아래 화면(내부 스크롤 컨테이너)은 그대로 두고 `inert`만 건다: 눌리거나 초점을 받지 않고, 화면 읽기 도구에도 읽히지 않으며, 층이
 *   덮고 있어 스크롤도 받지 않는다(R3). `overflow`를 바꾸지 않는다. 시험판은 `overflow: hidden`으로 막았는데, 돌아온 직후 잠깐
 *   스크롤이 안 되고 아래 사진이 잘려 보였다(EL 실기기): 스크롤 영역이 다시 만들어지는 동안으로 본다.
 * - `inert`는 층이 붙는 커밋에서 걸고(layout effect) 층이 빠지는 커밋에서 푼다(정리 함수도 같은 커밋에서 돈다). 층이 사라진 첫
 *   프레임부터 아래 화면이 스크롤·터치된다(R4).
 * - 층 스크롤은 바깥으로 이어지지 않는다(`overscroll-behavior: contain`). 상세가 화면보다 짧아도 1px 더 길게 두어 늘 스크롤되는
 *   영역이라, 맨 위에서 당겨도 문서로 넘어가 새로고침되지 않는다. 층이 있는 동안에는 문서의 당김도 끈다(globals.css). 목록 화면의
 *   기본 동작은 그대로다(R3).
 * - 접근성: 층은 모달 대화상자(`role="dialog"`, `aria-modal`)이고 이름은 `labelledBy`(상세 제목)다. 제목이 아직 없으면(뼈대) `label`.
 *   열리면 초점을 층 안으로 옮기고(제목, 없으면 첫 버튼·링크 = 뒤로가기), 닫히면 연 요소(누른 카드)로 되돌린다. 로딩 화면이 상세로
 *   바뀌며 초점을 가진 요소가 빠지면 다시 옮긴다. 키보드로 열었는지(연 카드가 :focus-visible)를 `data-opened-by`로 남긴다: 제목의
 *   초점 테두리는 키보드로 열었을 때만 그린다. WebKit은 스크립트로 옮긴 초점을, 그 전에 초점이 없었으면(터치·클릭은 링크에 초점을
 *   주지 않는다) :focus-visible로 보아 터치로 열어도 테두리가 그려졌다. Esc는 뒤로가기(`router.back()`)로 닫는다. 층 밖에 다른 대화상자(사진 크게 보기 등)가
 *   열려 있으면 Esc는 그쪽 것이다.
 */
export function StackLayer({ children, labelledBy, label }: { children: ReactNode; labelledBy: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    const layer = ref.current;
    const below = layer?.parentElement?.querySelector<HTMLElement>(`:scope > ${APP_SCROLL_SELECTOR}`);
    if (!layer || !below) return;
    // inert를 걸면 아래 화면에 있던 초점이 빠지므로 먼저 기억한다(마우스로 누르면 링크가 초점을 받지 않는 브라우저도 있다)
    const opener = document.activeElement instanceof HTMLElement && below.contains(document.activeElement) ? document.activeElement : null;
    layer.dataset.openedBy = opener?.matches(":focus-visible") ? "keyboard" : "pointer";
    below.inert = true;

    const focusInside = () => {
      const title = document.getElementById(labelledBy);
      const target = title && layer.contains(title) ? title : layer.querySelector<HTMLElement>("button, a[href]");
      target?.focus({ preventScroll: true });
    };
    focusInside();
    // 로딩 화면 → 상세(다시 마운트)처럼 초점을 가진 요소가 빠지면 초점을 잃는다. 그때만 다시 층 안으로 옮긴다. 브라우저는 다음
    // 그리기 단계에서야 초점을 문서(body)로 돌리므로, 빠진 요소를 아직 가리키는 경우도 잃은 것으로 보고 다음 프레임에도 한 번 더 본다
    const lost = () => {
      const active = document.activeElement;
      return active === null || active === document.body || !active.isConnected;
    };
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (lost()) focusInside();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (lost()) focusInside();
      });
    });
    // React는 숨겨 둔 내용을 보일 때 노드를 바꾸지 않고 style만 바꾸기도 한다(Suspense)
    observer.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden"] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      below.inert = false;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [labelledBy]);

  useLayoutEffect(() => {
    let closing = false;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || closing) return;
      if (document.querySelector(OTHER_DIALOG)) return;
      closing = true;
      router.back();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div
      ref={ref}
      data-slot={LAYER_SLOT}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={label}
      className="absolute inset-0 z-30 flex flex-col bg-linear-to-b from-bg to-bg-end"
    >
      <div data-slot="stack-layer-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="min-h-[calc(100%+1px)]">{children}</div>
      </div>
    </div>
  );
}
