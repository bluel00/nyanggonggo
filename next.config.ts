import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OG 이미지(opengraph-image)가 node_modules의 pretendard 정적 otf를 런타임에 읽는다(src/server/og/og-assets.ts).
  // 파일 추적이 동적 경로를 놓칠 수 있어 명시적으로 넣는다. Vercel 배포에서 실제로 포함되는지는 확인 필요(architecture.md 12절).
  // 홈 캐릭터 Rive 런타임 WASM은 파일 이름에 버전이 들어 있어 내용이 바뀌지 않는다(src/entities/animal/lib/character-animation-assets.ts).
  // Rive 문서의 자체 호스팅 권장대로 1년 immutable로 둔다.
  async headers() {
    return [
      {
        source: "/rive/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/animals/**": [
      "./node_modules/pretendard/dist/public/static/Pretendard-Regular.otf",
      "./node_modules/pretendard/dist/public/static/Pretendard-Bold.otf",
    ],
  },
};

export default nextConfig;
