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
Route Handler (app/api/animals)
  → 입력 검증(Zod): species, region, status, sort, cursor
  → AnimalSource.load(species, region)      # (upkind, upr_cd) 단위 전체 수집 + 캐시
  → 서버 Mapper: UpstreamDto → { wire: AnimalWireDto, sortKeys }
  → 필터(status) → 정렬 → 커서 자르기
  → AnimalListResponse { items: AnimalWireDto[], nextCursor: string | null } 응답
```

- 캐시 키: `(upkind, upr_cd | all)`. `state` 파라미터는 **사용하지 않는다**(`notice`/`protect` 의미가 검증되지 않았고 `종료` 값이 없음). status는 서버에서 `processState`로 판정한다.
- status 판정: `processState`가 `종료`로 시작하면 `ended`, 그 외는 `protected`. Zod는 `processState`를 enum이 아니라 `string`으로 받는다. 알 수 없는 값은 dev 로그로 남긴다.
- 정렬 정의: `latest` = `noticeSdt` 내림차순, 동률이면 `updTm` 내림차순. `endingSoon` = `noticeEdt` 오름차순.
- 커서: 정렬된 결과의 offset을 불투명 문자열로 인코딩한다. 캐시 갱신 중 페이지 사이에 중복/누락이 생길 수 있음을 알고 MVP에서 허용한다.
- 상세: 개별 `desertion_no` 조회(캐시는 id별). 찜 목록(`ids`)도 1차는 id별 조회를 병렬로 하고, 조회되지 않는 id는 응답에서 제외한다.
- 캐시 방식(Next 데이터 캐시, `unstable_cache`, 인메모리, 외부 KV)은 **검증 필요**. `AnimalSource` 인터페이스 뒤에 숨겨서 교체 가능하게 만든다. 캐시 저장소에는 항목 크기 제한이 있을 수 있으니 원본이 아니라 Mapper를 거친 가벼운 목록을 저장한다.
- 캐시는 두 겹이다. 서버 재검증 주기와 클라이언트 `staleTime`을 문서 한 곳에 숫자로 정해 둔다. 원칙: 클라이언트 `staleTime`은 서버 재검증 주기보다 길지 않게. 초기값은 스파이크에서 정한다.
- 공공 API 호출에는 `AbortSignal.timeout`을 건다. 실패 시 표준화된 에러를 반환한다.

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

- 서버와 클라이언트 모두 `shared`의 얇은 `httpClient`(네이티브 `fetch` 래퍼)를 쓴다: 타임아웃, HTTP 에러의 예외화, 에러 표준화. Next `fetch`의 `revalidate` 옵션을 그대로 쓸 수 있어야 한다. 구현 디테일이므로 감싸서 교체 가능하게 둔다.
- 환경변수: `DATA_GO_KR_SERVICE_KEY`(서버 전용, `NEXT_PUBLIC_` 금지), `NEXT_PUBLIC_KAKAO_JS_KEY`(도메인 제한이 있는 공개 키라 허용). `.env.local`은 커밋하지 않고 `.env.example`만 커밋한다. 배포 환경은 Vercel 환경변수. GitHub Secrets는 CI에서 실제 API를 호출할 때만 필요하며 MVP에서는 픽스처로 테스트하므로 쓰지 않는다.
- 배포: Vercel Hobby(비상업용 약관 확인). 함수 리전(서울 가능 여부), 실행 시간 제한은 **검증 필요**(12절 스파이크).
- 서비스키가 로그, 테스트, 픽스처, 커밋에 들어가지 않게 한다. 이미 대화에 노출된 키는 재발급한 것으로 가정한다.

## 10. 종료 공고 정책

- 종료 공고(안락사, 자연사 포함)는 status 필터(`ended`, `all`)로 표시한다. 기본은 `protected`.
- D-day 정책(확정): 종료(`ended`) 공고, `noticeEndAt`이 없는 공고, `noticeEndAt`이 오늘(KST)보다 과거인 보호중 공고는 `dDay = null`, 당일은 0. `isSoon`은 `dDay !== null && dDay <= 3`. 종료일이 지난 보호중 공고는 서버에서 제외하지 않고, 배지는 "보호중"만 표시한다(D-day 없음).
- 종료 사유는 UI, WireDto, Domain 어디에도 노출하지 않는다. 종료 카드는 회색 배지 + 사진 채도 소폭 낮춤(`saturate(.7)`).
- 종료 상세의 찜/공유는 활성 상태로 둔다.
- 우선 이 계획대로 구현하고, 이후 관찰한다: 종료 비율(`processState` 값 집계), 종료 카드의 진입률과 공유율(이벤트에 status 포함).
- Mapper는 알 수 없는 `processState` 값을 dev 로그로 남긴다.

## 11. 문서 반영 현황 (PRD, 기능명세서)

`docs/PRD.md`, `docs/기능명세서.md`에 **반영 완료**: 서버 프록시/캐시 MVP 승격, `page` URL 미포함, `status` 기본 `protected`, `region` 시도 코드, 찜 id만 저장, 종료 사유 비노출, 기준 폭 390과 4:5 cover 카드, 토스트 문구 "링크가 복사됐어요", 서버/클라이언트 Domain 분리와 응답 DTO, `pages` → `views`.

명세의 나머지 "결정 필요" 항목(사진 없는 공고, 초기화 버튼, 목록 끝 표시, 카드 내 찜 아이콘)은 미정이다(D-day 지남 정책은 10절에서 결정됨). 이 문서와 문서 간 새 불일치가 생기면 이 절에 적는다.

## 12. 미확정 / 스파이크

각 항목은 추측하지 말고, 해당 단계에서 검증한 뒤 이 절을 갱신한다.

1. `processState`의 실제 값 목록과 비율(고양이 전체 수집 후 집계)
2. JSON 응답의 래퍼 구조와 단일 객체/배열 처리
3. 서버 캐시 방식과 항목 크기 제한, 재검증 주기 값, 서버리스 콜드스타트에서 전체 수집 시 실행 시간
4. Vercel 함수 리전(서울 가능 여부)과 공공 API 응답 속도, 해외 IP 제한 여부
5. `desertion_no`로 조회 시 종료/오래된 공고가 조회되는지
6. 이미지 `http` 처리 방식(원격 도메인 설정 vs 프록시)
7. 카카오 피드 이미지 비율 제한, `next/og`(Satori)의 폰트 형식(woff2 미지원 가능성)과 CSS 변수 미지원 가능성
8. UI 라벨 "보호소": `careNm`이 병원일 수 있어 "보호 장소" 등으로 바꿀지
9. `ageText` 표기 정제(`2024(년생)` → "2살 추정" 등)
10. ~~`noticeEdt`가 지난 protected 공고의 D-day 정책~~ **결정됨**: `dDay = null`, `isSoon = false`, 서버에서 제외하지 않음(10절). 만료된 보호중 공고의 실제 비율은 수집 후 관찰
11. 필터 적용 상태 표시(필터 버튼 점): 미정
12. `upKindNm`이 `고양이`/`개`가 아닌 항목: WireDto `species`는 `cat | dog`뿐이라 서버 Mapper가 `null`을 반환하고 dev 로그를 남긴다(목록에서 제외하는 전제). 캐시 키가 `upkind` 단위라 실제로 섞여 오는지는 수집 후 확인
13. ~~이미지 URL 인코딩의 이중 인코딩~~ **결정됨**: `encodeURI` 대신 `[` `]`만 `%5B` `%5D`로 치환한다(이미 인코딩된 `%`는 유지, 멱등). 파일명에 다른 예약 문자(공백, 한글 등)가 원문 그대로 오는지는 수집 후 확인
14. ~~UpstreamDto 필수 필드 기준~~ **결정됨**: 4절. 실제 수집에서 필수 필드 누락으로 건너뛰는 item 수(`skippedCount`)를 관찰
