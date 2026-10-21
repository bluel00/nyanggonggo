import type { AnimalListFilter } from "@/entities/animal";
import { FavoritesLink } from "@/features/animal-favorite";
import { AnimalFilterSheet } from "@/features/animal-filter";
import { ScreenShell } from "@/shared/ui/screen-shell";
import { AnimalList, AnimalListHeader } from "@/widgets/animal-list";

/** 목록 화면. 배치만 한다(로직 없음). filter는 app/page.tsx가 URL에서 파싱해 넘긴다. */
export function AnimalListView({ filter }: { filter: AnimalListFilter }) {
  return (
    <ScreenShell
      header={
        <AnimalListHeader
          filter={filter}
          actions={
            <>
              <FavoritesLink />
              <AnimalFilterSheet filter={filter} />
            </>
          }
        />
      }
    >
      <AnimalList filter={filter} />
    </ScreenShell>
  );
}
