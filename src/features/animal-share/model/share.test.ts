import { describe, expect, it, vi } from "vitest";
import { SHARE_MESSAGES, shareAnimal, type KakaoSdk, type ShareDeps } from "./share";

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
  return { copy, notify, deps: { kakaoKey: FAKE_KEY, getKakao: () => undefined, copy, notify, ...overrides } };
}

function fakeKakao(overrides: Partial<KakaoSdk> = {}, initialized = false) {
  const sendDefault = vi.fn();
  const kakao: KakaoSdk = {
    isInitialized: vi.fn(() => initialized),
    init: vi.fn(),
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

  it("키가 없으면 SDK를 보지 않고 바로 링크 복사", async () => {
    const getKakao = vi.fn();
    const { copy, notify, deps: d } = deps({ kakaoKey: "", getKakao });
    await expect(shareAnimal(CONTENT, d)).resolves.toBe("copied");
    expect(getKakao).not.toHaveBeenCalled();
    expect(copy).toHaveBeenCalledWith(CONTENT.url);
    expect(notify).toHaveBeenCalledWith(SHARE_MESSAGES.copied);
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
