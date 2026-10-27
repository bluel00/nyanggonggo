// @vitest-environment jsdom
/**
 * 공유·미리보기 출력의 특성 테스트(#73). 공유 내용 계약으로 정리하기 **전** 값을 기록하고, 정리하는 동안 이 기대값은 바꾸지 않는다.
 * 대상: OG 메타(상세·사이트), OG 이미지 모델, 카카오 템플릿 인자, 링크 복사 주소.
 * 고정한 것: 공고(지어낸 값), 기준 시각 NOW, 공유 주소 기준 ORIGIN. 서버 조회는 가짜로 바꿔 공공 API를 부르지 않는다.
 *
 * 리팩터 중에 바뀔 수 있는 것은 맨 아래 "출력을 부르는 곳"(drive*) 함수뿐이다(부르는 방법이 바뀌어도 나오는 값은 같아야 한다).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { toAnimal, type Animal } from "@/entities/animal";
import { makeWire } from "@tests/factories/animal";

const getById = vi.fn<(id: string) => Promise<AnimalWireDto>>();
vi.mock("@/server/animals/container", () => ({ getAnimalService: () => ({ getById }) }));
vi.mock("@/shared/ui/toast", () => ({ showToast: () => {} }));

const { generateMetadata: detailMetadata } = await import("@/app/animals/[id]/page");
const { generateMetadata: homeMetadata } = await import("@/app/home/page");
const { generateMetadata: listMetadata } = await import("@/app/page");
const { metadata: favoritesMetadata } = await import("@/app/favorites/page");
const { buildOgModel } = await import("@/app/animals/[id]/og-model");
const { ShareButton } = await import("@/features/animal-share");

const NOW = new Date("2026-10-26T09:00:00+09:00");
const ORIGIN = "https://share.example";
/** 지어낸 사진 주소(허용된 이미지 호스트의 없는 경로, e2e 스텁과 같은 방식) */
const PHOTO = "http://openapi.animal.go.kr/e2e-fixture/400x400.jpg";

/** 지어낸 공고 셋: 사진 있는 보호중 고양이 / 사진 없는 기타 동물 / 종료(입양) 강아지 */
const WIRES = {
  cat: makeWire({
    id: "990000000000101",
    species: "cat",
    images: [PHOTO],
    sex: "female",
    ageText: "2025(년생)",
    regionText: "가상시 예시구",
    shelterName: "예시 보호소",
    specialMarkText: "줄무늬 꼬리",
    noticeEndDate: "2026-10-31",
  }),
  rabbit: makeWire({
    id: "990000000000102",
    species: "other",
    kindText: "토끼",
    images: [],
    sex: "male",
    regionText: "가상도 예시시",
    foundPlaceText: "예시 공원 입구",
    noticeEndDate: "2026-10-27",
  }),
  endedDog: makeWire({
    id: "990000000000103",
    species: "dog",
    images: [PHOTO],
    status: "ended",
    endResultText: "입양",
    sex: "unknown",
    regionText: "가상시 다른구",
    shelterName: "다른 보호소",
    endReasonText: "예시 입양 완료",
    noticeEndDate: "2026-10-20",
  }),
} satisfies Record<string, AnimalWireDto>;

const writeText = vi.fn(async (_text: string) => {});
const sendDefault = vi.fn();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  getById.mockReset();
  writeText.mockClear();
  sendDefault.mockClear();
  delete (window as unknown as { Kakao?: unknown }).Kakao;
});

describe("OG 메타(상세)", () => {
  it("보호중 고양이(사진 있음)", async () => {
    expect(await driveDetailMetadata(WIRES.cat)).toEqual({
      title: "가상시 예시구 고양이 공고 | 멍냥공고",
      description: "암컷 · 2025(년생) · 보호중 · D-5 · 줄무늬 꼬리",
      openGraph: {
        siteName: "멍냥공고",
        type: "website",
        url: "/animals/990000000000101",
        title: "가상시 예시구 고양이 공고 | 멍냥공고",
        description: "암컷 · 2025(년생) · 보호중 · D-5 · 줄무늬 꼬리",
      },
    });
  });

  it("기타 동물(사진 없음, 마감 하루 전)", async () => {
    expect(await driveDetailMetadata(WIRES.rabbit)).toEqual({
      title: "가상도 예시시 토끼 공고 | 멍냥공고",
      description: "수컷 · 나이 미상 · 임박 · D-1",
      openGraph: {
        siteName: "멍냥공고",
        type: "website",
        url: "/animals/990000000000102",
        title: "가상도 예시시 토끼 공고 | 멍냥공고",
        description: "수컷 · 나이 미상 · 임박 · D-1",
      },
    });
  });

  it("종료(입양) 강아지", async () => {
    expect(await driveDetailMetadata(WIRES.endedDog)).toEqual({
      title: "가상시 다른구 강아지 공고 | 멍냥공고",
      description: "성별 미상 · 나이 미상 · 종료 · 입양",
      openGraph: {
        siteName: "멍냥공고",
        type: "website",
        url: "/animals/990000000000103",
        title: "가상시 다른구 강아지 공고 | 멍냥공고",
        description: "성별 미상 · 나이 미상 · 종료 · 입양",
      },
    });
  });
});

describe("OG 메타(사이트)", () => {
  const site = (url: string) => ({
    siteName: "멍냥공고",
    type: "website",
    url,
    title: "멍냥공고",
    description: "보호 중인 아이들의 공고가 더 많은 사람에게 닿도록.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, type: "image/png", alt: "멍냥공고 유기동물 공고" }],
  });

  it("홈, 목록(계약 밖 쿼리는 빠짐), 관심 목록", async () => {
    expect((await homeMetadata({ searchParams: Promise.resolve({ region: "6110000", utm_source: "x" }) })).openGraph).toEqual(
      site("/home?region=6110000"),
    );
    expect(
      (await listMetadata({ searchParams: Promise.resolve({ species: "dog", region: "all", sex: "female", utm_source: "x" }) })).openGraph,
    ).toEqual(site("/?species=dog&region=all&sex=female"));
    expect(favoritesMetadata.openGraph).toEqual(site("/favorites"));
  });
});

/** OG 이미지가 그리는 값(og-image.tsx의 상태 칩·D-N·제목·보조 줄, 사진은 opengraph-image.tsx가 받는다). OG 메타 문구는 위에서 본다 */
describe("OG 이미지 모델", () => {
  it("보호중 고양이(사진 있음)", () => {
    expect(driveOgModel(WIRES.cat)).toEqual({
      title: "가상시 예시구",
      sub: "예시 보호소",
      variant: "protected",
      badgeText: "보호중",
      dDayText: "D-5",
      imageSrc: PHOTO,
    });
  });

  it("기타 동물(사진 없음, 보호소 없음 → 발견 장소)", () => {
    expect(driveOgModel(WIRES.rabbit)).toEqual({
      title: "토끼 · 가상도 예시시",
      sub: "예시 공원 입구",
      variant: "nearDeadline",
      badgeText: "임박",
      dDayText: "D-1",
      imageSrc: null,
    });
  });

  it("종료(입양) 강아지", () => {
    expect(driveOgModel(WIRES.endedDog)).toEqual({
      title: "가상시 다른구",
      sub: "다른 보호소",
      variant: "ended",
      badgeText: "종료 · 입양",
      dDayText: null,
      imageSrc: PHOTO,
    });
  });
});

describe("카카오 템플릿 인자", () => {
  const proxied = `${ORIGIN}/api/image-proxy?src=${encodeURIComponent(PHOTO)}`;

  it("보호중 고양이: 사진은 이미지 프록시 절대 주소", async () => {
    const link = { mobileWebUrl: `${ORIGIN}/animals/990000000000101`, webUrl: `${ORIGIN}/animals/990000000000101` };
    expect(await driveKakao(WIRES.cat)).toEqual({
      objectType: "feed",
      content: { title: "가상시 예시구 고양이", description: "암컷 · 2025(년생) · 보호중 · D-5 · 줄무늬 꼬리", imageUrl: proxied, link },
      buttons: [{ title: "공고 보기", link }],
    });
  });

  it("기타 동물(사진 없음): 사진 대신 상세 OG 이미지", async () => {
    const link = { mobileWebUrl: `${ORIGIN}/animals/990000000000102`, webUrl: `${ORIGIN}/animals/990000000000102` };
    expect(await driveKakao(WIRES.rabbit)).toEqual({
      objectType: "feed",
      content: {
        title: "가상도 예시시 토끼",
        description: "수컷 · 나이 미상 · 임박 · D-1",
        imageUrl: `${ORIGIN}/animals/990000000000102/opengraph-image`,
        link,
      },
      buttons: [{ title: "공고 보기", link }],
    });
  });

  it("종료(입양) 강아지", async () => {
    const link = { mobileWebUrl: `${ORIGIN}/animals/990000000000103`, webUrl: `${ORIGIN}/animals/990000000000103` };
    expect(await driveKakao(WIRES.endedDog)).toEqual({
      objectType: "feed",
      content: { title: "가상시 다른구 강아지", description: "성별 미상 · 나이 미상 · 종료 · 입양", imageUrl: proxied, link },
      buttons: [{ title: "공고 보기", link }],
    });
  });
});

describe("링크 복사 주소", () => {
  it.each(Object.values(WIRES))("$id: 상세 절대 주소", async (wire) => {
    expect(await driveLinkCopy(wire)).toBe(`${ORIGIN}/animals/${wire.id}`);
  });
});

/* ---------- 출력을 부르는 곳(drive*). 리팩터에서 부르는 방법이 바뀌면 여기만 고친다 ---------- */

async function driveDetailMetadata(wire: AnimalWireDto) {
  getById.mockResolvedValue(wire);
  return detailMetadata({ params: Promise.resolve({ id: wire.id }) });
}

function driveOgModel(wire: AnimalWireDto) {
  const { title, sub, variant, badgeText, dDayText, imageSrc } = buildOgModel(toAnimal(wire), NOW);
  return { title, sub, variant, badgeText, dDayText, imageSrc };
}

function shareButton(animal: Animal, kakaoKey?: string) {
  return <ShareButton animal={animal} kakaoKey={kakaoKey} origin={ORIGIN} />;
}

async function driveKakao(wire: AnimalWireDto) {
  (window as unknown as { Kakao: unknown }).Kakao = { isInitialized: () => true, init: vi.fn(), Share: { sendDefault } };
  render(shareButton(toAnimal(wire), "test-kakao-key"));
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  await waitFor(() => expect(sendDefault).toHaveBeenCalledOnce());
  return sendDefault.mock.calls[0][0];
}

async function driveLinkCopy(wire: AnimalWireDto) {
  render(shareButton(toAnimal(wire), ""));
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  return writeText.mock.calls[0][0];
}
