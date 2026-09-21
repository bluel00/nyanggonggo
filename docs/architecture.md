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
- 규모(샘플 시점): 고양이 2,481건, 전체 7,249건. `numOfRows=1000`이면 고양이는 3회 호출로 전체 수집이 가능하다.
- 기본 정렬은 `desertionNo` 내림차순으로 보인다(두 샘플에서 확인). 시간순이 아니라 지역 코드순으로 뭉쳐 나온다.
- 응답 아이템 필드(XML 태그명 기준, DTO는 이름 그대로): `desertionNo, happenDt, happenPlace, kindFullNm, upKindCd, upKindNm, kindCd, kindNm, colorCd, age, weight, noticeNo, noticeSdt, noticeEdt, popfile1, popfile2, processState, sexCd, neuterYn, specialMark, careRegNo, careNm, careTel, careAddr, careOwnerNm, orgNm, updTm`. 일부 아이템에만 있는 optional: `vaccinationChk, sfeSoci, sfeHealth, endReason`. 사진은 `popfile1..N`(개수 가변, 없을 수 있음).
- UpstreamDto 필수 필드(확정): 없으면 유효한 WireDto를 만들 수 없는 것만 필수다. `desertionNo`(id, 빈 문자열 불가), `processState`(status), `upKindNm`(species), `noticeEdt`(D-day, `endingSoon` 정렬 키), `orgNm`(`regionText`는 non-null). 나머지는 optional이고 Mapper가 `null`/빈 배열/빈 정렬 키로 처리한다. 파싱은 item 단위 `safeParse`로 하며, 실패한 item은 로그(`desertionNo`, 이슈 경로)를 남기고 건너뛴다.
- 값의 특성(픽스처 `docs/fixtures/upstream-items.json` 참고): 날짜 `YYYYMMDD`, `updTm`은 `YYYY-MM-DD HH:mm:ss.S`, `age`는 `2024(년생)`, `2026(60일미만)(년생)`, `sexCd`는 `M`/`F`/`Q`, `neuterYn`은 `Y`/`N`/`U`, `processState`는 `보호중`, `종료(안락사)`, `종료(자연사)` 등. 사진 URL은 `http://`이고 파일명에 `[1]`이 있을 수 있다. `careNm`은 보호센터가 아니라 동물병원일 수 있다.
- 결과가 1건일 때 `item`이 배열이 아닌 단일 객체로 올 수 있는 패턴이 공공 API에서 흔하다(**검증 필요**). DTO 파싱은 배열/단일 객체를 모두 받아 배열로 정규화한다.
- JSON 응답의 래퍼 구조(`response.body.items.item` 등)는 **검증 필요**. 1단계에서는 item 단위 픽스처만 사용한다.
- 서비스키는 **디코딩된 키**를 환경변수로 두고 `URLSearchParams`가 인코딩하게 한다. 인코딩된 키를 그대로 넣으면 이중 인코딩된다.

## 5. 서버 계층 동작

```
Route Handler (app/api/animals)                       # 얇게: 파싱 → service → 응답 검증 → JSON
  → 입력 검증(Zod, server/animals/query): species, region, status, sort, cursor
  → AnimalService.list (server/animals/service, 순수, 소스 주입)
      → AnimalSource.list(species, uprCd | all)       # (upkind, upr_cd) 단위 전체 수집 + 캐시
          → upstream client: 페이지 순회 → extract → parseUpstreamItems(item 단위 safeParse)
          → 서버 Mapper: UpstreamDto → { wire: AnimalWireDto, sortKeys }
      → 필터(status) → 정렬 → 커서 자르기
  → AnimalListResponse { items: AnimalWireDto[], nextCursor: string | null } 를 Zod로 검증 후 응답
```

구현 위치: `src/shared/api/http-client.ts`, `src/server/{config,logger,mapper}.ts`, `src/server/upstream/{client,extract,parse,dto}.ts`, `src/server/source/*`, `src/server/animals/{service,query,container,errors}.ts`, `src/server/http/respond.ts`, `src/app/api/animals/**`.

- 캐시 키: `(upkind, upr_cd | all)`. `state` 파라미터는 **사용하지 않는다**(`notice`/`protect` 의미가 검증되지 않았고 `종료` 값이 없음). status는 서버에서 `processState`로 판정한다.
- status 판정: `processState`가 `종료`로 시작하면 `ended`, 그 외는 `protected`. Zod는 `processState`를 enum이 아니라 `string`으로 받는다. 알 수 없는 값은 주입된 로거(`logger.warn`, 기본 no-op)로 남긴다.
- status 필터: `protected`(기본), `ended`, `all`(10절).
- 정렬 정의: `latest` = `noticeSdt` 내림차순, 동률이면 `updTm` 내림차순, 그다음 `desertionNo` 내림차순. `endingSoon` = `noticeEdt` 오름차순, 동률이면 `desertionNo` 오름차순. 정렬 키가 없으면 빈 문자열로 둔다. `sortKeys`는 응답에 넣지 않는다.
- 커서: 정렬된 결과의 offset을 base64url로 감싼 불투명 문자열. 잘못된 커서는 400, 범위를 넘으면 빈 목록. 마지막 페이지는 `nextCursor: null`. 캐시 갱신 중 페이지 사이에 중복/누락이 생길 수 있음을 알고 MVP에서 허용한다.
- 상세: 개별 `desertion_no` 조회(캐시는 id별). 찜 목록(`GET /api/animals/by-ids?ids=a,b,c`, 응답 `{ items }`)도 1차는 id별 조회를 병렬(동시성 제한)로 하고, 조회되지 않는 id는 응답에서 제외하며 입력 순서를 유지한다. 중복 id는 한 번만 조회한다. 조회 중 업스트림 오류는 일부만 빼지 않고 요청 전체를 실패(502/504)로 돌려준다(찜이 조용히 사라지지 않게).
- 캐시 방식(Next 데이터 캐시, `unstable_cache`, 인메모리, 외부 KV)은 **검증 필요**. `AnimalSource` 인터페이스 뒤에 숨겨서 교체 가능하게 만든다. 캐시 저장소에는 항목 크기 제한이 있을 수 있으니 원본이 아니라 Mapper를 거친 가벼운 목록을 저장한다.
- 캐시는 두 겹이다. 서버 재검증 주기와 클라이언트 `staleTime`을 문서 한 곳에 숫자로 정해 둔다. 원칙: 클라이언트 `staleTime`은 서버 재검증 주기보다 길지 않게. 초기값은 스파이크에서 정한다.
- 공공 API 호출에는 `AbortSignal.timeout`을 건다. 실패 시 표준화된 에러를 반환한다.
- 오류 응답은 `{ error: { code, message } }`. 입력 오류 400(`invalid_request`), 없음 404(`not_found`), 업스트림 실패 502(`upstream_error`), 타임아웃 504(`upstream_timeout`), 설정 누락/계약 위반/기타 500(`internal_error`). 메시지에 키, URL, 업스트림 본문, 설정 상세를 넣지 않고 상세는 서버 로그에만 남긴다. 오류 응답은 `Cache-Control: no-store`.
- 튜닝 숫자는 `src/server/config.ts`의 `SERVER_TUNING` 한 곳에 둔다(초기값, 12절 스파이크에서 조정):

| 항목 | 값 |
|---|---|
| upstream fetch `revalidate` | 300초 |
| upstream 타임아웃 | 10,000ms |
| `numOfRows` | 1,000 |
| 조합당 최대 페이지 | 20 |
| 목록 페이지 크기 | 20 |
| by-ids 최대 / 동시성 | 50 / 5 |
| 성공 응답 `Cache-Control` | `public, s-maxage=60, stale-while-revalidate=300` |
| 클라이언트 `staleTime` | 미정(TanStack Query 단계). 서버 재검증 주기(300초)보다 길지 않게 |

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

1. `processState`의 실제 값 목록과 비율(고양이 전체 수집 후 집계)
2. JSON 응답의 래퍼 구조와 단일 객체/배열 처리. 현재 가정(`server/upstream/extract.ts`, 추측): `response.header.resultCode`, `response.body.items.item`(배열 또는 단일 객체), `items`가 `""`이거나 `items`/`item`이 없으면 빈 배열, `response.body.totalCount`는 숫자 또는 숫자 문자열. 최상위 `response` 객체가 없으면 업스트림 오류(502)로 본다. **확인 방법**: 로컬에서 실제 호출 1회(결과 여러 건 / 1건 / 0건)로 JSON 원문을 받아 구조를 확인하고 이 항목과 테스트의 합성 래퍼를 갱신
3. 서버 캐시 방식과 항목 크기 제한, 재검증 주기 값, 서버리스 콜드스타트에서 전체 수집 시 실행 시간
   - 현재: upstream 페이지 fetch에 Next `revalidate: 300`(데이터 캐시). 조립은 요청마다 메모리에서 한다. Route Handler는 `request.url`을 읽어 동적이며, 명시적 `revalidate`를 준 fetch가 동적 핸들러에서도 캐시되는지는 실제 로그로 확인 필요
   - 크기 제한은 **코드로 확인됨**(Next 16.3.5 `dist/server/lib/incremental-cache/index.js`): fetch 캐시 항목의 `JSON.stringify(data).length`가 2MB(2 × 1024 × 1024)를 넘으면 캐시하지 않는다(커스텀 cache handler를 쓰면 예외). 응답 본문은 base64로 저장되므로(`patch-fetch.js`) 측정값은 UTF-8 바이트의 약 4/3이다. 픽스처 item은 UTF-8 약 1.0~1.15KB → base64 약 1.3~1.54K자라 `numOfRows=1000` 한 페이지는 약 1.4~1.5MB로 추정된다(픽스처 6건 기준 추정, 실제 응답 미측정). 제한까지 여유가 크지 않다
   - **보안 위험(코드로 확인됨)**: 제한을 넘으면 Next가 `Failed to set Next.js data cache for ${fetchUrl} ...`를 dev에서는 예외로 던지고 prod에서는 `console.warn`으로 남긴다. `fetchUrl`은 쿼리스트링(서비스키)을 포함한 전체 URL이다. 우리 로거는 예상 못 한 오류의 메시지를 남기지 않지만 Next 자체 로그는 막지 못한다. 배포 전에 한 페이지가 2MB를 넘지 않음을 확인하거나 `numOfRows`를 낮춰야 한다
   - **확인 방법**: 로컬에서 고양이 전체(`upkind=422400`, `numOfRows=1000`) 1페이지를 실제로 받아 응답 본문의 UTF-8 바이트 수를 측정하고 × 4/3(base64)이 2,097,152에 가까우면(예: 1.5MB 초과) `numOfRows`를 500 등으로 낮춘다. 콜드스타트 전체 수집 시간은 Vercel 로그에서 측정
4. Vercel 함수 리전(서울 가능 여부)과 공공 API 응답 속도, 해외 IP 제한 여부, 함수 실행 시간 제한(전체 수집 3회 호출 + 타임아웃 10초 × 페이지). **확인 방법**: Vercel 프로젝트 설정의 Functions Region, 배포 후 함수 로그의 실행 시간, 리전별 upstream 응답 시간
5. `desertion_no`로 조회 시 종료/오래된 공고가 조회되는지. 이 파라미터가 무시되고 목록이 오는 경우에 대비해 결과를 id로 한 번 더 거른다. `upkind` 없이 조회해도 되는지도 미검증
6. 이미지 `http` 처리 방식(원격 도메인 설정 vs 프록시)
7. 카카오 피드 이미지 비율 제한, `next/og`(Satori)의 폰트 형식(woff2 미지원 가능성)과 CSS 변수 미지원 가능성
8. UI 라벨 "보호소": `careNm`이 병원일 수 있어 "보호 장소" 등으로 바꿀지
9. `ageText` 표기 정제(`2024(년생)` → "2살 추정" 등)
10. ~~`noticeEdt`가 지난 protected 공고의 D-day 정책~~ **결정됨**: `dDay = null`, `isSoon = false`, 서버에서 제외하지 않음(10절). 만료된 보호중 공고의 실제 비율은 수집 후 관찰
11. 필터 적용 상태 표시(필터 버튼 점): 미정
12. `upKindNm`이 `고양이`/`개`가 아닌 항목: WireDto `species`는 `cat | dog`뿐이라 서버 Mapper가 `null`을 반환하고 로거로 남긴다(목록에서 제외하는 전제). 캐시 키가 `upkind` 단위라 실제로 섞여 오는지는 수집 후 확인
13. ~~이미지 URL 인코딩의 이중 인코딩~~ **결정됨**: `encodeURI` 대신 `[` `]`만 `%5B` `%5D`로 치환한다(이미 인코딩된 `%`는 유지, 멱등). 파일명에 다른 예약 문자(공백, 한글 등)가 원문 그대로 오는지는 수집 후 확인
14. ~~UpstreamDto 필수 필드 기준~~ **결정됨**: 4절. 실제 수집에서 필수 필드 누락으로 건너뛰는 item 수(`skippedCount`)를 관찰
15. `resultCode` 오류 판정: 정상 코드 값이 검증되지 않아 "코드가 있고 공공데이터포털 공통 오류 코드(`01, 02, 04, 05, 10, 11, 12, 20, 22, 30, 31, 32, 33, 99`)일 때만" 오류로 본다. `03`(NODATA)은 빈 결과. 이 목록 자체가 이 API에서 검증되지 않은 추측이다. 인증 오류가 `_type=json`에도 XML로 오는지도 미검증(오면 parse 오류 → 502)
16. `region`(시도 코드 `upr_cd`)과 `id`(`desertionNo`)의 형식: 숫자 문자열(1~32자리)만 검사한다. 실제 코드 목록(`sido_v2`)과 자릿수는 미검증
17. 오프셋 커서의 밀림: 서버 캐시(재검증 300초)가 갱신되는 사이에 페이지를 넘기면 중복/누락이 생길 수 있다. MVP에서 허용
18. `Cache-Control`(`s-maxage=60, stale-while-revalidate=300`) 값은 초기값이며 튜닝 필요. CDN 캐시 키에 쿼리스트링이 포함되는지(Vercel) 확인
19. 최대 페이지 가드(조합당 20페이지 = 20,000건): 넘으면 잘린 목록을 돌려주고 경고 로그를 남긴다. 실제 전체 건수 대비 적정한지 확인
20. by-ids의 id별 upstream 호출: 찜 50개면 캐시 미스 시 최대 50회 호출. 공공 API 일일 트래픽 한도와 호출 간격 제한은 미검증
