import type { AnimalListSex, AnimalListSort, AnimalListSpecies, AnimalListStatus } from "@/contract/animals";
import type { Animal, AnimalPage, AnimalsByIds } from "./animal";

/** 목록 요청 값. species·status·sex·sort의 값 목록은 계약(src/contract/animals.ts)이 정한다(이슈 #28) */
export type AnimalListParams = {
  species: AnimalListSpecies;
  /** 시도 코드(upr_cd). 없으면 전국 */
  region?: string;
  /** 시군구 코드(org_cd). region이 있을 때만 */
  district?: string;
  status: AnimalListStatus;
  /** 성별. all이면 거르지 않는다(성별 미상은 all에서만 나온다) */
  sex: AnimalListSex;
  sort: AnimalListSort;
  cursor?: string;
};

/** 요청 취소(TanStack Query의 signal 등) */
export type AnimalRequestOptions = { signal?: AbortSignal };

/** Port. 어댑터는 자체 /api/**를 호출하고 WireDto를 검증한 뒤 Domain을 반환한다. */
export interface AnimalRepository {
  getAnimals(params: AnimalListParams, options?: AnimalRequestOptions): Promise<AnimalPage>;
  getAnimalById(id: string, options?: AnimalRequestOptions): Promise<Animal>;
  getAnimalsByIds(ids: string[], options?: AnimalRequestOptions): Promise<AnimalsByIds>;
}
