import { describe, expect, it, vi } from "vitest";
import { initKakao, isShareableLink, SHARE_MESSAGES, shareAnimal, type KakaoSdk, type ShareDeps } from "./share";

const CONTENT = {
  url: "https://example.test/animals/1",
  title: "제주특별자치도 고양이",
  description: "보호중 · D-10 · 제2동물보호센터",
  imageUrl: "https://example.test/api/image-proxy?src=x",
};
const FAKE_KEY = "test-kakao-key";

function deps(overrides: Partial<ShareDeps> = {}) {
  const copy = vi.fn(async () => {});
  const notify = vi.fn();
  const onIssue = vi.fn();
  return { copy, notify, onIssue, deps: { kakaoKey: FAKE_KEY, getKakao: () => undefined, copy, notify, onIssue, ...overrides } };
}

/** 실제 SDK처럼 init을 부르면 isInitialized()가 true가 된다 */
function fakeKakao(overrides: Partial<KakaoSdk> = {}, initialized = false) {
  const sendDefault = vi.fn();
  let ready = initialized;
  const kakao: KakaoSdk = {
    isInitialized: vi.fn(() => ready),
    init: vi.fn(() => {
      ready = true;
    }),
    Share: { sendDefault },
    ...overrides,
  };
  return { kakao, sendDefault };
}

describe("shareAnimal", () => {
  it("SDK가 준비되면 카카오톡 공유(init 1회, feed 템플릿, 상세 링크)하고 링크를 복사하지 않는다", async () => {
    const { kakao, sendDefault } = fakeKakao();
    const { copy, notify, deps: d } = deps({ getKakao: () => kakao });
    await expect(shareAnimal(CONTENT, d)).resolves.toBe("kakao");
    expect(kakao.init).toHaveBeenCalledWith(FAKE_KEY);
    expect(sendDefault).toHaveBeenCalledWith({
      objectType: "feed",
      content: {
        title: CONTENT.title,
        description: CONTENT.description,
        imageUrl: CONTENT.imageUrl,
        link: { mobileWebUrl: CONTENT.url, webUrl: CONTENT.url },
      },
      buttons: [{ title: "공고 보기", link: { mobileWebUrl: CONTENT.url, webUrl: CONTENT.url } }],
    });
    expect(copy).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("이미 초기화되어 있으면 init을 다시 부르지 않는다", async () => {
    const { kakao } = fakeKakao({}, true);
    await shareAnimal(CONTENT, deps({ getKakao: () => kakao }).deps);
    expect(kakao.init).not.toHaveBeenCalled();
  });

  it("키가 없으면 SDK를 보지 않고 바로 링크 복사(이유는 로그로 남긴다)", async () => {
    const getKakao = vi.fn();
    const { copy, notify, onIssue, deps: d } = deps({ kakaoKey: "", getKakao });
    await expect(shareAnimal(CONTENT, d)).resolves.toBe("copied");
    expect(getKakao).not.toHaveBeenCalled();
    expect(copy).toHaveBeenCalledWith(CONTENT.url);
    expect(notify).toHaveBeenCalledWith(SHARE_MESSAGES.copied);
    expect(onIssue).toHaveBeenCalledWith(expect.stringContaining("카카오 키가 비어 있어"));
  });

  it("폴백할 때마다 이유를 남긴다(조용히 넘어가지 않는다)", async () => {
    const { onIssue, deps: d } = deps({ getKakao: () => undefined });
    await shareAnimal(CONTENT, d);
    expect(onIssue).toHaveBeenCalledWith(expect.stringContaining("SDK가 아직 로드되지 않았습니다"));
  });

  it("sendDefault가 실패하면 이유와 썸네일 URL을 남긴다", async () => {
    const { kakao } = fakeKakao({
      Share: {
        sendDefault: () => {
          throw new Error("domain not registered");
        },
      },
    });
    const { onIssue, deps: d } = deps({ getKakao: () => kakao });
    await shareAnimal(CONTENT, d);
    expect(onIssue).toHaveBeenCalledWith(
      expect.stringContaining("sendDefault"),
      expect.objectContaining({ imageUrl: CONTENT.imageUrl, message: "domain not registered" }),
    );
  });

  it.each([
    ["SDK 미로드", () => undefined],
    ["Share 미지원 환경", () => fakeKakao({ Share: undefined }).kakao],
    [
      "init 실패",
      () =>
        fakeKakao({
          init: () => {
            throw new Error("invalid app key");
          },
        }).kakao,
    ],
    [
      "sendDefault 예외",
      () => ({
        isInitialized: () => true,
        init: () => {},
        Share: {
          sendDefault: () => {
            throw new Error("domain not registered");
          },
        },
      }),
    ],
  ] as [string, () => KakaoSdk | undefined][])("%s → 링크 복사 + '링크가 복사됐어요'", async (_label, getKakao) => {
    const { copy, notify, deps: d } = deps({ getKakao });
    await expect(shareAnimal(CONTENT, d)).resolves.toBe("copied");
    expect(copy).toHaveBeenCalledWith(CONTENT.url);
    expect(notify).toHaveBeenCalledWith("링크가 복사됐어요");
  });

  it("링크가 폰에서 열 수 없는 주소(localhost)면 카카오 공유를 건너뛰고 링크 복사로 간다", async () => {
    const { kakao, sendDefault } = fakeKakao();
    const { copy, onIssue, deps: d } = deps({ getKakao: () => kakao });
    const local = { ...CONTENT, url: "http://localhost:3000/animals/1" };
    await expect(shareAnimal(local, d)).resolves.toBe("copied");
    expect(sendDefault).not.toHaveBeenCalled();
    expect(copy).toHaveBeenCalledWith(local.url);
    expect(onIssue).toHaveBeenCalledWith(
      expect.stringContaining("카카오에서 열 수 없는 주소"),
      expect.objectContaining({ url: local.url }),
    );
  });

  it("링크 복사도 실패하면 '공유에 실패했어요. 링크로 대신 공유해보세요'", async () => {
    const { notify, deps: d } = deps({
      kakaoKey: "",
      copy: async () => {
        throw new Error("denied");
      },
    });
    await expect(shareAnimal(CONTENT, d)).resolves.toBe("failed");
    expect(notify).toHaveBeenCalledWith("공유에 실패했어요. 링크로 대신 공유해보세요");
  });
});

describe("initKakao", () => {
  it("SDK를 불러온 직후 한 번 초기화하고, 이미 되어 있으면 다시 하지 않는다", () => {
    const { kakao } = fakeKakao();
    expect(initKakao(FAKE_KEY, kakao)).toBe(true);
    expect(kakao.init).toHaveBeenCalledWith(FAKE_KEY);
    expect(kakao.isInitialized()).toBe(true);

    expect(initKakao(FAKE_KEY, kakao)).toBe(true);
    expect(kakao.init).toHaveBeenCalledOnce();
  });

  it("키가 없거나 SDK가 아직 없으면 이유를 남기고 false", () => {
    const onIssue = vi.fn();
    expect(initKakao("", fakeKakao().kakao, onIssue)).toBe(false);
    expect(initKakao(FAKE_KEY, undefined, onIssue)).toBe(false);
    expect(onIssue).toHaveBeenCalledTimes(2);
  });

  it("init이 던지면 이유를 남기고 false(키 원문은 남기지 않는다)", () => {
    const onIssue = vi.fn();
    const { kakao } = fakeKakao({
      init: () => {
        throw new Error("Invalid app key");
      },
    });
    expect(initKakao(FAKE_KEY, kakao, onIssue)).toBe(false);
    const [message, detail] = onIssue.mock.calls[0];
    expect(message).toContain("Kakao.init");
    expect(detail).toMatchObject({ message: "Invalid app key" });
    expect(JSON.stringify(detail)).not.toContain(FAKE_KEY);
    expect(String(detail.key)).toContain("len=");
  });

  it("init 뒤에도 초기화되지 않으면 false(조용히 넘어가지 않는다)", () => {
    const onIssue = vi.fn();
    const { kakao } = fakeKakao({ isInitialized: () => false, init: () => {} });
    expect(initKakao(FAKE_KEY, kakao, onIssue)).toBe(false);
    expect(onIssue).toHaveBeenCalledWith(expect.stringContaining("초기화되지 않았습니다"), expect.any(Object));
  });
});

describe("isShareableLink", () => {
  it.each([
    "https://nyang.example/animals/1",
    "http://nyang.example/animals/1",
  ])("외부에서 열 수 있는 절대 URL: %s", (url) => {
    expect(isShareableLink(url)).toBe(true);
  });

  it.each([
    ["로컬", "http://localhost:3000/animals/1"],
    ["로컬 IP", "http://127.0.0.1:3000/animals/1"],
    ["0.0.0.0", "http://0.0.0.0:3000/animals/1"],
    [".local 도메인", "http://my-mac.local/animals/1"],
    ["상대 경로", "/animals/1"],
    ["빈 값", ""],
    ["undefined가 섞인 주소", "https://undefined/animals/1"],
    ["다른 프로토콜", "javascript:alert(1)"],
  ])("공유할 수 없는 주소: %s", (_label, url) => {
    expect(isShareableLink(url)).toBe(false);
  });
});
