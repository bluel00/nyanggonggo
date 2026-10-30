/**
 * 캐릭터 Rive 원본(rive/nyang-characters/scene.rml)의 두 아트보드는 scripts/rive-characters-scene.mjs가 SVG에서 만든다.
 * SVG만 바꾸고 생성(`pnpm rive:build`)을 하지 않으면 커밋된 scene.rml·.riv가 옛 그림이 되므로, 생성 결과와 같은지 본다.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GENERATOR = join(process.cwd(), "scripts/rive-characters-scene.mjs");

/** 한 애니메이션 블록 안에서 그 객체·속성의 키프레임 [frame, value] */
function keyframes(body: string, objectId: string, propertyKey: number): [number, number][] {
  const out: [number, number][] = [];
  const objectPattern = new RegExp(`<KeyedObject objectId="${objectId}">\\s*<KeyedProperty propertyKey="${propertyKey}">([\\s\\S]*?)</KeyedProperty>`, "g");
  for (const object of body.matchAll(objectPattern)) {
    for (const key of object[1].matchAll(/value="([-\d.]+)" frame="(\d+)"/g)) out.push([Number(key[2]), Number(key[1])]);
  }
  return out;
}

describe("캐릭터 Rive 원본", () => {
  it("scene.rml이 지금 SVG로 생성한 결과와 같다(다르면 pnpm rive:build)", () => {
    let output = "";
    let failed = false;
    try {
      output = execFileSync(process.execPath, [GENERATOR, "--check"], { encoding: "utf8", stdio: "pipe" });
    } catch (error) {
      failed = true;
      output = String((error as { stderr?: string }).stderr ?? error);
    }
    expect(failed, output).toBe(false);
  }, 30_000);

  /**
   * press 반응(characters.md 방향 A): 100ms(60fps 6프레임)에 바닥 가운데(rig) 기준 가로 1.03 × 세로 0.96으로 납작, 다음 100ms에 돌아온다.
   * 머리 기울기는 없다(어떤 그룹도 회전하지 않는다). 잠에서 깨는 wake도 같은 반응이다.
   */
  /**
   * 올려다보기(characters.md "올려다보기", handoff (k), #115): 뷰 모델 불리언 firstVisit(기본 false)이 true일 때만 Entry → lookUp → greet.
   * false면 Entry → greet로 지금과 같다. 강아지가 먼저(60fps 55프레임 ≈ 0.92초, −11°), 고양이가 0.12초 뒤(62프레임 ≈ 1.04초, −7°).
   * 24fps f0~f10(25프레임): f3에 다 올려다보고 f7까지 유지, f10에 정면. 몸은 바닥 기준 세로 1.03(f3) → 1(f6).
   */
  it("firstVisit: 기본 false, true일 때만 lookUp을 거쳐 greet. lookUp 중에도 press", () => {
    const rml = readFileSync(join(process.cwd(), "rive/nyang-characters/scene.rml"), "utf8");
    expect(rml).toContain('<ViewModelPropertyBoolean name="firstVisit" id="0:53"/>');
    expect(rml).toContain('<ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="0:53"/>');
    const cases = [
      { animal: "cat", lookUpState: "0:18", greetState: "0:12", pressState: "0:14", anim: "0:26", head: "0:1002", rig: "0:900", start: 62, deg: -7 },
      { animal: "dog", lookUpState: "0:215", greetState: "0:212", pressState: "0:214", anim: "0:223", head: "0:3001", rig: "0:3900", start: 55, deg: -11 },
    ];
    const entries = [...rml.matchAll(/<EntryState[^>]*>([\s\S]*?)<\/EntryState>/g)].map((m) => m[1]);
    expect(entries).toHaveLength(2);
    for (const [i, c] of cases.entries()) {
      // Entry: 조건 있는 lookUp이 먼저, 조건 없는 greet이 뒤
      const targets = [...entries[i].matchAll(/<StateTransition stateToId="([^"]+)"/g)].map((m) => m[1]);
      expect(targets, c.animal).toEqual([c.lookUpState, c.greetState]);
      expect(entries[i]).toContain('<DataBindContext sourcePathIds="0:50-0:53" propertyKey="634"/>');
      expect(entries[i]).toContain('<TransitionValueBooleanComparator value="true"/>');
      // lookUp 상태: 끝나면 greet, press면 press
      const state = new RegExp(`<AnimationState [^>]*animationId="${c.anim}"[^>]*stateName="lookUp" id="${c.lookUpState}">([\\s\\S]*?)</AnimationState>`).exec(rml);
      expect(state, c.animal).not.toBeNull();
      expect(state![1]).toContain(`<StateTransition stateToId="${c.greetState}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`);
      expect(state![1]).toContain(`<StateTransition stateToId="${c.pressState}">`);
      const body = new RegExp(`<LinearAnimation [^>]*duration="${c.start + 25}" name="lookUp" id="${c.anim}">([\\s\\S]*?)</LinearAnimation>`).exec(rml);
      expect(body, c.animal).not.toBeNull();
      const rad = +((c.deg * Math.PI) / 180).toFixed(4);
      // 머리 회전(15): 시작까지 정면, f3(+7.5 → 반올림 +8)에 올려다봄, f7(+17.5 → +18)까지 유지, f10(+25)에 정면
      expect(keyframes(body![1], c.head, 15)).toEqual([[0, 0], [c.start, 0], [c.start + 8, rad], [c.start + 18, rad], [c.start + 25, 0]]);
      // 몸(rig 세로, 17): 1 → 1.03 → 1
      expect(keyframes(body![1], c.rig, 17)).toEqual([[0, 1], [c.start, 1], [c.start + 8, 1.03], [c.start + 15, 1]]);
    }
  });

  it("press·wake: 6프레임에 1.03 × 0.96, 12프레임에 끝, 회전 없음", () => {
    const rml = readFileSync(join(process.cwd(), "rive/nyang-characters/scene.rml"), "utf8");
    const blocks = [...rml.matchAll(/<LinearAnimation [^>]*name="(press|wake)" id="([^"]+)"[^>]*>([\s\S]*?)<\/LinearAnimation>/g)];
    // 아트보드마다 rig id가 다르다(scripts/rive-characters-scene.mjs의 ids.rig): 고양이 press·wake 0:900, 강아지 press 0:3900
    const rigOf: Record<string, string> = { "0:22": "0:900", "0:25": "0:900", "0:222": "0:3900" };
    expect(blocks.map((m) => `${m[1]} ${m[2]}`).sort()).toEqual(["press 0:22", "press 0:222", "wake 0:25"]);
    for (const [head, , id, body] of blocks) {
      expect(head).toContain('duration="12"');
      // rig: scaleX 16, scaleY 17
      expect(keyframes(body, rigOf[id], 16)).toEqual([[0, 1], [6, 1.03], [12, 1]]);
      expect(keyframes(body, rigOf[id], 17)).toEqual([[0, 1], [6, 0.96], [12, 1]]);
      // 회전(15)은 어떤 그룹도 처음 값에서 바뀌지 않는다(제자리로 되돌리는 키만 있다)
      for (const property of body.matchAll(/<KeyedProperty propertyKey="15">([\s\S]*?)<\/KeyedProperty>/g)) {
        const values = [...property[1].matchAll(/value="([-\d.]+)"/g)].map((v) => Number(v[1]));
        expect(new Set(values).size).toBe(1);
      }
    }
  });
});
