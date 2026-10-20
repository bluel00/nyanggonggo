"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { APP_SCROLL_SELECTOR } from "./app-shell";

/**
 * 지금 화면 위에 얹는 전체 화면 층(PRD-v1.5, 상세). 컬럼 기준 `absolute`로 컬럼을 덮고 자기 스크롤 영역을 가진다.
 *
 * - 아래 화면(내부 스크롤 컨테이너)은 그대로 두고 `inert`만 건다: 눌리거나 초점을 받지 않고, 층이 덮고 있어 스크롤도 받지 않는다(R3).
 *   `overflow`를 바꾸지 않는다. 시험판은 `overflow: hidden`으로 막았는데, 돌아온 직후 잠깐 스크롤이 안 되고 아래 사진이 잘려
 *   보였다(EL 실기기): 스크롤 영역이 다시 만들어지는 동안으로 본다.
 * - `inert`는 층이 붙는 커밋에서 걸고(layout effect) 층이 빠지는 커밋에서 푼다(정리 함수도 같은 커밋에서 돈다). 층이 사라진 첫
 *   프레임부터 아래 화면이 스크롤·터치된다(R4).
 * - 층 스크롤은 바깥으로 이어지지 않는다(`overscroll-behavior: contain`). 상세가 화면보다 짧아도 1px 더 길게 두어 늘 스크롤되는
 *   영역이라, 맨 위에서 당겨도 문서로 넘어가 새로고침되지 않는다. 층이 있는 동안에는 문서의 당김도 끈다(globals.css). 목록 화면의
 *   기본 동작은 그대로다(R3).
 */
export function StackLayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const below = ref.current?.parentElement?.querySelector<HTMLElement>(`:scope > ${APP_SCROLL_SELECTOR}`);
    if (!below) return;
    below.inert = true;
    return () => {
      below.inert = false;
    };
  }, []);

  return (
    <div ref={ref} data-slot="stack-layer" className="absolute inset-0 z-30 flex flex-col bg-linear-to-b from-bg to-bg-end">
      <div data-slot="stack-layer-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="min-h-[calc(100%+1px)]">{children}</div>
      </div>
    </div>
  );
}
