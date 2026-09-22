import type { Animal } from "./animal";
import { isSoon } from "./dDay";

/** 상태 배지 종류. 임박은 보호중이면서 D-day 3 이하(isSoon)일 때만. */
export type AnimalStatusVariant = "protected" | "soon" | "ended";

export function getStatusVariant(animal: Pick<Animal, "status" | "noticeEndAt">, now: Date): AnimalStatusVariant {
  if (animal.status === "ended") return "ended";
  return isSoon(animal, now) ? "soon" : "protected";
}

/** 대표 이미지(첫 번째 사진). 없으면 null */
export function getPrimaryImage(animal: Pick<Animal, "images">): string | null {
  return animal.images[0] ?? null;
}
