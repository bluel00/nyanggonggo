"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { AnimalListFilter } from "@/entities/animal";
import { toFilterHref } from "./filter";
import { rememberRegion } from "./region-cookie";

/**
 * 필터를 URL에 반영한다. push가 아니라 replace: 필터를 바꿀 때마다 히스토리가 쌓이면 뒤로가기로 목록 밖(이전 페이지)에
 * 나가기까지 여러 번 눌러야 한다. 필터 상태는 공유 가능한 URL로 남으므로 되돌아갈 필요가 적다.
 * scroll: false — 스크롤은 문서가 아니라 내부 컨테이너라 목록 위젯이 필터 변경 시 맨 위로 올린다.
 *
 * 여기가 "사용자가 지역을 직접 고른" 유일한 지점이라, 고른 지역을 쿠키에 기억한다. 공유 링크로 들어온 상세의
 * 뒤로가기(focus 흐름)나 지역이 붙은 링크로 들어온 경우는 이 경로를 타지 않으므로 기억하지 않는다(7절).
 */
export function useApplyAnimalFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (filter: AnimalListFilter) => {
      rememberRegion({ region: filter.region, district: filter.district });
      router.replace(toFilterHref(pathname, filter, new URLSearchParams(searchParams.toString())), { scroll: false });
    },
    [router, pathname, searchParams],
  );
}
