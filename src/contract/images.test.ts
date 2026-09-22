import { describe, expect, it } from "vitest";
import { IMAGE_PROXY_PATH, isAllowedImageSource, toImageProxyUrl } from "./images";

const OK = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/202609211109478.jpg";

describe("isAllowedImageSource", () => {
  it("공공 API 이미지 서버의 http URL만 허용한다", () => {
    expect(isAllowedImageSource(OK)).toBe(true);
    expect(isAllowedImageSource(`${OK.replace(".jpg", "%5B1%5D.jpg")}`)).toBe(true);
  });

  it.each([
    ["https", OK.replace("http://", "https://")],
    ["다른 호스트", "http://example.com/a.jpg"],
    ["접두어만 비슷한 호스트", "http://openapi.animal.go.kr.evil.com/a.jpg"],
    ["사용자 정보로 호스트 속이기", "http://openapi.animal.go.kr@evil.com/a.jpg"],
    ["포트 지정", "http://openapi.animal.go.kr:8080/a.jpg"],
    ["접두어 없는 상대 경로", "/openapi/a.jpg"],
    ["백슬래시", "http:\\\\openapi.animal.go.kr\\a.jpg"],
    ["javascript", "javascript:alert(1)//http://openapi.animal.go.kr/"],
    ["빈 문자열", ""],
  ])("거부: %s", (_label, src) => {
    expect(isAllowedImageSource(src)).toBe(false);
  });

  it("경로에 @가 있어도 호스트는 고정되어 허용된다", () => {
    expect(isAllowedImageSource("http://openapi.animal.go.kr/@evil.com/a.jpg")).toBe(true);
  });
});

describe("toImageProxyUrl", () => {
  it("프록시 경로 + src 쿼리(한 번 인코딩)", () => {
    const url = toImageProxyUrl(OK.replace(".jpg", "%5B1%5D.jpg"))!;
    expect(url.startsWith(`${IMAGE_PROXY_PATH}?src=`)).toBe(true);
    expect(new URL(url, "http://localhost").searchParams.get("src")).toBe(OK.replace(".jpg", "%5B1%5D.jpg"));
  });

  it("허용되지 않으면 null", () => {
    expect(toImageProxyUrl("http://example.com/a.jpg")).toBeNull();
  });
});
