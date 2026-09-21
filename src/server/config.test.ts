import { describe, expect, it } from "vitest";
import { getServerConfig, ServerConfigError } from "./config";

describe("getServerConfig", () => {
  it("서비스키를 읽는다", () => {
    expect(getServerConfig({ DATA_GO_KR_SERVICE_KEY: "test-key-abc" })).toEqual({
      serviceKey: "test-key-abc",
    });
  });

  it.each([undefined, "", "   "])("키가 없거나 비면(%j) ServerConfigError", (value) => {
    expect(() => getServerConfig({ DATA_GO_KR_SERVICE_KEY: value })).toThrow(ServerConfigError);
  });

  it("오류 메시지에는 변수 이름만 있고 값은 없다", () => {
    try {
      getServerConfig({ DATA_GO_KR_SERVICE_KEY: " " });
    } catch (error) {
      expect((error as ServerConfigError).variables).toEqual(["DATA_GO_KR_SERVICE_KEY"]);
    }
  });
});
