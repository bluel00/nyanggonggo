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
  };
}

/** `YYYY-MM-DD`(KST 달력 날짜) → 그날 00:00 KST. 형식이 다르면 null. */
function parseKstDate(value: string | null): Date | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
