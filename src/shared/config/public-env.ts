/**
 * 브라우저에 공개되는 설정(NEXT_PUBLIC_*). 빌드 때 값이 코드에 들어간다. 비밀값을 두지 않는다.
 * 카카오 JavaScript 키는 카카오 개발자 콘솔에서 사이트 도메인을 제한하는 공개 키다(architecture.md 9절).
 * 비어 있으면(로컬에서 발급 전 등) 카카오 공유 대신 링크 복사로 동작한다.
 */
export const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
