# 멍냥공고 아키텍처 결정서

> 이 문서는 PRD, 기능명세서, 디자인 핸드오프보다 **우선**한다. 충돌하면 이 문서를 따르고, 충돌 내용을 보고한다.
> 상태 표기: **확정** = 사용자가 결정, **검증 필요** = 사실 확인이 끝나지 않음(추측 금지, 12절 참고).

## 1. 목적과 범위

유기묘 공고 모바일 웹(MVP). 사진 피드 + 카카오 공유. 서비스 이름은 멍냥공고(옛 이름 냥공고, #64)이며 `SERVICE_NAME` 상수 한 곳에서만 정의한다. 한 줄 소개는 같은 파일의 `SERVICE_TAGLINE`이다(홈 위쪽, 이름 아래).
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
| 종료 공고 | 표시한다(status 필터). 상태 표기는 "종료 · <결과>", 종료 사유는 상세 정보 줄(이슈 [#41](https://github.com/bluel00/nyanggonggo/issues/41)) | 확정 |
| 배포 | Vercel Hobby. GitHub Pages는 서버 기능이 없어 부적합 | 확정 |
| 디자인 방향 | 방향 A "햇살 담요"(2026-10-14). 원칙·글꼴·전환·간격 결정과 구현 계획은 14절 | 확정(구현 전) |

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
- 둘 다 import할 수 있는 것은 `src/contract`와 `shared/ui`를 뺀 `shared`다(지금 서버가 쓰는 것은 `shared/api`의 HTTP 클라이언트와 `shared/lib`의 동시성 헬퍼).
- FSD 계층 방향: `views → widgets → features → entities → shared`. 위에서 아래로만.
- 같은 계층의 다른 slice는 import하지 않는다(`views`·`widgets`·`features`·`entities`, 테스트 파일 포함).
- 다른 slice는 공개 API(slice의 `index.ts`)로만 import한다. `app` 계층도 같다. 테스트 파일은 예외다(slice 내부를 직접 시험한다). `shared`에는 slice가 없어 파일 하나가 공개 API이고 barrel(index)을 두지 않는다: 제목 글꼴 미리 불러오기가 그 모듈을 가져오는 화면(홈, 목록)에만 붙어야 한다.
- 화면 틀(2026-10-20): `shared/ui/screen-shell.tsx`의 `ScreenShell`(헤더 + 본문, `center`면 본문이 화면 전체의 세로 가운데. 2026-10-26부터 세 줄 격자 1fr / 본문 / 1fr로 맞춰 헤더 높이를 따로 적지 않는다, #64)과 `ScreenHeader`(높이 `--header-h` 이상, 위 안전 영역, 왼쪽·오른쪽 자리, `sticky`는 옵션). 헤더 내용은 위젯(목록 `AnimalListHeader`, 찜 `FavoriteListHeader`)과 뷰(홈 서비스 이름·한 줄 소개)가 채우고, 화면 틀에 놓는 것은 뷰다. 제목 글꼴(Jua)은 `shared/ui/display-text.tsx`의 `DisplayText`로만 쓴다. 등장 순서는 뷰가 정하고 `SpeciesChoice`는 시작 번호(`enterFrom`)만 받는다. 정리 전후 화면이 같음을 홈·목록(위·스크롤)·찜(빈 상태·카드·스크롤)·상세(얹은 층·직접 진입) 16장 픽셀 비교(움직임 줄이기, Rive 캔버스 가림, 안전 영역 0과 CDP로 흉내 낸 47/34)로 확인했고, LCP(7회 중앙값, 14.2 0단계 방법)는 홈 788 → 788, 목록 1,460 → 1,496, 상세 588 → 576ms, CLS는 전후 0이다(2026-10-21). 비교 스크립트는 저장소 밖 `nyanggonggo-review/perf-ui/shell-pixels`.
- UI는 Domain(`Animal`)만 소비한다. WireDto나 UpstreamDto를 컴포넌트에서 쓰지 않는다.

## 4. 공공 API 계약

- 서비스: `abandonmentPublicService_v2`, 유기동물 조회 `abandonmentPublic_v2`. 시도 `sido_v2`, 시군구 `sigungu_v2`, 보호소 `shelter_v2`, 품종 `kind_v2`.
- 지역 코드(확정, 2026-09-22 실측, 12.A P11): 시도 `sido_v2`와 시군구 `sigungu_v2`(`upr_cd`로 조회, 페이지 있음)의 항목은 `orgCd`, `orgdownNm`(시군구는 `uprCd` 포함). 앱은 이 결과를 정적 파일 `src/shared/config/regions.ts`(시도 16, 시군구 235. 2026-10-13에 창원시의 빈 코드 2개를 뺐다, 12절 41)로 굳혀 쓰며 **런타임에 두 operation을 호출하지 않는다**. 실제 구가 아닌 항목(코드가 시도 코드와 같음, `ddd99dd` 코드, 이름 없음: 19개)은 제외했다. 목록을 바꾸려면 로컬 프로브를 다시 실행해 파일을 다시 만든다(방법은 파일 상단 주석).
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
  → 입력 검증(Zod, server/animals/query): species, region, status, sex, sort, cursor
  → AnimalService.list (server/animals/service, 순수, 소스 주입)
      → AnimalSource.list(species, uprCd | all)       # (upkind, upr_cd) 단위 전체 수집 + 캐시
          → upstream client: 1페이지(totalCount) → 나머지 페이지 병렬(동시성 3) → extract → parseUpstreamItems(item 단위 safeParse)
          → 서버 Mapper: UpstreamDto → { wire: AnimalWireDto, sortKeys }
      → 필터(status, sex) → 정렬 → 커서 자르기
  → AnimalListResponse { items: AnimalWireDto[], nextCursor: string | null } 를 Zod로 검증 후 응답
```

구현 위치: `src/shared/api/http-client.ts`, `src/shared/lib/concurrency.ts`(서버와 클라이언트 공용 동시성 헬퍼), `src/server/{config,logger,mapper}.ts`, `src/server/upstream/{client,extract,parse,dto}.ts`, `src/server/source/*`, `src/server/animals/{service,query,container,errors}.ts`, `src/server/http/respond.ts`, `src/app/api/animals/**`.

- 캐시 키: `(upkind, upr_cd | all, org_cd | all)`. 요청의 `region`은 `upr_cd`, `district`는 `org_cd`로 보낸다. `district`는 `region`과 함께만 받는다(시군구만 오면 400). 전국(`region` 없음)에는 `upr_cd`/`org_cd`를 보내지 않는다(가짜 코드에 의존하지 않음). `state` 파라미터는 **사용하지 않는다**(`notice`/`protect` 의미가 검증되지 않았고 `종료` 값이 없음). status는 서버에서 `processState`로 판정한다.
- status 판정: `processState`가 `종료`로 시작하면 `ended`, 그 외는 `protected`. Zod는 `processState`를 enum이 아니라 `string`으로 받는다. 알 수 없는 값은 주입된 로거(`logger.warn`, 기본 no-op)로 남긴다.
- status 필터: `protected`(기본), `ended`, `all`(10절).
- sex 필터(확정, 2026-10-23, 이슈 [#20](https://github.com/bluel00/nyanggonggo/issues/20)): `female`, `male`, `all`(기본, 파라미터 없음). 고른 성별만 남기고, 성별 미상(`sexCd`가 `M`/`F`가 아닌 것)은 `all`에서만 나온다. status처럼 서버가 페이지 캐시를 읽은 뒤 메모리에서 거르고 그다음 정렬·커서를 자른다(업스트림 `sex_cd`는 쓰지 않는다). 잘못된 값은 다른 파라미터와 달리 400이 아니라 `all`로 본다.
- 캐시 키와 필터(2026-10-23): 업스트림 페이지 캐시 키는 위 `(upkind, upr_cd, org_cd)`와 페이지뿐이고 status·sex를 넣지 않는다. 둘 다 같은 페이지를 읽은 뒤 거르므로 결과가 같고, 넣으면 같은 페이지를 값마다 따로 받는다. 걸러진 결과를 담는 서버 캐시는 없다. 거른 결과가 갈리는 곳은 CDN(`/api/animals` 응답, 키는 쿼리스트링이라 `sex`가 들어간다. 클라이언트는 전체면 `sex`를 보내지 않아 지금과 같은 주소를 쓴다)과 클라이언트 목록 쿼리 키(`animalKeys.list`, 필터 6종 species·region·district·status·sex·sort)다.
- 정렬 정의: `latest` = `noticeSdt` 내림차순, 동률이면 `updTm` 내림차순, 그다음 `desertionNo` 내림차순. `endingSoon` = 기준 시각(서비스에 주입하는 clock)의 오늘(KST) 기준으로 `noticeEdt`가 지나지 않은 공고(당일 포함)를 `noticeEdt` 오름차순으로 먼저, 지난 공고를 그 뒤에 `noticeEdt` 내림차순으로 둔다. `noticeEdt`가 `YYYYMMDD` 형식이 아니면 맨 뒤. 동률은 `desertionNo` 오름차순. (보호중인데 종료일이 지난 공고가 42.1%라 단순 오름차순이면 임박순 앞쪽이 지난 공고로 채워진다, 12절.) 정렬 키가 없으면 빈 문자열로 둔다. `sortKeys`는 응답에 넣지 않는다.
- 커서(확정, 2026-09-29): **앞 페이지 마지막 항목의 정렬 키**(id, noticeSdt, noticeEdt, updTm)를 base64url로 감싼 불투명 문자열. 다음 페이지는 정렬 순서에서 그 항목보다 뒤에 오는 항목부터다(이분 탐색). 잘못된 커서는 400, 끝을 넘으면 빈 목록, 마지막 페이지는 `nextCursor: null`. 목록은 요청마다 새로 조립하므로 offset을 쓰면 사이에 공고가 하나만 추가되거나 상태가 바뀌어도 경계에서 중복/누락이 생긴다(12절 38)
- 상세: 개별 `desertion_no` 조회(캐시는 id별). 찜 목록(`GET /api/animals/by-ids?ids=a,b,c`, 응답 `{ items, failedIds }`)도 1차는 id별 조회를 병렬(동시성 제한)로 하고, 조회되지 않는 id는 응답에서 제외하며 입력 순서를 유지한다. 중복 id는 한 번만 조회한다. 조회 중 업스트림 오류(`UpstreamError`)가 난 id는 `items`에서 빠지고 `failedIds`에 입력 순서대로 담긴다(찜이 조용히 사라지지 않게 실패를 알린다, 이슈 [#5](https://github.com/bluel00/nyanggonggo/issues/5)). 하나도 불러오지 못했는데 실패가 있으면 지금까지처럼 요청 전체를 실패(첫 오류로 502/504)로 돌려준다. 그 밖의 예외는 요청 전체 실패다. `failedIds`가 있는 응답은 `Cache-Control: no-store`(CDN에 남기지 않아 다시 시도가 같은 실패를 받지 않게)이고 서버 로그에 `by-ids partial failure`(실패 수, 전체 수, 원인 종류. id와 URL 없음)를 남긴다. 클라이언트는 청크 요청이 실패하면 그 청크의 id를 모두 `failedIds`로 보고, 받은 공고가 하나도 없을 때만 오류를 던진다.
- 업스트림 캐시(확정, 2026-10-07): **검증을 통과한 페이지만 캐시한다.** 원본 fetch는 `cache: "no-store"`이고 Next `revalidate`를 걸지 않는다. 업스트림 클라이언트에 주입한 페이지 캐시(`UpstreamPageCache`, 타입은 `src/server/upstream/page-cache.ts`, 서버 구현 `src/server/upstream/next-page-cache.ts` = `unstable_cache`, 재검증 300초)가 "받기 + 검증(래퍼 모양, 오류 코드)"이 성공한 페이지만 저장한다. 오류는 예외라 저장되지 않는다. 이유: 공공데이터포털은 오류(한도 초과 등)를 HTTP 200 본문으로 보내기도 하는데, Next fetch 캐시는 status 200이면 본문과 상관없이 저장해서(`next/dist/server/lib/patch-fetch.js`) 오류 본문이 재검증 주기 동안 정상 응답처럼 재사용될 수 있었다. 캐시 키는 요청 파라미터뿐이고 서비스키가 없다(전에는 fetch 캐시 항목 한도 초과 경고에 서비스키가 든 전체 URL이 찍힐 위험이 있었다, 12절 3). Next 16 문서는 `unstable_cache` 대신 `use cache`를 권하지만 Cache Components를 앱 전체에 켜야 해서 지금은 이 파일 하나에 가둔다. Next 런타임 밖(단위 테스트)에서는 `unstable_cache`를 쓸 수 없어 클라이언트 테스트는 가짜 페이지 캐시를, 라우트 통합 테스트는 통과형 `next/cache`를 쓴다. `AnimalSource` 인터페이스는 그대로 두어 다른 저장소로 바꿀 수 있다.
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
| 클라이언트 `staleTime` | 60초(`src/shared/api/query-client.ts` `QUERY_STALE_TIME_MS`). 서버 재검증 주기(300초)보다 길지 않게, CDN `s-maxage=60`과 맞춤. 재시도 1회(타임아웃/네트워크/5xx만), `refetchOnWindowFocus: false`, `gcTime` 5분(목록만 30분, PRD-v1.4). **목록(무한쿼리)은 재요청을 하지 않는다**(아래) |

- 목록 무한쿼리의 재요청(확정, 2026-09-30): `animalsInfiniteOptions`(`src/entities/animal/api/queries.ts`)에만 `refetchOnMount: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`를 준다. 상세와 by-ids는 기본값 그대로다.
  - 이유: 무한쿼리의 refetch는 쌓인 페이지를 **처음 커서부터 전부 순차로** 다시 받는다. 50페이지를 본 목록으로 돌아오면 `/api/animals`가 51번 나갔다(12절 42). 페이지 수에 비례해 라우트 실행과 지역 전체 조립이 늘고, 목록은 요청마다 새로 조립하므로 복원 직후 결과가 바뀌면 열었던 카드 위치도 밀린다. `staleTime`을 늘리는 것은 이 연쇄를 없애지 못하고 미루기만 한다. focus(공유 후 앱 복귀)와 reconnect도 같은 연쇄를 일으킨다.
  - 신선도 상한은 목록의 `gcTime` **30분**(`LIST_GC_TIME_MS`, PRD-v1.4 R1, 2026-10-14. 그 전에는 다른 쿼리와 같은 5분)이다. 목록을 떠나 30분이 지나면 비활성 쿼리가 캐시에서 사라지고 다음 진입은 첫 페이지부터 새로 받는다. 즉 화면에 남는 목록은 최대 30분 오래된 데이터다. 상세·by-ids는 기본값(`QUERY_GC_TIME_MS`, 5분) 그대로다.
  - 데이터가 없으면(첫 진입, 필터 변경 = 새 쿼리 키, 새로고침) 이 설정과 무관하게 받는다. `gcTime`이 지난 뒤 돌아왔을 때 열었던 카드가 첫 페이지 밖이면 복원은 조용히 맨 위에 둔다(7절 규칙 그대로).
  - 검증: `src/entities/animal/api/queries.test.tsx`(재마운트, 창 포커스, reconnect, 필터 변경, 목록 `gcTime` 30분)와 `e2e/list-refetch.spec.ts`(실제 브라우저, `page.clock.setFixedTime`으로 staleTime 경과).

## 6. 클라이언트 Domain과 Port

WireDto(`src/contract`)는 원시 타입만 쓴다(날짜는 문자열). Domain은 FE 관심사에 맞게 별도 정의한다.

```ts
// entities/animal/model — 명세 5.1 기준
type Animal = {
  id: string
  species: 'cat' | 'dog'
  images: string[]
  status: 'protected' | 'ended'
  endResultText: string | null       // processState "종료(…)" 괄호 안 원문(입양, 자연사…). 값 목록 고정 안 함(이슈 #41)
  noticeEndAt: Date | null
  sex: 'male' | 'female' | 'unknown'
  ageText: string | null             // 1단계는 API 원문 유지, 표기 정제는 미정
  regionText: string                 // orgNm
  shelterName: string | null         // careNm. UI 라벨("보호소")은 미정(12절)
  foundPlaceText: string | null      // happenPlace
  shelterAddressText: string | null  // careAddr. 상세 정보 줄(종료 공고는 숨김, 이슈 #3)
  shelterTelText: string | null      // careTel 원문. 상세 정보 줄(종료 공고는 숨김, 이슈 #3)
  noticePeriodText: string | null    // "MM.DD ~ MM.DD"
  specialMarkText: string | null     // specialMark(특이사항). 상세에서만 노출
  endReasonText: string | null       // endReason(종료 사유) 원문. 상세 정보 줄(이슈 #41)
  kindText: string | null            // 품종 이름(kindFullNm의 "[축종]" 뒤). 기타 축종은 실제 동물
}
```

- 담당자 이름(`careOwnerNm`)은 WireDto와 Domain 어디에도 넣지 않는다. 연락처 값(주소·전화·담당자 이름)은 로그에 남기지 않는다. 종료 사유(`endReason`)는 2026-10-23부터 내보낸다(10절, 이슈 [#41](https://github.com/bluel00/nyanggonggo/issues/41)).
- 보호소 주소(`careAddr`)·전화(`careTel`)는 상세의 정보 줄에 보인다(2026-10-22, 이슈 [#3](https://github.com/bluel00/nyanggonggo/issues/3). PRD 비범위 "보호소 직접 연락"을 대체). 서버 Mapper가 앞뒤 공백만 지워 `shelterAddressText`·`shelterTelText`로 내려준다. 화면 규칙(줄 순서, 종료 공고는 주소·전화 숨김, 지도·전화 링크)은 `entities/animal/ui/detail-rows.ts`의 `detailRows`가 정한다(이슈 [#30](https://github.com/bluel00/nyanggonggo/issues/30)). 링크 주소는 `entities/animal/model/shelter-contact.ts`의 `mapSearchUrl`·`telHref`가 만든다.
  - 정보 줄 순서: 발견 장소 → 보호소 → 주소 → 전화 → 공고 기간 → 종료 사유 → 특이사항(종료 사유는 이슈 #41). 값은 그냥 글자(선택·복사 가능)이고, 값이 없으면 그 줄을 뺀다. 종료 공고는 주소·전화 줄을 숨긴다(보호소 이름은 그대로).
  - 줄 끝의 작은 글자 링크(보조 글자색 + 작은 아이콘, 누르는 영역 44×44px): 주소 [지도]는 카카오맵 검색결과 바로가기 `https://map.kakao.com/link/search/<encodeURIComponent(주소)>`를 새 탭(`rel="noopener"`)으로 연다(카카오 지도 Web API 가이드 "지도 URL" → "지도 검색결과 바로가기". 키·SDK 없음). 전화 [전화]는 숫자만 남긴 `tel:` 링크다(숫자가 없으면 링크 없이 값만). 주소가 길면 줄바꿈하고 링크는 첫 줄 끝에 둔다. 링크가 있는 줄은 위아래 6px를 더해 이웃한 두 링크의 누르는 영역이 겹치지 않는다.
- 파생값은 domain 서비스에서 계산한다: `dDay`(KST 기준, 기준 시각을 주입 가능하게), `isSoon`(D-day 3 이하). 종료 판정은 `processState`가 한다. `dDay`는 `number | null`이며 규칙은 10절을 따른다.
- `species`: `cat | dog | other`. 업스트림 `upKindNm`의 `고양이`/`개`/`기타`를 서버 Mapper가 옮기고, 그 외 값은 항목을 건너뛴다(로그).
- `kindText`(확정, 2026-10-01): `kindFullNm`에서 `[<축종>]` 접두어를 떼고 앞뒤 공백을 지운 값이다. 접두어가 없으면 값 전체를 쓰고, 비어 있거나 품종을 특정할 수 없는 값(`기타`, `기타축종`)이면 `null`이다(4절, 12.A P12).
  - 화면 규칙은 `entities/animal/ui/labels.ts` 한 곳에 있다. `speciesText(animal)`는 축종 자리에 쓸 텍스트로, 고양이/강아지는 라벨이고 **기타는 `kindText`(없으면 "기타 동물")**다. 사진 alt, 카카오 공유 제목, OG 제목이 이 함수를 쓴다.
  - `animalTitle(animal)`은 카드 1줄, 상세 타이틀, OG 이미지 제목이다. 기본은 지역이고 기타 축종만 `"<동물> · <지역>"`으로 어떤 동물인지를 앞에 붙인다(기타 공고의 카드/상세 시안이 없어 임시, 12절 43). 링크 미리보기 제목은 `"<지역> <동물> 공고 | <서비스명>"`이라 `OgModel.region`을 따로 쓴다.
  - `sexAgeText(animal)`은 상세 제목 아래 줄("암컷 · 2024(년생)", 모르면 "성별 미상"·"나이 미상")이다. `animalSummaryText(animal, now)`는 공고 한 줄 요약 "성별 · 나이 · 상태(· D-N) · 특이사항"으로, 카카오 공유 카드 설명과 링크 미리보기 설명(og·twitter)이 같은 문자열을 쓴다(2026-10-22, 이슈 #2). 상태는 배지 문구(종료는 "종료"), 특이사항은 원문 그대로이고 줄바꿈·연속 공백만 공백 하나로 바꾸며 비어 있으면 뺀다. 보호소 이름은 넣지 않는다. 길이는 자르지 않는다: 카카오 문서(메시지 템플릿 공통·기본 템플릿)에 설명의 글자 수 제한은 없고, 2줄(제목과 합쳐 4줄)을 넘으면 줄임표로 보인다.
- 축종별 문구(확정, 2026-10-01): 목록 타이틀, 빈 결과, 조회 실패 문구는 `SPECIES_COPY`(`entities/animal/ui/labels.ts`)에 축종별 **문장 그대로** 둔다. 라벨 + 템플릿(`${label}가 없어요`)으로 만들면 조사가 틀어진다("기타 동물가"). 축종이 섞이는 화면(찜 목록)과 축종을 모르는 화면(상세 조회 실패)은 `ANIMAL_COPY`의 축종 중립 문구를 쓴다(명세 4.5.2의 "고양이" 문구를 "공고"로 바꿨다).
- `sexCd`: `M`→male, `F`→female, 그 외(`Q` 포함)→unknown.
- 이미지: `popfile1..N` 중 존재하는 것만 배열로. 파일명의 `[` `]`는 인코딩한다. `http`→`https` 처리는 별도 단계(`next/image` 원격 도메인 설정 또는 이미지 프록시)에서 다룬다.

```ts
// Port — entities/animal
interface AnimalRepository {
  getAnimals(params: { species; region?; district?; status; sex; sort; cursor? }): Promise<AnimalPage> // { items: Animal[]; nextCursor: string | null }
  getAnimalById(id: string): Promise<Animal>
  getAnimalsByIds(ids: string[]): Promise<Animal[]>
}
```

어댑터(`infrastructure`)는 `httpClient`로 자체 `/api/**`를 호출하고, WireDto를 Zod로 검증한 뒤 클라이언트 Mapper로 Domain을 반환한다.

## 7. 상태 분류

| 종류 | 담당 | 규칙 |
|---|---|---|
| 서버 상태(목록, 상세, 찜 목록) | TanStack Query (`useInfiniteQuery` 등) | 다른 저장소나 `useState`로 복사 금지. 가공은 `select` 또는 렌더 시 파생 |
| 필터/정렬 | URL search params | `species`(`cat` \| `dog` \| `other`), `region`, `district`, `status`, `sex`(`female` \| `male`, 없으면 전체), `sort`만. 기본 `status=protected`, 성별 전체, `sort=latest`. 모르는 값은 기본값으로 본다. `species`의 기본값(`cat`)은 **파서 안전망일 뿐**이고, 목록 진입 판정은 축종이 없으면 홈으로 보낸다(아래). **`page`는 URL에 넣지 않는다**(내부 커서). 구현 규칙은 아래 |
| 찜 목록 | localStorage + 작은 훅 | id 배열만 저장. 읽을 때 Zod로 검증 |
| 일시적 UI(필터 시트 draft, 뷰어 index, 토스트) | 컴포넌트 로컬 state | 시트 draft는 [적용하기]에서만 URL 반영, 닫히면 버림 |

- 전역 스토어(Redux, Zustand, Recoil 등)를 도입하지 않는다.
- URL 필터 구현 규칙(`features/animal-filter/model/filter.ts`, 확정):
  - 읽기: `app/page.tsx`(서버 컴포넌트)가 searchParams를 파싱해 `views/animal-list`에 넘긴다. 없거나 잘못된 값은 기본값으로 본다(화면은 깨지지 않고, API는 400을 유지).
  - 쓰기: **축종과 지역은 기본값이어도 늘 쓰고**(기억 대상이라서, 아래) 나머지는 기본값과 다를 때만 넣는다. 기본 상태의 목록 주소는 `/?species=cat&region=6110000`이다. 같은 필터는 같은 URL, 같은 쿼리 키. `page`/`cursor`는 적용 시 지우고, 필터와 무관한 파라미터(예: `utm_*`)는 보존한다.
  - 적용은 `router.replace`(히스토리를 쌓지 않음, `scroll: false`). URL이 바뀌면 서버 컴포넌트가 새 searchParams로 다시 렌더되고 목록 위젯이 내부 스크롤을 맨 위로 올린다.
  - 필터 시트의 `useState`는 열림 여부와 [적용하기] 전 draft만. 열 때 현재 URL 값으로 채우고 닫으면 버린다.
- 상세 열기와 뒤로가기(확정, 2026-10-20, PRD-v1.5. 이전: 2026-09-29 카드 id 복원, 2026-10-20 픽셀 복원, 12절 37): 목록(`/`)·찜(`/favorites`)에서 카드를 누르면 상세를 **지금 화면 위에 얹는다**. 아래 화면은 내려가지 않아 로드된 페이지·스크롤 위치·디코드된 사진이 그대로이고, 뒤로가기는 층만 걷어 낸다. 돌아올 때 되돌릴 것이 없어 스크롤 복원 코드는 없다(R6). 규칙:
  - 구조(Next intercepting + parallel routes): 루트 레이아웃의 병렬 슬롯 `@modal`을 `AppShell`의 `stack`(스크롤 영역의 형제)에 그린다. `app/@modal/(.)animals/[id]`가 앱 안에서 `/animals/{id}`로 가는 이동을 가로챈다. 그 layout이 `StackLayer`(`shared/ui/stack-layer.tsx`)를 두르고, loading·page는 상세 전체 페이지(`app/animals/[id]`)의 것을 그대로 다시 내보낸다(메타데이터 포함, 탭 제목이 바뀐다). `@modal/default.tsx`는 비어 있고, `@modal/page.tsx`·`@modal/[...catchAll]/page.tsx`(비어 있음)는 층을 띄운 채 앱 안에서 다른 화면으로 가면 층을 걷는다(없으면 슬롯이 이전 상태를 그대로 둔다).
  - 직접 진입·새로고침·공유 링크는 가로채지 않아 상세 전체 페이지다(PRD-v1.4 R2 그대로). 얹은 상세에서 새로고침한 뒤 뒤로가기는 목록을 처음부터 부른다(위치 보장 없음, PRD-v1.5 R2).
  - 층(`StackLayer`): 컬럼 기준 `absolute`로 컬럼을 덮고 자기 스크롤 영역(`stack-layer-scroll`)을 가진다. 아래 스크롤 컨테이너에는 `inert`만 건다(누름·초점 막음, 층이 덮어 스크롤도 받지 않음). layout effect에서 걸고 그 정리 함수에서 풀어, 층이 붙고 빠지는 커밋과 같은 순간이다(R4: 층이 사라진 첫 프레임부터 스크롤·터치). `overflow`는 바꾸지 않는다: 시험판은 `overflow: hidden`으로 막았는데 돌아온 직후 잠깐 스크롤이 안 되고 아래 사진이 잘려 보였다(EL 실기기, 스크롤 영역이 다시 만들어지는 동안으로 본다).
  - 당김(R3): 층 스크롤은 `overscroll-behavior-y: contain`이고 내용을 1px 더 길게 해 상세가 짧아도 늘 스크롤되는 영역이다(스크롤되지 않는 요소에는 overscroll-behavior가 먹지 않아 당김이 문서로 넘어간다). 층이 있는 동안 `html`의 `overscroll-behavior-y`를 `none`으로 둔다(globals.css `:has`). 목록 화면은 브라우저 기본 그대로. 실제 당겨서 새로고침이 막히는지는 실기기에서 본다.
  - 상세(뼈대 포함)는 늘 새 층이나 새 문서에서 시작해 진입 때 스크롤을 맨 위로 올리지 않는다.
  - 뒤로가기 버튼은 그대로 `useGoBack`(목록을 거쳐 왔으면 `router.back()` = `history.back()`, 아니면 `/`).
  - 접근성(2026-10-20): 층은 모달 대화상자(`role="dialog"`, `aria-modal`)이고 이름은 상세 제목(`aria-labelledby`, 뼈대일 때는 `aria-label` "공고 상세"). 열리면 초점을 상세 제목(`tabIndex={-1}`, Tab 순서 밖)으로, 제목이 아직 없으면 뒤로가기로 옮기고, 로딩 화면이 상세로 바뀌며 초점을 잃으면 다시 옮긴다. 닫히면(뒤로가기 버튼·브라우저·Esc) 누른 카드로 되돌린다(스크롤 없이). Esc는 `router.back()`으로 닫는다(사진 크게 보기 같은 다른 대화상자가 열려 있으면 그쪽이 닫힌다). 아래 화면은 `inert`라 화면 읽기 도구·Tab에서 빠진다(Chromium 접근성 트리로 확인). 제목의 초점 테두리는 키보드로 연 층(`data-opened-by="keyboard"`, 연 카드가 `:focus-visible`)에서 `:focus-visible`일 때만 그린다: WebKit은 초점이 없던 상태에서 스크립트로 옮긴 초점을 `:focus-visible`로 보아 터치로 열어도 테두리가 그려졌다.
  - 아래 화면은 계속 그려진 채 남는다(메모리·합성 비용). `content-visibility` 등으로 숨기지 않는다: 사파리가 디코드한 사진을 버리면 깜빡임이 돌아올 수 있다.
  - **목록에서 나가는 `next/link`는 `scroll={false}`로 둔다**(카드, 찜 목록). 기본값이면 Next가 이동 직후 `scrollIntoView`로 우리 내부 스크롤 컨테이너를 건드린다. 새 화면은 각자 `scrollAppToTop()`으로 맨 위에서 시작한다.
  - 검증은 실제 브라우저로 한다: `pnpm e2e`(Playwright/Chromium, 상세에서 뒤로가기 `back-nav.spec.ts`와 상세 층 `stack-nav.spec.ts`는 WebKit도, `e2e/`). E2E 서버 셋(개발 3000, production 3100·3101)은 모두 스텁(`e2e/upstream-stub.mjs`: 고정 공고 개·세종 120건, 고양이·서울 30건, 기타·전국 20건, 오늘 기준 날짜)으로 띄워 실제 공공 API를 부르지 않는다(스텁이 다른 호스트를 막는다, 2026-10-20). 목록 API 응답은 대개 `page.route`로 고정하고, 상세(서버 렌더)는 스텁의 공고다. 실제 API의 응답 형식은 `pnpm e2e:live`(`playwright.live.config.ts`, `e2e/live`: 목록 두 페이지·상세 하나를 서버와 같은 업스트림 클라이언트로 받아 도착 검증·매핑·필수 필드 확인, 공공 API 호출 3번)가 따로 본다. jsdom에는 레이아웃이 없어 스크롤을 검증할 수 없다. 상세에서 뒤로가기의 완료 기준(PRD-v1.4: 5페이지까지 내린 목록, 새로고침 뒤 뒤로가기, 공유 진입, 쿠키 불변. PRD-v1.5: 같은 요소·같은 위치, 층이 사라진 첫 프레임부터 스크롤·터치, 얹은 동안 막힘, 찜에서 얹기)은 `e2e/back-nav.spec.ts`·`e2e/stack-nav.spec.ts`가 production 빌드(스텁, 포트 3101)로 본다.
- 상세 로딩(확정, 2026-10-07): 카드를 누르면 상세가 뜨기까지(서버의 공고 조회, 지난 측정 0.5~0.9초) 화면이 그대로여서 사용자가 여러 번 눌렀다. 두 가지로 바로 반응한다:
  - 카드 누름 피드백: `AnimalCard` 링크에 카드 누름(100ms, scale .98)이 있었다. 홈 카드와 같게 `motion-safe:`로 바꿔 reduced-motion이면 줄지 않는다. 찜 하트는 링크의 형제라(링크 안에 버튼을 두지 않는다) 하트를 누를 때 카드는 줄지 않는다(브라우저에서 하트 누름 중 카드 scale `none` 확인).
  - 라우트 로딩 경계 `app/animals/[id]/loading.tsx` → `views/animal-detail`의 `AnimalDetailLoadingView` → `widgets/animal-detail`의 `AnimalDetailSkeleton`. 같은 뼈대를 상세 위젯의 조회 대기(`useAnimal` pending)도 쓴다. 뼈대는 실제 상세와 같은 구조·치수다(사진 칸 + 캐러셀 점 줄 자리, 사진 위 Back 버튼, 상태 줄 28 · 제목 28 · 성별/나이 20 · 정보 줄, sticky 하단 CTA 바). production에서 뼈대와 실제 상세의 상태 줄·제목·정보·CTA 위치가 같았다(390×844, 레이아웃 이동 0). 상태 줄은 D-day 유무와 상관없이 28px(`h-7`)로 고정해 D-day가 없는 공고(종료, 만료된 보호중)에서도 같다(전에는 24라 그 아래가 4px 올라갔다. 2026-10-07 보호중·종료 공고 모두 이동 0 확인). 사진 칸은 2026-10-08부터 첫 사진 비율이라(12절 50) 라우트 로딩 경계의 뼈대는 크기를 모를 때의 칸인 1:1이다. 실제 상세의 칸이 1:1이 아니면 뼈대가 실제 상세로 바뀔 때 사진 아래가 그 높이 차이만큼 움직인다(뼈대가 통째로 바뀌는 것이라, 상세에 바로 들어온 첫 방문에서 layout-shift 합계는 0~0.0009로 측정됐다)
  - 뼈대의 Back 버튼은 실제 상세와 같다(PRD-v1.4 R2, 2026-10-14): 목록을 거쳐 왔으면 `router.back()`, 아니면 `/`. 갈 곳이 공고와 상관없어 바로 들어온 첫 화면에도 늘 보인다. `href="/"` 링크로 그린다: 바로 들어와 상세가 아직 오지 않은 동안 뼈대는 끝나지 않은 Suspense 경계의 대체 화면이라 React가 하이드레이션하지 않고 onClick이 붙지 않는다(실측: 그때 누른 것은 사라졌다). 링크면 브라우저가 `/`로 가고, 하이드레이션된 뒤에는 onClick(`useGoBack`)이 대신한다. 예외: 목록에서 온 탭이 상세에서 새로고침해 뼈대가 떠 있는 동안 누르면 원래 목록이 아니라 `/`로 간다. E2E `back-nav.spec.ts`(스텁이 조회를 8초 늦춰 뼈대를 붙잡음)
  - 뼈대와 실제 상세는 새 층이나 새 문서에서 시작해 진입 때 스크롤을 건드리지 않는다(PRD-v1.5, 이전에는 `scrollAppToTop()`으로 맨 위로 올렸다). 공유 링크 직접 진입, 상세 조회 실패 화면은 그대로다. 잘못된 id의 `notFound()`는 로딩 경계 안에서 그대로 404다
  - **로딩 경계와 prefetch**: 경계가 생기면 `next/link`의 자동 prefetch는 경계까지만 받고 페이지 본문(서버의 공고 조회)은 누를 때 받는다. 카드를 누른 즉시 뼈대가 보이는 것도 이 prefetch로 받아 둔 경계 덕분이라 **production에서만** 확인된다(개발 서버는 prefetch하지 않는다). 그래서 E2E `e2e/detail-loading.spec.ts`는 production 빌드(포트 3100, `playwright.config.ts`의 `production` 프로젝트)에서 돈다. 측정은 12절 45
  - 뼈대는 움직이지 않는다(README Motion: 카드 누름·시트·토스트 외에는 움직이지 않음)
- 사진 우선순위(확정, 2026-10-07): `fetchpriority="high"`는 **화면당 한 장**, 목록 첫 카드 사진(`AnimalList` index 0)과 상세 캐러셀 첫 장에만 준다(`AnimalPhoto`의 `highPriority`, eager 포함). 남용하면 서로 대역폭을 다툰다. 나머지는 그대로다: 목록 앞 2장 eager, 그 뒤 lazy, 상세 둘째 장부터 lazy, 모두 `decoding="async"`
- 상세의 뒤로가기(확정, 2026-09-29. PRD-v1.4로 바뀜, 2026-10-14):
  - 이 탭에서 목록 화면(목록, 찜 목록)을 거쳤으면 `router.back()`. 필터가 붙은 목록 URL과 스크롤 위치가 그대로 살아난다(12절 32). 거쳤다는 표시는 sessionStorage(`nyanggonggo:visited-list`, `shared/lib/app-navigation.ts`)라 **같은 탭의 새로고침에도 남는다**(R1). 그래서 상세에서 새로고침하거나 카카오톡 공유를 다녀오며 탭이 다시 불러와져도 화면 안 뒤로가기는 원래 목록 주소(쿼리 포함)로 간다. 이때 목록은 캐시가 없어 1페이지부터 다시 받을 수 있다(보던 자리는 보장하지 않음, PRD-v1.4 R1·5절). 새 탭이면 표시가 없다.
  - 목록을 거치지 않고 상세를 열었으면(공유 링크, 북마크) `/`로 `push`한다(R2). `/`의 진입 판정(아래)대로 처음 온 사람(축종 쿠키 없음)은 홈, 쓰던 사람은 기억된 축종·지역 목록의 맨 위다. 공유 진입과 그 뒤로가기는 기억(쿠키)을 쓰지 않는다.
  - 쌓인 페이지는 목록 `gcTime` 30분 동안 앱 메모리에 남는다(5절). 그 안에 돌아오면 다시 받지 않고, 스켈레톤 없이, 열었던 카드가 화면 안에 보인다(`e2e/back-nav.spec.ts`, 5페이지까지 내린 목록).
- ~~공유 진입 뒤로가기의 "그 공고가 들어 있는 목록"(`animalListFilter`·`animalListHref`)과 목록의 `focus` 처리~~: PRD-v1.4로 대체(삭제, 2026-10-14). 코드(`from-animal.ts`, 목록의 focus 훅)와 테스트(`focus.spec.ts` 등)도 지웠다.
- 지역(확정, 2026-09-22): URL의 `region`은 시도 코드(`upr_cd`), `district`는 시군구 코드(`org_cd`, 선택). 라벨은 정적 목록(`src/shared/config/regions.ts`)에서 매핑한다. 필터 시트는 시도 → 시군구 2단계 select이며 시도를 바꾸면 시군구는 "전체"로 돌아간다.
  - **기본 지역은 서울특별시 전체**(`region=6110000`, `district` 없음). URL에 `region`이 없을 때만 적용한다. 2026-09-22에는 서울/종로구였지만, 종로구 고양이 보호중 공고가 5~6건뿐이라 첫 화면이 휑하다는 피드백으로 2026-09-28에 시도 단위로 넓혔다(12절 27). 시군구는 사용자가 고를 때만 URL에 붙는다.
  - 전국은 `region=all`로 URL에 남긴다(생략하면 기본 지역이 되므로). `region`만 있으면 그 시도 전체. 목록에 없는 `region`(옛 코드 등)은 기본 지역, 그 시도에 없는 `district`는 버린다.
  - **지역은 기본값이어도 URL에 늘 쓴다**(확정, 2026-09-29). 지역이 없는 `/`는 "기억된 지역"을 뜻하게 됐기 때문에, 앱이 만드는 목록 주소(필터 적용, 홈 선택)가 지역을 생략하면 뒤로가기·새로고침·공유 링크가 그 사이에 바뀐 기억에 흔들린다. **축종도 기억 대상이 되면서 같은 규칙을 쓴다**(확정, 2026-10-02, PRD-v1.1 4절). `status`/`sort`는 기억 대상이 아니라 URL과 기본값이 항상 같으므로 그대로 생략한다. `sex`도 같다(전체면 생략).
  - **지역 없이 들어온 주소도 예외로 두지 않는다**: `app/page.tsx`가 쓸 수 있는 `region`이 없으면(없거나 모르는 코드) 기억된 지역(없으면 기본 지역)을 채워 `redirect`한다. `utm_*` 같은 다른 파라미터는 그대로 옮긴다. 채운 주소에는 지역이 있으므로 다시 리다이렉트하지 않는다(루프 없음, 실측 307 1회).

- 성별(확정, 2026-10-23, 이슈 [#20](https://github.com/bluel00/nyanggonggo/issues/20)): 필터 시트의 "성별" 칩 묶음(전체 / 암컷 / 수컷, 보호 상태와 같은 `Chip` 묶음)으로 고른다. **쿠키에 기억하지 않는다**: 적용하기는 지금처럼 지역·축종만 기억하고(`useApplyAnimalFilter`), 성별은 URL(`sex`)에만 있다. 그래서 뒤로가기(얹은 상세를 걷어 냄)와 목록 링크 공유에서는 유지되고, 쿼리 없이 새로 들어오면(`/`, 홈 선택, 공유 상세의 뒤로가기) 전체로 시작한다. 목록 위 필터 요약은 없다(handoff 화면 1~2 "필터 적용 여부를 표시할지는 미정"). 성별을 고른 상태면 헤더의 [필터] 버튼을 칩의 선택 모양(`data-selected`)으로 보이고 이름을 "필터, 암컷"처럼 바꾼다. 버튼은 토글이 아니라 `aria-pressed`는 두지 않는다. 보호 상태·성별 묶음에 모두 "전체"가 있어 각 묶음을 이름 있는 `role="group"`으로 둔다. 찜·상세·홈 축종 선택은 바꾸지 않았다.
- 목록 진입 판정(확정, 2026-10-02, PRD-v1.1 4절): `/`로 들어왔을 때 할 일은 순수 함수 `resolveAnimalListEntry`(`features/animal-filter/model/entry.ts`)가 정한다. 입력은 searchParams와 기억 쿠키 둘, 출력은 "이 필터로 그린다" 또는 "이 주소로 리다이렉트한다"다. `app/page.tsx`는 쿠키를 읽어 넘기고 결과를 따르기만 한다(얇게).
  - **축종을 먼저 본다**: URL의 `species` → 축종 쿠키 → 둘 다 없으면 홈(`/home`). 홈으로 보낼 때는 **지역을 판정하지 않는다**(지역은 홈이 다시 정한다).
  - 모르는 `species` 값(`panda`)은 "없음"으로 본다(지역의 모르는 코드와 같은 취급). 그 값은 버리고 옮기지 않는다.
  - 채울 값이 축종·지역 둘이어도 **리다이렉트는 한 번**이다(307을 두 번 내지 않는다). 채운 주소에는 둘 다 있으므로 다시 리다이렉트하지 않는다(루프 없음).
  - `utm_*` 같은 다른 파라미터는 어느 쪽으로 가든 옮긴다(`/home`으로 갈 때도). `page`/`cursor`는 버린다.
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
  - **저장은 사용자가 필터 UI에서 적용할 때만 한다**(`useApplyAnimalFilter`). 공유 링크로 들어온 상세와 그 뒤로가기(`/`로 간다, PRD-v1.4 R2)나 지역이 붙은 링크로 들어온 경우는 이 경로를 타지 않아 기억이 바뀌지 않는다. 남이 공유한 부산 공고를 봤다고 내 기본 지역이 부산이 되면 안 된다. 사용자가 서울 전체를 직접 고르면 서울을 기억한다(지우는 게 아니다).
  - 뒤로가기로 돌아온 목록은 떠날 때 보던 목록과 같아야 한다. 앱이 만드는 주소에 지역이 늘 들어 있어서(위) 기억이 끼어들지 않는다(focus 관련은 PRD-v1.4로 대체).

- 마지막으로 고른 축종 기억(확정, 2026-10-02, PRD-v1.1 3절 8)):
  - 쿠키 `nyanggonggo.species`, 값은 축종 코드 하나다(`cat` | `dog` | `other`). 쿠키를 쓰는 이유와 속성(`path=/`, `SameSite=Lax`, 1년)은 지역과 같고, 공통 부분은 `features/animal-filter/model/filter-cookie.ts`에 있다.
  - **저장은 사용자가 직접 고를 때만 한다**: 필터 시트 적용(`useApplyAnimalFilter`)과 홈의 선택(`SpeciesChoice`), 두 곳뿐이다. 공유 링크로 들어온 상세와 그 뒤로가기(`/`로 간다, PRD-v1.4 R2)는 이 경로를 타지 않아 기억이 바뀌지 않는다. 남이 공유한 강아지 공고를 봤다고 내 기본 축종이 강아지가 되면 안 된다.
  - 모르는 값은 조용히 무시한다(기억이 없는 것으로 보고 홈으로 간다, `features/animal-filter/model/species-cookie.ts`).
  - 지역과 다른 점: 기억이 없을 때 기본값으로 채우지 않고 **홈으로 보낸다**. 지역은 "서울 전체"라는 무해한 기본값이 있지만, 축종은 무엇을 보여 줄지가 화면 전체를 좌우한다(기타 2.3%, 개 63%, 고양이 35%, 12.A P12).
  - 검증: `features/animal-filter/model/{entry,species-cookie}.test.ts`(판정 표와 쿠키), `tests/app/{list-page,home-page}.test.tsx`(페이지가 쿠키를 읽어 넘기는지), `e2e/species-home.spec.ts`(실제 브라우저에서 쿠키와 리다이렉트가 맞물리는지).

## 8. 찜

- localStorage에는 animal id 배열만 저장한다(확정: 스냅샷 저장 안 함, 진실은 서버 하나).
- `/favorites` 진입 시 `getAnimalsByIds`로 조회한다. 조회되지 않는 id는 화면에서 제외하고 저장은 유지한다(관찰 후 결정).
- 일부 실패(확정, 2026-10-22, 이슈 [#5](https://github.com/bluel00/nyanggonggo/issues/5)): 일부 공고만 오류로 받지 못하면 받은 카드는 그대로 두고 목록 위에 한 줄 "일부 공고를 불러오지 못했어요"와 [다시 시도]를 보인다. [다시 시도]는 실패한 id만 다시 받아 같은 by-ids 쿼리 캐시에 저장 순서대로 합친다(`useRetryFailedAnimals`, `src/entities/animal/api/queries.ts`). 또 실패하면 카드와 줄을 그대로 둔다. 전부 실패하면 지금의 오류 화면이다. 실패한 id는 찜 저장소에서 지우지 않는다. 못 찾은 id(사라진 공고)는 위대로 조용히 빠진다. 한 줄의 모양은 디자인 시안이 없어 문구 + 텍스트 버튼으로 두었다.
- 구현(확정, 단계 4~6): `features/animal-favorite`. 키 `nyanggonggo:favorites`, 읽을 때 Zod(숫자 문자열 id 배열)로 검증하고 깨진 값은 빈 배열로 본다(다음 쓰기에서 덮는다). 같은 id는 한 번만, 순서는 최근에 찜한 것이 앞. `useSyncExternalStore`로 카드와 상세가 같은 상태를 쓰고 다른 탭의 변경(`storage` 이벤트)도 반영한다. 토글하면 토스트("찜에 저장했어요" / "찜을 해제했어요").
- 카드에 찜 하트를 둔다(확정, 명세 4.1.3의 결정 필요 항목). 사진 우상단, 링크와 형제 요소로 두어 카드 이동과 겹치지 않는다. 모양은 사진 위 overlay 버튼(photo-pill)을 따랐다(디자인 시안 없음).
- `/favorites`: 목록과 같은 카드, 빈 상태는 "아직 찜한 공고가 없어요" / "마음에 드는 공고를 저장해보세요 🐾"(PRD v1.1 3절 2의 축종 중립 문구, 앱과 같음. 🐾는 디자인 README가 허용한 유일한 이모지). 목록 헤더의 하트 버튼이 유일한 진입 경로다(handoff).

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
- 공유(확정, 단계 4~6, `features/animal-share`): 키가 있을 때만 `next/script`로 카카오 SDK(2.8.3, integrity sha384, 12절 29)를 불러오고 `Kakao.init` 후 feed 템플릿(상세 링크, 제목 "지역 + 축종", 설명은 공고 한 줄 요약 `animalSummaryText`(성별 · 나이 · 상태 · 특이사항, 링크 미리보기 설명과 같다), 썸네일은 대표 사진의 이미지 프록시 절대 URL, 없으면 OG 이미지)으로 공유한다. 키 없음, SDK 미로드, init 실패, `Share` 미지원, `sendDefault` 예외는 링크 복사 + "링크가 복사됐어요"(handoff 문구)로 폴백하고, 복사까지 실패하면 "공유에 실패했어요. 링크로 대신 공유해보세요"(명세 7.3).
- OG 이미지(확정, 단계 4~6): `app/animals/[id]/opengraph-image.tsx`(next/og, 1200x630, handoff 화면 7). 원본 사진은 서버가 직접 받아 data URL로 넣는다(이미지 프록시 미경유, 허용 원본만, 5MB 이하). 조회나 사진이 실패해도 오류 대신 사진 없는 카드 또는 서비스명만 있는 기본 이미지를 그린다. 캐시는 1시간(`revalidate = 3600`, `SERVER_TUNING.ogImageCacheControl`): D-day가 KST 자정에 바뀌므로 하루보다 짧게, 렌더 비용 때문에 1시간. satori는 CSS 변수를 지원하지 않아 토큰 hex 값을 `og-model.ts`에 옮겨 쓴다.
- OG 폰트(확정): `pretendard` 패키지가 정적 단일 weight otf(`dist/public/static/Pretendard-Regular.otf`, `-Bold.otf`)를 함께 배포하므로 `node_modules`에서 그대로 읽는다. **저장소에 폰트 파일을 추가하지 않았다**(예외 파일 불필요). satori는 woff2를 읽지 못해 가변 woff2(dynamic subset)는 쓸 수 없다. 배포 번들 포함은 `next.config.ts`의 `outputFileTracingIncludes`로 명시했고, 경로를 정적 문자열로 적어 추적 범위를 두 파일로 한정했다(변수 경로는 프로젝트 전체를 추적 대상으로 만든다는 Turbopack 경고가 있었다). 읽기에 실패하면 satori 기본 폰트로 조용히 대체되며, 이때 한글이 빈 칸으로 보일 수 있다(12절 30).
- 토스트(확정): sonner를 480px 컬럼 안(AppShell의 overlay 자리)에 `position: absolute`로 둔다. 하단 CTA(`data-slot="bottom-cta"`)가 있는 화면은 CSS `:has()`로 토스트를 CTA 위로 올린다. 다크 모드용 `next-themes`는 제거했다.
- 풀스크린 뷰어(확정): 컬럼에 포털하고 컬럼 전체를 absolute로 덮는다(PC에서도 컬럼 안, handoff 화면 8c). 스와이프로 닫기와 핀치줌은 만들지 않는다(명세 후순위). FSD 같은 레이어 import를 피하려고 handoff의 `widgets/image-viewer` 대신 상세 위젯 slice 안에 둔다.

## 10. 종료 공고 정책

- 종료 공고(안락사, 자연사 포함)는 status 필터(`ended`, `all`)로 표시한다. 기본은 `protected`.
- D-day 정책(확정): 종료(`ended`) 공고, `noticeEndAt`이 없는 공고, `noticeEndAt`이 오늘(KST)보다 과거인 보호중 공고는 `dDay = null`, 당일은 0. `isSoon`은 `dDay !== null && dDay <= 3`. 종료일이 지난 보호중 공고는 서버에서 제외하지 않고, 배지는 "보호중"만 표시한다(D-day 없음).
- 종료 결과와 종료 사유를 보여 준다(2026-10-23, 이슈 [#41](https://github.com/bluel00/nyanggonggo/issues/41). 이전 결정 "종료 사유 비노출"을 대체한다).
  - 결과: 서버 Mapper가 `processState`의 "종료(…)" 괄호 안 낱말을 원문 그대로 `endResultText`로 보낸다(자유 문자열, 값 목록을 enum으로 고정하지 않는다). 종료가 아니거나 괄호가 없거나 비면 `null`.
  - 상태 표기: 종료 공고는 "종료 · <결과>", 결과가 없으면 "종료". 카드 배지, 상세 배지, 공유 카드·링크 미리보기 요약, OG 이미지 배지가 모두 `entities/animal/ui/status-badge.tsx`의 `statusBadgeText` 하나를 쓴다. 결과에 따라 색·모양을 바꾸지 않는다.
  - 종료 사유: `endReason` 원문을 `endReasonText`로 보내고, 상세 정보 줄의 "종료 사유"로 보인다(`detailRows`).
  - 하지 않는 것: 결과별 필터, 결과별 문구 다듬기, 결과별 색.
- 종료 카드는 회색 배지 + 사진 채도 소폭 낮춤(`saturate(.7)`).
- 종료 상세의 찜/공유는 활성 상태로 둔다.
- 우선 이 계획대로 구현하고, 이후 관찰한다: 종료 비율(`processState` 값 집계), 종료 카드의 진입률과 공유율(이벤트에 status 포함).
- Mapper는 알 수 없는 `processState` 값을 주입된 로거로 남긴다(Mapper는 `process.env`를 읽지 않는다).
- 특이사항(`specialMark`)은 상세에서 보여 주지만, **종료 사유(`endReason`)와 같은 문구이면 특이사항을 비운다**. 보호소가 두 필드에 같은 문장을 적는 경우가 있어(픽스처 `427346202600847`) 그대로 내보내면 같은 문장이 두 줄로 보인다. 같으면 "종료 사유" 줄 하나로 보인다(이슈 #41). 판정은 서버 Mapper에서 한다(앞뒤 공백 차이 무시).

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
- 기능명세서 4.1.3 카드 2줄 규칙 → 기타 축종만 1줄이 `"<동물> · <지역>"`이다(시안 없음, 12절 43)
- 홈과 목록 헤더 진입점의 시안은 Design 아티팩트 "냥공고 홈 · 축종 선택"에만 있고 `docs/design`에는 없다(캐릭터 규칙은 `characters.md`). 구현이 시안과 다른 점은 12절 44

`docs/design` 동기화(2026-10-14, 방향 A): 디자인 시스템 원본 묶음(`nyanggonggo-review/design-sync-2026-10-14/…/project/`, 저장소 밖)에서 `README.md`와 `handoff.md`만 옮겼다(결정은 14절). 원본 그대로 두지 않은 곳: README 제목 글꼴 문단과 handoff (a)의 Type scale·(d)의 제목 글꼴 항목(원본은 상세 지역 제목도 Jua, `next/font/google` 먼저 시도였다. 14절 결정으로 바꿨다. 디자인에서 상세 제목을 Pretendard로 바꾸는 중이었다), handoff (b)의 찜 저장(원본은 "id + 카드 최소 캐시", 이 문서 8절대로 "id만" 유지), handoff 마지막 줄의 "이전" 값(원본 "4:5 약 480x600"을 실제 이전 값 "풀폭 480에서 480x360~480x640"으로), README의 "로딩 카드 사진 칸도 1:1" 한 문장(원본에서 빠져 되살렸다). **옮기지 않은 것**: 컴포넌트 `bundle.css`·`bundle.js`, `characters.md`(선 색 `#3A2A20`, 누름 갸웃 제거). 14절 계획 3·5단계에서 옮긴다. 그전까지 `docs/design/bundle.*`·`characters.md`는 방향 A 이전 값이다(1단계는 원본 `bundle.css`를 명세로만 읽었다). `tokens.json`은 1단계(2026-10-14)에 원본 그대로 옮겼고, 원본 묶음에 `tokens.css`가 없어 `tokens.css`는 같은 형식(색 한 줄, 나머지 한 줄, 글자 스타일 클래스)으로 `tokens.json`에서 만들었다. `globals.css`의 토큰 줄은 이 `tokens.css` 그대로다. 2026-10-07 동기화 뒤 README와 앱이 달랐던 두 곳(화면 타이틀 3종, 축종 중립 찜 문구)은 새 README에 반영돼 이 절의 불일치 목록에서 뺐다.

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
21. ~~종료 공고 정책~~ **확정됨(2026-10-23, 이슈 [#41](https://github.com/bluel00/nyanggonggo/issues/41))**: 종료 공고는 "종료 · <결과>"로 보이고 종료 사유는 상세 정보 줄에 보인다(10절). 이전 기록: 종료 공고의 대부분은 사망이 아니다. 종료(입양) 233, 방사 57, 기증 39, 반환 22건이 자연사 754, 안락사 53건과 같은 "종료" 배지로 보인다(12.A P5). 종료 사유 비노출(10절)은 유지하고 결정 보류, 다음 UI 단계에서 재검토
22. 개(`upkind=417000`) 규모와 페이지 수, 페이지 크기: 미측정(이전 샘플 전체 7,249건에서 역산하면 5천 건 미만으로 보이나 추정). 최대 페이지 가드와 수집 시간 확인 필요
23. ~~이미지 프록시와 `next/image` 미사용, 원본 크기 그대로 내려받기~~ **해결됨(2026-10-07)**: 프록시가 허용 폭(480/828/1080) WebP로 줄인다. 규칙과 `next/image`를 쓰지 않는 이유는 9절 "이미지 프록시 리사이즈". 바이트는 실제 사진 5장 기준 828 폭에서 원본의 5~56%(46 참고). 남은 확인: 원본 파일명에 등록 시각이 있어 URL별 내용이 바뀌지 않는다는 가정(긴 캐시의 근거). 이전 기록: 이미지 프록시(`/api/image-proxy`)와 `next/image` 미사용: 카드 이미지는 plain `<img loading="lazy">`가 프록시를 가리킨다. Vercel Image Optimization을 함께 쓰면 최적화 호출과 대역폭 비용이 이중으로 들 수 있어, 지금은 프록시 응답의 CDN 캐시(`SERVER_TUNING.imageProxyCacheControl`: `max-age=86400, s-maxage=604800, stale-while-revalidate=86400`)로 충분하다고 본다. **튜닝 필요**: 원본 이미지 크기(리사이즈 없이 내려받는 바이트), 목록 스크롤 시 데이터 사용량, CDN 적중률을 보고 `next/image`(또는 리사이즈) 도입 여부를 다시 판단. 원본 파일명에 등록 시각이 있어 URL별 내용이 바뀌지 않는다는 가정(긴 캐시의 근거)도 검증 필요. 원본 크기와 데이터 사용량은 42에서 실측했다(사진 1장 1300×1733 / 약 147KB, 카드 표시 크기는 380×475 CSS px)
24. 이미지 프록시 실패 처리와 제약: 원본 4xx/5xx/타임아웃/이미지가 아닌 응답/10MB 초과는 200 + 투명 1x1 PNG(`Cache-Control: no-store`, `X-Image-Proxy: fallback`)로 내려 카드 사진 영역의 배경색이 보이게 한다. 리다이렉트는 따라가지 않는다(`redirect: "error"`). 원본이 정상적으로 리다이렉트하는 경우가 있는지, 실패 비율은 얼마인지 로그로 확인 필요. 사진 없는 공고의 플레이스홀더 디자인은 미정(handoff)
25. 필터 바텀시트 스와이프 다운 닫기(명세 4.2.1): 미구현. shadcn Sheet(Radix Dialog)에는 제스처가 없다. 배경 탭, 핸들 탭, Esc로 닫는다. 제스처가 필요하면 vaul(shadcn Drawer) 도입(새 의존성) 또는 직접 구현을 결정해야 한다
26. 지역 코드의 이상 항목: 경남 창원시가 코드 3개(5280000, 5320000, 5670000)로 오고(통합 전 마산·진해 코드로 보임, 추정), 충남에 연기군(4560000, 2012년 세종 편입)이 남아 있다. 정적 목록에는 그대로 두고 창원시는 라벨에 코드를 붙였다. 어느 코드로 공고가 조회되는지(`org_cd`)는 미검증 (2026-10-13: 창원시는 5670000만 남기고 라벨을 "창원시"로 바꿨다. 41 참고. 연기군은 그대로)
27. ~~기본 지역 첫 화면의 공고 수~~ **해결됨(2026-09-28)**: 종로구는 고양이 보호중 공고가 5~6건뿐이라 첫 화면이 비어 보였다. 기본 지역을 서울특별시 전체로 넓혔고(7절), 같은 조건에서 첫 페이지 20건 + 다음 커서가 나오는 것을 확인했다. 서울 전체도 비는 계절/필터 조합이 생기면 기본값을 다시 본다
28. `org_cd` 필터의 서버 동작: `upr_cd`와 함께 보낸 `org_cd`로 공고가 시군구 단위로 걸러지는지 실측 필요(파라미터 자체는 4절 확인된 요청 변수)
29. ~~카카오 SDK 버전과 무결성 해시~~ **확정됨(2026-09-22)**: 버전 2.8.3(Full SDK, `kakao.min.js`) + integrity(sha384) 적용 확정. 값은 카카오 개발자 다운로드 페이지에서 직접 복사, 2026-09-22 기준(`KAKAO_SDK_URL`, `KAKAO_SDK_INTEGRITY`). SDK 버전 업그레이드 시 integrity 값도 반드시 같이 갱신 필요. 남은 확인: 카카오 키 발급과 사이트 도메인 등록 후 실제 공유 시트가 뜨는지, 콘솔에 SRI 오류가 없는지, 썸네일(이미지 프록시 URL)을 카카오가 가져갈 수 있는지와 피드 이미지 비율 제한 카드의 링크가 동작하지 않고(눌러도 반응 없음) 앱 이름이 `apps.kakao.com`으로 가면 링크 도메인이 콘솔에 등록되지 않았거나 로컬 주소인 경우다(2026-09-28 증상). 우리 쪽은 로컬 주소면 아예 카카오 공유를 하지 않고 링크 복사로 폴백한다(9절).
30. OG 이미지 실제 렌더: 실제 공고(사진 fetch 포함)로 렌더 결과, Vercel 배포 번들에 폰트 두 개가 포함되는지, otf(각 약 1.5MB) 파싱 시간과 메모리, 종료 공고 사진의 채도 낮춤(satori `filter` 지원 여부, 현재 미적용) 확인. 로컬에서는 기본 이미지와 합성 데이터 카드로 한글 렌더를 확인했다
31. ~~상세 페이지의 서버 조회 중복~~ **해결됨(2026-09-22)**: `generateMetadata`와 페이지가 React `cache`로 감싼 `getAnimalForRequest`를 함께 써서 요청당 서버 조회 1회. 페이지는 결과를 TanStack Query 캐시(상세 쿼리 키)로 미리 채워 넘겨 클라이언트 `useAnimal`이 `/api`를 다시 부르지 않는다. OG 이미지 라우트는 별도 요청이라 이 캐시를 공유하지 않고 upstream fetch 캐시(300초)만 공유한다
32. ~~뒤로가기~~ **해결됨(2026-09-29)**: 화면 안 뒤로가기 버튼은 이 문서(탭)에서 목록 화면을 거쳤고 `history.length > 1`일 때만 `router.back()`이고, 아니면 기본 목록(`/`)으로 `push`한다. 목록을 거쳤는지는 모듈 변수로 기록한다(`shared/lib/app-navigation.ts`, 목록 위젯이 마운트될 때 표시. 2026-10-14 PRD-v1.4로 sessionStorage로 옮겼다, 7절). `history.length`만 보면 카카오톡 인앱 브라우저나 외부 사이트에서 같은 탭으로 들어온 경우를 가릴 수 없어 뒤로가기가 앱 밖으로 나갔다. `router.back()`이라 필터가 붙은 목록 URL과 스크롤 위치가 그대로 살아난다
33. 카드 하트와 사진 없음 플레이스홀더의 디자인: 시안이 없어 overlay 버튼 모양과 아이콘만 둔 대체 UI로 임시 구현
34. ~~이미지 프록시의 이미지 판별~~ **확정됨(2026-09-27 로컬 재현)**: 공공데이터포털 `fileDownloadSrvc` 파일 다운로드 엔드포인트는 실제 이미지 파일을 내려주면서 `Content-Type`을 `application/octet-stream`으로 잘못 표기한다. 그래서 이미지 프록시와 OG 이미지 fetch는 `Content-Type` 헤더를 믿지 않고 응답 바이트의 매직 넘버(JPEG `FF D8 FF`, PNG, GIF8, RIFF…WEBP)로 이미지 여부를 판별하고, 응답 `Content-Type`도 판별한 값으로 직접 설정한다(`src/server/images/image-type.ts`). 허용 호스트 검증은 그대로다. 매직 넘버가 맞지 않으면 기존처럼 투명 1x1 PNG로 폴백한다(로그 `reason: not_image`에 업스트림 헤더와 앞부분 바이트만 남긴다)
35. ~~`state` 파라미터 의미~~ **확정됨(2026-09-28 라이브 확인)**: `state`(`notice`/`protect`)는 `processState` 필드 텍스트("보호중" 등)와 무관하고, 공고 기간 경과 여부로 계산되는 것으로 보인다. 서울(`upr_cd=6110000`) 종로구(`org_cd=3000000`) 고양이 조회에서 `state` 없이 6건(보호중 5, 종료(자연사) 1)이 오는데, 같은 조건에 `state=protect`를 붙이면 0건이다. 보호중 5건은 모두 `noticeEdt`가 조회일(공고 마지막 날)이었다. 우리 서버는 처음부터 `state`를 보내지 않고 `processState`가 `종료`로 시작하는지로 직접 분류하므로(5절) 영향이 없다. `notice`/`protect`의 정확한 계산 규칙은 여전히 미검증이며, 앞으로도 이 파라미터에 의존하지 않는다
36. ~~상세에서 뒤로 왔을 때 목록 스크롤 위치~~ **해결됨(2026-09-28)**: 뒤로가기 자체는 스크롤을 건드리지 않는다(App Router의 `restore-reducer`는 `scrollRef`를 비운다). 위치가 맨 위로 리셋된 원인은 두 가지였다. (1) 목록 → 상세로 **갈 때** Next가 새 세그먼트를 `scrollIntoView`로 보여 주는데, 이때 스크롤되는 건 window가 아니라 480px 컬럼 안의 스크롤 컨테이너라서 그 스크롤 이벤트가 저장값을 0으로 덮었다. → 목록에서 나가는 링크에 `scroll={false}`. (2) 저장이 스크롤 이벤트에만 걸려 있어 마지막 위치가 저장되기 전에 화면이 사라질 수 있었다. → effect 정리와 `pagehide`에서도 저장. 복원은 목록이 다시 그려진 뒤 몇 프레임까지 다시 시도한다(캐시된 페이지가 붙어 높이가 확보될 때까지). 브라우저 기본 스크롤 복원은 내부 스크롤 컨테이너에는 적용되지 않으므로 쓰지 않는다 (2026-09-29에 픽셀 방식 자체를 버리고 카드 id 기준으로 바꿨다. `scroll={false}`는 그대로 둔다, 38 참고)
37. ~~뒤로가기 후에도 목록이 맨 위로 가던 나머지 원인~~ **해결됨(2026-09-29)**: 36의 수정(`scroll={false}`, 정리 시점 저장) 뒤에도 재현됐다. 원인은 정리 시점에 컨테이너에서 위치를 **다시 읽은 것**이다. 화면이 바뀌면 목록 DOM이 먼저 지워지고, 그러면 내부 스크롤 컨테이너에 스크롤할 내용이 없어져 브라우저가 `scrollTop`을 0으로 누른다. effect 정리는 그 뒤에 돌기 때문에 0을 저장했다. 이제 스크롤 이벤트에서 마지막 위치를 기억해 두고, 떠날 때는 스크롤할 내용이 남아 있을 때만 다시 읽는다. jsdom에는 레이아웃이 없어(`scrollHeight`가 0) 이 구분을 할 수 없으므로, 테스트는 컨테이너에 실제 브라우저와 같은 높이를 정의해 재현한다. 참고로 Next 16의 bfcache(`<Activity>`로 이전 화면을 살려 두는 것)는 `cacheComponents`를 켤 때만 동작하므로(`MAX_BF_CACHE_ENTRIES`는 1) 목록은 실제로 언마운트된다 **이 방식은 2026-09-29에 폐기했다.** 실제 브라우저에서는 그 뒤에도 위치가 틀어졌고(복원 시점의 높이, 눌림 타이밍) jsdom으로는 검증할 수 없었다. 카드 id 기준 복원 + Playwright 검증으로 교체했다(7절, 38)
    - **픽셀 복원을 다시 넣었다(결정 2026-10-20, A안, 7절).** 아이폰 사파리에서 상세 → 목록을 쓸어넘기기로 돌아가면 한 번 깜빡였다(실기기). 화면 안 뒤로가기 버튼은 매끄러웠다. 조사(프레임 기록, Chromium·Playwright WebKit): 두 경로는 같은 코드다(Next의 `router.back()`은 `history.back()`이고 같은 popstate 처리를 탄다). 목록은 첫 프레임부터 뼈대 없이 제자리에 그려졌지만, 그 자리는 **열었던 카드를 가운데로 맞춘 위치**라 떠날 때와 39px(WebKit)·115px(Chromium) 달랐다. 원인 판정(추정, 헤드리스로는 쓸어넘기기 재현 불가): 사파리는 쓸어넘기는 동안 떠날 때 화면의 스냅숏을 보여 주고 끝나면 실제 화면으로 바꾸는데, 실제 화면의 스크롤이 스냅숏과 달라 한 번 튄다. 버튼에는 스냅숏이 없어 보이지 않는다. 우리 스크롤은 내부 컨테이너라 `history.scrollRestoration`(창 스크롤)과 무관하고, 같은 문서 이동이라 bfcache도 아니며, 뒤로가기에서는 View Transition이 시작되지 않는다.
    - 방법: 카드를 누를 때 scrollTop(px)을 카드 id와 함께 sessionStorage(목록 키별)에 저장하고, 목록이 캐시로 첫 렌더부터 그려지면 layout effect(그리기 전)에서 되돌린다. 되돌린 자리에서 카드가 화면 밖이면(레이아웃이 달라짐), 또는 첫 렌더에 데이터가 없었으면(캐시가 지워져 다시 받음, 순서·높이 보장 없음) 지금처럼 카드 가운데 맞춤. 저장값이 없으면 지금 동작 그대로.
    - 근거: 예전에 픽셀 값이 틀어진 원인은 둘이었다. ① 떠난 뒤에 읽어 0이 눌린 값을 저장했다 → 이제 카드를 누르는 순간 읽는다. ② 복원 시점에 높이가 모자랐다 → 이제 캐시된 페이지가 첫 커밋에 모두 그려진 뒤 layout effect에서 되돌리고(4단계 뒤 목록은 캐시 히트 때 뼈대 없이 한 번에 그려진다), 그렇지 않은 경우는 카드 id로 간다. 쓸어넘기기 스냅숏과 맞추려면 '카드가 보이는 위치'가 아니라 '떠날 때와 같은 위치'여야 해서 카드 id만으로는 안 된다.
    - 검증: E2E `back-nav.spec.ts`(Chromium·WebKit 둘 다, 프로젝트 `production-stub`·`production-stub-webkit`): 1페이지·5페이지 깊이 × 화면 안·브라우저 뒤로가기에서 목록 첫 프레임(rAF)의 scrollTop이 떠날 때와 ±1px, 캐시를 지운 경우(시계를 31분 넘김) 카드 가운데 맞춤. 프레임 기록(저장소 밖 `back-frames.mjs`, 각 3회): 고친 뒤 두 엔진·두 경로 모두 첫 목록 프레임 scrollTop = 떠날 때(3208/3208, 3054/3054), 뼈대·빈 화면 0, 움직임 0프레임. 실기기 쓸어넘기기 확인은 남는다.
    - 같이 고친 것: WebKit E2E에서 5페이지까지 내리기가 3페이지에서 멈췄다. 다음 페이지 감시(IntersectionObserver)를 한 번만 걸어 두고 `enabled`(`isFetchingNextPage`)가 바뀔 때만 새로 걸었는데, 응답이 빨라 그 상태가 한 번도 그려지지 않으면 감시가 그대로 남고, 감시는 상태가 바뀔 때만 알리므로 sentinel이 '범위 밖'으로 보이기 전에 다시 끝까지 내리면 알림이 없다. 받은 페이지 수가 바뀔 때마다 감시를 새로 걸게 했다(새 감시는 지금 상태를 한 번 알린다). 페이지를 붙인 뒤에도 sentinel이 범위 안에 남는 경우의 멈춤도 같이 막는다.
    - **PRD-v1.5로 대체(2026-10-20)**: 상세를 목록 위에 얹어(7절) 목록이 내려가지 않으므로 픽셀·카드 id 복원 코드와 sessionStorage 키를 모두 걷어 냈다(R6). 픽셀 복원 뒤에도 아이폰에서 사진이 한 프레임 비었다(56). 위 조사와 다음 페이지 감시 수정은 기록으로 둔다(감시 수정은 그대로 쓴다).
38. ~~목록의 중복 key(`Encountered two children with the same key`)~~ **해결됨(2026-09-29)**: 목록 커서가 정렬된 결과의 **offset**이어서, 페이지를 넘기는 사이에 목록이 바뀌면(새 공고 추가, 상태 변경, 캐시 재검증 300초) 뒤 페이지가 한 칸씩 밀려 경계 항목이 두 번 나왔다. 업스트림 응답과 우리 서버 응답 자체에는 중복이 없었고(서울 고양이 보호중 107건/전체 187건 전부 고유, 업스트림 1페이지), 클라이언트는 페이지를 이어 붙이기만 한다. 커서를 정렬 키 기준으로 바꿔 밀림과 무관하게 만들었다(5절). 같은 원인으로 생기던 누락도 함께 없어진다
39. ~~지역 이름으로 코드를 되찾을 때 애매한 케이스~~ **PRD-v1.4로 대체(2026-10-14)**: 공유 진입 뒤로가기가 `/`로 바뀌어 이름 → 코드 되찾기(`from-animal.ts`)를 지웠다. 아래는 그 전 기록. 지역 이름으로 코드를 되찾을 때 애매한 케이스: 업스트림에 지역 코드가 없어 `orgNm` 이름으로 맞춘다(4절). 2026-09-29 표본(전국 시도별 고양이 1페이지, `orgNm` 170종)에서 애매한 것은 셋이다.
    - (2026-10-13 바뀜: 창원시를 5670000 하나로 줄이고 라벨을 "창원시"로 바꿔서 이제 구 → 시 순 매칭으로 **창원시(5670000)**가 된다. 41 참고. 아래는 그 전 기록) `"경상남도 창원시 의창성산구"` → **시도만(경상남도 전체)**. `sigungu_v2` 원본에서 창원시 코드 3개(5280000, 5320000, 5670000)의 이름이 모두 그냥 `"창원시"`이고 `"의창성산구"`라는 시군구는 목록에 없다. 즉 이름으로는 어느 코드인지 특정할 수 없어 폴백이 맞다(정적 목록의 라벨 `창원시(5280000)` 등은 이 중복 때문에 코드를 붙인 것이다). 참고로 같은 날 실측에서 공고가 실제로 조회되는 코드는 5670000 하나였고(고양이 4건, 개 92건) 나머지 둘은 0건이었다. 데이터가 그때그때 달라질 수 있어 코드로 못 박지 않았다. 폴백한 경상남도 전체 목록에는 그 공고가 들어 있지만, focus로 찾을 때는 5페이지(100건) 상한에 걸려 못 찾을 수 있다(40).
    - `"세종특별자치시"`, `"제주특별자치도"` → 시도만. `orgNm`에 시군구가 없다(의도한 동작).
    - `"경기도 수원시 권선구"`처럼 시 아래 구가 오는 형식은 구(권선구) → 시(수원시) 순으로 맞추도록 해 뒀지만, 그런 공고가 표본에 없어 실제 값으로는 미검증
40. ~~`focus`로 공고를 찾을 때의 페이지 상한(5페이지, 100건)~~ **PRD-v1.4로 대체(2026-10-14)**: focus를 없앴다.
41. ~~필터 UI에 창원시가 코드별로 3개(5280000/5320000/5670000) 노출된다~~ **해결됨(2026-10-13, 선택지 C: 빈 코드 숨기기)**
    - 조사(2026-09-29, 2026-10-13 로컬에서 공공 API 직접 조회): `sigungu_v2`는 세 코드의 이름을 모두 `"창원시"`로만 준다. 10-13 기준 공고 수(보호중/전체)는 5670000이 고양이 2/2, 강아지 35/75, 기타 5/5이고 보호소는 전부 `orgNm` "경상남도 창원시 의창성산구", `careNm` "창원동물보호센터"다. 5280000과 5320000은 두 날 모두 세 축종 0건. 경상남도 전체(`org_cd` 없이) 조회의 창원 공고 82건은 5670000 결과와 desertionNo까지 같았다(코드 사이 중복 공고 없음). 두 코드가 옛 마산·진해에 대응하는지는 근거가 없어 모른다.
    - 결정: 정적 목록(`regions.ts`)에서 5280000, 5320000을 빼고 5670000만 `"창원시"` 라벨로 둔다. 다른 선택지는 버렸다: 합산(A)은 `org_cd`에 여러 코드를 한 번에 넘길 수 없어(쉼표, 반복 파라미터 모두 resultCode 10) 캐시 미스마다 호출이 3배가 되고, 이름 붙이기(B)는 공식 근거가 없다. 라벨이 "창원시"가 되면서 `orgNm` → 코드 매칭(39)도 창원시(5670000)로 맞는다.
    - 별칭: 옛 값이 URL(`district`)이나 지역 기억 쿠키에 남아 있을 수 있어 `DISTRICT_ALIASES`(`regions.ts`, 한 곳)에서 `6480000`의 5280000·5320000 → 5670000으로 읽는다(`resolveDistrict`). 목록 진입 판정(`entry.ts`)은 URL의 옛 코드를 축종·지역 채우기와 **같은 리다이렉트 한 번**에서 새 코드로 바꿔 쓴다. 쿠키는 다시 쓰지 않고 읽을 때 바꾼다(다음에 필터를 고르면 새 값으로 덮인다). 서버 `/api/animals`는 숫자만 확인하므로 별칭을 모른다(앱이 옛 코드를 보내지 않는다).
    - 다시 확인할 때: 지역 목록을 다시 만들 때(파일 상단 주석의 프로브) 5280000과 5320000도 조회해 본다. 공고가 생겼으면 별칭을 지우고 목록에 되돌리는 것(라벨 구분 포함)을 다시 판단한다.
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
    - **(B) 뒤로가기 복원 비용 — PRD-v1.5로 대부분 사라짐(2026-10-20)**: 상세가 목록 위에 얹혀 뒤로가기에서 카드를 다시 마운트하지 않는다. 남는 것은 목록에서 다른 화면(찜 등)을 거쳐 돌아오거나 새로고침 뒤의 다시 마운트다. 아래는 그 전 기록. (이전: 미결, 관찰(PRD-v1.4 5절)) 목록 `gcTime`이 30분이 되어(PRD-v1.4 R1) 깊이 내려간 목록을 되살리는 일이 더 잦아진다. 2026-10-14 실험실 E2E에서 5페이지(100카드) 복원은 요청 0건·스켈레톤 없이 통과했다. 카드를 다시 마운트하는 비용이라 카드 수에 거의 비례한다(위 표). 200카드 248ms는 넘어가도 되지만 1,000카드 1.1초는 그 동안 입력을 못 받는다. 선택지: (1) 그대로 둔다(현실 깊이가 대개 20페이지 이하) (2) 페이지 상한 + "필터를 좁혀 보세요" 안내 — 명세 4.1.4(무한 스크롤)와 어긋나므로 결정 필요 (3) 가상화 — 새 의존성이고, `[data-animal-id]` 개수를 세는 e2e 헬퍼도 같이 고쳐야 한다(당시 카드 id 기준 복원은 PRD-v1.5에서 걷어 냈다). 경기 개 전체(41페이지)가 실제로 얼마나 쓰이는지 보고 결정한다.
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
    - 홈 문서 제목은 화면 제목과 같은 "오늘은 누구를 보러 왔어요? | 멍냥공고"다(`ANIMAL_COPY.homeTitle`, 다른 화면과 같은 `<화면 제목> | SERVICE_NAME` 형식)
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
    - **공공 API 응답시간 재측정(2026-10-13·14, 52의 요청 로그, 운영 icn1 함수 기준)**: `upstreamCache: "miss"`인 요청의 `upstreamMs`. 상세 단건 60건 중앙 39ms / 90번째 48ms / 범위 34~1,104ms, 목록 1페이지 30건 중앙 288ms / 90번째 463ms / 범위 182~1,279ms, 목록 2페이지 1건 1,041ms. 10-08의 3~7초 지연은 두 날 모두 다시 나오지 않았다(10-07 수준). 다만 짧은 튐은 있다: 10-14 상세 단건 3건이 2초 사이에 연달아 693·1,090·1,104ms였고, 10-13 목록 1페이지 2건이 1.2~1.3초였다. 위 서버 페이지 캐시 기간·stale-while-revalidate 검토는 그대로 미결이다(목록은 이미 `stale` 응답이 로그에 나온다, 52).
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
49. PRD v1.2 1단계: 들어올 때 동작(greet)(2026-10-08). 기준은 `docs/PRD-v1.2.md` 5·7절과 `docs/design/characters.md` "들어올 때 동작" 프레임표(디자인 시스템 버전 24). 48의 폴짝 돌기 greet를 바꿨다. 고양이 잠(sleepEnter·sleep·wake)은 그대로, 강아지 잠은 2단계. 앱 코드·계약은 그대로(신호는 뷰 모델 트리거 `press` 하나).
    - **생성기 일반화**: `scripts/rive-cat-scene.mjs`를 `scripts/rive-characters-scene.mjs`로 바꿔 두 아트보드를 만든다(scene.rml의 `rive-artboards:begin/end` 사이, 손으로 고치지 않는다). 47의 손으로 쓴 강아지 idle·press는 같은 값으로 옮겼다. 캐릭터마다 `rig`(바닥 가운데 60,112: 위치·늘림·납작) > `flip`(좌우 반전) > 뷰. 옆 앉음 뷰는 정점에 id를 달고 자세 SVG(같은 id·명령 순서·점 개수)로 보간한다. 생성할 때 id 중복을 검사한다. 고양이 뒤 뷰는 쓰지 않아 뺐다(characters.md "예비").
    - **고양이 "엉덩이 씰룩 → 덮치기"**(f4~f45, 60fps 10~113프레임): 정면 → 3/4 → 옆 앉음 → 웅크림 → 씰룩 ↔ 웅크림 두 번 → 한 번 더 낮게(1.04 × 0.92) → 공중(루트 y −14, x +4, 가로 1.06, ease-out) → 착지(ease-in, f33 1.08 × 0.9) → 착지 유지(꼬리 휙·리본 흔들·귀 앞으로) → 옆 앉음(루트 x → 0, ease-in-out) → 3/4 → 정면. 따라오기: 꼬리·리본 1프레임, 귀 2프레임 늦게(24fps). 오른쪽(그린 방향)을 본다. 표에 가속 지정이 없는 구간(옆 앉음 → 웅크림, 씰룩)은 선형.
    - **강아지 "놀자 자세"**(f1~f33, 60fps 3~83프레임): 정면 → 3/4 → 옆 앉음(들썩 세로 1.05, 귀 위로 2px) → 놀자(ease-in, f11 1.06 × 0.94) → 유지(꼬리 25°±20°, 반 주기 2프레임, 진폭이 커지다 f16–20 최대, 엉덩이 x ±1 반대 박자, f21–23 엉덩이 통통) → 옆 앉음(ease-out, f26 세로 1.04, 꼬리는 f32까지 따라옴) → 3/4 → 정면. 3/4·옆·놀자는 flip −1로 왼쪽(고양이 쪽)을 보고, 정면은 반전하지 않는다. 엉덩이는 뒷다리·꼬리 그룹으로 움직인다(몸 path는 자세 보간만).
    - **엇갈림·press**: 강아지 f1, 고양이 f4 시작(60fps로 3·10프레임, 설계상 117ms 차, 48의 고양이 40프레임 대기는 없앰). 최고조는 강아지 f18(0.75초), 고양이 f33(1.38초). greet 중 press는 즉시 press 상태로 넘어가 greet를 끊는다(press 애니메이션이 rig·뷰·flip을 0프레임에 되돌린다). 확인용 페이지에서 덮치기 공중·놀자 유지 중에 눌러 바로 정면 웃는 눈이 되는 것을 캡처했다.
    - **120 칸**: 아트보드를 200×200으로 넓히고 rig를 (40,40) 옮긴 사본을 매 프레임 렌더해 배경과 다른 픽셀의 경계를 쟀다(1단위 = 4px, 선 포함). 고양이 f0~118: x 14.5~117(최대 f76 공중, 루트 +4·가로 1.06), y 12.5~113. 강아지 f0~88: x 12.75~97, y 27.5~113. 모두 0~120 안.
    - **시작 시점 실측**(production `build`+`start`, Playwright/Chromium 390×844 DPR 2, 각 7회 중앙값, 측정 스크립트는 커밋하지 않음): 캐시 없음 — 로드 → 캔버스 보임 219ms(215~257), 캔버스 보임 → 첫 움직임 28ms(11~33, 강아지), 실제 시작 차(고양이 − 강아지) 116ms(100~133). 캐시 있음 — 88ms(81~99), 50ms(49~51), 101ms(99~117). 두 캔버스가 보이는 시각 차는 0~4ms. 첫 움직임은 0.3초 요건 안. 캔버스 보임 시각은 `data-ready`, 첫 움직임은 캔버스 픽셀이 처음 바뀐 rAF.
    - **LCP·요청**: LCP 중앙 68ms(48~88, 캐시 없음), 움직임 줄이기 44ms(44~80). LCP가 캔버스가 보이기(219ms) 전에 끝나 Rive가 LCP 요소가 되거나 늦추지 않는다(차이는 측정 범위 안). 움직임 줄이기·홈 밖 화면의 Rive 요청 0건 유지(E2E).
    - **E2E 추가**(`e2e/home-rive.spec.ts`, production): greet 동안 100ms마다 2.2초 카드·캐릭터 칸·라벨(텍스트 Range)의 위치·크기가 같다. greet 중간(0.5초, 1.4초)에 카드를 누르면 3초 안에 목록으로 이동한다.
    - **캡처**: `C:\side\nyanggonggo-review\rive-check\captures\`의 `greet-both.png`(한 시간축, 고양이|강아지), `cat-pounce.png`, `dog-play.png`, `greet-press.png`(greet 중 press).
    - **`.riv` 크기**: 46,877 → **77,534바이트**(gzip 15,091 → 24,709, brotli 11,942 → 18,075). 늘어난 몫은 자세 보간 키(고양이 옆 앉음 정점 143개 × 11자세, 강아지 75개 × 4자세)와 강아지 뷰 둘이다. 줄인 것: 값이 같은 구간 가운데 키 생략, 가속 지정이 없는 구간은 보간기 없는 선형. RML은 보간기를 키프레임끼리 나눠 쓸 수 없다(`rive docs easing`: 키마다 자식으로 단다).
    - **해결(2026-10-08, 디자인 시스템 버전 26)**: 강아지 옆 앉음 ↔ 놀자 보간의 중간 프레임(60fps 약 19~27f, 62~73f)에서 몸 앞쪽 윤곽이 안으로 접혀 흰 가슴 조각이 몸 밖으로 보이던 문제. **원인은 점 대응**이었다. 두 그림은 명령 순서·점 개수가 같았지만 같은 번호의 몸 정점이 윤곽을 따라 다른 부위로 옮겨 가 있었다(예: 앞 위 정점이 놀자에서는 뒤 위). 그래서 직선 보간 중간에 윤곽이 접혔다. **조치**: 디자인에서 `nyang-dog-play.svg`의 점을 옆 앉음과 같은 부위에 오도록 다시 그렸고(고양이 자세 4개도 보정본으로 교체), characters.md 보간 규칙에 "같은 번호의 점은 두 그림에서 몸의 같은 자리, 새 자세는 25·50·75% 보간 그림으로 확인"을 더했다. 생성기는 바꾸지 않고 다시 돌려 `pnpm rive:build`만 했다. 확인: 강아지 f15~30·f58~80, 고양이 f13~116을 프레임마다 캡처(`C:\side\nyanggonggo-review\rive-check\captures\posefix\`)해 윤곽 접힘이 없다. 앞발은 f19부터 선이 작은 삼각형으로 벌어지기 시작해 f25~28에 발 모양이 된다(`dog-front-paw-f17-28.png`). 120 칸 경계는 위와 같다(고양이 x 14.5~117·y 12.5~113, 강아지 x 12.75~97·y 27.5~113). 다시 잰 시작 시점(각 7회 중앙값): 캐시 없음 213ms·36ms·시작 차 115ms, 캐시 있음 80ms·48ms·116ms. LCP 48ms(움직임 줄이기 44ms). `.riv` 77,534 → 77,200바이트(gzip 24,709 → 24,562, brotli 18,075 → 17,924).
    - rive:build는 생성 → 빌드 순서로 돈다(`scripts/rive-build.mjs`가 `scripts/rive-characters-scene.mjs`를 먼저 돌린다). SVG만 바꾸고 생성하지 않은 상태는 `tests/design/rive-scene.test.ts`(생성기 `--check`: 생성 결과와 커밋된 scene.rml 비교)가 실패로 잡는다.
50. 상세 사진이 잘리지 않게(PRD v1.3, 2026-10-08). 상세 캐러셀의 사진 칸은 **첫 사진의 가로/세로를 3:4~4:3으로 제한한 비율**이고, 모든 사진이 그 칸 안에 `object-contain`(빈 곳 `bg`, object-position 없음)이다. 넘겨도 칸 높이가 같다. 크기를 모르면 1:1. 목록 카드와 OG 이미지는 4:5 cover 그대로(디자인 README 사진 규칙). (51에서 1:1로 변경)
    - **배경 실측**(공고 293건, 사진 583장, 2026-10-08, 저장소 밖 `C:\side\nyanggonggo-review\image-ratio\`): 4:3 가로 49.7%, 3:4 세로 36.4%, 정사각 근처 10.1%. 4:5 cover에서 잘리는 면적 평균 25.2%, 중앙값 39.8%(가로 사진은 약 40%). 공고당 사진 98%가 2장, 같은 공고 안 비율이 다른 경우 12.9%. 공공 API는 사진 크기를 주지 않는다.
    - **구조**: `app/animals/[id]/page.tsx`가 공고를 조회(prefetch)한 뒤 첫 사진 크기를 읽어(`getPhotoSizeForRequest`, `animal-data.ts`, React cache) `AnimalDetailView` → `AnimalDetail` → `ImageCarousel`로 `firstPhotoSize`(`{ width, height } | null`)를 넘긴다. 칸 비율 계산(`photoBoxRatio`, 3:4~4:3 제한, null이면 1:1)은 UI 규칙이라 `widgets/animal-detail/model/photo-box.ts`에 둔다. 칸 비율은 슬라이드의 인라인 `aspect-ratio`라 서버 HTML에 들어 있다(사진이 로드되며 밀리지 않음). 뼈대: 라우트 로딩 경계(loading.tsx)는 공고를 몰라 1:1, 위젯 조회 대기는 아는 칸 비율.
    - **모듈 위치**: 크기 읽기는 `src/server/images/image-size.ts`(서버 전용, sharp·원본 이미지 서버 호출이라 FSD 밖 `server`). 이미지 프록시(`image-proxy.ts`)·변환기와 같은 폴더이고 허용 호스트 검사(`contract/images`의 `isAllowedImageSource`)를 같이 쓴다. Next 캐시 구현은 `next-image-size-cache.ts`(업스트림 페이지 캐시 `next-page-cache.ts`와 같은 모양, 테스트는 cache를 주입). FSD 계층은 이 모듈을 모르고, 둘을 잇는 것은 app(`animal-data.ts`, `page.tsx`)뿐이다(3절 경계 규칙).
    - **읽는 방법**: 원본 이미지 서버는 Range를 무시하고 파일 전체를 보내므로 스트림으로 받다가 8KB마다 sharp `metadata()`로 헤더를 읽고, 크기가 나오면 끊는다(실측 사진당 10~17KB). 256KB 안에 못 읽으면 포기. 리다이렉트는 따라가지 않고(`redirect: "error"`) 바이트는 Next 데이터 캐시에 넣지 않는다(`cache: "no-store"`). EXIF 방향 5~8이면 가로·세로를 바꾼다(프록시 `.rotate()`와 브라우저가 돌려서 보인다).
    - **캐시와 시간 초과**: URL별 `unstable_cache`(키 `["image-size", URL]`, 재검증 30일, 사진 파일은 URL별로 바뀌지 않는다). 콜백이 실패를 예외로 던져 **성공만 캐시**한다. 시간 초과는 **300ms**(`SERVER_TUNING.imageSizeTimeoutMs`, 캐시 조회 포함)이고 넘으면 받던 요청을 끊고 null(칸 1:1). 로그는 이유만(`image size unavailable`, `reason: timeout|status|network|no_header`), URL·서비스키는 넣지 않는다.
    - **로컬 측정(참고용)**: production `build`+`start`, 같은 공고 7건(서울 개 보호중), 업스트림 캐시는 다른 7건으로 데운 뒤 본문 끝까지의 시간. 변경 전 처음 방문 35ms(34~37), 다시 방문 9ms(8~14) → 변경 후 처음 방문(크기 캐시 없음) **68ms(53~117)**, 다시 방문 8ms(7~10). 늘어난 양은 크기 캐시가 없을 때 중앙 +33ms, 있을 때 0. 상세 LCP(대표 5건, 전후 서버를 번갈아 20회씩, Pixel 7): 중앙 300 → 194ms, p75 572 → 840ms. 원본 이미지 서버 응답 편차(최대 4.5초)가 커서 차이를 가를 수 없고 악화 신호는 없다. CLS는 전후 모두 0~0.0009.
    - **확인**: 단위 테스트(비율 제한 0.63 → 0.75, 1.0 → 1.0, 1.49 → 1.333, null → 1:1, 허용되지 않은 호스트는 받지 않음, 시간 초과·캐시 지연이면 null, 성공만 캐시, 로그에 URL 없음, 서버 HTML에 칸 비율). E2E `e2e/detail-photo.spec.ts`(production): 조사 대표 공고 4:3 가로(441403202600232)·3:4 세로(426332202600508)·세로 → 가로가 섞임(426326202600401)에서 칸 비율 = 첫 사진 비율(제한), 받은 사진 비율 = 원본 비율, contain으로 그려진 영역이 칸 안, 넘겨도 칸 높이 같음, layout-shift ≤ 0.01. 실제 공고라 조회되지 않으면 건너뛴다. 캡처: 저장소 밖 `image-ratio\captures\after\`(변경 전후 나란히, 4:3 가로는 칸 390×487.5 → 390×299).
    - **E2E 경합 수정**: 상세에 바로 들어와 바로 뒤로가기를 누르는 테스트(focus(PRD-v1.4로 대체·삭제), species-home, remember-region)가 상세 응답이 늦어지면 로딩 뼈대의 뒤로가기(공고를 몰라 기본 목록으로 감)를 눌러 실패했다. 상세가 그려진 뒤 누르도록 `openedDetail`(e2e/helpers.ts)을 기다린다.
    - **뼈대 뒤로가기 규칙**(2026-10-08): 상세 로딩 뼈대는 공고를 몰라 그 공고의 목록으로 보낼 수 없다. 앱 안에서 들어왔으면(`canGoBackInApp`: 목록·찜을 거쳤고 `history.length > 1`, 상세 뒤로가기의 `useGoBack`과 같은 판단) 브라우저 뒤로가기(`router.back()`), 바로 들어왔으면(공유 링크·북마크, 서버 렌더 첫 화면 포함) 버튼을 그리지 않고 44×44 자리만 비워 둔다(헤더가 움직이지 않음). 실제 상세가 뜨면 상세의 뒤로가기가 그 공고의 목록으로 보낸다. **(2026-10-14 PRD-v1.4로 대체: 바로 들어왔어도 버튼을 보이고 `/`로 간다, 7절)** E2E `detail-loading.spec.ts`(목록에서 들어옴, 바로 들어옴, 이동 요청을 늦춰 재현).
    - **배포 후 게이트**: 기준(출처 PRD v1.3 4절, 배포 전 2026-10-08 확정)은 크기 읽기로 늘어난 시간(처음 방문 − 다시 방문)의 중앙값 150ms 이하, 처음 방문의 1:1 대체 칸 10% 이하. 넘으면 "칸 1:1 고정 + contain"으로 간다(크기 읽기 제거, `photoBoxRatio`만 1을 돌려주게).
        - **첫 측정의 틀린 전제(2026-10-08)**: `image-ratio\gate.mjs`로 3번 쟀는데, "공고가 매번 달라 크기 캐시가 비어 있다"는 전제가 틀렸다. 이 스크립트는 매번 같은 목록 페이지(경기·서울 고양이 보호중 2페이지)에서 공고를 골라, 몇 분 사이에는 같은 공고를 다시 재 2·3회차는 크기 캐시가 찬 상태였다(처음/다시 47/45ms). 캐시가 빈 측정은 1회차 7건뿐이었다(처음 102ms, 배포 전 기준 73ms).
        - **다시 잰 방법**: 저장소 밖 `image-ratio\gate2.mjs`(`node gate2.mjs <BASE> <건수>`). 지역·축종·상태·페이지를 돌아가며 **한 번도 열지 않은 공고**만 고르고, 고른 id는 `gate-seen.json`에 남겨 다시 고르지 않는다(사진 조사 대표 공고와 첫 측정 대상은 미리 넣었다). 공고마다 (1) `/api/animals/<id>`로 업스트림 상세 캐시를 데우고(크기 읽기를 하지 않는 경로라 업스트림 조회 시간이 처음 방문에 섞이지 않게) (2) 상세 처음 방문(크기 캐시 없음) (3) 바로 다시 방문(크기 캐시 있음, 크기 읽기를 뺀 기준값)의 본문 끝까지 시간과 캐러셀 칸 비율을 `gate2.jsonl`에 남긴다. (2) − (3)이 크기 읽기로 늘어난 시간의 추정값이다. 1:1 칸은 실제 첫 사진 크기를 헤더로 읽어 정사각 사진과 대체 칸을 가른다(`gate2-analyze.mjs`). URL·서비스키는 출력하지 않고 upstream_error면 멈춘다.
        - **30건 결과**(10건씩 3번, 2026-10-08·10-12, 울산·강원·충북·대구·인천, 개·고양이, 보호중·종료): 처음 방문 중앙 179ms(136~1,445), 다시 방문 중앙 87.5ms(43~286), **증가 중앙 106.5ms**(90번째 181ms, 최대 1,348), 업스트림 데움 중앙 68ms. **처음 방문 1:1 대체 칸 0/30 = 0%**(Wilson 95% 신뢰구간 0~11.4%). 1:1 칸 2건은 실제 정사각 사진(509×509, 1500×1500)이었다. 처음 방문이 1.3초를 넘은 3건(1,301 / 1,360 / 1,445ms)도 칸은 제 비율이라 크기 읽기는 300ms 안에 끝났고, 늦어진 원인은 크기 읽기 밖(함수 콜드 스타트 등으로 추정, 확인하지 않음)이다.
        - **판정: 통과**(증가 중앙 106.5ms ≤ 150ms, 1:1 0% ≤ 10%). 다만 30건이라 1:1 비율의 신뢰구간 상단(11.4%)은 10%를 넘는다. 게이트 측정 밖에서 배포 확인 때 연 공고 1건은 처음 방문이 1:1(시간 초과)이었고 다시 열면 제 비율(0.894)이었다. 대체 칸이 잦아지는지는 서버 로그 `image size unavailable`(reason별)로 지켜본다.
51. 목록 카드 사진 1:1, 가운데(2026-10-12). 카드 사진 칸을 **4:5 → 1:1**, 위치를 **center 35% → center**로 바꿨다. 50의 "목록 카드는 4:5 cover 그대로"와 PRD v1.3의 "목록 카드는 4:5 유지, 따로 검토"를 이 항목이 대신한다.
    - **조사**(저장소 밖 `C:\side\nyanggonggo-review\card-crop\`, 2026-10-12): 50의 실측에서 첫 사진 기준으로 공고 60건(4:3 가로 35, 3:4 세로 15, 정사각 10, 지역·축종·상태를 섞음)을 골라 다섯 방식을 비교했다. A 현행 4:5 center 35%, B1·B2 4:5 sharp attention·entropy, C1 1:1 center, C2 4:3 center. 카드마다 괜찮음 / 몸 일부 잘림 / 머리·얼굴 잘림으로 나눴다. 판정은 원본에 보이던 부분이 잘렸는지로 했다. 머리·얼굴 잘림은 A 4:3 6/35(17.1%)·3:4 0/15·정사각 2/10(20%), C1 4:3 2/35(5.7%)·3:4 0·정사각 0이다. 50의 비율 분포(4:3 49.7%, 3:4 36.4%, 정사각 10.1%)로 가중하면 **A 10.5% → C1 2.8%**다. 0.7 미만과 1.4 초과 구간(3.8%)은 표본에 없어 넣지 않았다. A는 한쪽에 치우친 동물을 가운데 60%만 남겨 얼굴을 잘랐다. B는 A보다 나빴다(괜찮음 60%, 철창·글씨 같은 무늬 쪽으로 쏠림). B는 프록시 처리도 늘린다(로컬, 사진 20장 중앙: 현행 48.6ms, attention +12.5ms, entropy +27ms). 또 카드 전용 크롭본이 필요해 목록과 상세 첫 사진의 URL 공유가 깨진다. C2는 가로 사진은 100% 괜찮지만 세로·정사각에서 귀 끝과 발이 자주 잘렸다(몸 일부 잘림 60%·70%). 시트와 분류는 `sheets\`, `classify.json`에 있다.
    - **변경**: `AnimalCard` 사진 칸 `aspect-square`. `AnimalPhoto`의 `cover`는 `object-center`다(cover를 쓰는 곳은 카드뿐이고 상세 캐러셀·뷰어는 contain). 목록 로딩 카드(`SkeletonCard`)의 사진 칸도 1:1이다. 그대로 둔 것: 이미지 프록시 폭(480/828/1080, srcset·sizes), 상세, 풀스크린 뷰어, OG 이미지(4:5 center 35%). 카드 사진 칸은 390 폭에서 358×447.5 → 358×358이다.
    - **측정**: production `build`+`start`(로컬), Pixel 7, 새 컨텍스트에서 변경 전·후 서버를 번갈아 쟀다. 목록 3개(서울 고양이, 경기 강아지, 부산 고양이) × 7회이고, 목록·서버마다 데우기 1회는 뺐다. 목록 LCP 중앙 **360 → 372ms**(목록별 1,312 → 648, 360 → 360, 308 → 292ms)이고 LCP 요소는 전후 모두 첫 카드 사진이다. CLS는 전후 모두 0이다. 로컬 이미지 프록시가 원본 서버를 매번 부르면서 생기는 편차(최대 4.3초)가 커서, 차이는 측정 범위 안이고 악화 신호는 없다.
    - **확인**: 단위 테스트(카드 칸 1:1·object-center, 로딩 카드 칸 1:1)를 더했다. E2E 43개를 모두 통과했다. 스크롤 복원(`data-animal-id`, list-scroll·focus)도 포함이다. 캡처는 `card-crop\compare\before\`·`after\`(같은 이름, 목록 3개 × 첫 화면·한 번 스크롤)에 있다.
    - 디자인 README 사진 규칙도 고쳤다. `handoff.md`와 `기능명세서.md`의 카드 4:5 문구는 고치지 않았다(이 항목이 우선).
52. 요청 단위 계측(2026-10-12). 50의 게이트에서 상세 처음 방문 30건 중 3건이 1.3초를 넘었고(사진 크기 읽기는 300ms 안에 끝남) 원인이 콜드 스타트, 공공 API, 렌더 중 무엇인지 모른다. 46의 공공 API 응답시간 재측정도 이 데이터로 한다. **동작은 바꾸지 않고 기록만 한다.**
    - **무엇을 재나**: 상세 페이지(`/animals/[id]`)와 목록 API(`/api/animals`)의 요청마다 JSON 한 줄을 stdout(`console.log`, Vercel에서는 info 레벨)에 남긴다. 예(로컬 production, 상세 처음 방문):
      `{"perf":"detail","id":"411315202600742","cold":true,"uptimeMs":6168,"upstreamMs":53,"upstreamCache":"miss","upstreamPages":1,"upstreamMisses":1,"imageSizeMs":111,"imageSize":"miss","totalMs":169,"ok":true}`
      - `cold`: 이 모듈 인스턴스가 계측한 첫 요청(모듈 스코프 플래그). 상세와 목록은 번들이 달라 각자 첫 요청이 `true`다. 같은 함수 인스턴스가 다른 라우트(OG 이미지 등)를 먼저 처리했을 수 있어 `uptimeMs`(프로세스가 뜬 뒤 지난 시간)를 함께 본다. Vercel 로그의 Function 상세에 있는 start type(cold/warm)이 기준이고 이 두 값은 보조다.
      - `upstreamMs`: 업스트림 페이지 캐시(`unstable_cache`) 조회를 포함한 공공 API 시간. 여러 페이지면 첫 요청 시작부터 마지막 끝까지. `upstreamCache`: `miss`(한 페이지라도 받아서 기다림), `stale`(만료된 값을 바로 받고 갱신은 뒤에서), `hit`. `upstreamPages`, `upstreamMisses`는 페이지 수와 그중 miss 수. 페이지 요청 전에 끝나면(입력 오류 등) 이 필드가 없다.
      - `imageSizeMs`, `imageSize`(상세만): 첫 사진 크기 읽기. `hit`(캐시), `miss`(원본에서 읽음), `timeout`(300ms), `error`(그 외 실패), `skip`(사진 없음, 허용되지 않은 주소).
      - `imageSizeCacheMs`, `imageSizeFetchMs`(상세만, 2026-10-14 추가): `imageSizeMs`를 나눈 값. `imageSizeFetchMs`는 원본 받기와 헤더 읽기(load가 불린 때부터 끝나거나 시간 초과로 끊길 때까지)이고 원본을 받으러 갔을 때만 있다. `imageSizeCacheMs`는 나머지(데이터 캐시 조회, miss면 저장 포함)다. 캐시 조회에서 시간 초과면 `imageSizeFetchMs` 없이 전부 캐시 시간이다. 콜드 인스턴스의 `timeout`(아래 결과)이 캐시 조회 때문인지 원본 받기 때문인지 보려고 넣었다.
      - `totalMs`: 상세는 `generateMetadata`와 페이지 중 먼저 계측을 시작한 때부터 사진 크기까지 끝난 때까지(React cache로 한 요청이 한 기록을 쓴다), 목록은 라우트 시작부터 응답 객체를 만든 때까지. **렌더와 전송은 들어가지 않는다.** 따라서 바깥에서 잰 시간 − `totalMs`가 렌더·콜드 스타트·네트워크 몫이다.
      - `ok`(상세: 공고 조회 성공), `status`(목록: HTTP 상태).
      - 목록 API는 같은 값을 `Server-Timing` 헤더로도 보낸다(`upstream;dur=402;desc="miss", total;dur=415, cold`). 오류 응답에도 붙는다. CDN HIT는 함수가 돌지 않아 로그가 없고, 헤더는 캐시된 원래 응답의 값이다(`x-vercel-cache`로 구분). 상세 페이지는 헤더를 붙이지 않고 로그만 남긴다.
      - 서비스키, 공공 API URL, 사진 URL은 넣지 않는다(공고 id만, 공개 정보). 테스트가 키·호스트가 없는지 본다.
    - **위치**: 기록기는 `src/server/perf/request-perf.ts`(서버 전용, FSD 밖). 업스트림 시간과 적중 여부는 조립 지점(`server/animals/container.ts`의 `getAnimalService(perf)`)이 페이지 캐시를 감싸서 잰다. 클라이언트·소스·서비스는 바꾸지 않았다. 사진 크기 결과는 `createImageSizeReader`가 돌려주는 콜백(`onResult`)으로 받는다(캐시 load가 불렸는지로 hit/miss). 기록을 만들고 로그를 남기는 것은 app(`app/animals/[id]/animal-data.ts`의 `getDetailPerf`, `page.tsx`, `app/api/animals/route.ts`)뿐이다. 3절 경계 규칙 그대로다(FSD 계층은 계측을 모른다).
    - **오버헤드**(로컬 production, 변경 전 HEAD와 변경 후를 다른 포트에 같이 띄우고 번갈아 7회, 중앙값): 상세 캐시 따뜻함 10.1 → 10.8ms, 목록 API 캐시 따뜻함 7.0 → 8.0ms, 상세 처음 방문(공고 7건, 서버마다 처음) 85 → 81ms. 차이는 측정 편차 안이다.
    - **수집 방법(배포 후)**: Vercel CLI `vercel logs`(https://vercel.com/docs/cli/logs). **Hobby는 런타임 로그를 1시간만 보관한다**(https://vercel.com/docs/logs/runtime, Pro 1일). 측정을 마치면 1시간 안에 받는다.
      - 준비(EL): Vercel CLI 설치(`npm i -g vercel`, 저장소 의존성 아님), `vercel login`, 저장소에서 `vercel link`(`.vercel/`은 커밋하지 않음, `.gitignore`에 있다).
      - 받기: `vercel logs --environment production --no-branch --since 1h --query perf --json --limit 1000 > perf-YYYYMMDD.jsonl`. 기본 100건이라 `--limit`을 준다. JSON Lines의 메시지 필드에 이 한 줄이 들어 있을 것으로 보지만 출력 모양은 첫 수집 때 확인한다(미확인). 안 되면 대시보드 Logs에서 `perf`로 검색하고 요청별로 Function 상세(start type)와 함께 본다.
      - 해석: 처음 방문이 느린 요청에서 `upstreamMs`가 크면 공공 API, `cold: true`·`uptimeMs`가 작거나 start type이 cold면 콜드 스타트, `totalMs`는 작은데 바깥 시간이 크면 렌더·전송이다. 46의 재측정은 `upstreamCache: "miss"`인 줄의 `upstreamMs`(목록은 페이지 수와 함께)로 한다.
    - **확인**: 단위 테스트(`request-perf.test.ts`: cold 첫 요청만, miss/hit/stale, 여러 페이지 시간, 실패해도 기록, 한 번만 기록, Server-Timing 값. `image-size.test.ts`: hit/miss/timeout/error/skip. 라우트·상세 페이지 테스트: 요청당 한 줄, 키·URL 없음, 오류 응답의 Server-Timing). 로컬 production에서 로그 줄과 헤더를 확인했다. E2E 42 통과, 1 건너뜀(detail-photo 4:3 가로 대표 공고가 조회되지 않아 원래 규칙대로 건너뜀).
    - **결과(배포 후, 2026-10-13·14)**: 저장소 밖 스크립트(`nyanggonggo-review/perf`의 `measure.mjs`, `fetch-logs.mjs`, `analyze.mjs`)로 한 번도 열지 않은 공고 상세 30건을 처음 방문하고 목록 API를 지역·축종·상태를 바꿔 20번 부른 뒤(공고 고르기 목록 요청도 기록), 1시간 안에 Vercel 요청 로그(시작 유형 `functionStartType`, `functionColdStartDurationMs` 포함)를 받아 요청 id로 맞췄다. 맞추지 못한 요청 0건. 시작 유형은 `vercel logs --json`에 빠져 있어 CLI가 쓰는 요청 로그 엔드포인트의 원본에서 읽었다.
      - 1회차(10-13 11:43 KST, 11분 전부터 시험 요청 6건이 있어 첫 콜드 스타트가 그쪽에 잡힘): 측정 요청의 콜드 스타트 0건(hot 59, prewarmed 1). 상세 처음 방문 30건 중앙 177ms / 90번째 218ms, 모두 1초 안. 1초 넘은 목록 3건(1,106·**1,314**·1,215ms)은 모두 공공 API(`upstreamMs` 1,041(2페이지)·1,279·1,173ms)였다.
      - 2회차(10-14 09:31 KST, 그날 아침 운영 요청 없음, 시험 요청 없이 바로 측정): 콜드 스타트 3건. 함수 인스턴스 3개(목록 2, 상세 1)의 각 첫 요청이고 그 뒤 57건은 hot이었다. 상세 처음 방문 30건 중앙 143ms / 90번째 874ms.

        | 요청 | 밖에서 잰 전체 | Vercel 콜드 스타트 | `uptimeMs` | `totalMs` | `upstreamMs` | `imageSizeMs` | 함수 실행 − `totalMs` | 밖 − `totalMs` |
        |---|---|---|---|---|---|---|---|---|
        | 목록 API(첫 요청) | **1,590** | 344 | 394 | 406 | 375(miss) | — | 158 | 1,184 |
        | 목록 API(두 번째 인스턴스) | 910 | 356 | 408 | 178 | 118(stale) | — | 663 | 732 |
        | 상세 처음 방문 | **1,652**(TTFB 1,143) | 363 | 601 | 651 | 326(miss) | 306(**timeout**) | 555 | 1,001 |

      - 2회차에서 1.3초를 넘은 요청은 위 굵은 2건뿐이고 둘 다 콜드 스타트다. hot 요청 중 가장 느린 것은 상세 1,197·1,211ms(공공 API 1,090·1,104ms, 46)였다.
      - 숫자로 확인된 것: 상세 1,652ms = Vercel 콜드 스타트 363 + 데이터 불러오기(`totalMs`) 651(공공 API miss 326 + 사진 크기 읽기 306, 300ms 제한에 걸려 `timeout`) + 함수 안에서 데이터 불러오기 밖 555 + 나머지 83(Vercel 요청 시간 1,644 − 함수 1,206 − 콜드 스타트 363 = 75, 밖 − Vercel 요청 시간 8). 목록 1,590ms = 콜드 스타트 344 + `totalMs` 406(공공 API miss 375) + 함수 안 나머지 158 + Vercel 요청 시간 중 함수·콜드 스타트 밖 513 + 밖 − Vercel 요청 시간 169.
      - 추정(나누지 않음): 함수 안 데이터 불러오기 밖 시간(상세 555, 목록 158·663)은 첫 요청의 모듈 로드·렌더 몫으로 보인다. 목록 첫 요청의 513ms는 Vercel 로그로는 어디에 쓰였는지 나오지 않는다. 콜드 인스턴스의 사진 크기 읽기 `timeout`은 첫 연결 비용으로 보이며, 50의 규칙대로라면 이 요청은 첫 사진 칸이 대체 비율로 나갔다(화면은 확인하지 않음).
      - 정리: 처음 방문이 1.3초를 넘는 것은 콜드 스타트 요청이다. 콜드 스타트 자체(약 350ms)만으로는 넘지 않고, 같은 요청의 공공 API miss·사진 크기 timeout·첫 실행 비용이 더해져 넘는다. hot 요청은 공공 API가 튈 때만 1초를 넘었다(1회차 목록 1건은 그것만으로 1.3초를 넘었다).
      - 3회차(10-20 09:13 KST, 그날 아침 운영 요청 없음, 시험 요청 없이 바로 측정, 1·2회차와 같은 설정: 상세 30·목록 20, 저장소 밖 `perf/run3-*`). **배포가 바뀌었다**: 2회차 뒤 1단계(색·그림자), PRD v1.4(상세 뒤로가기), 2단계(Jua)가 들어간 main(`df40516`)이라 `totalMs`와 함수 안 기타 시간은 2회차와 바로 비교하지 않는다. 콜드 스타트 2건(함수 인스턴스 3개 중 2개의 첫 요청), 쿼터 오류 없음.

        | 요청 | functionStartType | 콜드 스타트 | uptimeMs | upstreamMs | imageSizeMs | imageSizeCacheMs | imageSizeFetchMs | totalMs | 함수 실행 | 밖에서 잰 전체(TTFB) | 밖 − totalMs |
        |---|---|---|---|---|---|---|---|---|---|---|---|
        | 목록(고르기 첫 요청) | cold | 346 | 404 | 527(miss) | - | - | - | 542 | 1,080 | 1,724(1,720) | 1,182 |
        | 상세 처음 방문 | cold | 369 | 612 | 286(miss) | 140(miss) | 15 | 125 | 437 | 1,035 | 1,418(1,183) | 981 |

      - 확인한 것: 3회차의 콜드 상세는 사진 크기 읽기가 300ms 안에 끝났다(`miss` 140ms = 캐시 조회 15 + 원본 받기 125). 3회차 상세 30건 중 300ms를 넘은 사진 크기 읽기는 없다(hot 29건 `imageSizeMs` 중앙 103 / 90번째 160, 캐시 조회 5 / 5, 원본 받기 99 / 155). 그래서 **2회차의 콜드 timeout(306ms)이 캐시 조회 때문인지 원본 받기 때문인지는 이번에도 판정하지 못했다**(timeout이 다시 나지 않았다). 1~3회차 전체에서 300ms를 넘은 것은 2회차 콜드 1건뿐이다.
      - 추정: 3회차 콜드의 캐시 조회 15ms는 hot(5ms)보다 크지만 300ms와는 거리가 멀어, 콜드에서 사진 크기 읽기를 늦추는 쪽은 캐시 조회보다 원본 받기(사진 서버 응답 편차, 46·50)일 가능성이 크다. 한 건이라 근거가 약하다. 콜드 상세의 1.4초는 2회차처럼 콜드 스타트(369) + 함수 안 데이터 밖 시간(1,035 − 437 = 약 600, 모듈 로드·렌더로 보임) 몫이 크고, 이번에는 데이터 불러오기(437)가 짧았다.
      - 남은 것: 그대로(다음 운영 콜드 측정에서 timeout이 나면 `imageSizeCacheMs`·`imageSizeFetchMs`로 나눈다).
    - **로컬 구간 측정(2026-10-14)**: 콜드 상세 요청의 함수 안 데이터 불러오기 밖 시간(2회차 555ms)을 나누려고 로컬에서 쟀다. 방법: `next build` 후 매번 데이터 캐시(`.next/cache/fetch-cache`)를 비우고 새 `next start` 프로세스를 띄워 첫 요청과 두 번째 요청만 보냈다(3회 중앙값). 공공 API는 로컬 고정 데이터(500건 한 페이지)로, 사진은 로컬 파일로 바꿨다(사진만 따로 실제 원본으로 3회 더). Vercel은 minimal mode라 시작할 때 라우트 모듈을 미리 불러오지 않으므로 로컬도 `experimental.preloadEntriesOnStart`를 껐다. 측정 코드(앱 마커, require·외부 import 시간 훅, fetch 대체)는 임시로만 넣고 되돌렸다(커밋 없음).

      | 상세 구간(ms) | 첫 요청 | 두 번째 |
      |---|---|---|
      | 라우트 코드 불러오기(요청 도착 → 페이지 시작) | **179** | 4 |
      | ↳ 서버 청크 require(그중 페이지 청크 66) | 95 | 0 |
      | ↳ sharp 첫 import | 53 | 0 |
      | 데이터 불러오기(고정 데이터, `totalMs` 구간) | 86 | 9 |
      | ↳ 공공 API 단계 / 사진 크기 읽기 | 76 / 10 | 4 / 4 |
      | 렌더(데이터 끝 → 응답 끝) | 44 | 7 |
      | 전체 | 309 | 24 |

      - 목록 API: 라우트 코드 불러오기 111 / 3(라우트 청크 62), 데이터 45 / 22, 응답 만들기 6 / 1, 전체 160 / 27. sharp는 불러오지 않는다.
      - 확인: 데이터 불러오기 밖은 첫 요청 223ms(코드 불러오기 179 + 렌더 44), 두 번째 11ms이고 가장 큰 것은 코드 불러오기다. 시작할 때 모듈을 미리 불러오게 켜도 sharp(52ms)는 첫 요청에서 불러온다(Turbopack이 외부 ESM으로 늦게 import한다).
      - 사진 크기 읽기(실제 원본): 첫 148 / 두 번째 107ms, 그중 원본 응답 대기 104 / 93, sharp 첫 헤더 읽기 5 / 1, 캐시 조회 5 / 2. sharp import는 이 구간 밖(페이지 시작 전)이다. 콜드 몫은 약 40ms라 로컬에서는 모듈 불러오기도 원본 받기도 300ms 초과를 설명하지 못한다.
      - 추정: 로컬 223ms와 Vercel 555ms의 비로 보면 Vercel에서 코드 불러오기 약 440ms, sharp 약 130ms다(Vercel CPU 속도와 라우트 코드를 init(콜드 스타트 363ms)에서 불러오는지 요청에서 불러오는지는 확인하지 않음). 콜드 상세의 사진 크기 timeout(306ms)은 같은 요청의 공공 API miss 326ms(hot 중앙 39ms)와 함께 생겼다. 둘 다 Vercel 데이터 캐시 조회와 새 연결을 거치는 공통점이 있으나 로컬은 파일 캐시라 재현되지 않았다(위 `imageSizeCacheMs`·`imageSizeFetchMs`로 다음 측정에서 나눈다).
    - **Vercel 프로젝트 설정 확인(2026-10-14, 읽기만)**: Fluid compute 켜짐(프로젝트 `resourceConfig.fluid: true`, 배포 `functionType: "fluid"`), Node 24.x. 함수 코드 캐싱(bytecode caching)은 미확인이다(프로젝트·배포 정보에 켜고 끄는 필드가 없고, 배포의 환경 변수 이름 목록에 `VERCEL_USE_BYTECODE_CACHING`이 있을 뿐이다).
    - **사진 크기 읽기는 sharp를 계속 쓴다(결정, 2026-10-14)**: sharp 첫 import(로컬 53ms)를 빼려고 `image-size` 패키지(2.0.4, 설치 스크립트·의존성 없음)를 검토했으나 쓰지 않는다. 손상된 JPEG(앞 2바이트만 JPEG이고 나머지가 깨진 파일)에서 1바이트씩 복사하며 훑어 시간이 크기의 제곱으로 늘고, 동기라 이벤트 루프를 막는다. 지금 방식(8KB마다 다시 읽기, 한도 256KB)으로는 누적 최대 약 34초(한 번에 최대 3.1초), 64KB 한도면 29ms, 32KB면 거의 0이었다. 300ms 시간 초과로도 끊을 수 없다(sharp는 스레드 풀에서 돌아 막지 않는다). 설치했던 패키지는 지웠다(`package.json`·lockfile 원래대로).
    - **계측 유지(결정, 2026-10-14, EL 확인)**: 유지한다. 로그는 함수가 돈 요청에 한 줄씩(CDN HIT는 없음)이라 양이 작고, 콜드 요청의 Vercel 쪽 시간(목록 513ms)과 사진 크기 timeout의 원인이 아직 나뉘지 않았으며, 공공 API의 짧은 튐을 이 줄로만 볼 수 있다.
    - **남은 것**: 다음 운영 콜드 측정에서 `imageSizeCacheMs`·`imageSizeFetchMs`로 콜드 사진 크기 timeout을 나눈다. 코드 불러오기(페이지 청크, sharp)를 줄일 방법은 미결이다.
53. ~~찜 화면의 부분 실패~~ **해결됨(2026-10-22, 이슈 [#5](https://github.com/bluel00/nyanggonggo/issues/5))**: 일부 실패는 받은 카드 + 목록 위 한 줄과 [다시 시도](실패한 것만), 전부 실패는 오류 화면(5절 by-ids, 8절). 이전 기록(2026-10-14, 백로그): `getAnimalsByIds`에서 id 하나의 공공 API 조회가 HTTP 오류이면 by-ids 요청 전체가 실패하고(502) 찜 화면 전체가 에러 상태가 된다(`src/server/animals/service.ts:59` 주변). 빈 결과(조회되지 않는 id)는 8절대로 화면에서만 빠진다.
54. ~~상세 로딩 뼈대의 사진 넘김 점 줄~~ **결정: 항상 자리를 둔다(2026-10-19, EL)**. 뼈대는 사진 장수를 몰라 점 줄 자리(12px + 6px)를 늘 두는데, 상세는 사진이 2장 이상일 때만 점 줄을 그려 사진 한 장 공고는 뼈대 → 상세에서 사진 아래가 18px 올라갔다(14.4 2단계에서 발견). 상세도 점 줄 자리를 사진 수와 상관없이 늘 두고 1장 이하면 비워 둔다(`image-carousel.tsx`의 `CarouselDots`). `e2e/detail-title.spec.ts`가 사진 1장·2장 종료 공고로 뼈대 → 상세에서 사진 아래가 움직이지 않음을 본다.
55. 중복 사진은 거르지 않는다(2026-10-19, EL). 실측(5개 지역 466건): 두 사진의 파일 내용이 같은 공고 40.6%(주소는 모두 다름), 연사로 거의 같음 3.4%, 다른 사진 약 56%. 보호소마다 다르다(서울 77%, 부산 0%). 주소로는 판별할 수 없고 내용 비교가 필요해 비용 대비 가치가 작다고 판단.
56. ~~뒤로가기 첫 프레임의 카드 사진 빈칸~~ **PRD-v1.5로 해결(2026-10-20)**. (시험 적용 당시: 판정은 EL 실기기) 37의 픽셀 복원 뒤에도 아이폰 사파리에서 쓸어넘기기로 목록에 돌아오면 한 번 깜빡였다.
    - 원인(EL의 아이폰 화면 기록으로 확인): 사파리 캡처 화면(사진 있음) → 실제 목록 첫 프레임에서 **카드 사진만 회색 빈칸** → 다음 프레임에 사진이 나타난다. 스크롤 위치, 배지, 글자는 그대로다. 사파리가 큰 사진을 비동기로 디코드하고, 화면에서 안 보이던 사진의 디코드 결과를 버리기 때문으로 본다(추정).
    - 헤드리스 재현 안 됨: Playwright screencast로 뒤로가기 직후 그려진 프레임을 모두 받아, 화면 안 카드 사진 칸이 최종 프레임과 다른(빈) 프레임을 셌다. Chromium·WebKit × 화면 안 버튼·`history.back()`, 스텁 단색 사진과 큰 사진(1080² 잡음 JPEG) 모두 0. 양성 대조(목록이 붙는 순간 카드 사진을 한 프레임 숨김)는 8/8 잡혀 판정 방법은 한 프레임 빈칸을 볼 수 있다. Windows용 Playwright WebKit과 Chromium은 사파리의 이 동작이 없다.
    - 시험한 방법(A): 목록으로 돌아와 복원할 때(캐시로 그려진 목록, 그리기 전 layout effect), 스크롤 영역 안에 걸친 카드 사진만 `decoding="sync"`로 바꾼다(`shared/ui/app-column.ts` `decodeVisibleCardPhotosSync`). 처음 들어올 때, 스크롤로 새로 보이는 카드, 캐시가 지워져 다시 받은 목록은 그대로 `async`. React로 다시 그리지 않고 DOM 속성만 바꾼다(되돌아오는 첫 프레임 앞에 카드 100장을 다시 렌더하지 않게). E2E `back-nav.spec.ts`가 속성(화면 안 sync, 밖 async, 처음 들어올 때 모두 async)을 본다. 헤드리스로는 깜빡임 자체를 볼 수 없어 회귀(E2E 전체, 목록 스크롤, 목록 LCP)만 확인했다.
    - 판정: EL이 실기기에서 쓸어넘기기 뒤로가기로 본다. **효과가 없으면 이 변경을 되돌리고 깜빡임을 받아들인다.**
    - 근본 해결 후보: 목록을 내리지 않고 상세를 위에 띄우기(목록 DOM과 디코드된 사진이 그대로 남아 돌아올 때 다시 그릴 것이 없다). 라우팅 구조(상세의 독립 주소, 공유 진입, 로딩 경계, 전환)를 바꾸는 큰 개편이라 그때 검토한다.
    - **결과(2026-10-20, EL 실기기)**: `decoding="sync"`는 효과가 없어 걷어 냈다(PRD-v1.5 R6). 시험판(`spike-stack-nav`, 목록 위에 상세 얹기)에서 깜빡임이 사라져 큰 개편을 기다리지 않고 바로 적용했다(PRD-v1.5, 7절). 시험판에서 본 "돌아온 직후 잠깐 스크롤 안 됨, 아래 사진이 잘려 보임"은 아래 목록을 `overflow: hidden`으로 막은 탓으로 보고 `inert`로 바꿨다(7절, R4).
57. ~~상세 치수·이름 정리~~ **해결됨(2026-10-23, 이슈 [#6](https://github.com/bluel00/nyanggonggo/issues/6))**. 화면 틀 정리(3절 "화면 틀")에서 범위 밖으로 둔 것이다. 모두 화면은 맞고, 다른 컴포넌트의 치수를 복사해 적은 값이거나 shared가 도메인 이름을 아는 곳이었다.
    - 토스트 오프셋: CTA 바 높이를 `--bottom-cta-h`(touch + space-3 × 2, `app/globals.css`)로 두고 `--toast-offset`은 그 값 + space-3으로 적는다. CTA 바 틀은 `widgets/animal-detail/ui/detail-frame.tsx`의 `BottomCtaBar` 하나를 실제 상세와 뼈대가 같이 쓴다.
    - 상세 뒤로가기 위치와 사진 칸 틀: 같은 파일의 `DetailPhotoArea`(칸 `px-6 pt-(--screen-top)`, 뒤로가기는 칸 왼쪽 위에서 8px 안쪽)를 실제 상세와 뼈대가 같이 쓴다.
    - 위 안전 영역 + space-3: `--screen-top`(`app/globals.css`) 하나를 헤더 줄(`ScreenHeader`), 상세(사진 칸, 오류 화면), 사진 뷰어(위 줄, 닫기)가 읽는다.
    - 전환 이름: `animal-photo-<id>`와 이동 종류 `CARD_TO_DETAIL`은 `entities/animal/ui/photo-transition.ts`로 옮겼다(카드가 entities에 있고 상세 캐러셀은 widgets라 둘이 같이 읽을 수 있는 가장 낮은 층). `shared/ui/view-transition.tsx`에는 범용 `ViewTransition` 래퍼만 남는다.
    - 하지 않은 것: 카드 사진 `sizes`의 `448px`, `calc(100vw - 32px)`(`PHOTO_SIZES`). `sizes` 속성은 CSS 변수를 읽지 못해 토큰을 참조할 수 없고, 값은 이미 한 곳에 근거 주석과 함께 있다. TS 상수로 빼면 480·16의 사본이 하나 더 생긴다.
    - 확인: 정리 전후 홈·목록·찜·상세(얹은 층·직접 진입)·상세 뼈대(로딩 경계)·사진 뷰어 20장 픽셀 비교(안전 영역 0, CDP로 흉내 낸 47/34) 모두 0픽셀 차이, 토스트 위치 같음. E2E 전체(카드 → 상세 전환 포함) 통과.
58. 사진 넘김(2026-10-21, EL): 목록 카드 넘김은 하지 않는다(상세가 목록 위에 바로 얹혀 들어가는 비용이 작고, 세로 스크롤 중 가로 넘김 오작동 위험이 크다). 상세의 넘김 UI는 지금 그대로(손가락 넘김 + 도트) 둔다. 상세의 중심은 사진이고, 44px 넘김 버튼 줄은 사진과 주의를 나누며 정보를 아래로 민다. 우리 사용자가 둘째 사진을 놓친다는 근거가 없다. 중복 사진은 결정 55대로 거르지 않는다(원인은 데이터 제공 쪽, 판별에 사진 다운로드가 필요). 다시 볼 조건: 둘째 사진을 못 찾는다는 피드백이나 데이터가 생길 때.
59. ~~작은 화면의 필터 시트 적용하기~~ **해결됨(2026-10-23, 이슈 [#23](https://github.com/bluel00/nyanggonggo/issues/23), EL이 운영 아이폰 사파리에서 확인 2026-10-23)**: 시트를 머리(핸들·제목) / 스크롤되는 내용(`sheet-body`) / 고정된 아래 영역(`SheetFooter`, [적용하기])으로 나눴다. 내용만 스크롤되고, 아래 영역은 시트와 같은 바탕(`bg-popover`)에 위쪽 `shadow-bar`, 아래 안전 영역은 상세 하단 CTA 바와 같은 `calc(space + env(safe-area-inset-bottom))`이다. 높이 상한은 `min(85%, 85svh)`(svh를 모르면 85%)이고 85%의 기준은 컬럼(`h-dvh`)이다. svh를 고른 이유: 툴바가 다 펼쳐진 가장 작은 보이는 영역이라 툴바 상태와 관계없이 시트가 그 안에 들어가고, dvh처럼 툴바가 움직일 때 시트 높이가 따라 바뀌지 않는다. E2E(`e2e/filter-sheet.spec.ts`): 375×667에서 열자마자 [적용하기]가 다 보이고 내용을 끝까지 내려도 같은 자리, 390×844·1280×800에서도 컬럼 바닥에 붙는다. 아이폰 사파리 아래 주소창 바 뒤로 들어가는 문제는 E2E로 재현할 수 없어 EL이 운영 아이폰에서 확인했다(2026-10-23, 이슈 [#12](https://github.com/bluel00/nyanggonggo/issues/12) 작업 때 기록). 시트 아래쪽 위치는 여전히 컬럼 바닥(100dvh)이다. 이전 기록(이슈 [#20](https://github.com/bluel00/nyanggonggo/issues/20)에서 확인): 375×667에서 시트는 최대 높이(85%, 567px)에 닿고 내용은 684px라, 연 직후 [적용하기]가 화면 아래(724~768px)에 있어 시트 안에서 117px 내려야 보인다. 성별 묶음(88px)을 넣기 전에도 내용 약 596px로 버튼 아래쪽 약 13px가 잘려 있었다(계산값). 버튼은 시트 스크롤 끝에 있어 닿을 수는 있다(`e2e/sex-filter.spec.ts`). 고정 하단 버튼(sticky) 등은 디자인 결정이 필요하다.

## 13. 다음 버전 계획 (기록만, 설계 전)

아직 코드 작업을 하지 않은 항목이다. 다음 기능 작업에서 착수한다.

- ~~최근 선택한 지역을 자동 기억했다가 다음 방문 시 그 지역 목록을 보여 주기~~ **완료(2026-09-29)**: localStorage 대신 쿠키로 구현했다(첫 렌더 깜빡임과 중복 요청을 피하려고). 규칙은 7절.
- 관심 지역을 여러 개 즐겨찾기로 등록해두고 칩 형태로 빠르게 전환할 수 있는 기능
- 둘 다 필요하며, UI와 저장 스키마는 아직 설계 전이다(찜 저장소와 별도 키를 쓸지, URL 기본값과 어떻게 우선순위를 둘지 등이 미정).

## 14. 디자인 방향 A "햇살 담요" (2026-10-14 결정, 구현 전)

출처: 디자인 시스템 README·handoff(2026-10-14 동기화, 11절), Design 아티팩트 "냥공고 홈 · 축종 선택"의 DirA·HomeA·MotionA. 이 절은 결정과 구현 계획만 적는다. 코드는 아직 바꾸지 않았다.

### 14.1 결정

- **방향 A**: 따뜻한 바탕 그라데이션(`bg` → `bg-end`), 흰 카드(`surface`)와 따뜻한 그림자, 모서리 22/24, 적용하기만 복숭아색 그라데이션, 제목만 Jua. 값은 `docs/design/README.md`·`handoff.md`(1·3·5단계에서 `tokens.json`·`bundle.css`·`characters.md`도 옮긴다).
- **지킬 원칙 세 가지**(꾸밈 규칙보다 먼저):
  1. **사진은 덮거나 칠하지 않는다.** 사진 위에는 지금 있는 상태 배지, 카드 찜 원, 상세 뒤로가기만 둔다. 그림자·그라데이션·후광 같은 새 꾸밈은 사진 바깥에만. 화면 전환 중에도 사진이 반투명한 바탕 아래 비치지 않게 한다.
  2. **종료 공고는 차분하게.** 누름·등장·상세 전환 효과 없이 바로 바뀌고, 그림자는 납작한 `shadow-card-ended`, 종료 상세에는 캐릭터·사진 그림자·D-day가 없다.
  3. **목록은 첫 화면에서 한 번만 움직인다.** 스크롤 중, 다음 페이지, 상세에서 돌아온 목록에는 효과가 없다.
  - 움직임 줄이기(`prefers-reduced-motion: reduce`)면 모든 효과 없이 바로 바뀐다(페이드도 없음).
- **제목 글꼴**: Jua는 고정 문구 6개("오늘은 누구를 보러 왔어요?", "고양이", "강아지", "고양이 공고", "강아지 공고", "기타 동물 공고")에만 쓴다. 이 글자만 담은 부분 글꼴 파일 하나(woff2)를 `next/font/local`로 싣는다. **상세 제목은 Pretendard 24/32/700**이다. 빠진 글자는 Pretendard로 보인다.
  - 근거 1: 상세 제목의 지역 이름은 `regions.ts`가 아니라 공공 API의 `orgNm`을 그대로(공백만 정리) 쓴다(`src/server/mapper.ts:53` → `regionText` → `animalTitle()`). 글자를 미리 알 수 없어 부분 글꼴에 담을 수 없다.
  - 근거 2(2026-10-14 확인): `next/font/google`은 빌드 때 Google Fonts CSS에 있는 글꼴 파일을 모두 받아 자체 호스팅하고, 브라우저는 `unicode-range`로 필요한 조각만 받는다. 미리 불러오기는 `subsets`에 맞는 조각만인데 Next 16.3.5의 글꼴 데이터에서 Jua의 subset은 `latin`뿐이라 한글 조각은 미리 불러오지 않는다. Jua는 **87조각, 합계 581KB**(조각 최소 1.3KB, 중앙 4.4KB, 최대 20.4KB, Next와 같은 요청으로 받은 woff2)이고 자주 쓰는 음절이 13~20KB 조각에 모여 있다. 화면별 예상(글자가 든 조각 합계): 홈(서비스명 + 홈 질문) 6조각 **100.1KB**, 목록 헤더 하나 3조각 53KB, 상세 제목 예("경상남도 창원시") 4조각 72KB, 지역 이름 235개 전부 11조각 194KB.
- **상세 전환**: View Transitions로 한다. 카드 사진이 상세 사진 칸의 크기·위치로 옮겨 가며 자리를 잡는다(상세 칸이 좌우 24px 안쪽이라 대개 작아진다). 1:1에서 잘렸던 부분이 드러난다(값은 README 움직임 표). 지원하지 않는 브라우저는 바탕을 바로 깔고 사진과 정보만 200ms 페이드한다. 종료 공고와 움직임 줄이기는 바로 바뀐다.
  - **구조 D1(결정, 2026-10-20, EL)**: 상세는 누르면 바로 로딩 경계(loading.tsx) → 서버 페이지라 카드 사진과 상세 사진이 같은 커밋에 없어 짝이 생기지 않는다. 그래서 목록 카드를 누를 때 그 공고(목록 데이터, 상세에 보이는 필드가 모두 있다)를 상세 캐시에 넣고, 로딩 화면이 뼈대 대신 실제 상세를 그린다. 서버 페이지가 오면 Next가 다시 마운트하고, 보이는 결과(사진이 비지 않음, 넘긴 장·스크롤 유지, CLS 0, 앞뒤 화면 같음)를 E2E로 지킨다. 데이터는 서버 데이터를 따른다. 카드 사진이 로드되지 않았거나 공유 링크 직접 진입이면 지금처럼 뼈대다. 다시 마운트 없음 조건은 철회했다(loading.tsx를 쓰는 한 Next는 로딩 화면을 페이지로 교체한다).
  - 확인(2026-10-14): App Router는 Next 안에 들어 있는 React canary(`19.3.0-canary`)를 쓰고 여기에 `ViewTransition`·`addTransitionType`이 있다. `import { ViewTransition } from 'react'`로 쓰며 **실험 기능 플래그가 필요 없다**(Next 16.3.5 동봉 문서 `01-app/02-guides/view-transitions.md`). `@types/react` 19.3.0에 타입이 있다. `next/link`의 `transitionTypes` prop(16.2 추가)으로 이동 종류를 넘길 수 있다. 저장소의 `react` 19.2.8 자체에는 없다(App Router에서는 쓰이지 않음).
  - 지원하지 않는 브라우저에서는 애니메이션 없이 바로 바뀐다(같은 문서). 따라서 **페이드 대체는 따로 만들어야 한다**(예: `document.startViewTransition`이 없을 때만 CSS 페이드를 켠다).
  - **PRD-v1.5(상세를 목록 위에 얹기, 2026-10-20)에서 다시 만듦**: 목록 카드는 화면에서 빠지지 않아 React의 이름 짝(한쪽이 빠지고 한쪽이 들어오는 같은 전환에서만 생긴다)이 생기지 않는다. 그래서 누른 순간 카드 사진 칸에 같은 사진(카드가 받아 디코드한 currentSrc)을 한 장 겹쳐 두고(`DepartingPhoto`, `entities/animal/ui/animal-card.tsx`), 주소가 상세로 바뀌는 커밋(상세 층이 붙는 커밋)에서 뺀다. 빠지는 이 사진과 들어오는 상세 사진 칸이 같은 이름이라 짝을 이룬다. 카드의 진짜 사진은 다시 만들지 않는다(다시 만들면 돌아왔을 때 사파리가 다시 디코드한다, 12절 56). 주소를 읽는 것은 이 사진뿐이라 다른 카드는 이동 때 다시 그려지지 않는다. 대체 페이드는 쓰지 않았다(전환을 지원하지 않는 브라우저용 페이드는 그대로). 뒤로가기·직접 진입·종료·움직임 줄이기는 효과 없음 그대로(E2E).
- **카드 간격**: `space-3` 12px(지금과 같다. DirA 보드는 16px로 그렸다).

### 14.2 구현 계획

단계마다 따로 확인하고 커밋한다. 각 단계는 0단계와 같은 방법으로 다시 재서 아래 통과 기준을 본다.

0. **지금 상태 측정**(기준선, 코드 변경 없음): 목록 스크롤 프레임, 홈·목록·상세 LCP. **숫자 판정은 이 실험실 측정으로 한다.** 실기기는 단계마다 EL이 직접 써 보며 끊김을 눈으로 확인한다. 안드로이드 실기기 측정(adb 원격 디버깅)은 기기가 없어 하지 않는다. iPhone도 재지 않는다.
   - 공통: 로컬 production(`build` + `start`)만 쓰고 운영 사이트에는 요청하지 않는다. 데이터와 사진은 한 번 저장해 고정했다(2026-10-14, 서울 고양이 목록 앞 60건과 사진 120장, 저장소 밖 `nyanggonggo-review/perf-ui/fixture/`). 저장 파일에는 공공 API 주소·서비스키·원본 사진 주소가 없다(사진 주소는 허용 호스트의 가짜 경로 `/fixture/<n>.jpg`로 바꿨고 연락처·종료 사유 필드는 지웠다). `next start`에 `NODE_OPTIONS=-r stub.cjs`로 서버 fetch를 가로채 이 파일로 답한다(그 밖 호스트는 막음, 공고 날짜는 저장한 날과의 차이만큼 밀어 어느 날 재도 D-day가 같다). 브라우저의 바깥 호스트 요청도 막는다. 측정 스크립트는 같은 폴더(`capture.mjs`, `stub.cjs`, `server.mjs`, `scroll.mjs`, `lcp.mjs`)이고 저장소 코드에는 들어가지 않는다.
   - 목록 스크롤: PC Chrome(Playwright 헤드리스)에서 Pixel 7 화면(`devices['Pixel 7']`, 412×839, DPR 2.625)을 흉내 내고 **CPU 6배 느리게**(`Emulation.setCPUThrottlingRate`). 서울 고양이 목록을 열고 1초 뒤 같은 스크롤 동작(CDP `Input.synthesizeScrollGesture`, 아래로 8000px, 1200px/s, 마우스 휠 방식)을 5회(회마다 새 컨텍스트). 프레임은 Chrome trace의 `PipelineReporter`(프레임마다 state)로, 스크롤 시작·끝은 `performance.mark`로 trace에 찍어 그 사이만 본다. 느린 프레임 = 제시된 프레임 사이 간격이 25ms(60Hz 한 주기의 1.5배)를 넘는 것. 메인 스레드 바쁜 비율·50ms 넘는 작업은 렌더러 메인 스레드의 `ThreadControllerImpl::RunTask` 합.
     - 6배로 정한 이유: 휠 스크롤은 컴포지터 스레드가 처리하고 CPU 스로틀은 메인 스레드만 느리게 해서, 4배와 6배 모두 60fps·느린 프레임 0~0.2%로 거의 같았다(시험 각 2회). 6배에서 메인 스레드가 더 바빠(스크롤 중 약 18%) 3단계(움직임) 같은 메인 스레드 작업이 늘면 먼저 드러나고, 흔들림은 4배와 같았다. Pixel 7은 4배 기준(Lighthouse 중급 모바일)보다 빠른 편이라 6배는 보수적인 쪽이다.
     - 터치 스크롤(`gestureSourceType: "touch"`)은 헤드리스에서 이 앱의 스크롤 컨테이너(컬럼 안 `overflow-y-auto` div)를 움직이지 못해 휠 방식을 쓴다.
   - LCP: Playwright Pixel 7, 네트워크 9Mbps/1.5Mbps/150ms(CDP), CPU 스로틀 없음(지금까지의 LCP 측정과 같다). "캐시됨" = 서버 캐시(업스트림 페이지·사진 크기)를 먼저 데운 상태, 브라우저는 매번 새 컨텍스트. 홈 `/home`, 목록 `/?species=cat&region=6110000`, 상세는 고정 데이터의 첫 보호중 공고(사진 2장). 각 7회, load 뒤 3초 기다려 마지막 LCP 후보.
1. **색·그림자·모서리·버튼 토큰**(움직임과 글꼴 제외): `tokens.json`·`tokens.css`·`bundle.css`를 옮기고 `globals.css`·Tailwind 매핑(handoff (a))을 맞춘다. 바탕 그라데이션은 움직이지 않는 컬럼에, 그림자는 흰 면에만.
2. **제목 글꼴 Jua(부분 글꼴)**: 부분 글꼴을 만드는 방법을 정한다. 도구 후보는 fontTools `pyftsubset`(`--text-file`, `--flavor=woff2`, 저장소 의존성이 아닌 로컬 도구로 한 번 돌리고 결과 woff2와 글자 목록 파일을 커밋)이다. 원본 글꼴은 Google Fonts의 Jua(배달의민족 주아)이고 SIL OFL 1.1임을 원본 저장소의 라이선스 파일로 확인하고, 라이선스 파일을 글꼴과 함께 둔다(OFL은 부분 글꼴 배포를 허용하지만 예약 글꼴 이름이 있으면 이름을 바꿔야 하므로 그것도 확인). 고정 문구 7개의 모든 글자가 파일의 cmap에 있는지 보는 테스트를 둔다(woff2의 cmap 표는 brotli 압축만이라 Node 내장 `zlib`로 읽을 수 있다. 새 의존성 없이).
3. **움직임**: 홈 등장, 축종 카드 누름, 찜 하트, 목록 첫 화면 등장(README 움직임 표의 값). 종료·움직임 줄이기에서는 효과 없음.
4. **상세 전환**(View Transitions + 지원하지 않는 브라우저의 페이드).
5. **Rive 캐릭터 선 색 `#3A2A20`**: `characters.md`와 캐릭터 SVG 원본을 옮기고(`public/characters/` 사본과 `characters-sync` 테스트 포함), 생성기를 다시 돌려 `pnpm rive:build`.

### 14.2.1 0단계 결과(2026-10-14, 기준선)

| 목록 스크롤(CPU 6배, 5회) | 중앙값 | 범위 |
|---|---|---|
| FPS | 60.7 | 60.4~60.8 |
| 느린 프레임 비율(>25ms) | 0.2% | 0~0.2% |
| 50ms 넘는 프레임 | 0 | 0~0 |
| 가장 긴 프레임 | 39.4ms | 18.8~44.5ms |
| 드롭된 프레임·체커보드 프레임 | 0% | 0~0% |
| 메인 스레드 바쁜 비율 | 18.0% | 17.3~19.2% |
| 메인 스레드 50ms 넘는 작업 / 가장 긴 작업 | 0 / 9.6ms | 0~0 / 8.6~10.5ms |

| LCP(7회) | 중앙값 | 범위 | LCP 요소 |
|---|---|---|---|
| 홈 | 440ms | 436~444ms | 캐릭터 이미지(120×120) |
| 목록 | 1,488ms | 1,460~1,516ms | 첫 카드 사진 |
| 상세 | 572ms | 560~592ms | 첫 사진 |

- 스크롤 창은 약 6.75초, 프레임 약 405개, 카드 20장(다음 페이지는 불러오지 않는 거리). 목록 LCP가 46·51의 운영·로컬 값보다 큰 것은 로컬에 CDN이 없어 이미지 프록시가 사진을 매번 줄이고(sharp) 스로틀된 망으로 받기 때문이다. 이 측정끼리만 비교한다.
- 흔들림은 모두 14.3 기준보다 작다: FPS 범위 0.4(0.7%) < 5%, 느린 프레임 0.2%p < 2%p, 50ms 넘는 프레임 0, LCP 범위 8~56ms < 100ms. 다만 시험 4회 중 2회에서 50ms를 조금 넘는 프레임이 1개씩 있었다(50.4·50.7ms, 스로틀과 무관한 PC 쪽 흔들림으로 보임). 50ms 기준은 5회 중앙값으로 보므로 한 번 튀는 것은 걸리지 않는다.
- 한계: 휠 스크롤은 컴포지터가 처리해 FPS·느린 프레임이 메인 스레드 부담에 둔하고, 헤드리스는 GPU 없이 그려서 그림자·그라데이션의 래스터 비용이 실기기와 다르다. 그래서 메인 스레드 바쁜 비율·작업 길이와 체커보드 프레임(래스터가 스크롤을 못 따라감)을 함께 남긴다. 이것들은 14.3에서 기준(결정)으로 넣었다.

### 14.3 통과 기준(결정, 2026-10-14, EL 확인)

| 항목 | 기준 | 보는 단계 |
|---|---|---|
| 목록 스크롤 FPS 중앙값 | 0단계보다 5% 넘게 떨어지지 않는다 | 1, 3, 4, 5 |
| 느린 프레임 비율(프레임 시간이 화면 주사율 한 주기의 1.5배를 넘는 프레임) | 0단계보다 2%p 넘게 늘지 않는다 | 1, 3, 4, 5 |
| 스크롤 중 50ms 넘는 프레임 | 5회 중앙값이 0단계 중앙값보다 늘지 않는다 | 1, 3, 4, 5 |
| LCP(홈·목록·상세) | 0단계보다 100ms 넘게 늘지 않는다(랩 7회 중앙값, 캐시 HIT) | 1~5 |
| 스크롤 중 메인 스레드 바쁜 비율 | 0단계 중앙값보다 5%p 넘게 늘지 않는다 | 1, 3, 4, 5 |
| 스크롤 중 메인 스레드 50ms 넘는 작업 | 0개 | 1, 3, 4, 5 |
| 덜 그려진 프레임(체커보드) | 0단계보다 1%p 넘게 늘지 않는다 | 1, 3, 4, 5 |
| **경보선**: 스크롤 중 페인트·래스터 시간 합 | 0단계의 1.5배 이하. 넘어도 실패가 아니라 **실기기 확인 대상**으로 보고한다 | 1, 3, 4, 5 |
| Jua 파일 | 20KB 이하, 홈에서 미리 불러옴(`<link rel="preload">` 또는 같은 효과의 HTTP `Link` 헤더), 고정 문구 7개의 글자가 모두 있음(테스트) | 2 |
| 움직임 줄이기·종료 공고 | 애니메이션 0(E2E에서 `getAnimations()` 길이) | 3, 4 |
| 목록 등장 | 첫 화면 카드만, 스크롤 뒤 새 카드·뒤로가기 복원에는 없음(E2E) | 3 |
| 카드를 누른 뒤 상세가 보이기까지(미리 정함, 2026-10-20) | 전환이 없을 때보다 100ms 넘게 늘지 않는다(5회 중앙값) | 4 |

- 초안에서 바꾼 점과 이유: (1) FPS 중앙값은 화면 주사율에 막혀(60Hz 폰이면 대개 60) 버벅임이 늘어도 잘 안 변한다. 그래서 느린 프레임 비율을 더했다. (2) 50ms 넘는 프레임은 회당 0~몇 개라 한 번 재서는 흔들린다. 5회 중앙값으로 비교한다. (3) LCP는 원본 사진 서버 편차가 100ms보다 훨씬 커서(12절 50·51) 캐시 HIT 랩 측정으로 한정했다. (4) Jua 100KB는 결정이 부분 글꼴로 바뀌어 20KB 이하·홈 미리 불러오기로 바꿨다.
- **3단계부터 홈 LCP(결정, 2026-10-19, EL)**: 3단계부터 홈 LCP는 등장 효과만큼 늦어진다. 홈 LCP 증가는 등장 길이(500ms) 이하, 그리고 FCP는 기준선 대비 +100ms 이하여야 한다. 등장 효과 외의 원인으로 늦어지지 않았음을 FCP로 확인한다. (원인: 등장이 투명도 0에서 시작하고 Chrome은 투명도 0인 동안의 그리기를 LCP로 세지 않는다. 투명도 0.01에서 시작하는 식의 지표 맞추기는 하지 않는다.)
- 0단계를 재 보고 기준선의 흔들림(5회 범위)이 기준보다 크면 기준을 다시 정한다. → 0단계 결과(14.2.1): 흔들림은 모두 기준보다 작아 고칠 필요가 없다.
- 메인 스레드·체커보드 세 줄(결정, 2026-10-14, EL 확인)은 FPS·느린 프레임이 메인 스레드 부담에 둔한 것을 메운다(14.2.1 한계). 5%p는 0단계 범위의 약 2.5배다.
- 경보선(결정, 2026-10-14, EL 확인): 페인트·래스터 시간 합 = 스크롤 창 안의 메인 스레드 `Paint`(기록)와 래스터 스레드 `RasterTask`(그리기) 시간의 합(같은 스레드에서 중첩되면 바깥 것만). 헤드리스는 GPU 없이 그려 실기기와 비용이 달라 실패 기준으로 쓰지 않고, 넘으면 그 단계의 실기기 확인에서 그 화면을 먼저 본다.
- 0단계의 이 값과 다른 스크롤 값은 **0단계를 다시 잰 값(stage0b)**과 비교한다: 처음 0단계는 trace를 저장하지 않아 다시 계산할 수 없었다. 코드가 같은 main(`8094749`)에서 같은 방법으로 다시 쟀고(2026-10-14, trace 저장), 페인트·래스터를 보려고 trace 범주(`disabled-by-default-devtools.timeline`)를 더해 메인 스레드 바쁜 비율이 18.0 → 21.0%로 조금 올랐다(추적 부담). 그래서 1단계부터는 같은 범주로 잰 stage0b가 기준선이다. LCP는 방법이 같아 처음 0단계 값을 그대로 쓴다.
- **실기기 확인 방법**(결정, 2026-10-20, EL. 2026-10-14 결정을 바꿈): 자동 검사와 14.3 기준을 통과하면 main에 합치고 운영에서 EL이 확인한다. 문제가 있으면 Vercel 이전 배포로 되돌린 뒤 고친다. 미리보기 확인은 위험이 큰 변경에만 쓴다. 숫자 판정은 위 실험실 측정으로 한다. (이전: 단계마다 브랜치 미리보기 배포에서 EL이 확인한 뒤 main에 합쳤다.)

### 14.4 단계 결과

**1단계(색·그림자·모서리·버튼, 브랜치 `stage-1-tokens`, 2026-10-14)**

- 바꾼 것: 토큰(`tokens.json` 원본 그대로, `tokens.css`·`globals.css`), 컬럼 바탕 그라데이션(움직이지 않는 컬럼 `app-column`, 스크롤 영역에는 바탕 없음), 카드·스켈레톤·칩·셀렉트·세그먼트·시트를 `surface` + 그림자로(카드 글자 영역 10/12/12px, 사진은 카드 위쪽에 붙고 카드 모서리로 잘림), 종료 카드 `shadow-card-ended`(누르는 동안 그림자 변화 없음), 적용하기 `Button variant="apply"`, 필터 버튼·상세 찜 버튼은 흰 바탕 + `shadow-control`, 상세 사진 칸 좌우 24px 안쪽·`radius-card`·칸 둘레 `shadow-photo`(종료 없음, 뒤로가기는 칸 왼쪽 위 8px), CTA 바 `shadow-bar`, 홈 선택 카드 `radius-choice` + `shadow-card` + 캐릭터 뒤 104px 후광(`choice-halo` → `choice-halo-end` 72%, 원본에 구현이 없어 README 문장대로), 서비스명 `logo` 색. 사진 칸 비율 규칙은 그대로이고 폭만 좁아졌다. 사진 위·안에는 그림자·그라데이션이 없다.
- 넣지 않은 것: 움직임(카드 누름 크기 변화는 지금 그대로, 종료 카드의 누름 제거는 3단계), 글꼴(제목은 아직 Pretendard), 캐릭터, 카드 찜 원 40px(지금 44px photo-pill 그대로).
- 측정(0단계와 같은 방법, 스크롤 5회 CPU 6배, LCP 7회):

  | 항목 | 기준선(stage0b, LCP는 0단계) | 1단계 | 기준 | 판정 |
  |---|---|---|---|---|
  | FPS 중앙값 | 60.6 (60.4~60.7) | 60.5 (60.4~60.8) | −5% 이내 | 통과 |
  | 느린 프레임 비율 | 0.2% (0~0.2) | 0.2% (0.2~0.2) | +2%p 이내 | 통과 |
  | 50ms 넘는 프레임(5회 중앙값) | 0 (0~0) | 0 (0~1) | 늘지 않음 | 통과 |
  | 메인 스레드 바쁜 비율 | 21.0% (18.0~22.1) | 19.3% (18.3~21.2) | +5%p 이내 | 통과 |
  | 메인 스레드 50ms 넘는 작업 | 0 | 0(가장 긴 작업 12.6ms) | 0 | 통과 |
  | 덜 그려진 프레임 | 0% | 0% | +1%p 이내 | 통과 |
  | 경보선: 페인트·래스터 합 | 52.4ms (46.0~61.1) | 62.4ms (53.0~67.3), **1.19배** | 1.5배 이하 | 넘지 않음 |
  | LCP 홈 | 440ms (436~444) | 460ms (452~464) | +100ms 이내 | 통과 |
  | LCP 목록 | 1,488ms (1,460~1,516) | 1,476ms (1,456~1,520) | +100ms 이내 | 통과 |
  | LCP 상세 | 572ms (560~592) | 572ms (564~604) | +100ms 이내 | 통과 |

  - 래스터만 보면 27.6 → 32.5ms(+18%)로 그림자·그라데이션만큼 늘었고 페인트(기록)는 흔들림 안이다. 상세 LCP 요소는 같은 첫 사진인데 칸이 좁아져 면적이 139,446 → 108,640으로 줄었다.
  - 스크린샷(저장소 밖): `nyanggonggo-review/perf-ui/screens/stage1/` 홈, 목록(위·스크롤), 필터 시트, 상세 보호중(위·아래), 상세 종료, 목록 종료, 찜 빈 상태, 목록 오류, 상세 오류. 오류 화면은 스텁이 대구(`6270000`) 목록을 실패로 답하고, 상세는 없는 id로 연다.
  - 실기기 확인: 아직(브랜치 미리보기 배포 후 EL).

**2단계(제목 글꼴 Jua, 브랜치 `stage-2-font`, 2026-10-19)**

- 원본·라이선스: Google Fonts 저장소 `google/fonts`의 `ofl/jua/Jua-Regular.ttf`(커밋 `69d2493`, sha256 고정, 출처 저장소 `woowabros/Jua`). SIL OFL 1.1이고 **예약 글꼴 이름(Reserved Font Name)이 없다**(google/fonts·woowabros 두 OFL.txt의 저작권 줄, 글꼴 name 13번 확인). 그래서 부분 글꼴의 이름을 바꾸지 않았다. `OFL.txt`를 글꼴 옆에 둔다.
- 부분 글꼴(2026-10-26 갱신: #64에서 "멍냥공고"로 9,096바이트, #66에서 홈 이름이 로고 그림이 되어 그 줄을 빼 8,436바이트, 문구 6개): `src/shared/assets/fonts/jua-subset.woff2` **8,660바이트**(25글자: 고정 문구 7개 + 공백·물음표). 다시 만들기: `node scripts/jua-subset.mjs`(uvx로 `fonttools==4.60.1`·`brotli==1.1.0`을 임시 환경에서 돌림, 저장소 의존성 아님), 글자 목록 `jua-subset.txt`.
- 싣기: `src/shared/ui/display-font.ts`(`next/font/local`, `display: swap`). 미리 불러오기는 이 모듈을 가져오는 홈·목록에만 붙고, Next가 HTML `<link>`가 아니라 **HTTP `Link: …; rel=preload; as="font"` 헤더**로 보낸다(상세·찜에는 없음). 14.3 기준 문구를 이 헤더도 인정하게 고쳤다. 브라우저는 약 180ms에 요청을 시작한다.
- 대체 글꼴 크기 맞춤: Next의 `adjustFontFallback`은 a~z 평균 폭으로 Arial을 맞추는 방식이라 라틴 글자가 없는 이 파일에는 효과가 없어 끄고, 스크립트가 만드는 `jua-fallback.css`의 "Jua Fallback"(Pretendard dynamic subset의 같은 파일, 고정 문구 글자만, `size-adjust` 95.32%·ascent 83.93%·descent 20.98%·line-gap 26.23%)을 대체 글꼴 첫 순서에 둔다.
- 적용: 홈 서비스명 `display-logo`, 홈 질문 `display-home`, 홈 고양이·강아지 라벨과 목록 제목 `display-title`(Jua). 상세 제목은 보호중·임박 `display-detail`(Pretendard 24/32/700), 종료는 `title` 그대로. 상세 제목 줄은 상태와 상관없이 32px이다(종료 공고는 글자만 title 20px, `leading-8`). 뼈대 제목 높이도 32px이고, 뼈대 → 종료 공고 상세에서 제목과 그 아래가 움직이지 않음을 E2E로 본다(`e2e/detail-title.spec.ts`, 사진 1장·2장). 사진 1장 공고의 점 줄 자리 차이(18px)도 같은 브랜치에서 고쳤다(12절 B 54 결정). 토큰 `.display-*` 클래스는 font-family가 "Jua" 이름이라 쓰지 않고 Tailwind `text-display-*` + `displayFont.className`을 쓴다.
- 테스트: `tests/design/jua-subset.test.ts`(cmap에 고정 문구의 모든 글자, 그 밖의 글자 없음, 20KB 이하, 글자 목록, OFL, 대체 글꼴 범위), `tests/design/jua-usage.test.tsx`(Jua를 쓰는 파일·횟수 고정, 홈·목록 헤더에서 Jua가 붙은 요소의 글자가 고정 문구뿐), 상세 제목 크기(`animal-detail.test.tsx`).
- 측정(0단계와 같은 방법, 스크롤 5회 CPU 6배, LCP·CLS 7회):

  | 항목 | 기준선(stage0b, LCP는 0단계, CLS는 1단계 main) | 2단계 | 기준 | 판정 |
  |---|---|---|---|---|
  | Jua 파일 | - | 8.5KB 전송, 홈·목록 미리 불러옴, 7개 문구 글자 모두(테스트) | 20KB 이하·홈 미리 불러옴 | 통과 |
  | FPS 중앙값 | 60.6 (60.4~60.7) | 60.5 (60.5~60.7) | −5% 이내 | 통과 |
  | 느린 프레임 비율 | 0.2% (0~0.2) | 0.2% (0.2~0.2) | +2%p 이내 | 통과 |
  | 50ms 넘는 프레임(5회 중앙값) | 0 (0~0) | 0 (0~0) | 늘지 않음 | 통과 |
  | 메인 스레드 바쁜 비율 | 21.0% (18.0~22.1) | 16.6% (15.4~17.8) | +5%p 이내 | 통과 |
  | 메인 스레드 50ms 넘는 작업 | 0 | 0(가장 긴 작업 16.2ms) | 0 | 통과 |
  | 덜 그려진 프레임 | 0% | 0% | +1%p 이내 | 통과 |
  | 경보선: 페인트·래스터 합 | 52.4ms (46.0~61.1) | 54.1ms (49.4~57.6), **1.03배** | 1.5배 이하 | 넘지 않음 |
  | LCP 홈 | 440ms (436~444) | 424ms (420~436) | +100ms 이내 | 통과 |
  | LCP 목록 | 1,488ms (1,460~1,516) | 1,452ms (1,440~1,508) | +100ms 이내 | 통과 |
  | LCP 상세 | 572ms (560~592) | 564ms (556~584) | +100ms 이내 | 통과 |
  | CLS 홈 / 목록 / 상세 | 0 / 0 / 0 | 0 / 0 / 0 | 늘지 않음 | 통과 |

  - LCP 요소는 그대로다(홈 캐릭터 120×120, 목록 첫 카드 사진, 상세 첫 사진). 글꼴 교체 확인으로 Jua 응답을 1.5초 늦춰도(3회) 홈·목록 CLS는 0이었다(목록은 chevron이 값 0인 이동 2건).
  - 측정 스크립트 `lcp.mjs`에 CLS·Jua 요청 기록과 `JUA_DELAY_MS`를 더했다(저장소 밖). 스크린샷 `nyanggonggo-review/perf-ui/screens/stage2/`.
  - 실기기 확인: 아직(브랜치 미리보기 배포 후 EL).

**3단계(움직임, 브랜치 `stage-3-motion`, 2026-10-19)**

- 바꾼 것(CSS animation·transition만, transform 계열·opacity만, 움직임 라이브러리 없음, 움직임 줄이기면 모두 없음):
  - 홈 등장: 제목(부제 포함) → 고양이 카드 → 강아지 카드 → 링크에 `data-enter="home"`와 순서(`--enter-i`). 320ms ease-out, 60ms 간격, 12px, 500ms에 끝(globals.css `enter-rise`).
  - 캐릭터 greet: Rive 런타임·.riv는 미리 받고, 인스턴스는 마지막 등장(링크)의 애니메이션이 끝난 뒤 만든다(`SpeciesCharacter`의 `play`). 그래서 greet이 등장 중에 시작하지 않는다.
  - 축종 카드 누름: 이전 그대로(scale .98, 100ms, 이동을 늦추지 않음). E2E로 등장 중 누름 → 이동 요청 시작 50ms 미만을 본다.
  - 목록 첫 화면 등장: 뼈대가 칠해진 뒤 뼈대 위치로 첫 화면 카드 수를 정해 두고, 첫 페이지를 그릴 때(layout effect) 앞의 그 수만큼 카드에 `data-enter="list"`(종료 카드 제외). 240ms, 40ms 간격, 8px. 다음 페이지·상세에서 돌아온 목록(뼈대를 거치지 않음)에는 없다. 다 돌면 속성을 지운다.
    - 처음에는 카드를 그리는 커밋 안에서 카드 위치를 읽었는데, 레이아웃이 앞당겨져 지연 로딩 사진 3장이 첫 사진과 동시에 요청되어 목록 LCP가 약 +280ms(1,472 → 1,752ms) 늦었다. 뼈대 위치로 바꿔 되돌렸다(뼈대는 카드보다 글자 칸이 10px 낮아 경계에서 화면 바로 아래 카드가 하나 더 들어갈 수는 있다).
  - 카드 누름: 보호중·임박만 `motion-safe:active:scale-press` + `shadow-card-pressed`, 100ms(`transition-[scale,box-shadow]`: 이전 `transform` 전이는 scale 속성을 전이하지 않았다). 종료 카드는 누름 효과 없음(1단계에서 미룬 것).
  - 찜 하트: 켤 때 바로 채우고 아이콘만 1 → 1.2(45%) → 1, 280ms, ease-heart를 앞뒤 반쪽에(`heart-pop`). 끌 때 `fill-opacity` 120ms 페이드. 종료 공고(`FavoriteButton`의 `ended`)는 채움만(튐·페이드·누름 없음). 목록 카드 찜 원은 40px(누르는 영역 44px, 원의 중심은 이전과 같다).
- 테스트: `e2e/motion.spec.ts`(움직임 줄이기에서 홈·목록·누름·찜 애니메이션 0, 종료 카드 등장·누름·튐 없음, 다음 페이지·돌아온 목록 등장 없음, 홈 등장 타이밍 320/380/440/500ms, 등장 중 축종 카드 누름 → 이동 요청 50ms 미만), `e2e/home-rive.spec.ts`(greet은 등장 끝 뒤 0.3초 안), 단위(카드 누름 클래스, 하트 튐·종료·40px 원).
- 측정(0단계와 같은 방법, 스크롤 5회 CPU 6배, LCP·CLS·FCP 7회):

  | 항목 | 기준선(stage0b, LCP는 0단계, FCP·CLS는 main) | 3단계 | 기준 | 판정 |
  |---|---|---|---|---|
  | FPS 중앙값 | 60.6 (60.4~60.7) | 60.7 (60.6~60.7) | −5% 이내 | 통과 |
  | 느린 프레임 비율 | 0.2% (0~0.2) | 0.2% (0~0.2) | +2%p 이내 | 통과 |
  | 50ms 넘는 프레임(5회 중앙값) | 0 (0~0) | 0 (0~1) | 늘지 않음 | 통과 |
  | 메인 스레드 바쁜 비율 | 21.0% (18.0~22.1) | 19.5% (17.6~20.3) | +5%p 이내 | 통과 |
  | 메인 스레드 50ms 넘는 작업 | 0 | 0(가장 긴 작업 13.8ms) | 0 | 통과 |
  | 덜 그려진 프레임 | 0% | 0% | +1%p 이내 | 통과 |
  | 경보선: 페인트·래스터 합 | 52.4ms (46.0~61.1) | 55.3ms (48.6~60.5), 1.06배 | 1.5배 이하 | 넘지 않음 |
  | LCP 홈 | 440ms (436~444), 같은 날 main 432 | 816ms (800~836), 요소 부제 문단 | 증가 ≤ 500ms(등장 길이) | 통과(+376~388) |
  | FCP 홈 | 432ms (412~440, main) | 424ms (404~436) | +100ms 이내 | 통과 |
  | LCP 목록 | 1,488ms (1,460~1,516) | 1,464ms (1,444~1,484) | +100ms 이내 | 통과 |
  | LCP 상세 | 572ms (560~592) | 568ms (560~584) | +100ms 이내 | 통과 |
  | CLS 홈 / 목록 / 상세 | 0 / 0 / 0 | 0 / 0 / 0 | 늘지 않음 | 통과 |

  - 목록 첫 화면 등장이 도는 동안(첫 카드가 DOM에 들어온 순간부터 400ms, CPU 6배, 5회, `enter.mjs`): 등장 카드 2장, 느린 프레임 5.6%(5~10), 50ms 넘는 프레임 0, 가장 긴 프레임 26.7ms, 메인 스레드 바쁜 비율 77.0%(75.9~78.3), 50ms 넘는 작업 2개(가장 긴 128ms). 같은 창을 main(등장 없음)에서 재면 바쁜 비율 76.5%, 50ms 넘는 작업 2개(가장 긴 128ms)로 같다: 첫 페이지를 그리는 작업이고 등장이 더한 작업은 없다.
  - 실기기 확인: main에 합친 뒤 운영에서 EL(위 실기기 확인 방법, 2026-10-20 결정).

**4단계(카드 → 상세 전환, 브랜치 `stage-4-transition`, 2026-10-20)**

- 구현(14.1 구조 D1):
  - 목록 카드를 누를 때(`AnimalList`): 사진이 로드된 카드면 공고를 상세 캐시에 넣고(받은 시각을 30초 앞당겨 서버 데이터가 덮게, `seedAnimalDetail`) 진입 정보를 남긴다(`entities/animal/model/detail-entry.ts`: 카드 img의 currentSrc와 실제 가로·세로, 효과 morph/fade/none, 누른 시각, 보던 장).
  - 로딩 화면(`AnimalDetailLoading`): 진입 정보와 캐시가 있으면 실제 상세(`AnimalDetail`), 아니면 뼈대. 상세는 진입 정보로 사진 칸 비율(카드 사진의 실제 비율, 서버 값과 1% 안이면 그대로), 첫 장 주소(카드가 받은 주소, 바로 디코드), 처음 보이는 장, 스크롤(처음 한 번만 맨 위로), 정보 페이드(누른 시각 기준으로 이어 그림)를 이어 그려 서버 페이지로 바뀌어도 같은 화면이 된다. 효과가 끝나면 속성을 떼어 합성 레이어 차이로 글자 렌더링이 달라지지 않게 했다.
  - 전환: React `<ViewTransition>`(카드 사진 칸 ↔ 상세 사진 칸, 이름 `animal-photo-<id>`), `next/link`의 `transitionTypes`(`card-detail`)일 때만 짝(`share`), 그 밖 기본 `none`. 경계는 실제로 이어질 때만 둔다(종료·움직임 줄이기 카드, morph가 아닌 상세에는 없음). CSS: 루트 옛 화면 숨김·새 화면 애니메이션 없음(상세 바탕이 첫 프레임부터 불투명), 사진 칸 300ms ease-emphasized(카드 사진이 상세 사진 칸의 크기·위치로 옮겨 가며 자리를 잡는다(상세 칸이 좌우 24px 안쪽이라 대개 작아진다). 1:1에서 잘렸던 부분이 드러난다. 옛 사진은 숨기고 새 사진만 cover로 채운다), 정보 100ms 뒤 200ms 페이드, 지원하지 않는 브라우저는 사진 칸과 정보 200ms 페이드, 움직임 줄이기는 모두 없음.
  - 측정에서 고친 것 두 가지: (1) React는 전환 커밋을 새 화면의 사진이 로드될 때까지 기다린다. 처음에 상세의 모든 장을 바로 받게 해 아직 받지 않은 둘째 장을 기다렸다(약 +210ms) → 처음 보이는 장만 바로 받는다. (2) 새 화면의 본문 글꼴(Pretendard dynamic subset) 조각도 기다린다(약 +270ms, 상세의 정보 줄 이름 등 목록에 없던 글자). 상세의 고정 글자는 목록 첫 화면 사진(앞 2장)이 다 로드된 뒤 브라우저 유휴 시간에, 그 공고의 글자는 누르기 시작할 때·누를 때 `document.fonts.load`로 미리 받는다(`shared/lib/font-warm.ts`, `detailDisplayText`).
- 테스트: `e2e/detail-transition.spec.ts`(스텁 서버): 목록 → 상세에서만 사진 칸 전환(300ms)·옛 화면 숨김·정보 페이드, 화면 안·브라우저 뒤로가기·직접 진입·종료·움직임 줄이기는 효과 없음(0ms 넘는 전환 애니메이션 없음), 지원하지 않는 브라우저 페이드, 뒤로가기 후 목록 복원, 목록 데이터 화면 → 서버 데이터 화면(사진 빈 프레임 0, 넘긴 장·스크롤 유지, CLS 0, 앞뒤 스크린샷 픽셀 같음). 스텁 목록의 5개 중 하나는 첫 사진 4:3 두 장. 아이폰 쓸어넘기기 뒤로가기는 헤드리스로 재현할 수 없어 브라우저 뒤로가기로 대신 본다. 단위: 로딩 화면 선택, 캐시 채우기.
- 측정(0단계와 같은 방법, 스크롤 5회 CPU 6배, LCP·FCP·CLS 7회, 상세 보이기까지 5회 `perf-ui/detail-open.mjs`: 같은 망 조건, click 이벤트 → 상세와 보이는 첫 사진이 그려진 첫 프레임):

  | 항목 | 기준선(stage0b, LCP는 0단계) | 4단계 | 기준 | 판정 |
  |---|---|---|---|---|
  | 카드 → 상세 보이기까지 | 전환 없음(움직임 줄이기) 28ms (27~28) | 전환 있음 47ms (42~57) | +100ms 이내 | 통과(+19) |
  | (참고) D 적용 전후 | main 328ms (327~332, 서버 페이지가 올 때 보임) | 47ms (목록 데이터 화면) | 줄어야 정상 | −281ms |
  | FPS 중앙값 | 60.6 | 60.6 (60.5~60.7) | −5% 이내 | 통과 |
  | 느린 프레임 비율 | 0.2% | 0.2% (0~0.2) | +2%p 이내 | 통과 |
  | 50ms 넘는 프레임 | 0 | 0 (0~1) | 늘지 않음 | 통과 |
  | 메인 스레드 바쁜 비율 | 21.0% | 22.0% (18.1~24.4) | +5%p 이내 | 통과 |
  | 메인 스레드 50ms 넘는 작업 | 0 | 0(가장 긴 작업 18.8ms) | 0 | 통과 |
  | 덜 그려진 프레임 | 0% | 0% | +1%p 이내 | 통과 |
  | 경보선: 페인트·래스터 합 | 52.4ms | 59.9ms (47.1~66.2), 1.14배 | 1.5배 이하 | 넘지 않음 |
  | LCP 홈 | 440ms(main 432) | 808ms (804~824) | 증가 ≤ 500ms | 통과 |
  | FCP 홈 | 432ms(main) | 424ms (416~436) | +100ms 이내 | 통과 |
  | LCP 목록 | 1,488ms | 1,480ms (1,460~1,496) | +100ms 이내 | 통과 |
  | LCP 상세(직접 진입) | 572ms | 584ms (568~592) | +100ms 이내 | 통과 |
  | CLS 홈 / 목록 / 상세 | 0 / 0 / 0 | 0 / 0 / 0 | 늘지 않음 | 통과 |

  - 전환을 끈 채(View Transitions API 없음) 재면 31ms로, 전환 비용은 화면을 찍고 바꾸는 몇 프레임이다.
  - 목록 LCP +76ms의 원인(2026-10-20): 처음 구현은 상세 고정 글자의 글꼴 조각을 window load 때 받았는데, 목록은 데이터를 브라우저에서 받아 카드 사진이 load 뒤에 시작해 첫 사진과 겹쳤다. 같은 방법·조건으로 목록 LCP 7회를 비교했다:

    | 빌드 | 목록 LCP 중앙값 | 범위 |
    |---|---|---|
    | 글꼴 미리 받기 끔 | 1,480ms | 1,448~1,520 |
    | 켬(load 때) | 1,572ms | 1,496~1,584 |
    | 켬(첫 화면 사진 2장 로드 뒤 유휴 시간, 지금) | 1,476ms | 1,448~1,480 |

    판정: 원인이다. 미룬 뒤 끈 것과 같고, 카드 → 상세 보이기까지도 47ms로 그대로다(누를 때 받는 부분은 바꾸지 않았다).


**5단계(Rive 캐릭터 선 색·누름 반응, 브랜치 `stage-5-rive`, 2026-10-20)**

- 바꾼 것: `docs/design/characters.md`를 디자인 동기화본(2026-10-14, 방향 A)으로 옮겼다. 캐릭터 SVG 원본 17개(`docs/design/assets/characters/`)의 선 `stroke="#111111"` 204곳을 `#3A2A20`으로 바꿨다(눈·강아지 코의 채움 `#111111`, 두께 1.8, path·그룹·기준점은 그대로, `#4A3E34` 줄무늬 선도 그대로). 앱 정지 그림(`public/characters/` 정면 앉음 둘, 움직임 줄이기에서 보임)도 같은 파일이다. press 반응(`scripts/rive-characters-scene.mjs`): 머리 6° 기울기를 없애고, 100ms(60fps 6프레임) ease-out으로 웃는 눈 + 몸이 바닥 가운데(rig) 기준 가로 1.03 × 세로 0.96, 다음 100ms에 돌아와 12프레임(200ms)에 idle로 간다(이전 250ms, 세로 0.95). 잠에서 깨는 wake도 같다. 이동을 늦추지 않는 것은 그대로다(앱은 press 신호만 보낸다).
- 빌드: `pnpm rive:build`(Rive CLI 1.5.0), `--check` 통과(scene.rml이 생성 결과와 같다). `.riv` 77,200 → 76,981바이트(brotli 17,924 → 17,880).
- 테스트: `tests/design/character-colors.test.ts`(선에 `#111111`이 없고 `#3A2A20`, 채움 `#111111`은 눈·코에만, scene.rml의 Stroke에도 `#111111` 없음), `tests/design/rive-scene.test.ts`(press·wake 12프레임, 6프레임에 1.03 × 0.96, 회전 없음). E2E 전체 통과(home-rive 포함).
- 스크린샷(저장소 밖 `nyanggonggo-review/perf-ui/screens/stage5/`): `svg-before-after.png`(정면 앉음·강아지 놀자·고양이 씰룩·덮치기 공중·착지, 이전/지금), `rive-frames.png`(홈 실제 Rive: greet 0~2.5초, press 100ms, 움직임 줄이기 정지 그림)와 낱장. 선 색만 바뀌고 모양은 같다.
- 측정(홈만 바뀌어 14.3 중 홈 LCP·FCP·CLS만 다시 쟀다. 목록 스크롤·목록·상세 LCP는 홈 밖이라 생략했다): LCP 홈 804ms(784~812, 기준선 main 432 대비 +372 ≤ 등장 길이 500) 통과, FCP 홈 420ms(412~424, +100 이내) 통과, CLS 0 통과.

**PRD v1.5(상세를 목록 위에 얹기, 브랜치 `stack-nav`, 2026-10-20)**

- 구현: 7절 "상세 열기와 뒤로가기", 전환은 14.1 상세 전환의 PRD-v1.5 항목. 스크롤 복원 코드·키와 돌아올 때의 `decoding="sync"`는 걷어 냈다(R6, 저장소 검색으로 남은 것 없음 확인).
- E2E(Chromium·WebKit): `e2e/back-nav.spec.ts`(R1 목록: 1·5페이지 × 화면 안·브라우저 뒤로가기에서 같은 요소·모든 프레임 같은 위치·층이 있는 동안 막힘·층이 사라진 첫 프레임부터 스크롤·터치, 5페이지 요청 0·스켈레톤 없음, 31분 머물러도 목록 그대로, 새로고침 뒤 뒤로가기, R2 공유 진입), `e2e/stack-nav.spec.ts`(찜에서 얹기, 얹은 동안 막힘·층 스크롤·당김 설정, 돌아온 직후 실제 입력, 직접 진입·새로고침은 전체 페이지), `e2e/detail-transition.spec.ts`(전환 출발 칸이 카드 사진 칸 1:1, 뒤로가기 후 목록 위치 그대로, 층 안 스크롤로 교체 시험). 공통 도우미 `e2e/stack.ts`.
- 측정(같은 날 main `53044b8`과 같이, 스크롤 5회 CPU 6배, LCP·FCP·CLS 7회, 상세 보이기까지 5회):

  | 항목 | 기준선(stage0b, LCP는 0단계) | main | stack-nav | 기준 | 판정 |
  |---|---|---|---|---|---|
  | 카드 → 상세 보이기까지 | 전환 없음(움직임 줄이기) 31ms (30~33) | 59ms (45~62) | 59ms (45~60) | 전환 없음 +100ms 이내 | 통과(+28) |
  | FPS 중앙값 | 60.6 | 60.7 | 60.6 | −5% 이내 | 통과 |
  | 느린 프레임 비율 | 0.2% | 0.2% | 0% | +2%p 이내 | 통과 |
  | 50ms 넘는 프레임 | 0 | 0 | 0 (5회 모두) | 늘지 않음 | 통과 |
  | 메인 스레드 바쁜 비율 | 21.0% | 18.1% | 19.1% | +5%p 이내 | 통과 |
  | 메인 스레드 50ms 넘는 작업 | 0 | 0 | 0 (가장 긴 작업 11.6ms) | 0 | 통과 |
  | 덜 그려진 프레임 | 0% | 0% | 0% | +1%p 이내 | 통과 |
  | 경보선: 페인트·래스터 합 | 52.4ms | 55.2ms | 52.5ms, 1.00배 | 1.5배 이하 | 넘지 않음 |
  | LCP 홈 | 440ms | 804ms | 784ms (772~816) | 증가 ≤ 500ms(3단계부터) | 통과 |
  | FCP 홈 | 432ms(main, 4단계 때) | 416ms | 432ms | +100ms 이내 | 통과 |
  | LCP 목록 | 1,488ms | 1,460ms | 1,448ms (1,428~1,508) | +100ms 이내 | 통과 |
  | LCP 상세(직접 진입) | 572ms | 580ms | 576ms (564~604) | +100ms 이내 | 통과 |
  | CLS 홈 / 목록 / 상세 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 늘지 않음 | 통과 |

  - 상세 보이기까지의 기준(전환 없음)은 stack-nav의 움직임 줄이기 31ms다(main의 움직임 줄이기는 29ms).
  - 12절 56의 `decoding="sync"` 시험 때 목록 스크롤을 CPU 4배로 쟀다(같은 날 main도 4배라 비교는 맞지만 기준선 stage0b는 6배였다). 이번에는 6배로 쟀다.
- 실기기(EL, 미리보기, 2026-10-20 확인): 쓸어넘기기 깜빡임 없음, 돌아온 직후 바로 스크롤됨, 상세에서 당겨도 새로고침 안 됨(PRD-v1.5 3절). 확인 뒤 main에 합쳤다.
