# 구현 인수인계

Stage 1–8 (토큰 시트 + 컴포넌트 시트 + 화면 1~8). 화면 1–8과 OG/카카오 카드는 별도 Design 아티팩트에서 이 토큰을 그대로 쓴다.

**2026-10-27 디자인 싱크(#53).** 저장소 main `83e0269`(2026-10-27)의 코드에 다시 맞췄다. 바뀐 것은 맨 아래 (h)에 있다. 문구·줄 순서·동작·표기는 코드가 기준이고, 토큰 이름·값과 시각 표현은 이 디자인 시스템이 정한다.

**2026-10-26 디자인 싱크.** 이 문서는 저장소 main `0b20700`(2026-10-26)의 코드에 맞췄다. 코드가 기준이고, 실제 모습은 자산 묶음 **Screens**의 캡처 15장이다. 기준점 `354e74a`(2026-10-14) 이후 바뀐 16가지는 맨 아래 (e)에 있고, 결정됐지만 아직 코드에 없는 것은 (f)에 따로 모았다(이 문서의 다른 곳에는 반영하지 않았다).

## 서비스명 상수

`SERVICE_NAME = '멍냥공고'`(옛 이름 냥공고), `SERVICE_TAGLINE` = "보호 중인 아이들의 공고가 / 더 많은 사람에게 닿도록."(두 줄, 줄바꿈 자리 고정). 둘 다 `shared/config/service.ts` 한 곳에 둔다. 문자열을 컴포넌트에 직접 쓰지 않는다.

- 문서 제목(탭): 홈 "오늘은 누구를 보러 왔어요? | 멍냥공고", 관심 목록 "관심 공고 | 멍냥공고", 상세 "<제목> 공고 | 멍냥공고", 사이트 기본 "멍냥공고".
- 홈 위의 이름은 글자가 아니라 Logo 가로 조합 그림(`line`, 높이 56)이고, 그 아래 `SERVICE_TAGLINE`이 온다. 로고 그림의 접근성 이름(alt, `aria-label`)은 `SERVICE_NAME`에서 가져온다. 이 디자인 시스템의 `Logo` 컴포넌트도 같다.
- 링크 미리보기 OG 이미지(공고 없음)는 `SERVICE_NAME`을 72px로 쓴다(화면 7).
- 카카오 공유 제목은 "<지역> <축종>"이고 서비스명을 쓰지 않는다. 썸네일은 대표 사진이고, 사진이 없을 때만 OG 이미지다.

## (a) CSS 변수 → Tailwind 테마 매핑

CSS 변수는 `globals.css`의 `:root`에 hex 그대로 정의하고, Tailwind는 `var()`를 참조한다 (shadcn 기본 HSL 삼중값 형식을 쓰지 않는다). 코드는 Tailwind v4라 아래 키는 `globals.css`의 `@theme inline`에 있다(`--color-*`, `--radius-*`, `--shadow-*` …).

| CSS 변수 | Tailwind 키 | 값 |
|---|---|---|
| `--bg` / `--bg-end` | `colors.bg.DEFAULT / end` (`background`) | #FFF8EE / #F9EBD9 (페이지 바탕 세로 그라데이션) |
| `--surface` | `colors.surface` (`card`, `popover`) | #FFFFFF |
| `--canvas` | `colors.canvas` | #F5F5F5 |
| `--text` | `colors.text` (`foreground`, `primary`) | #2B211B |
| `--primary-pressed` | `colors['primary-pressed']` | #1E1712 (기본 Primary 버튼 누름 바탕, 2026-10-27 추가) |
| `--on-text` | `colors['on-text']` (`primary-foreground`) | #FFF8EE |
| `--text-2` | `colors['text-2']` (`muted-foreground`) | #6B5A4C |
| `--border` | `colors.border` | #EADCCB |
| `--control-border` | `colors['control-border']` (`input`) | #8A8A8A |
| `--status-protected` / `-bg` / `-text` | `colors.status.protected.DEFAULT / bg / text` | #2E9F6B / #E6F6EE / #1F7A50 |
| `--status-near-deadline` / `-bg` / `-text` | `colors.status['near-deadline'].*` (코드 이름 `nearDeadline`) | #F08A24 / #FDF0E1 / #A85508 (2026-10-27 `status-soon*`에서 이름만 바꿈) |
| `--status-ended` / `-bg` / `-text` | `colors.status.ended.*` | #8A8A8A / #EFEFEF / #666666 |
| `--photo-pill` | `colors['photo-pill']` | rgba(255,255,255,.9) |
| `--apply-from` / `--apply-to` / `--on-apply` | `colors.apply.from / to`, `colors['on-apply']` (코드 `--color-on-apply`) | #FFD3B6 / #F59A86 / #3A1F1A (적용하기만) |
| `--choice-halo` / `--choice-halo-end` | `colors.halo.DEFAULT / end` | #FFE3C8 / #FFF3E6 |
| `--kakao` / `--on-kakao` | `colors.kakao.DEFAULT / fg` | #FEE500 / #191919 |
| `--viewer-bg` / `--on-viewer` | `colors.viewer.bg / fg` | #000 / #FFF |
| `--text-disabled` / `--disabled-bg` | `colors.disabled.text / bg` | #A3A3A3 / #EEEEEE |
| `--focus-ring` | `colors.ring` | #111111 |
| `--radius-card` / `--radius-choice` | `borderRadius.card / choice` | 22px / 24px |
| `--radius-control` | `borderRadius.control` | 12px |
| `--radius-pill` | `borderRadius.pill` | 999px |
| `--space-3` / `--space-4` | `spacing.feed-gap` / `spacing.page` | 12px / 16px |
| `--touch` | `spacing.touch` (`minHeight`) | 44px |
| `--column-max` | `maxWidth.column` | 480px |
| `--header-h` | (변수 직접) | 68px = `touch` + `space-3` × 2 (목록·관심 목록 헤더) |
| `--screen-top` | (변수 직접) | `space-3` + env(safe-area-inset-top) (화면 위, 상세 사진 칸, 뷰어) |
| `--bottom-cta-h` | (변수 직접) | 68px = `touch` + `space-3` × 2 (상세 CTA 바, 아래 안전 영역 제외) |
| `--toast-offset` | (변수 직접) | 상세 80px = `bottom-cta-h` + `space-3`, 그 밖 `space-6`. 안전 영역은 토스트가 더한다 |
| `--press-duration` / `--sheet-duration` | `transitionDuration.press / sheet` | 100ms / 250ms |
| `--press-scale` | `scale.press` | 0.98 |
| `--ease-out` | `transitionTimingFunction.out` | cubic-bezier(0,0,.2,1) |
| `--shadow-card` · `-card-pressed` · `-card-ended` · `-control` · `-chip` · `-apply` · `-photo` · `-bar` | `boxShadow.card` … `bar` | tokens.json `shadow` 그대로 |
| `--ease-emphasized` / `--ease-heart` | (globals.css 규칙이 `var()`로 직접) | cubic-bezier(.2,0,0,1) / cubic-bezier(.3,1.4,.5,1) |
| 등장·하트·상세 시간 (`--enter-*`, `--list-enter-*`, `--heart-*`, `--detail-*`) | (globals.css 규칙이 `var()`로 직접) | tokens.json `motion` 그대로 |
| `--font-sans` | `fontFamily.sans` | Pretendard Variable, … |
| `--font-display` | (미사용, 아래) | Jua는 `next/font/local`로 싣는다 |

Type scale (`fontSize`): `title` 20/28/700, `card-title` 16/24/600, `body` 14/20/400, `caption` 12/16/400, `badge` 12/16/600. Display (Jua, 400만, 고정 문구만): `display-home` 28/36, `display-title` 22/28, `display-logo` 20/28(디자인 시스템 `Logo` 가로 조합 미리보기의 글자에만 쓴다. 코드의 가로 조합은 윤곽선 그림이라 쓰지 않는다). `display-detail` 24/32/700은 Pretendard(상세 제목). Line-heights are derived by the designer, not in the brief. 코드는 이 값들을 `@theme`의 `--text-*`에 숫자로 복사해 `text-title` 같은 유틸리티로 쓴다(복사라 tokens.json이 바뀌면 함께 고친다). 글꼴: 이 디자인 시스템에는 미리보기용 `fonts/PretendardVariable.woff2`(약 2MB)가 있지만, 저장소에는 글꼴 파일을 두지 않고 앱은 `pretendard` 패키지의 dynamic subset CSS를 쓴다.

`status.protected.DEFAULT` etc. are for dots and points only. Text uses `status-*-text`.

### 코드 전용 (디자인 시스템 토큰에 넣지 않음)

라이브러리 내부 값이라 tokens.json에 넣지 않고 목록만 둔다.

- shadcn 모서리: `--radius` 0.625rem(10px), `--radius-sm` 6px(상세 포커스 외곽선), `--radius-md` 8px(버튼 sm·xs 크기), `--radius-lg` 10px(버튼 그룹). `--radius-xl` · `-2xl` · `-3xl` · `-4xl`은 정의만 있고 쓰지 않는다.
- shadcn 색 별칭: `card-foreground`, `popover-foreground`(시트), `accent`, `accent-foreground`, `secondary`, `secondary-foreground`, `muted`(버튼). 값은 모두 `text` 또는 `border`다. `card-foreground`, `accent`, `accent-foreground`는 쓰지 않는다.
- `--color-destructive`(Tailwind red-600 임시값, 버튼 `destructive` 변형), `--color-destructive-foreground`(red-50, 미사용). 디자인 시스템에 오류색은 없다(코드 주석 "디자인 미정").
- 모션 내부·런타임 변수: `--enter-rise`(등장 거리), `--enter-i`(등장 순서 번호), `--detail-elapsed`(카드를 누른 뒤 지난 시간).
- 토큰이 아닌 고정값: 뼈대 모서리 7px/6px, 시트 핸들 모서리 2px, 아이콘 22px.

### 미사용 (지우지 않고 표시만)

코드에 정의는 있지만 참조하지 않는 것. tokens.json의 usage에도 "미사용"을 적었다.

- `frame-w`, `safe-top`, `safe-bottom`: 시안 기준값이다. 코드는 `env(safe-area-inset-*)`를 쓴다.
- `space-1`: 같은 4px를 Tailwind 기본 간격(`gap-1` 등)으로 쓴다.
- `char-press-x`, `char-press-y`: 값은 Rive 파일 안에 있다(`scripts/rive-characters-scene.mjs`). 앱은 `press` 신호만 보낸다.
- `font-display`(`--font-display`): Jua는 `next/font/local`(고정 문구 6개만 담은 `jua-subset.woff2`, 400)로 싣고, 대체 목록은 `"Jua Fallback", "Pretendard Variable", Pretendard, …`다.
- 글자 스타일 클래스 9개(`.title` `.card-title` `.body` `.caption` `.badge` `.display-home` `.display-detail` `.display-title` `.display-logo`): 클래스로는 쓰지 않는다. 값은 위처럼 `--text-*`로 쓴다. `display-logo`는 코드에서 쓰는 곳이 없지만(홈 이름이 로고 그림이 됨), 디자인 시스템의 `Logo` 컴포넌트가 가로 조합 글자에 쓰므로 지우지 않았다.
- `type.fonts`의 Pretendard 파일 항목: 위 글꼴 문단 참고.

### 값이 다른 것 (기록)

- `display-detail`: 코드와 같다(Pretendard 24/32/700). 종료 공고 제목은 `title` 크기에 줄 높이 32px다.
- OG 이미지 색(`og-model.ts`의 `OG_COLORS`): 2026-10-27(#53)에 방향 A 값으로 맞춰졌다. 글자 `text` #2B211B, 보조 글자 `text-2` #6B5A4C, 흰 카드 `surface` #FFFFFF. 남은 차이는 없다.

## (b) 컴포넌트 목록과 FSD 배치

| 레이어 | 컴포넌트 | 비고 |
|---|---|---|
| `shared/ui` | Button, Chip, Segmented, `RadioOption`, `NativeSelect`, `Sheet`(Radix Dialog), `Toaster`/`showToast`(sonner), SkeletonCard, `BackButton`, `ScreenShell`/`ScreenHeader`, `DisplayText`, `StackLayer`, `AppShell`, `ViewTransition` | 도메인 모름. Icon 컴포넌트는 없고 lucide 아이콘을 바로 쓴다(이 디자인 시스템의 `Icon`은 자리표시). 토큰은 위 매핑만 사용 |
| `entities/animal` | AnimalCard, StatusBadge, `getStatusVariant(animal, now)`, 문구 `statusBadgeText` · `cardDeadlineText` · `detailDeadlineText` · `deadlineDateText` · `statusShareText`, 상세 줄 `detailRows` | Domain `Animal`만 props로 받는다. AnimalCard는 `action`(ReactNode)만 받고 관심은 모른다. 마감 D-3 이하(`nearDeadline`) 판정은 domain 쪽 |
| `features/animal-filter` | 필터 시트 조립, 목록 헤더 필터 버튼 | 시트: 축종 Segmented(3) + 지역 Select 2개(시/도, 시/군/구) + 보호 상태 Chip + 성별 Chip + 정렬 Radio. 머리 / 스크롤 내용 / 고정 아래 영역(적용하기, `shadow-bar`). 값은 URL search params를 읽고, [적용하기]에서만 `router.replace`. 시트 안 draft state는 "적용 전 임시 값"이라 허용, 닫히면 버림 |
| `features/animal-favorite` | FavoriteButton(관심), 목록 헤더 관심 링크, localStorage 훅 | 저장은 id만. 위젯이 카드의 `action` 자리에 넣는다 |
| `features/shelter-info` | 보호소 정보 시트(`ShelterInfoSheet`), 연락처 문구 `SHELTER_CONTACT_LABELS` · `SHELTER_CONTACT_LINK_COPY` | 상세 보호소 줄의 [보호소 정보]로 연다(화면 3~4) |
| `features/animal-share` | ShareButton + Kakao SDK + 링크 복사 폴백 + Toast | 실패 시 "링크가 복사됐어요" |
| `widgets/animal-list` | 헤더(타이틀 / 하트 / 필터) + AnimalCard 리스트 + SkeletonCard + 빈 상태 + 에러 | `useInfiniteQuery` 커서 |
| `widgets/favorite-list` | 관심 목록(헤더, 카드, 빈 상태, 전체·일부 오류) | |
| `widgets/animal-detail` | 스와이프 이미지 + 정보 줄 + 하단 CTA + 뼈대 + 오류 + 풀스크린 뷰어 | 뷰어는 이 위젯 안에 있다 |
| `views` | 화면 배치(`views/species-picker`는 홈) | 로직 없음 |

## (c) 구현 시 주의할 점

**URL 상태 규칙.** `species`, `region`, `district`, `status`, `sort`, `sex` 여섯 키가 URL search params로 단일 진실 소스다. `page`는 URL에 넣지 않고 `useInfiniteQuery`의 내부 커서로 관리한다. 필터 값을 컴포넌트 state로 복제하지 않는다. `region`·`district`는 코드, UI에서 라벨 매핑. 축종과 지역은 기본값이어도 늘 URL에 쓴다. 축종이 URL과 쿠키 모두에 없으면 목록을 그리지 않고 홈(`/home`)으로 보낸다. 기본값은 지역 서울 전체, `status=protected`, `sort=latest`, `sex` 전체.

**PRD 정리.** PRD 5.2의 `page`와 기능명세서 3.2의 `status` 기본값(protected), `page` 내부 상태는 저장소 문서에 이미 반영됐다.

**상세는 목록 위에 얹는 층.** 목록·관심 목록에서 카드를 누르면 아래 화면을 내리지 않고 그 위에 상세를 전체 화면 층(이름 있는 모달 대화상자)으로 얹는다. 주소는 `/animals/{id}`다. 그래서 목록 스크롤을 저장·복원하는 코드는 없다.
- 뒤로가기(버튼, 브라우저, 쓸어넘기기)와 Esc는 층만 닫는다. 아래 목록과 스크롤 위치는 그대로이고, 얹은 동안 아래 목록은 움직이지 않는다. 상세에서 당겨도 새로고침되지 않는다.
- 열면 초점이 상세 제목으로 가고, 닫으면 누른 카드로 돌아온다.
- 공유 링크로 바로 들어오거나 새로고침하면 전체 페이지로 그린다.

**상세 → 뒤로가기.** 목록을 거쳐 온 상세는 원래 목록 주소로 돌아간다(새로고침한 뒤에도 같다). 공유 링크로 바로 들어온 상세는 `/`로 간다(처음 온 사람은 홈, 써 본 사람은 기억한 목록). 받은 공고의 지역으로 좁힌 목록과 그 카드에 맞추던 초점은 없다. 공유 링크는 기억한 설정을 바꾸지 않는다.

**목록 헤더 구성.** 왼쪽 타이틀("고양이 공고" / "강아지 공고" / "기타 동물 공고")은 홈(축종 선택)으로 가는 링크이고 chevron-down이 붙는다(높이 44px, 누름 피드백, 지역을 넘긴다). 오른쪽에 하트 아이콘 링크(44x44, 중립색, 개수 배지 없음, 이름 "관심 공고")와 필터 버튼 순서. 하트를 누르면 `/favorites`(관심 공고)로 이동한다 (`/favorites`의 유일한 진입 경로). 상세 화면 헤더에는 하트를 넣지 않고 하단 CTA의 관심 버튼만 쓴다. 헤더 높이 `header-h` 68px.

**480px 컬럼 안의 fixed 요소.** 하단 CTA, 바텀시트, 토스트, 뷰어는 `position: fixed`(viewport 기준)를 쓰지 않는다. 컬럼 wrapper에 `position: relative`를 주고 그 안에서 `absolute`, 또는 컬럼 폭에 맞춘 `sticky bottom-0`를 쓴다. 모바일 웹은 내부 스크롤 컨테이너 방식이라 iOS 주소창 변동에 주의(`100dvh`).

**Safe area.** 프레임의 47/34는 iPhone 14 기준 값이다. 코드는 `env(safe-area-inset-top/bottom)`을 쓰고 `viewport-fit=cover`를 켠다. 화면 위는 `screen-top`(`space-3` + 위 안전 영역). 필터 시트 아래 영역은 `space-4`(16px) + 아래 안전 영역, 상세 CTA 바는 `space-3`(12px) + 아래 안전 영역.

**스와이프 이미지.** 상세 사진 칸은 첫 사진의 가로/세로를 3:4~4:3으로 제한한 비율이고, 모든 사진을 칸 안에 `contain`(바탕 `bg`)으로 넣는다(README). 첫 사진 크기를 제때 모르면 1:1. 풀스크린 뷰어는 원본 비율 contain. CSS scroll-snap (`snap-x snap-mandatory`) 또는 Embla를 쓰고, 뷰어를 닫을 때 마지막 index를 상세로 돌려준다. 도트 인디케이터는 사진 아래이고, 도트 줄 자리(위 12px + 도트 6px)는 사진 수와 상관없이 늘 둔다(1장이면 빈 줄). 뼈대와 같은 자리라 사진 아래가 움직이지 않는다. 사진이 없거나 못 불러오면 lucide `ImageOff`로 대신한다.

**접근성.** 종료 텍스트 #8A8A8A, 보호중 #2E9F6B, 마감 가까움(`status-near-deadline`) #F08A24는 텍스트 대비 미달이라 라벨용 `-text` 변형 토큰을 추가했다. 점 색상은 항상 라벨과 함께 쓴다.

**문구 차이.** 토스트는 브리프의 "링크가 복사됐어요"를 사용했다 (기능명세서 7.3은 "링크를 복사했어요"). 사진 비율은 README 기준(목록 1:1 cover, 상세는 비율 유지 contain)이고, 브리프의 4:5 cover는 OG 이미지에만 남았다. 프레임 기준은 390 (기능명세서 2.1은 375).

**임의로 정한 값 (확인 필요).** 브리프·기능명세서에 없고 디자인 중에 정한 값이다. 확정하거나 바꿀 때는 아래 항목만 손대면 된다.

토큰 (`tokens.json`)
- `status-near-deadline-bg` #FDF0E1, `radius-control` 12px, `control-border` #8A8A8A, `text-disabled` #A3A3A3, `disabled-bg` #EEEEEE, 토스트 배경 (`text`)
- line-height 전부 (20/28, 16/24, 14/20, 12/16), `badge` 스타일 12/600
- 마감 가까움 텍스트 `status-near-deadline-text` #A85508 (제안값 #B85F0B는 대비 4.49라 어둡게 조정)

컴포넌트 내부 치수 (`bundle.css`, 토큰 없음)
- 배지 높이 24px / 점 6px, Chip 36px 높이 (터치 영역은 위아래 4px 확장해 44px), Segmented 버튼 36px, Radio 원 20px
- BottomSheet 핸들 36x4px, 딤 rgba(0,0,0,.4), 카드 텍스트 패딩 10px 12px 12px(흰 카드 안, 방향 A), 카드 줄 사이 간격 2px
- 아이콘 선 두께 1.8px, 기본 크기 22px (필터 버튼 안 16px, 줄 끝 작은 글자 버튼 14px)

화면 1~2 (목록 + 필터 시트)
- 필터 버튼은 Chip 모양 + 필터 아이콘이고 그림자는 `shadow-control`이다(`FilterButton`). 성별을 고르면 칩을 고른 모양(`text` 채움)이 되고 접근성 이름이 "필터, 암컷"이 된다. 다른 조건은 버튼에 표시하지 않고, 목록 위 필터 요약은 미정이다.
- 헤더는 sticky로 가정했고 스크롤 시 구분선은 없다. 헤더 안 세로 여백은 `space-3`, 좌우는 `space-4`.
- 프레임 상단 47px은 빈 safe area (가짜 상태바 없음). 하단 34px은 필터 시트 아래 영역의 패딩으로만 반영.
- 필터 시트 제목 "필터". 섹션은 축종 / 지역 / 보호 상태 / 성별 / 정렬, 라벨은 `body` + `text-2`. 축종은 고양이 / 강아지 / 기타 동물. 지역은 정적 목록의 2단 Select("전체 시/도", "전체 시/군/구")이고, 시/도를 바꾸면 시/군/구가 전체로 돌아가며 세종처럼 시/군/구가 없으면 시/군/구 Select가 비활성이다. 성별은 전체 / 암컷 / 수컷(기본 전체), 성별 미상 공고는 "전체"에서만 나온다.
- 시트는 머리(핸들·제목) / 스크롤되는 내용 / 아래에 고정된 영역([적용하기]) 셋이다. 아래 영역은 시트와 같은 `surface` 바탕에 위쪽 `shadow-bar`, 높이 상한은 `min(85%, 85svh)`다. 375×667에서도 [적용하기]가 늘 보인다(Screens 05·06).
- 카드(`AnimalCard`): 사진 1:1(왼쪽 위 상태 배지, 오른쪽 위 하트) 아래 세 줄이다.
  - 1줄 제목 = 지역(예 "가나시 다라구", 기타 축종은 "토끼 · 가나시 다라구"), `card-title`.
  - 2줄 보호소 이름(없으면 발견 장소), `body` `text-2`.
  - 3줄 "공고 번호 가나-가나-2026-00001", `caption` `text-2`, 한 줄 말줄임. 값이 없으면 줄이 없다. 이 줄만큼 카드가 높아진다. 카드에 계속 둘지는 운영에서 보고 다시 판단한다.
  - 배지: "보호중 · 마감 D-5", 마감 당일 "보호중 · 오늘 마감". 마감 D-3 이하는 같은 문구에 `status-near-deadline*` 색만 바뀐다("임박" 문구 없음). 종료는 "종료 · 입양" 또는 "종료".
  - 카드 사진은 벡터 placeholder이고 실제 사진 톤은 아니다. 사진 비율은 제각각이지만 카드에서는 1:1 cover(가운데)로 잘린다. 사진 오른쪽 위 관심 하트는 목록과 관심 목록 모두에 있다.
- 필터 시트 정렬: "최신순" / "공고 마감 빠른순".
- 아이콘은 자체 stroke SVG 자리표시이고 앱은 lucide를 쓴다.

화면 3~4 (상세 + 풀스크린 뷰어)
- 상세 사진 칸은 `screen-top` 아래에서 시작해 좌우 24px 안쪽(390에서 342 폭), `radius-card`, 둘레에 `shadow-photo`(종료는 없음). Back은 사진 왼쪽 위 오버레이 `Button variant="overlay"` (44x44, `photo-pill` 배경).
- 도트 인디케이터는 사진 아래. 6px 원, 현재 `text`, 나머지 `control-border`, 간격 `space-2`. 도트 줄 자리는 늘 둔다(위 "스와이프 이미지").
- 상태 줄: 배지는 상태만("보호중", 종료는 "종료 · <결과>" 또는 "종료") 두고, 옆에 마감 글자 "공고 마감 D-5"(마감 당일 "오늘 마감")를 `title` 스타일로 크게, 색은 `status-*-text`로 둔다. 마감 D-3 이하는 배지와 마감 글자 모두 `status-near-deadline*` 색이다. 종료 공고는 배지만 있고 마감 글자가 없다.
- 제목은 늘 지역이고(Domain에 이름이 없다), 기타 축종은 "<동물> · <지역>"이다. 보호 중 공고는 `display-detail`(Pretendard 24/32/700), 종료는 `title`(20/700)에 줄 높이 32px라 제목 줄은 상태와 상관없이 32px다.
- 그 아래 "성별 · 나이"를 `body` + `text-2`로 쓴다. 예: "암컷 · 2026년생 · 60일 미만", "수컷 · 2024년생". 모르면 "성별 미상", "나이 미상". 처음 보는 나이 형식은 공공 API 원문 그대로 둔다.
- 정보 줄(`DetailInfo`): 라벨-값 2열 그리드(라벨 `body` `text-2`, 열 폭은 내용에 맞춤, 행 간격 `space-3`). 순서는 **발견 장소 → 보호소 → 공고 번호 → 공고 기간 → 종료 사유 → 특이사항**이고 값이 없는 줄은 뺀다. 주소·전화 줄은 정보 줄에 없다(보호소 정보 시트로 옮겼다).
  - 보호소 줄 끝에 줄 끝 작은 글자 버튼 [보호소 정보](i 아이콘, `Button variant="small-action"`)가 붙는다. 접근성 이름은 "보호소 정보 보기"다. 종료 공고이거나 주소와 전화가 모두 없으면 이 버튼은 없다.
  - 줄 끝 작은 글자 버튼은 누르는 영역이 44×44px이고 줄 높이는 그대로다.
  - 값은 띄어쓰기에서만 줄을 바꾸고(`word-break: keep-all`), 띄어쓰기 없는 긴 값은 어디서든 끊는다(`overflow-wrap: anywhere`).
  - 종료 사유 줄은 공고 기간 뒤, 특이사항 앞이고, 특이사항과 같으면 종료 사유 한 줄만 보인다.
  - 담당자 이름은 어디에도 보이지 않는다.
- 보호소 정보 시트(`ShelterInfo` + 아래 고정 영역 없는 `BottomSheet`):
  - 구성: 핸들(36×4, `border`) → 제목 = 보호소 이름(`card-title`) → 라벨-값 줄 **주소 <주소> [지도]** → **전화 <번호> [전화]**. 아래 고정 영역은 없다(필터 시트의 [적용하기] 같은 버튼이 없다).
  - 값이 없는 줄은 뺀다. 전화에 숫자가 없으면 줄은 두고 [전화]만 뺀다.
  - [지도]는 새 탭으로 지도 검색, [전화]는 전화 걸기다. 둘 다 줄 끝 작은 글자 버튼이다(핀·수화기 14px).
  - 접근성 이름: 시트를 여는 버튼 "보호소 정보 보기", [지도] "지도에서 주소 보기(새 탭)", [전화] "보호소에 전화", 핸들 "닫기".
  - 닫기: 바탕 탭, 핸들 탭, Esc. 아래로 끌어 닫기는 없다. 움직임 줄이기면 열림·닫힘 애니메이션이 없다.
- 하단 CTA 바: `bg` 배경 + 위쪽 `shadow-bar`, 높이 `bottom-cta-h`(68px, 패딩 `space-3`) + 아래 안전 영역. 관심 하트 44x44 + 카카오톡 공유(남은 폭). 컬럼 안 `absolute`(또는 `sticky bottom-0`), 정보 리스트는 이 바 뒤로 스크롤된다.
- 상세 로딩 뼈대: 실제 상세와 같은 구조·치수(사진 칸, 32px 제목 줄, 도트 줄, 정보 줄, CTA 자리)이고 뒤로가기 버튼을 보인다. 하이드레이션 전에는 `/`로 가는 링크로 동작한다(Screens 13).
- 상세 오류: 사진 칸 자리에 뒤로가기 + "지금은 공고를 불러오지 못했어요"(`card-title`) + Primary [뒤로가기].
- 풀스크린 뷰어: `viewer-bg` 전체, 이미지는 원본 비율 `contain`, Close는 우상단 `Button variant="overlay"`, 페이지 표시(예: 2/3)는 상단 중앙 `caption` + `on-viewer`. 목 데이터에 5장짜리가 없어 "1/5" 대신 3장 기준이며, 가로 사진으로 contain 여백을 보여주려고 2/3를 표시했다.
- 스와이프는 정적 화면으로는 표현할 수 없다. 구현은 scroll-snap 가로 스크롤 (또는 Embla)이며 도트/페이지 표시는 스크롤 위치에서 계산한다.

화면 5 (관심 공고)
- 헤더는 Back + 타이틀 "관심 공고". 목록과 같은 카드 피드(`AnimalCard`)를 재사용하고, 카드마다 사진 오른쪽 위 관심 하트가 있다. 관심 목록 카드는 상세로 갈 때 전환 효과 없이 바로 바뀐다.
- 하트 이름: "관심 공고에 담기" / "관심 공고에서 빼기". 토스트: "관심 공고에 담았어요" / "관심 공고에서 뺐어요". 목록 헤더 하트 링크 이름: "관심 공고".
- 빈 상태: "아직 관심 공고가 없어요" / "하트를 눌러 관심 공고에 담아 보세요" 중앙 정렬, 버튼 없음, 이모지 없음. 축종이 섞이므로 축종 중립 문구다. localStorage에 id만 저장하며 종료된 공고도 카드로 남는다.
- 전부 실패: "지금은 관심 공고를 불러오지 못했어요"(`card-title`) + Primary [다시 시도].
- 일부 실패: 받은 카드는 그대로 두고, 목록 위 한 줄에 "일부 공고를 불러오지 못했어요"(왼쪽)와 글자 버튼 [다시 시도](오른쪽). 다시 시도는 실패한 공고만 다시 받는다(Screens 09). 코드 주석은 "디자인 미정"이다.

화면 6 (상태 화면)
- 로딩: `SkeletonCard` 3개 (개수 임의). 무한스크롤 하단은 화면 1~2의 스켈레톤 이어짐을 그대로 쓴다.
- 필터 결과 없음: "조건에 맞는 고양이가 없어요" / "필터를 바꿔서 다시 찾아보세요". 제목은 `card-title`. 필터 초기화 버튼은 명세에서 "결정 필요"라 넣지 않았다.
- 에러: "지금은 고양이를 불러오지 못했어요"(`card-title`) + Primary 버튼 "다시 시도". 빈 상태와 에러는 헤더를 유지하고 메시지·버튼만 중앙에 둔다.
- 종료 공고 카드(피드): 사진 `saturate(.7)`, 배지 "종료 · <결과>"(결과가 없으면 "종료"). 딤 처리 없음. 종료 공고는 관심 목록과 목록(`status=ended`, `status=all`)에서 나타난다.
- 종료 공고 상세: 사진 `saturate(.7)`, 배지 "종료 · <결과>"만 표시하고 마감 글자 없음. 보호소 줄에 [보호소 정보]가 없고, 종료 사유 줄을 더한다. 관심·공유 버튼은 활성이다(코드에서 확정).
- 토스트: "링크가 복사됐어요"(카카오 공유 실패 폴백), "관심 공고에 담았어요" / "관심 공고에서 뺐어요". 상세에서는 CTA 바 위로 뜬다: 아래에서 `toast-offset`(`bottom-cta-h` + `space-3` = 80px) + 아래 안전 영역. 기본 위치는 `space-6` + 아래 안전 영역.

화면 7 (링크 미리보기 OG 이미지 / 카카오 피드 카드)
- 두 화면 모두 코드(Next.js 동적 OG, `next/og`)가 만든다. 1200×630, 600×315 논리 레이아웃의 2배다. 미리보기는 컴포넌트 시트의 `OgImage` 카드다.
- **OG 이미지(공고)**:
  - 바탕: 사진 전체(`object-fit: cover`, `object-position: center 35%`), 사진이 없으면 `canvas`.
  - 왼쪽 위: 로고 알약. 높이 48(이미지 px) 안에 Logo `tile` 48이 꽉 차서 알약 바탕은 보이지 않는다. 사실상 타일만 있고 이름 글자는 없다(이름은 미리보기 제목에 있다).
  - 아래 흰 카드(`surface`, 위아래 순서): 배지(점 + "보호중", 종료는 "종료 · <결과>") → 마감 날짜 "공고 마감 11월 3일(화)"(40px, 상태 글자색 `status-*-text`, 마감 전에만) → 제목(지역, 기타 축종 "<동물> · <지역>", 40px, `text`) → 보호소 이름(없으면 발견 장소, 28px, `text-2`). 날짜가 들어가 글자가 길어져도 흰 카드 폭 안에 둔다.
  - 색은 방향 A 토큰 값을 hex로 옮겨 쓴다(`text` #2B211B, `text-2` #6B5A4C, `surface` #FFFFFF, 상태색).
- **OG 이미지(공고 없음)**: `SERVICE_NAME` "멍냥공고"를 72px로 둔다.
- **공유 카드·링크 미리보기 설명**: "성별 · 나이 · 보호중 · 공고 마감 11월 3일(화) · <특이사항>". 마감이 지났거나 없으면 날짜 없이 "보호중", 종료는 "종료 · <결과>". 보호소 이름은 넣지 않는다.
- **마감 표기 규칙**: 앱 안(카드·상세)은 상대 표기("마감 D-N", "공고 마감 D-N", 당일 "오늘 마감"), 밖으로 나가는 것(OG·공유)은 날짜("공고 마감 M월 D일(요)")다. 공유된 뒤 시간이 지나도 맞는 표기를 쓰기 위해서다.
- `next/og`(Satori): Pretendard otf를 `pretendard` 패키지에서 읽고, 색은 `var()` 대신 hex로 옮겨 쓴다.
- 카카오 피드 카드: 제목·설명·"공고 보기" 행은 카카오 템플릿이 그린다. 제목은 "<지역> <축종>", 설명은 위 공유 설명이다. 썸네일은 대표 사진이다. 이미지 비율 제한은 카카오 문서 확인 필요.

화면 8 (PC 확인, 1280x900)
- 새 화면을 그리지 않고 DS 컴포넌트를 480px 컬럼(`cn-column`)에 다시 마운트했다. 화면 1·3 보드(390 고정)를 import한 것이 아니며, 컬럼 폭만 480이다.
- 프레임 높이 900은 임의. 데스크톱 safe area는 0, 좌우 여백은 `canvas` 색. 컬럼은 `position: relative`, 시트·CTA 바·뷰어·토스트는 모두 컬럼 안 `absolute`라 뷰포트가 아니라 컬럼 기준으로 뜬다. 구현에서도 `fixed`는 쓰지 않는다.
- 08a: 목록 + 열린 필터 시트(컬럼 안). 08b: 상세 + 하단 CTA(컬럼 안). 08c: 뷰어(컬럼 안, `viewer-bg`, 2/3 표시).
- 상세 사진은 컬럼 폭 480에서 좌우 24px 안쪽 432 폭, 높이는 첫 사진 비율(3:4~4:3)에 따라 324~576. (방향 A, 이전: 폭 480 전체, 480×360 ~ 480×640)

## (d) 방향 A 적용 (2026-10-14)

근거: Design 아티팩트 "냥공고 홈 · 축종 선택"(디자인 원본 이름이라 그대로 둔다)의 DirA, HomeA, MotionA. 표와 데모가 다르면 MotionA에서 실제로 재생한 값을 따랐다. 원칙(README 맨 앞)이 꾸밈보다 먼저다.

- **바탕 그라데이션.** `bg` → `bg-end`는 스크롤 컨테이너가 아니라 움직이지 않는 컬럼(`.cn-column`, 높이 `100dvh`)에 둔다. 스크롤 길이에 걸면 목록이 길수록 거의 단색이 된다. 흰 면(카드, 시트, 컨트롤)은 `surface`. 상세 층의 바탕도 같은 그라데이션이다.
- **그림자.** `shadow-*`는 흰 면에만 쓰고 사진 위·사진 안에는 쓰지 않는다. 목록 카드 그림자는 `box-shadow` 그대로 둬도 되지만, 스크롤이 버벅이면 카드 뒤 정적 레이어로 옮긴다(측정 후 결정).
- **제목 글꼴(주아).** 결정(2026-10-14, 같은 날 앞 결정을 바꿈): Jua는 고정 문구에만 쓰고, 그 글자만 담은 부분 글꼴 하나로 싣는다. 대상 문구는 "오늘은 누구를 보러 왔어요?", "고양이", "강아지", "고양이 공고", "강아지 공고", "기타 동물 공고" 6개뿐이다(2026-10-26부터 "냥공고"가 빠졌다. 홈의 서비스 이름은 Logo 가로 조합 그림이고 Jua 글자가 아니다). 만드는 법: 이 문구들을 `display-glyphs.txt`에 넣고 `pyftsubset Jua-Regular.ttf --text-file=display-glyphs.txt --flavor=woff2`로 woff2를 만들어 `next/font/local`로 올린다(400, `display: 'swap'`). 빠진 글자는 Pretendard로 보인다(대체 목록 맨 앞은 크기를 맞춘 "Jua Fallback"). Jua로 쓰는 고정 문구를 더하거나 바꾸면 부분 글꼴을 다시 만든다. 상세 제목은 공공 API의 기관 이름(`orgNm`)에서 와서 어떤 글자가 나올지 미리 알 수 없으므로 Jua를 쓰지 않고 `display-detail`(Pretendard 24/32/700)로 쓴다.
- **목록 첫 화면 등장.** 세션 플래그는 없다. 뼈대가 보인 목록(목록 키별)의 첫 페이지가 그려질 때 한 번, 뼈대 위치로 잰 첫 화면 카드(종료 제외)만 `list-enter-*`로 올린다. 필터를 바꿔 뼈대가 다시 보이면 다시 돈다. 스크롤·다음 페이지에서는 돌지 않고, 상세에서 돌아와도 목록이 내려간 적이 없어 돌 일이 없다.
- **카드 → 상세 전환.** 목록(`/`) 카드에만 있다. 카드가 화면에서 빠지지 않으므로, 누른 순간 카드 사진 위에 같은 사진을 한 장 겹쳐(`DepartingPhoto`) 상세 사진 칸과 같은 `view-transition-name`으로 짝을 짓는다. 그 사진이 상세 사진 칸의 크기와 위치로 옮겨 가고(칸이 좌우 24px 안쪽이라 보통은 작아진다), 1:1에서 잘렸던 부분이 드러난다. 옛 루트와 옛 사진은 `display: none`이고 새 사진만 `object-fit: cover`다. 상세 바탕은 상세 층의 그라데이션이라 처음부터 불투명하고, 목록 사진이 반투명하게 비치지 않는다. 누른 순간 카드 사진이 아직 로드되지 않았으면 효과 없이 뼈대로 간다. 지원하지 않는 브라우저: 상세 바탕은 바로 깔고 사진과 정보만 `detail-info-duration`(200ms) 페이드. 관심 목록 카드, 종료 공고, 움직임 줄이기는 효과 없이 바로 바뀐다.
- **관심 하트.** `AnimalCard`는 `action`(ReactNode)만 받고, 위젯이 `FavoriteButton`(features)을 넣는다(entities가 features를 모르기 때문). 사진 위 흰 원(40px, `photo-pill`, 누르는 영역 44px) 크기는 그대로, 안의 하트만 1 → 1.2 → 1. 종료 카드는 채움만. 카드 링크와 형제 요소라 하트를 눌러도 카드가 눌리거나 상세로 가지 않는다.
- **움직임 줄이기.** `prefers-reduced-motion: reduce`면 등장·전환·하트·누름·캐릭터 모두 효과 없이 바로 바뀐다(페이드도 없음). 시트도 같다: 2026-10-27(#61)에 코드가 이 규칙에 맞춰져 열림·닫힘 애니메이션이 없다. 토스트(sonner)는 라이브러리가 처리한다.
- **캐릭터.** 선 색 `#3A2A20`으로 바뀐 SVG(17개)를 쓰고, Rive 파일은 선 색을 다시 가져온다. 누름 반응에서 머리 6° 갸웃을 뺐다(`characters.md`).
- **간격.** 결정(2026-10-14): 카드 사이는 `space-3` 12px. DirA 보드는 16px로 그려 첫 화면 카드 수를 쟀으므로, 12px이면 둘째 카드가 조금 더 보인다.

## (e) 2026-10-26 싱크에서 맞춘 것

코드 기준점 `354e74a` 이후 화면에 보이게 달라진 16가지. 찾아보기용 기록이다. 1~3번(정보 줄 안의 주소·전화와 [지도]·[전화], 링크 줄 6px)은 2026-10-27 싱크에서 보호소 정보 시트로 옮겨졌다((h)).

| # | 화면 | 무엇 | 캡처 |
|---|---|---|---|
| 1 | 상세 | 주소·전화 줄과 [지도]·[전화] 링크 | 07 |
| 2 | 상세 | 링크 줄 위아래 6px 추가 | 07 |
| 3 | 상세 | 종료 공고는 주소·전화 숨김, 숫자 없는 전화는 링크만 뺌 | 08 |
| 4 | 상세 | 정보 값 줄바꿈 `keep-all` + `overflow-wrap: anywhere` | 14 |
| 5 | 관심 목록(당시 찜 목록) | 일부 실패 안내 한 줄 + [다시 시도] | 09 |
| 6 | 필터 시트 | 성별 칩 묶음(전체 / 암컷 / 수컷) | 04 |
| 7 | 목록 헤더 | 성별을 고르면 필터 버튼 채움, 이름 "필터, 암컷" | 15 |
| 8 | 필터 시트 | 머리 / 스크롤 / 고정 아래 영역, 높이 상한 `min(85%, 85svh)` | 05, 06 |
| 9 | 배지·공유·OG | 종료 배지 "종료 · <결과>" | 02, 03, 08 |
| 10 | 상세 | 종료 사유 줄 | 08 |
| 11 | 공유·링크 미리보기 | 설명 "성별 · 나이 · 상태(· D-N) · 특이사항", 보호소 이름 뺌 | 없음 |
| 12 | 목록·관심 목록 → 상세 | 상세를 목록 위 전체 화면 층으로 | 07 |
| 13 | 상세 → 뒤로가기 | 원래 목록 주소로, 직접 진입은 `/` | 없음 |
| 14 | 상세 뼈대 | 뒤로가기 버튼 보임 | 13 |
| 15 | 상세 | 제목 줄 높이 늘 32px | 08 |
| 16 | 상세 | 사진 아래 도트 줄 자리 늘 둠 | 07, 08 |

## (f) 결정됐지만 아직 구현 안 됨

2026-10-26에 적은 8가지는 모두 코드에 들어갔다(#53, 아래 (h)). 남은 것:

| # | 항목 | 지금 코드 | 정해진 모습 | 닿는 곳 |
|---|---|---|---|---|
| 1 | 홈 "기타 동물" 선택지 | 고양이·강아지 카드 아래 글자 링크 "다른 동물들도 있어요" | 새·토끼·거북이를 묶은 낮은 가로 카드 "기타 동물"((g) "홈 기타 동물 선택지") | 홈 |

2026-10-26에 구현된 8가지(기록): 공고 마감 표기, 마감 D-3 이하 색으로만 구분, 정렬 "공고 마감 빠른순", 관심 문구, 공고 번호, 나이 표기, 보호소 정보 시트, 서비스 이름 "멍냥공고"와 한 줄 소개.

그때 정하지 않았던 것은 코드에서 이렇게 정해졌다: 마감 당일 "오늘 마감", OG 이미지는 날짜 "공고 마감 M월 D일(요)", 관심 문구는 화면 5, 공고 번호는 상세 보호소 줄 다음과 카드 3줄. 아직 정하지 않은 것: 쿠키·저장소 키(`nyanggonggo.*`, `nyanggonggo:*`)를 새 이름으로 바꿀지(화면에는 보이지 않음).

## (g) 멍냥공고 로고 · 기타 동물 (2026-10-26)

로고는 확정이고 코드에 들어갔다(#66, PR #68. 원본 SVG는 코드 `src/shared/assets/logo/`). 시안은 Design 아티팩트 "냥공고 홈 · 축종 선택"의 10절에 있다. 확정 홈은 "멍냥공고 홈" 보드이고, 색을 고른 기록은 "상징 C 색 시안" 보드의 2번이다. 상징 후보 비교, 쓰일 곳별, 링크 미리보기 보드는 확정 전 색으로 남아 있는 기록이다.

### 로고 구성

- **상징**: C "나란히 두 얼굴"이다. 앞 왼쪽이 고양이(귀와 얼굴이 한 윤곽), 뒤 오른쪽이 강아지(늘어진 귀, 큰 코)이고, 48 격자다.
  - 얼굴: 크림 `bg` #FFF8EE.
  - 선, 눈, 코: 짙은 갈색 #3A2A20. 캐릭터 선 색과 같고, 일러스트 팔레트의 색이다.
  - 선 두께: 48 격자에서 1.6.
- **타일**: 복숭아 그라데이션 `apply-from` #FFD3B6 → `apply-to` #F59A86(135°)에 상징을 올린다.
- **글자 로고**: "멍냥공고", Jua `display-logo` 20/28, `text` #2B211B. 코드에서는 가로 조합 그림(`myeongnyang-lockup.svg`, 글자가 윤곽선)이고, 디자인 시스템 `Logo` 컴포넌트 미리보기만 `display-logo` 글자로 그린다.
- **한 줄 소개**: "보호 중인 아이들의 공고가 / 더 많은 사람에게 닿도록." 두 줄이고 줄바꿈 자리를 고정한다. Pretendard `body` 14/20, `text-2`.
- **새 토큰은 없다.**
  - `apply-from` / `apply-to`의 쓰임을 "적용하기만"에서 "적용하기와 로고 타일"로 넓혔다.
  - `logo` #A84B3A 색 토큰은 2026-10-27에 지웠다(아래).

### 쓰는 규칙

컴포넌트 명세는 `components/Logo/README.md`(`Logo`: `line` / `tile` / `tile-small`, 상징만 / 가로 조합)에 있다. 아래는 그 근거다.


- **48px 이하는 늘 타일과 함께 쓴다.** 복숭아 타일 + 크림 얼굴 + 갈색 선이다. 해당 자리: 브라우저 탭 아이콘, 카카오 공유 카드 아래 앱 아이콘, 링크 미리보기 알약, 홈 화면 추가 아이콘.
  - 이유: 타일 없이 흰 바탕에 두면 크림 얼굴이 흰색과 1.05:1이라 면이 사라지고 선만 남는다.
  - 타일 가장자리 대비: 흰 바탕에서는 옅지만(1.4~2.1:1), 어두운 탭 막대 #202124에서는 7.5:1 이상이다.
- **타일 없이 선 그림으로 쓰는 곳은 큰 자리뿐이다.** 기준은 56px 이상이고, 지금은 홈 상단 하나다. 홈의 크림 바탕에서는 얼굴 면이 바탕에 녹고 갈색 선(13:1)이 모양을 만든다. 의도한 모습이다.
- **작은 크기 전용 판(16·24px)을 만들었다.**
  - 이유: 기본 판의 선(1.6/48)은 16px에서 0.53px가 되어 회색으로 번지고, 얼굴 면과 구별되지 않았다. 24px에서도 눈이 흐렸다.
  - 바꾼 것: 선 2.8, 눈 반지름 1.7 → 2.3, 타일 안쪽 여백 8% → 3%. 그림 모양은 같다.
  - 쓰는 곳: 24px 이하는 작은 판, 32px 이상은 기본 판.
- **링크 미리보기 알약**: 이름 글자 없이 상징 타일만 둔다. 이미지에서 높이 48(논리 24) 알약 안에 `tile` 48이 꽉 차서 알약 바탕은 보이지 않는다(코드 `og-image.tsx` `LogoPill`, `LOGO_SIZE = 48`). 위치는 왼쪽 위 16px(논리)다. 이름은 미리보기 제목에 이미 있다.
- **`logo` 토큰**: 2026-10-27에 tokens.json에서 지웠다. 디자인 시스템과 코드 모두 쓰는 곳이 없다(코드는 globals.css에 정의만 남았다).
- **`display-logo` 글자 스타일**: 지우지 않았다. 이 디자인 시스템의 `Logo` 컴포넌트가 가로 조합의 글자를 이 스타일로 그리기 때문이다. 코드는 쓰지 않는다.
- **56px 미만 가로 조합(타일 + 이름)**: 원본 파일이 없다. 코드는 원본 가로 조합에서 이름 부분을 잘라 만들어 두었고, 지금 쓰는 곳은 없다. `Logo` 컴포넌트는 글자로 그린다.

### 쓰일 곳별 크기와 파일

원본은 이 디자인 시스템의 자산 묶음 **Logo**에 있다.

| 곳 | 크기 | 파일 (Next.js App Router) | 판 |
|---|---|---|---|
| 홈 상단 | 가로 조합 높이 56, 그 아래 소개 2줄 | `myeongnyang-lockup.svg`(코드 `src/shared/assets/logo/`) + `SERVICE_TAGLINE` | 선 그림 가로 조합, 타일 없음. 소개는 `body` 14/20 `text-2` |
| 브라우저 탭 | 16, 32 | `app/favicon.ico`(`icon-16.png` + `icon-32.png`로 만든다) 또는 `app/icon.png` 32 | 16 작은 판(모서리 3/16), 32 기본 판(모서리 7/32), 바깥 투명 |
| iOS 홈 화면 | 180 | `app/apple-icon.png` ← `apple-icon-180.png` | 타일 꽉 채움, 모서리 없음(iOS가 둥글린다), 안쪽 여백 8% |
| 웹 앱 매니페스트 | 192, 512 | `app/manifest.ts` `icons`: `icon-192.png`, `icon-512.png`(purpose `any`), `icon-512-maskable.png`(purpose `maskable`) | `any`는 여백 8%. `maskable`은 여백 17%로 선이 가운데 80% 원 안에 든다(바깥 선 픽셀 0개로 확인) |
| 카카오 공유 카드 아래 앱 아이콘 | 정사각 원본 | 카카오 디벨로퍼스 콘솔 앱 아이콘 ← `icon-512.png` | 타일 꽉 채움. 콘솔 업로드 규격과 카드에서 잘리는 모양은 **확인 필요** |
| 링크 미리보기 알약 | 논리 24 (이미지 48) | `next/og`에 `myeongnyang-tile.svg`의 path를 그대로 넣는다 | 기본 판 타일. 크기 규칙은 실제 픽셀 기준이고, 이미지에서는 48px라 기본 판이다 |
| 가로 조합(문서, 소개 자료) | 높이 56 | `myeongnyang-lockup.svg` | 상징 선 그림 56 + 10 + 글자 로고 20px. 글자는 Jua 윤곽선으로 바꿔 넣어 글꼴 없이 보인다(Jua는 SIL OFL) |

자산 목록:

| 파일 | 크기 |
|---|---|
| `myeongnyang-mark.svg` | 선 그림, 48 격자, 타일 없음 |
| `myeongnyang-tile.svg` | 기본 판 타일(32px 이상), 모서리 10.5/48 |
| `myeongnyang-tile-small.svg` | 작은 판 타일(16·24px), 선 2.8, 모서리 9/48 |
| `myeongnyang-lockup.svg` | 가로 조합, 약 130×56 |
| `icon-16.png` | 16, 작은 판, 투명 모서리 |
| `icon-32.png` | 32, 기본 판, 투명 모서리 |
| `apple-icon-180.png` | 180, 모서리 없음 |
| `icon-192.png` | 192, 모서리 없음 |
| `icon-512.png` | 512, 모서리 없음 |
| `icon-512-maskable.png` | 512, maskable 안전 영역 |

- `favicon.ico`(16 + 32)는 이 자산 묶음에 올릴 수 없는 형식이라 PNG 두 장으로 두었다. ico 파일은 따로 전달했다.
- 확정 전 후보 파일(`myeongnyang-mark-A/B/C`, `-icon-*`, `-favicon-*`)은 목록에서 뺐다. 업로드한 파일 자체는 지우지 않았다.
- Jua 부분 글꼴: 서비스 이름은 부분 글꼴에 넣지 않는다. 홈 이름이 가로 조합 그림(윤곽선)이라 고정 문구는 7개에서 6개가 됐다("냥공고" 빠짐, "멍냥공고"도 넣지 않음).

### 기타 동물 캐릭터 (새 · 토끼 · 거북이)

`characters.md` "기타 동물 세 마리"에 파일, 팔레트, 부위 나누기가 있다. 요약:

- 정면, 120×120, 루트 기준점 (60, 112). 선 `#3A2A20` 1.8, 고양이·강아지와 같은 눈·볼·입 문법이다.
- 부위 그룹(`id`): 공통으로 루트, `head`, `eyes-open` / `eyes-closed` / `eyes-happy`를 둔다.
  - 새: `body`, `wing-left` / `wing-right`, `crest`, `beak`, `tail`, `leg-left` / `leg-right`.
  - 토끼: `body`, `ear-left` / `ear-right`, `tail`, `leg-front-*`, `foot-*`.
  - 거북이: `shell`, `leg-front-*`.
- 이번에는 정지 그림이다. 움직임은 로고 움직임과 함께 다음 작업에서 한다.

### 홈 "기타 동물" 선택지

- **상태**: 결정, 코드 미구현((f) 1). 지금 코드 홈은 고양이·강아지 카드 아래 글자 링크 "다른 동물들도 있어요"다.
- **문제**: 그 링크는 버튼으로 보이지 않았다. 이 링크를 아래 버튼으로 바꾼다.
- **위계**: 고양이·강아지 카드(높이 약 200)가 주인공이다. 기타 동물은 그 아래 `space-3` 12px에 놓는 낮은 가로 카드다. 폭은 두 카드를 합친 폭이고 높이는 72px다.
- **모양**:
  - 카드: `surface`, `radius-choice` 24, `shadow-card`.
  - 안쪽 여백: 왼쪽 14, 오른쪽 16, 요소 간격 12. 72와 안쪽 치수는 컴포넌트 내부 치수라 토큰으로 만들지 않는다.
  - 왼쪽: 새 · 토끼 · 거북이를 각 44px로 조금 겹쳐 놓는다(−6, −4px). 후광은 없다. 104px 후광은 큰 카드에만 둔다.
  - 가운데: 이름표 "기타 동물". Jua `display-title` 22/28, `text`. 고양이·강아지 이름표와 같은 문법이다.
  - 오른쪽: chevron-right 20px, `text-2`(lucide ChevronRight, 새로 쓰는 아이콘). 누르면 넘어가는 버튼으로 보이게 한다.
- **접근성**:
  - 누르는 영역은 카드 전체(390 폭에서 358×72)라 44×44를 넘는다.
  - `<button>`(또는 `<a>`)이고 이름은 "기타 동물"이다. 캐릭터와 chevron은 `aria-hidden`이다.
  - 초점 링은 `focus-ring` 2px, 띄움 2px다.
- **누름**: 큰 카드와 같은 문법이다.
  - 100ms(`press-duration`) 동안 카드는 `press-scale` 0.98과 `shadow-card-pressed`가 된다.
  - 캐릭터 셋이 함께 `eyes-happy`가 되고, 바닥 가운데를 기준으로 `char-press-x` 1.03 × `char-press-y` 0.96 납작해진다.
  - 손을 떼면 바로 기타 동물 목록으로 간다. 움직임 줄이기 설정이면 효과 없이 바로 간다.
- **홈 배치** (390×844):
  - 위 안전 영역 47 아래에 헤더를 둔다. 헤더 안 여백은 위 12, 양옆 16이다. 헤더는 지금 코드와 같이 로고 가로 조합(`line`, 높이 56) → 한 줄 소개(2줄) 순서다.
  - 그 아래 본문은 남은 높이의 가운데에 놓는다. 순서는 질문 "오늘은 누구를 보러 왔어요?" + 보조 문구 → 28px → 고양이·강아지 카드 → 12px → 기타 동물 카드다.
  - 본문 요소 사이 간격을 32에서 28로 줄였다. 로고 아래 소개 두 줄이 들어갈 높이를 만들기 위해서다.
- **들어올 때 동작**: 순서는 제목(보조 문구 포함) → 고양이 카드 → 강아지 카드 → 기타 동물 카드다. 지금 규칙(`enter-*`, 60ms 간격, 500ms에 끝)에서 링크 자리를 기타 동물 카드가 받는다. 로고와 소개는 처음부터 보이게 두는 것을 제안한다(정하지 않음).
- **기타 동물 캐릭터 움직임**: 이번에는 정지다. 대기·인사 동작은 다음 작업에서 정한다.

## (h) 2026-10-27 싱크(#53)에서 맞춘 것

기준 코드 main `83e0269`. 출처는 저장소 이슈 #53의 열린 줄 9개다. 위 본문에 반영했고, 여기는 찾아보기용이다.

| # | 무엇 | 반영한 곳 |
|---|---|---|
| T1 | `status-soon*` → `status-near-deadline*`(값 그대로). 설명에서 "임박"을 빼고 "마감 D-3 이하, 문구 없이 색으로만 구분" | tokens.json, (a), bundle.css `.cn-badge--near-deadline` |
| T2 | 새 토큰 `primary-pressed` #1E1712(기본 Primary 버튼 누름 바탕). 이름은 기존 상태 이름 규칙 `<대상>-pressed`(`shadow-card-pressed`)를 따랐다 | tokens.json, (a), bundle.css |
| T3 | `logo` 색 지움. `display-logo`는 `Logo` 컴포넌트가 써서 남김 | tokens.json, (a), (g) |
| C1 | Logo: OG 알약은 높이 48에 `tile` 48(바탕 안 보임), 56 미만 가로 조합은 원본 없음 | (g), `components/Logo` |
| C2 | 카드 배지 "보호중 · 마감 D-N" / "보호중 · 오늘 마감", 마감 D-3 이하는 색으로만, 종료 "종료 · <결과>" | `StatusBadge`, 화면 1~2 |
| C3 | 상세 배지는 상태만, 옆에 "공고 마감 D-N" / "오늘 마감" | `StatusBadge`(`detail`), `DeadlineText`, 화면 3~4 |
| C4 | 카드 3줄 "공고 번호 <번호>" | `AnimalCard`, 화면 1~2 |
| C5 | 줄 끝 작은 글자 버튼 | `Button variant="small-action"` |
| C6 | 아래 고정 영역 없는 시트(보호소 정보) | `BottomSheet`(footer 없음), `ShelterInfo` |
| S1 | 홈: 로고 가로 조합 + 한 줄 소개 | 서비스명 상수, (g) |
| S2 | 문서 제목 "… \| 멍냥공고" | 서비스명 상수 |
| S3 | 목록 카드 | 화면 1~2 |
| S4 | 상세 상태 줄·성별 나이·정보 줄 순서 | 화면 3~4 |
| S5 | 보호소 정보 시트(새 화면) | 화면 3~4 |
| S6 | "찜" → "관심" | 화면 5, `FavoriteButton`, `Toast` |
| S7 | 정렬 "공고 마감 빠른순" | 화면 1~2, `Radio` |
| S8 | OG 이미지(공고, 공고 없음)·공유 설명·마감 표기 규칙 | 화면 7, `OgImage` 미리보기 |
| D1~D6 | "찜", "임박", "D-day", 나이 예시, 서비스 이름, 상세·카드 예시 | README, handoff, characters.md, bundle.js |

