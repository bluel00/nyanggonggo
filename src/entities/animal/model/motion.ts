import type { Animal } from "./animal";

/**
 * 이 공고에 움직임 효과(카드 → 상세 전환, 첫 화면 등장, 누름, 하트 튐, 상세 진입 효과)를 붙이는지(이슈 #29).
 * 종료 공고는 움직이지 않고(README 원칙), 움직임 줄이기 설정이면 움직이지 않는다.
 *
 * reducedMotion: 움직임 줄이기 설정. 필수다: JS로 효과를 정하는 곳은 실제 설정을 넘기고, CSS 미디어 쿼리(`motion-safe:`,
 * globals.css의 `prefers-reduced-motion: no-preference`)가 따로 거르는 효과는 false를 넘기며 그 이유를 호출부에 적는다.
 */
export function allowsMotion(animal: Pick<Animal, "status">, reducedMotion: boolean): boolean {
  return animal.status !== "ended" && !reducedMotion;
}
