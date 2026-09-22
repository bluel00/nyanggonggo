export type { Animal, AnimalPage } from "./model/animal";
export type { AnimalListParams, AnimalRepository, AnimalRequestOptions } from "./model/repository";
export { toAnimal } from "./model/mapper";
export { getDDay, isSoon } from "./model/dDay";
export { animalRepository, createAnimalRepository } from "./api/animal-repository";
export {
  animalKeys,
  animalOptions,
  animalsByIdsOptions,
  animalsInfiniteOptions,
  useAnimal,
  useAnimalsByIds,
  useAnimalsInfinite,
  type AnimalListFilter,
} from "./api/queries";
