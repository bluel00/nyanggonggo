# 단계 0~1: 스캐폴드 + git 초기화 + 데이터 계층 순수 로직

## 목표

냥공고 프로젝트를 시작한다. 이번 요청의 범위는 (0) 프로젝트 스캐폴드와 git 초기화, (1) 데이터 계층의 **순수 로직**(DTO, Mapper, Domain, Port)과 테스트까지다.
UI, Route Handler, 네트워크 호출, 캐시 구현은 만들지 않는다.

## 먼저 읽을 것 (순서대로)

1. `CLAUDE.md`
2. `docs/architecture.md`
3. `docs/fixtures/upstream-items.json`

`docs/PRD.md`, `docs/기능명세서.md`, `docs/design/*`는 참고용이다. 문서끼리 충돌하면 `docs/architecture.md`가 우선이며, 충돌한 내용은 마지막 보고에 적는다.

## 단계 0: 스캐폴드와 git

1. 이 폴더에서 `git init -b main`을 실행한다.
2. `.gitignore`에 `.env*`(단 `.env.example`은 제외), `node_modules`, `.next`, 빌드 산출물을 넣는다.
3. 먼저 문서만 커밋한다: `CLAUDE.md`, `docs/**` (`docs:` prefix).
4. Next.js(App Router, TypeScript strict, `src/` 디렉터리) + pnpm + Tailwind + Vitest + ESLint로 스캐폴드한다. shadcn/ui와 TanStack Query는 이번 단계에서 설치하지 않는다.
5. `package.json`에 `typecheck`(`tsc --noEmit`), `lint`, `test` 스크립트를 둔다.
6. `docs/architecture.md` 3절의 폴더를 만든다: `src/contract`, `src/server`, `src/entities`, `src/shared`. (`views`, `widgets`, `features`는 아직 만들지 않는다.)
7. ESLint에 경계 규칙을 넣는다: `src/server/**`는 `src/entities/**`, `src/shared/ui/**`를 import하지 못하고, `src/entities/**`, `src/shared/**`는 `src/server/**`를 import하지 못한다. 위반하는 import를 일부러 하나 만들어 lint가 실패하는지 확인한 뒤 되돌린다.
8. `.env.example`을 만든다(`DATA_GO_KR_SERVICE_KEY=`만, 값 없음).
9. 스캐폴드를 커밋한다(`chore:` prefix).

## 단계 1: 데이터 계층

`docs/architecture.md` 4~6절을 구현한다.

1. `src/server/upstream/dto.ts`: 공공 API 아이템의 Zod 스키마. 필드명 그대로 1:1, 모든 값은 문자열. `vaccinationChk`, `sfeSoci`, `sfeHealth`, `endReason`, `popfile1..N`은 optional. 재활용이나 변형 금지. `processState`는 enum이 아니라 `string`.
2. `src/contract/animals.ts`: `AnimalWireDto` Zod 스키마와 타입, `AnimalListResponse { items, nextCursor }`. 원시 타입만 사용(날짜는 문자열). 연락처(`careTel`, `careAddr`, `careOwnerNm`)와 종료 사유(`endReason`)는 포함하지 않는다.
3. `src/server/mapper.ts`: `UpstreamDto → { wire: AnimalWireDto, sortKeys }`.
   - `status`: `processState`가 `종료`로 시작하면 `ended`, 아니면 `protected`. 알 수 없는 값(`보호중`, `종료*` 외)은 dev 로그로 남긴다.
   - `sex`: `M`→male, `F`→female, 그 외(`Q` 포함)→unknown.
   - `species`: `upKindNm`이 `고양이`→cat, `개`→dog.
   - `images`: `popfile1..N` 중 존재하는 것만 배열로. URL의 `[`, `]`는 인코딩한다(`encodeURI`로 충분한지 테스트로 확인).
   - `noticePeriodText`: `MM.DD ~ MM.DD`.
   - `sortKeys`: `noticeSdt`, `noticeEdt`, `updTm`(정렬 정의는 architecture.md 5절).
4. `src/entities/animal/model`: `Animal`(architecture.md 6절), `AnimalRepository` Port(인터페이스만), 클라이언트 Mapper(`AnimalWireDto → Animal`, 문자열 날짜를 `Date`로), domain 서비스(`dDay`, `isSoon`). `dDay`는 KST 기준, 기준 시각을 인자로 주입한다. 지난 경우는 0으로 clamp하고 보고에 "정책 결정 필요"로 적는다.
5. Vitest 테스트. `docs/fixtures/upstream-items.json`의 6건으로 서버 Mapper와 클라이언트 Mapper를 각각 검증한다. 필수 케이스:
   - `종료(안락사)` → `ended`, 그리고 결과 어디에도 `endReason` 값이 없음
   - `sexCd=Q` → unknown
   - optional 필드(`sfeSoci`, `vaccinationChk`)가 있는 경우와 없는 경우 모두 통과
   - 파일명 `[1]` 인코딩
   - `careTel`, `careAddr`, `careOwnerNm`이 결과 객체에 없음
   - `upKindNm` 고양이/개 → species
   - 기준일 2026-09-21, `noticeEdt=20261001` → `dDay` 10
   - `isSoon`: `dDay` 3 이하일 때만 true
   - 스키마에 없는 필드가 들어와도 파싱이 깨지지 않음(알 수 없는 키는 무시)
   - 필수 필드 누락 시 Zod가 실패함

## 제약

- 네트워크 호출, 환경변수 읽기, UI 코드, Route Handler를 만들지 않는다.
- 서비스키를 코드, 로그, 테스트에 쓰지 않는다.
- Domain 타입은 `src/entities`에만 둔다. 서버 코드가 `entities`를 import하지 않는다.
- 새 의존성은 Zod, Vitest, 스캐폴드 필수 항목만 허용한다. 더 필요하면 이유를 적고 멈춰서 묻는다.
- 모르는 것은 추측하지 않는다. `docs/architecture.md` 12절에 항목을 추가하고 보고에 적는다.

## 완료 기준 (커밋 전에 실행)

- `pnpm typecheck`, `pnpm lint`, `pnpm test`가 모두 통과한다.
- 논리 단위로 나눠 커밋한다(`CLAUDE.md`의 규칙). **push하지 않는다.**

## 보고 형식

- 커밋 목록(해시와 메시지)
- 통과한 검증(명령어와 결과 요약)
- 문서와 충돌하거나 결정이 필요했던 점
- `architecture.md` 12절에 추가한 항목
- 남은 질문
