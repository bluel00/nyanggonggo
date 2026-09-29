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
    // 브라우저는 localhost로 연다(개발 서버가 127.0.0.1을 다른 오리진으로 보고 dev 리소스를 막는다)
    baseURL: "http://localhost:3000",
    ...devices["Pixel 7"], // 모바일 뷰포트(412x915)
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
