export type { Animal, AnimalPage, AnimalsByIds } from "./model/animal";
export type { AnimalListParams, AnimalRepository, AnimalRequestOptions } from "./model/repository";
export { toAnimal, toAnimalPage } from "./model/mapper";
export { getDDay, isNearDeadline } from "./model/dDay";
export { getPrimaryImage, getStatusVariant, type AnimalStatusVariant } from "./model/status";
export { allowsMotion } from "./model/motion";
export { animalRepository, createAnimalRepository, toAnimalListQuery } from "./api/animal-repository";
export {
  animalKeys,
  animalOptions,
  animalsByIdsOptions,
  animalsInfiniteOptions,
  isSameListFilter,
  listFilterKey,
  seedAnimalDetail,
  seedAnimalsFirstPage,
  useAnimal,
  useAnimalsByIds,
  useAnimalsInfinite,
  useRetryFailedAnimals,
  type AnimalListFilter,
  type AnimalListFirstPage,
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
export {
  DETAIL_ROW_ACTION_COPY,
  DETAIL_ROW_LABELS,
  detailDisplayText,
  detailRows,
  type DetailRow,
  type DetailRowAction,
} from "./ui/detail-rows";
export {
  ANIMAL_CARD_SELECTOR,
  ANIMAL_CARD_STILL_ATTR,
  ANIMAL_CARD_STILL_SELECTOR,
  AnimalCard,
  type CardSelection,
} from "./ui/animal-card";
export { AnimalPhoto, PHOTO_SIZES } from "./ui/animal-photo";
export { photoTransition } from "./ui/photo-transition";
export { CHARACTER_SRC, SpeciesCharacter, type CharacterHandle, type CharacterSpecies } from "./ui/species-character";
export { OTHER_CHARACTER_SRC, OtherCharacters } from "./ui/other-characters";
export { StatusBadge } from "./ui/status-badge";
export {
  cardDeadlineText,
  deadlineDateText,
  detailDeadlineText,
  statusBadgeText,
  statusShareText,
} from "./ui/status-text";
export {
  ageDisplayText,
  ANIMAL_COPY,
  animalSubtitle,
  animalSummaryText,
  animalTitle,
  photoAlt,
  SEX_LABEL,
  sexAgeText,
  SPECIES_COPY,
  SPECIES_LABEL,
  speciesText,
  type SpeciesCopy,
} from "./ui/labels";
