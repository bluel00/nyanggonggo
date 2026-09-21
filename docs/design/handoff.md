# 구현 인수인계

Stage 1–8 (토큰 시트 + 컴포넌트 시트 + 화면 1~8). 화면 1–8과 OG/카카오 카드는 별도 Design 아티팩트에서 이 토큰을 그대로 쓴다.

## 서비스명 상수

`SERVICE_NAME = '냥공고'` (임시). `shared/config/service.ts` 한 곳에 두고 OG 이미지, 카카오 공유 title, `metadata.title` 템플릿이 모두 import 한다. 문자열을 컴포넌트에 직접 쓰지 않는다.

## (a) CSS 변수 → tailwind.config 매핑

CSS 변수는 `globals.css`의 `:root`에 hex 그대로 정의하고, Tailwind는 `var()`를 참조한다 (shadcn 기본 HSL 삼중값 형식을 쓰지 않는다).

| CSS 변수 | Tailwind 키 | 값 |
|---|---|---|
| `--bg` | `colors.bg` (`background`) | #FFFFFF |
| `--canvas` | `colors.canvas` | #F5F5F5 |
| `--text` | `colors.text` (`foreground`, `primary`) | #111111 |
| `--on-text` | `colors['on-text']` (`primary-foreground`) | #FFFFFF |
| `--text-2` | `colors['text-2']` (`muted-foreground`) | #666666 |
| `--border` | `colors.border` | #EEEEEE |
| `--control-border` | `colors['control-border']` (`input`) | #8A8A8A |
| `--status-protected` / `-bg` / `-text` | `colors.status.protected.DEFAULT / bg / text` | #2E9F6B / #E6F6EE / #1F7A50 |
| `--status-soon` / `-bg` / `-text` | `colors.status.soon.*` | #F08A24 / #FDF0E1 / #A85508 |
| `--status-ended` / `-bg` / `-text` | `colors.status.ended.*` | #8A8A8A / #EFEFEF / #666666 |
| `--photo-pill` | `colors['photo-pill']` | rgba(255,255,255,.9) |
| `--kakao` / `--on-kakao` | `colors.kakao.DEFAULT / fg` | #FEE500 / #191919 |
| `--viewer-bg` / `--on-viewer` | `colors.viewer.bg / fg` | #000 / #FFF |
| `--text-disabled` / `--disabled-bg` | `colors.disabled.text / bg` | #A3A3A3 / #EEEEEE |
| `--focus-ring` | `colors.ring` | #111111 |
| `--radius-card` | `borderRadius.card` | 16px |
| `--radius-control` | `borderRadius.control` | 12px |
| `--radius-pill` | `borderRadius.pill` | 999px |
| `--space-3` / `--space-4` | `spacing.feed-gap` / `spacing.page` | 12px / 16px |
| `--touch` | `spacing.touch` (`minHeight`) | 44px |
| `--column-max` | `maxWidth.column` | 480px |
| `--press-duration` / `--sheet-duration` | `transitionDuration.press / sheet` | 100ms / 250ms |
| `--press-scale` | `scale.press` | 0.98 |
| `--ease-out` | `transitionTimingFunction.out` | cubic-bezier(0,0,.2,1) |
| `--font-sans` | `fontFamily.sans` | Pretendard Variable, … |

Type scale (`fontSize`): `title` 20/28/700, `card-title` 16/24/600, `body` 14/20/400, `caption` 12/16/400, `badge` 12/16/600. Line-heights are derived by the designer, not in the brief. Pretendard Variable (OFL) is included as `fonts/PretendardVariable.woff2`, about 2MB. In the app, use the `pretendard` npm package's dynamic-subset CSS or `next/font/local` with a subset to keep the payload small.

`status.protected.DEFAULT` etc. are for dots and points only. Text uses `status-*-text`.

## (b) 컴포넌트 목록과 FSD 배치

| 레이어 | 컴포넌트 | 비고 |
|---|---|---|
| `shared/ui` | Icon, Button, Chip, Segmented, Radio, Select, BottomSheet, Toast, SkeletonCard | 도메인 모름. shadcn `button`, `drawer`(vaul) 또는 `sonner`를 래핑해도 되지만 토큰은 위 매핑만 사용 |
| `entities/animal` | AnimalCard, StatusBadge, `getBadgeVariant(animal)` | Domain `Animal`만 props로 받는다. D-day 3일 이내는 UI가 아니라 domain 서비스에서 판정해도 됨 |
| `features/filter-sheet` | 필터 시트 조립 (Segmented + Select + Chip + Radio + 적용하기) | 값은 URL search params를 읽고, [적용하기]에서만 `router.replace`. 시트 안 draft state는 "적용 전 임시 값"이라 허용, 닫히면 버림 |
| `features/favorite-toggle` | FavoriteButton + localStorage 훅 | 저장은 id + 카드 최소 캐시(썸네일/상태/지역/보호소) |
| `features/share-button` | ShareButton + Kakao SDK + 링크 복사 폴백 + Toast | 실패 시 "링크가 복사됐어요" |
| `widgets/animal-feed` | 헤더(타이틀 / 하트 / 필터) + AnimalCard 리스트 + SkeletonCard + 에러 | `useInfiniteQuery` 커서 |
| `widgets/animal-detail` | 스와이프 이미지 + 정보 + 하단 CTA | |
| `widgets/image-viewer` | 풀스크린 뷰어 | |
| `pages`(app) | 배치만 | 로직 없음 |

## (c) 구현 시 주의할 점

**URL 상태 규칙.** `species`, `region`, `status`, `sort`만 URL search params가 단일 진실 소스다. `page`는 URL에 넣지 않고 `useInfiniteQuery`의 내부 커서로 관리한다. 필터 값을 컴포넌트 state로 복제하지 않는다. `region`은 코드, UI에서 라벨 매핑. 기본값은 `species=cat`, `status=protected`, `sort=latest`.

**PRD 수정 필요.** PRD 5.2의 `page` 항목은 삭제하거나 "내부 상태, URL 미포함"으로 고쳐야 한다. 기능명세서 3.2도 `status` 기본값(all vs protected)을 protected로 확정, `page`를 내부 상태로 확정으로 갱신한다.

**상세 → 뒤로가기 시 목록 복원.** 로드된 페이지와 스크롤 위치를 모두 유지해야 한다. TanStack Query 캐시(같은 queryKey = 필터 4종)로 로드된 페이지를 되살리고, 스크롤 위치는 세션 스토리지 등으로 저장/복원한다. 복원 중에는 스켈레톤이 아니라 캐시 렌더가 먼저 나온다.

**목록 헤더 구성.** 왼쪽 타이틀 ("고양이 공고" / "강아지 공고"), 오른쪽에 하트 아이콘 버튼(44x44, 중립색, 개수 배지 없음)과 필터 버튼 순서. 하트를 누르면 `/favorites`로 이동한다 (`/favorites`의 유일한 진입 경로). 상세 화면 헤더에는 하트를 넣지 않고 하단 CTA의 찜 버튼만 쓴다.

**480px 컬럼 안의 fixed 요소.** 하단 CTA, 바텀시트, 토스트, 뷰어는 `position: fixed`(viewport 기준)를 쓰지 않는다. 컬럼 wrapper에 `position: relative`를 주고 그 안에서 `absolute`, 또는 컬럼 폭에 맞춘 `sticky bottom-0`를 쓴다. 모바일 웹은 내부 스크롤 컨테이너 방식이라 iOS 주소창 변동에 주의(`100dvh`).

**Safe area.** 프레임의 47/34는 iPhone 14 기준 값이다. 코드는 `env(safe-area-inset-top/bottom)`을 쓰고 `viewport-fit=cover`를 켠다. 하단 CTA와 시트는 `padding-bottom: calc(16px + env(safe-area-inset-bottom))`.

**스와이프 이미지.** 상세 이미지는 4:5 고정, 사진이 다른 비율이면 cover로 잘라 보여준다 (초점 center 35%). 풀스크린 뷰어는 원본 비율 contain. CSS scroll-snap (`snap-x snap-mandatory`) 또는 Embla를 쓰고, 뷰어를 닫을 때 마지막 index를 상세로 돌려준다. 도트 인디케이터는 이미지 위가 아니라 아래에 둬도 됨(결정 필요). 사진 없는 공고의 플레이스홀더는 아직 미정.

**접근성.** 종료 텍스트 #8A8A8A, 보호중 #2E9F6B, 임박 #F08A24는 텍스트 대비 미달이라 라벨용 `-text` 변형 토큰을 추가했다. 점 색상은 항상 라벨과 함께 쓴다.

**문구 차이.** 토스트는 브리프의 "링크가 복사됐어요"를 사용했다 (기능명세서 7.3은 "링크를 복사했어요"). 사진 비율은 브리프대로 4:5 cover (기능명세서 4.1.3은 비율 유지). 프레임 기준은 390 (기능명세서 2.1은 375).

**임의로 정한 값 (확인 필요).** 브리프·기능명세서에 없고 디자인 중에 정한 값이다. 확정하거나 바꿀 때는 아래 항목만 손대면 된다.

토큰 (`tokens.json`)
- `status-soon-bg` #FDF0E1, `radius-control` 12px, `control-border` #8A8A8A, `text-disabled` #A3A3A3, `disabled-bg` #EEEEEE, 토스트 배경 (`text`)
- line-height 전부 (20/28, 16/24, 14/20, 12/16), `badge` 스타일 12/600
- 임박 텍스트 `status-soon-text` #A85508 (제안값 #B85F0B는 대비 4.49라 어둡게 조정)

컴포넌트 내부 치수 (`bundle.css`, 토큰 없음)
- 배지 높이 24px / 점 6px, Chip 36px 높이 (터치 영역은 위아래 4px 확장해 44px), Segmented 버튼 36px, Radio 원 20px
- BottomSheet 핸들 36x4px, 딤 rgba(0,0,0,.4), 카드 텍스트 좌우 패딩 4px, 카드 이름-보호소 간격 2px
- 아이콘 선 두께 1.8px, 기본 크기 22px (필터 칩 안에서는 16px)

화면 1~2 (목록 + 필터 시트)
- 필터 버튼은 전용 컴포넌트가 없어 Chip 기본 스타일 + 필터 아이콘으로 표현했다. 상태에 따라 필터 적용 여부를 표시할지는 미정.
- 헤더는 sticky로 가정했고 스크롤 시 구분선은 없다. 헤더 안 세로 여백은 `space-3`, 좌우는 `space-4`.
- 프레임 상단 47px은 빈 safe area (가짜 상태바 없음). 하단 34px은 필터 시트 하단 패딩으로만 반영.
- 필터 시트 제목 "필터", 섹션 라벨은 `body` + `text-2`, 지역 옵션(전체 지역/서울/경기/부산)은 목 데이터.
- 카드 사진은 벡터 placeholder이고 실제 사진 톤은 아니다. 사진 비율은 제각각이지만 카드에서는 4:5 cover로 잘린다.
- 아이콘(heart, filter, close, back, chevron-down)은 자체 stroke SVG이며 구현 시 lucide로 교체 가능.

화면 3~4 (상세 + 풀스크린 뷰어)
- 상세 사진은 상단 safe area 뒤까지 꽉 채우고(4:5, 풀폭), Back은 사진 위 오버레이 `Button variant="overlay"` (44x44, `photo-pill` 배경). 새 variant이지만 기존 토큰만 쓴다.
- 도트 인디케이터는 사진 아래에 두었다 (사진 위 오버레이가 아님). 6px 원, 현재 `text`, 나머지 `control-border`, 간격 `space-2`. 위치와 색은 임의 결정.
- 상태 + D-day 강조: StatusBadge(D-day 없이 상태만) 옆에 D-day를 `title` 스타일 텍스트로 크게 표시, 색은 `status-*-text`. 종료 공고는 배지 "종료"만 표시. 이 조합은 임의 결정.
- 이름(없으면 지역명)을 `title`, 그 아래 "성별 · 추정나이"를 `body` + `text-2`. 성별 표기는 임의로 암컷 / 수컷 / 성별 미상.
- 보호소 / 발견 장소 / 공고 기간은 라벨-값 2열 그리드 (라벨 `body` `text-2`, 열 폭은 내용에 맞춤, 행 간격 `space-3`).
- 하단 CTA 바: `bg` 배경 + 위쪽 `border` 1px 선, 패딩 `space-3` / `space-4`, 아래는 safe area 34px 추가. 찜 44x44 + 카카오톡 공유(남은 폭). 컬럼 안 `absolute`(또는 `sticky bottom-0`), 정보 리스트는 이 바 뒤로 스크롤된다.
- 풀스크린 뷰어: `viewer-bg` 전체, 이미지는 원본 비율 `contain`, Close는 우상단 `Button variant="overlay"`, 페이지 표시(예: 2/3)는 상단 중앙 `caption` + `on-viewer`. 목 데이터에 5장짜리가 없어 "1/5" 대신 3장 기준이며, 가로 사진으로 contain 여백을 보여주려고 2/3를 표시했다.
- 스와이프는 정적 화면으로는 표현할 수 없다. 구현은 scroll-snap 가로 스크롤 (또는 Embla)이며 도트/페이지 표시는 스크롤 위치에서 계산한다.

화면 5 (찜 목록)
- 헤더는 Back + 타이틀 "찜한 고양이" (문구와 구성은 임의). 목록과 같은 카드 피드(`AnimalCard`)를 재사용하고 찜 하트 등 추가 컨트롤은 없다.
- 빈 상태: "아직 찜한 고양이가 없어요" / "마음에 드는 고양이를 저장해보세요 🐾" 중앙 정렬, 버튼 없음 (문구 임의). 찜은 localStorage 저장이며 종료된 공고도 카드로 남는다.

화면 6 (상태 화면)
- 로딩: `SkeletonCard` 3개 (개수 임의). 무한스크롤 하단은 화면 1~2의 스켈레톤 이어짐을 그대로 쓴다.
- 필터 결과 없음: "조건에 맞는 고양이가 없어요" / "필터를 바꿔서 다시 찾아보세요". 필터 초기화 버튼은 명세에서 "결정 필요"라 넣지 않았다 (문구 임의).
- 에러: "지금은 고양이를 불러오지 못했어요" + Primary 버튼 "다시 시도". 빈 상태와 에러는 헤더를 유지하고 메시지·버튼만 중앙에 둔다.
- 종료 공고 카드(피드): 사진 `saturate(.7)`, 배지 "종료". 딤 처리 없음. 종료 공고는 찜 목록과 목록(status=ended)에서 나타난다.
- 종료 공고 상세(신규): 사진 `saturate(.7)`, 배지 "종료"만 표시하고 D-day 텍스트 없음, 사진이 1장이면 도트 없음. 찜/공유 버튼은 활성으로 두었다 (가정: 종료 공고도 공유 가능. 확인 필요).
- 링크 복사 토스트: "링크가 복사됐어요" (카카오 공유 실패 폴백). 상세에서는 CTA 바 위로 뜨도록 `bottom: calc(var(--touch) + var(--space-3) * 3 + var(--safe-bottom))`로 위치를 덮어썼다 (임의 오프셋). 기본 `Toast` 위치는 화면 하단.
- 미제작: 상세 로딩 스켈레톤(명세 7.1)과 상세 에러 상태("뒤로가기" 버튼). 필요하면 다음 단계에서 추가한다.

화면 7 (OG / 카카오 피드 카드)
- 이 두 화면은 코드(Next.js 동적 OG)로 생성되는 화면이라 이 보드는 레이아웃 참고용이다. 디자인 시안 그대로 내보내는 이미지가 아니다.
- OG 1200x630: 600x315 논리 레이아웃을 x2로 그렸다 (토큰 크기 재사용). 사진 풀블리드, 좌상단 서비스명 pill(`badge` + `photo-pill`), 좌하단 흰 카드(`bg`)에 StatusBadge + D-day + 이름 + 지역. 서비스명은 `SERVICE_NAME` 상수를 쓴다. 예시는 목 데이터 보리(부산 해운대구, D-14).
- 확인 필요: `next/og`(Satori)는 woff2와 CSS 변수를 지원하지 않을 가능성이 높다. Pretendard는 ttf/otf로 별도 준비하고, 색은 `var()` 대신 hex를 직접 넣는다.
- 카카오 피드 카드: OG 이미지를 0.5967(358/600)로 줄여 넣은 목업. 제목·설명·"공고 보기" 행은 카카오 템플릿이 그리므로 레이아웃 참고용이다. 이미지 비율 제한은 카카오 문서 확인 필요.

화면 8 (PC 확인, 1280x900)
- 새 화면을 그리지 않고 DS 컴포넌트를 480px 컬럼(`cn-column`)에 다시 마운트했다. 화면 1·3 보드(390 고정)를 import한 것이 아니며, 컬럼 폭만 480이다.
- 프레임 높이 900은 임의. 데스크톱 safe area는 0, 좌우 여백은 `canvas` 색. 컬럼은 `position: relative`, 시트·CTA 바·뷰어·토스트는 모두 컬럼 안 `absolute`라 뷰포트가 아니라 컬럼 기준으로 뜬다. 구현에서도 `fixed`는 쓰지 않는다.
- 08a: 목록 + 열린 필터 시트(컬럼 안). 08b: 상세 + 하단 CTA(컬럼 안). 08c: 뷰어(컬럼 안, `viewer-bg`, 2/3 표시).
- 상세 사진은 컬럼 폭 480에서 4:5로 약 480x600.
