import { siteOrigin } from "@/shared/config/site-origin";
import { AnimalDetailLoadingView } from "@/views/animal-detail";

/**
 * 얹은 상세(층)의 로딩 경계. 서버가 공고를 조회하는 동안(지난 측정 0.5~0.9초) 카드를 누른 즉시 상세 뼈대를 보인다.
 * 이 경계가 없으면 목록이 그대로 멈춰 있어 사용자가 여러 번 누른다.
 *
 * 상세 전체 페이지(공유 링크 직접 진입·새로고침, `app/animals/[id]`)에는 로딩 경계를 두지 않는다(#103). 경계가 있으면 본문이
 * 숨은 채(`<div hidden>`) 스트리밍되고 React 인라인 스크립트가 꺼내 보여서, 첫 사진이 서버 HTML에 있어도 JS가 돈 뒤에야 그려졌다
 * (운영 측정: 사진은 139ms에 받았는데 LCP 561ms, 모바일 시뮬레이션에서 렌더 지연 약 3.3초). 경계가 없으면 문서가 공고 조회를
 * 기다렸다가 사진까지 든 HTML로 한 번에 온다.
 *
 * 경계가 생기면 `next/link`의 자동 prefetch가 이 경계까지만 받는다(페이지 본문과 공고 조회는 누를 때).
 * 측정과 영향은 architecture.md 7절.
 * 목록 카드에서 들어오면 이 화면이 실제 상세(공유 버튼 포함)를 그리므로 공유 주소 기준(서버 siteOrigin)을 넘긴다(#73).
 */
export default function Loading() {
  return <AnimalDetailLoadingView origin={siteOrigin().origin} />;
}
