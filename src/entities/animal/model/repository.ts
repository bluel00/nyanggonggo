import type { Animal, AnimalPage } from "./animal";

export type AnimalListParams = {
  species: Animal["species"];
  /** 시도 코드(upr_cd). 없으면 전국 */
  region?: string;
  /** 시군구 코드(org_cd). region이 있을 때만 */
  district?: string;
  status: Animal["status"] | "all";
  sort: "latest" | "endingSoon";
  cursor?: string;
};

/** 요청 취소(TanStack Query의 signal 등) */
export type AnimalRequestOptions = { signal?: AbortSignal };

/** Port. 어댑터는 자체 /api/**를 호출하고 WireDto를 검증한 뒤 Domain을 반환한다. */
export interface AnimalRepository {
  getAnimals(params: AnimalListParams, options?: AnimalRequestOptions): Promise<AnimalPage>;
  getAnimalById(id: string, options?: AnimalRequestOptions): Promise<Animal>;
  getAnimalsByIds(ids: string[], options?: AnimalRequestOptions): Promise<Animal[]>;
}
