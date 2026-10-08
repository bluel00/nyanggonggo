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
- 지역 코드(확정, 2026-09-22 실측, 12.A P11): 시도 `sido_v2`와 시군구 `sigungu_v2`(`upr_cd`로 조회, 페이지 있음)의 항목은 `orgCd`, `orgdownNm`(시군구는 `uprCd` 포함). 앱은 이 결과를 정적 파일 `src/shared/config/regions.ts`(시도 16, 시군구 237)로 굳혀 쓰며 **런타임에 두 operation을 호출하지 않는다**. 실제 구가 아닌 항목(코드가 시도 코드와 같음, `ddd99dd` 코드, 이름 없음: 19개)은 제외했다. 목록을 바꾸려면 로컬 프로브를 다시 실행해 파일을 다시 만든다(방법은 파일 상단 주석).
- 확인된 요청 변수: `serviceKey`, `bgnde`/`endde`(구조일), `upkind`(개 417000, 고양이 422400, 기타 429900), `kind`, `upr_cd`(시도), `org_cd`(시군구), `care_reg_no`, `state`(전체=빈값, 공고중=`notice`, 보호중=`protect`), `neuter_yn`, `pageNo`, `numOfRows`(최대 1,000, 기본 10), `_type`(xml 기본, `json` 지원), `bgupd`/`enupd`, `sex_cd`, `rfid_cd`, `desertion_no`, `notice_no`. **정렬 파라미터는 없다.**
- 축종(확정, 2026-10-01 실측, 12.A P12): `upkind`는 고양이 422400, 개 417000, **기타 429900**이고 응답의 `upKindCd`/`upKindNm`이 각각 `422400`/`"고양이"`, `417000`/`"개"`, `429900`/`"기타"`다. 앱은 이 셋을 모두 쓴다(`UPKIND_BY_SPECIES`, `src/server/upstream/client.ts`).
- 품종 이름(확정, 2026-10-01 실측, 12.A P12): `kindFullNm`은 늘 `"[<축종>] <품종>"`이고 빈 값이 없다(고양이·개 1,000건씩, 기타 155건 전부). **기타 축종은 `kindNm`이 100% `"기타축종"`, `kindCd`가 100% `000117`이라 어떤 동물인지 알 수 없고, 실제 동물(토끼, 앵무새, 닭…)은 `kindFullNm`에만 있다.** 그래서 서버 Mapper가 `[...]` 접두어를 떼어 WireDto `kindText`로 내려준다(6절).
- 규모: 고양이 2,529건(2026-09-21 프로브. 이전 샘플은 고양이 2,481건, 전체 7,249건). `numOfRows=500`(5절)이면 고양이는 6회 호출이다(첫 페이지 후 나머지 5회를 동시성 3으로 병렬).
- 기본 정렬은 `desertionNo` 내림차순으로 보인다(두 샘플에서 확인). 시간순이 아니라 지역 코드순으로 뭉쳐 나온다.
- 응답 아이템 필드(XML 태그명 기준, DTO는 이름 그대로): `desertionNo, happenDt, happenPlace, kindFullNm, upKindCd, upKindNm, kindCd, kindNm, colorCd, age, weight, noticeNo, noticeSdt, noticeEdt, popfile1, popfile2, processState, sexCd, neuterYn, specialMark, careRegNo, careNm, careTel, careAddr, careOwnerNm, orgNm, updTm`. 일부 아이템에만 있는 optional: `vaccinationChk, sfeSoci, sfeHealth, endReason`. 사진은 `popfile1..N`(개수 가변, 프로브에서 최대 8). 문서에 없는 optional 필드(`healthChk`, `adptn*`, `srvc*`, `rfidCd`, `etcBigo`)도 오며 무시한다(12.A).
- UpstreamDto 필수 필드(확정): 없으면 유효한 WireDto를 만들 수 없는 것만 필수다. `desertionNo`(id, 빈 문자열 불가), `processState`(status), `upKindNm`(species), `noticeEdt`(D-day, `endingSoon` 정렬 키), `orgNm`(`regionText`는 non-null). 나머지는 optional이고 Mapper가 `null`/빈 배열/빈 정렬 키로 처리한다. 파싱은 item 단위 `safeParse`로 하며, 실패한 item은 로그(`desertionNo`, 이슈 경로)를 남기고 건너뛴다.
- 지역 값(실측, 2026-09-29): 응답에는 지역 **코드**(`upr_cd`/`org_cd`에 해당하는 값)가 **없다**. 기관 이름 `orgNm`이 `"<시도명> <시군구명>"`이고, 조회에 쓴 `org_cd`와 같은 지역을 가리킨다(예: `org_cd=3000000` → `"서울특별시 종로구"`, `org_cd=3350000` → `"부산광역시 금정구"`). 보호소 주소(`careAddr`)는 공고 관할과 다를 수 있어(종로구 공고의 보호소가 경기도 양주시) 지역 판정에 쓰지 않는다. 전국 시도별 표본에서 `orgNm` 170종 중 167종이 정적 지역 목록의 시군구와 이름으로 정확히 매칭됐고, 나머지는 시도만 남는 케이스다(12절 39). 그래서 Domain의 `regionText`(= `orgNm`)만으로 목록 필터를 되만들 수 있다(7절).
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

구현 위치: `src/shared/api/http-client.ts`, `src/shared/lib/concurrency.ts`(서버와 클라이언트 공용 동시성 헬퍼), `src/server/{config,logger,mapper}.ts`, `src/server/upstream/{client,extract,parse,dto}.ts`, `src/server/source/*`, `src/server/animals/{service,query,container,errors}.ts`, `src/server/http/respond.ts`, `src/app/api/animals/**`.

- 캐시 키: `(upkind, upr_cd | all, org_cd | all)`. 요청의 `region`은 `upr_cd`, `district`는 `org_cd`로 보낸다. `district`는 `region`과 함께만 받는다(시군구만 오면 400). 전국(`region` 없음)에는 `upr_cd`/`org_cd`를 보내지 않는다(가짜 코드에 의존하지 않음). `state` 파라미터는 **사용하지 않는다**(`notice`/`protect` 의미가 검증되지 않았고 `종료` 값이 없음). status는 서버에서 `processState`로 판정한다.
- status 판정: `processState`가 `종료`로 시작하면 `ended`, 그 외는 `protected`. Zod는 `processState`를 enum이 아니라 `string`으로 받는다. 알 수 없는 값은 주입된 로거(`logger.warn`, 기본 no-op)로 남긴다.
- status 필터: `protected`(기본), `ended`, `all`(10절).
- 정렬 정의: `latest` = `noticeSdt` 내림차순, 동률이면 `updTm` 내림차순, 그다음 `desertionNo` 내림차순. `endingSoon` = 기준 시각(서비스에 주입하는 clock)의 오늘(KST) 기준으로 `noticeEdt`가 지나지 않은 공고(당일 포함)를 `noticeEdt` 오름차순으로 먼저, 지난 공고를 그 뒤에 `noticeEdt` 내림차순으로 둔다. `noticeEdt`가 `YYYYMMDD` 형식이 아니면 맨 뒤. 동률은 `desertionNo` 오름차순. (보호중인데 종료일이 지난 공고가 42.1%라 단순 오름차순이면 임박순 앞쪽이 지난 공고로 채워진다, 12절.) 정렬 키가 없으면 빈 문자열로 둔다. `sortKeys`는 응답에 넣지 않는다.
- 커서(확정, 2026-09-29): **앞 페이지 마지막 항목의 정렬 키**(id, noticeSdt, noticeEdt, updTm)를 base64url로 감싼 불투명 문자열. 다음 페이지는 정렬 순서에서 그 항목보다 뒤에 오는 항목부터다(이분 탐색). 잘못된 커서는 400, 끝을 넘으면 빈 목록, 마지막 페이지는 `nextCursor: null`. 목록은 요청마다 새로 조립하므로 offset을 쓰면 사이에 공고가 하나만 추가되거나 상태가 바뀌어도 경계에서 중복/누락이 생긴다(12절 38)
- 상세: 개별 `desertion_no` 조회(캐시는 id별). 찜 목록(`GET /api/animals/by-ids?ids=a,b,c`, 응답 `{ items }`)도 1차는 id별 조회를 병렬(동시성 제한)로 하고, 조회되지 않는 id는 응답에서 제외하며 입력 순서를 유지한다. 중복 id는 한 번만 조회한다. 조회 중 업스트림 오류는 일부만 빼지 않고 요청 전체를 실패(502/504)로 돌려준다(찜이 조용히 사라지지 않게).
- 업스트림 캐시(확정, 2026-10-07): **검증을 통과한 페이지만 캐시한다.** 원본 fetch는 `cache: "no-store"`이고 Next `revalidate`를 걸지 않는다. 업스트림 클라이언트에 주입한 페이지 캐시(`UpstreamPageCache`, 서버 구현 `src/server/upstream/next-page-cache.ts` = `unstable_cache`, 재검증 300초)가 "받기 + 검증(래퍼 모양, 오류 코드)"이 성공한 페이지만 저장한다. 오류는 예외라 저장되지 않는다. 이유: 공공데이터포털은 오류(한도 초과 등)를 HTTP 200 본문으로 보내기도 하는데, Next fetch 캐시는 status 200이면 본문과 상관없이 저장해서(`next/dist/server/lib/patch-fetch.js`) 오류 본문이 재검증 주기 동안 정상 응답처럼 재사용될 수 있었다. 캐시 키는 요청 파라미터뿐이고 서비스키가 없다(전에는 fetch 캐시 항목 한도 초과 경고에 서비스키가 든 전체 URL이 찍힐 위험이 있었다, 12절 3). Next 16 문서는 `unstable_cache` 대신 `use cache`를 권하지만 Cache Components를 앱 전체에 켜야 해서 지금은 이 파일 하나에 가둔다. Next 런타임 밖(단위 테스트)에서는 `unstable_cache`를 쓸 수 없어 클라이언트 테스트는 가짜 페이지 캐시를, 라우트 통합 테스트는 통과형 `next/cache`를 쓴다. `AnimalSource` 인터페이스는 그대로 두어 다른 저장소로 바꿀 수 있다.
- 캐시는 두 겹이다. 서버 재검증 주기와 클라이언트 `staleTime`을 문서 한 곳에 숫자로 정해 둔다. 원칙: 클라이언트 `staleTime`은 서버 재검증 주기보다 길지 않게. 초기값은 스파이크에서 정한다.
- 공공 API 호출에는 `AbortSignal.timeout`을 건다. 실패 시 표준화된 에러를 반환한다.
- 오류 응답은 계약 `ApiErrorResponse`(`{ error: { code, message } }`, `src/contract/animals.ts`)로 통일한다. 서버(`server/http/respond.ts`)는 보내기 전에 이 스키마로 검증하고, 클라이언트(`shared/api/api-request.ts`)는 같은 스키마로 `code`와 `message`를 읽어 `ApiError`로 바꾼다. 입력 오류 400(`invalid_request`), 없음 404(`not_found`), 업스트림 실패 502(`upstream_error`, 인증/설정 오류와 일일 호출 한도 초과 포함. 서버 로그에서는 `upstream auth/config error`(reason `auth`, `returnReasonCode`, `errMsg`만)와 `upstream quota exceeded`(reason `quota_exceeded`, 아래)로 구분한다), 타임아웃 504(`upstream_timeout`), 설정 누락/계약 위반/기타 500(`internal_error`). 메시지에 키, URL, 업스트림 본문, 설정 상세를 넣지 않고 상세는 서버 로그에만 남긴다. 오류 응답은 `Cache-Control: no-store`(API 라우트와 이미지 프록시의 대체 응답 모두).
- 일일 호출 한도 초과(확정, 2026-10-07): 공공데이터포털 공통 오류 코드 22(`LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR`, https://www.data.go.kr/data/15098931/openapi.do 에러코드 표)를 다른 오류와 구분해 `upstream quota exceeded` 로그(reason `quota_exceeded`, detail은 응답 모양·HTTP 상태·`code`·`errMsg`만)로 남긴다. 응답 모양이 문서에 없어 세 가지를 모두 본다: HTTP 오류 + `OpenAPI_ServiceResponse.cmmMsgHeader.returnReasonCode` 22(상태 코드와 상관없이), 200 + `response.header.resultCode` 22, 200 + `cmmMsgHeader` 22. 사용자에게는 다른 업스트림 오류와 같은 502와 같은 화면이다. XML 본문으로 오는 한도 초과는 구분하지 않는다(`_type=json`이면 JSON으로 온다는 12.A P3에 기댄다). 운영에서는 Vercel 함수 로그에서 `upstream quota exceeded`를 찾는다(12절 45)
- 튜닝 숫자는 `src/server/config.ts`의 `SERVER_TUNING` 한 곳에 둔다(초기값, 12절 스파이크에서 조정):

| 항목 | 값 |
|---|---|
| 업스트림 페이지 캐시 재검증(`unstable_cache`, 검증을 통과한 페이지만. 원본 fetch는 `no-store`) | 300초 |
| upstream 타임아웃 | 10,000ms |
| `numOfRows` | 500 (예전 fetch 캐시 방식에서 1,000건 페이지가 항목 한도의 94.5%였다, 12절 3) |
| 나머지 페이지 동시 호출 수 | 3 |
| 조합당 최대 페이지 | 20 (500 × 20 = 10,000건) |
| 목록 페이지 크기 | 20 |
| by-ids 최대 | 50(`ANIMAL_BY_IDS_MAX`, `src/contract`. 서버는 넘으면 400, 클라이언트는 이 단위로 나눠 동시 3개씩 요청하고 입력 순서대로 합친다) |
| by-ids 서버 동시 조회 수 | 5 |
| 성공 응답 `Cache-Control` | `public, s-maxage=60, stale-while-revalidate=300` |
| 클라이언트 `staleTime` | 60초(`src/shared/api/query-client.ts` `QUERY_STALE_TIME_MS`). 서버 재검증 주기(300초)보다 길지 않게, CDN `s-maxage=60`과 맞춤. 재시도 1회(타임아웃/네트워크/5xx만), `refetchOnWindowFocus: false`, `gcTime` 5분. **목록(무한쿼리)은 재요청을 하지 않는다**(아래) |

- 목록 무한쿼리의 재요청(확정, 2026-09-30): `animalsInfiniteOptions`(`src/entities/animal/api/queries.ts`)에만 `refetchOnMount: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`를 준다. 상세와 by-ids는 기본값 그대로다.
  - 이유: 무한쿼리의 refetch는 쌓인 페이지를 **처음 커서부터 전부 순차로** 다시 받는다. 50페이지를 본 목록으로 돌아오면 `/api/animals`가 51번 나갔다(12절 42). 페이지 수에 비례해 라우트 실행과 지역 전체 조립이 늘고, 목록은 요청마다 새로 조립하므로 복원 직후 결과가 바뀌면 열었던 카드 위치도 밀린다. `staleTime`을 늘리는 것은 이 연쇄를 없애지 못하고 미루기만 한다. focus(공유 후 앱 복귀)와 reconnect도 같은 연쇄를 일으킨다.
  - 신선도 상한은 `gcTime` 5분(`QUERY_GC_TIME_MS`)이다. 목록을 떠나 5분이 지나면 비활성 쿼리가 캐시에서 사라지고 다음 진입은 첫 페이지부터 새로 받는다. 즉 화면에 남는 목록은 최대 5분 오래된 데이터다.
  - 데이터가 없으면(첫 진입, 필터 변경 = 새 쿼리 키, 새로고침) 이 설정과 무관하게 받는다. `gcTime`이 지난 뒤 돌아왔을 때 열었던 카드가 첫 페이지 밖이면 복원은 조용히 맨 위에 둔다(7절 규칙 그대로).
  - 검증: `src/entities/animal/api/queries.test.tsx`(재마운트, focus, reconnect, 필터 변경)와 `e2e/list-refetch.spec.ts`(실제 브라우저, `page.clock.setFixedTime`으로 staleTime 경과).

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
  specialMarkText: string | null     // specialMark(특이사항). 상세에서만 노출
  kindText: string | null            // 품종 이름(kindFullNm의 "[축종]" 뒤). 기타 축종은 실제 동물
}
```

- 연락처(`careTel`, `careAddr`, `careOwnerNm`)와 종료 사유(`endReason`)는 WireDto와 Domain 어디에도 넣지 않는다(PRD: 보호소 연락 정보 비노출).
- 파생값은 domain 서비스에서 계산한다: `dDay`(KST 기준, 기준 시각을 주입 가능하게), `isSoon`(D-day 3 이하). 종료 판정은 `processState`가 한다. `dDay`는 `number | null`이며 규칙은 10절을 따른다.
- `species`: `cat | dog | other`. 업스트림 `upKindNm`의 `고양이`/`개`/`기타`를 서버 Mapper가 옮기고, 그 외 값은 항목을 건너뛴다(로그).
- `kindText`(확정, 2026-10-01): `kindFullNm`에서 `[<축종>]` 접두어를 떼고 앞뒤 공백을 지운 값이다. 접두어가 없으면 값 전체를 쓰고, 비어 있거나 품종을 특정할 수 없는 값(`기타`, `기타축종`)이면 `null`이다(4절, 12.A P12).
  - 화면 규칙은 `entities/animal/ui/labels.ts` 한 곳에 있다. `speciesText(animal)`는 축종 자리에 쓸 텍스트로, 고양이/강아지는 라벨이고 **기타는 `kindText`(없으면 "기타 동물")**다. 사진 alt, 카카오 공유 제목, OG 제목이 이 함수를 쓴다.
  - `animalTitle(animal)`은 카드 1줄, 상세 타이틀, OG 이미지 제목이다. 기본은 지역이고 기타 축종만 `"<동물> · <지역>"`으로 어떤 동물인지를 앞에 붙인다(기타 공고의 카드/상세 시안이 없어 임시, 12절 43). 링크 미리보기 제목은 `"<지역> <동물> 공고 | <서비스명>"`이라 `OgModel.region`을 따로 쓴다.
- 축종별 문구(확정, 2026-10-01): 목록 타이틀, 빈 결과, 조회 실패 문구는 `SPECIES_COPY`(`entities/animal/ui/labels.ts`)에 축종별 **문장 그대로** 둔다. 라벨 + 템플릿(`${label}가 없어요`)으로 만들면 조사가 틀어진다("기타 동물가"). 축종이 섞이는 화면(찜 목록)과 축종을 모르는 화면(상세 조회 실패)은 `ANIMAL_COPY`의 축종 중립 문구를 쓴다(명세 4.5.2의 "고양이" 문구를 "공고"로 바꿨다).
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
| 필터/정렬 | URL search params | `species`(`cat` \| `dog` \| `other`), `region`, `district`, `status`, `sort`만. 기본 `status=protected`, `sort=latest`. 모르는 값은 기본값으로 본다. `species`의 기본값(`cat`)은 **파서 안전망일 뿐**이고, 목록 진입 판정은 축종이 없으면 홈으로 보낸다(아래). **`page`는 URL에 넣지 않는다**(내부 커서). 구현 규칙은 아래 |
| 찜 목록 | localStorage + 작은 훅 | id 배열만 저장. 읽을 때 Zod로 검증 |
| 일시적 UI(필터 시트 draft, 뷰어 index, 토스트) | 컴포넌트 로컬 state | 시트 draft는 [적용하기]에서만 URL 반영, 닫히면 버림 |

- 전역 스토어(Redux, Zustand, Recoil 등)를 도입하지 않는다.
- URL 필터 구현 규칙(`features/animal-filter/model/filter.ts`, 확정):
  - 읽기: `app/page.tsx`(서버 컴포넌트)가 searchParams를 파싱해 `views/animal-list`에 넘긴다. 없거나 잘못된 값은 기본값으로 본다(화면은 깨지지 않고, API는 400을 유지).
  - 쓰기: **축종과 지역은 기본값이어도 늘 쓰고**(기억 대상이라서, 아래) 나머지는 기본값과 다를 때만 넣는다. 기본 상태의 목록 주소는 `/?species=cat&region=6110000`이다. 같은 필터는 같은 URL, 같은 쿼리 키. `page`/`cursor`는 적용 시 지우고, 필터와 무관한 파라미터(예: `utm_*`)는 보존한다.
  - 적용은 `router.replace`(히스토리를 쌓지 않음, `scroll: false`). URL이 바뀌면 서버 컴포넌트가 새 searchParams로 다시 렌더되고 목록 위젯이 내부 스크롤을 맨 위로 올린다.
  - 필터 시트의 `useState`는 열림 여부와 [적용하기] 전 draft만. 열 때 현재 URL 값으로 채우고 닫으면 버린다.
- 상세에서 뒤로 왔을 때 목록 복원(확정, 2026-09-29): 로드된 페이지는 TanStack Query 캐시(같은 queryKey = 필터)가 복원하고, 스크롤은 **열었던 카드 id**로 되돌린다(`useAnimalScrollRestoration`, `shared/ui/app-column.ts`). 규칙:
  - 카드를 누르면 그 공고 id를 sessionStorage에 목록(필터)별로 기억한다. 카드 요소에는 `data-animal-id`가 붙는다.
  - 목록이 다시 마운트되고 데이터가 준비되면(`isSuccess`) 그 카드를 찾아 스크롤 컨테이너 가운데로 보낸다(`scrollAppToAnimal`, 공유 링크의 focus 파라미터도 이 함수를 쓸 예정). 카드가 그려질 때까지 최대 30프레임 기다리고, 없으면(상태가 바뀌어 필터에서 빠진 공고 등) 조용히 맨 위에 둔다. 기억한 값은 한 번 쓰고 지운다.
  - **픽셀(scrollTop) 저장 방식은 버렸다.** 내부 스크롤 컨테이너는 화면이 바뀌는 순간 내용이 비어 스크롤 값이 0으로 눌리고, 복원 시점에는 아직 높이가 모자라 값이 자주 틀어졌다(12절 36·37). 카드 id는 이 타이밍에 영향을 받지 않는다.
  - **목록에서 나가는 `next/link`는 `scroll={false}`로 둔다**(카드, 찜 목록). 기본값이면 Next가 이동 직후 `scrollIntoView`로 우리 내부 스크롤 컨테이너를 건드린다. 새 화면은 각자 `scrollAppToTop()`으로 맨 위에서 시작한다.
  - 검증은 실제 브라우저로 한다: `pnpm e2e`(Playwright/Chromium, `e2e/`). 목록 API 응답은 `page.route`로 고정하고, 상세는 서버 렌더라 실제 공고 id를 쓴다. jsdom에는 레이아웃이 없어 스크롤 복원을 검증할 수 없다(12절 37).
- 상세 로딩(확정, 2026-10-07): 카드를 누르면 상세가 뜨기까지(서버의 공고 조회, 지난 측정 0.5~0.9초) 화면이 그대로여서 사용자가 여러 번 눌렀다. 두 가지로 바로 반응한다:
  - 카드 누름 피드백: `AnimalCard` 링크에 카드 누름(100ms, scale .98)이 있었다. 홈 카드와 같게 `motion-safe:`로 바꿔 reduced-motion이면 줄지 않는다. 찜 하트는 링크의 형제라(링크 안에 버튼을 두지 않는다) 하트를 누를 때 카드는 줄지 않는다(브라우저에서 하트 누름 중 카드 scale `none` 확인).
  - 라우트 로딩 경계 `app/animals/[id]/loading.tsx` → `views/animal-detail`의 `AnimalDetailLoadingView` → `widgets/animal-detail`의 `AnimalDetailSkeleton`. 같은 뼈대를 상세 위젯의 조회 대기(`useAnimal` pending)도 쓴다. 뼈대는 실제 상세와 같은 구조·치수다(사진 4:5 + 캐러셀 점 줄 자리, 사진 위 Back 버튼, 상태 줄 28 · 제목 28 · 성별/나이 20 · 정보 줄, sticky 하단 CTA 바). production에서 뼈대와 실제 상세의 상태 줄·제목·정보·CTA 위치가 같았다(390×844, 레이아웃 이동 0). 상태 줄은 D-day 유무와 상관없이 28px(`h-7`)로 고정해 D-day가 없는 공고(종료, 만료된 보호중)에서도 같다(전에는 24라 그 아래가 4px 올라갔다. 2026-10-07 보호중·종료 공고 모두 이동 0 확인)
  - 뼈대의 Back 버튼은 누를 수 있다. 공고를 아직 모르므로 목록을 거쳐 왔으면 `router.back()`, 아니면 기본 목록(`/`)이다(공유 링크로 들어와 로딩 중에 누르면 공고의 목록이 아니라 기억된 목록으로 간다)
  - 뼈대도 진입 시 `scrollAppToTop()`을 부르고 실제 상세도 그대로 부른다(맨 위 시작). 목록 스크롤 복원(카드 id), focus 흐름, 공유 링크 직접 진입, 상세 조회 실패 화면은 그대로다(E2E 전부 통과). 잘못된 id의 `notFound()`는 로딩 경계 안에서 그대로 404다
  - **로딩 경계와 prefetch**: 경계가 생기면 `next/link`의 자동 prefetch는 경계까지만 받고 페이지 본문(서버의 공고 조회)은 누를 때 받는다. 카드를 누른 즉시 뼈대가 보이는 것도 이 prefetch로 받아 둔 경계 덕분이라 **production에서만** 확인된다(개발 서버는 prefetch하지 않는다). 그래서 E2E `e2e/detail-loading.spec.ts`는 production 빌드(포트 3100, `playwright.config.ts`의 `production` 프로젝트)에서 돈다. 측정은 12절 45
  - 뼈대는 움직이지 않는다(README Motion: 카드 누름·시트·토스트 외에는 움직이지 않음)
- 사진 우선순위(확정, 2026-10-07): `fetchpriority="high"`는 **화면당 한 장**, 목록 첫 카드 사진(`AnimalList` index 0)과 상세 캐러셀 첫 장에만 준다(`AnimalPhoto`의 `highPriority`, eager 포함). 남용하면 서로 대역폭을 다툰다. 나머지는 그대로다: 목록 앞 2장 eager, 그 뒤 lazy, 상세 둘째 장부터 lazy, 모두 `decoding="async"`
- 상세의 뒤로가기(확정, 2026-09-29):
  - 이 문서(탭)에서 목록 화면을 거쳤으면 `router.back()`. 필터가 붙은 목록 URL과 스크롤 위치가 그대로 살아난다(12절 32).
  - 공유 링크나 북마크로 상세를 바로 열었으면 **그 공고가 들어 있는 목록**으로 `push`한다. 공고의 지역·종·상태로 필터를 만들고(`animalListFilter`, `features/animal-filter/model/from-animal.ts`) `focus=<공고 id>`를 붙인다(`animalListHref`). 지역은 `regionText`(= `orgNm`)에서 정적 목록으로 코드를 되찾고, 시군구를 못 찾으면 시도만, 시도도 못 찾으면 전국으로 떨어진다(4절). 공유한 사람의 필터는 URL에 싣지 않는다.
- 목록의 `focus` 처리(확정, 2026-09-29): 일회성 값이라 필터가 아니다(`app/page.tsx`가 읽어 넘긴다).
  - 받아 둔 페이지에 그 공고가 없으면 최대 5페이지(20건 × 5 = 100건)까지 이어 받는다. 찾으면 `scrollAppToAnimal`로 그 카드까지 스크롤하고, 못 찾으면 조용히 맨 위에 둔다(12절 40).
  - 찾는 동안 사용자가 직접 스크롤하면(`wheel`/`touchstart`/`keydown`) 중단한다. 보고 있는 화면이 뒤늦게 튀지 않게 한다.
  - 처리가 끝나면 `router.replace`로 URL에서 `focus`만 지운다(다른 파라미터는 그대로). 새로고침이나 뒤로가기로 다시 발동하지 않는다.
  - `focus`가 있으면 sessionStorage 복원(열었던 카드)보다 우선이다. 복원 훅은 `focus`가 있는 동안 아예 동작하지 않아 둘이 같이 스크롤하지 않는다.
- 지역(확정, 2026-09-22): URL의 `region`은 시도 코드(`upr_cd`), `district`는 시군구 코드(`org_cd`, 선택). 라벨은 정적 목록(`src/shared/config/regions.ts`)에서 매핑한다. 필터 시트는 시도 → 시군구 2단계 select이며 시도를 바꾸면 시군구는 "전체"로 돌아간다.
  - **기본 지역은 서울특별시 전체**(`region=6110000`, `district` 없음). URL에 `region`이 없을 때만 적용한다. 2026-09-22에는 서울/종로구였지만, 종로구 고양이 보호중 공고가 5~6건뿐이라 첫 화면이 휑하다는 피드백으로 2026-09-28에 시도 단위로 넓혔다(12절 27). 시군구는 사용자가 고를 때만 URL에 붙는다.
  - 전국은 `region=all`로 URL에 남긴다(생략하면 기본 지역이 되므로). `region`만 있으면 그 시도 전체. 목록에 없는 `region`(옛 코드 등)은 기본 지역, 그 시도에 없는 `district`는 버린다.
  - **지역은 기본값이어도 URL에 늘 쓴다**(확정, 2026-09-29). 지역이 없는 `/`는 "기억된 지역"을 뜻하게 됐기 때문에, 앱이 만드는 목록 주소(필터 적용, `animalListHref`)가 지역을 생략하면 뒤로가기·새로고침·공유 링크가 그 사이에 바뀐 기억에 흔들린다. **축종도 기억 대상이 되면서 같은 규칙을 쓴다**(확정, 2026-10-02, PRD-v1.1 4절). `status`/`sort`는 기억 대상이 아니라 URL과 기본값이 항상 같으므로 그대로 생략한다.
  - **지역 없이 들어온 주소도 예외로 두지 않는다**: `app/page.tsx`가 쓸 수 있는 `region`이 없으면(없거나 모르는 코드) 기억된 지역(없으면 기본 지역)을 채워 `redirect`한다. `focus`나 `utm_*` 같은 다른 파라미터는 그대로 옮긴다. 채운 주소에는 지역이 있으므로 다시 리다이렉트하지 않는다(루프 없음, 실측 307 1회).

- 목록 진입 판정(확정, 2026-10-02, PRD-v1.1 4절): `/`로 들어왔을 때 할 일은 순수 함수 `resolveAnimalListEntry`(`features/animal-filter/model/entry.ts`)가 정한다. 입력은 searchParams와 기억 쿠키 둘, 출력은 "이 필터로 그린다" 또는 "이 주소로 리다이렉트한다"다. `app/page.tsx`는 쿠키를 읽어 넘기고 결과를 따르기만 한다(얇게).
  - **축종을 먼저 본다**: URL의 `species` → 축종 쿠키 → 둘 다 없으면 홈(`/home`). 홈으로 보낼 때는 **지역을 판정하지 않는다**(지역은 홈이 다시 정한다).
  - 모르는 `species` 값(`panda`)은 "없음"으로 본다(지역의 모르는 코드와 같은 취급). 그 값은 버리고 옮기지 않는다.
  - 채울 값이 축종·지역 둘이어도 **리다이렉트는 한 번**이다(307을 두 번 내지 않는다). 채운 주소에는 둘 다 있으므로 다시 리다이렉트하지 않는다(루프 없음).
  - `focus`, `utm_*` 같은 다른 파라미터는 어느 쪽으로 가든 옮긴다(`/home`으로 갈 때도). `page`/`cursor`는 버린다.
  - 기본 축종(`cat`)은 진입 판정에 쓰지 않는다: 축종 기억이 없는 사람을 고양이 목록으로 밀어 넣지 않고 홈에서 고르게 한다(PRD-v1.1 2절 흐름).
- 홈(`/home`, 확정, 2026-10-02): 축종을 고르는 화면이다(`app/home/page.tsx` → `views/species-picker`, 선택 UI는 `features/animal-filter`의 `SpeciesChoice`).
  - **직접 열면 축종 기억이 있어도 보여 준다.** 건너뛰기는 `/` 진입에만 적용한다. 축종을 바꾸러 오는 화면이기도 해서, 기억이 있다고 돌려보내면 바꿀 방법이 없어진다.
  - 목록 헤더의 타이틀이 진입점이고 `/home?region=<보고 있던 지역>`(+`district`)으로 보낸다. 홈은 그 지역이 유효하면 쓰고, 아니면 기억된 지역, 그것도 없으면 기본 지역(서울 전체)이다.
  - 홈에서 고르면 **축종만 기억하고** 그 축종·지역의 목록으로 간다. 지역은 넘겨받아 그대로 실어 보내기만 하고 기억하지 않는다(사용자가 홈에서 지역을 고른 것이 아니다).
  - 고양이·강아지는 큰 선택지 두 개, 기타는 그 아래 작은 텍스트 링크다(기타는 전체 공고의 2.3%라 같은 무게로 두면 빈 목록에 가깝다, 12.A P12). UI는 시안 "냥공고 홈 · 축종 선택"(Main 390, Home-PC 480, Header-A)을 따른다(2026-10-07). 고양이·강아지는 캐릭터 + 라벨의 테두리 카드이고, 시안의 button과 달리 **링크**다(고르면 목록으로 이동). 시안과 다른 점은 12절 44.
  - 캐릭터(확정, 2026-10-07): `public/characters/nyang-cat.svg`, `nyang-dog.svg`를 `entities/animal`의 `SpeciesCharacter`가 **`<img>`**로 그린다(120×120 고정, `alt=""` 장식, 의미는 텍스트 라벨). **인라인 SVG를 쓰지 않는다**: 두 SVG가 같은 그룹 id(`head`, `tail`, `body`…)를 써서 한 페이지에 인라인하면 id가 겹친다. `<img>`는 SVG를 별도 문서로 그려 겹치지 않는다. 원본은 `docs/design/assets/characters/`이고 `public/characters/`는 사본이다. 둘이 같은지는 `tests/design/characters-sync.test.ts`가 본다(디자인 동기화 때 둘 다 바꾼다). 사용 규칙은 `docs/design/characters.md`를 따르되 지금은 정지 이미지뿐이다(움직임은 Rive 단계, PRD-v1.1 5절).
  - 캐릭터 애니메이션(확정, 2026-10-08): 홈 선택지의 캐릭터는 정지 SVG로 시작해 클라이언트에서 Rive 캔버스로 바뀐다(greet → idle, 카드를 누르면 press). 규칙은 9절 "홈 캐릭터 Rive". 정지 SVG `<img>`는 서버 렌더·첫 화면·움직임 줄이기·로드 실패 때 그대로 쓰는 기본이다.
  - 누름 피드백: 홈 카드와 헤더 진입점 모두 카드 누름(100ms, scale .98)이고 `motion-safe:`라 reduced-motion이면 줄지 않는다. iOS Safari는 요소나 조상에 touch 리스너가 있어야 `:active`를 건다. React가 `document`에 `touchstart`를 붙이므로(Chromium에서 리스너 2개 확인) 별도 처리를 하지 않았다. 실제 iOS 기기에서는 아직 확인하지 않았다(12절 44).

- 마지막으로 고른 지역 기억(확정, 2026-09-29, 13절 (a)):
  - URL에 지역이 없을 때만 쿠키(`nyanggonggo.region`)의 지역을 쓴다. 쿠키도 없거나 값이 깨졌으면 기본 지역(서울 전체)이다. **URL이 항상 우선이다.** 그렇게 정한 지역은 주소에 채워 리다이렉트하므로, 화면에 보이는 목록과 주소가 어긋나지 않는다(위).
  - localStorage가 아니라 쿠키인 이유: 서버(`app/page.tsx`)가 첫 렌더부터 그 지역으로 그리기 위해서다. localStorage면 서울 목록을 그린 뒤 클라이언트에서 바꿔야 해 화면이 한 번 깜빡이고 목록 요청도 두 번 나간다. 이 페이지는 `searchParams` 때문에 이미 동적 렌더라 쿠키를 읽어도 캐시나 렌더링 방식이 달라지지 않는다.
  - 값은 지역 코드뿐이다(`all` | `<시도>` | `<시도>.<시군구>`, `path=/`, `SameSite=Lax`, 1년). 읽을 때 정적 지역 목록으로 검증하고, 목록에 없는 코드나 깨진 형식은 조용히 무시한다(`features/animal-filter/model/region-cookie.ts`).
  - **저장은 사용자가 필터 UI에서 적용할 때만 한다**(`useApplyAnimalFilter`). 공유 링크로 들어온 상세의 뒤로가기(focus 흐름)나 지역이 붙은 링크로 들어온 경우는 이 경로를 타지 않아 기억이 바뀌지 않는다. 남이 공유한 부산 공고를 봤다고 내 기본 지역이 부산이 되면 안 된다. 사용자가 서울 전체를 직접 고르면 서울을 기억한다(지우는 게 아니다).
  - 뒤로가기로 돌아온 목록은 떠날 때 보던 목록과 같아야 한다. 앱이 만드는 주소에 지역이 늘 들어 있어서(위) 기억이 끼어들지 않는다. `focus`를 지울 때도 지역 파라미터는 남긴다.

- 마지막으로 고른 축종 기억(확정, 2026-10-02, PRD-v1.1 3절 8)):
  - 쿠키 `nyanggonggo.species`, 값은 축종 코드 하나다(`cat` | `dog` | `other`). 쿠키를 쓰는 이유와 속성(`path=/`, `SameSite=Lax`, 1년)은 지역과 같고, 공통 부분은 `features/animal-filter/model/filter-cookie.ts`에 있다.
  - **저장은 사용자가 직접 고를 때만 한다**: 필터 시트 적용(`useApplyAnimalFilter`)과 홈의 선택(`SpeciesChoice`), 두 곳뿐이다. 공유 링크로 들어온 상세의 뒤로가기(focus 흐름)는 이 경로를 타지 않아 기억이 바뀌지 않는다. 남이 공유한 강아지 공고를 봤다고 내 기본 축종이 강아지가 되면 안 된다.
  - 모르는 값은 조용히 무시한다(기억이 없는 것으로 보고 홈으로 간다, `features/animal-filter/model/species-cookie.ts`).
  - 지역과 다른 점: 기억이 없을 때 기본값으로 채우지 않고 **홈으로 보낸다**. 지역은 "서울 전체"라는 무해한 기본값이 있지만, 축종은 무엇을 보여 줄지가 화면 전체를 좌우한다(기타 2.3%, 개 63%, 고양이 35%, 12.A P12).
  - 검증: `features/animal-filter/model/{entry,species-cookie}.test.ts`(판정 표와 쿠키), `tests/app/{list-page,home-page}.test.tsx`(페이지가 쿠키를 읽어 넘기는지), `e2e/species-home.spec.ts`(실제 브라우저에서 쿠키와 리다이렉트가 맞물리는지).

## 8. 찜

- localStorage에는 animal id 배열만 저장한다(확정: 스냅샷 저장 안 함, 진실은 서버 하나).
- `/favorites` 진입 시 `getAnimalsByIds`로 조회한다. 조회되지 않는 id는 화면에서 제외하고 저장은 유지한다(관찰 후 결정).
- 구현(확정, 단계 4~6): `features/animal-favorite`. 키 `nyanggonggo:favorites`, 읽을 때 Zod(숫자 문자열 id 배열)로 검증하고 깨진 값은 빈 배열로 본다(다음 쓰기에서 덮는다). 같은 id는 한 번만, 순서는 최근에 찜한 것이 앞. `useSyncExternalStore`로 카드와 상세가 같은 상태를 쓰고 다른 탭의 변경(`storage` 이벤트)도 반영한다. 토글하면 토스트("찜에 저장했어요" / "찜을 해제했어요").
- 카드에 찜 하트를 둔다(확정, 명세 4.1.3의 결정 필요 항목). 사진 우상단, 링크와 형제 요소로 두어 카드 이동과 겹치지 않는다. 모양은 사진 위 overlay 버튼(photo-pill)을 따랐다(디자인 시안 없음).
- `/favorites`: 목록과 같은 카드, 빈 상태는 명세 4.5.2 문구 그대로("아직 찜한 고양이가 없어요" / "마음에 드는 고양이를 저장해보세요 🐾". 🐾는 디자인 README가 허용한 유일한 이모지). 목록 헤더의 하트 버튼이 유일한 진입 경로다(handoff).

## 9. HTTP, 환경변수, 배포

- 서버와 클라이언트 모두 `shared`의 얇은 `httpClient`(네이티브 `fetch` 래퍼, `src/shared/api/http-client.ts`)를 쓴다: 타임아웃(`AbortSignal.timeout`, 호출별 override), HTTP 에러의 예외화, 에러 표준화(`HttpError`: timeout / network / status / parse). Next `fetch`의 `next: { revalidate }`, `cache` 옵션을 그대로 전달한다. 테스트는 `fetch` 구현을 주입한다. 오류 메시지와 예외에는 URL의 origin+path만 남기고 쿼리스트링(서비스키)과 원래 오류 메시지/`cause`는 싣지 않는다.
- 환경변수(공개): `NEXT_PUBLIC_SITE_URL`(공유 링크의 기준 주소, 선택. 비우면 접속한 주소).
- 환경변수: `DATA_GO_KR_SERVICE_KEY`(서버 전용, `NEXT_PUBLIC_` 금지, 디코딩된 키. `process.env`는 `src/server/config.ts`에서만 요청 시점에 읽는다. 없으면 500이며 import/빌드 시점에는 실패하지 않는다), `NEXT_PUBLIC_KAKAO_JS_KEY`(도메인 제한이 있는 공개 키라 허용. `.env.example`에 있음. 읽는 곳은 `src/shared/config/public-env.ts` 한 곳이고, 비어 있으면 SDK를 불러오지 않고 공유가 링크 복사로 동작한다). `.env.local`은 커밋하지 않고 `.env.example`만 커밋한다. 배포 환경은 Vercel 환경변수. GitHub Secrets는 CI에서 실제 API를 호출할 때만 필요하며 MVP에서는 픽스처로 테스트하므로 쓰지 않는다.
- 배포: Vercel Hobby(비상업용 약관 확인). 실행 시간 제한은 **검증 필요**(12절 스파이크).
- 함수 리전(확정, 2026-10-07): **서울 `icn1`**. 저장소 루트 `vercel.json`의 프로젝트 단위 `regions: ["icn1"]`(Vercel 문서 https://vercel.com/docs/project-configuration/vercel-json#regions, Hobby는 리전 1개). 라우트별 `preferredRegion`은 쓰지 않는다(한 곳에서 관리). 이유: 공공데이터포털과 이미지 원본이 한국에 있는데 기본값 `iad1`(워싱턴)에서는 캐시 미스마다 태평양을 왕복했다(12절 46: 목록 API MISS 3.5~6.6초, 한국에서 업스트림 직접 0.4초). **배포 후 확인 방법**: `curl -sI https://nyanggonggo.vercel.app/api/animals?species=cat&region=6110000` 등 함수 응답의 `x-vercel-id`가 `icn1::icn1::…`(엣지::함수)인지 본다. 함수 부분이 아직 `iad1`이면 대시보드의 Functions Region 설정이 우선 적용되고 있는지 확인한다(문서상 `vercel.json`이 프로젝트 설정을 덮어쓴다). 정적 파일과 CDN 캐시 HIT는 리전과 무관하다
- 이미지 프록시 리사이즈(확정, 2026-10-07, `src/server/images/image-proxy.ts`, `resize-image.ts`): `/api/image-proxy?src=…&w=<폭>`.
  - 허용 폭은 **480, 828, 1080**(`IMAGE_PROXY_WIDTHS`, `src/contract/images.ts`)뿐이고 그 밖의 `w`는 400(no-store)이다. 임의 크기 변환에 프록시가 남용되거나 CDN 캐시 키가 늘어나지 않게 한다. 근거: 카드 표시 폭은 컬럼(최대 480) − 좌우 여백 32 = 358~448px, 상세 캐러셀은 컬럼 전체 390~480px다. 390px 폰 DPR 2에서 카드 716 / 상세 780 → 둘 다 828, DPR 3에서 1074 / 1170 → 둘 다 1080, PC 480 컬럼 DPR 1에서 448 / 480 → 둘 다 480, DPR 2에서 896 / 960 → 둘 다 1080. 목록과 상세가 같은 URL을 골라 상세 첫 사진이 추가 요청 없이 브라우저 캐시에서 나온다(production에서 확인).
  - 변환: sharp로 EXIF 방향 적용 → 비율 유지 리사이즈(원본보다 키우지 않음) → **WebP quality 75**(`SERVER_TUNING.imageProxyWebpQuality`). 품질은 실제 공고 사진 5장으로 70/75/80/85를 1:1 크롭 비교해 정했다(75와 85 차이가 눈에 띄지 않고 80부터 크기가 20~30% 는다). Content-Type은 결과 형식(`image/webp`), 캐시 헤더는 기존 성공 응답 그대로다. 매직 넘버 판별, 호스트 허용 목록, 원본 실패 시 투명 대체 이미지도 그대로다.
  - **변환이 실패하면 원본을 그대로** 내려주고(`X-Image-Proxy: original`, 캐시하지 않아 다음 요청에서 다시 시도) `image proxy resize failed` 로그를 남긴다(폭, 형식, 바이트, 오류 이름만. URL 없음). 사진이 안 보이는 일은 없다. 변환 결과가 원본보다 크면 원본을 내려준다.
  - 화면: 목록 카드(찜 목록 포함, 같은 `AnimalCard`)와 상세 캐러셀은 `AnimalPhoto`의 `sizes`(`PHOTO_SIZES.card` = `(min-width: 480px) 448px, calc(100vw - 32px)`, `.detail` = `(min-width: 480px) 480px, 100vw`)로 허용 폭 srcset을 쓴다. srcset을 모르는 브라우저는 828을 받는다. **풀스크린 뷰어는 원본**(`w` 없음)이다(확대해서 보는 화면). 공유 이미지(카카오)와 OG 이미지도 원본을 쓴다.
  - sharp(0.35.4, Next가 optionalDependency로 이미 쓰는 버전)는 직접 의존성이다. Vercel 함수는 Node 런타임이라 네이티브 모듈을 쓸 수 있고(Edge 런타임은 불가, https://vercel.com/docs/functions/limitations), Next는 sharp를 `serverExternalPackages` 기본 목록으로 번들에서 빼고 함수에 그대로 싣는다. linux-x64 함수 번들이 약 20MB(sharp 0.96MB + `@img/sharp-linux-x64` 0.43MB + `@img/sharp-libvips-linux-x64` 18.7MB, npm unpackedSize) 늘어난다(함수 한도 250MB). `pnpm-workspace.yaml`의 `ignoredBuiltDependencies: sharp`는 그대로 둔다(0.33부터 플랫폼별 사전 빌드 패키지라 설치 스크립트가 필요 없다).
  - **`next/image`(Vercel Image Optimization)를 쓰지 않는 이유**: Hobby는 이미지 변환이 월 5,000회 포함이고, 넘으면 새 이미지가 402 런타임 오류로 실패해 `onError`가 불리고 사진 대신 alt 텍스트가 보인다(https://vercel.com/docs/image-optimization/limits-and-pricing). 공고 사진은 매일 새로 들어오고 폭마다 변환이 따로 세어져 한도에 닿기 쉽고, 닿으면 실패 모드가 "사진이 사라짐"이다. 우리 프록시는 변환이 실패해도 원본을 내려준다.
- 홈 캐릭터 Rive(확정, 2026-10-08, `src/entities/animal/ui/species-character.tsx`, `lib/character-animation.ts`): `docs/design/characters.md` 모션 절의 greet·idle·press를 홈 선택지 캐릭터에 입힌다. sleep은 `.riv` 안의 상태 머신이 한다(고양이 적용, 12절 48). 앱은 press 신호만 보낸다.
  - 런타임: **`@rive-app/canvas-lite` 2.44.0**(정확히 고정, React 래퍼 없이). 후보 비교(gzip, 같은 2.44.0):

    | 패키지 | JS | WASM | 비고 |
    |---|---|---|---|
    | `@rive-app/webgl2`(`react-webgl2` 4.36.0) | 115KB | 925KB | Rive Renderer, 공식 기본 권장. WebGL 컨텍스트 수 제한 |
    | `@rive-app/canvas`(`react-canvas` 4.36.0) | 114KB | 821KB | 벡터 페더링 미지원 |
    | **`@rive-app/canvas-lite`**(`react-canvas-lite` 4.36.0) | 107KB | **368KB** | 텍스트·레이아웃·오디오·스크립트 엔진 없음 |

    React 래퍼는 각 6KB를 더한다. 이 파일은 텍스트·오디오·스크립트를 쓰지 않고, 세 런타임에서 같게 그려졌다(webgl2 대비 0.8% 픽셀 차이, 가장자리). 아트보드의 `LayoutComponentStyle`은 canvas-lite에서도 문제가 없어 그대로 둔다(120 고정 크기라 레이아웃 기능은 쓰지 않는다). 뷰 모델 트리거도 canvas-lite에서 동작한다. WASM이 절반 이하라 canvas-lite를 쓴다. React 래퍼는 쓰지 않는다: 한 번 받은 자산을 두 캐릭터가 나눠 쓰고, 로드 실패를 직접 다뤄 정지 이미지로 남기려면 기본 패키지를 직접 부르는 쪽이 단순하다.
  - **WASM 호스팅**: 런타임 기본값은 unpkg(`https://unpkg.com/@rive-app/canvas-lite@2.44.0/rive.wasm`), 실패하면 jsdelivr(`rive_fallback.wasm`)다(Rive 문서 runtimes/web/preloading-wasm, 런타임 코드). 둘 다 쓰지 않는다. `public/rive/rive-canvas-lite-<버전>.wasm`(`pnpm rive:wasm`, 이름에 버전, `Cache-Control: public, max-age=31536000, immutable`)을 직접 받아 `RuntimeLoader.setWasmBinary`로 넘기고 `setWasmFallbackUrl(null)`로 대체 URL을 끈다. 그래서 외부 CDN 요청이 없고, 네트워크 실패는 런타임의 console.error 없이 우리 로그(`console.warn`)만 남는다. 대체 WASM(오래된 아키텍처용)은 두지 않는다: WASM을 못 쓰는 브라우저는 정지 이미지로 남는다.
  - **.riv**: `public/characters/nyang-characters.riv`를 커밋한다(Vercel 빌드에는 Rive CLI가 없다). **RML(`rive/nyang-characters/scene.rml`)을 고치면 `pnpm rive:build`로 다시 빌드해 함께 커밋한다.** 런타임 버전을 바꾸면 `pnpm rive:wasm`과 `RIVE_RUNTIME_VERSION`(`lib/character-animation-assets.ts`)을 함께 바꾸고, 12절 47의 버전 고정 규칙(로고 화면·워터마크 확인)을 따른다. `tests/design/rive-assets.test.ts`가 고정 버전·설치 버전·WASM 바이트·.riv 아트보드를 본다.
  - **정지 이미지 → Rive 교체**: 서버 렌더와 첫 화면은 정지 SVG `<img>`(120×120)다. 클라이언트에서만 런타임을 동적 import하고, 런타임·WASM·.riv(페이지당 한 번, 두 캐릭터 공유)가 준비되면 같은 자리에 겹쳐 둔 캔버스를 보이고 이미지를 숨긴다(레이아웃 이동 0). 아트보드는 `nyang-cat` / `nyang-dog`, 상태 머신 `State Machine 1`, `autoBind`. 어느 단계든 실패하면 정지 이미지 그대로이고 `console.warn`만 남긴다. 둘 다 `aria-hidden`(이미지는 `alt=""`), 텍스트 라벨은 그대로.
  - **press**: 홈 카드 링크의 `pointerdown`(키보드 Enter도)에서 그 캐릭터의 뷰 모델 트리거 `press`를 보낸다. 이동은 늦추지 않는다(반응이 다 보이기 전에 화면이 바뀌어도 된다). greet는 홈에 들어올 때마다 Rive 상태 머신이 1회 한다.
  - **움직임 줄이기**(`prefers-reduced-motion: reduce`): 런타임·WASM·.riv를 아예 받지 않고 정지 이미지만 둔다.
  - **홈이 아닌 화면**(목록·상세·찜): Rive 런타임 청크·WASM·.riv를 받지 않는다(동적 import라 홈의 캐릭터가 요청할 때만 받는다). E2E `e2e/home-rive.spec.ts`(production)가 본다.
  - 측정(2026-10-08, 로컬 production 빌드, Playwright Pixel 7, 9Mbps/1.5Mbps/150ms, 캐시 끔, 3회): 홈 전송량 519KB → 949KB(**+430KB**: 런타임 JS +53KB, WASM 366KB, .riv 11KB, 모두 압축 전송 바이트). LCP 436~520ms → 412~452ms(나빠지지 않음, LCP 요소는 텍스트·정지 이미지라 Rive가 늦게 와도 영향이 없다). 카드 탭 → 목록 제목 855~896ms → 851~871ms(이동이 늦어지지 않음). 움직임 줄이기: 519~520KB, Rive 요청 0. Vercel이 `.wasm`을 압축해 내려주는지는 배포 후 확인한다(로컬 `next start`는 gzip 374KB).
- 서비스키가 로그, 테스트, 픽스처, 커밋에 들어가지 않게 한다. 이미 대화에 노출된 키는 재발급한 것으로 가정한다.

- 공유 링크(확정, 2026-09-28): 카드의 `content.link`와 버튼 링크는 상세 페이지 절대 URL이다. 기준 주소는 `NEXT_PUBLIC_SITE_URL`이 있으면 그 값, 없으면 접속한 주소(`window.location.origin`)다. **링크가 http(s)가 아니거나 로컬 주소(localhost, 127.0.0.1, `*.local` 등)면 카카오톡 공유를 건너뛰고 링크 복사로 폴백한다.** 링크가 없는(또는 열리지 않는) 카드를 보내는 것보다 낫다. 카드의 링크가 동작하려면 그 도메인이 카카오 개발자 콘솔 [플랫폼 > Web 사이트 도메인]에 등록되어 있어야 한다(등록되지 않으면 카카오가 링크를 무시하고 기본 페이지로 보낸다, 12절 29).
- 공유(확정, 단계 4~6, `features/animal-share`): 키가 있을 때만 `next/script`로 카카오 SDK(2.8.3, integrity sha384, 12절 29)를 불러오고 `Kakao.init` 후 feed 템플릿(상세 링크, 제목 "지역 + 축종", 설명 "상태 배지 · 보호소", 썸네일은 대표 사진의 이미지 프록시 절대 URL, 없으면 OG 이미지)으로 공유한다. 키 없음, SDK 미로드, init 실패, `Share` 미지원, `sendDefault` 예외는 링크 복사 + "링크가 복사됐어요"(handoff 문구)로 폴백하고, 복사까지 실패하면 "공유에 실패했어요. 링크로 대신 공유해보세요"(명세 7.3).
- OG 이미지(확정, 단계 4~6): `app/animals/[id]/opengraph-image.tsx`(next/og, 1200x630, handoff 화면 7). 원본 사진은 서버가 직접 받아 data URL로 넣는다(이미지 프록시 미경유, 허용 원본만, 5MB 이하). 조회나 사진이 실패해도 오류 대신 사진 없는 카드 또는 서비스명만 있는 기본 이미지를 그린다. 캐시는 1시간(`revalidate = 3600`, `SERVER_TUNING.ogImageCacheControl`): D-day가 KST 자정에 바뀌므로 하루보다 짧게, 렌더 비용 때문에 1시간. satori는 CSS 변수를 지원하지 않아 토큰 hex 값을 `og-model.ts`에 옮겨 쓴다.
- OG 폰트(확정): `pretendard` 패키지가 정적 단일 weight otf(`dist/public/static/Pretendard-Regular.otf`, `-Bold.otf`)를 함께 배포하므로 `node_modules`에서 그대로 읽는다. **저장소에 폰트 파일을 추가하지 않았다**(예외 파일 불필요). satori는 woff2를 읽지 못해 가변 woff2(dynamic subset)는 쓸 수 없다. 배포 번들 포함은 `next.config.ts`의 `outputFileTracingIncludes`로 명시했고, 경로를 정적 문자열로 적어 추적 범위를 두 파일로 한정했다(변수 경로는 프로젝트 전체를 추적 대상으로 만든다는 Turbopack 경고가 있었다). 읽기에 실패하면 satori 기본 폰트로 조용히 대체되며, 이때 한글이 빈 칸으로 보일 수 있다(12절 30).
- 토스트(확정): sonner를 480px 컬럼 안(AppShell의 overlay 자리)에 `position: absolute`로 둔다. 하단 CTA(`data-slot="bottom-cta"`)가 있는 화면은 CSS `:has()`로 토스트를 CTA 위로 올린다. 다크 모드용 `next-themes`는 제거했다.
- 풀스크린 뷰어(확정): 컬럼에 포털하고 컬럼 전체를 absolute로 덮는다(PC에서도 컬럼 안, handoff 화면 8c). 스와이프로 닫기와 핀치줌은 만들지 않는다(명세 후순위). FSD 같은 레이어 import를 피하려고 handoff의 `widgets/image-viewer` 대신 상세 위젯 slice 안에 둔다.

## 10. 종료 공고 정책

- 종료 공고(안락사, 자연사 포함)는 status 필터(`ended`, `all`)로 표시한다. 기본은 `protected`.
- D-day 정책(확정): 종료(`ended`) 공고, `noticeEndAt`이 없는 공고, `noticeEndAt`이 오늘(KST)보다 과거인 보호중 공고는 `dDay = null`, 당일은 0. `isSoon`은 `dDay !== null && dDay <= 3`. 종료일이 지난 보호중 공고는 서버에서 제외하지 않고, 배지는 "보호중"만 표시한다(D-day 없음).
- 종료 사유는 UI, WireDto, Domain 어디에도 노출하지 않는다. 종료 카드는 회색 배지 + 사진 채도 소폭 낮춤(`saturate(.7)`).
- 종료 상세의 찜/공유는 활성 상태로 둔다.
- 우선 이 계획대로 구현하고, 이후 관찰한다: 종료 비율(`processState` 값 집계), 종료 카드의 진입률과 공유율(이벤트에 status 포함).
- Mapper는 알 수 없는 `processState` 값을 주입된 로거로 남긴다(Mapper는 `process.env`를 읽지 않는다).
- 특이사항(`specialMark`)은 상세에서 보여 주지만, **종료 사유(`endReason`)와 같은 문구이면 내보내지 않는다**. 보호소가 두 필드에 같은 문장을 적는 경우가 있어(픽스처 `427346202600847`) 그대로 내보내면 종료 사유가 특이사항 칸으로 드러난다. 판정은 서버 Mapper에서 한다(공백 차이 무시).

## 11. 문서 반영 현황 (PRD, 기능명세서)

PRD는 두 문서다: v1.0(`docs/PRD.md`)과 변경분 v1.1(`docs/PRD-v1.1.md`). 우선순위는 이 문서 > v1.1 > v1.0·기능명세서다(CLAUDE.md). 이 절은 구현이 문서와 다른 점만 적고, v1.1이 공식화해서 더 이상 "우리만 다른 것"이 아닌 항목은 아래로 옮긴다.

`docs/PRD.md`, `docs/기능명세서.md`에 **반영 완료**: 서버 프록시/캐시 MVP 승격, `page` URL 미포함, `status` 기본 `protected`, `region` 시도 코드, 찜 id만 저장, 종료 사유 비노출, 기준 폭 390과 4:5 cover 카드, 토스트 문구 "링크가 복사됐어요", 서버/클라이언트 Domain 분리와 응답 DTO, `pages` → `views`.

명세의 나머지 "결정 필요" 항목 중 초기화 버튼은 미정이다. 카드 내 찜 아이콘은 넣기로 확정(8절), 사진 없는 공고는 배경 + 아이콘의 최소 대체 UI(디자인 미정)로 둔다(D-day 지남 정책은 10절에서 결정됨).

단계 3b에서 명세와 다르게 구현했거나 명세 옵션을 고른 점:
- 목록 끝 표시: 명세 4.1.4 옵션 A(표시 없이 로드 중단)
- 카드 2줄: 명세 4.1.3은 "1줄 이름(없으면 지역명) / 2줄 지역 · 보호소"다. Domain에 이름이 없어 1줄이 지역이 되므로, 2줄은 지역을 반복하지 않고 보호소(없으면 발견 장소)만 둔다
- 목록 헤더의 찜(하트) 버튼(handoff)은 `/favorites`와 함께 다음 단계에서 넣는다. 카드 클릭 → 상세 링크도 상세 화면과 함께 넣는다(`AnimalCard`의 `href`) 이 문서와 문서 간 새 불일치가 생기면 이 절에 적는다.

PRD v1.1이 공식화한 항목(2026-10-02). 구현은 v1.1을 따르므로 불일치가 아니다. 기능명세서와 design 문서에는 아직 반영 전이다:
- 축종 셋(`cat | dog | other`) — v1.1 3절 2). PRD v1.0 4.1 2)와 기능명세서 4.2.2는 아직 "고양이/강아지"다
- 찜 목록의 축종 중립 문구("찜한 공고", "아직 찜한 공고가 없어요") — v1.1 3절 2). 기능명세서 4.5.2는 아직 "고양이"다
- 축종 기억과 홈(`/home`), 목록 주소에 축종 명시 — v1.1 3절 7)·8), 4절. 규칙은 7절. **v1.0까지의 "축종은 기억하지 않는다"는 폐기됐다**
- `page` 파라미터 삭제 — v1.1 4절(이 문서 7절과 같다)

`docs/design` 동기화(2026-10-07): 디자인 시스템 "냥공고"의 현재 내용으로 `README.md`를 갱신하고(캐릭터 팔레트·리본 예외, 캐릭터 모션 예외 두 문장이 늘었다), 캐릭터 절 `characters.md`와 캐릭터 원본 SVG(`assets/characters/nyang-cat.svg`, `nyang-dog.svg`, 각 120×120)를 더했다. 원본 아티팩트를 직접 읽지 못해 사용자가 내려받아 준 묶음(`design-sync-2026-10-07`)에서 옮겼다. `characters.md`는 경로를 `assets/Characters/`(대문자)로 적지만 저장소에서는 `assets/characters/`다. 홈 시안(`*.dc.html`)은 명세로만 읽고 저장소에 옮기지 않았다.

아직 어느 문서와도 맞지 않는 것(이 문서를 따른다):
- PRD-v1.1 5절 비범위 "캐릭터 애니메이션(Rive): 홈이 정지 SVG로 배포된 뒤 별도 단계" → **1차 적용(2026-10-08)**: 홈 선택지 캐릭터가 greet·idle·press로 움직인다(9절 "홈 캐릭터 Rive"). 고양이는 턴어라운드 폴짝 돌기·sleep까지(12절 48), 강아지는 앞모습 동작만
- `docs/design/README.md` "화면 타이틀은 축종에 따라 '고양이 공고' / '강아지 공고'" → 앱은 "기타 동물 공고"까지 3종이다
- `docs/design/README.md` 문구 예시 "아직 찜한 고양이가 없어요 / 마음에 드는 고양이를 저장해보세요" → 앱은 축종 중립 "아직 찜한 공고가 없어요 / 마음에 드는 공고를 저장해보세요"다(PRD-v1.1 3절 2)). README는 디자인 시스템 원문 그대로 두고 고치지 않는다
- 기능명세서 4.1.3 카드 2줄 규칙 → 기타 축종만 1줄이 `"<동물> · <지역>"`이다(시안 없음, 12절 43)
- 홈과 목록 헤더 진입점의 시안은 Design 아티팩트 "냥공고 홈 · 축종 선택"에만 있고 `docs/design`에는 없다(캐릭터 규칙은 `characters.md`). 구현이 시안과 다른 점은 12절 44

## 12. 미확정 / 스파이크

각 항목은 추측하지 말고, 해당 단계에서 검증한 뒤 이 절을 갱신한다.

### 12.A 확정됨(2026-09-21 프로브)

로컬에서 실제 호출한 결과다(`scripts/probe.ts`와 일회성 스크립트, 둘 다 커밋하지 않음). P1~P10은 고양이(`upkind=422400`) 전체 스냅샷 기준이고, 날짜가 붙은 행(P11, P12)은 그 날짜의 별도 실측이다. 값은 시점에 따라 바뀐다.

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
| P11 | 지역 코드(2026-09-22) | `sido_v2` 16건(1페이지): 광주광역시(6290000)와 전라남도(6460000)는 없고 **전남광주통합특별시(6130000)** 하나로 온다. 강원은 강원특별자치도 6530000, 전북은 전북특별자치도 6540000(옛 6420000/6450000 없음). `sigungu_v2`(`upr_cd`) 256건 중 실제 구가 아닌 19건 제외 → 237건. 제외: 시도 자기 자신(16, 세종 5690000 포함 → 세종은 시군구 0), `ddd99dd` 코드(6119999 가정보호, 6119998 서울특별시, 6419998 경기도, 6479998 경상북도), 이름 없음(6489999). 인천은 2026 개편 구(검단구, 서해구, 영종구, 제물포구)가 온다 |
| P12 | 기타 축종(2026-10-01) | `upkind=429900`이 기타이며 응답 `upKindCd`/`upKindNm`은 `429900`/`"기타"`. 전국 155건(보호중 101, 종료 54), 서울 29건(보호중 18), 경기 48건(보호중 34). upkind 없이 받은 1페이지(1,000건)의 축종 비율은 개 63.0% / 고양이 34.7% / 기타 2.3%. `kindNm`은 100% `"기타축종"`, `kindCd`는 100% `000117`이고(`kind_v2`의 `up_kind_cd=429900` 품종 목록도 `000117:기타축종` 1건뿐) 실제 동물은 `kindFullNm`에만 있다: 토끼 21.3%, 앵무새 12.3%, 닭 7.1%, 거북이 6.5%, 기니피그 4.5%, 오리/거위 각 3.9%, 칠면조/도마뱀/햄스터 각 2.6%, 돼지/흑염소 각 1.9% 등. `kindFullNm`이 비거나 `"기타"`로만 온 건은 0건. 사진 0장 공고 없음(2장 93.5%, 최대 6장). `sexCd`는 Q 78.1% / M 13.5% / F 8.4%로 개·고양이보다 미상이 훨씬 많고, `age`(`YYYY(년생)` 76.8%, `YYYY(60일미만)(년생)` 23.2%), `weight`, `colorCd`, `processState` 형식은 개·고양이와 같다. `kindFullNm`은 고양이·개에서도 늘 `"[<축종>] <품종>"`이었다(각 1,000건) |

### 12.B 미확정 목록

확정된 항목은 번호를 유지하고 12.A를 가리킨다(코드 주석이 번호로 참조한다).

1. ~~`processState`의 실제 값 목록과 비율~~ **확정됨(2026-09-21 프로브)**: 12.A P5. 개는 미검증. 종료 사유별 표시 문제는 21
2. ~~JSON 응답의 래퍼 구조와 단일 객체/배열 처리~~ **확정됨(2026-09-21 프로브)**: 12.A P1~P3, 픽스처 `docs/fixtures/upstream-wrapper.json`(구조만 실제, 값은 합성). `extract.ts`는 방어적으로 단일 객체, `items: ""`, 누락도 계속 받고, 최상위 `response`가 없으면 업스트림 오류로 본다
3. 서버 캐시 방식과 항목 크기 제한, 재검증 주기 값, 서버리스 콜드스타트에서 전체 수집 시 실행 시간
   - 현재(2026-10-07~): 원본 fetch는 `no-store`, 검증을 통과한 페이지만 `unstable_cache`(재검증 300초)에 둔다(5절). production 런타임에서 같은 목록·상세의 두 번째 요청이 업스트림을 부르지 않음을 확인했다. 아래 fetch 캐시 항목 크기·서비스키 노출 위험은 fetch 캐시를 쓰지 않으면서 해당 없어졌다(페이지 캐시 키에는 서비스키가 없다). 이전: upstream 페이지 fetch에 Next `revalidate: 300`(데이터 캐시). 조립은 요청마다 메모리에서 한다. Route Handler는 `request.url`을 읽어 동적이며, 명시적 `revalidate`를 준 fetch가 동적 핸들러에서도 캐시되는지는 실제 로그로 확인 필요
   - 크기 제한은 **코드로 확인됨**(Next 16.3.5 `dist/server/lib/incremental-cache/index.js`): fetch 캐시 항목의 `JSON.stringify(data).length`가 2MB(2 × 1024 × 1024)를 넘으면 캐시하지 않는다(커스텀 cache handler를 쓰면 예외). 응답 본문은 base64로 저장되므로(`patch-fetch.js`) 측정값은 UTF-8 바이트의 약 4/3이다
   - **보안 위험(코드로 확인됨)**: 제한을 넘으면 Next가 `Failed to set Next.js data cache for ${fetchUrl} ...`를 dev에서는 예외로 던지고 prod에서는 `console.warn`으로 남긴다. `fetchUrl`은 쿼리스트링(서비스키)을 포함한 전체 URL이다. 우리 로거로는 막을 수 없다
   - **`numOfRows` 결정(2026-09-21)**: 1,000건 페이지가 base64 추정 1,982,436자로 한도의 94.5%(12.A P4)라 여유가 없어 **500**으로 낮췄다. 500건이면 원본 약 0.75MB, base64 약 1.0MB(약 48%)로 추정된다(1,000건 측정값의 절반, 미측정). 호출 수는 고양이 3회 → 6회가 되어 첫 페이지 후 나머지를 동시성 3으로 병렬 수집한다
   - 남은 확인: 500건 페이지의 실제 크기, 동적 핸들러에서 캐시 적중 여부, 콜드스타트 전체 수집 시간(Vercel 로그), 재검증 주기 300초의 적정성
4. ~~Vercel 함수 리전(서울 가능 여부)~~ **icn1로 지정(2026-10-07, 9절, 배포 후 확인 필요)**. 남은 것: 공공 API 응답 속도, 해외 IP 제한 여부, 함수 실행 시간 제한(고양이 전체 수집 6회 호출: 1회 + 나머지 5회 병렬, 호출당 타임아웃 10초). **확인 방법**: Vercel 프로젝트 설정의 Functions Region, 배포 후 함수 로그의 실행 시간, 리전별 upstream 응답 시간. 로컬 기준 1,000건 페이지 474~725ms(12.A P4). 병렬 수집(동시성 3)이 공공 API의 호출 간격 제한에 걸리는지도 확인
5. `desertion_no`로 조회 시 종료/오래된 공고가 조회되는지. 종료(안락사) 1건은 `upkind` 없이 조회 성공(12.A P9). **오래된 공고 전반은 미검증**. 결과는 계속 id로 한 번 더 거른다
6. 이미지 `http` 처리 방식(원격 도메인 설정 vs 프록시). 이미지 URL은 모두 `http://`(12.A P7). **같은 경로가 `https`로도 제공되는지는 미검증**
7. 카카오 피드 이미지 비율 제한은 미확인. `next/og`(satori)의 폰트 형식은 ttf/otf/woff만 지원(woff2 불가)이고 CSS 변수도 쓸 수 없음을 Next 문서로 확인해 otf + hex로 대응했다(9절)
8. UI 라벨 "보호소": `careNm`이 병원일 수 있어 "보호 장소" 등으로 바꿀지
9. `ageText` 표기 정제(`2024(년생)` → "2살 추정" 등)
10. ~~`noticeEdt`가 지난 protected 공고의 D-day 정책~~ **결정됨**: `dDay = null`, `isSoon = false`, 서버에서 제외하지 않음(10절). 고양이 보호중의 42.1%(577건)가 해당한다(12.A P6). endingSoon 정렬은 이들을 뒤로 보낸다(5절)
11. 필터 적용 상태 표시(필터 버튼 점): 미정
12. `upKindNm`이 `고양이`/`개`가 아닌 항목: WireDto `species`는 `cat | dog`뿐이라 서버 Mapper가 `null`을 반환하고 로거로 남긴다(목록에서 제외). 고양이 조회는 전부 `고양이`였다(12.A P8). 개 조회는 미검증
13. ~~이미지 URL 인코딩의 이중 인코딩~~ **결정됨**: `encodeURI` 대신 `[` `]`만 `%5B` `%5D`로 치환한다(이미 인코딩된 `%`는 유지, 멱등). 고양이 이미지 URL 5,512개 중 `[` 포함 628개, `%`/공백/비ASCII는 0개(12.A P7)
14. ~~UpstreamDto 필수 필드 기준~~ **결정됨**: 4절. 고양이 2,529건 모두 문서의 기본 27개 필드가 있어 필수 필드 누락은 없었다(12.A P10)
15. `resultCode` 오류 판정: 성공은 `"00"`, 0건도 `"00"`(12.A P1, P2). 인증 오류는 `resultCode`가 아니라 HTTP 403 + `OpenAPI_ServiceResponse`로 온다(P3, `reason=auth`로 분류). "코드가 있고 공공데이터포털 공통 오류 코드(`01, 02, 04, 05, 10, 11, 12, 20, 22, 30, 31, 32, 33, 99`)일 때만 오류" 규칙은 유지하지만, 200 응답에 이 코드들이 실제로 오는지는 여전히 미검증. `returnReasonCode` 값 목록도 미검증
16. ~~시도 코드 목록 검증~~ **확정됨(2026-09-22 실측, 12.A P11)**: 정적 파일 `src/shared/config/regions.ts`. 서버는 `region`, `district`, `id`의 형식(숫자 문자열 1~32자리)만 검사한다
17. ~~오프셋 커서의 밀림~~ **해결됨(2026-09-29)**: 정렬 키 기준 커서로 바꿨다(5절, 12절 38)
18. `Cache-Control`(`s-maxage=60, stale-while-revalidate=300`) 값은 초기값이며 튜닝 필요. CDN 캐시 키에 쿼리스트링이 포함되는지(Vercel) 확인
19. 최대 페이지 가드(조합당 20페이지, `numOfRows=500`이면 10,000건): 넘으면 잘린 목록을 돌려주고 경고 로그를 남긴다. 고양이 2,529건은 6페이지. 개 규모는 22
20. by-ids의 id별 upstream 호출: 찜 50개면 캐시 미스 시 최대 50회 호출. 공공 API 일일 트래픽 한도와 호출 간격 제한은 미검증
21. 종료 공고 정책: 종료 공고의 대부분은 사망이 아니다. 종료(입양) 233, 방사 57, 기증 39, 반환 22건이 자연사 754, 안락사 53건과 같은 "종료" 배지로 보인다(12.A P5). 종료 사유 비노출(10절)은 유지하고 **결정 보류**, 다음 UI 단계에서 재검토
22. 개(`upkind=417000`) 규모와 페이지 수, 페이지 크기: 미측정(이전 샘플 전체 7,249건에서 역산하면 5천 건 미만으로 보이나 추정). 최대 페이지 가드와 수집 시간 확인 필요
23. ~~이미지 프록시와 `next/image` 미사용, 원본 크기 그대로 내려받기~~ **해결됨(2026-10-07)**: 프록시가 허용 폭(480/828/1080) WebP로 줄인다. 규칙과 `next/image`를 쓰지 않는 이유는 9절 "이미지 프록시 리사이즈". 바이트는 실제 사진 5장 기준 828 폭에서 원본의 5~56%(46 참고). 남은 확인: 원본 파일명에 등록 시각이 있어 URL별 내용이 바뀌지 않는다는 가정(긴 캐시의 근거). 이전 기록: 이미지 프록시(`/api/image-proxy`)와 `next/image` 미사용: 카드 이미지는 plain `<img loading="lazy">`가 프록시를 가리킨다. Vercel Image Optimization을 함께 쓰면 최적화 호출과 대역폭 비용이 이중으로 들 수 있어, 지금은 프록시 응답의 CDN 캐시(`SERVER_TUNING.imageProxyCacheControl`: `max-age=86400, s-maxage=604800, stale-while-revalidate=86400`)로 충분하다고 본다. **튜닝 필요**: 원본 이미지 크기(리사이즈 없이 내려받는 바이트), 목록 스크롤 시 데이터 사용량, CDN 적중률을 보고 `next/image`(또는 리사이즈) 도입 여부를 다시 판단. 원본 파일명에 등록 시각이 있어 URL별 내용이 바뀌지 않는다는 가정(긴 캐시의 근거)도 검증 필요. 원본 크기와 데이터 사용량은 42에서 실측했다(사진 1장 1300×1733 / 약 147KB, 카드 표시 크기는 380×475 CSS px)
24. 이미지 프록시 실패 처리와 제약: 원본 4xx/5xx/타임아웃/이미지가 아닌 응답/10MB 초과는 200 + 투명 1x1 PNG(`Cache-Control: no-store`, `X-Image-Proxy: fallback`)로 내려 카드 사진 영역의 배경색이 보이게 한다. 리다이렉트는 따라가지 않는다(`redirect: "error"`). 원본이 정상적으로 리다이렉트하는 경우가 있는지, 실패 비율은 얼마인지 로그로 확인 필요. 사진 없는 공고의 플레이스홀더 디자인은 미정(handoff)
25. 필터 바텀시트 스와이프 다운 닫기(명세 4.2.1): 미구현. shadcn Sheet(Radix Dialog)에는 제스처가 없다. 배경 탭, 핸들 탭, Esc로 닫는다. 제스처가 필요하면 vaul(shadcn Drawer) 도입(새 의존성) 또는 직접 구현을 결정해야 한다
26. 지역 코드의 이상 항목: 경남 창원시가 코드 3개(5280000, 5320000, 5670000)로 오고(통합 전 마산·진해 코드로 보임, 추정), 충남에 연기군(4560000, 2012년 세종 편입)이 남아 있다. 정적 목록에는 그대로 두고 창원시는 라벨에 코드를 붙였다. 어느 코드로 공고가 조회되는지(`org_cd`)는 미검증
27. ~~기본 지역 첫 화면의 공고 수~~ **해결됨(2026-09-28)**: 종로구는 고양이 보호중 공고가 5~6건뿐이라 첫 화면이 비어 보였다. 기본 지역을 서울특별시 전체로 넓혔고(7절), 같은 조건에서 첫 페이지 20건 + 다음 커서가 나오는 것을 확인했다. 서울 전체도 비는 계절/필터 조합이 생기면 기본값을 다시 본다
28. `org_cd` 필터의 서버 동작: `upr_cd`와 함께 보낸 `org_cd`로 공고가 시군구 단위로 걸러지는지 실측 필요(파라미터 자체는 4절 확인된 요청 변수)
29. ~~카카오 SDK 버전과 무결성 해시~~ **확정됨(2026-09-22)**: 버전 2.8.3(Full SDK, `kakao.min.js`) + integrity(sha384) 적용 확정. 값은 카카오 개발자 다운로드 페이지에서 직접 복사, 2026-09-22 기준(`KAKAO_SDK_URL`, `KAKAO_SDK_INTEGRITY`). SDK 버전 업그레이드 시 integrity 값도 반드시 같이 갱신 필요. 남은 확인: 카카오 키 발급과 사이트 도메인 등록 후 실제 공유 시트가 뜨는지, 콘솔에 SRI 오류가 없는지, 썸네일(이미지 프록시 URL)을 카카오가 가져갈 수 있는지와 피드 이미지 비율 제한 카드의 링크가 동작하지 않고(눌러도 반응 없음) 앱 이름이 `apps.kakao.com`으로 가면 링크 도메인이 콘솔에 등록되지 않았거나 로컬 주소인 경우다(2026-09-28 증상). 우리 쪽은 로컬 주소면 아예 카카오 공유를 하지 않고 링크 복사로 폴백한다(9절).
30. OG 이미지 실제 렌더: 실제 공고(사진 fetch 포함)로 렌더 결과, Vercel 배포 번들에 폰트 두 개가 포함되는지, otf(각 약 1.5MB) 파싱 시간과 메모리, 종료 공고 사진의 채도 낮춤(satori `filter` 지원 여부, 현재 미적용) 확인. 로컬에서는 기본 이미지와 합성 데이터 카드로 한글 렌더를 확인했다
31. ~~상세 페이지의 서버 조회 중복~~ **해결됨(2026-09-22)**: `generateMetadata`와 페이지가 React `cache`로 감싼 `getAnimalForRequest`를 함께 써서 요청당 서버 조회 1회. 페이지는 결과를 TanStack Query 캐시(상세 쿼리 키)로 미리 채워 넘겨 클라이언트 `useAnimal`이 `/api`를 다시 부르지 않는다. OG 이미지 라우트는 별도 요청이라 이 캐시를 공유하지 않고 upstream fetch 캐시(300초)만 공유한다
32. ~~뒤로가기~~ **해결됨(2026-09-29)**: 화면 안 뒤로가기 버튼은 이 문서(탭)에서 목록 화면을 거쳤고 `history.length > 1`일 때만 `router.back()`이고, 아니면 기본 목록(`/`)으로 `push`한다. 목록을 거쳤는지는 모듈 변수로 기록한다(`shared/lib/app-navigation.ts`, 목록 위젯이 마운트될 때 표시). `history.length`만 보면 카카오톡 인앱 브라우저나 외부 사이트에서 같은 탭으로 들어온 경우를 가릴 수 없어 뒤로가기가 앱 밖으로 나갔다. `router.back()`이라 필터가 붙은 목록 URL과 스크롤 위치가 그대로 살아난다
33. 카드 하트와 사진 없음 플레이스홀더의 디자인: 시안이 없어 overlay 버튼 모양과 아이콘만 둔 대체 UI로 임시 구현
34. ~~이미지 프록시의 이미지 판별~~ **확정됨(2026-09-27 로컬 재현)**: 공공데이터포털 `fileDownloadSrvc` 파일 다운로드 엔드포인트는 실제 이미지 파일을 내려주면서 `Content-Type`을 `application/octet-stream`으로 잘못 표기한다. 그래서 이미지 프록시와 OG 이미지 fetch는 `Content-Type` 헤더를 믿지 않고 응답 바이트의 매직 넘버(JPEG `FF D8 FF`, PNG, GIF8, RIFF…WEBP)로 이미지 여부를 판별하고, 응답 `Content-Type`도 판별한 값으로 직접 설정한다(`src/server/images/image-type.ts`). 허용 호스트 검증은 그대로다. 매직 넘버가 맞지 않으면 기존처럼 투명 1x1 PNG로 폴백한다(로그 `reason: not_image`에 업스트림 헤더와 앞부분 바이트만 남긴다)
35. ~~`state` 파라미터 의미~~ **확정됨(2026-09-28 라이브 확인)**: `state`(`notice`/`protect`)는 `processState` 필드 텍스트("보호중" 등)와 무관하고, 공고 기간 경과 여부로 계산되는 것으로 보인다. 서울(`upr_cd=6110000`) 종로구(`org_cd=3000000`) 고양이 조회에서 `state` 없이 6건(보호중 5, 종료(자연사) 1)이 오는데, 같은 조건에 `state=protect`를 붙이면 0건이다. 보호중 5건은 모두 `noticeEdt`가 조회일(공고 마지막 날)이었다. 우리 서버는 처음부터 `state`를 보내지 않고 `processState`가 `종료`로 시작하는지로 직접 분류하므로(5절) 영향이 없다. `notice`/`protect`의 정확한 계산 규칙은 여전히 미검증이며, 앞으로도 이 파라미터에 의존하지 않는다
36. ~~상세에서 뒤로 왔을 때 목록 스크롤 위치~~ **해결됨(2026-09-28)**: 뒤로가기 자체는 스크롤을 건드리지 않는다(App Router의 `restore-reducer`는 `scrollRef`를 비운다). 위치가 맨 위로 리셋된 원인은 두 가지였다. (1) 목록 → 상세로 **갈 때** Next가 새 세그먼트를 `scrollIntoView`로 보여 주는데, 이때 스크롤되는 건 window가 아니라 480px 컬럼 안의 스크롤 컨테이너라서 그 스크롤 이벤트가 저장값을 0으로 덮었다. → 목록에서 나가는 링크에 `scroll={false}`. (2) 저장이 스크롤 이벤트에만 걸려 있어 마지막 위치가 저장되기 전에 화면이 사라질 수 있었다. → effect 정리와 `pagehide`에서도 저장. 복원은 목록이 다시 그려진 뒤 몇 프레임까지 다시 시도한다(캐시된 페이지가 붙어 높이가 확보될 때까지). 브라우저 기본 스크롤 복원은 내부 스크롤 컨테이너에는 적용되지 않으므로 쓰지 않는다 (2026-09-29에 픽셀 방식 자체를 버리고 카드 id 기준으로 바꿨다. `scroll={false}`는 그대로 둔다, 38 참고)
37. ~~뒤로가기 후에도 목록이 맨 위로 가던 나머지 원인~~ **해결됨(2026-09-29)**: 36의 수정(`scroll={false}`, 정리 시점 저장) 뒤에도 재현됐다. 원인은 정리 시점에 컨테이너에서 위치를 **다시 읽은 것**이다. 화면이 바뀌면 목록 DOM이 먼저 지워지고, 그러면 내부 스크롤 컨테이너에 스크롤할 내용이 없어져 브라우저가 `scrollTop`을 0으로 누른다. effect 정리는 그 뒤에 돌기 때문에 0을 저장했다. 이제 스크롤 이벤트에서 마지막 위치를 기억해 두고, 떠날 때는 스크롤할 내용이 남아 있을 때만 다시 읽는다. jsdom에는 레이아웃이 없어(`scrollHeight`가 0) 이 구분을 할 수 없으므로, 테스트는 컨테이너에 실제 브라우저와 같은 높이를 정의해 재현한다. 참고로 Next 16의 bfcache(`<Activity>`로 이전 화면을 살려 두는 것)는 `cacheComponents`를 켤 때만 동작하므로(`MAX_BF_CACHE_ENTRIES`는 1) 목록은 실제로 언마운트된다 **이 방식은 2026-09-29에 폐기했다.** 실제 브라우저에서는 그 뒤에도 위치가 틀어졌고(복원 시점의 높이, 눌림 타이밍) jsdom으로는 검증할 수 없었다. 카드 id 기준 복원 + Playwright 검증으로 교체했다(7절, 38)
38. ~~목록의 중복 key(`Encountered two children with the same key`)~~ **해결됨(2026-09-29)**: 목록 커서가 정렬된 결과의 **offset**이어서, 페이지를 넘기는 사이에 목록이 바뀌면(새 공고 추가, 상태 변경, 캐시 재검증 300초) 뒤 페이지가 한 칸씩 밀려 경계 항목이 두 번 나왔다. 업스트림 응답과 우리 서버 응답 자체에는 중복이 없었고(서울 고양이 보호중 107건/전체 187건 전부 고유, 업스트림 1페이지), 클라이언트는 페이지를 이어 붙이기만 한다. 커서를 정렬 키 기준으로 바꿔 밀림과 무관하게 만들었다(5절). 같은 원인으로 생기던 누락도 함께 없어진다
39. 지역 이름으로 코드를 되찾을 때 애매한 케이스: 업스트림에 지역 코드가 없어 `orgNm` 이름으로 맞춘다(4절). 2026-09-29 표본(전국 시도별 고양이 1페이지, `orgNm` 170종)에서 애매한 것은 셋이다.
    - `"경상남도 창원시 의창성산구"` → **시도만(경상남도 전체)**. `sigungu_v2` 원본에서 창원시 코드 3개(5280000, 5320000, 5670000)의 이름이 모두 그냥 `"창원시"`이고 `"의창성산구"`라는 시군구는 목록에 없다. 즉 이름으로는 어느 코드인지 특정할 수 없어 폴백이 맞다(정적 목록의 라벨 `창원시(5280000)` 등은 이 중복 때문에 코드를 붙인 것이다). 참고로 같은 날 실측에서 공고가 실제로 조회되는 코드는 5670000 하나였고(고양이 4건, 개 92건) 나머지 둘은 0건이었다. 데이터가 그때그때 달라질 수 있어 코드로 못 박지 않았다. 폴백한 경상남도 전체 목록에는 그 공고가 들어 있지만, focus로 찾을 때는 5페이지(100건) 상한에 걸려 못 찾을 수 있다(40).
    - `"세종특별자치시"`, `"제주특별자치도"` → 시도만. `orgNm`에 시군구가 없다(의도한 동작).
    - `"경기도 수원시 권선구"`처럼 시 아래 구가 오는 형식은 구(권선구) → 시(수원시) 순으로 맞추도록 해 뒀지만, 그런 공고가 표본에 없어 실제 값으로는 미검증
40. `focus`로 공고를 찾을 때의 페이지 상한: 5페이지(100건)까지만 이어 받는다. 그보다 뒤에 있는 공고는 못 찾고 맨 위에 둔다. 한 시군구 목록이 대개 100건 이하라 잡은 값이며, 상한을 늘리면 기다림과 서버 요청이 늘어난다. 공유 링크 유입에서 실제로 못 찾는 비율을 보고 조정
41. 필터 UI에 창원시가 코드별로 3개(5280000/5320000/5670000) 노출된다. 2026-09-29 실측 기준 공고가 조회되는 건 5670000뿐이라 사용자가 빈 목록을 고를 수 있다. 후보: 창원시 하나로 묶고 조회 시 3개 코드를 합산 / 라벨을 식별 가능한 이름으로 교체(공식 근거 필요). 미결(39)
42. 목록이 길어질 때의 성능(2026-09-30 실측). 방법: production 빌드(`build` + `start`), Playwright/Chromium, Pixel 7 뷰포트(412×915, DPR 2.625), CPU 4배 스로틀. 목록 API는 `page.route`로 1,100건·20건/페이지 고정, 사진은 실제 크기 더미(1300×1733, 141KB). 측정 스크립트는 커밋하지 않는다.

    실제로 닿는 깊이(같은 날 실제 API를 끝까지 페이징): 서울 고양이 보호중 108건(6페이지), 서울 고양이 전체 192건(10페이지), 서울 개 전체 141건(8페이지), 경북 개 전체 436건(22페이지), 경남 540건(27페이지), 전남광주통합 634건(32페이지), **경기 개 전체 809건(41페이지)**. 50페이지는 상한 근처의 가정이고 10~20페이지가 현실적인 나쁜 쪽이다.

    | | 1페이지 | 5페이지 | 10페이지 | 20페이지 | 50페이지 |
    |---|---|---|---|---|---|
    | 카드 | 20 | 100 | 200 | 400 | 1,000 |
    | DOM 노드 | 410 | 1,770 | 3,470 | 6,935 | 17,070 |
    | 이벤트 리스너 | 440 | 920 | 1,520 | 2,753 | 6,321 |
    | JS 힙(GC 후) | 4.9MB | 6.4MB | 7.8MB | 11.8MB | 17.9MB |
    | 브라우저 private(빈 탭 356MB 대비) | +38MB | +68MB | — | +316MB | +407MB |
    | 페이지 한 장 더 붙이기 | 127ms | 129ms | — | 243~276ms | 474~524ms |
    | 뒤로가기 복원 완료 | — | — | **355ms** | **570ms** | 1,440ms |
    | 그중 가장 긴 long task | — | — | **248ms** | **445ms** | 1,146ms |

    스크롤 자체는 문제가 아니었다: 50페이지에서도 스크롤 중 long task 0건, 150프레임 중 드롭 0~9, 프레임 p95 21~23ms. 이미지도 의도대로다(plain `<img>`, 첫 2장만 eager, 첫 페이지 20장 중 요청 5장이고 한 화면 내려도 7장, `/_next/image` 요청 0).

    - **(A) 목록 재요청 — 해결됨(2026-09-30)**: staleTime이 지난 뒤 목록으로 돌아오면 `/api/animals`가 쌓인 페이지 수만큼(측정 51번, cursor null·20·40…1000) 순차로 나갔다. 목록 무한쿼리의 refetch를 껐다(5절). 같은 조건 재측정에서 10·20페이지 모두 뒤로가기 요청 0번이다.
    - **(B) 뒤로가기 복원 비용 — 미결**: 카드를 다시 마운트하는 비용이라 카드 수에 거의 비례한다(위 표). 200카드 248ms는 넘어가도 되지만 1,000카드 1.1초는 그 동안 입력을 못 받는다. 선택지: (1) 그대로 둔다(현실 깊이가 대개 20페이지 이하) (2) 페이지 상한 + "필터를 좁혀 보세요" 안내 — 명세 4.1.4(무한 스크롤)와 어긋나므로 결정 필요 (3) 가상화 — 새 의존성이고, 지금의 카드 id 기준 복원(`scrollAppToAnimal`)이 DOM에서 카드를 찾으므로 index 기준으로 바꿔야 한다(복원 책임이 `shared/ui/app-column`에서 목록 위젯으로 옮겨가고, 카드 높이가 두 종류라 `scrollToIndex` 후 재보정이 필요하며, `focus` 흐름과 `[data-animal-id]` 개수를 세는 e2e 헬퍼도 같이 고쳐야 한다). 경기 개 전체(41페이지)가 실제로 얼마나 쓰이는지 보고 결정한다.
    - **(C) 사진 데이터량과 메모리 — 미결, 23과 함께 본다**: 실제 사진은 1300×1733 / 약 147KB인데 카드는 380×475 CSS px(DPR 2.625에서 997×1247 device px)에 그린다. 리사이즈가 없어 1,000장을 다 보면 약 147MB를 받고, 브라우저 프로세스는 빈 탭 대비 +407MB였다. 사진 1장 디코드 상한은 9.0MB(1300×1733×4)지만 크롬이 화면 밖 것을 버려 단순 합(50페이지 2,982MB)에는 닿지 않는다. 저가형 기기에서의 탭 종료 위험은 미검증
    - **카드별 찜 리스너 — 미결**: `FavoriteButton`이 카드마다 `subscribeFavorites`로 window 리스너 2개를 걸어 1,000카드면 2,000개다. 찜을 토글하면 스냅샷이 바뀌어 카드 전부가 다시 그려지고, 하트 탭의 입력 응답(event duration)이 20페이지 56ms → 50페이지 112ms로 늘었다(기준 200ms 안이라 급하지는 않다). 찜 id를 목록에서 한 번 읽어 카드에 내려주는 구조로 바꿀지 결정 필요
    - **채택하지 않음**: `maxPages`(무한쿼리가 유지할 페이지 수 상한)는 재요청과 DOM을 같이 줄이지만, 상한을 넘으면 앞 페이지가 캐시에서 사라져 뒤로가기 복원 대상 카드를 못 찾고(맨 위로) 위로 스크롤할 때 다시 받으며 위치가 튄다 — 7절 복원 규칙과 충돌한다. `content-visibility: auto`는 측정에 근거가 없다: 50페이지 누적 Layout 0.97초 / RecalcStyle 0.4초로 레이아웃 비용이 이미 작고, 문제인 복원 long task는 React 마운트라 줄지 않는다
43. 기타 축종의 화면 디자인: 시안이 없어 임시로 카드 1줄과 상세 타이틀에 `"<동물> · <지역>"`을 쓴다(`animalTitle`). 지역만 쓰는 고양이·강아지와 달리 한 줄에 두 값이 들어가 긴 이름(예: `크레스티드 게코`)은 카드에서 잘린다(`truncate`). 필터 Segmented는 3칸이 됐고 라벨은 "기타 동물"이다. 목록 타이틀은 "기타 동물 공고". 기타 캐릭터는 만들지 않기로 했고(44), 이 임시 표기는 카드·상세 시안이 나올 때 다시 본다(33과 함께)
44. 홈(축종 선택)과 목록 헤더 진입점의 UI: 2026-10-02 임시 구현을 2026-10-07 시안(Main, Home-PC, Header-A)으로 교체했다. 문구는 `ANIMAL_COPY`의 `home*`. 시안 값이 토큰에 없는 곳은 토큰을 썼다(새 색·치수를 만들지 않음). 시안과 다른 점:
    - 홈 서비스명 16/700 → `card-title` 16/600(16/700 타입 토큰이 없다)
    - 홈 서비스명 줄 높이 56 → 목록 헤더와 같은 구조와 높이 68(바깥 `header`에 `py-3`, 안쪽 줄에 `min-h-touch`: `space-3 + touch + space-3`). 본문 아래 여백(시안 56)도 같은 68로 둬서 본문이 화면 전체의 세로 가운데에 온다(`e2e/home-layout.spec.ts`가 4개 뷰포트에서 중심 오프셋 2px 이내를 검사). 2026-10-07 첫 구현은 한 요소에 `min-h-touch py-3`을 함께 둬서 border-box로 48이 됐고, 본문이 10px 위로 올라가 있었다
    - 블록 간격(제목·카드·기타 링크) 32 → `space-6`(24)
    - 카드 안 여백: 390 시안 위 24 / 아래 20 → `space-6` / `space-4`. 480 시안 28 / 24 → 390과 같다(데스크톱 레이아웃은 따로 두지 않는다, README Layout)
    - 헤더 타이틀과 chevron 사이 2px → `space-1`(4px). 시안의 56px 헤더와 아래 구분선은 따르지 않고 기존 헤더(handoff: 세로 space-3, 구분선 없음)를 유지했다. 하트·필터 위치도 그대로다
    - 기타 링크의 밑줄 간격 3px은 시안 값 그대로다(밑줄 간격에 해당하는 토큰이 없다)
    - 헤더 진입점의 링크 이름은 시안의 숨김 텍스트(sr-only) 대신 `aria-label`로 "<타이틀>, 다른 동물 고르기"에 고정한다. sr-only는 `absolute`라 Chrome이 "고양이 공고 , 다른 동물 고르기"처럼 쉼표 앞에 공백을 끼웠다
    - 홈 문서 제목은 화면 제목과 같은 "오늘은 누구를 보러 왔어요? | 냥공고"다(`ANIMAL_COPY.homeTitle`, 다른 화면과 같은 `<화면 제목> | SERVICE_NAME` 형식)
    - 미확인: 실제 iOS Safari에서 누름 피드백이 보이는지(7절). Rive 애니메이션은 다음 단계다. 43과 함께 본다
45. 상세 prefetch가 공공데이터포털을 부른다(2026-10-07 실측). **(c) 관찰로 결정**(사유는 아래). 방법: production 빌드(`build` + `start`), fetch 캐시(`.next/cache/fetch-cache`)를 비운 상태, Playwright/Chromium 390×844, 고양이·서울 목록에 들어가 1.5초 기다린 뒤 700px씩 15번 스크롤(카드 20 → 40). 서버 쪽은 측정용 preload로 `data.go.kr`로 나가는 실제 네트워크 fetch만 셌다(호스트·경로와 `desertion_no` 유무만 기록하고 쿼리스트링·서비스키는 기록하지 않음, 커밋하지 않음).

    | | `_rsc` 요청(모두 prefetch) | 그중 상세 | 상세 경로 수 | 공공데이터포털 목록 호출 | 상세 호출 |
    |---|---|---|---|---|---|
    | 로딩 경계 전 | 29 | 24 | 22 | 1 | **22** |
    | 로딩 경계 후 | 29 | 24 | 22 | 1 | **22** |

    - 로딩 경계는 prefetch 요청 수도, 공공데이터포털 호출 수도 바꾸지 않았다. 전후 모두 화면에 들어온 카드마다 상세 1회 호출이 생긴다(목록은 한 번에 받은 뒤 서버 캐시라 1회).
    - 원인은 **`generateMetadata`**다. Next 16은 카드마다 경로 트리 요청(`Next-Router-Segment-Prefetch: /_tree`)과 동적 prefetch 요청을 보내는데, 뒤의 요청을 막으면 상세 호출이 0이 됐다. 같은 빌드에서 `generateMetadata`만 실험적으로 비우면(커밋하지 않음) 스크롤해도 상세 호출이 **0**이었다. 즉 로딩 경계 뒤로 페이지 본문은 prefetch에서 빠졌지만 메타데이터(공유 미리보기 제목·설명)는 prefetch에서 계속 만들어지고, 그것이 공고를 조회한다.
    - 같은 공고는 업스트림 페이지 캐시(300초) 안에서 다시 호출하지 않는다. 그래도 목록을 훑는 사용자 수만큼 상세 조회가 늘어 일일 호출 한도에 영향을 줄 수 있다.
    - 후보였던 것: (a) 카드 링크 `prefetch={false}`(뼈대가 즉시 보이는 것도 잃는다) / (b) prefetch 요청일 때 `generateMetadata`가 조회하지 않기 / (c) 그대로 두고 호출량을 관찰.
    - **(c) 관찰로 결정, 사유: (b)를 문서화된 방법으로 구현할 수 없다.**
      - prefetch 신호인 `next-router-prefetch` 요청 헤더 자체는 공식 문서에 있다: CDN 가이드(https://nextjs.org/docs/app/guides/cdn-caching, "`next-router-prefetch` — whether this is a prefetch request"), CSP 가이드(https://nextjs.org/docs/app/guides/content-security-policy, Proxy matcher의 `missing` 예).
      - 하지만 앱 코드에서는 읽을 수 없다. Next 16.3.5 production에서 `generateMetadata` 안의 `headers()`에 `next-router-*`·`rsc` 헤더가 하나도 없었다(헤더 이름만 찍는 임시 로그로 확인, 커밋하지 않음). 헤더 검사를 넣은 빌드로 다시 재도 상세 호출은 22회 그대로였다.
      - Proxy 문서(https://nextjs.org/docs/app/api-reference/file-conventions/proxy, "RSC requests and rewrites")도 이 헤더들을 `request.headers`에서 지운다고 적고, 이유를 RSC 요청을 HTML 요청과 다르게 처리하지 않게(둘이 맞아야 한다)라고 밝힌다. `skipProxyUrlNormalize`로 Proxy에서 헤더를 살려 다른 헤더로 넘기는 우회는 Next가 일부러 막은 구분을 되살리는 것이라 하지 않는다.
      - (a)는 사용자 문제(눌러도 반응 없음)를 다시 만든다.
      - 그래서 prefetch마다 생기는 상세 조회(화면에 들어온 카드당 최대 1회, 같은 공고는 업스트림 페이지 캐시 300초 안에서 재호출 없음)를 받아들이고 호출량을 본다. 공공데이터포털 일일 한도에 가까워지거나 한도 초과 응답이 보이면 다시 연다. **한도 초과는 Vercel 함수 로그의 `upstream quota exceeded`(reason `quota_exceeded`, code 22)로 알 수 있다(2026-10-07, 5절).** 오류 응답은 업스트림 페이지 캐시와 CDN 어디에도 남지 않는다.
      - (b)의 두 번째 조건(prefetch 때 만든 기본 메타데이터가 이동 후에도 남는지)은 첫 조건에서 막혀 확인하지 못했다. 지금은 카드를 눌러 이동한 뒤 문서 제목이 그 공고의 제목이다(production에서 확인)
46. 운영 로딩 시간 실측(2026-10-07, 측정 당시 코드 변경 없음. 후속 일부 반영, 아래). 대상 https://nyanggonggo.vercel.app, 측정 위치 한국(로컬 PC).
    - 리전: 목록 API·상세 HTML·이미지 프록시 모두 `x-vercel-id: icn1::iad1::…`이다. 엣지는 서울, **함수는 워싱턴(iad1, Vercel 기본값)**에서 돈다. 저장소에 `vercel.json`이나 라우트별 `preferredRegion` 설정이 없다. 공공데이터포털과 이미지 원본(`openapi.animal.go.kr`, http)은 한국에 있어 캐시 미스 때마다 함수가 태평양을 왕복한다.
    - 이미지 프록시 캐시: 코드는 `public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400`을 내리고 업스트림 fetch는 `no-store`다(바이트를 데이터 캐시에 넣지 않음, 캐시는 CDN). 브라우저에는 `Cache-Control: public, max-age=86400`로 보인다. 같은 사진을 연속 요청하면 첫 번째는 `x-vercel-cache: MISS`, 두 번째부터 `HIT`이었다(5장 모두).
    - 사진 5장(경남 강아지 목록, 142~618KB, 원본 그대로·리사이즈 없음): 프록시 MISS TTFB 0.97~4.00초 / 전체 1.54~4.95초, 프록시 HIT 전체 0.07~0.36초, 원본 직접 전체 0.12~1.14초(대부분 0.13~0.26초).
    - 목록 API: CDN HIT 0.04~0.06초, MISS 3.5초(경남 강아지)·6.6초(전북 고양이). 같은 업스트림 목록 1페이지(1,000건, 535KB)를 한국에서 직접 부르면 0.39~0.44초, 상세 단건 0.03초였다(키는 로컬 `.env.local`에서 읽고 시간만 출력). 상세 HTML TTFB는 0.25~0.34초, 첫 요청 1.36초.
    - 브라우저(Playwright Pixel 7, 9Mbps/1.5Mbps/150ms 스로틀): 목록 첫 카드 사진까지 API·사진 MISS일 때 5.3초(서울 고양이)·7.7초(경북 강아지), HIT일 때 1.7초·2.4초. 상세는 카드를 누른 뒤 첫 사진까지 0.36~0.42초였는데, 목록에서 같은 사진을 이미 받아(같은 URL, 브라우저 캐시) 빠른 것이다. 목록 사진은 앞 2장만 `loading="eager"`이고 나머지는 `lazy`, 모두 `decoding="async"`, `fetchpriority`·preload는 없다. 상세 캐러셀은 첫 장만 eager이고 다음 사진을 따로 미리 받지 않는다(lazy라 가로 스크롤 영역의 근처 판정에 맡긴다).
    - 추정: 첫 방문의 지연은 대부분 **iad1 함수의 캐시 미스**에서 생긴다(업스트림 자체는 한국에서 0.4초 이하). HIT 이후에는 **사진 용량**(원본 140~620KB를 4:5 카드 폭에 그대로 씀)이 남는 비용이다.
    - 호출 한도: 공공데이터포털 서비스 페이지의 에러코드 표에 `22 LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR`("API 서비스의 일일 호출 허용량을 초과했습니다")가 있고, 개발계정 일일 트래픽은 10,000이다(https://www.data.go.kr/data/15098931/openapi.do). 응답의 HTTP 상태와 본문 형식은 문서에 없다(인증 오류는 HTTP 403 + `OpenAPI_ServiceResponse.cmmMsgHeader`였다, 12.A P3). 지금 코드는 22를 따로 구분하지 않는다: 403 + `cmmMsgHeader`면 "upstream auth/config error"로(returnReasonCode 22가 함께 남는다), 200 + `response.header.resultCode=22`면 "upstream failure"(kind resultCode)로, 200 + `cmmMsgHeader`면 "upstream failure"(kind shape, 본문 일부)로 남는다. 사용자에게는 목록 오류 화면("지금은 …를 불러오지 못했어요"), 상세 오류 화면으로 보인다(502). HTTP 200으로 오는 오류 본문은 fetch 캐시(`revalidate`)에 그대로 담길 수 있는지 확인되지 않았다.
    - 후속(2026-10-07): 함수 리전 icn1(9절, 배포 후 `x-vercel-id`로 확인), 한도 초과(22) 로그 구분과 오류 캐시 금지(5절), 첫 사진 `fetchpriority="high"`(7절)를 반영했다. 배포 후 같은 방법으로 다시 잰다. 남은 후보(미결): 리사이즈·포맷 변환(23과 함께), 프록시의 브라우저 캐시 기간(지금 `max-age=86400`), preload. 위의 호출 한도 문단의 "지금 코드는 22를 따로 구분하지 않는다"와 "200 오류 본문이 fetch 캐시에 담길 수 있는지 확인되지 않았다"는 이 후속 전의 상태다(담긴다: Next는 200이면 저장한다. 지금은 원본 fetch를 캐시하지 않는다)
    - 후속 2(2026-10-07): 남은 비용(사진 용량)에 대해 프록시 리사이즈·WebP를 반영했다(9절, 23 해결). 같은 사진 5장(이 절 첫 측정)의 q75 결과, 828 폭(390 DPR 2의 카드·상세): 546→47KB, 559→120KB, 173→49KB, 603→31KB, 139→78KB(원본의 5~56%), 변환 63~86ms. 1080 폭: 48~188KB(8~56%), 86~108ms. 배포 후 이 절과 같은 방법으로 첫 사진 시간을 다시 잰다(새 사진의 첫 요청은 변환 시간만큼 MISS가 늘고, 그 뒤로는 CDN HIT).
    - **리사이즈 배포 후(2026-10-08 실측, 같은 방법)**
      - sharp는 Vercel(icn1)에서 동작한다: 새 목록(인천 고양이)의 사진 5장 × 480/828/1080 = 15건 모두 `200 image/webp`, `X-Image-Proxy: original`(변환 실패 대체) 0건. 원본 66~447KB → 480 폭 11~66KB, 828 폭 12~110KB, 1080 폭 12~110KB(원본보다 큰 폭은 원본 폭 그대로라 크기가 같다).
      - 프록시 MISS(원본 받기 + 변환) 0.14~1.27초, 같은 요청 반복은 모두 `x-vercel-cache: HIT` 0.04~0.28초.
      - 카드 20장을 볼 때 받은 사진 총 바이트(Pixel 7, DPR 2.625라 1080 폭): 서울 고양이 6,255KB → **1,305KB(21%)**, 경기 강아지 9,226KB → **1,624KB(18%)**. 리사이즈 전 값은 같은 20장의 원본 합계다(그때 프록시가 원본을 그대로 내려줬다).

      | 스로틀(Pixel 7, 9Mbps/1.5Mbps/150ms) | 리사이즈 전(10-07, icn1) | 리사이즈 후(10-08) |
      |---|---|---|
      | 목록 첫 사진, 캐시 HIT | 1.7~2.8초(서울 1.8, 경북 2.8, 강원 1.7, 전남광주 1.8) | **1.3~1.4초**(서울 1.31·1.32, 경북 1.41, 울산 1.37, 대전 1.36) |
      | 목록 첫 사진, 사진 MISS(목록 API는 빠를 때) | 1.7~3.1초 | 1.5~1.7초(경북 1.52, 경남 기타 지역 1.69) |
      | 목록 첫 사진, 목록 API까지 MISS | 2.4~3.1초 | 4.3~7.8초(울산 4.27, 대전 7.78, 제주 6.84) — 아래 |
      | 상세 첫 사진(카드 탭 후), 서버 조회 빠를 때 | 0.28~0.43초 | 0.37~0.47초 |
      | 상세 첫 사진, 서버 상세 조회 MISS | — | 2.3~5.2초 — 아래 |

      - 캐시 HIT 이후의 첫 사진은 1.7~2.8초 → 1.3~1.4초로 줄었다. 사진 자체(MISS 포함)는 0.2~1.7초 안에 끝났다.
      - 목록 API MISS가 3~7초로 늘어난 것은 리사이즈와 무관한 **공공데이터포털 응답 지연**이다. 측정 시점에 이 PC에서 업스트림을 직접 불러도 빈 목록 2.7~7.6초, 상세 단건 2.8초였다(10-07에는 목록 0.4초, 상세 0.03초). 같은 시점 운영의 새 목록 MISS 8건 중 6건이 2.9~6.8초, 2건은 0.18~0.21초(서버 페이지 캐시가 따뜻했던 것으로 보인다). 상세 MISS가 느린 것도 같은 이유다(이동 요청은 0.18초에 뼈대가 오고, 공고 조회를 기다리느라 본문이 2.3초 뒤에 왔다).
      - 업스트림 지연이 일시적인지는 날을 바꿔 다시 본다. 지연이 잦으면 서버 페이지 캐시 기간(300초)을 늘리거나 만료된 페이지를 먼저 주고 뒤에서 갱신하는(stale-while-revalidate) 방식을 검토한다(미결).
    - **리전 변경 후(2026-10-07 배포, 같은 방법으로 재측정)**: 목록 API·상세 HTML·이미지 프록시 모두 `x-vercel-id: icn1::icn1::…`(함수 서울). 사진은 다른 목록(충북 강아지)의 5장이라 크기가 다르다(35KB~1.0MB).

      | 항목 | 변경 전(iad1) | 변경 후(icn1) |
      |---|---|---|
      | 사진 프록시 MISS 전체 | 1.54~4.95초(TTFB 0.97~4.00) | **0.11~0.41초**(TTFB 0.10~0.34) |
      | 사진 프록시 HIT 전체 | 0.07~0.36초 | 0.06~0.68초(대부분 0.08~0.16) |
      | 사진 원본 직접 | 0.12~1.14초 | 0.12~0.67초 |
      | 목록 API MISS | 3.5초 / 6.6초 | **0.35초 / 0.46초 / 0.84초** |
      | 목록 API HIT | 0.04~0.06초 | 0.05~0.06초 |
      | 상세 HTML TTFB | 0.25~0.34초(첫 요청 1.36초) | 0.08~0.10초(첫 요청 0.08~0.30초) |
      | 스로틀 목록 첫 사진, 서울 고양이 MISS → HIT | 5.3초 → 1.7초 | **1.7초** → 1.8초 |
      | 스로틀 목록 첫 사진, 경북 강아지 MISS → HIT | 7.7초 → 2.4초 | **3.1초** → 2.8초 |
      | 스로틀 목록 첫 사진, 새 목록(강원 고양이 / 전남광주 강아지) MISS → HIT | — | 3.1초 → 1.7초 / 2.4초 → 1.8초 |
      | 스로틀 상세 첫 사진(카드 탭 후) | 0.36~0.42초 | 0.28~0.43초 |

      - 캐시 미스 비용(함수의 태평양 왕복)은 대부분 사라졌다. 프록시 MISS가 원본 직접 요청과 비슷해졌고 목록 API MISS는 0.35~0.84초다.
      - HIT 이후의 첫 사진 1.7~2.8초는 거의 그대로다. 남은 비용은 **사진 용량**이다(경북 강아지 첫 사진 526KB가 9Mbps에서 HIT여도 1.9초). 다음 후보는 리사이즈·포맷 변환(23)이다.
      - 상세 첫 사진은 목록에서 같은 사진을 이미 받아(브라우저 캐시) 전후 모두 빠르다. `fetchpriority`의 효과는 이 측정으로는 따로 가르지 못했다.
      - 서울 고양이 #1은 API·사진이 MISS였지만 서버 페이지 캐시(`unstable_cache`, 300초)가 따뜻했을 수 있다. 새 목록 두 개(강원 고양이, 전남광주 강아지)는 이번에 처음 요청했다.

47. Rive 캐릭터(고양이·강아지) 애니메이션(2026-10-08). **홈에 1차 적용(greet·idle·press, sleep 제외)**, 규칙은 9절 "홈 캐릭터 Rive". 원본은 `rive/nyang-characters/scene.rml`(아트보드 `nyang-cat`, `nyang-dog`), 앱이 쓰는 빌드는 `public/characters/nyang-characters.riv`(`pnpm rive:build`). 동작 기준은 `docs/design/characters.md` 모션 절(greet·idle·sleep·press).
    - **버전 고정**: Rive CLI **1.5.0**(기술 미리보기, `~/.rive/bin/rive.exe`, 이 PC의 셸 PATH에는 없다), 웹 런타임 **`@rive-app/webgl2` 2.44.0**(공식 문서의 기본 권장 패키지). 계정 없이 `--verify`·`--once`·`--screenshot`이 모두 로컬에서 된다. **규칙: 둘 중 하나를 올리면, 로그인 없이 만든(서명 없는) `.riv`를 웹 런타임에 띄워 시작 전·재생 중에 Rive 로고 화면·워터마크가 생기지 않는지 먼저 확인하고 이 줄의 버전을 바꾼다.** 지금의 "로고 없음"은 위 두 버전 기준이다.
    - **도형**: Rive CLI에는 SVG 가져오기가 없어(`rive docs assets`) `scripts/svg-to-rml.mjs`가 SVG path를 정점으로 옮긴다(사용법·한계는 파일 머리말). `--replace`가 scene.rml의 `svg-to-rml:begin/end` 표시 사이만 바꿔 애니메이션은 손으로 쓴 그대로 둔다. 고양이에 다시 돌려 커밋된 도형과 줄 단위로 같음을 확인했다. RML은 **먼저 쓴 형제가 위에 그려져**(SVG의 반대) 순서를 뒤집고, 회전은 라디안, `LinearAnimation.duration`은 프레임(60fps), `StateTransition.duration`은 ms다. 480px 렌더를 원본 SVG와 비교하면 크게 다른 픽셀이 고양이 0.16%, 강아지 0.17%(가장자리 안티에일리어싱)로 모양·색·선 굵기 차이를 찾지 못했다.
    - **한 프로젝트, 아트보드 둘**: 홈은 두 캐릭터를 늘 같이 보이므로 `.riv` 하나를 받아 아트보드만 골라 쓴다(요청·캐시·버전이 하나, 박자 엇갈림을 한 파일에서 맞춘다). `.riv`는 **11,273바이트**(고양이만 있던 1차 6,356바이트, 동작을 더한 고양이만 7,230바이트).
    - **press 신호는 뷰 모델 트리거**: 뷰 모델 `Character`의 트리거 `press` 하나(두 아트보드가 같은 정의를 쓴다). 상태 머신 입력(`StateMachineTrigger`)은 `rive docs`와 웹 런타임 모두 폐기 예정이라 바꿨다. 웹 런타임은 `new Rive({ artboard, stateMachine: "State Machine 1", autoBind: true })` 후 `rive.viewModelInstance.trigger("press").trigger()`(공식 문서 runtimes/web/data-binding). 이렇게 하면 콘솔에 폐기 경고가 없다. CLI 캡처는 `--data=press=1`로 발동한다. Rive 안에서 클릭을 받는 리스너는 두지 않는다(앱의 카드 누름과 두 번 반응하지 않게). 그래서 **CLI 미리보기 창에서 캐릭터를 눌러도 반응이 없다**(미리보기에는 입력·뷰 모델을 보내는 장치가 없고 포인터는 씬 안의 리스너에만 간다). 직접 눌러 보는 것은 저장소 밖 확인용 페이지(`C:\side\nyanggonggo-review\rive-check`, press 버튼)로 한다.
    - **상태 머신**(아트보드마다): Entry → `greet` → (끝나면) `idle`, AnyState → `press`(트리거) → (끝나면) `idle`. 상태에 `stateName`이 있다. `sleep`은 엎드린 포즈 그림이 없어 넣지 않았고, idle에서 나가는 전환으로 붙일 자리를 주석으로 남겼다(그림 대기). 애니메이션마다 움직이는 속성을 모두 키로 둬서 상태가 바뀔 때 모양이 남지 않는다.
    - **동작**: greet(약 0.75초) 웅크림 → 10px 폴짝 → 공중에서 좌우로 돌아서는 한 바퀴(scaleX 1 → -1 → 1) → 착지 눌림. 평면 360° 회전은 120px 안에서 머리·꼬리가 잘려 쓰지 않았다(모든 프레임이 가장자리에 닿지 않음, 위 여백 최소 고양이 11.5px·강아지 17.5px). 귀는 고양이 쫑긋, 강아지 펄럭. idle은 4~6초에 한 번 깜빡임, 숨쉬기 1.5%, 꼬리 살랑(작고 느리게, 계속), 고양이 리본 가끔. press는 15프레임(250ms): 100ms 동안 웃는 눈·머리 6° 갸웃·바닥 기준 납작, 150ms 복귀(앱은 이동을 늦추지 않는다). 박자 엇갈림: 강아지 greet는 20프레임(약 0.33초) 늦게 시작하고, idle 주기(고양이 5초, 강아지 5.5초)와 깜빡임 시점이 다르다.
    - 앱 런타임은 `@rive-app/canvas-lite` 2.44.0으로 정했다(9절, 웹 런타임 고정 버전과 같은 2.44.0, 패키지만 canvas-lite). 남은 불확실성: sleep 그림, 실제 폰(iOS Safari 등)에서의 동작·발열, Vercel의 `.wasm` 압축, Rive 편집기로 가져왔을 때 그룹·기준점·opacity 0 그룹이 유지되는지, 사람이 보는 움직임의 자연스러움.
48. 고양이 Rive 2단계: 턴어라운드 폴짝 돌기(greet)와 옆으로 눕기(sleep)(2026-10-08). 그림·동작 기준은 `docs/design/characters.md`(디자인 시스템 버전 22, 뷰 6개 × 2). **고양이만 적용, 강아지 아트보드는 그대로**(47의 앞모습 동작). 앱 코드·계약은 바꾸지 않았다(신호는 뷰 모델 트리거 `press` 하나).
    - **1단계 RML 실험(전부 됨)**: 저장소 밖 `C:\side\nyanggonggo-review\turnaround-spike\`에 `rive --screenshot`(480px)과 원본 SVG 렌더를 나란히 저장했다. 숫자는 크게 다른 픽셀 비율(가장자리 안티에일리어싱 수준). 실험 프로젝트 `rive/spike-turnaround`는 커밋하지 않았다.
        - a. 그림 교체(뷰 그룹을 형제로 두고 opacity hold 키로 하나만 보이기): 정면 0.16%, 3/4 0.18%, 옆 0.15%, 뒤 0.11%.
        - b. 정점 보간(옆 → 기우는 중간 → 누움, path 정점·핸들 키): 0f 0.15%, 기우는 중간 0.16%, 누움 0.11%, 중간 프레임 매끄러움. 핸들 거리가 0인 정점은 각도가 의미 없어 이웃 포즈의 각도를 쓰고, 각도는 가까운 쪽으로 감는다(한 바퀴 돌지 않게). 누움의 뒷발은 한 점으로 모여 닫는 점을 합치지 않는 `morph` 모드가 필요했다.
        - c. 그리는 순서 바꾸기(타임라인 안에서 꼬리를 몸 아래 → 위로): `DrawRules`/`DrawTarget`을 tail 그룹에 달고 `drawTargetId`를 `KeyFrameId`로 키. 바꾼 쪽 0.11%, 안 바꾼 대조 1.57%.
        - d. 회전값이 있는 그룹(기우는 중간·누움의 head·tail·bow): 0.16%, 0.10%(SVG와 같은 자리).
        - e. 좌우 반전(x=60 기준 scaleX −1): 정면 0.17%, 옆 0.15%.
    - **변환기 변경(`scripts/svg-to-rml.mjs`)**: 그룹 transform의 `translate(x y) rotate(도)`(라디안으로), 절대 호 `A`, 모프용 옵션(`morph`: 닫는 점을 합치지 않고 정점·타원에 id, `vertexIdBase`), `svgToRml()`이 정점 목록(`parts`)을 함께 돌려준다. 지시서의 "leg-* 안의 -shaft, -paw 그룹"은 실제 SVG에서 그룹이 아니라 path였다(그룹 안의 그룹은 없음). 기존 앞모습 두 장은 이전 변환기와 출력이 줄 단위로 같다(고양이 343줄, 강아지 149줄).
    - **생성기(`scripts/rive-cat-scene.mjs`)**: 모프는 정점마다 키가 수백 개라 손으로 쓰지 않고 이 스크립트가 scene.rml의 `rive-cat:begin/end` 사이(고양이 아트보드)만 다시 쓴다. 그림을 바꾸면 다시 돌리고 `pnpm rive:build`.
    - **구조**: `rig`(바닥 가운데 60,112: 높이·늘림·납작) > `flip`(좌우 반전) > 뷰 다섯(정면, 3/4, 옆, 뒤, 누움=기우는 중간 도형에 정점 id). 상태: Entry → greet → idle →(무입력 10초, exitTime ms) sleepEnter → sleep(반복). press 트리거: greet·idle → press, sleepEnter·sleep → wake(정면 앉음으로 바로 바꾸고 4px 튀어 오름, 250ms). press·wake가 끝나면 idle. 앞 상태가 남긴 값은 다른 애니메이션이 움직이는 속성만 0프레임 기본값으로 지운다.
    - **동작(characters.md 표 × 2.5 = 60fps)**: greet는 고양이 40프레임 대기(강아지 공중 26~46f와 겹치지 않게) 후 움츠림 8f(바닥 기준 0.9, 정면 앞다리 8° 벌림) → 도약·회전 32f(정면 3 → 3/4 5 → 옆 5 → 뒤 7 → 옆 반전 5 → 3/4 반전 5 → 정면 2, 그림은 hold, 높이만 곡선: 오를 때 ease-out, 꼭대기 16px(뒤), 내릴 때 ease-in, 공중 세로 1.08) → 착지 10f(0.9 → 1, 꼬리 한 번 튕김). 귀·꼬리·리본은 몸보다 2프레임 늦게 따라온다. 공중 다리: 옆 앞 −35°·뒤 +35°(스쳐 가는 프레임), 3/4 −30°·+28°. sleepEnter 150f: 졸기 1.5초(눈 세로 40%, 머리 3px 꾸벅 두 번) → 3/4 150ms(머리 2px 숙임) → 기우는 중간 250ms(머리 0 → 10°, 꼬리 0 → −15°, 눈 감음) → 누움 600ms ease-out 정점 보간(꼬리는 몸 뒤로 지나가다 141f에 몸 앞으로 그림). sleep 12초 반복: 숨쉬기 4초(몸 세로 1 → 1.02, 바닥 기준), 머리 1px, 꼬리 ±6° 12초에 한 번, 리본 정지.
    - **확인**: `rive --verify` 0 오류·0 경고. 확인용 페이지(`C:\side\nyanggonggo-review\rive-check\captures\`)에서 실시간 캡처: `cat-greet.png`, `cat-lie-down.png`(11.3~14.9초), `cat-sleep-press.png`(press 후 첫 캡처 +117ms에 이미 정면 앉음, 200ms 이내). 홈 E2E(dev·production 14개) 통과, 움직임 줄이기·다른 화면의 Rive 요청 0건 유지.
    - **`.riv` 크기**: **11,273 → 46,877바이트**(gzip 4,396 → 15,091, brotli 3,718 → 11,942). 늘어난 몫은 뷰 넷의 도형과 누움 모프 키(정점 141개의 위치·핸들, 키마다 ease 보간기)다. 홈에서만 받고 움직임 줄이기면 받지 않는다.
    - **강아지에 적용할 때 예상 차이**: 3/4에서는 다리 셋이 모두 body 위(고양이는 먼 앞다리가 body 아래)라 그리는 순서가 다르다. 귀가 처진 모양이라 따라오기 각도·방향이 다르고, 47의 강아지 greet 지연(20f)과 고양이 대기(40f)를 함께 다시 맞춰야 한다. 정점 수가 기우는 중간·누움에서 맞는지는 변환해서 다시 확인한다.
    - greet(폴짝 뛰며 한 바퀴)는 PRD v1.2에서 폐기. 강아지 놀자 자세·고양이 덮치기로 교체 예정.
## 13. 다음 버전 계획 (기록만, 설계 전)

아직 코드 작업을 하지 않은 항목이다. 다음 기능 작업에서 착수한다.

- ~~최근 선택한 지역을 자동 기억했다가 다음 방문 시 그 지역 목록을 보여 주기~~ **완료(2026-09-29)**: localStorage 대신 쿠키로 구현했다(첫 렌더 깜빡임과 중복 요청을 피하려고). 규칙은 7절.
- 관심 지역을 여러 개 즐겨찾기로 등록해두고 칩 형태로 빠르게 전환할 수 있는 기능
- 둘 다 필요하며, UI와 저장 스키마는 아직 설계 전이다(찜 저장소와 별도 키를 쓸지, URL 기본값과 어떻게 우선순위를 둘지 등이 미정).
