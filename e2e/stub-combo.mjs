// E2E 스텁의 "조합 목록"(이슈 #109). 고정 목록(개·세종, 고양이·서울, 기타·전국)에 없는 (축종, 시도, 시군구) 조합에는
// 조합이 공고 id에 드러나는 지어낸 공고를 준다. 첫 페이지는 서버가 읽어 브라우저에서 가로챌 수 없으므로,
// 테스트는 화면에 그려진 카드 id로 서버가 어떤 축종·지역·시군구로 조회했는지 확인한다.
// 서버 스텁(e2e/upstream-stub.mjs)과 테스트(e2e/helpers.ts)가 이 파일 하나를 함께 쓴다. 값은 모두 지어낸 것이다.

/** 축종 → 공공 API upkind, id에 넣는 한 자리 */
export const COMBO_SPECIES = {
  dog: { upkind: "417000", digit: "1" },
  cat: { upkind: "422400", digit: "2" },
  other: { upkind: "429900", digit: "3" },
};

/** 조합마다 공고 수. 목록 한 페이지(20)보다 많아 다음 페이지가 있다 */
export const COMBO_SIZE = 30;

/** 이 순번은 종료 공고다(상태 전체·종료에서만 보인다). 상태 전체 목록에서 1번이 종료라 첫 화면에 보호중과 종료가 함께 있다 */
export const isComboEnded = (index) => index % 7 === 1;

/** 이 순번은 사진이 두 장이고 첫 장이 4:3 가로다(고정 목록과 같은 규칙) */
export const hasComboTwoPhotos = (index) => index % 5 === 2;

const pad7 = (code) => (code ?? "").padStart(7, "0");

/**
 * 조합 공고 id(20자리): 99 + 축종 1자리 + 시도 7자리(전국이면 0000000) + 시군구 7자리(없으면 0000000) + 순번 3자리.
 * 실제 공고 id(15자리)와 겹치지 않는다.
 */
export function comboPrefix(species, region, district) {
  return `99${COMBO_SPECIES[species].digit}${pad7(region)}${pad7(district)}`;
}

export function comboItemId(species, region, district, index) {
  return `${comboPrefix(species, region, district)}${String(index).padStart(3, "0")}`;
}

/** id → 조합. 조합 공고 id가 아니면 null */
export function parseComboId(id) {
  const match = /^99([123])(\d{7})(\d{7})(\d{3})$/.exec(id);
  if (!match) return null;
  const species = Object.keys(COMBO_SPECIES).find((key) => COMBO_SPECIES[key].digit === match[1]);
  const code = (value) => (/^0+$/.test(value) ? null : value.replace(/^0+/, ""));
  return { species, region: code(match[2]), district: code(match[3]), index: Number(match[4]) };
}

/**
 * 뼈대를 붙잡아 두는 조합(시도 코드). 이 조합의 공공 API 목록 응답을 늦춘다. 서버 페이지 캐시(300초)가 채워지면 다음부터는
 * 빠르므로, 뼈대가 꼭 보여야 하는 테스트마다 다른 조합을 쓴다(SLOW_REGIONS에서 하나씩).
 * 시도 코드는 지역 표에 있는 실제 코드이고, 고정 목록(서울·세종)과 다른 테스트가 쓰는 지역(부산·경남·제주)과 겹치지 않는다.
 */
export const SLOW_LIST_MS = 1500;
export const SLOW_REGIONS = ["6270000", "6280000", "6300000", "6310000", "6430000", "6440000", "6470000", "6540000"];

/** 고정 목록의 id 접두어(e2e/upstream-stub.mjs의 고정 공고 id와 같아야 한다) */
const FIXED_LIST_PREFIX = [
  { species: "dog", region: "5690000", prefix: "9900002026010" },
  { species: "cat", region: "6110000", prefix: "9900002026020" },
  { species: "other", region: null, prefix: "9900002026030" },
];

/** 이 조건으로 조회한 목록의 공고 id 접두어. 고정 목록이면 그 접두어, 아니면 조합 접두어다 */
export function listIdPrefix(species, region, district) {
  const fixed = FIXED_LIST_PREFIX.find((list) => list.species === species && list.region === (region ?? null) && !district);
  return fixed ? fixed.prefix : comboPrefix(species, region, district);
}

/** 조합 목록을 최신순으로 읽었을 때의 공고 id(상태 보호중이면 종료 공고를 뺀다). 서버를 부르지 않고 계산한다(느린 조합의 캐시를 채우지 않게) */
export function comboLatestIds(species, region, district, { status = "protected" } = {}) {
  return Array.from({ length: COMBO_SIZE }, (_, index) => index)
    .filter((index) => status === "all" || !isComboEnded(index))
    .map((index) => comboItemId(species, region, district, index));
}

/** 목록이 늘 실패하는 시도(공공 API 500). 서버가 첫 페이지를 읽지 못했을 때의 화면(#109 R7)을 본다. 실패는 서버 캐시에 남지 않는다 */
export const FAILING_REGION = "6130000";
