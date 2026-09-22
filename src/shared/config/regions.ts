/**
 * 시도 코드(upr_cd)와 라벨. URL의 region 값은 이 코드이고 UI는 라벨로 보여 준다(architecture.md 7절).
 *
 * 검증 필요(architecture.md 12절 16): 공공 API sido_v2 응답으로 확인하지 않은 목록이다. 특히 강원(6530000)과
 * 전북(6540000)은 특별자치도 전환 뒤 코드이며, 이전 코드(6420000, 6450000)로 오는지 확인해야 한다.
 */
export const REGIONS = [
  { code: "6110000", label: "서울" },
  { code: "6260000", label: "부산" },
  { code: "6270000", label: "대구" },
  { code: "6280000", label: "인천" },
  { code: "6290000", label: "광주" },
  { code: "5690000", label: "세종" },
  { code: "6300000", label: "대전" },
  { code: "6310000", label: "울산" },
  { code: "6410000", label: "경기" },
  { code: "6530000", label: "강원" },
  { code: "6430000", label: "충북" },
  { code: "6440000", label: "충남" },
  { code: "6540000", label: "전북" },
  { code: "6460000", label: "전남" },
  { code: "6470000", label: "경북" },
  { code: "6480000", label: "경남" },
  { code: "6500000", label: "제주" },
] as const;

export function regionLabel(code: string | undefined): string | null {
  if (!code) return null;
  return REGIONS.find((region) => region.code === code)?.label ?? null;
}
