# 냥공고 — Claude Code 작업 규칙

유기묘 공고 모바일 웹(Next.js App Router). 사진 피드 + 카카오 공유. 서비스명은 임시(냥공고)이며 `SERVICE_NAME` 상수 한 곳에서만 정의한다.

## 진실의 원천 (충돌 시 우선순위)

1. `docs/architecture.md`
2. `docs/기능명세서.md`, `docs/PRD.md`
3. `docs/design/handoff.md`, `docs/design/README.md`, `docs/design/tokens.*`

문서에 없거나 서로 충돌하면 **추측하지 말고** 멈춰서 질문하거나 보고에 적는다. 미확정 항목은 `docs/architecture.md` 12절에 추가한다.

## 아키텍처 요약 (상세는 architecture.md)

- 공공 API는 브라우저에서 직접 호출하지 않는다. Next 서버(Route Handler)에서만 호출한다.
- 모델은 3단계로 분리한다: `UpstreamDto`(1:1 + Zod) → `AnimalWireDto`(계약, `src/contract`) → `Animal`(FE Domain, `src/entities`). 서로 재활용하지 않는다.
- Zod는 도착 검증만 한다. 가공, 변환, 파생은 Mapper와 domain 서비스가 한다.
- `src/server/**`와 FSD 계층은 서로 import하지 않는다. 공유는 `src/contract`뿐이다. 이 규칙은 ESLint로 강제한다.
- FSD 계층 방향: `views → widgets → features → entities → shared`. `views`는 배치만 하고 로직이 없다.
- UI는 Domain(`Animal`)만 소비한다.

## 상태 관리

- 서버 상태는 TanStack Query. 다른 저장소나 `useState`로 복사하지 않는다.
- 필터/정렬은 URL search params(`species`, `region`, `status`, `sort`)가 단일 진실 소스다. `page`는 URL에 넣지 않는다.
- 전역 스토어(Redux, Zustand, Recoil 등)를 도입하지 않는다.
- 찜은 localStorage에 id만 저장한다.

## 보안

- 서비스키는 서버 환경변수 `DATA_GO_KR_SERVICE_KEY`에만 둔다. `NEXT_PUBLIC_` 금지. 코드, 로그, 테스트, 픽스처, 커밋에 넣지 않는다.
- `.env*`는 커밋하지 않는다(`.env.example`만 커밋).
- 보호소 연락처(`careTel`, `careAddr`, `careOwnerNm`)와 종료 사유(`endReason`)는 WireDto, Domain, UI 어디에도 노출하지 않는다.

## 디자인 적용

- 토큰은 `docs/design/tokens.css`의 CSS 변수를 `globals.css`에 그대로 두고, Tailwind는 `var()`를 참조한다(매핑표는 `docs/design/handoff.md`).
- `docs/design/bundle.js`는 프리뷰용 번들이다(`window.React`). import하지 말고 명세로만 참고한다. 컴포넌트는 TSX로 다시 구현하고, `bundle.css`의 치수와 상태를 기준으로 한다.
- 480px 컬럼 안의 하단 CTA, 바텀시트, 토스트, 뷰어는 `position: fixed`를 쓰지 않는다. 컬럼 wrapper 기준 `absolute` 또는 `sticky`.
- 폰트 파일(약 2MB)은 저장소에 복사하지 않는다. `pretendard` 패키지의 dynamic subset 또는 `next/font/local`을 쓴다.

## 작업 방식

- 작은 단위로 진행한다. 각 단계의 끝에서 `pnpm typecheck`, `pnpm lint`, `pnpm test`가 모두 통과한 뒤에만 커밋한다.
- 커밋 메시지는 한국어로 간결하게, 영문 prefix를 붙인다(`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). 훅을 우회하지 않는다(`--no-verify` 금지).
- 커밋은 논리 단위로 나눈다. **push는 지시할 때만** 한다.
- 새 의존성을 추가하기 전에 이유를 적고 확인을 받는다.
- 근본 원인을 고친다. 우회책으로 넘기지 않는다.
- 요청 범위 밖의 파일과 화면은 만들지 않는다.

## 명령어

스캐폴드 후 확정한다: `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
