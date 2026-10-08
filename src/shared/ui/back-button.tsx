"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { hasVisitedList } from "../lib/app-navigation";
import { Button } from "./button";

/**
 * 뒤로가기. 앱 안에서 목록을 거쳐 왔으면 이전 화면으로(스크롤 위치와 필터가 그대로 살아난다),
 * 공유 링크나 북마크로 상세를 바로 열었으면 fallback(기본 목록)으로 간다.
 * 카카오톡 인앱 브라우저처럼 히스토리가 이미 쌓여 있는 경우 `history.length`로는 가릴 수 없어
 * 목록 화면을 거쳤는지를 따로 기록해 쓴다(architecture.md 12절 32).
 */
export function useGoBack(fallback = "/") {
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

const noSubscribe = () => () => {};

/**
 * 렌더에서 쓰는 canGoBackInApp. 서버 렌더와 그 하이드레이션에서는 false다(서버는 탭의 이동 기록을 모른다).
 * 상세에 바로 들어오면 서버가 그린 화면 그대로 false이고, 앱 안의 이동으로 새로 그릴 때는 처음부터 실제 값이다.
 */
export function useCanGoBackInApp(): boolean {
  return useSyncExternalStore(noSubscribe, canGoBackInApp, () => false);
}

/** 44x44 뒤로가기 아이콘 버튼(사진 위에서는 photo-pill 배경, handoff 화면 3) */
export function BackButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button variant="overlay" size="icon-touch" aria-label="뒤로가기" onClick={onClick} className={className}>
      <ChevronLeft aria-hidden strokeWidth={1.8} />
    </Button>
  );
}
