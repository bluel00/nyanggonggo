export type { Animal, AnimalPage } from "./model/animal";
export type { AnimalListParams, AnimalRepository, AnimalRequestOptions } from "./model/repository";
export { toAnimal } from "./model/mapper";
export { getDDay, isSoon } from "./model/dDay";
export { getPrimaryImage, getStatusVariant, type AnimalStatusVariant } from "./model/status";
export { getShelterContact, kakaoMapSearchUrl, telHref, type ShelterContact } from "./model/shelter-contact";
export { animalRepository, createAnimalRepository } from "./api/animal-repository";
export {
  animalKeys,
  animalOptions,
  animalsByIdsOptions,
  animalsInfiniteOptions,
  seedAnimalDetail,
  useAnimal,
  useAnimalsByIds,
  useAnimalsInfinite,
  type AnimalListFilter,
} from "./api/queries";
export {
  chooseDetailEntryMode,
  clearDetailEntry,
  getDetailEntry,
  setDetailEntryPhotoIndex,
  startDetailEntry,
  type CardPhotoSize,
  type DetailEntry,
  type DetailEntryMode,
} from "./model/detail-entry";
export { AnimalCard, type CardSelection } from "./ui/animal-card";
export { AnimalPhoto, PHOTO_SIZES } from "./ui/animal-photo";
export { CHARACTER_SRC, SpeciesCharacter, type CharacterHandle, type CharacterSpecies } from "./ui/species-character";
export { StatusBadge, statusBadgeText } from "./ui/status-badge";
export {
  ANIMAL_COPY,
  animalSummaryText,
  animalTitle,
  detailDisplayText,
  SEX_LABEL,
  sexAgeText,
  SPECIES_COPY,
  SPECIES_LABEL,
  speciesText,
  type SpeciesCopy,
} from "./ui/labels";
