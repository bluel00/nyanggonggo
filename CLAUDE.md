# 멍냥공고 — Claude Code 작업 규칙

유기묘 공고 모바일 웹(Next.js App Router). 사진 피드 + 카카오 공유. 서비스 이름은 멍냥공고(옛 이름 냥공고, #64)이며 `SERVICE_NAME` 상수 한 곳에서만 정의한다.

## 진실의 원천 (충돌 시 우선순위)

1. `docs/architecture.md`
2. `docs/glossary.md` (도메인 용어 사전: 층마다 쓰는 말과 그 대응)
3. `docs/PRD-v1.5.md` (PRD v1.4의 변경분: 상세를 목록 위에 얹기)
4. `docs/PRD-v1.4.md` (PRD v1.3의 변경분: 상세에서 뒤로가기)
5. `docs/PRD-v1.3.md` (PRD v1.2의 변경분: 상세 사진 비율)
6. `docs/PRD-v1.2.md` (PRD v1.1의 변경분: 캐릭터 모션)
7. `docs/PRD-v1.1.md` (PRD v1.0의 변경분: 기타 축종, 홈 화면, 축종 기억)
8. `docs/기능명세서.md`, `docs/PRD.md`
9. `docs/design/handoff.md`, `docs/design/README.md`, `docs/design/tokens.*`

즉 `architecture.md` > `glossary.md` > `PRD-v1.5.md` > `PRD-v1.4.md` > `PRD-v1.3.md` > `PRD-v1.2.md` > `PRD-v1.1.md` > `PRD.md`·`기능명세서.md`다. `PRD-v1.1.md`는 v1.0에서, `PRD-v1.2.md`는 v1.1에서, `PRD-v1.3.md`는 v1.2에서, `PRD-v1.4.md`는 v1.3에서, `PRD-v1.5.md`는 v1.4에서 **바뀌는 부분만** 적은 문서다.

문서별로 무엇이 무엇을 대체했는지는 `docs/PRD.md` 맨 앞 색인과 대체된 문서 0절의 "대체된 곳"에 있다.

**읽기 규칙**: 변경 문서에 적히지 않은 것은 앞 버전을 따른다. 다만 앞 버전의 비범위나 구현 방식은 이후 이슈나 `architecture.md`에서 바뀌었을 수 있으니, `PRD.md` 색인과 `architecture.md`를 먼저 확인한다. 충돌하거나 불명확하면 멈추고 EL에게 묻는다.

문서에 없거나 서로 충돌하면 **추측하지 말고** 멈춰서 질문하거나 보고에 적는다. 미확정 항목은 `docs/architecture.md` 12절에 추가한다.

## 아키텍처 요약 (상세는 architecture.md)

- 공공 API는 브라우저에서 직접 호출하지 않는다. Next 서버(Route Handler)에서만 호출한다.
- 모델은 3단계로 분리한다: `UpstreamDto`(1:1 + Zod) → `AnimalWireDto`(계약, `src/contract`) → `Animal`(FE Domain, `src/entities`). 서로 재활용하지 않는다.
- Zod는 도착 검증만 한다. 가공, 변환, 파생은 Mapper와 domain 서비스가 한다.
- `src/server/**`는 FSD 계층(`entities`, `features`, `widgets`, `views`, `shared/ui`)을 import하지 않고, FSD 계층은 `src/server/**`를 import하지 않는다. 둘이 함께 쓰는 것은 `src/contract`와 `shared/ui`를 뺀 `shared`(지금은 `shared/api`, `shared/lib`)다. 이 규칙은 ESLint로 강제한다.
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
- 연락처 값(`careTel`, `careAddr`, `careOwnerNm`)은 로그에 남기지 않는다. 보호소 주소·전화는 상세의 보호소 정보 시트에만 쓴다(이슈 #3, #62).

## 디자인 적용

- 토큰은 `docs/design/tokens.css`의 CSS 변수를 `globals.css`에 그대로 두고, Tailwind는 `var()`를 참조한다(매핑표는 `docs/design/handoff.md`).
- `docs/design/bundle.js`는 프리뷰용 번들이다(`window.React`). import하지 말고 명세로만 참고한다. 컴포넌트는 TSX로 다시 구현하고, `bundle.css`의 치수와 상태를 기준으로 한다.
- 480px 컬럼 안의 하단 CTA, 바텀시트, 토스트, 뷰어는 `position: fixed`를 쓰지 않는다. 컬럼 wrapper 기준 `absolute` 또는 `sticky`.
- 폰트 파일(약 2MB)은 저장소에 복사하지 않는다. `pretendard` 패키지의 dynamic subset 또는 `next/font/local`을 쓴다.

## 작업 방식

- 작은 단위로 진행한다. 각 단계의 끝에서 `pnpm typecheck`, `pnpm lint`, `pnpm test`가 모두 통과한 뒤에만 커밋한다.
- 커밋 메시지는 한국어로 간결하게, 영문 prefix를 붙인다(`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`). 훅을 우회하지 않는다(`--no-verify` 금지).
- 커밋은 논리 단위로 나눈다. **push는 지시할 때만** 한다. 이슈 작업을 지시받았으면 아래 "작업 흐름"대로 브랜치 push, PR, 합치기까지 한다.
- 새 의존성을 추가하기 전에 이유를 적고 확인을 받는다.
- 근본 원인을 고친다. 우회책으로 넘기지 않는다.
- 요청 범위 밖의 파일과 화면은 만들지 않는다.
- 서버나 프로세스를 끌 때는 자기가 띄운 PID만 끈다. 이름으로 한꺼번에 끄지 않는다.

## 작업 흐름 (GitHub 이슈와 PR)

- 코드와 문서 변경은 이슈에서 시작한다. 이슈가 없으면 먼저 등록한다. 이슈 본문은 배경 / 할 일(또는 정할 것) / 완료 기준 / 참고로 짧게 쓴다.
- 라벨: 상태 `정의 필요` / `준비됨` / `백로그`, 종류 `기능` / `버그` / `문서` / `리팩터`.
- `정의 필요` 이슈는 구현하지 않는다. 정할 것이 정해지고 `준비됨`이 되면 시작한다.
- 브랜치: `<종류>/<이슈번호>-<짧은-이름>` (예: `docs/1-workflow`). 종류는 커밋 prefix와 같다(`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`).
- 새 이름을 짓거나 화면 문구를 쓸 때 용어 사전(`docs/glossary.md`)을 먼저 본다. 사전에 없는 용어면 사전에 먼저 추가한다.
- 같은 규칙이나 값을 세 번째로 복사하게 되면, 먼저 한 곳으로 모은 뒤 진행한다(복사본은 바뀔 때 함께 고쳐야 할 곳이 되어 늘어난다. 목록 쿼리 값이 6곳이 됐다).
- 구현 전에 고칠 파일 목록을 이슈 댓글로 적는다. 이유 하나에 소스 파일 3곳 이상이면 왜 그런지 함께 적는다(변경 범위가 예상보다 넓은 것을 구현 전에 보려고).
- PR 본문: 무엇을 / 왜 / 검사 결과 / 이유와 관계없이 따라 바뀐 파일 수 / `closes #번호`(따라 바뀐 파일 수는 #10에서 16개로 늦게 드러났다. PR마다 세어 구조 문제를 일찍 본다).
- 디자인 작업 없이 화면(모양·문구·동작)을 바꾼 PR은 본문에 '디자인 시스템과 달라진 점'을 적고, 열린 '디자인 싱크' 이슈가 있으면 거기에 줄을 더한다. 없으면 새로 연다(제목 '디자인 싱크: <날짜>', 라벨은 위 규칙대로). 디자인 시스템 가져오기로 줄이 모두 체크되면 그 이슈를 닫는다.
- PR 스크린샷을 올리려고 별도 브랜치를 만들지 않는다. 스크린샷은 저장소 밖 `C:\side\nyanggonggo-review\screenshots\<이슈 번호>\` 에 두고 경로를 보고한다.
- 검사(`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e`)를 통과하면 squash로 합치고 브랜치를 지운다. 기본은 체크가 통과하면 머지한다. 다음 경우에만 PR을 만들고 멈춘다: (1) 전환·애니메이션처럼 손으로 느껴 봐야 하는 변경 (2) 배포·환경변수·비밀값 설정 변경 (3) 예전 링크나 저장 데이터가 깨지는 변경. 화면이 바뀌는 PR은 스크린샷 경로를 보고에 적는다.
- 이슈와 PR 본문에도 서비스 키, 공공 API URL, 이미지 URL, 실제 연락처 값을 쓰지 않는다(저장소는 공개다).
- `docs/architecture.md` 12절에서 이슈로 옮긴 항목에는 이슈 번호 링크를 단다.

## 명령어

스캐폴드 후 확정한다: `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
