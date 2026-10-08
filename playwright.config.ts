import { defineConfig, devices } from "@playwright/test";

/**
 * E2E는 실제 브라우저에서만 확인할 수 있는 것(내부 스크롤 컨테이너, 뒤로가기, 스크롤 복원)만 다룬다.
 * 목록 API 응답은 각 테스트가 page.route로 고정하고(항상 같은 결과), 상세 페이지는 서버 렌더라
 * 실제 공고 id를 쓴다(아래 e2e/fixtures.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"], // 모바일 뷰포트(412x915)
    trace: "retain-on-failure",
  },
  /*
   * 대부분은 개발 서버에서 돈다. 상세 로딩 경계(detail-loading)와 홈 캐릭터 Rive(home-rive)는 production 서버에서 돈다:
   * Next는 production에서만 링크를 prefetch하고, 카드를 누른 즉시 로딩 뼈대가 보이는 것은 그 prefetch 덕분이다.
   * 개발 서버(.next/dev)와 production 빌드(.next)는 출력 폴더가 달라 함께 띄울 수 있다.
   */
  projects: [
    {
      name: "dev",
      testIgnore: /(detail-loading|home-rive)\.spec\.ts/,
      // 브라우저는 localhost로 연다(개발 서버가 127.0.0.1을 다른 오리진으로 보고 dev 리소스를 막는다)
      use: { baseURL: "http://localhost:3000" },
    },
    {
      name: "production",
      testMatch: /(detail-loading|home-rive)\.spec\.ts/,
      use: { baseURL: "http://localhost:3100" },
    },
  ],
  webServer: [
    {
      command: "pnpm dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // 매 실행 빌드한다(지금 코드의 production 동작을 본다). 이미 3100에 띄워 둔 서버가 있으면 그것을 쓴다
      command: "pnpm build && pnpm start -p 3100",
      url: "http://127.0.0.1:3100/home",
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
