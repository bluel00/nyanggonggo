import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OG 이미지(opengraph-image)가 node_modules의 pretendard 정적 otf를 런타임에 읽는다(src/server/og/og-assets.ts).
  // 파일 추적이 동적 경로를 놓칠 수 있어 명시적으로 넣는다. Vercel 배포에서 실제로 포함되는지는 확인 필요(architecture.md 12절).
  outputFileTracingIncludes: {
    "/animals/**": [
      "./node_modules/pretendard/dist/public/static/Pretendard-Regular.otf",
      "./node_modules/pretendard/dist/public/static/Pretendard-Bold.otf",
    ],
  },
};

export default nextConfig;
