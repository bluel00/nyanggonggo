import type { AnimalWireDto } from "@/contract/animals";
import type { MappedAnimal } from "../mapper";

export type AnimalSourceKey = {
  species: AnimalWireDto["species"];
  /** 시도 코드(upr_cd) 또는 전체 */
  uprCd: string | "all";
  /** 시군구 코드(org_cd). 없으면 시도 전체 */
  orgCd?: string;
};

/**
 * 공고 데이터 출처. 캐시 방식(Next 데이터 캐시, unstable_cache, 인메모리, 외부 KV)은
 * 이 인터페이스 뒤에서 통째로 바꿀 수 있어야 한다(architecture.md 5절).
 */
export interface AnimalSource {
  /** (species, uprCd, orgCd) 조합의 전체 목록. 필터, 정렬, 커서는 호출한 쪽이 한다. */
  list(key: AnimalSourceKey): Promise<MappedAnimal[]>;
  /** desertion_no 단건. 없으면 null. */
  getById(id: string): Promise<MappedAnimal | null>;
}
