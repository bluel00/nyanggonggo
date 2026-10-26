"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { routes } from "../config/routes";
import { hasVisitedList } from "../lib/app-navigation";
import { Button } from "./button";

/**
 * 뒤로가기. 앱 안에서 목록을 거쳐 왔으면 이전 화면으로(스크롤 위치와 필터가 그대로 살아난다),
 * 공유 링크나 북마크로 상세를 바로 열었으면 fallback(기본은 진입 경로: 기억한 목록, 없으면 홈)으로 간다.
 * 카카오톡 인앱 브라우저처럼 히스토리가 이미 쌓여 있는 경우 `history.length`로는 가릴 수 없어
 * 목록 화면을 거쳤는지를 따로 기록해 쓴다(architecture.md 12절 32).
 */
export function useGoBack(fallback = routes.entry()) {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBackInApp()) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}

/** 앱 안에서 들어와 브라우저 뒤로가기로 이전 화면에 돌아갈 수 있는지(useGoBack과 같은 판단) */
export function canGoBackInApp(): boolean {
  return hasVisitedList() && window.history.length > 1;
}

/**
 * 44x44 뒤로가기 아이콘 버튼(사진 위에서는 photo-pill 배경, handoff 화면 3).
 *
 * href를 주면 링크(`<a>`)로 그린다. 하이드레이션 전에도 눌리게 하려는 것이다: 상세에 바로 들어와 로딩 뼈대가 떠 있는 동안
 * 뼈대는 아직 끝나지 않은 Suspense 경계의 대체 화면이라 React가 하이드레이션하지 않고, 버튼의 onClick은 붙지 않는다
 * (그때 누른 것은 사라진다). 링크면 브라우저가 href로 간다. 하이드레이션된 뒤에는 onClick이 대신한다(새 탭 열기 등 보조 클릭은 그대로).
 */
export function BackButton({ onClick, href, className }: { onClick: () => void; href?: string; className?: string }) {
  if (href !== undefined) {
    return (
      <Button asChild variant="overlay" size="icon-touch" className={className}>
        <a
          href={href}
          aria-label="뒤로가기"
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onClick();
          }}
        >
          <ChevronLeft aria-hidden strokeWidth={1.8} />
        </a>
      </Button>
    );
  }
  return (
    <Button variant="overlay" size="icon-touch" aria-label="뒤로가기" onClick={onClick} className={className}>
      <ChevronLeft aria-hidden strokeWidth={1.8} />
    </Button>
  );
}
