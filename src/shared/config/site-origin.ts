/**
 * 사이트 origin: 링크 미리보기(og:url, og:image)의 절대 주소 기준(#71). 서버에서만 읽는다(NEXT_PUBLIC_ 변수가 아니다).
 *
 * 순서는 Next가 metadataBase 없이 og 이미지 주소를 풀 때 쓰는 기준(node_modules/next/dist/lib/metadata/resolvers/resolve-url.js의
 * getSocialImageMetadataBaseFallback)과 같고, 값은 Vercel 공개 시스템 환경변수로만 만든다
 * (https://vercel.com/docs/environment-variables/system-environment-variables).
 * 1. 개발 서버(NODE_ENV=development): 로컬
 * 2. Vercel 미리보기(NODE_ENV=production, VERCEL_ENV=preview): VERCEL_BRANCH_URL, 없으면 VERCEL_URL
 * 3. 그 밖(운영): VERCEL_PROJECT_PRODUCTION_URL
 * 4. 위 값이 없으면 로컬: http://localhost:{PORT, 없으면 3000}
 * Vercel 값에는 프로토콜이 없어 https를 붙인다(문서: "does not include the protocol scheme https://").
 * Next는 개발 서버를 --experimental-https로 띄우면 로컬을 https로 쓰지만, 그 표시는 Next 내부 변수라 따르지 않는다(로컬은 http).
 */
export type SiteOriginEnv = Partial<
  Record<"NODE_ENV" | "PORT" | "VERCEL_ENV" | "VERCEL_URL" | "VERCEL_BRANCH_URL" | "VERCEL_PROJECT_PRODUCTION_URL", string>
>;

export function siteOrigin(env: SiteOriginEnv = process.env): URL {
  const local = new URL(`http://localhost:${env.PORT || 3000}`);
  if (env.NODE_ENV === "development") return local;
  const preview = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  if (env.NODE_ENV === "production" && env.VERCEL_ENV === "preview" && preview) return https(preview);
  return env.VERCEL_PROJECT_PRODUCTION_URL ? https(env.VERCEL_PROJECT_PRODUCTION_URL) : local;
}

function https(host: string): URL {
  return new URL(/^https?:\/\//.test(host) ? host : `https://${host}`);
}
