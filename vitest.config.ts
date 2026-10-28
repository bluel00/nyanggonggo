import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // 테스트 전용 코드(팩토리 등). 운영 코드는 import하지 않는다(eslint.config.mjs)
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
      // next/font는 Next 빌드가 바꿔 주는 호출이라 테스트에서는 클래스 이름만 주는 stub으로 바꾼다
      "next/font/local": fileURLToPath(new URL("./tests/stubs/next-font-local.ts", import.meta.url)),
      // server-only는 Next 빌드가 자체 사본으로 바꿔 준다(서버는 빈 모듈, 클라이언트 번들은 오류). 테스트는 서버 쪽과 같게 빈 모듈이다
      "server-only": fileURLToPath(new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    // e2e/는 Playwright가 돌린다(pnpm e2e)
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
