import type { AnimalWireDto } from "@/contract/animals";
import type { Animal } from "./animal";

/** 클라이언트 Mapper: AnimalWireDto → Animal. */
export function toAnimal(wire: AnimalWireDto): Animal {
  return {
    id: wire.id,
    species: wire.species,
    images: [...wire.images],
    status: wire.status,
    noticeEndAt: parseKstDate(wire.noticeEndDate),
    sex: wire.sex,
    ageText: wire.ageText,
    regionText: wire.regionText,
    shelterName: wire.shelterName,
    foundPlaceText: wire.foundPlaceText,
    noticePeriodText: wire.noticePeriodText,
    // 빈 문자열이나 공백만 있으면 null. UI에서 값 없이 "특이사항" 라벨만 뜨지 않게 한다
    specialMarkText: normalizeText(wire.specialMarkText),
    kindText: normalizeText(wire.kindText),
  };
}

function normalizeText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** `YYYY-MM-DD`(KST 달력 날짜) → 그날 00:00 KST. 형식이 다르면 null. */
function parseKstDate(value: string | null): Date | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
