import { cn } from "@/shared/lib/utils";

/**
 * 기타 동물을 묶어서 대표하는 새·토끼·거북이(docs/design/characters.md "기타 동물 세 마리"). 셋을 따로 떼어 한 종처럼 쓰지 않는다.
 * 앱 사본은 `public/characters/`이고, 원본과 같은지는 `tests/design/characters-sync.test.ts`가 본다.
 */
export const OTHER_CHARACTER_SRC = [
  "/characters/nyang-bird.svg",
  "/characters/nyang-rabbit.svg",
  "/characters/nyang-turtle.svg",
] as const;

/**
 * 홈 기타 동물 카드의 정지 그림 셋(handoff (g) "홈 기타 동물 선택지"): 각 44px, 둘째는 6px·셋째는 4px 겹친다. 후광은 없다.
 * 장식이라 `alt=""`·`aria-hidden`이고 의미는 옆의 이름표가 전한다. 움직임(대기·인사)은 아직 없다.
 * `characterClassName`은 각 그림에 붙는다(카드가 누름 반응을 준다).
 */
export function OtherCharacters({ characterClassName }: { characterClassName?: string }) {
  return (
    <span aria-hidden className="flex shrink-0 items-end">
      {OTHER_CHARACTER_SRC.map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- 120px 원본을 44px로 그리는 고정 SVG라 next/image 최적화가 할 일이 없다
        <img
          key={src}
          src={src}
          alt=""
          width={44}
          height={44}
          className={cn("size-11", index === 1 && "-ml-1.5", index === 2 && "-ml-1", characterClassName)}
        />
      ))}
    </span>
  );
}
