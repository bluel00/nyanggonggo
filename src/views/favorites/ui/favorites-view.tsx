import { ScreenShell } from "@/shared/ui/screen-shell";
import { FavoriteList, FavoriteListHeader } from "@/widgets/favorite-list";

/** 찜 목록 화면. 배치만 한다(로직 없음). */
export function FavoritesView() {
  return (
    <ScreenShell header={<FavoriteListHeader />}>
      <FavoriteList />
    </ScreenShell>
  );
}
