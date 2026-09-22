# 냥공고 아키텍처 결정서

> 이 문서는 PRD, 기능명세서, 디자인 핸드오프보다 **우선**한다. 충돌하면 이 문서를 따르고, 충돌 내용을 보고한다.
> 상태 표기: **확정** = 사용자가 결정, **검증 필요** = 사실 확인이 끝나지 않음(추측 금지, 12절 참고).

## 1. 목적과 범위

유기묘 공고 모바일 웹(MVP). 사진 피드 + 카카오 공유. 서비스명은 임시(냥공고)이며 `SERVICE_NAME` 상수 한 곳에서만 정의한다.
이 문서는 데이터 계층, 서버 경계, 상태 관리의 결정을 다룬다. UI는 `docs/design/`을 따른다.

## 2. 결정 요약

| 주제 | 결정 | 상태 |
|---|---|---|
| 공공 API 호출 위치 | 브라우저에서 직접 호출하지 않는다. Next 서버(Route Handler)에서만 호출 | 확정 |
| 근거 | 서비스키 노출 방지, `http://` 엔드포인트의 혼합 콘텐츠, API에 정렬 파라미터 없음 (CORS 헤더 유무는 근거로 쓰지 않음) | 확정 |
| 모델 | 서버와 클라이언트는 Domain을 공유하지 않는다. 사이에 별도 응답 DTO(계약)를 둔다 | 확정 |
| DTO | 공공 API 응답은 1:1 DTO + Zod 검증. Domain으로 재활용하지 않는다 | 확정 |
| Zod의 역할 | 도착 검증만. 가공은 Mapper | 확정 |
| 정렬/필터/페이지 | 서버가 전체 수집 후 캐시, 서버에서 정렬/필터/커서 처리 | 확정 |
| 상태 관리 | 서버 상태는 TanStack Query, 필터는 URL, 나머지는 로컬. 전역 스토어 없음 | 확정 |
| HTTP 클라이언트 | 네이티브 `fetch` + 얇은 `httpClient` 래퍼. axios 사용 안 함 | 확정 |
| 찜 저장 | id만 저장, `/favorites` 진입 시 재조회 | 확정 |
| 종료 공고 | 표시한다(status 필터). 종료 사유는 노출하지 않는다 | 확정 |
| 배포 | Vercel Hobby. GitHub Pages는 서버 기능이 없어 부적합 | 확정 |

## 3. 계층, 모델, 폴더

```
공공 API 응답          UpstreamDto   (1:1, Zod)                 src/server/upstream
   ↓ 서버 Mapper
BFF 응답 DTO           AnimalWireDto (서버↔브라우저 계약, Zod)   src/contract
   ↓ 클라이언트 Mapper
FE Domain              Animal        (FE 관심사에 맞게 정의)     src/entities/animal
```

```
src/
  contract/          # WireDto Zod 스키마 + 타입. 서버와 클라이언트가 공유하는 유일한 지점 (Domain 아님)
  server/            # 공공 API 클라이언트, UpstreamDto, 서버 Mapper, 캐시, 정렬/필터/커서. FSD 밖
  app/               # Next App Router: 라우팅과 Route Handler(app/api/**)만
  views/             # FSD의 pages 레이어. Next의 pages 폴더와 충돌해서 views로 부른다 (명세의 pages와 같은 역할)
  widgets/  features/  entities/  shared/   # FSD
```

경계 규칙 (ESLint `no-restricted-imports` 등으로 강제한다):

- `src/server/**`는 `entities`, `features`, `widgets`, `views`, `shared/ui`를 import하지 않는다.
- FSD 계층(`entities` 등)은 `src/server/**`를 import하지 않는다.
- 둘 다 import할 수 있는 것은 `src/contract`뿐이다.
- FSD 계층 방향: `views → widgets → features → entities → shared`. 위에서 아래로만.
- UI는 Domain(`Animal`)만 소비한다. WireDto나 UpstreamDto를 컴포넌트에서 쓰지 않는다.

## 4. 공공 API 계약

- 서비스: `abandonmentPublicService_v2`, 유기동물 조회 `abandonmentPublic_v2`. 시도 `sido_v2`, 시군구 `sigungu_v2`, 보호소 `shelter_v2`, 품종 `kind_v2`.
- 확인된 요청 변수: `serviceKey`, `bgnde`/`endde`(구조일), `upkind`(개 417000, 고양이 422400, 기타 429900), `kind`, `upr_cd`(시도), `org_cd`(시군구), `care_reg_no`, `state`(전체=빈값, 공고중=`notice`, 보호중=`protect`), `neuter_yn`, `pageNo`, `numOfRows`(최대 1,000, 기본 10), `_type`(xml 기본, `json` 지원), `bgupd`/`enupd`, `sex_cd`, `rfid_cd`, `desertion_no`, `notice_no`. **정렬 파라미터는 없다.**
- 규모: 고양이 2,529건(2026-09-21 프로브. 이전 샘플은 고양이 2,481건, 전체 7,249건). `numOfRows=500`(5절)이면 고양이는 6회 호출이다(첫 페이지 후 나머지 5회를 동시성 3으로 병렬).
- 기본 정렬은 `desertionNo` 내림차순으로 보인다(두 샘플에서 확인). 시간순이 아니라 지역 코드순으로 뭉쳐 나온다.
- 응답 아이템 필드(XML 태그명 기준, DTO는 이름 그대로): `desertionNo, happenDt, happenPlace, kindFullNm, upKindCd, upKindNm, kindCd, kindNm, colorCd, age, weight, noticeNo, noticeSdt, noticeEdt, popfile1, popfile2, processState, sexCd, neuterYn, specialMark, careRegNo, careNm, careTel, careAddr, careOwnerNm, orgNm, updTm`. 일부 아이템에만 있는 optional: `vaccinationChk, sfeSoci, sfeHealth, endReason`. 사진은 `popfile1..N`(개수 가변, 프로브에서 최대 8). 문서에 없는 optional 필드(`healthChk`, `adptn*`, `srvc*`, `rfidCd`, `etcBigo`)도 오며 무시한다(12.A).
- UpstreamDto 필수 필드(확정): 없으면 유효한 WireDto를 만들 수 없는 것만 필수다. `desertionNo`(id, 빈 문자열 불가), `processState`(status), `upKindNm`(species), `noticeEdt`(D-day, `endingSoon` 정렬 키), `orgNm`(`regionText`는 non-null). 나머지는 optional이고 Mapper가 `null`/빈 배열/빈 정렬 키로 처리한다. 파싱은 item 단위 `safeParse`로 하며, 실패한 item은 로그(`desertionNo`, 이슈 경로)를 남기고 건너뛴다.
- 값의 특성(픽스처 `docs/fixtures/upstream-items.json` 참고): 날짜 `YYYYMMDD`, `updTm`은 `YYYY-MM-DD HH:mm:ss.S`, `age`는 `2024(년생)`, `2026(60일미만)(년생)`, `sexCd`는 `M`/`F`/`Q`, `neuterYn`은 `Y`/`N`/`U`, `processState`는 `보호중`, `종료(안락사)`, `종료(자연사)` 등. 사진 URL은 `http://`이고 파일명에 `[1]`이 있을 수 있다. `careNm`은 보호센터가 아니라 동물병원일 수 있다.
- JSON 응답 래퍼(확정, 12.A): `response.header { reqNo, resultCode, resultMsg }`, `response.body { items: { item: [...] }, numOfRows, pageNo, totalCount }`. 결과 1건도 길이 1 배열, 0건은 `items: {}`. 인증 오류는 HTTP 403 + `OpenAPI_ServiceResponse.cmmMsgHeader`. 구조의 합성 픽스처: `docs/fixtures/upstream-wrapper.json`. 방어적으로 단일 객체와 `items: ""`도 계속 받는다.
- 서비스키는 **디코딩된 키**를 환경변수로 두고 `URLSearchParams`가 인코딩하게 한다. 인코딩된 키를 그대로 넣으면 이중 인코딩된다.

## 5. 서버 계층 동작

```
Route Handler (app/api/animals)                       # 얇게: 파싱 → service → 응답 검증 → JSON
  → 입력 검증(Zod, server/animals/query): species, region, status, sort, cursor
  → AnimalService.list (server/animals/service, 순수, 소스 주입)
      → AnimalSource.list(species, uprCd | all)       # (upkind, upr_cd) 단위 전체 수집 + 캐시
          → upstream client: 1페이지(totalCount) → 나머지 페이지 병렬(동시성 3) → extract → parseUpstreamItems(item 단위 safeParse)
          → 서버 Mapper: UpstreamDto → { wire: AnimalWireDto, sortKeys }
      → 필터(status) → 정렬 → 커서 자르기
  → AnimalListResponse { items: AnimalWireDto[], nextCursor: string | null } 를 Zod로 검증 후 응답
```

구현 위치: `src/shared/api/http-client.ts`, `src/server/{config,logger,mapper}.ts`, `src/server/upstream/{client,extract,parse,dto}.ts`, `src/server/source/*`, `src/server/animals/{service,query,container,errors}.ts`, `src/server/http/respond.ts`, `src/app/api/animals/**`.

- 캐시 키: `(upkind, upr_cd | all)`. `state` 파라미터는 **사용하지 않는다**(`notice`/`protect` 의미가 검증되지 않았고 `종료` 값이 없음). status는 서버에서 `processState`로 판정한다.
- status 판정: `processState`가 `종료`로 시작하면 `ended`, 그 외는 `protected`. Zod는 `processState`를 enum이 아니라 `string`으로 받는다. 알 수 없는 값은 주입된 로거(`logger.warn`, 기본 no-op)로 남긴다.
- status 필터: `protected`(기본), `ended`, `all`(10절).
- 정렬 정의: `latest` = `noticeSdt` 내림차순, 동률이면 `updTm` 내림차순, 그다음 `desertionNo` 내림차순. `endingSoon` = 기준 시각(서비스에 주입하는 clock)의 오늘(KST) 기준으로 `noticeEdt`가 지나지 않은 공고(당일 포함)를 `noticeEdt` 오름차순으로 먼저, 지난 공고를 그 뒤에 `noticeEdt` 내림차순으로 둔다. `noticeEdt`가 `YYYYMMDD` 형식이 아니면 맨 뒤. 동률은 `desertionNo` 오름차순. (보호중인데 종료일이 지난 공고가 42.1%라 단순 오름차순이면 임박순 앞쪽이 지난 공고로 채워진다, 12절.) 정렬 키가 없으면 빈 문자열로 둔다. `sortKeys`는 응답에 넣지 않는다.
- 커서: 정렬된 결과의 offset을 base64url로 감싼 불투명 문자열. 잘못된 커서는 400, 범위를 넘으면 빈 목록. 마지막 페이지는 `nextCursor: null`. 캐시 갱신 중 페이지 사이에 중복/누락이 생길 수 있음을 알고 MVP에서 허용한다.
- 상세: 개별 `desertion_no` 조회(캐시는 id별). 찜 목록(`GET /api/animals/by-ids?ids=a,b,c`, 응답 `{ items }`)도 1차는 id별 조회를 병렬(동시성 제한)로 하고, 조회되지 않는 id는 응답에서 제외하며 입력 순서를 유지한다. 중복 id는 한 번만 조회한다. 조회 중 업스트림 오류는 일부만 빼지 않고 요청 전체를 실패(502/504)로 돌려준다(찜이 조용히 사라지지 않게).
- 캐시 방식(Next 데이터 캐시, `unstable_cache`, 인메모리, 외부 KV)은 **검증 필요**. `AnimalSource` 인터페이스 뒤에 숨겨서 교체 가능하게 만든다. 캐시 저장소에는 항목 크기 제한이 있을 수 있으니 원본이 아니라 Mapper를 거친 가벼운 목록을 저장한다.
- 캐시는 두 겹이다. 서버 재검증 주기와 클라이언트 `staleTime`을 문서 한 곳에 숫자로 정해 둔다. 원칙: 클라이언트 `staleTime`은 서버 재검증 주기보다 길지 않게. 초기값은 스파이크에서 정한다.
- 공공 API 호출에는 `AbortSignal.timeout`을 건다. 실패 시 표준화된 에러를 반환한다.
- 오류 응답은 `{ error: { code, message } }`. 입력 오류 400(`invalid_request`), 없음 404(`not_found`), 업스트림 실패 502(`upstream_error`, 인증/설정 오류 포함. 서버 로그에서는 `upstream auth/config error`로 구분하고 `returnReasonCode`, `errMsg`만 남긴다), 타임아웃 504(`upstream_timeout`), 설정 누락/계약 위반/기타 500(`internal_error`). 메시지에 키, URL, 업스트림 본문, 설정 상세를 넣지 않고 상세는 서버 로그에만 남긴다. 오류 응답은 `Cache-Control: no-store`.
- 튜닝 숫자는 `src/server/config.ts`의 `SERVER_TUNING` 한 곳에 둔다(초기값, 12절 스파이크에서 조정):

| 항목 | 값 |
|---|---|
| upstream fetch `revalidate` | 300초 |
| upstream 타임아웃 | 10,000ms |
| `numOfRows` | 500 (1,000건 페이지가 fetch 캐시 한도의 94.5%, 12절 3) |
| 나머지 페이지 동시 호출 수 | 3 |
| 조합당 최대 페이지 | 20 (500 × 20 = 10,000건) |
| 목록 페이지 크기 | 20 |
| by-ids 최대 / 동시성 | 50 / 5 |
| 성공 응답 `Cache-Control` | `public, s-maxage=60, stale-while-revalidate=300` |
| 클라이언트 `staleTime` | 60초(`src/shared/api/query-client.ts` `QUERY_STALE_TIME_MS`). 서버 재검증 주기(300초)보다 길지 않게, CDN `s-maxage=60`과 맞춤. 재시도 1회(타임아웃/네트워크/5xx만), `refetchOnWindowFocus: false`, `gcTime` 5분 |

## 6. 클라이언트 Domain과 Port

WireDto(`src/contract`)는 원시 타입만 쓴다(날짜는 문자열). Domain은 FE 관심사에 맞게 별도 정의한다.

```ts
// entities/animal/model — 명세 5.1 기준
type Animal = {
  id: string
  species: 'cat' | 'dog'
  images: string[]
  status: 'protected' | 'ended'      // 종료 사유는 넣지 않는다
  noticeEndAt: Date | null
  sex: 'male' | 'female' | 'unknown'
  ageText: string | null             // 1단계는 API 원문 유지, 표기 정제는 미정
  regionText: string                 // orgNm
  shelterName: string | null         // careNm. UI 라벨("보호소")은 미정(12절)
  foundPlaceText: string | null      // happenPlace
  noticePeriodText: string | null    // "MM.DD ~ MM.DD"
}
```

- 연락처(`careTel`, `careAddr`, `careOwnerNm`)와 종료 사유(`endReason`)는 WireDto와 Domain 어디에도 넣지 않는다(PRD: 보호소 연락 정보 비노출).
- 파생값은 domain 서비스에서 계산한다: `dDay`(KST 기준, 기준 시각을 주입 가능하게), `isSoon`(D-day 3 이하). 종료 판정은 `processState`가 한다. `dDay`는 `number | null`이며 규칙은 10절을 따른다.
- `sexCd`: `M`→male, `F`→female, 그 외(`Q` 포함)→unknown.
- 이미지: `popfile1..N` 중 존재하는 것만 배열로. 파일명의 `[` `]`는 인코딩한다. `http`→`https` 처리는 별도 단계(`next/image` 원격 도메인 설정 또는 이미지 프록시)에서 다룬다.

```ts
// Port — entities/animal
interface AnimalRepository {
  getAnimals(params: { species; region?; status; sort; cursor? }): Promise<AnimalPage> // { items: Animal[]; nextCursor: string | null }
  getAnimalById(id: string): Promise<Animal>
  getAnimalsByIds(ids: string[]): Promise<Animal[]>
}
```

어댑터(`infrastructure`)는 `httpClient`로 자체 `/api/**`를 호출하고, WireDto를 Zod로 검증한 뒤 클라이언트 Mapper로 Domain을 반환한다.

## 7. 상태 분류

| 종류 | 담당 | 규칙 |
|---|---|---|
| 서버 상태(목록, 상세, 찜 목록) | TanStack Query (`useInfiniteQuery` 등) | 다른 저장소나 `useState`로 복사 금지. 가공은 `select` 또는 렌더 시 파생 |
| 필터/정렬 | URL search params | `species`, `region`, `status`, `sort`만. 기본 `species=cat`, `status=protected`, `sort=latest`. **`page`는 URL에 넣지 않는다**(내부 커서) |
| 찜 목록 | localStorage + 작은 훅 | id 배열만 저장. 읽을 때 Zod로 검증 |
| 일시적 UI(필터 시트 draft, 뷰어 index, 토스트) | 컴포넌트 로컬 state | 시트 draft는 [적용하기]에서만 URL 반영, 닫히면 버림 |

- 전역 스토어(Redux, Zustand, Recoil 등)를 도입하지 않는다.
- 상세에서 뒤로 왔을 때 목록 복원: TanStack Query 캐시(같은 queryKey = 필터 4종)로 로드된 페이지를 복원하고, 스크롤 위치는 세션 스토리지 등에 저장한다.
- `region` URL 값은 시도 코드(`upr_cd`). 라벨은 UI에서 매핑. 시군구 필터는 MVP 이후.

## 8. 찜

- localStorage에는 animal id 배열만 저장한다(확정: 스냅샷 저장 안 함, 진실은 서버 하나).
- `/favorites` 진입 시 `getAnimalsByIds`로 조회한다. 조회되지 않는 id는 화면에서 제외하고 저장은 유지한다(관찰 후 결정).

## 9. HTTP, 환경변수, 배포

- 서버와 클라이언트 모두 `shared`의 얇은 `httpClient`(네이티브 `fetch` 래퍼, `src/shared/api/http-client.ts`)를 쓴다: 타임아웃(`AbortSignal.timeout`, 호출별 override), HTTP 에러의 예외화, 에러 표준화(`HttpError`: timeout / network / status / parse). Next `fetch`의 `next: { revalidate }`, `cache` 옵션을 그대로 전달한다. 테스트는 `fetch` 구현을 주입한다. 오류 메시지와 예외에는 URL의 origin+path만 남기고 쿼리스트링(서비스키)과 원래 오류 메시지/`cause`는 싣지 않는다.
- 환경변수: `DATA_GO_KR_SERVICE_KEY`(서버 전용, `NEXT_PUBLIC_` 금지, 디코딩된 키. `process.env`는 `src/server/config.ts`에서만 요청 시점에 읽는다. 없으면 500이며 import/빌드 시점에는 실패하지 않는다), `NEXT_PUBLIC_KAKAO_JS_KEY`(도메인 제한이 있는 공개 키라 허용). `.env.local`은 커밋하지 않고 `.env.example`만 커밋한다. 배포 환경은 Vercel 환경변수. GitHub Secrets는 CI에서 실제 API를 호출할 때만 필요하며 MVP에서는 픽스처로 테스트하므로 쓰지 않는다.
- 배포: Vercel Hobby(비상업용 약관 확인). 함수 리전(서울 가능 여부), 실행 시간 제한은 **검증 필요**(12절 스파이크).
- 서비스키가 로그, 테스트, 픽스처, 커밋에 들어가지 않게 한다. 이미 대화에 노출된 키는 재발급한 것으로 가정한다.

## 10. 종료 공고 정책

- 종료 공고(안락사, 자연사 포함)는 status 필터(`ended`, `all`)로 표시한다. 기본은 `protected`.
- D-day 정책(확정): 종료(`ended`) 공고, `noticeEndAt`이 없는 공고, `noticeEndAt`이 오늘(KST)보다 과거인 보호중 공고는 `dDay = null`, 당일은 0. `isSoon`은 `dDay !== null && dDay <= 3`. 종료일이 지난 보호중 공고는 서버에서 제외하지 않고, 배지는 "보호중"만 표시한다(D-day 없음).
- 종료 사유는 UI, WireDto, Domain 어디에도 노출하지 않는다. 종료 카드는 회색 배지 + 사진 채도 소폭 낮춤(`saturate(.7)`).
- 종료 상세의 찜/공유는 활성 상태로 둔다.
- 우선 이 계획대로 구현하고, 이후 관찰한다: 종료 비율(`processState` 값 집계), 종료 카드의 진입률과 공유율(이벤트에 status 포함).
- Mapper는 알 수 없는 `processState` 값을 주입된 로거로 남긴다(Mapper는 `process.env`를 읽지 않는다).

## 11. 문서 반영 현황 (PRD, 기능명세서)

`docs/PRD.md`, `docs/기능명세서.md`에 **반영 완료**: 서버 프록시/캐시 MVP 승격, `page` URL 미포함, `status` 기본 `protected`, `region` 시도 코드, 찜 id만 저장, 종료 사유 비노출, 기준 폭 390과 4:5 cover 카드, 토스트 문구 "링크가 복사됐어요", 서버/클라이언트 Domain 분리와 응답 DTO, `pages` → `views`.

명세의 나머지 "결정 필요" 항목(사진 없는 공고, 초기화 버튼, 목록 끝 표시, 카드 내 찜 아이콘)은 미정이다(D-day 지남 정책은 10절에서 결정됨). 이 문서와 문서 간 새 불일치가 생기면 이 절에 적는다.

## 12. 미확정 / 스파이크

각 항목은 추측하지 말고, 해당 단계에서 검증한 뒤 이 절을 갱신한다.

### 12.A 확정됨(2026-09-21 프로브)

로컬에서 실제 호출한 결과다(`scripts/probe.ts`, 커밋하지 않음). 고양이(`upkind=422400`) 전체 스냅샷 기준이며, 값은 시점에 따라 바뀐다.

| # | 항목 | 결과 |
|---|---|---|
| P1 | JSON 래퍼 | `response.header { reqNo(number), resultCode(string), resultMsg }`, `response.body { items: { item: [...] }, numOfRows, pageNo, totalCount }`. 성공 `resultCode`는 `"00"`, `totalCount`는 number |
| P2 | 결과 1건 / 0건 | 1건도 `item`은 길이 1 배열. 0건은 `items: {}`, `totalCount: 0`, `resultCode: "00"`(존재하지 않는 `desertion_no` 조회) |
| P3 | 인증 오류 | 잘못된 키: HTTP 403, `application/json`, `{ OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg, returnAuthMsg, returnReasonCode } } }`(212바이트). `_type=json`이면 XML이 아니라 JSON |
| P4 | 규모와 크기 | 고양이 전체 2,529건. `numOfRows=1000` 페이지 원본 1,445,511 / 1,486,827 바이트(1.45~1.49MB), 마지막 529건 763,248 바이트. base64 추정 최대 1,982,436자(2MB 한도의 94.5%). 전체 순회 3회 1,901ms(페이지당 474~725ms). 픽스처로 한 추정(1.4~1.5MB)보다 컸다(실제 item은 필드가 더 많다) |
| P5 | `processState` 분포 | 보호중 1,371(54.2%) / 종료(자연사) 754(29.8%) / 종료(입양) 233(9.2%) / 종료(방사) 57(2.3%) / 종료(안락사) 53(2.1%) / 종료(기증) 39(1.5%) / 종료(반환) 22(0.9%). `보호중`과 `종료(...)` 외 값 없음 |
| P6 | 만료된 보호중 | 보호중 1,371건 중 `noticeEdt`가 오늘(KST 2026-09-21) 이전인 공고 577건(42.1%) |
| P7 | 사진 | 사진 0장 공고 없음(모두 2장 이상, 2장 91.9%, 최대 8장). 이미지 URL 5,512개 전부 `http://`, `[` 포함 628개, `%`/공백/비ASCII 포함 0개 |
| P8 | 기타 값 | `sexCd` M 1,019 / F 985 / Q 525. `neuterYn` N 1,893 / U 519 / Y 117. `upKindNm` 전부 `고양이` |
| P9 | 단건 조회 | 종료(안락사) 공고 1건의 `desertion_no` 조회 성공(길이 1 배열, id 일치). 오래된 공고 전반은 미검증 |
| P10 | 미문서화 필드 | `healthChk`(4.3%), `adptnTitle/adptnSDate/adptnEDate/adptnConditionLimitTxt/adptnTxt/adptnImg`, `srvcTitle/srvcSDate/srvcEDate/srvcConditionLimitTxt/srvcTxt`(각 0.6%), `rfidCd`(0.2%), `etcBigo`(0.1%). DTO에 선언하지 않고 무시한다. 문서의 기본 27개 필드는 2,529건 모두에 있었다 |

### 12.B 미확정 목록

확정된 항목은 번호를 유지하고 12.A를 가리킨다(코드 주석이 번호로 참조한다).

1. ~~`processState`의 실제 값 목록과 비율~~ **확정됨(2026-09-21 프로브)**: 12.A P5. 개는 미검증. 종료 사유별 표시 문제는 21
2. ~~JSON 응답의 래퍼 구조와 단일 객체/배열 처리~~ **확정됨(2026-09-21 프로브)**: 12.A P1~P3, 픽스처 `docs/fixtures/upstream-wrapper.json`(구조만 실제, 값은 합성). `extract.ts`는 방어적으로 단일 객체, `items: ""`, 누락도 계속 받고, 최상위 `response`가 없으면 업스트림 오류로 본다
3. 서버 캐시 방식과 항목 크기 제한, 재검증 주기 값, 서버리스 콜드스타트에서 전체 수집 시 실행 시간
   - 현재: upstream 페이지 fetch에 Next `revalidate: 300`(데이터 캐시). 조립은 요청마다 메모리에서 한다. Route Handler는 `request.url`을 읽어 동적이며, 명시적 `revalidate`를 준 fetch가 동적 핸들러에서도 캐시되는지는 실제 로그로 확인 필요
   - 크기 제한은 **코드로 확인됨**(Next 16.3.5 `dist/server/lib/incremental-cache/index.js`): fetch 캐시 항목의 `JSON.stringify(data).length`가 2MB(2 × 1024 × 1024)를 넘으면 캐시하지 않는다(커스텀 cache handler를 쓰면 예외). 응답 본문은 base64로 저장되므로(`patch-fetch.js`) 측정값은 UTF-8 바이트의 약 4/3이다
   - **보안 위험(코드로 확인됨)**: 제한을 넘으면 Next가 `Failed to set Next.js data cache for ${fetchUrl} ...`를 dev에서는 예외로 던지고 prod에서는 `console.warn`으로 남긴다. `fetchUrl`은 쿼리스트링(서비스키)을 포함한 전체 URL이다. 우리 로거로는 막을 수 없다
   - **`numOfRows` 결정(2026-09-21)**: 1,000건 페이지가 base64 추정 1,982,436자로 한도의 94.5%(12.A P4)라 여유가 없어 **500**으로 낮췄다. 500건이면 원본 약 0.75MB, base64 약 1.0MB(약 48%)로 추정된다(1,000건 측정값의 절반, 미측정). 호출 수는 고양이 3회 → 6회가 되어 첫 페이지 후 나머지를 동시성 3으로 병렬 수집한다
   - 남은 확인: 500건 페이지의 실제 크기, 동적 핸들러에서 캐시 적중 여부, 콜드스타트 전체 수집 시간(Vercel 로그), 재검증 주기 300초의 적정성
4. Vercel 함수 리전(서울 가능 여부)과 공공 API 응답 속도, 해외 IP 제한 여부, 함수 실행 시간 제한(고양이 전체 수집 6회 호출: 1회 + 나머지 5회 병렬, 호출당 타임아웃 10초). **확인 방법**: Vercel 프로젝트 설정의 Functions Region, 배포 후 함수 로그의 실행 시간, 리전별 upstream 응답 시간. 로컬 기준 1,000건 페이지 474~725ms(12.A P4). 병렬 수집(동시성 3)이 공공 API의 호출 간격 제한에 걸리는지도 확인
5. `desertion_no`로 조회 시 종료/오래된 공고가 조회되는지. 종료(안락사) 1건은 `upkind` 없이 조회 성공(12.A P9). **오래된 공고 전반은 미검증**. 결과는 계속 id로 한 번 더 거른다
6. 이미지 `http` 처리 방식(원격 도메인 설정 vs 프록시). 이미지 URL은 모두 `http://`(12.A P7). **같은 경로가 `https`로도 제공되는지는 미검증**
7. 카카오 피드 이미지 비율 제한, `next/og`(Satori)의 폰트 형식(woff2 미지원 가능성)과 CSS 변수 미지원 가능성
8. UI 라벨 "보호소": `careNm`이 병원일 수 있어 "보호 장소" 등으로 바꿀지
9. `ageText` 표기 정제(`2024(년생)` → "2살 추정" 등)
10. ~~`noticeEdt`가 지난 protected 공고의 D-day 정책~~ **결정됨**: `dDay = null`, `isSoon = false`, 서버에서 제외하지 않음(10절). 고양이 보호중의 42.1%(577건)가 해당한다(12.A P6). endingSoon 정렬은 이들을 뒤로 보낸다(5절)
11. 필터 적용 상태 표시(필터 버튼 점): 미정
12. `upKindNm`이 `고양이`/`개`가 아닌 항목: WireDto `species`는 `cat | dog`뿐이라 서버 Mapper가 `null`을 반환하고 로거로 남긴다(목록에서 제외). 고양이 조회는 전부 `고양이`였다(12.A P8). 개 조회는 미검증
13. ~~이미지 URL 인코딩의 이중 인코딩~~ **결정됨**: `encodeURI` 대신 `[` `]`만 `%5B` `%5D`로 치환한다(이미 인코딩된 `%`는 유지, 멱등). 고양이 이미지 URL 5,512개 중 `[` 포함 628개, `%`/공백/비ASCII는 0개(12.A P7)
14. ~~UpstreamDto 필수 필드 기준~~ **결정됨**: 4절. 고양이 2,529건 모두 문서의 기본 27개 필드가 있어 필수 필드 누락은 없었다(12.A P10)
15. `resultCode` 오류 판정: 성공은 `"00"`, 0건도 `"00"`(12.A P1, P2). 인증 오류는 `resultCode`가 아니라 HTTP 403 + `OpenAPI_ServiceResponse`로 온다(P3, `reason=auth`로 분류). "코드가 있고 공공데이터포털 공통 오류 코드(`01, 02, 04, 05, 10, 11, 12, 20, 22, 30, 31, 32, 33, 99`)일 때만 오류" 규칙은 유지하지만, 200 응답에 이 코드들이 실제로 오는지는 여전히 미검증. `returnReasonCode` 값 목록도 미검증
16. `region`(시도 코드 `upr_cd`)과 `id`(`desertionNo`)의 형식: 숫자 문자열(1~32자리)만 검사한다. 실제 코드 목록(`sido_v2`)과 자릿수는 미검증
17. 오프셋 커서의 밀림: 서버 캐시(재검증 300초)가 갱신되는 사이에 페이지를 넘기면 중복/누락이 생길 수 있다. MVP에서 허용
18. `Cache-Control`(`s-maxage=60, stale-while-revalidate=300`) 값은 초기값이며 튜닝 필요. CDN 캐시 키에 쿼리스트링이 포함되는지(Vercel) 확인
19. 최대 페이지 가드(조합당 20페이지, `numOfRows=500`이면 10,000건): 넘으면 잘린 목록을 돌려주고 경고 로그를 남긴다. 고양이 2,529건은 6페이지. 개 규모는 22
20. by-ids의 id별 upstream 호출: 찜 50개면 캐시 미스 시 최대 50회 호출. 공공 API 일일 트래픽 한도와 호출 간격 제한은 미검증
21. 종료 공고 정책: 종료 공고의 대부분은 사망이 아니다. 종료(입양) 233, 방사 57, 기증 39, 반환 22건이 자연사 754, 안락사 53건과 같은 "종료" 배지로 보인다(12.A P5). 종료 사유 비노출(10절)은 유지하고 **결정 보류**, 다음 UI 단계에서 재검토
22. 개(`upkind=417000`) 규모와 페이지 수, 페이지 크기: 미측정(이전 샘플 전체 7,249건에서 역산하면 5천 건 미만으로 보이나 추정). 최대 페이지 가드와 수집 시간 확인 필요
