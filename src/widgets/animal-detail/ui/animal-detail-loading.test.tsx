// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { animalKeys, seedAnimalDetail, startDetailEntry } from "@/entities/animal";
import { resetDetailEntriesForTest } from "@/entities/animal/model/detail-entry";
import { createQueryClient } from "@/shared/api/query-client";
import { AnimalDetailLoading } from "./animal-detail-loading";
import { makeAnimal } from "@tests/factories/animal";

/**
 * 상세 라우트 로딩 화면(architecture.md 14.2 4단계, 구조 D1): 목록 카드에서 왔으면 목록 데이터로 실제 상세, 아니면 뼈대.
 */
const ID = "450650202602282";
vi.mock("next/navigation", () => ({ useParams: () => ({ id: ID }), useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

const IMG = "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/1.jpg";
const animal = makeAnimal({
  id: ID,
  images: [IMG, `${IMG}?2`],
  sex: "female",
  ageText: "2024(년생)",
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: "서귀포시 남원읍",
  noticePeriodText: "09.21 ~ 10.01",
});
const CARD_SRC = "/api/image-proxy?src=card&w=1080";

let client: ReturnType<typeof createQueryClient>;
beforeEach(() => {
  client = createQueryClient();
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});
afterEach(() => {
  cleanup();
  resetDetailEntriesForTest();
  vi.unstubAllGlobals();
});

function renderLoading() {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<AnimalDetailLoading origin="https://nyang.test" />, { wrapper });
}

describe("AnimalDetailLoading", () => {
  it("목록 카드에서 왔으면(진입 정보 + 캐시) 서버를 기다리지 않고 실제 상세를 그린다. 첫 사진은 카드가 받은 주소", () => {
    seedAnimalDetail(client, animal);
    startDetailEntry({ id: ID, photoSrc: CARD_SRC, photoSize: { width: 1080, height: 810 }, mode: "morph" });
    const { container } = renderLoading();
    expect(container.querySelector('[data-slot="detail-preview"] [data-slot="animal-detail"]')).toBeTruthy();
    expect(screen.getByRole("heading", { name: "제주특별자치도" })).toBeTruthy();
    const first = container.querySelector('[data-slot="image-carousel"] img')!;
    expect(first.getAttribute("src")).toBe(CARD_SRC);
    expect(first.getAttribute("srcset")).toBeNull();
    expect(first.getAttribute("decoding")).toBe("sync");
    // 칸 비율(카드 사진 4:3)은 jsdom이 aspect-ratio를 다루지 않아 E2E(detail-transition)에서 본다
    // 정보 페이드(전환이 있을 때)
    expect(container.querySelectorAll('[data-detail-enter="info"]')).toHaveLength(2);
  });

  it("진입 정보가 없으면(공유 링크 직접 진입, 새로고침) 지금처럼 뼈대다", () => {
    seedAnimalDetail(client, animal);
    const { container } = renderLoading();
    expect(container.querySelector('[data-slot="detail-skeleton"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="animal-detail"]')).toBeNull();
  });

  it("캐시에 공고가 없으면 뼈대다", () => {
    startDetailEntry({ id: ID, photoSrc: CARD_SRC, photoSize: { width: 1, height: 1 }, mode: "morph" });
    const { container } = renderLoading();
    expect(container.querySelector('[data-slot="detail-skeleton"]')).toBeTruthy();
  });

  it("효과 없음(종료·움직임 줄이기)이면 목록 데이터 상세를 그리되 진입 효과가 없다", () => {
    seedAnimalDetail(client, animal);
    startDetailEntry({ id: ID, photoSrc: CARD_SRC, photoSize: { width: 1, height: 1 }, mode: "none" });
    const { container } = renderLoading();
    expect(container.querySelector('[data-slot="animal-detail"]')).toBeTruthy();
    expect(container.querySelector("[data-detail-enter]")).toBeNull();
  });
});

describe("seedAnimalDetail", () => {
  it("상세 캐시를 채우되, 서버 데이터가 더 새것으로 덮도록 받은 시각을 30초 앞당긴다. 이미 있으면 그대로 둔다", () => {
    const before = Date.now();
    seedAnimalDetail(client, animal);
    const state = client.getQueryState(animalKeys.detail(ID))!;
    expect(state.data).toBe(animal);
    expect(state.dataUpdatedAt).toBeLessThanOrEqual(before - 30_000 + 50);
    expect(state.isInvalidated).toBe(false);

    const other = { ...animal, regionText: "다른 값" };
    seedAnimalDetail(client, other);
    expect(client.getQueryData(animalKeys.detail(ID))).toBe(animal);
  });
});
