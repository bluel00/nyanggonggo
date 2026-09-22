"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "./button";

/**
 * 뒤로가기. 앱 안에서 들어왔으면(history가 있으면) 이전 화면으로, 링크로 바로 열었으면 fallback(기본 목록)으로.
 * 외부 사이트에서 같은 탭으로 들어온 경우까지 구분하지는 않는다(architecture.md 12절).
 */
export function useGoBack(fallback = "/") {
  const router = useRouter();
  return useCallback(() => {
    if (window.history.length > 1) router.back();
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
