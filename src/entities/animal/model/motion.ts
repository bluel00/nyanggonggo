import type { Animal } from "./animal";

/**
 * 이 공고에 움직임 효과(카드 → 상세 전환, 첫 화면 등장, 누름, 하트 튐, 상세 진입 효과)를 붙이는지(이슈 #29).
 * 종료 공고는 움직이지 않고(README 원칙), 움직임 줄이기 설정이면 움직이지 않는다.
 *
 * reducedMotion: 움직임 줄이기 설정. CSS의 `motion-safe:`가 이미 거르는 효과에는 넘기지 않는다(기본 false).
 */
export function allowsMotion(animal: Pick<Animal, "status">, reducedMotion = false): boolean {
  return animal.status !== "ended" && !reducedMotion;
}
