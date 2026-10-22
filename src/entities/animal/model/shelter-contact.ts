import type { Animal } from "./animal";

/**
 * 카카오맵 검색결과 바로가기. 키·SDK 없이 쓰는 URL이고, 기기에 따라 PC·모바일 웹 지도가 열린다
 * (카카오 지도 Web API 가이드 "지도 URL" → "지도 검색결과 바로가기": `/link/search/검색어`).
 */
const KAKAO_MAP_SEARCH = "https://map.kakao.com/link/search/";

export type ShelterContact = {
  /** 보호소 주소. 값은 원문 그대로 보이고 mapUrl은 줄 끝 [지도] 링크다 */
  address: { text: string; mapUrl: string } | null;
  /** 보호소 전화. 값은 원문 그대로 보이고 href는 줄 끝 [전화] 링크다(숫자가 없으면 null: 줄은 두고 링크만 뺀다) */
  tel: { text: string; href: string | null } | null;
};

/**
 * 상세의 주소·전화 정보 줄(이슈 #3). 종료 공고는 둘 다 숨긴다(보호소 이름은 그대로). 값이 없으면 그 줄을 뺀다.
 */
export function getShelterContact(animal: Pick<Animal, "status" | "shelterAddressText" | "shelterTelText">): ShelterContact {
  if (animal.status === "ended") return { address: null, tel: null };
  const address = animal.shelterAddressText;
  const tel = animal.shelterTelText;
  return {
    address: address ? { text: address, mapUrl: kakaoMapSearchUrl(address) } : null,
    tel: tel ? { text: tel, href: telHref(tel) } : null,
  };
}

/** 주소 → 카카오맵 검색 URL. 검색어는 경로 한 칸이라 `/`·`?`·`#`까지 모두 인코딩한다 */
export function kakaoMapSearchUrl(address: string): string {
  return KAKAO_MAP_SEARCH + encodeURIComponent(address);
}

/** 전화번호 → `tel:` 링크. 숫자만 남긴다(하이픈·공백·괄호 제거). 숫자가 없으면 null */
export function telHref(tel: string): string | null {
  const digits = tel.replace(/\D/g, "");
  return digits ? `tel:${digits}` : null;
}
