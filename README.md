# 멍냥공고

멍냥공고는 도움이 필요한 동물의 공고가, 그 동물을 도울 수 있는 사람에게 닿게 하는 모바일 웹이다.
잃어버린 주인, 입양할 사람, 공고를 대신 전해 줄 사람이 지금 보호 중인 아이들을 지역별로 가볍게 보고, 바로 공유할 수 있다.

운영 주소: https://nyanggonggo.vercel.app

## 만드는 원칙

- 가볍게, 많이 공유되게 한다.
- 지금 보호 중인 아이들에게 집중한다.
- 사용자의 행동을 설계하지 않는다. 공고 정보를 원문 그대로, 옮기기 쉽게 만들고, 실제 쓰임을 지켜보고 정한다.

## 기술 구성

- Next.js 16(App Router), React 19, TypeScript
- 서버 상태는 TanStack Query, 필터와 정렬은 URL search params
- 클라이언트는 FSD(`views → widgets → features → entities → shared`), 데이터 접근은 포트와 어댑터(헥사고날)로 나눈다. 서버 코드(`src/server`)와 FSD 계층은 서로 import하지 않고 계약(`src/contract`)만 공유한다(ESLint로 강제).
- 데이터: 공공데이터포털 구조동물 API([유기동물 조회 서비스](https://www.data.go.kr/data/15098931/openapi.do))를 Next 서버(Route Handler)에서만 받는다. API에 정렬이 없어 서버가 전체를 모은 뒤 필터·정렬·커서 페이지 나누기를 한다. 응답은 Zod로 도착 검증한다.
- 사진은 서버의 이미지 프록시가 sharp로 줄여 보낸다.
- 배포: Vercel(함수 리전 서울 `icn1`, [`vercel.json`](vercel.json))
- 검사: Vitest(단위·통합), Playwright(E2E), ESLint, `tsc`

## 문서와 일하는 방식

- [`docs/architecture.md`](docs/architecture.md): 현재 설계. 문서끼리 충돌하면 이것이 가장 앞선다.
- [`docs/glossary.md`](docs/glossary.md): 도메인 용어 사전. 화면, 코드, 공공 API, URL·저장소에서 같은 개념을 무엇이라 부르는지와 정해진 정의
- [`docs/PRD.md`](docs/PRD.md)와 변경 문서 [`PRD-v1.1`](docs/PRD-v1.1.md) · [`v1.2`](docs/PRD-v1.2.md) · [`v1.3`](docs/PRD-v1.3.md) · [`v1.4`](docs/PRD-v1.4.md) · [`v1.5`](docs/PRD-v1.5.md): 각 변경 문서는 앞 버전에서 바뀌는 부분만 적은 그 시점의 기록이다. 무엇이 무엇을 대체했는지는 `docs/PRD.md` 맨 앞 색인에 있다.
- [`docs/기능명세서.md`](docs/기능명세서.md), [`docs/design/`](docs/design/): 기능 명세와 디자인 토큰·핸드오프
- [`CLAUDE.md`](CLAUDE.md): 작업 규칙(문서 우선순위, 보안, 커밋 규칙)
- 일은 이슈에서 시작한다. 이슈 → 브랜치 → PR → 검사 통과 후 squash로 합치기.

## 실행 방법

Node `^20.19.0 || ^22.13.0 || >=24.0.0`, pnpm 10이 필요하다.

```sh
pnpm install
cp .env.example .env.local   # 값을 채운다
pnpm dev                      # 개발 서버
```

환경 변수([`.env.example`](.env.example)에 설명이 있다):

| 이름 | 용도 |
|---|---|
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터포털 서비스키. 서버 전용 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 JavaScript 키. 비우면 공유가 링크 복사로 동작한다 |
| `NEXT_PUBLIC_SITE_URL` | 공유 링크의 기준 주소. 비우면 접속한 주소 |

검사와 빌드:

```sh
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest run
pnpm e2e         # playwright test (스텁 서버, 실제 공공 API를 부르지 않는다)
pnpm e2e:live    # 실제 공공 API 응답 형식 확인
pnpm build       # next build
pnpm start       # next start
```
