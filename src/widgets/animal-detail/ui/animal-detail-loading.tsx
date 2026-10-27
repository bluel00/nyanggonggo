"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { animalKeys, getDetailEntry } from "@/entities/animal";
import { AnimalDetail } from "./animal-detail";
import { AnimalDetailSkeleton } from "./animal-detail-skeleton";

/**
 * 상세의 라우트 로딩 화면(architecture.md 7절 상세 로딩, 14.2 4단계 구조 D1).
 *
 * 목록 카드에서 들어왔고(진입 정보가 있고) 그 공고가 상세 캐시에 있으면 서버를 기다리지 않고 실제 상세를 그린다. 그래서 카드
 * 사진과 상세 사진 칸이 같은 커밋에 있어 전환이 짝을 이룬다. 서버 페이지가 오면 Next가 이 화면을 페이지로 바꾸고, 상세 위젯은
 * 진입 정보로 같은 화면을 이어 그린다(AnimalDetail).
 * 그 밖(공유 링크 직접 진입, 새로고침, 사진이 아직 로드되지 않은 카드)은 지금처럼 뼈대다.
 */
export function AnimalDetailLoading({ origin }: { origin: string }) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [fromCard] = useState(
    () => getDetailEntry(id) !== null && queryClient.getQueryData(animalKeys.detail(id)) !== undefined,
  );
  if (!fromCard) return <AnimalDetailSkeleton />;
  // 표시용 감싸개(테스트가 로딩 화면과 서버 페이지를 가른다). display: contents라 레이아웃은 서버 페이지와 같다
  return (
    <div data-slot="detail-preview" className="contents">
      <AnimalDetail id={id} origin={origin} />
    </div>
  );
}
