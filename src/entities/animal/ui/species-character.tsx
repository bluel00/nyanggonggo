import type { Animal } from "../model/animal";

/** 캐릭터가 있는 축종. 기타는 종이 분산되어 하나로 대표할 수 없어 캐릭터를 만들지 않는다(docs/design/characters.md) */
export type CharacterSpecies = Exclude<Animal["species"], "other">;

/**
 * 앱이 쓰는 캐릭터 SVG 사본(`public/characters/`). 원본은 `docs/design/assets/characters/`이고,
 * 둘이 같은지는 `tests/design/characters-sync.test.ts`가 본다.
 */
export const CHARACTER_SRC: Record<CharacterSpecies, string> = {
  cat: "/characters/nyang-cat.svg",
  dog: "/characters/nyang-dog.svg",
};

/** 원본 크기. 1:1에서 선이 1.8px로 아이콘과 같은 굵기다(characters.md 그리기 규칙) */
const CHARACTER_SIZE = 120;

/**
 * 고양이·강아지 캐릭터(정지 이미지). 장식이라 `alt=""`이고 의미는 옆의 텍스트 라벨이 전한다.
 *
 * 인라인 SVG가 아니라 `<img>`다: 두 SVG가 같은 그룹 id(`head`, `tail`, `body`…)를 써서 한 페이지에
 * 인라인하면 id가 겹친다. `<img>`는 문서마다 따로 그려 겹치지 않는다(architecture.md 12절 44).
 * 움직임(Rive)은 다음 단계다.
 */
export function SpeciesCharacter({ species }: { species: CharacterSpecies }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 120px 고정 SVG라 next/image 최적화가 할 일이 없다
    <img
      src={CHARACTER_SRC[species]}
      alt=""
      width={CHARACTER_SIZE}
      height={CHARACTER_SIZE}
      draggable={false}
      className="block shrink-0 select-none"
    />
  );
}
