import type { AnimalListFilter } from "@/entities/animal";
import { AnimalFilterSheet } from "@/features/animal-filter";
import { AnimalList, AnimalListHeader } from "@/widgets/animal-list";

/** 목록 화면. 배치만 한다(로직 없음). filter는 app/page.tsx가 URL에서 파싱해 넘긴다. */
export function HomeView({ filter }: { filter: AnimalListFilter }) {
  return (
    <main>
      <AnimalListHeader species={filter.species} actions={<AnimalFilterSheet filter={filter} />} />
      <AnimalList filter={filter} />
    </main>
  );
}
