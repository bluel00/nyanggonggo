import { describe, expect, it } from "vitest";
import { siteOrigin } from "./site-origin";

/** 지어낸 호스트 */
const PROD = "example-prod.test";
const BRANCH = "example-git-branch.test";
const DEPLOY = "example-deploy-abc.test";
const ALL = { VERCEL_PROJECT_PRODUCTION_URL: PROD, VERCEL_BRANCH_URL: BRANCH, VERCEL_URL: DEPLOY };

describe("siteOrigin: 링크 미리보기 절대 주소의 기준", () => {
  it("운영(VERCEL_ENV=production): 운영 주소", () => {
    expect(siteOrigin({ NODE_ENV: "production", VERCEL_ENV: "production", ...ALL }).href).toBe(`https://${PROD}/`);
  });

  it("미리보기(VERCEL_ENV=preview): 브랜치 주소, 없으면 배포 주소", () => {
    expect(siteOrigin({ NODE_ENV: "production", VERCEL_ENV: "preview", ...ALL }).href).toBe(`https://${BRANCH}/`);
    expect(
      siteOrigin({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: DEPLOY, VERCEL_PROJECT_PRODUCTION_URL: PROD }).href,
    ).toBe(`https://${DEPLOY}/`);
  });

  it("미리보기인데 미리보기 주소가 없으면 운영 주소(운영 주소는 미리보기에도 늘 있다)", () => {
    expect(siteOrigin({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: PROD }).href).toBe(
      `https://${PROD}/`,
    );
  });

  it("로컬 production(next start, Vercel 변수 없음): localhost와 포트", () => {
    expect(siteOrigin({ NODE_ENV: "production", PORT: "3101" }).href).toBe("http://localhost:3101/");
  });

  it("개발 서버: Vercel 변수가 있어도 localhost와 포트", () => {
    expect(siteOrigin({ NODE_ENV: "development", PORT: "3000", ...ALL }).href).toBe("http://localhost:3000/");
  });

  it("변수가 하나도 없으면 localhost:3000", () => {
    expect(siteOrigin({}).href).toBe("http://localhost:3000/");
  });

  it("값에 프로토콜이 있으면 그대로 쓴다", () => {
    expect(siteOrigin({ NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: `https://${PROD}` }).href).toBe(`https://${PROD}/`);
  });
});
