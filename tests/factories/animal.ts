import type { AnimalWireDto } from "@/contract/animals";
import type { Animal } from "@/entities/animal";

/**
 * 테스트용 공고(이슈 #27). 기본값은 "빈 공고"다: 필수 값만 있고 선택 필드는 null이다.
 * 테스트는 자기에게 의미 있는 필드만 덮어쓴다(예: `makeAnimal({ sex: "female" })`).
 * 도메인 필드를 더하면 테스트 데이터는 이 파일만 고친다. 운영 코드는 이 파일을 import하지 않는다(eslint.config.mjs).
 *
 * makeWire와 makeAnimal의 기본값은 같은 공고를 가리킨다(종료일 2026-10-01 = 그날 00:00 KST).
 * makeAnimal은 Mapper(toAnimal)를 거치지 않는다: Mapper 테스트가 팩토리에 기대지 않게 한다.
 */
export function makeWire(overrides: Partial<AnimalWireDto> = {}): AnimalWireDto {
  return {
    id: "1",
    species: "cat",
    images: [],
    status: "protected",
    endResultText: null,
    noticeEndDate: "2026-10-01",
    sex: "unknown",
    ageText: null,
    regionText: "서울특별시",
    shelterName: null,
    foundPlaceText: null,
    shelterAddressText: null,
    shelterTelText: null,
    noticeNoText: null,
    noticePeriodText: null,
    specialMarkText: null,
    endReasonText: null,
    kindText: null,
    ...overrides,
  };
}

export function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: "1",
    species: "cat",
    images: [],
    status: "protected",
    endResultText: null,
    noticeEndAt: new Date("2026-10-01T00:00:00+09:00"),
    sex: "unknown",
    ageText: null,
    regionText: "서울특별시",
    shelterName: null,
    foundPlaceText: null,
    shelterAddressText: null,
    shelterTelText: null,
    noticeNoText: null,
    noticePeriodText: null,
    specialMarkText: null,
    endReasonText: null,
    kindText: null,
    ...overrides,
  };
}
