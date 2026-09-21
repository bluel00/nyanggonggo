import type { Animal, AnimalPage } from "./animal";

export type AnimalListParams = {
  species: Animal["species"];
  /** 시도 코드(upr_cd) */
  region?: string;
  status: Animal["status"] | "all";
  sort: "latest" | "endingSoon";
  cursor?: string;
};

/** Port. 어댑터는 자체 /api/**를 호출하고 WireDto를 검증한 뒤 Domain을 반환한다. */
export interface AnimalRepository {
  getAnimals(params: AnimalListParams): Promise<AnimalPage>;
  getAnimalById(id: string): Promise<Animal>;
  getAnimalsByIds(ids: string[]): Promise<Animal[]>;
}
