"use client";

import { useCallback, useSyncExternalStore } from "react";
import { showToast } from "@/shared/ui/toast";
import { EMPTY_FAVORITES, readFavoriteIds, subscribeFavorites, toggleFavorite } from "./favorites-store";

/** 찜한 id 목록(최근 순). 서버 렌더에서는 빈 목록이고 클라이언트에서 저장값으로 바뀐다 */
export function useFavoriteIds(): readonly string[] {
  return useSyncExternalStore(subscribeFavorites, readFavoriteIds, () => EMPTY_FAVORITES);
}

/** 한 공고의 찜 상태와 토글. 카드와 상세가 같은 저장소를 보므로 어디서 바꿔도 함께 바뀐다 */
export function useFavorite(id: string) {
  const ids = useFavoriteIds();
  const toggle = useCallback(() => {
    const saved = toggleFavorite(id);
    showToast(saved ? "찜에 저장했어요" : "찜을 해제했어요");
  }, [id]);
  return { isFavorite: ids.includes(id), toggle };
}
