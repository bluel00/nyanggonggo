"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
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
    if (hasVisitedList() && window.history.length > 1) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}

/** 44x44 뒤로가기 아이콘 버튼(사진 위에서는 photo-pill 배경, handoff 화면 3) */
export function BackButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button variant="overlay" size="icon-touch" aria-label="뒤로가기" onClick={onClick} className={className}>
      <ChevronLeft aria-hidden strokeWidth={1.8} />
    </Button>
  );
}
