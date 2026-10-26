# 도메인 용어 사전

## 이 문서의 역할

한 개념을 층마다(화면, 코드, 계약, 공공 API, URL·저장소) 무엇이라고 부르는지와 그 대응을 적는다. "지금 무엇이 맞는가"만 담는다. 바뀐 경위는 근거 열의 문서와 이슈에 있다.

## 읽는 법

- 열: **용어(화면)** 화면에 보이는 그대로(화면에 없으면 "화면 없음") / **정의** / **코드 이름** 타입·값·함수와 파일 / **밖으로 나가는 값** URL·쿠키·저장소·공공 API 필드처럼 컴파일러가 보지 않는 값 / **근거** 정의가 정해진 문서·이슈 / **헷갈리기 쉬운 말·쓰지 않는 말**.
- **코드 반영 예정**: 정의는 정해졌고 지금 코드나 화면이 아직 다르다. 바꾸는 일은 따로 이슈로 한다. 그 전까지 코드 이름 열은 지금 코드에 있는 이름이다.
- 앞 버전 문서(`PRD.md`, `기능명세서.md`, `PRD-v1.x.md`)의 용어("찜", "임박", "종료임박순" 등)는 그 시점의 기록이다. 지금의 용어는 이 문서를 따른다.
- 파일 경로는 `src/` 아래 기준이다.

## 규칙

- 코드 이름은 도메인 개념을 따르고, 화면 문구는 문구 한 곳에만 둔다(`entities/animal/ui/labels.ts`, `status-text.ts`, `detail-rows.ts` 등).
- URL·저장소 키·이벤트 이름 같은 컴파일러 밖 문자열에는 화면 문구나 브랜드를 쓰지 않는다. 이 규칙은 새로 만드는 문자열에 적용한다. 기존 쿠키·저장소 키(`nyanggonggo.*`, `nyanggonggo:*`)와 운영 주소(`nyanggonggo.vercel.app`)는 사용자 데이터와 이미 퍼진 링크를 지키려고 그대로 둔다.
- 새 이름을 짓거나 화면 문구를 쓸 때 이 사전을 먼저 본다. 사전에 없는 용어면 사전에 먼저 추가한다.

## 1. 상태

| 용어(화면) | 정의 | 코드 이름 | 밖으로 나가는 값 | 근거 | 헷갈리기 쉬운 말·쓰지 않는 말 |
|---|---|---|---|---|---|
| 상태 (필터 섹션 "보호 상태") | 공고의 상태. **보호중 / 종료 둘뿐이다.** `processState`로만 판단하고 날짜와 관계없다 | `Animal.status`, `ANIMAL_STATUSES`(contract/animals.ts), `toStatus`(server/mapper.ts) | 공공 API `processState`, URL `status=protected\|ended\|all` | architecture.md 5절 | 공고 마감(날짜)과 섞지 않는다 |
| 보호중 | `processState`가 "종료"로 시작하지 않는 공고. 모르는 값도 보호중으로 보고 로그를 남긴다. 공고 마감이 지나도 보호중이다 | `"protected"` | `processState` = `보호중` | architecture.md 5·10절 | 보호 중(띄어 쓰지 않는다) |
| 종료 | 결과가 난 공고(입양·반환·자연사·안락사·기증·방사). `processState`가 "종료"로 시작하면 종료다 | `"ended"` | `processState` = `종료(<결과>)` | architecture.md 5·10절, 12.A P5 | 날짜 쪽(공고 마감)에는 "종료"를 쓰지 않는다 |
| 결과 (화면: "종료 · <결과>". "결과"라는 낱말은 화면 없음) | `processState` "종료(…)"의 괄호 안 낱말 원문. 값 목록을 고정하지 않는다. 괄호가 없으면 "종료"만 | `endResultText`, `toEndResult`(server/mapper.ts), `statusBadgeText`(entities/animal/ui/status-text.ts) | `processState`의 괄호 안 | #41, architecture.md 10절 | 종료 사유 |
| 종료 사유 | 공공 API `endReason` 원문. 상세 정보 줄에만 쓴다. 특이사항과 같은 문구면 특이사항을 비운다 | `endReasonText`, `DETAIL_ROW_LABELS.endReason`(entities/animal/ui/detail-rows.ts), `specialMarkUnlessEndReason` | `endReason` | #41 | 결과 |
| 공고 기간 | 주인이 찾아갈 수 있도록 보호소가 공고하는 기간(동물보호법 제40조, 7일 이상). 화면 표기 `MM.DD ~ MM.DD` | `noticePeriodText` | `noticeSdt` ~ `noticeEdt` | 동물보호법 제40조, detail-rows.ts | — |
| 공고 마감(일) | 공고 기간의 마지막 날. 지나도 상태는 바뀌지 않는다(제43조: 10일이 지나면 지자체가 소유권을 취득한다). KST 달력 날짜 | `noticeEndAt`(Domain), `noticeEndDate`(Wire) | `noticeEdt`(`YYYYMMDD`) | 동물보호법 제43조, architecture.md 10절 | 종료일·공고 종료(쓰지 않는다) |
| 마감 D-N (카드: "보호중 · 마감 D-N", 상세·공유 카드·링크 미리보기 이미지(OG): "공고 마감 D-N"), 오늘 마감 (마감 당일. 카드 "보호중 · 오늘 마감", 상세·공유·OG "오늘 마감") | 공고 마감까지 남은 날 수(KST 달력). 마감 당일은 숫자 대신 "오늘 마감"이다. 종료 공고, 마감일이 없는 공고, 마감이 지난 공고에는 붙이지 않는다. **코드 반영 예정**: 지금 화면은 카드 "보호중 · D-N"/"임박 · D-N", 상세·OG는 "D-N"만 따로, 당일은 "D-day"(#29) | `getDDay`(entities/animal/model/dDay.ts), `dDayText`(status-text.ts) | 링크 미리보기 이미지(OG), 공유 카드 설명 | #29, architecture.md 10절, EL 결정(#56) | D-day(쓰지 않는다), D-0 |
| 강조 (화면 없음, 색만) | 보호중이면서 마감 D-3 이하인 공고. 강조 색으로만 구분한다. **코드 반영 예정**: 배지 문구 "임박"을 없애고, 코드 이름을 `soon` → `nearDeadline`, `isSoon` → `isNearDeadline`으로 바꾼다 | 지금 `isSoon`, `"soon"`(`AnimalStatusVariant`, entities/animal/model/status.ts), 토큰 `status-soon*` | 없음 | architecture.md 10절, design/README.md, EL 결정(#56) | 임박(쓰지 않는다), soon(옛 코드 이름) |

## 2. 공고와 동물

| 용어(화면) | 정의 | 코드 이름 | 밖으로 나가는 값 | 근거 | 헷갈리기 쉬운 말·쓰지 않는 말 |
|---|---|---|---|---|---|
| 공고 (화면: "고양이 공고", "공고 상세", "공고 보기") | 보호소가 올린 유기동물 공고 한 건. 공고 한 건이 동물 한 마리다 | `Animal`(entities/animal/model/animal.ts) | `/animals/{id}` | architecture.md 6절 | 동물 |
| 동물 (화면: "기타 동물", "유기동물 공고") | 공고의 대상. 코드는 공고를 `Animal`로 부른다 | `Animal` | — | — | 공고 ↔ `Animal`(정리 후보 참고) |
| 공고 번호 | 공공 API `noticeNo`. 공고의 식별 정보. 상세와 목록 카드에 표시한다(카드는 시험 후 판단). **코드 반영 예정**: 지금은 DTO에서만 받고 Wire·Domain·화면에 없다 | DTO `noticeNo`(server/upstream/dto.ts) | `noticeNo` | EL 합의(#51) | 구조 번호 |
| 구조 번호 (화면 없음) | 공공 API `desertionNo`. 우리 id다. 화면에 표시하지 않는다. 숫자 1~32자리 | `id`, `isAnimalId`(contract/animals.ts) | 상세 URL, 공유 링크, 관심 저장값, `/api/animals/by-ids?ids=` | #31, architecture.md 4절 | 공고 번호 |
| 축종 (화면: 고양이 / 강아지 / 기타 동물) | 공고 동물의 종류 셋 | `cat` / `dog` / `other`, `ANIMAL_SPECIES`, `SPECIES_LABEL`(entities/animal/ui/labels.ts), `toSpecies`, `UPKIND_BY_SPECIES`(server/upstream/client.ts) | 공공 API `upKindNm` 고양이 / 개 / 기타, `upkind`, URL `species=`, 쿠키(축종 기억) | PRD-v1.1, architecture.md 4·6절 | 개(공공 API만), "다른 동물"(홈 링크 문구일 뿐 축종 이름이 아니다) |
| 품종 (화면 없음. 기타 동물은 실제 동물 이름으로 제목·사진 설명·공유에 쓴다) | `kindFullNm`의 `[축종]` 뒤. "기타"·"기타축종"이면 없음 | `kindText`, `speciesText`(labels.ts) | `kindFullNm` | architecture.md 12.A P12 | 기타 동물에서는 품종이 아니라 동물 종류다 |
| 성별 (화면: 암컷 / 수컷 / 성별 미상) | `sexCd` M·F·그 외. 필터는 전체 / 암컷 / 수컷이고, 성별 미상은 전체에서만 보인다 | `sex`, `SEX_LABEL`(labels.ts), `ANIMAL_LIST_SEXES`, `toSex` | `sexCd`, URL `sex=` | #20 | — |
| 나이 (화면: 지금 원문, 모르면 "나이 미상") | 추정 출생 연도. 정해진 형식이면 "2026년생 · 60일 미만"처럼 정리하고, 아니면 원문. **코드 반영 예정**: 지금은 원문 그대로("2026(60일미만)(년생)") | `ageText`, `sexAgeText`(labels.ts), `ANIMAL_COPY.ageUnknown` | `age` | EL 합의(#51), architecture.md 12절 | 추정 나이(기능명세서) |
| 특이사항 | `specialMark` 원문. 상세 정보 줄과 공유·링크 미리보기 요약에 쓴다 | `specialMarkText`, `DETAIL_ROW_LABELS.specialMark`, `animalSummaryText` | `specialMark`, 카카오 카드 설명, og:description | #2, #41 | 성격·건강(받지 않는 필드) |
| 사진 | `popfile1..N` 중 값이 있는 것을 번호순으로. 대표 사진은 첫 번째 | `images`, `getPrimaryImage`, `photoAlt`, `AnimalPhoto` | `popfileN`, `/api/image-proxy?src=`, 카카오 썸네일 | architecture.md 4·9절 | — |

## 3. 장소와 보호소

| 용어(화면) | 정의 | 코드 이름 | 밖으로 나가는 값 | 근거 | 헷갈리기 쉬운 말·쓰지 않는 말 |
|---|---|---|---|---|---|
| 지역(관할 지역) (화면: 카드 1줄·상세 제목·공유 제목에 값 그대로, 필터 섹션 "지역") | 동물이 발견된 지역을 맡은 지자체. 이름은 `orgNm` 그대로 쓰고, 필터는 그 지자체의 시·도 / 시·군·구 코드로 고른다. 기본은 서울 전체 | 이름 `regionText`, `animalTitle`(labels.ts) / 필터 `region`·`district`, `AnimalArea`, `DEFAULT_REGION`(features/animal-filter/model/filter.ts) | `orgNm`, URL `region=`·`district=`, 쿠키(지역 기억), `upr_cd`·`org_cd` | architecture.md 4·7절, EL 합의(#51) | 동물이 지금 있는 곳(보호소)이 아니다. `regionText`와 `region`은 정리 후보 |
| 시·도 (화면: "시/도", "전체 시/도") | 정적 목록 16개 | `SIDO`, `findSido`(shared/config/regions.ts) | `upr_cd` | regions.ts | — |
| 시·군·구 (화면: "시/군/구", "전체 시/군/구") | 정적 목록 235개(가정보호 등 실제 구가 아닌 코드는 뺀다) | `district`, `DISTRICT_ALL`, `resolveDistrict` | `org_cd` | regions.ts, architecture.md 12절 41 | — |
| 전국 (화면: "전체 시/도") | 지역을 고르지 않음. 서버는 지역 코드를 보내지 않는다 | `REGION_ALL`(filter.ts) | URL `region=all` | architecture.md 7절 | 전체 |
| 발견 장소 | `happenPlace` 원문. 보호소가 없으면 카드 2줄에도 쓴다 | `foundPlaceText`, `animalSubtitle`(labels.ts) | `happenPlace` | architecture.md 6절 | 지역(관할 지역) |
| 보호소 | `careNm`. 동물병원일 수 있다 | `shelterName` | `careNm` | architecture.md 4절 | — |
| 보호소 주소 (화면: 보호소 정보 시트의 주소 줄 + [지도]) | `careAddr`. 보호소 정보 시트에 복사할 수 있는 글자로 보인다. 종료 공고에는 보이지 않는다. 로그에 남기지 않는다. **코드 반영 예정**: 지금은 상세 정보 줄 "주소"에 있다 | `shelterAddressText` | `careAddr`, 카카오맵 검색 URL | #3, #30, EL 결정(#56) | — |
| 보호소 전화 (화면: 보호소 정보 시트의 전화 줄 + [전화]) | `careTel` 원문. 보호소 정보 시트에 복사할 수 있는 글자로 보인다. 종료 공고에는 보이지 않는다. 로그에 남기지 않는다. **코드 반영 예정**: 지금은 상세 정보 줄 "전화"에 있다 | `shelterTelText` | `careTel`, `tel:` 링크 | #3, EL 결정(#56) | 전화 걸기(행동) |
| 담당자 (화면 없음) | `careOwnerNm`. Wire·Domain·화면·로그 어디에도 내보내지 않는다 | DTO `careOwnerNm` | 없음 | CLAUDE.md 보안, architecture.md 6절 | — |

## 4. 사용자 행동

| 용어(화면) | 정의 | 코드 이름 | 밖으로 나가는 값 | 근거 | 헷갈리기 쉬운 말·쓰지 않는 말 |
|---|---|---|---|---|---|
| 관심 (화면: 관심 공고) | 다시 보거나 공유하려고 이 기기에 모아 둔 공고. 공고 id만 저장한다(최근 것이 앞). "관심"은 공고에만 쓴다. 화면 문구: 하트 접근성 이름 "관심 공고에 담기" / "관심 공고에서 빼기", 토스트 "관심 공고에 담았어요" / "관심 공고에서 뺐어요". **코드 반영 예정**: 지금 화면 문구는 "찜하기"/"찜 해제", "찜에 저장했어요"/"찜을 해제했어요"다. 코드 이름 `favorite`, URL `/favorites`, 저장소 키는 바꾸지 않는다 | `favorite`(`useFavorite`, `FavoriteButton`, `FAVORITES_STORAGE_KEY`, `features/animal-favorite`) | localStorage 키, URL `/favorites`, `/api/animals/by-ids` | architecture.md 8절, #5, EL 합의(#51), EL 결정(#56) | 찜(쓰지 않는다). architecture.md 13절의 "관심 지역"(지역 즐겨찾기 아이디어)은 다른 뜻이라, 그 기능을 만들 때 "관심"이 아닌 다른 이름을 짓는다 |
| 카카오톡 공유 | 카카오 피드 카드로 공고를 보낸다(버튼 "공고 보기"). 카카오를 쓸 수 없으면 링크 복사로 대신한다 | `shareAnimal`, `ShareButton`, `SHARE_BUTTON_LABEL`, `buildShareContent`(features/animal-share) | 카카오 템플릿, `NEXT_PUBLIC_KAKAO_JS_KEY`, `NEXT_PUBLIC_SITE_URL` | #2, 기능명세서 4.3 | — |
| 링크 복사 (화면: 토스트 "링크가 복사됐어요") | 카카오톡 공유를 쓸 수 없을 때 자동으로 하는 동작. 따로 버튼은 없다 | `SHARE_MESSAGES`(features/animal-share/model/share.ts) | 클립보드 | share.ts | — |
| 필터 (화면: 버튼·시트 제목 "필터", "적용하기") | 목록 조건(축종, 지역, 상태, 성별, 정렬). URL이 단일 진실 소스이고, 적용 전 고른 값은 반영하지 않는다 | `AnimalListFilter`, `FILTER_KEYS`, `useApplyAnimalFilter`, `AnimalFilterSheet` | URL `species`·`region`·`district`·`status`·`sex`·`sort` | architecture.md 7절, #28 | — |
| 정렬 (화면: "최신순" / "공고 마감 빠른순") | 최신순: 공고 시작일이 늦은 순. 공고 마감 빠른순: 마감이 오늘 이후인 공고를 빠른 순으로 먼저, 지난 공고를 그 뒤에. **코드 반영 예정**: 지금 화면은 "종료임박순"이고, 정렬 값 `endingSoon`을 `deadline`으로 바꾼다. 정렬 값은 URL에도 실려 함께 바뀐다. 옛 링크(`sort=endingSoon`)는 모르는 값이라 기본 정렬(최신순)로 열린다 | 지금 `ANIMAL_LIST_SORTS` `latest` / `endingSoon`, `compareEndingSoon`(server/animals/service.ts) | URL `sort=latest\|endingSoon`(예정 `sort=latest\|deadline`) | architecture.md 5절, EL 합의(#51), EL 결정(#56) | 종료임박순·임박순(쓰지 않는다), endingSoon(옛 코드 이름) |
| 기억 (화면: "한 번 고르면 기억해둘게요.") | 마지막으로 고른 축종과 지역을 쿠키에 1년 둔다. 사용자가 직접 고를 때만 저장하고, 공유 링크로 들어온 값은 저장하지 않는다 | `rememberSpecies`, `rememberRegion`, `writeFilterCookie`, `FILTER_COOKIE_MAX_AGE` | 쿠키 두 개 | architecture.md 7절, PRD-v1.1 4절, PRD-v1.4 R2 | 관심(localStorage, 다른 저장) |
| 지도 보기 (화면: "지도") | 보호소 주소를 카카오맵 검색으로 새 탭에서 연다. 보호소 정보 시트의 주소 줄 끝에 둔다(**코드 반영 예정**: 지금은 정보 줄 "주소" 끝) | `mapSearchUrl`, `DetailRowAction` `"map"` | 카카오맵 URL | #3 | — |
| 전화 걸기 (화면: "전화") | 보호소 전화로 `tel:` 링크를 연다. 숫자가 없으면 링크가 없다. 보호소 정보 시트의 전화 줄 끝에 둔다(**코드 반영 예정**: 지금은 정보 줄 "전화" 끝) | `telHref`, `"call"` | `tel:` | #3 | 정보 줄 이름 "전화" |
| 뒤로가기 | 이 탭에서 목록을 거쳐 왔으면 방문 기록을 되돌리고, 아니면 목록(`/`)으로 간다 | `useGoBack`, `BackButton`(shared/ui/back-button.tsx), `markListVisited` | sessionStorage 키 | PRD-v1.4 R1·R2, PRD-v1.5 | — |

## 5. 화면 요소

| 용어(화면) | 정의 | 코드 이름 | 밖으로 나가는 값 | 근거 | 헷갈리기 쉬운 말·쓰지 않는 말 |
|---|---|---|---|---|---|
| 홈(축종 선택) (화면: "오늘은 누구를 보러 왔어요?") | 축종을 고르는 첫 화면. 축종 기억이 없으면 `/`가 여기로 보낸다 | `SpeciesPickerView`, `SpeciesChoice`, `HOME_PATH`, `homeHref`, `resolveAnimalListEntry` | URL `/home` | PRD-v1.1 3절, architecture.md 7절 | species-picker / species-choice |
| 목록 (화면: "고양이 공고" 등) | 한 축종의 공고 카드 피드(무한 스크롤) | `AnimalListView`, `AnimalList`, `useAnimalsInfinite` | URL `/` | architecture.md 7절 | "목록 화면"(목록 + 관심 목록)과 구분한다 |
| 진입 경로 (화면 없음) | 쿼리 없는 `/`. 기억한 목록(축종·지역)이 있으면 그 목록으로, 없으면 홈으로 보낸다. 뒤로가기로 갈 곳이 없을 때(공유 링크로 바로 들어온 상세 등) 가는 곳이다. 목록 주소와 값은 같지만 다른 개념이다 | `entry`(shared/config/routes.ts), `resolveAnimalListEntry`(features/animal-filter/model/entry.ts) | URL `/` | PRD-v1.4 R2, #73 | 목록(`/` + 쿼리), 홈(`/home`) |
| 관심 목록 (화면: 목록 이름·헤더 링크 "관심 공고", 빈 상태 "아직 관심 공고가 없어요", 오류 "지금은 관심 공고를 불러오지 못했어요") | 관심 공고만 모은 목록. 축종이 섞인다. **코드 반영 예정**: 지금 화면은 "찜한 공고", 링크 이름 "찜 목록", "아직 찜한 공고가 없어요", "지금은 찜한 공고를 불러오지 못했어요"다. 일부 실패 안내 "일부 공고를 불러오지 못했어요"는 그대로다 | `FavoritesView`, `FavoriteList`, `FavoritesLink`, `ANIMAL_COPY.favoritesTitle`·`favoritesEmptyTitle`·`favoritesErrorTitle` | URL `/favorites` | architecture.md 8절, EL 결정(#56) | 찜 목록(쓰지 않는다) |
| 카드 (화면 없음) | 목록의 공고 한 칸. 사진 1:1, 상태 배지, 관심 버튼, 1줄 지역(관할 지역), 2줄 보호소(없으면 발견 장소) | `AnimalCard`, `ANIMAL_CARD_SLOT`(entities/animal/ui/animal-card.tsx) | 없음 | handoff 화면 1~2 | — |
| 상세 (화면: 층 이름 "공고 상세") | 공고 하나의 화면. 목록·관심 목록에서 열면 목록 위에 얹힌 층이고, 링크로 바로 들어오면 새 문서다 | `AnimalDetail`, `StackLayer`(shared/ui/stack-layer.tsx), `app/@modal/(.)animals/[id]` | URL `/animals/{id}` | PRD-v1.5, architecture.md 7절 | 모달 |
| 정보 줄 (화면 없음) | 상세의 이름-값 줄: 발견 장소 → 보호소 → 공고 기간 → 종료 사유 → 특이사항. 값이 없으면 줄을 뺀다. 보호소 주소·전화는 보호소 정보 시트에 둔다. **코드 반영 예정**: 지금은 보호소 뒤에 주소 → 전화 줄이 있다 | `detailRows`, `DETAIL_ROW_LABELS`, `DetailRow`(detail-rows.ts) | 없음 | #3, #30, #41, EL 결정(#56) | — |
| 시트 (화면: "필터", 보호소 정보 시트) | 모달 바텀시트. 화면 안의 상호작용이다. 화면을 떠나는 동작(쓸어넘기기·뒤로 가기)은 시트가 열려 있어도 화면을 닫는다. 방문 기록에 넣지 않는다 | `Sheet`(shared/ui/sheet.tsx), `AnimalFilterSheet` | 없음 | 기능명세서 4.2, EL 합의(#51) | 팝업(쓰지 않는다) |
| 보호소 정보 시트 (화면: 보호소 줄 끝 작은 글자 버튼 "보호소 정보", 접근성 이름 "보호소 정보 보기". 시트 제목은 보호소 이름) | 상세 보호소 줄 끝의 [보호소 정보]로 여는 시트. 내용은 주소 + [지도], 전화 + [전화]이고 값이 없는 줄은 뺀다. 종료 공고이거나 주소·전화가 모두 없으면 버튼이 없다. 시트 정책을 따른다(상세가 닫히면 함께 사라진다). **코드 반영 예정**: 지금은 없다(주소·전화가 정보 줄에 있다) | 아직 없음. 기존 `Sheet`를 쓴다 | 없음 | EL 결정(#56) | 팝업(쓰지 않는다) |
| 사진 크게 보기 | 컬럼 전체를 덮는 검은 사진 뷰어. 보던 사진 위치를 지킨다 | `ImageViewer`(widgets/animal-detail) | 없음 | 기능명세서 4.4, architecture.md 9절 | 풀스크린 뷰어 |
| 토스트 | 짧은 안내. 컬럼 안에 두고, 같은 문구는 하나로 갱신한다 | `showToast`(shared/ui/toast.ts), `Toaster`(shared/ui/sonner.tsx) | 없음 | architecture.md 9절 | — |
| 상태 배지 | 사진 위의 상태 표기. 문구는 `statusBadgeText` 하나에서 만든다. 결과에 따라 색이나 모양을 바꾸지 않는다 | `StatusBadge`(entities/animal/ui/status-badge.tsx), `statusBadgeText` | 없음 | #29, #41 | — |
| 헤더 | 화면 맨 위 줄. 목록·관심 목록에서는 위에 붙고, 홈에서는 붙지 않는다 | `ScreenHeader`(shared/ui/screen-shell.tsx), `AnimalListHeader` | 없음 | handoff 화면 1~2 | `SheetHeader`와 다르다 |
| 하단 CTA | 상세 아래의 관심·공유 버튼 줄. 컬럼 안에서 sticky. 토스트는 그 위에 뜬다 | `data-slot="bottom-cta"` | 없음 | CLAUDE.md 디자인 적용 | — |
| 빈 상태 | 조건에 맞는 공고가 없을 때 | `emptyTitle`(`SPECIES_COPY`), `favoritesEmptyTitle`, `StateMessage`(widgets/animal-list/ui/animal-list.tsx) | 없음 | handoff 화면 6 | — |
| 오류 상태 (화면: "지금은 …를 불러오지 못했어요" + "다시 시도") | 조회 실패. 관심 목록은 일부만 실패하면 받은 카드를 두고 한 줄로 알린다 | `errorTitle`, `favoritesPartialError`, `ApiError`(shared/api/api-request.ts), `ApiErrorResponse` | API 오류 응답 `error.code`·`message` | handoff 화면 6, #5, architecture.md 5절 | 에러·재시도 |
| 로딩 뼈대 (화면 없음) | 받기 전 자리를 지키는 회색 모양. 움직이지 않는다 | `SkeletonCard`(shared/ui/skeleton-card.tsx), `AnimalDetailSkeleton` | 없음 | architecture.md 7절 | 스켈레톤 |

## 6. 표시 정책

| 용어(화면) | 정의 | 코드 이름 | 밖으로 나가는 값 | 근거 | 헷갈리기 쉬운 말·쓰지 않는 말 |
|---|---|---|---|---|---|
| 움직임 없음 (화면 없음) | 종료 공고이거나 움직임 줄이기 설정이면 전환·등장·누름·하트 튐·진입 효과를 붙이지 않는다 | `allowsMotion`(entities/animal/model/motion.ts), `ANIMAL_CARD_STILL_ATTR`(`data-still`) | 없음 | #29, #37, design/README.md | still |
| 움직임 줄이기 (화면 없음) | 기기 설정 `prefers-reduced-motion: reduce`. 캐릭터 애니메이션 파일도 받지 않는다 | `prefersReducedMotion`, `usePrefersReducedMotion`(shared/lib/use-reduced-motion.ts) | 없음 | #29, architecture.md 9·14절 | — |
| 글꼴 예열 (화면 없음) | 다음 화면에 보일 글자의 본문 글꼴 조각을 미리 받는다. 카드를 누를 때 상세 글자 | `warmFonts`, `warmFontsAfterImages`(shared/lib/font-warm.ts), `detailDisplayText`, `statusDisplayGlyphs` | 없음 | architecture.md 14.2 | 제목 글꼴 부분 글꼴(Jua 서브셋)과 다르다 |
| 진입 효과 (화면 없음) | 카드 → 상세. morph: 카드 사진이 상세 사진 칸으로 커진다(View Transitions). fade: 전환을 지원하지 않는 브라우저에서 200ms 페이드. none: 움직임 없음 | `DetailEntryMode`, `chooseDetailEntryMode`(entities/animal/model/detail-entry.ts), `data-detail-enter` | 없음 | architecture.md 14절, PRD-v1.5 | 첫 화면 등장 |
| 첫 화면 등장 (화면 없음) | 홈과 목록 첫 화면이 순서대로 나타나는 효과 | `data-enter`, `enterOrder`(shared/lib/motion.ts) | 없음 | architecture.md 14절, design/README.md | 진입 효과 |
| 누름 효과 (화면 없음) | 카드를 누를 때 살짝 줄어드는 효과(100ms) | `active:scale-press`(animal-card.tsx) | 없음 | architecture.md 14.4 | 캐릭터의 `press` |
| 하트 튐 (화면 없음) | 관심을 켤 때 하트가 튀는 효과 | `FavoriteButton` | 없음 | architecture.md 14.4 | — |
| 캐릭터 움직임 (화면 없음) | 홈의 고양이·강아지 캐릭터. 정지 그림으로 시작해 클라이언트에서 Rive 애니메이션으로 바뀐다 | `SpeciesCharacter`(entities/animal/ui/species-character.tsx) | `/characters/*.riv`, `/rive/*.wasm` | PRD-v1.2, architecture.md 9절 | — |

## 7. 브랜드

| 용어(화면) | 정의 | 코드 이름 | 밖으로 나가는 값 | 근거 | 헷갈리기 쉬운 말·쓰지 않는 말 |
|---|---|---|---|---|---|
| 서비스 이름 (화면: "멍냥공고") | 이 서비스의 이름. 화면, 문서 제목, og:title, OG 이미지, 문서에 쓴다. 코드에서는 상수 한 곳에서만 정의한다. | `SERVICE_NAME`(shared/config/service.ts) | 문서 제목, og:title, OG 이미지, 카카오 개발자 콘솔의 앱 이름(공유 카드 아래 이름, 코드 밖) | EL 결정(#56), #64 | 냥공고(옛 이름, 쓰지 않는다) |
| 한 줄 소개 (화면: "보호 중인 아이들의 공고가 / 더 많은 사람에게 닿도록.") | 서비스를 한 줄로 소개하는 문구. "/"는 줄바꿈 자리다. 홈 위쪽 서비스 이름 아래에 본문 글자(`body`, `text-2`)로 두 줄, 등장 효과 없이 처음부터 보인다 | `SERVICE_TAGLINE`(shared/config/service.ts) | 없음 | EL 결정(#56), #64 | — |
| 로고 (화면: 홈 위쪽 가로 조합, 브라우저 탭·홈 화면 아이콘, 링크 미리보기 이미지의 알약) | 상징 C(크림 얼굴 + 갈색 선, 복숭아 타일). 컴포넌트 하나가 크기로 변형을 고른다: 24px 이하 tile-small, 25~55px tile, 56px 이상 line. 조합은 상징만(mark) / 가로 조합(lockup, 상징 + 이름 윤곽선). 쓰는 쪽은 크기와 조합만 말하고, 접근성 이름은 서비스 이름이다 | `Logo`(shared/ui/logo.tsx), 원본 SVG `shared/assets/logo/` | `app/favicon.ico`·`icon*.png`·`apple-icon.png`, OG 이미지 | #66 | 글자 로고(옛 홈 서비스명 글자), 로고 색 토큰 `logo`(로고에 쓰지 않는다) |
| 운영 주소·저장 키 (화면 없음) | 옛 이름이 들어간 주소와 키. 사용자 데이터와 이미 퍼진 링크를 지키려고 이름을 바꿔도 그대로 둔다(규칙의 예외) | 쿠키 `nyanggonggo.species`·`nyanggonggo.region`, 저장소 키 `nyanggonggo:favorites`·`nyanggonggo:visited-list`, 이벤트 `nyanggonggo:favorites-change` | `nyanggonggo.vercel.app`, 위 쿠키·저장소 키 | EL 결정(#56) | — |

## 코드 반영 예정 목록

위 표에서 "코드 반영 예정"으로 표시한 것과 그 일을 하는 이슈다. 반영하면 표의 표시와 이 줄을 함께 지운다.

| 용어 | 바뀔 것 | 이슈 |
|---|---|---|
| 마감 D-N, 오늘 마감 | 카드 "보호중 · 마감 D-N", 상세·공유·OG "공고 마감 D-N", 당일 "오늘 마감" | #57 |
| 강조 | "임박" 문구 없앰, `soon` → `nearDeadline`, `isSoon` → `isNearDeadline` | #57 |
| 정렬 | "공고 마감 빠른순", `endingSoon` → `deadline`(URL 정렬 값 포함) | #57 |
| 관심, 관심 목록 | 화면 문구 "찜" → 관심 문구 | #58 |
| 공고 번호 | `noticeNo`를 계약·도메인·상세·카드에 | #59 |
| 나이 | "2026년생 · 60일 미만" 형식 정리 | #60 |
| 정보 줄, 보호소 주소, 보호소 전화, 지도 보기, 전화 걸기, 보호소 정보 시트 | 주소·전화를 정보 줄에서 보호소 정보 시트로 | #62 |

## 받지 않는 공공 API 필드

용어가 아니라 데이터 목록이다. DTO는 받지만(optional) Mapper가 읽지 않아 Wire·Domain·화면에 없다.

| 필드 | 뜻 | 비고 |
|---|---|---|
| `colorCd` | 색 | — |
| `neuterYn` | 중성화 여부 | 값 Y / N / U(12.A P8) |
| `weight` | 체중 | — |
| `vaccinationChk` | 접종 | 일부 항목에만 온다 |
| `sfeSoci` | 성격 | 일부 항목에만 온다 |
| `sfeHealth` | 건강 | 일부 항목에만 온다 |
| `careRegNo` | 보호소 등록번호 | — |
| `happenDt` | 발견일 | 요청 변수 `bgnde`/`endde`는 architecture.md에 "구조일"로 적혀 있다 |

## 코드 이름 정리 후보

이 문서에서 바꾸지 않는다. 남은 후보는 #63에서 하고, 카드 `data-status`는 #61에서 한다.

- **`regionText`와 `region`**: 관할 지역 이름(`orgNm`)과 필터의 시·도 코드가 같은 낱말이다.
- **`status`의 세 뜻**: `Animal.status`(값 2개), 목록 쿼리 status(값 3개, `all` 포함), 카드 `data-status`(아래 항목).
- **카드 `data-status`에 variant 값**: `data-status`(animal-card.tsx)는 status가 아니라 배지 종류(`soon` 포함)를 담는다.
- **강조·정렬 쪽 이름**: 정했다(#56). `soon` → `nearDeadline`, `isSoon` → `isNearDeadline`, `endingSoon` → `deadline`(URL 정렬 값 포함). #57에서 바꾼다. 토큰 `status-soon*`과 `compareEndingSoon`처럼 따라오는 이름은 바꿀 때 같이 맞춘다.
- **enter·fade/info·press의 겹침**: `data-enter`(첫 화면 등장)와 `data-detail-enter`·`DetailEntry`(진입 효과). 진입 모드 `fade`와 morph 중 정보 페이드 값 `"info"`. 카드 누름 효과와 캐릭터 트리거 `press`.
- **"목록"과 dialog의 여러 뜻**: "목록"은 목록 화면, 목록 화면들(목록 + 관심 목록, `shared/lib/app-navigation.ts`), 관심 목록을 가리킨다. 상세 층·시트·사진 크게 보기가 모두 `role="dialog"`다.
- **공고 ↔ `Animal`**: 화면과 문서는 공고, 코드는 `Animal`·`entities/animal`이다.
- **`nyang-` 캐릭터 이름**: `nyang-cat`·`nyang-dog`(SVG, Rive 아트보드, `rive/nyang-characters`)가 브랜드에서 온 이름인지 캐릭터 이름인지 정하지 않았다.
- ~~브랜드가 들어간 컴파일러 밖 문자열~~: 정리하지 않기로 했다(#56). 규칙의 예외로 그대로 둔다(7. 브랜드의 "운영 주소·저장 키").
