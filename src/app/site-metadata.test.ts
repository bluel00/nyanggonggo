import { getSocialImageMetadataBaseFallback } from "next/dist/lib/metadata/resolvers/resolve-url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVICE_NAME } from "@/shared/config/service";
import {
  detailPath,
  FAVORITES_PATH,
  homePath,
  listPath,
  SITE_DESCRIPTION,
  SITE_METADATA_BASE,
  SITE_OG_IMAGE,
  siteMetadata,
  siteOpenGraph,
} from "./site-metadata";

const SEOUL = "6110000";
const JONGNO = "3000000";

describe("siteOpenGraph: 모든 페이지의 site_name·type·url", () => {
  it.each([
    ["홈", "/home"],
    ["목록", `/?species=cat&region=${SEOUL}`],
    ["관심", FAVORITES_PATH],
    ["상세", detailPath("990000000000001")],
  ])("%s: site_name은 서비스 이름, type은 website, url은 그 페이지 주소", (_, path) => {
    expect(siteOpenGraph(path)).toEqual({ siteName: SERVICE_NAME, type: "website", url: path });
  });

  it("주소는 상대 경로다(절대 주소는 상세 og:image와 같은 Next 기본 기준으로 풀린다)", () => {
    expect(String(siteOpenGraph("/home").url)).toMatch(/^\//);
  });
});

describe("siteMetadata: 상세가 아닌 페이지의 사이트 OG", () => {
  it("제목은 서비스 이름, 설명은 한 줄 소개를 한 줄로(줄바꿈 없음)", () => {
    expect(siteMetadata("/home")).toEqual({
      openGraph: {
        siteName: "멍냥공고",
        type: "website",
        url: "/home",
        title: "멍냥공고",
        description: "보호 중인 아이들의 공고가 더 많은 사람에게 닿도록.",
        images: [{ url: "/opengraph-image", width: 1200, height: 630, type: "image/png", alt: "멍냥공고 유기동물 공고" }],
      },
    });
    expect(siteMetadata("/home").openGraph?.images).toEqual([SITE_OG_IMAGE]);
    expect(SITE_DESCRIPTION).not.toContain("\n");
  });
});

describe("listPath: 목록 주소는 계약으로 해석한 필터 값만으로 다시 만든다", () => {
  it("계약 밖 파라미터(utm_*, page, cursor, 모르는 키)는 버린다", () => {
    expect(
      listPath({ species: "dog", region: SEOUL, utm_source: "kakao", page: "3", cursor: "x", foo: "bar" }),
    ).toBe(`/?species=dog&region=${SEOUL}`);
  });

  it("계약에 있는 값은 남기고, 기본값인 status·sex·sort는 생략한다", () => {
    expect(listPath({ species: "cat", region: SEOUL, district: JONGNO, status: "all", sex: "female", sort: "endingSoon" })).toBe(
      `/?species=cat&region=${SEOUL}&district=${JONGNO}&status=all&sex=female&sort=endingSoon`,
    );
    expect(listPath({ species: "cat", region: SEOUL, status: "protected", sex: "all", sort: "latest" })).toBe(
      `/?species=cat&region=${SEOUL}`,
    );
  });

  it("계약에 없는 값은 쓰지 않는다(기본값으로 해석한 값만 남는다)", () => {
    expect(listPath({ species: "cat", region: SEOUL, status: "lost", sort: "random" })).toBe(`/?species=cat&region=${SEOUL}`);
  });

  it("전국은 region=all", () => {
    expect(listPath({ species: "other", region: "all" })).toBe("/?species=other&region=all");
  });
});

describe("homePath", () => {
  it("넘겨받은 지역이 없으면 /home", () => {
    expect(homePath({})).toBe("/home");
    expect(homePath({ utm_source: "kakao" })).toBe("/home");
  });

  it("넘겨받은 지역만 남기고 나머지는 버린다", () => {
    expect(homePath({ region: SEOUL, district: JONGNO, utm_source: "kakao" })).toBe(`/home?region=${SEOUL}&district=${JONGNO}`);
  });
});

describe("SITE_METADATA_BASE: 절대 주소의 기준은 상세 og:image가 쓰던 Next 기본 기준과 같다", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("Next 자신의 기준 함수와 같은 값(로컬은 localhost)", () => {
    expect(SITE_METADATA_BASE.href).toBe(getSocialImageMetadataBaseFallback(null).href);
    expect(SITE_METADATA_BASE.hostname).toBe("localhost");
  });

  it("Vercel 운영 배포면 운영 주소다(Next 기준 함수가 VERCEL_PROJECT_PRODUCTION_URL을 읽는다)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "example.test");
    expect(getSocialImageMetadataBaseFallback(null).href).toBe("https://example.test/");
  });
});
