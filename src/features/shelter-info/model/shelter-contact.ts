import type { Animal } from "@/entities/animal";

/*
 * 보호소 연락(보호소 정보 시트, 이슈 #62). 바깥 서비스(카카오맵)를 아는 연락 링크는 이 슬라이스에만 둔다(entities에서 옮김, #73 결정).
 * 시트에 어떤 줄을 두는지와 각 줄의 링크를 여기서 정한다. 시트를 열 수 있는지(버튼이 있는지)는 상세 정보 줄 규칙(entities/animal/ui/detail-rows.ts)이 정한다.
 */

/**
 * 카카오맵 검색결과 바로가기. 키·SDK 없이 쓰는 URL이고, 기기에 따라 PC·모바일 웹 지도가 열린다
 * (카카오 지도 Web API 가이드 "지도 URL" → "지도 검색결과 바로가기": `/link/search/검색어`).
 */
const KAKAO_MAP_SEARCH = "https://map.kakao.com/link/search/";

/**
 * 주소 → 지도 검색 URL. 이름은 역할(지도에서 주소 찾기)이고, 지금 구현은 카카오맵이다(이슈 #31: 공급자는 이 함수 안에만 둔다).
 * 검색어는 경로 한 칸이라 `/`·`?`·`#`까지 모두 인코딩한다
 */
export function mapSearchUrl(address: string): string {
  return KAKAO_MAP_SEARCH + encodeURIComponent(address);
}

/** 전화번호 → `tel:` 링크. 숫자만 남긴다(하이픈·공백·괄호 제거). 숫자가 없으면 null */
export function telHref(tel: string): string | null {
  const digits = tel.replace(/\D/g, "");
  return digits ? `tel:${digits}` : null;
}

/** 시트 줄 이름 */
export const SHELTER_CONTACT_LABELS = { address: "주소", tel: "전화" } as const;

/** 줄 끝 링크의 종류. 지도는 새 탭, 전화는 같은 탭(tel:) */
export type ShelterContactAction = "map" | "call";

/** 줄 끝의 작은 글자 링크 문구(이슈 #3). text는 보이는 글자, label은 접근성 이름이다 */
export const SHELTER_CONTACT_LINK_COPY: Record<ShelterContactAction, { text: string; label: string }> = {
  map: { text: "지도", label: "지도에서 주소 보기(새 탭)" },
  call: { text: "전화", label: "보호소에 전화" },
};

/** 시트의 줄 하나. 값은 원문 그대로이고 비어 있지 않다. 링크를 만들 수 없으면(숫자 없는 전화) link는 null */
export type ShelterContactRow = {
  label: string;
  value: string;
  link: { action: ShelterContactAction; href: string } | null;
};

/**
 * 보호소 정보 시트의 줄: 주소(+ 지도) → 전화(+ 전화). 값이 없는 줄은 뺀다. 전화에 숫자가 없으면 줄은 두고 링크만 뺀다.
 * 종료 공고는 버튼이 없어 시트를 열 수 없다(detail-rows.ts). 혹시 불려도 줄을 내지 않는다.
 */
export function shelterContactRows(
  animal: Pick<Animal, "status" | "shelterAddressText" | "shelterTelText">,
): ShelterContactRow[] {
  if (animal.status === "ended") return [];
  const rows: ShelterContactRow[] = [];
  if (animal.shelterAddressText) {
    rows.push({
      label: SHELTER_CONTACT_LABELS.address,
      value: animal.shelterAddressText,
      link: { action: "map", href: mapSearchUrl(animal.shelterAddressText) },
    });
  }
  if (animal.shelterTelText) {
    const href = telHref(animal.shelterTelText);
    rows.push({ label: SHELTER_CONTACT_LABELS.tel, value: animal.shelterTelText, link: href ? { action: "call", href } : null });
  }
  return rows;
}
