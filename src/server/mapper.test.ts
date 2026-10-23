import { describe, expect, it, vi } from "vitest";
import { AnimalWireDtoSchema } from "@/contract/animals";
import fixture from "../../docs/fixtures/upstream-items.json";
import otherFixture from "../../docs/fixtures/upstream-items-other.json";
import { encodeImageUrl, mapUpstreamItem, type MappedAnimal } from "./mapper";
import { UpstreamAnimalItemSchema, type UpstreamAnimalItemDto } from "./upstream/dto";

const dtos = [...fixture.items, ...otherFixture.items].map((item) => UpstreamAnimalItemSchema.parse(item));
const byId = (id: string) => {
  const dto = dtos.find((d) => d.desertionNo === id);
  if (!dto) throw new Error(`fixture ${id} not found`);
  return dto;
};

const PROTECTED_CAT = byId("450650202602282");
const SEX_Q = byId("448536202600859");
const OPTIONAL_SFE = byId("445470202600976");
const ENDED_EUTHANASIA = byId("427346202600847");
const TWO_BRACKETS = byId("448537202601421");
const DOG_VACCINATION = byId("448539202600280");
const PROTECTED_OTHER = byId("441378202601343");
const ENDED_OTHER = byId("447512202600622");

const WIRE_KEYS = [
  "ageText",
  "endReasonText",
  "endResultText",
  "foundPlaceText",
  "id",
  "images",
  "kindText",
  "noticeEndDate",
  "noticePeriodText",
  "regionText",
  "sex",
  "shelterAddressText",
  "shelterName",
  "shelterTelText",
  "specialMarkText",
  "species",
  "status",
];

const spyLogger = () => ({ warn: vi.fn() });

function map(dto: UpstreamAnimalItemDto, logger = spyLogger()): MappedAnimal {
  const result = mapUpstreamItem(dto, { logger });
  if (!result) throw new Error("expected mapped result");
  return result;
}

describe("mapUpstreamItem", () => {
  it("픽스처 8건(고양이·개 6 + 기타 2)이 계약 스키마를 통과하고 계약 키만 가진다", () => {
    for (const dto of dtos) {
      const { wire } = map(dto);
      expect(AnimalWireDtoSchema.strict().parse(wire)).toEqual(wire);
      expect(Object.keys(wire).sort()).toEqual(WIRE_KEYS);
    }
  });

  it("담당자 이름(careOwnerNm)은 결과 어디에도 없다", () => {
    for (const dto of dtos) {
      const serialized = JSON.stringify(map(dto));
      expect(serialized).not.toContain("careOwnerNm");
      // careOwnerNm은 orgNm(regionText로 공개)과 같은 값일 수 있다(픽스처 1: 제주특별자치도).
      const value = dto.careOwnerNm?.trim();
      if (value && value !== dto.orgNm) expect(serialized).not.toContain(value);
    }
  });

  it("보호소 주소·전화는 원문에서 앞뒤 공백만 지우고, 비어 있으면 null이다(이슈 #3)", () => {
    // 지어낸 값이다
    const { wire } = map({ ...PROTECTED_CAT, careAddr: " 가상특별시 예시구 테스트로 12 ", careTel: " 000-1234-5678 " });
    expect(wire.shelterAddressText).toBe("가상특별시 예시구 테스트로 12");
    expect(wire.shelterTelText).toBe("000-1234-5678");
    const empty = map({ ...PROTECTED_CAT, careAddr: "  ", careTel: undefined }).wire;
    expect(empty.shelterAddressText).toBeNull();
    expect(empty.shelterTelText).toBeNull();
  });

  it("경고 로그에 연락처 값(주소, 전화, 담당자 이름)을 넣지 않는다", () => {
    const logger = spyLogger();
    // 지어낸 값이다
    const contact = { careAddr: "가상특별시 예시구 테스트로 12", careTel: "000-1234-5678", careOwnerNm: "가상담당자" };
    mapUpstreamItem({ ...PROTECTED_CAT, ...contact, upKindNm: "새" }, { logger });
    mapUpstreamItem({ ...PROTECTED_CAT, ...contact, processState: "공고중" }, { logger });
    expect(logger.warn).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(logger.warn.mock.calls);
    for (const value of Object.values(contact)) expect(serialized).not.toContain(value);
  });

  it("종료(안락사)는 ended, 결과는 괄호 안 원문, 종료 사유는 원문 그대로 보낸다(이슈 #41)", () => {
    const logger = spyLogger();
    const { wire } = map(ENDED_EUTHANASIA, logger);
    expect(wire.status).toBe("ended");
    expect(wire.endResultText).toBe("안락사");
    expect(wire.endReasonText).toBe("교통사고 전신 마비");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  describe("endResultText(종료 결과)", () => {
    it.each([
      ["종료(입양)", "입양"],
      ["종료(자연사)", "자연사"],
      [" 종료 ( 반환 ) ", "반환"],
      ["종료(처음보는값)", "처음보는값"],
      ["종료", null],
      ["종료()", null],
      ["종료(  )", null],
      ["보호중", null],
    ])("%s → %s", (processState, expected) => {
      expect(map({ ...PROTECTED_CAT, processState }).wire.endResultText).toBe(expected);
    });
  });

  it("종료 사유가 없거나 공백뿐이면 null", () => {
    expect(map(PROTECTED_CAT).wire.endReasonText).toBeNull();
    expect(map({ ...ENDED_EUTHANASIA, endReason: "  " }).wire.endReasonText).toBeNull();
  });

  it("종료로 시작하는 다른 값도 ended이다", () => {
    const logger = spyLogger();
    expect(map({ ...PROTECTED_CAT, processState: "종료(자연사)" }, logger).wire.status).toBe("ended");
    expect(map({ ...PROTECTED_CAT, processState: "종료(입양)" }, logger).wire.status).toBe("ended");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("보호중은 protected이고 로그를 남기지 않는다", () => {
    const logger = spyLogger();
    expect(map(PROTECTED_CAT, logger).wire.status).toBe("protected");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("알 수 없는 processState는 protected로 두고 로그를 남긴다", () => {
    const logger = spyLogger();
    expect(map({ ...PROTECTED_CAT, processState: "공고중" }, logger).wire.status).toBe("protected");
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0][1]).toMatchObject({ processState: "공고중" });
  });

  it("로거를 주지 않으면 아무것도 출력하지 않는다(기본 no-op)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mapUpstreamItem({ ...PROTECTED_CAT, processState: "공고중" });
    mapUpstreamItem({ ...PROTECTED_CAT, upKindNm: "기타축종" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sexCd: M→male, F→female, Q→unknown, 그 외→unknown", () => {
    expect(map(TWO_BRACKETS).wire.sex).toBe("male");
    expect(map(PROTECTED_CAT).wire.sex).toBe("female");
    expect(map(SEX_Q).wire.sex).toBe("unknown");
    expect(map({ ...PROTECTED_CAT, sexCd: "" }).wire.sex).toBe("unknown");
  });

  it("upKindNm: 고양이→cat, 개→dog, 기타→other", () => {
    expect(map(PROTECTED_CAT).wire.species).toBe("cat");
    expect(map(DOG_VACCINATION).wire.species).toBe("dog");
    expect(map(PROTECTED_OTHER).wire.species).toBe("other");
    expect(map(ENDED_OTHER).wire.species).toBe("other");
  });

  it("upKindNm이 고양이/개/기타가 아니면 null을 반환하고 로그를 남긴다", () => {
    const logger = spyLogger();
    // "기타축종"은 kindNm 값이고 upKindNm은 "기타"다(12.A P12)
    expect(mapUpstreamItem({ ...PROTECTED_CAT, upKindNm: "기타축종" }, { logger })).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  describe("kindText(품종 이름)", () => {
    it("kindFullNm의 [축종] 접두어를 뗀다", () => {
      expect(map(PROTECTED_OTHER).wire.kindText).toBe("토끼"); // "[기타축종] 토끼"
      expect(map(ENDED_OTHER).wire.kindText).toBe("앵무새");
      expect(map(PROTECTED_CAT).wire.kindText).toBe("한국 고양이"); // "[고양이] 한국 고양이"
      expect(map(DOG_VACCINATION).wire.kindText).toBe("믹스견");
    });

    it("품종을 특정할 수 없는 값은 null이다(기본 문구를 쓰게 한다)", () => {
      for (const kindFullNm of ["[기타축종] 기타축종", "[기타축종]", "[기타축종]   ", "[고양이] 기타", "기타", ""]) {
        expect(map({ ...PROTECTED_OTHER, kindFullNm }).wire.kindText, kindFullNm).toBeNull();
      }
      const { kindFullNm: _omitted, ...withoutKind } = PROTECTED_OTHER;
      expect(map(withoutKind).wire.kindText).toBeNull();
    });

    it("접두어가 없으면 값 전체를 쓰고 앞뒤 공백만 제거한다", () => {
      expect(map({ ...PROTECTED_OTHER, kindFullNm: "  토끼 " }).wire.kindText).toBe("토끼");
      expect(map({ ...PROTECTED_OTHER, kindFullNm: "붉은귀거북" }).wire.kindText).toBe("붉은귀거북");
    });
  });

  it("optional 필드가 있는 항목과 없는 항목 모두 매핑된다", () => {
    expect(OPTIONAL_SFE.sfeSoci).toBeDefined();
    expect(DOG_VACCINATION.vaccinationChk).toBeDefined();
    expect(PROTECTED_CAT.sfeSoci).toBeUndefined();
    for (const dto of [OPTIONAL_SFE, DOG_VACCINATION, PROTECTED_CAT]) {
      expect(mapUpstreamItem(dto)).not.toBeNull();
    }
  });

  describe("images", () => {
    it("파일명의 [1]을 %5B1%5D로 인코딩한다", () => {
      const { images } = map(ENDED_EUTHANASIA).wire;
      expect(images).toEqual([
        "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/202609081809275%5B1%5D.jpg",
        "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/202609081809899.jpg",
      ]);
    });

    it("두 장 모두 [1]이 있어도 각각 인코딩한다", () => {
      const { images } = map(TWO_BRACKETS).wire;
      expect(images).toHaveLength(2);
      for (const url of images) {
        expect(url).not.toMatch(/[[\]]/);
        expect(url).toMatch(/%5B1%5D\.jpg$/);
      }
    });

    it("URL 구조(스킴, 호스트, 경로 구분자)를 보존한다", () => {
      const [url] = map(TWO_BRACKETS).wire.images;
      const parsed = new URL(url);
      expect(parsed.protocol).toBe("http:");
      expect(parsed.host).toBe("openapi.animal.go.kr");
      expect(parsed.pathname).toBe(
        "/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/202609211109624%5B1%5D.jpg",
      );
    });

    it("대괄호가 없는 URL은 바꾸지 않는다", () => {
      expect(map(PROTECTED_CAT).wire.images).toEqual([PROTECTED_CAT.popfile1, PROTECTED_CAT.popfile2]);
    });

    it("popfile1..N 중 값이 있는 것만 번호순으로 모은다", () => {
      const dto = UpstreamAnimalItemSchema.parse({
        ...PROTECTED_CAT,
        popfile1: "http://a.test/1.jpg",
        popfile2: "",
        popfile10: "http://a.test/10.jpg",
        popfile3: "http://a.test/3.jpg",
      });
      expect(map(dto).wire.images).toEqual([
        "http://a.test/1.jpg",
        "http://a.test/3.jpg",
        "http://a.test/10.jpg",
      ]);
    });

    it("사진이 없으면 빈 배열이다", () => {
      const { popfile1: _p1, popfile2: _p2, ...rest } = PROTECTED_CAT;
      expect(map(rest).wire.images).toEqual([]);
    });
  });

  describe("encodeImageUrl", () => {
    it("[1] 파일명을 인코딩한다", () => {
      expect(encodeImageUrl("http://a.test/files/2026/09/1[1].jpg")).toBe(
        "http://a.test/files/2026/09/1%5B1%5D.jpg",
      );
    });

    it("이미 인코딩된 %20, %5B는 다시 인코딩하지 않는다", () => {
      expect(encodeImageUrl("http://a.test/my%20cat[1].jpg")).toBe("http://a.test/my%20cat%5B1%5D.jpg");
      expect(encodeImageUrl("http://a.test/1%5B1%5D.jpg")).toBe("http://a.test/1%5B1%5D.jpg");
    });

    it("두 번 적용해도 결과가 같다(멱등)", () => {
      const once = encodeImageUrl("http://a.test/x%20y[1][2].jpg?v=[3]");
      expect(encodeImageUrl(once)).toBe(once);
      expect(once).toBe("http://a.test/x%20y%5B1%5D%5B2%5D.jpg?v=%5B3%5D");
    });
  });

  describe("날짜", () => {
    it("noticePeriodText는 MM.DD ~ MM.DD, noticeEndDate는 YYYY-MM-DD", () => {
      const { wire } = map(PROTECTED_CAT);
      expect(wire.noticePeriodText).toBe("09.21 ~ 10.01");
      expect(wire.noticeEndDate).toBe("2026-10-01");
      expect(map(SEX_Q).wire.noticePeriodText).toBe("09.21 ~ 09.28");
    });

    it("날짜 형식이 다르면 null이다", () => {
      const { wire } = map({ ...PROTECTED_CAT, noticeEdt: "", noticeSdt: "20260231" });
      expect(wire.noticeEndDate).toBeNull();
      expect(wire.noticePeriodText).toBeNull();
    });
  });

  it("필수 필드만 있는 item도 유효한 WireDto가 된다", () => {
    const { desertionNo, processState, upKindNm, noticeEdt, orgNm } = PROTECTED_CAT;
    const result = map({ desertionNo, processState, upKindNm, noticeEdt, orgNm });
    expect(AnimalWireDtoSchema.strict().parse(result.wire)).toEqual({
      id: desertionNo,
      species: "cat",
      images: [],
      status: "protected",
      endResultText: null,
      noticeEndDate: "2026-10-01",
      sex: "unknown",
      ageText: null,
      regionText: "제주특별자치도",
      shelterName: null,
      foundPlaceText: null,
      shelterAddressText: null,
      shelterTelText: null,
      noticePeriodText: null,
      specialMarkText: null,
      endReasonText: null,
      kindText: null,
    });
    expect(result.sortKeys).toEqual({ noticeSdt: "", noticeEdt: "20261001", updTm: "" });
  });

  it("sortKeys는 noticeSdt, noticeEdt, updTm 원문이다", () => {
    expect(map(PROTECTED_CAT).sortKeys).toEqual({
      noticeSdt: "20260921",
      noticeEdt: "20261001",
      updTm: "2026-09-21 11:29:37.0",
    });
  });

  describe("특이사항(specialMark)", () => {
    it("원문을 그대로 싣는다(앞뒤 공백만 제거)", () => {
      expect(map(PROTECTED_CAT).wire.specialMarkText).toBe("개체관리번호 26501 - 척추손상에 의한 후구마비");
    });

    it("종료 사유와 같은 문구면 특이사항을 비워 종료 사유 한 번만 보낸다(architecture.md 10절, 이슈 #41)", () => {
      expect(ENDED_EUTHANASIA.specialMark).toBe(ENDED_EUTHANASIA.endReason);
      const { wire } = map(ENDED_EUTHANASIA);
      expect(wire.specialMarkText).toBeNull();
      expect(wire.endReasonText).toBe(ENDED_EUTHANASIA.endReason);
    });

    it("공백 차이만 있으면 같은 문구로 본다", () => {
      const { wire } = map({ ...ENDED_EUTHANASIA, specialMark: `  ${ENDED_EUTHANASIA.endReason} ` });
      expect(wire.specialMarkText).toBeNull();
    });

    it("종료 공고라도 문구가 다르면 특이사항은 보낸다", () => {
      const wire = map({ ...ENDED_EUTHANASIA, specialMark: "사람을 잘 따름" }).wire;
      expect(wire.specialMarkText).toBe("사람을 잘 따름");
    });

    it("비어 있거나 공백뿐이면 null", () => {
      expect(map({ ...PROTECTED_CAT, specialMark: "   " }).wire.specialMarkText).toBeNull();
      const { specialMark: _omitted, ...withoutSpecialMark } = PROTECTED_CAT;
      expect(map(withoutSpecialMark).wire.specialMarkText).toBeNull();
    });
  });

  it("텍스트 필드는 원문을 유지하되 앞뒤 공백만 제거한다", () => {
    const { wire } = map(ENDED_EUTHANASIA);
    expect(wire.id).toBe("427346202600847");
    expect(wire.ageText).toBe("2026(60일미만)(년생)");
    expect(wire.regionText).toBe("대구광역시 수성구");
    expect(wire.shelterName).toBe("세인트동물병원");
    expect(wire.foundPlaceText).toBe("범어로 18길 22");
  });
});
