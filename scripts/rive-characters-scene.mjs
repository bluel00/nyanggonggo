#!/usr/bin/env node
/**
 * 캐릭터 Rive 아트보드(rive/nyang-characters/scene.rml의 nyang-cat, nyang-dog) 생성기. docs/design/characters.md "모션"과
 * docs/PRD-v1.2.md 5절을 따른다.
 *
 *   node scripts/rive-characters-scene.mjs   scene.rml의 `<!-- rive-artboards:begin -->` ~ `<!-- rive-artboards:end -->` 사이(두 아트보드)를
 *                                            다시 쓴다(머리말 주석과 뷰 모델은 그대로 둔다). `pnpm rive:build`가 먼저 이것을 돌린다.
 *   node scripts/rive-characters-scene.mjs --check   쓰지 않고, 생성 결과가 지금 scene.rml과 다르면 실패(exit 1)한다
 *                                            (tests/design/rive-scene.test.ts: SVG만 바꾸고 생성하지 않은 상태를 잡는다).
 *
 * 그림을 바꾸면(docs/design/assets/characters/*.svg) 이 스크립트를 다시 돌린다. 자세 사이 보간(옆 앉음 ↔ 웅크림·덮치기·놀자,
 * 기우는 중간 → 누움)은 정점마다 키가 수백 개라 손으로 쓰지 않고 여기서 만든다. scene.rml의 표시 사이는 손으로 고치지 않는다.
 *
 * 구조(캐릭터마다)
 *   rig(바닥 가운데 60,112: 위치·늘림·납작) > flip(좌우 반전) > 뷰(한 번에 하나만 보인다, opacity hold)
 *     고양이: front 정면 앉음 · q34 3/4 · side 옆 앉음(정점 id, 웅크림·씰룩·덮치기 공중·착지로 보간) · lie 기우는 중간(누움으로 보간)
 *     강아지: front 정면 앉음 · q34 3/4 · side 옆 앉음(정점 id, 놀자로 보간). 3/4·옆·놀자는 flip −1로 왼쪽을 본다(고양이와 마주 봄)
 *   상태: Entry → greet → idle. 고양이는 idle →(무입력 10초) sleepEnter → sleep(반복).
 *   press 트리거: greet·idle → press(greet는 끊는다), sleepEnter·sleep → wake. press·wake가 끝나면 idle.
 *   앱이 보내는 신호는 뷰 모델 트리거 press 하나다(scene.rml의 ViewModel "Character").
 *
 * 숫자는 60fps 프레임이다. characters.md 프레임표는 24fps라 `f24(n)` = n × 2.5로 옮긴다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { svgToRml } = await import(pathToFileURL(join(ROOT, "scripts/svg-to-rml.mjs")).href);
const SCENE = join(ROOT, "rive/nyang-characters/scene.rml");
const readSvg = (name) => readFileSync(join(ROOT, `docs/design/assets/characters/${name}.svg`), "utf8");

const DEG = Math.PI / 180;
const P = { x: 13, y: 14, rotation: 15, scaleX: 16, scaleY: 17, opacity: 18, width: 20, height: 21, vx: 24, vy: 25, inRotation: 84, inDistance: 85, outRotation: 86, outDistance: 87, drawTarget: 121 };
const CURVE = {
  easeOut: `<CubicEaseInterpolator x1="0" y1="0" x2="0.58" y2="1"/>`,
  easeIn: `<CubicEaseInterpolator x1="0.42" y1="0" x2="1" y2="1"/>`,
  easeInOut: `<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>`,
};
const r4 = (n) => +(+n).toFixed(4);
/** characters.md 프레임표(24fps)의 프레임 → 60fps 프레임 */
const f24 = (n) => n * 2.5;
/** rig의 기준점(바닥 가운데). 위치 키는 이 값에 더한다 */
const ORIGIN = { x: 60, y: 112 };

/** SVG의 그룹 값(translate·rotate·opacity) */
function groupValues(source) {
  const out = {};
  for (const m of source.matchAll(/<g id="([^"]+)"([^>]*)>/g)) {
    const t = /transform="([^"]*)"/.exec(m[2])?.[1] ?? "";
    const tr = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(t);
    const ro = /rotate\(\s*(-?[\d.]+)\s*\)/.exec(t);
    const op = /opacity="([^"]*)"/.exec(m[2]);
    out[m[1]] = { x: tr ? +tr[1] : 0, y: tr ? +tr[2] : 0, rotation: ro ? r4(+ro[1] * DEG) : 0, opacity: op ? +op[1] : 1 };
  }
  return out;
}

// ── 키프레임 도구 ──
class Anim {
  constructor(name, id, duration, loop) {
    Object.assign(this, { name, id, duration: Math.ceil(duration), loop, tracks: new Map() });
  }
  /** keys: [frame, value, interp?]. 같은 프레임은 나중 키가 이긴다 */
  key(objectId, prop, keys) {
    const k = `${objectId}|${prop}`;
    const track = this.tracks.get(k) ?? { objectId, prop, keys: [] };
    track.keys.push(...keys.map(([f, v, i = "hold"]) => [Math.round(f), v, i]));
    this.tracks.set(k, track);
    return this;
  }
  has(objectId, prop) {
    return this.tracks.has(`${objectId}|${prop}`);
  }
  xml() {
    const items = [...this.tracks.values()].map(({ objectId, prop, keys }) => {
      const sorted = [...new Map(keys.map((k) => [k[0], k])).values()].sort((a, b) => a[0] - b[0]);
      const frames = sorted
        .map(([frame, value, interp]) => {
          if (prop === "drawTarget") return `                    <KeyFrameId value="${value}" frame="${frame}"/>`;
          const curve = CURVE[interp];
          const attrs = `value="${r4(value)}" frame="${frame}" interpolationType="${curve ? "cubic" : interp}"`;
          return curve ? `                    <KeyFrameDouble ${attrs}>${curve}</KeyFrameDouble>` : `                    <KeyFrameDouble ${attrs}/>`;
        })
        .join("\n");
      return `            <KeyedObject objectId="${objectId}">\n                <KeyedProperty propertyKey="${P[prop]}">\n${frames}\n                </KeyedProperty>\n            </KeyedObject>`;
    });
    return `        <LinearAnimation loopValue="${this.loop}" fps="60" duration="${this.duration}" name="${this.name}" id="${this.id}">\n${items.join("\n")}\n        </LinearAnimation>`;
  }
}

const unwrap = (prev, value) => {
  let v = value;
  while (v - prev > Math.PI) v -= 2 * Math.PI;
  while (v - prev < -Math.PI) v += 2 * Math.PI;
  return r4(v);
};
const partKey = (p) => `${p.shape}|${p.contour}|${p.vertex ?? "e"}|${p.kind}`;

/**
 * 캐릭터 하나(아트보드 하나)의 뷰·자세·도구.
 * views: { key: { file, idBase, vertexIdBase?, poses?: [자세 파일…] } } — poses가 있으면 그 뷰는 정점에 id를 달고 자세로 보간한다.
 */
function character(animal, { ids, views }) {
  const ch = { animal, ids, view: {}, pose: {}, reset: [] };
  for (const [key, v] of Object.entries(views)) {
    const morph = v.vertexIdBase !== undefined;
    const source = readSvg(`nyang-${animal}${v.file}`);
    const converted = svgToRml(source, { idBase: v.idBase, indent: "                ", vertexIdBase: v.vertexIdBase, morph });
    const body = converted.body.replace(
      new RegExp(`<Node x="${ORIGIN.x}" y="${ORIGIN.y}" name="${animal}" id="([^"]+)">`),
      (_m, id) => `<Node x="0" y="0" opacity="${key === "front" ? 1 : 0}" name="view-${key}" id="${id}">`,
    );
    ch.view[key] = { ...converted, body, groups: groupValues(source), poses: {} };
    // 자세: 같은 id 체계로 변환해 정점·타원·그룹 값을 짝짓는다(characters.md "보간 가능 구간")
    for (const file of v.poses ?? []) {
      const src = readSvg(`nyang-${animal}${file}`);
      const out = svgToRml(src, { idBase: v.idBase, vertexIdBase: v.vertexIdBase, morph: true });
      ch.view[key].poses[file] = { parts: new Map(out.parts.map((p) => [partKey(p), p])), groups: groupValues(src) };
    }
    ch.view[key].poses[v.file] = { parts: new Map(converted.parts.map((p) => [partKey(p), p])), groups: ch.view[key].groups };
  }
  ch.g = (v, name) => {
    const id = ch.view[v].ids[name];
    if (!id) throw new Error(`${animal} ${v}에 그룹 ${name}이 없다`);
    return id;
  };
  ch.base = (v, name) => ch.view[v].groups[name];
  ch.poseGroup = (v, file, name) => ch.view[v].poses[file].groups[name];

  /** 상태가 바뀔 때 앞 상태의 값이 남지 않도록 되돌릴 기본값 */
  const reset = (objectId, prop, value) => ch.reset.push({ objectId, prop, value });
  reset(ids.rig, "x", ORIGIN.x);
  reset(ids.rig, "y", ORIGIN.y);
  reset(ids.rig, "scaleX", 1);
  reset(ids.rig, "scaleY", 1);
  reset(ids.flip, "scaleX", 1);
  for (const key of Object.keys(views)) reset(ch.view[key].ids[animal], "opacity", key === "front" ? 1 : 0);
  // 보간하는 뷰(옆 앉음·누움)는 쓰는 애니메이션이 0프레임부터 모든 값을 키로 둔다. 나머지 뷰의 그룹만 되돌린다
  for (const [key, v] of Object.entries(views)) {
    if (v.vertexIdBase !== undefined) continue;
    for (const [name, b] of Object.entries(ch.view[key].groups)) {
      if (name === animal) continue;
      const id = ch.view[key].ids[name];
      for (const prop of ["x", "y", "rotation", "opacity"]) reset(id, prop, b[prop]);
      reset(id, "scaleY", 1);
    }
  }
  /** 어느 애니메이션이든 움직이는 값만, 그 값을 키로 두지 않은 애니메이션의 0프레임에 기본값으로 둔다 */
  ch.finalize = (anims) => {
    const moved = ch.reset.filter(({ objectId, prop }) => anims.some((anim) => anim.has(objectId, prop)));
    for (const anim of anims) for (const { objectId, prop, value } of moved) if (!anim.has(objectId, prop)) anim.key(objectId, prop, [[0, value]]);
  };

  /** 보이는 뷰 구간: [[시작, 뷰, 좌우반전]] */
  ch.showViews = (anim, segments) => {
    for (const key of Object.keys(views)) anim.key(ch.view[key].ids[animal], "opacity", segments.map(([frame, v]) => [frame, v === key ? 1 : 0]));
    anim.key(ids.flip, "scaleX", segments.map(([frame, , flip]) => [frame, flip ? -1 : 1]));
  };

  /**
   * 보간 뷰의 정점·타원·그룹을 자세 순서대로 키로 둔다. seq: [[프레임, 자세 파일, 다음 키까지의 보간]].
   * lag: { 그룹: 프레임 } 그 그룹의 변환만 늦게(따라오기). skip: 직접 키를 둘 그룹 변환.
   */
  ch.morph = (anim, v, seq, { lag = {}, skip = [] } = {}) => {
    const vw = ch.view[v];
    const poses = seq.map(([, file]) => {
      const pose = vw.poses[file];
      if (!pose) throw new Error(`${animal} ${v}에 자세 ${file}이 없다`);
      return pose;
    });
    // 값이 이어서 같은 구간 한가운데의 키는 빼도 모양이 같다(.riv 크기를 줄인다)
    const track = (id, prop, values, delay = 0) => {
      if (values.every((value) => value === values[0])) return;
      const same = (a, b) => b >= 0 && b < values.length && values[a] === values[b];
      const keys = seq.map(([frame, , interp], i) => [frame + delay, values[i], interp]).filter((_, i) => !((i === 0 || same(i, i - 1)) && (i === values.length - 1 || same(i, i + 1))));
      anim.key(id, prop, keys);
    };
    for (const p of vw.parts) {
      const qs = poses.map((pose) => {
        const q = pose.parts.get(partKey(p));
        if (!q) throw new Error(`${animal} 자세에 없는 정점: ${partKey(p)}`);
        return q;
      });
      if (p.kind === "ellipse") {
        for (const prop of ["x", "y", "width", "height"]) track(p.id, prop, qs.map((q) => q[prop]));
        continue;
      }
      track(p.id, "vx", qs.map((q) => q.x));
      track(p.id, "vy", qs.map((q) => q.y));
      for (const side of ["in", "out"]) {
        const d = qs.map((q) => q[`${side}Distance`]);
        const raw = qs.map((q) => q[`${side}Rotation`]);
        // 거리 0인 핸들은 각도가 의미 없다: 거리가 있는 가장 가까운 자세의 각도를 쓴다(0도도 정상 각도다)
        const filled = raw.map((value, k) => {
          if (d[k] !== 0) return value;
          let best = null;
          for (let n = 0; n < raw.length; n++) if (d[n] !== 0 && (best === null || Math.abs(n - k) < Math.abs(best - k))) best = n;
          return best === null ? value : raw[best];
        });
        const angles = [r4(filled[0])];
        for (let k = 1; k < filled.length; k++) angles.push(unwrap(angles[k - 1], filled[k]));
        track(p.id, `${side}Distance`, d);
        track(p.id, `${side}Rotation`, angles);
      }
    }
    for (const [name, id] of Object.entries(vw.ids)) {
      if (name === animal || skip.includes(name)) continue;
      const values = poses.map((pose) => pose.groups[name]);
      for (const prop of ["x", "y", "rotation"]) track(id, prop, values.map((value) => value[prop]), lag[name] ?? 0);
      if (!values.every((value) => value.opacity === values[0].opacity)) anim.key(id, "opacity", seq.map(([frame], i) => [frame, values[i].opacity]));
    }
  };

  /** press: 250ms(15프레임). 웃는 눈, 머리 6° 갸웃, 바닥 기준 납작. hop이면 잠에서 깨며 살짝 튀어 오른다(200ms 안) */
  ch.pressLike = (anim, hop) => {
    anim.key(ch.g("front", "eyes-happy"), "opacity", [[0, 1], [13, 0], [15, 0]]);
    anim.key(ch.g("front", "eyes-open"), "opacity", [[0, 0], [13, 1], [15, 1]]);
    anim.key(ch.g("front", "head"), "rotation", [[0, 0, "easeOut"], [6, 6 * DEG, "easeOut"], [15, 0]]);
    anim.key(ids.rig, "scaleY", [[0, 1, "easeOut"], [6, 0.95, "easeOut"], [15, 1]]);
    anim.key(ids.rig, "scaleX", [[0, 1, "easeOut"], [6, 1.03, "easeOut"], [15, 1]]);
    if (hop) anim.key(ids.rig, "y", [[0, ORIGIN.y, "easeOut"], [5, ORIGIN.y - 4, "easeIn"], [11, ORIGIN.y], [15, ORIGIN.y]]);
    return anim;
  };
  return ch;
}

// ── 상태 머신 ──
const triggerXml = `<TransitionViewModelCondition>
                            <TransitionPropertyViewModelComparator>
                                <BindablePropertyTrigger>
                                    <DataBindContext sourcePathIds="0:50-0:52" propertyKey="686"/>
                                </BindablePropertyTrigger>
                            </TransitionPropertyViewModelComparator>
                            <TransitionValueTriggerComparator/>
                        </TransitionViewModelCondition>`;
const transition = ({ to, press, done, afterMs }) => {
  if (press) return `<StateTransition stateToId="${to}">\n                        ${triggerXml}\n                    </StateTransition>`;
  if (done) return `<StateTransition stateToId="${to}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`;
  return `<StateTransition stateToId="${to}" enableExitTime="true" exitTime="${afterMs}"/>`;
};
/** states: [{ id, anim, name, x, y, reset?, comment?, out: [transition…] }] */
function stateMachineXml(ids, states) {
  const body = states
    .map((s) => {
      const out = s.out.map((t) => `                    ${transition(t)}`).join("\n");
      return `${s.comment ? `                <!-- ${s.comment} -->\n` : ""}                <AnimationState x="${s.x}" y="${s.y}" animationId="${s.anim.id}"${s.reset ? ` reset="true"` : ""} stateName="${s.name}" id="${s.id}">\n${out}\n                </AnimationState>`;
    })
    .join("\n");
  return `        <StateMachine name="State Machine 1" id="${ids.sm}">
            <StateMachineLayer name="Character" id="${ids.layer}">
                <AnyState x="200" y="-160"/>
                <ExitState x="800" y="-160"/>
                <EntryState x="0" y="0">
                    <StateTransition stateToId="${states[0].id}"/>
                </EntryState>
${body}
            </StateMachineLayer>
        </StateMachine>`;
}

function artboardXml(ch, { x, comment, extraRig = "" }, states, anims) {
  const { ids, animal } = ch;
  const views = Object.values(ch.view).map((v) => v.body).reverse().join("\n");
  return `    <Artboard viewModelId="0:50" viewModelInstanceId="0:51" defaultStateMachineId="${ids.sm}" x="${x}" y="0" styleId="${ids.style}" width="120" height="120" name="nyang-${animal}" id="${ids.artboard}">
        <LayoutComponentStyle name="Artboard Style" id="${ids.style}"/>

        <!-- ${comment} -->
        <Node x="${ORIGIN.x}" y="${ORIGIN.y}" name="rig" id="${ids.rig}">
            <Node x="0" y="0" name="flip" id="${ids.flip}">
${views}
            </Node>${extraRig}
        </Node>

${stateMachineXml(ids, states)}

${anims.map((a) => a.xml()).join("\n\n")}
    </Artboard>`;
}

// ════════════════════════ 고양이 ════════════════════════
const cat = character("cat", {
  ids: { artboard: "0:2", style: "0:5", sm: "0:7", layer: "0:8", rig: "0:900", flip: "0:901" },
  views: {
    front: { file: "", idBase: 1000 },
    q34: { file: "-34", idBase: 1100 },
    side: { file: "-side", idBase: 1200, vertexIdBase: 2500, poses: ["-crouch", "-crouch-wiggle", "-pounce-air", "-pounce-land"] },
    lie: { file: "-lie-mid", idBase: 1400, vertexIdBase: 2000, poses: ["-lie"] },
  },
});
{
  // 꼬리 그리는 순서(누움에서는 꼬리가 몸·다리 위): DrawRules를 lie 뷰의 tail에 단다
  const DRAW = { rules: "0:902", behind: "0:903", front: "0:904", farShaft: "0:905", nearPaw: "0:906" };
  cat.draw = DRAW;
  cat.view.lie.body = cat.view.lie.body
    .replace(`<Shape name="leg-front-far-shaft">`, `<Shape name="leg-front-far-shaft" id="${DRAW.farShaft}">`)
    .replace(`<Shape name="leg-front-near-paw">`, `<Shape name="leg-front-near-paw" id="${DRAW.nearPaw}">`)
    .replace(
      new RegExp(`(<Node [^>]*name="tail" id="${cat.g("lie", "tail")}">)`),
      `$1
                        <DrawRules drawTargetId="${DRAW.behind}" name="tail order" id="${DRAW.rules}">
                            <DrawTarget drawableId="${DRAW.farShaft}" placementValue="after" name="behind far leg" id="${DRAW.behind}"/>
                            <DrawTarget drawableId="${DRAW.nearPaw}" placementValue="before" name="over near paw" id="${DRAW.front}"/>
                        </DrawRules>`,
    );
}

// greet: 엉덩이 씰룩 → 덮치기(characters.md "들어올 때 동작", f4~f45). 오른쪽(그린 방향)을 본다
const catGreet = new Anim("greet", "0:20", f24(45) + 3, "oneShot");
{
  const { rig } = cat.ids;
  // 따라오기: 꼬리 끝 1프레임, 귀 2프레임, 리본 1프레임 늦게(24fps 기준)
  const lag = { tail: f24(1), "ear-left": f24(2), "ear-right": f24(2), bow: f24(1) };
  cat.showViews(catGreet, [[0, "front"], [f24(4), "q34"], [f24(6), "side"], [f24(43), "q34"], [f24(45), "front"]]);
  cat.morph(
    catGreet,
    "side",
    [
      [f24(6), "-side", "linear"], // 6–11 옆 앉음 → 웅크림(표에 가속 지정 없음: 선형)
      [f24(12), "-crouch", "linear"], // 12–23 웅크림 ↔ 씰룩, 3프레임씩 4번
      [f24(15), "-crouch-wiggle", "linear"],
      [f24(18), "-crouch", "linear"],
      [f24(21), "-crouch-wiggle", "linear"],
      [f24(24), "-crouch", "hold"], // 24–25 한 번 더 낮게(rig)
      [f24(26), "-crouch", "easeOut"], // 26–29 웅크림 → 공중
      [f24(30), "-pounce-air", "easeIn"], // 30–33 공중 → 착지
      [f24(33), "-pounce-land", "hold"], // 34–36 착지 유지
      [f24(37), "-pounce-land", "easeInOut"], // 37–42 착지 → 옆 앉음
      [f24(43), "-side", "hold"],
    ],
    { lag },
  );
  // 루트: 공중 y −14, x +4(착지 그림이 칸 안에 들도록 +4 이하), 늘림·납작은 바닥 기준
  catGreet.key(rig, "y", [[0, ORIGIN.y], [f24(26), ORIGIN.y, "easeOut"], [f24(30), ORIGIN.y - 14, "easeIn"], [f24(33), ORIGIN.y]]);
  catGreet.key(rig, "x", [[0, ORIGIN.x], [f24(26), ORIGIN.x, "easeOut"], [f24(30), ORIGIN.x + 4], [f24(37), ORIGIN.x + 4, "easeInOut"], [f24(43), ORIGIN.x]]);
  catGreet.key(rig, "scaleX", [[0, 1], [f24(24), 1, "easeOut"], [f24(26), 1.04, "easeOut"], [f24(28), 1.06], [f24(31), 1.06, "easeIn"], [f24(33), 1.08, "easeOut"], [f24(36), 1]]);
  catGreet.key(rig, "scaleY", [[0, 1], [f24(24), 1, "easeOut"], [f24(26), 0.92, "easeOut"], [f24(28), 1], [f24(31), 1, "easeIn"], [f24(33), 0.9, "easeOut"], [f24(36), 1]]);
  // 착지 따라오기(34–36): 꼬리 휙, 리본 흔들, 귀 앞으로(+는 시계 방향 = 오른쪽을 보는 고양이의 앞)
  const land = (name) => cat.poseGroup("side", "-pounce-land", name).rotation;
  const after = (name, keys) =>
    catGreet.key(cat.g("side", name), "rotation", [[f24(33) + lag[name], land(name), "easeOut"], ...keys.map(([f, d, i]) => [f + lag[name], land(name) + d * DEG, i]), [f24(37) + lag[name], land(name), "easeInOut"]]);
  after("tail", [[f24(34), -16, "easeInOut"], [f24(35), 10, "easeInOut"], [f24(36), -4, "easeInOut"]]);
  after("bow", [[f24(34), 10, "easeInOut"], [f24(35), -6, "easeInOut"], [f24(36), 2, "easeInOut"]]);
  after("ear-left", [[f24(34.5), 10, "easeInOut"]]);
  after("ear-right", [[f24(34.5), 10, "easeInOut"]]);
}

// idle: 깜빡임·숨쉬기·꼬리·리본(정면)
const catIdle = new Anim("idle", "0:21", 300, "loop");
{
  const g = (name) => cat.g("front", name);
  const b = 180;
  catIdle.key(g("eyes-open"), "scaleY", [[0, 1], [b, 1, "linear"], [b + 4, 0.15], [b + 14, 0.15, "linear"], [b + 18, 1], [300, 1]]);
  catIdle.key(g("eyes-open"), "opacity", [[0, 1], [b + 4, 0], [b + 14, 1], [300, 1]]);
  catIdle.key(g("eyes-closed"), "opacity", [[0, 0], [b + 4, 1], [b + 14, 0], [300, 0]]);
  catIdle.key(g("body"), "scaleY", [[0, 1, "easeInOut"], [150, 1.015, "easeInOut"], [300, 1]]);
  catIdle.key(g("tail"), "rotation", [[0, 0, "easeInOut"], [75, 0.07, "easeInOut"], [150, 0, "easeInOut"], [225, -0.056, "easeInOut"], [300, 0]]);
  catIdle.key(g("bow"), "rotation", [[0, 0], [60, 0, "easeInOut"], [75, 0.07, "easeInOut"], [90, -0.05, "easeInOut"], [105, 0.02, "easeInOut"], [120, 0], [300, 0]]);
}
const catPress = cat.pressLike(new Anim("press", "0:22", 15, "oneShot"), false);
const catWake = cat.pressLike(new Anim("wake", "0:25", 15, "oneShot"), true);

// sleepEnter: 졸기 → 3/4 → 기우는 중간 → 누움(정점 보간)
const catSleepEnter = new Anim("sleepEnter", "0:23", 150, "oneShot");
{
  // 0~90 졸기(정면): 눈 세로 40%로 반쯤, 머리 3px 꾸벅 두 번(회전 없이 아래로)
  cat.showViews(catSleepEnter, [[0, "front"], [90, "q34"], [99, "lie"]]);
  catSleepEnter.key(cat.g("front", "eyes-open"), "scaleY", [[0, 1, "easeOut"], [10, 0.4], [90, 0.4]]);
  const hy = cat.base("front", "head").y;
  catSleepEnter.key(cat.g("front", "head"), "y", [[0, hy, "easeInOut"], [20, hy + 3, "easeInOut"], [35, hy, "easeInOut"], [60, hy + 3, "easeInOut"], [75, hy]]);
  // 90~99 3/4: 머리를 살짝 숙이며 돌아섬
  const qy = cat.base("q34", "head").y;
  catSleepEnter.key(cat.g("q34", "head"), "y", [[0, qy], [90, qy, "easeOut"], [99, qy + 2]]);
  // 99~114 기우는 중간: 머리 0 → 10°, 꼬리 0 → −15°(저작 값) 보간, 눈은 감김
  // 114~150 기우는 중간 → 누움 정점 보간 600ms ease-out. 꼬리는 몸 앞에 거의 다 왔을 때(141f) 앞으로 그린다
  cat.morph(catSleepEnter, "lie", [[114, "-lie-mid", "easeOut"], [150, "-lie", "hold"]]);
  for (const name of ["head", "tail"]) catSleepEnter.key(cat.g("lie", name), "rotation", [[0, 0], [99, 0, "easeOut"]]);
  catSleepEnter.key(cat.draw.rules, "drawTarget", [[0, cat.draw.behind], [141, cat.draw.front]]);
}

// sleep: 숨쉬기 4초, 머리 1px, 꼬리 끝 가끔 ±6°, 리본 정지(12초 반복)
const catSleep = new Anim("sleep", "0:24", 720, "loop");
{
  cat.showViews(catSleep, [[0, "lie"]]);
  catSleep.key(cat.draw.rules, "drawTarget", [[0, cat.draw.front]]);
  const lie = (name) => cat.poseGroup("lie", "-lie", name);
  const hy = lie("head").y;
  const breathe = [], nod = [];
  for (let c = 0; c < 3; c++) {
    breathe.push([c * 240, 1, "easeInOut"], [c * 240 + 120, 1.02, "easeInOut"]);
    nod.push([c * 240, hy, "easeInOut"], [c * 240 + 120, hy - 1, "easeInOut"]);
  }
  catSleep.key(cat.g("lie", "body"), "scaleY", [...breathe, [720, 1]]);
  catSleep.key(cat.g("lie", "head"), "y", [...nod, [720, hy]]);
  const tr = lie("tail").rotation;
  catSleep.key(cat.g("lie", "tail"), "rotation", [[0, tr], [590, tr, "easeInOut"], [605, tr + 6 * DEG, "easeInOut"], [620, tr - 6 * DEG, "easeInOut"], [640, tr]]);
}
cat.finalize([catGreet, catIdle, catPress, catWake, catSleepEnter, catSleep]);

const CS = { greet: "0:12", idle: "0:13", press: "0:14", sleepEnter: "0:15", sleep: "0:16", wake: "0:17" };
const catArtboard = artboardXml(
  cat,
  { x: 0, comment: "도형: docs/design/assets/characters/nyang-cat{,-34,-side,-lie-mid}.svg(옆 앉음·기우는 중간은 정점 id, 자세로 보간)" },
  [
    { id: CS.greet, anim: catGreet, name: "greet", x: 200, y: 0, comment: "greet: 들어올 때 1회(엉덩이 씰룩 → 덮치기) → idle. 누르면 끊고 press", out: [{ to: CS.idle, done: true }, { to: CS.press, press: true }] },
    { id: CS.idle, anim: catIdle, name: "idle", x: 400, y: 0, reset: true, comment: "idle: 무입력 10초(exitTime ms)면 sleepEnter. 다시 들어올 때마다 처음부터(reset)", out: [{ to: CS.sleepEnter, afterMs: 10000 }, { to: CS.press, press: true }] },
    { id: CS.press, anim: catPress, name: "press", x: 400, y: -160, reset: true, comment: "press: 250ms → idle", out: [{ to: CS.idle, done: true }] },
    { id: CS.sleepEnter, anim: catSleepEnter, name: "sleepEnter", x: 600, y: 0, reset: true, comment: "sleep: 졸기 → 눕기 → 잠(반복). 누르면 wake(정면 앉음으로 튀어 오름)", out: [{ to: CS.sleep, done: true }, { to: CS.wake, press: true }] },
    { id: CS.sleep, anim: catSleep, name: "sleep", x: 800, y: 0, out: [{ to: CS.wake, press: true }] },
    { id: CS.wake, anim: catWake, name: "wake", x: 600, y: -160, reset: true, out: [{ to: CS.idle, done: true }] },
  ],
  [catGreet, catIdle, catPress, catWake, catSleepEnter, catSleep],
);

// ════════════════════════ 강아지 ════════════════════════
const dog = character("dog", {
  ids: { artboard: "0:202", style: "0:205", sm: "0:207", layer: "0:208", rig: "0:3900", flip: "0:3901" },
  views: {
    front: { file: "", idBase: 3000 },
    q34: { file: "-34", idBase: 3100 },
    side: { file: "-side", idBase: 3200, vertexIdBase: 3500, poses: ["-play"] },
  },
});

// greet: 놀자 자세(characters.md "들어올 때 동작", f1~f33). 3/4·옆·놀자는 flip −1로 왼쪽(고양이 쪽)을 본다
const dogGreet = new Anim("greet", "0:220", f24(33) + 3, "oneShot");
{
  const { rig } = dog.ids;
  const g = (name) => dog.g("side", name);
  const side = (name) => dog.poseGroup("side", "-side", name);
  const play = (name) => dog.poseGroup("side", "-play", name);
  dog.showViews(dogGreet, [[0, "front"], [f24(1), "q34", true], [f24(3), "side", true], [f24(31), "q34", true], [f24(33), "front"]]);
  // 6–11 옆 앉음 → 놀자(ease-in), 12–23 유지, 24–30 놀자 → 옆 앉음(ease-out). 꼬리는 따로(아래)
  dog.morph(dogGreet, "side", [[f24(6), "-side", "easeIn"], [f24(11), "-play", "hold"], [f24(24), "-play", "easeOut"], [f24(31), "-side", "hold"]], { skip: ["tail", "leg-hind-near"] });
  // 3–5 들썩(세로 1 → 1.05, 예비·늘림), f11 앞발이 닿는 순간 1.06 × 0.94(납작), f26 일어나며 세로 1.04
  dogGreet.key(rig, "scaleY", [[0, 1], [f24(3), 1, "easeOut"], [f24(5), 1.05, "easeInOut"], [f24(7), 1], [f24(10), 1, "easeIn"], [f24(11), 0.94, "easeOut"], [f24(13), 1], [f24(24), 1, "easeOut"], [f24(26), 1.04, "easeInOut"], [f24(29), 1]]);
  dogGreet.key(rig, "scaleX", [[0, 1], [f24(10), 1, "easeIn"], [f24(11), 1.06, "easeOut"], [f24(13), 1]]);
  // 귀 위로(3–5): 들썩과 함께 2px
  for (const name of ["ear-left", "ear-right"]) {
    const y = side(name).y;
    dogGreet.key(g(name), "y", [[0, y], [f24(3), y, "easeOut"], [f24(5), y - 2, "easeIn"], [f24(6), y, "easeIn"]]);
  }
  // 12–23 꼬리 25°±20°, 4프레임 주기(반 주기 2프레임마다 좌우). 진폭이 커지다가 f16–20 최대(최고조 f18)
  // 엉덩이(뒷다리·꼬리 뿌리) x ±1 반대 박자, f21–23 엉덩이 한 번 통통. 꼬리는 일어날 때 f32까지 따라온다
  const amp = (f) => (f < 16 ? 8 + (f - 12) * 3 : f <= 20 ? 20 : Math.max(0, 20 - (f - 20) * 6));
  const wag = [], hipX = [];
  for (let f = 12, k = 0; f < 24; f += 2, k++) {
    const sgn = k % 2 === 0 ? 1 : -1;
    wag.push([f24(f), (25 + sgn * amp(f)) * DEG, "easeInOut"]);
    hipX.push([f24(f), sgn * -1, "easeInOut"]);
  }
  dogGreet.key(g("tail"), "rotation", [[0, side("tail").rotation], [f24(6), side("tail").rotation, "easeIn"], [f24(11), play("tail").rotation, "easeOut"], ...wag, [f24(24), 25 * DEG, "easeOut"], [f24(32), side("tail").rotation, "hold"]]);
  for (const name of ["tail", "leg-hind-near"]) {
    const s = side(name), p = play(name);
    const xs = hipX.map(([f, dx, i]) => [f, p.x + dx, i]);
    dogGreet.key(g(name), "x", [[0, s.x], [f24(6), s.x, "easeIn"], [f24(11), p.x, "hold"], ...xs, [f24(24), p.x, "easeOut"], [f24(name === "tail" ? 32 : 31), s.x, "hold"]]);
    dogGreet.key(g(name), "y", [[0, s.y], [f24(6), s.y, "easeIn"], [f24(11), p.y, "hold"], [f24(21), p.y, "easeOut"], [f24(22), p.y - 2, "easeIn"], [f24(23), p.y, "hold"], [f24(24), p.y, "easeOut"], [f24(name === "tail" ? 32 : 31), s.y, "hold"]]);
    if (name === "leg-hind-near" && s.rotation !== p.rotation) {
      dogGreet.key(g(name), "rotation", [[0, s.rotation], [f24(6), s.rotation, "easeIn"], [f24(11), p.rotation, "hold"], [f24(24), p.rotation, "easeOut"], [f24(31), s.rotation]]);
    }
  }
}

// idle: 깜빡임·숨쉬기·꼬리(정면). 고양이와 주기(5.5초)·깜빡임 시점이 다르다
const dogIdle = new Anim("idle", "0:221", 330, "loop");
{
  const g = (name) => dog.g("front", name);
  dogIdle.key(g("eyes-open"), "opacity", [[0, 1], [109, 0], [119, 1], [330, 1]]);
  dogIdle.key(g("eyes-open"), "scaleY", [[0, 1], [105, 1, "linear"], [109, 0.15], [119, 0.15, "linear"], [123, 1], [330, 1]]);
  dogIdle.key(g("eyes-closed"), "opacity", [[0, 0], [109, 1], [119, 0], [330, 0]]);
  dogIdle.key(g("body"), "scaleY", [[0, 1, "easeInOut"], [165, 1.015, "easeInOut"], [330, 1]]);
  dogIdle.key(g("tail"), "rotation", [[0, 0, "easeInOut"], [83, 0.09, "easeInOut"], [165, 0, "easeInOut"], [248, -0.072, "easeInOut"], [330, 0]]);
}
const dogPress = dog.pressLike(new Anim("press", "0:222", 15, "oneShot"), false);
dog.finalize([dogGreet, dogIdle, dogPress]);

const DS = { greet: "0:212", idle: "0:213", press: "0:214" };
const dogArtboard = artboardXml(
  dog,
  { x: 200, comment: "도형: docs/design/assets/characters/nyang-dog{,-34,-side}.svg(옆 앉음은 정점 id, 놀자로 보간). 잠은 아직 없다(PRD v1.2 2단계)" },
  [
    { id: DS.greet, anim: dogGreet, name: "greet", x: 200, y: 0, comment: "greet: 들어올 때 1회(놀자 자세) → idle. 누르면 끊고 press", out: [{ to: DS.idle, done: true }, { to: DS.press, press: true }] },
    { id: DS.idle, anim: dogIdle, name: "idle", x: 400, y: 0, out: [{ to: DS.press, press: true }] },
    { id: DS.press, anim: dogPress, name: "press", x: 400, y: -160, reset: true, comment: "press: 250ms → idle", out: [{ to: DS.idle, done: true }] },
  ],
  [dogGreet, dogIdle, dogPress],
);

// ── scene.rml에 쓰기 ──
const BEGIN = "<!-- rive-artboards:begin (scripts/rive-characters-scene.mjs가 만든다. 손으로 고치지 않는다) -->";
const END = "<!-- rive-artboards:end -->";
const block = `${BEGIN}\n${catArtboard}\n\n${dogArtboard}\n    ${END}`;

let scene = readFileSync(SCENE, "utf8");
const begin = scene.indexOf("<!-- rive-artboards:begin");
const end = scene.indexOf(END);
if (begin >= 0 && end > begin) {
  scene = scene.slice(0, begin) + block + scene.slice(end + END.length);
} else {
  // 처음 한 번: 예전 고양이 표시(rive-cat:begin)부터 강아지 아트보드 끝까지를 바꾼다
  const from = scene.indexOf("<!-- rive-cat:begin");
  const dogAt = scene.indexOf(`name="nyang-dog"`);
  const to = scene.indexOf("    </Artboard>", dogAt) + "    </Artboard>".length;
  if (from < 0 || dogAt < 0 || to < dogAt) throw new Error("아트보드 자리를 찾지 못했다");
  scene = scene.slice(0, from) + block + scene.slice(to);
}
// id가 겹치면 rive가 조용히 엉뚱한 객체에 키를 걸 수 있어 여기서 막는다
const seen = new Map();
for (const m of scene.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
const dup = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
if (dup.length) throw new Error(`id 중복: ${dup.slice(0, 10).join(", ")}`);
if (process.argv.includes("--check")) {
  if (scene !== readFileSync(SCENE, "utf8")) {
    console.error("scene.rml이 생성 결과와 다르다. 그림(SVG)이나 생성기를 바꿨으면 `pnpm rive:build`로 다시 만든다");
    process.exit(1);
  }
  console.log("scene.rml이 생성 결과와 같다");
  process.exit(0);
}
writeFileSync(SCENE, scene);
const summary = (ch, anims) => `${ch.animal}: views ${Object.keys(ch.view).join(", ")}; ${anims.map((a) => `${a.name}(${a.duration}f, ${a.tracks.size})`).join(" ")}`;
console.log(summary(cat, [catGreet, catIdle, catPress, catWake, catSleepEnter, catSleep]));
console.log(summary(dog, [dogGreet, dogIdle, dogPress]));
