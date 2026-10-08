#!/usr/bin/env node
/**
 * 고양이 Rive 아트보드(rive/nyang-characters/scene.rml의 nyang-cat) 생성기. docs/design/characters.md "모션"을 따른다.
 *
 *   node scripts/rive-cat-scene.mjs     scene.rml의 `<!-- rive-cat:begin -->` ~ `<!-- rive-cat:end -->` 사이를 다시 쓴다
 *                                       (강아지 아트보드와 뷰 모델은 그대로 둔다). 그다음 `pnpm rive:build`.
 *
 * 그림을 바꾸면(docs/design/assets/characters/nyang-cat*.svg) 이 스크립트를 다시 돌린다. 모프(기우는 중간 → 누움)는 정점마다
 * 키가 수백 개라 손으로 쓰지 않고 여기서 만든다.
 *
 * 구조
 *   rig(바닥 가운데 60,112: 점프 높이·늘림·납작) > flip(좌우 반전) > 뷰 다섯(한 번에 하나만 보인다, opacity hold)
 *     front 정면 앉음 · q34 3/4 · side 옆 앉음 · back 뒤 · lie 기우는 중간(정점에 id, 누움으로 모프)
 *   상태: Entry → greet → idle →(무입력 10초) sleepEnter → sleep(반복). press 트리거: greet·idle → press, sleepEnter·sleep → wake.
 *   press·wake가 끝나면 idle. 앱이 보내는 신호는 뷰 모델 트리거 press 하나다(scene.rml의 ViewModel "Character").
 *
 * 숫자는 60fps 프레임이다(characters.md 표는 24fps라 × 2.5).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { svgToRml } = await import(pathToFileURL(join(ROOT, "scripts/svg-to-rml.mjs")).href);
const SCENE = join(ROOT, "rive/nyang-characters/scene.rml");
const svg = (view) => readFileSync(join(ROOT, `docs/design/assets/characters/nyang-cat${view}.svg`), "utf8");

const DEG = Math.PI / 180;
const P = { x: 13, y: 14, rotation: 15, scaleX: 16, scaleY: 17, opacity: 18, width: 20, height: 21, vx: 24, vy: 25, inRotation: 84, inDistance: 85, outRotation: 86, outDistance: 87, drawTarget: 121 };
const CURVE = {
  easeOut: `<CubicEaseInterpolator x1="0" y1="0" x2="0.58" y2="1"/>`,
  easeIn: `<CubicEaseInterpolator x1="0.42" y1="0" x2="1" y2="1"/>`,
  easeInOut: `<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>`,
};
const r4 = (n) => +(+n).toFixed(4);

// ── 뷰 ──
const VIEWS = {
  front: { file: "", idBase: 1000 },
  q34: { file: "-34", idBase: 1100 },
  side: { file: "-side", idBase: 1200 },
  back: { file: "-back", idBase: 1300 },
  lie: { file: "-lie-mid", idBase: 1400, vertexIdBase: 2000, morph: true },
};
const RIG = "0:900", FLIP = "0:901";
/** rig의 기준점(바닥 가운데). 점프는 이 값에서 뺀다 */
const FLOOR = 112;
const DRAW = { rules: "0:902", behind: "0:903", front: "0:904", farShaft: "0:905", nearPaw: "0:906" };

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

const view = {};
for (const [key, v] of Object.entries(VIEWS)) {
  const source = svg(v.file);
  const converted = svgToRml(source, { idBase: v.idBase, indent: "                ", vertexIdBase: v.vertexIdBase, morph: v.morph });
  let body = converted.body.replace(
    /<Node x="60" y="112" name="cat" id="([^"]+)">/,
    (_m, id) => `<Node x="0" y="0" opacity="${key === "front" ? 1 : 0}" name="view-${key}" id="${id}">`,
  );
  view[key] = { ...converted, body, groups: groupValues(source), id: (name) => converted.ids[name] };
}
// 누움 모프 목표(정점·타원·그룹 값)
const lieTarget = svgToRml(svg("-lie"), { idBase: 1400, vertexIdBase: 2000, morph: true });
const lieGroups = groupValues(svg("-lie"));

// 꼬리 그리는 순서(누움에서는 꼬리가 몸·다리 위): DrawRules를 lie 뷰의 tail에 단다
view.lie.body = view.lie.body
  .replace(`<Shape name="leg-front-far-shaft">`, `<Shape name="leg-front-far-shaft" id="${DRAW.farShaft}">`)
  .replace(`<Shape name="leg-front-near-paw">`, `<Shape name="leg-front-near-paw" id="${DRAW.nearPaw}">`)
  .replace(
    new RegExp(`(<Node [^>]*name="tail" id="${view.lie.id("tail")}">)`),
    `$1
                        <DrawRules drawTargetId="${DRAW.behind}" name="tail order" id="${DRAW.rules}">
                            <DrawTarget drawableId="${DRAW.farShaft}" placementValue="after" name="behind far leg" id="${DRAW.behind}"/>
                            <DrawTarget drawableId="${DRAW.nearPaw}" placementValue="before" name="over near paw" id="${DRAW.front}"/>
                        </DrawRules>`,
  );

// ── 키프레임 도구 ──
class Anim {
  constructor(name, id, duration, loop) {
    Object.assign(this, { name, id, duration, loop, tracks: new Map() });
  }
  /** keys: [frame, value, interp?] */
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

const g = (v, name) => view[v].id(name);
const base = (v, name) => view[v].groups[name];

/** 상태가 바뀔 때 앞 상태의 값이 남지 않도록 되돌릴 기본값(누움 뷰의 모프 대상은 sleepEnter·sleep이 따로 다룬다) */
const RESET = [];
const reset = (objectId, prop, value) => RESET.push({ objectId, prop, value });
reset(RIG, "y", FLOOR);
reset(RIG, "scaleX", 1);
reset(RIG, "scaleY", 1);
reset(FLIP, "scaleX", 1);
for (const key of Object.keys(VIEWS)) reset(view[key].id("cat"), "opacity", key === "front" ? 1 : 0);
const viewGroups = {
  front: ["body", "head", "tail", "bow", "ear-left", "ear-right", "leg-front-left", "leg-front-right", "eyes-open", "eyes-closed", "eyes-happy"],
  q34: ["head", "tail", "bow", "ear-left", "ear-right", "leg-front-far", "leg-front-near", "leg-hind-near"],
  side: ["head", "tail", "bow", "ear-left", "ear-right", "leg-front-far", "leg-front-near", "leg-hind-near"],
  back: ["head", "tail", "bow", "ear-left", "ear-right", "leg-hind-left", "leg-hind-right"],
};
for (const [v, names] of Object.entries(viewGroups)) {
  for (const name of names) {
    const b = base(v, name);
    for (const prop of ["x", "y", "rotation"]) reset(g(v, name), prop, b[prop]);
    reset(g(v, name), "opacity", b.opacity);
    if (name === "body" || name.startsWith("eyes")) reset(g(v, name), "scaleY", 1);
  }
}
/** 어느 애니메이션이든 움직이는 값만, 그 값을 키로 두지 않은 애니메이션의 0프레임에 기본값으로 둔다 */
function finalize(anims) {
  const moved = RESET.filter(({ objectId, prop }) => anims.some((anim) => anim.has(objectId, prop)));
  for (const anim of anims) for (const { objectId, prop, value } of moved) if (!anim.has(objectId, prop)) anim.key(objectId, prop, [[0, value]]);
}

/** 보이는 뷰 구간: [[시작, 뷰, 좌우반전]] */
function showViews(anim, segments, end) {
  for (const key of Object.keys(VIEWS)) {
    const keys = segments.map(([frame, v]) => [frame, v === key ? 1 : 0]);
    anim.key(view[key].id("cat"), "opacity", keys);
  }
  anim.key(FLIP, "scaleX", segments.map(([frame, , flip]) => [frame, flip ? -1 : 1]));
  void end;
}

// ── greet: 폴짝 돌기 ──
// 강아지 greet(20프레임 늦게 시작, 공중 26~46f)와 겹치지 않게 고양이는 40f부터 움츠린다(공중 48~80f)
const D = 40;
const greet = new Anim("greet", "0:20", D + 56, "oneShot");
{
  const t = (f) => D + f;
  // 그림: 움츠림 0~8 정면, 도약·회전 8~40(정면 3 → 3/4 5 → 옆 5 → 뒤 7 → 옆 반전 5 → 3/4 반전 5 → 정면 2), 착지 40~50 정면
  showViews(greet, [[0, "front"], [t(11), "q34"], [t(16), "side"], [t(21), "back"], [t(28), "side", true], [t(33), "q34", true], [t(38), "front"]]);
  // 높이: 오를 때 ease-out, 내릴 때 ease-in, 꼭대기(뒤 가운데) 16px
  greet.key(RIG, "y", [[0, FLOOR], [t(8), FLOOR, "easeOut"], [t(24), FLOOR - 16, "easeIn"], [t(40), FLOOR]]);
  // 늘림·납작: 움츠림 0.9 → 공중 1.08 → 착지 0.9 → 1
  greet.key(RIG, "scaleY", [[0, 1], [t(0), 1, "easeOut"], [t(8), 0.9, "easeOut"], [t(12), 1.08], [t(34), 1.08, "easeIn"], [t(40), 1, "easeOut"], [t(42), 0.9, "easeOut"], [t(50), 1]]);
  greet.key(RIG, "scaleX", [[0, 1], [t(0), 1, "easeOut"], [t(8), 1.05, "easeOut"], [t(12), 0.96], [t(34), 0.96, "easeIn"], [t(40), 1, "easeOut"], [t(42), 1.05, "easeOut"], [t(50), 1]]);
  // 정면 다리: 움츠림·착지 때 살짝 벌림(+는 시계 방향이라 왼쪽 다리 바깥이 +)
  greet.key(g("front", "leg-front-left"), "rotation", [[0, 0], [t(0), 0, "easeOut"], [t(8), 8 * DEG, "easeOut"], [t(11), 0], [t(40), 0, "easeOut"], [t(42), 6 * DEG, "easeOut"], [t(50), 0]]);
  greet.key(g("front", "leg-front-right"), "rotation", [[0, 0], [t(0), 0, "easeOut"], [t(8), -8 * DEG, "easeOut"], [t(11), 0], [t(40), 0, "easeOut"], [t(42), -6 * DEG, "easeOut"], [t(50), 0]]);
  // 공중 다리: 옆·3/4에서 앞다리는 앞(−), 뒷다리는 뒤(+). 옆에서 최대 35°(스쳐 가는 프레임), 3/4는 25~30°
  for (const [v, peakFront, peakHind] of [["q34", -30, 28], ["side", -35, 35]]) {
    greet.key(g(v, "leg-front-far"), "rotation", [[0, 0], [t(10), -15 * DEG, "easeOut"], [t(18), peakFront * DEG], [t(30), peakFront * DEG, "easeIn"], [t(38), -10 * DEG]]);
    greet.key(g(v, "leg-front-near"), "rotation", [[0, 0], [t(10), -15 * DEG, "easeOut"], [t(18), peakFront * DEG], [t(30), peakFront * DEG, "easeIn"], [t(38), -10 * DEG]]);
    greet.key(g(v, "leg-hind-near"), "rotation", [[0, 0], [t(10), 12 * DEG, "easeOut"], [t(18), peakHind * DEG], [t(30), peakHind * DEG, "easeIn"], [t(38), 8 * DEG]]);
  }
  greet.key(g("back", "leg-hind-left"), "rotation", [[0, 0], [t(21), -10 * DEG, "easeOut"], [t(25), -14 * DEG], [t(28), 0]]);
  greet.key(g("back", "leg-hind-right"), "rotation", [[0, 0], [t(21), 10 * DEG, "easeOut"], [t(25), 14 * DEG], [t(28), 0]]);
  // 따라오기: 귀·꼬리·리본은 몸보다 1~2프레임 늦게. 오를 때 처지고(+), 내릴 때 들린다(−)
  for (const v of ["front", "q34", "side", "back"]) {
    greet.key(g(v, "tail"), "rotation", [[0, 0], [t(2), 0, "easeOut"], [t(10), 12 * DEG, "easeOut"], [t(26), 16 * DEG, "easeInOut"], [t(36), -10 * DEG, "easeOut"], [t(44), 14 * DEG, "easeInOut"], [t(49), -6 * DEG, "easeInOut"], [t(56), 0]]);
    greet.key(g(v, "bow"), "rotation", [[0, base(v, "bow").rotation], [t(2), base(v, "bow").rotation, "easeOut"], [t(10), 6 * DEG, "easeOut"], [t(26), -4 * DEG, "easeInOut"], [t(42), 5 * DEG, "easeInOut"], [t(48), -2 * DEG, "easeInOut"], [t(55), 0]]);
    greet.key(g(v, "ear-left"), "rotation", [[0, base(v, "ear-left").rotation], [t(2), base(v, "ear-left").rotation, "easeOut"], [t(10), -8 * DEG, "easeOut"], [t(26), 6 * DEG, "easeInOut"], [t(42), -6 * DEG, "easeInOut"], [t(52), 0]]);
    greet.key(g(v, "ear-right"), "rotation", [[0, base(v, "ear-right").rotation], [t(2), base(v, "ear-right").rotation, "easeOut"], [t(10), 8 * DEG, "easeOut"], [t(26), -6 * DEG, "easeInOut"], [t(42), 6 * DEG, "easeInOut"], [t(52), 0]]);
  }
}

// ── idle: 깜빡임·숨쉬기·꼬리·리본(정면) ──
const idle = new Anim("idle", "0:21", 300, "loop");
{
  const b = 180;
  idle.key(g("front", "eyes-open"), "scaleY", [[0, 1], [b, 1, "linear"], [b + 4, 0.15], [b + 14, 0.15, "linear"], [b + 18, 1], [300, 1]]);
  idle.key(g("front", "eyes-open"), "opacity", [[0, 1], [b + 4, 0], [b + 14, 1], [300, 1]]);
  idle.key(g("front", "eyes-closed"), "opacity", [[0, 0], [b + 4, 1], [b + 14, 0], [300, 0]]);
  idle.key(g("front", "body"), "scaleY", [[0, 1, "easeInOut"], [150, 1.015, "easeInOut"], [300, 1]]);
  idle.key(g("front", "tail"), "rotation", [[0, 0, "easeInOut"], [75, 0.07, "easeInOut"], [150, 0, "easeInOut"], [225, -0.056, "easeInOut"], [300, 0]]);
  idle.key(g("front", "bow"), "rotation", [[0, 0], [60, 0, "easeInOut"], [75, 0.07, "easeInOut"], [90, -0.05, "easeInOut"], [105, 0.02, "easeInOut"], [120, 0], [300, 0]]);
}

// ── press: 250ms(15프레임). 웃는 눈, 머리 6° 갸웃, 바닥 기준 납작 ──
function pressLike(anim, hop) {
  anim.key(g("front", "eyes-happy"), "opacity", [[0, 1], [13, 0], [15, 0]]);
  anim.key(g("front", "eyes-open"), "opacity", [[0, 0], [13, 1], [15, 1]]);
  anim.key(g("front", "head"), "rotation", [[0, 0, "easeOut"], [6, 6 * DEG, "easeOut"], [15, 0]]);
  anim.key(RIG, "scaleY", [[0, 1, "easeOut"], [6, 0.95, "easeOut"], [15, 1]]);
  anim.key(RIG, "scaleX", [[0, 1, "easeOut"], [6, 1.03, "easeOut"], [15, 1]]);
  // 잠에서 깰 때만: 정면 앉음으로 바로 바꾸고 살짝 튀어 오른다(200ms 안)
  if (hop) anim.key(RIG, "y", [[0, FLOOR, "easeOut"], [5, FLOOR - 4, "easeIn"], [11, FLOOR], [15, FLOOR]]);
  return anim;
}
const press = pressLike(new Anim("press", "0:22", 15, "oneShot"), false);
const wake = pressLike(new Anim("wake", "0:25", 15, "oneShot"), true);

// ── sleepEnter: 졸기 → 3/4 → 기우는 중간 → 누움(정점 보간) ──
const sleepEnter = new Anim("sleepEnter", "0:23", 150, "oneShot");
const morphTracks = (anim, from, to, startValues = null) => {
  // lie 뷰의 정점·타원·그룹을 기우는 중간(lie-mid, 저작 값) → 누움으로
  const target = new Map(lieTarget.parts.map((p) => [`${p.shape}|${p.contour}|${p.vertex ?? "e"}|${p.kind}`, p]));
  const unwrap = (prev, value) => {
    let v = value;
    while (v - prev > Math.PI) v -= 2 * Math.PI;
    while (v - prev < -Math.PI) v += 2 * Math.PI;
    return r4(v);
  };
  for (const p of view.lie.parts) {
    const q = target.get(`${p.shape}|${p.contour}|${p.vertex ?? "e"}|${p.kind}`);
    if (!q) throw new Error(`누움에 없는 정점: ${p.shape}`);
    if (p.kind === "ellipse") {
      for (const prop of ["x", "y", "width", "height"]) if (p[prop] !== q[prop]) anim.key(p.id, prop, [[from, p[prop], "easeOut"], [to, q[prop]]]);
      continue;
    }
    if (p.x !== q.x) anim.key(p.id, "vx", [[from, p.x, "easeOut"], [to, q.x]]);
    if (p.y !== q.y) anim.key(p.id, "vy", [[from, p.y, "easeOut"], [to, q.y]]);
    for (const side of ["in", "out"]) {
      const d0 = p[`${side}Distance`], d1 = q[`${side}Distance`];
      // 거리 0인 핸들은 각도가 의미 없다: 다른 쪽 각도를 쓴다(0도도 정상 각도다)
      const a0 = d0 !== 0 ? p[`${side}Rotation`] : q[`${side}Rotation`];
      const a1 = d1 !== 0 ? q[`${side}Rotation`] : a0;
      if (d0 !== d1) anim.key(p.id, `${side}Distance`, [[from, d0, "easeOut"], [to, d1]]);
      const b1 = unwrap(a0, a1);
      if (a0 !== b1 || d0 !== d1) anim.key(p.id, `${side}Rotation`, [[from, a0, "easeOut"], [to, b1]]);
    }
  }
  for (const [name, id] of Object.entries(view.lie.ids)) {
    if (name === "cat") continue;
    const a = view.lie.groups[name], b = lieGroups[name];
    for (const prop of ["x", "y", "rotation"]) {
      const start = startValues?.[name]?.[prop];
      if (a[prop] !== b[prop] || start !== undefined) anim.key(id, prop, [...(start ? start : []), [from, a[prop], "easeOut"], [to, b[prop]]]);
    }
    if (a.opacity !== b.opacity) anim.key(id, "opacity", [[from, a.opacity], [to, b.opacity]]);
  }
};
{
  // 0~90 졸기(정면): 눈 세로 40%로 반쯤, 머리 3px 꾸벅 두 번(회전 없이 아래로)
  showViews(sleepEnter, [[0, "front"], [90, "q34"], [99, "lie"]]);
  sleepEnter.key(g("front", "eyes-open"), "scaleY", [[0, 1, "easeOut"], [10, 0.4], [90, 0.4]]);
  const hy = base("front", "head").y;
  sleepEnter.key(g("front", "head"), "y", [[0, hy, "easeInOut"], [20, hy + 3, "easeInOut"], [35, hy, "easeInOut"], [60, hy + 3, "easeInOut"], [75, hy]]);
  // 90~99 3/4: 머리를 살짝 숙이며 돌아섬
  const qy = base("q34", "head").y;
  sleepEnter.key(g("q34", "head"), "y", [[0, qy], [90, qy, "easeOut"], [99, qy + 2]]);
  // 99~114 기우는 중간: 머리 0 → 10°, 꼬리 0 → −15°(저작 값) 보간, 눈은 감김
  // 114~150 기우는 중간 → 누움 정점 보간 600ms ease-out. 꼬리는 몸 앞에 거의 다 왔을 때(141f) 앞으로 그린다
  morphTracks(sleepEnter, 114, 150, {
    head: { rotation: [[0, 0], [99, 0, "easeOut"]] },
    tail: { rotation: [[0, 0], [99, 0, "easeOut"]] },
  });
  sleepEnter.key(DRAW.rules, "drawTarget", [[0, DRAW.behind], [141, DRAW.front]]);
}

// ── sleep: 숨쉬기 4초, 머리 1px, 꼬리 끝 가끔 ±6°, 리본 정지(12초 반복) ──
const sleep = new Anim("sleep", "0:24", 720, "loop");
{
  showViews(sleep, [[0, "lie"]]);
  sleep.key(DRAW.rules, "drawTarget", [[0, DRAW.front]]);
  const body = g("lie", "body"), head = g("lie", "head"), tail = g("lie", "tail");
  const hy = lieGroups.head.y;
  const breathe = [], nod = [];
  for (let c = 0; c < 3; c++) {
    breathe.push([c * 240, 1, "easeInOut"], [c * 240 + 120, 1.02, "easeInOut"]);
    nod.push([c * 240, hy, "easeInOut"], [c * 240 + 120, hy - 1, "easeInOut"]);
  }
  sleep.key(body, "scaleY", [...breathe, [720, 1]]);
  sleep.key(head, "y", [...nod, [720, hy]]);
  const tr = lieGroups.tail.rotation;
  sleep.key(tail, "rotation", [[0, tr], [590, tr, "easeInOut"], [605, tr + 6 * DEG, "easeInOut"], [620, tr - 6 * DEG, "easeInOut"], [640, tr]]);
}

finalize([greet, idle, press, wake, sleepEnter, sleep]);

// ── 상태 머신 ──
const trigger = `<TransitionViewModelCondition>
                            <TransitionPropertyViewModelComparator>
                                <BindablePropertyTrigger>
                                    <DataBindContext sourcePathIds="0:50-0:52" propertyKey="686"/>
                                </BindablePropertyTrigger>
                            </TransitionPropertyViewModelComparator>
                            <TransitionValueTriggerComparator/>
                        </TransitionViewModelCondition>`;
const onPress = (to) => `<StateTransition stateToId="${to}">\n                        ${trigger}\n                    </StateTransition>`;
const whenDone = (to) => `<StateTransition stateToId="${to}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`;
const S = { greet: "0:12", idle: "0:13", press: "0:14", sleepEnter: "0:15", sleep: "0:16", wake: "0:17" };
const stateMachine = `        <StateMachine name="State Machine 1" id="0:7">
            <StateMachineLayer name="Character" id="0:8">
                <AnyState x="200" y="-160"/>
                <ExitState x="800" y="-160"/>
                <EntryState x="0" y="0">
                    <StateTransition stateToId="${S.greet}"/>
                </EntryState>
                <!-- greet: 들어올 때 1회(폴짝 돌기) → idle -->
                <AnimationState x="200" y="0" animationId="${greet.id}" stateName="greet" id="${S.greet}">
                    ${whenDone(S.idle)}
                    ${onPress(S.press)}
                </AnimationState>
                <!-- idle: 무입력 10초(exitTime ms)면 sleepEnter. 다시 들어올 때마다 처음부터(reset) -->
                <AnimationState x="400" y="0" animationId="${idle.id}" reset="true" stateName="idle" id="${S.idle}">
                    <StateTransition stateToId="${S.sleepEnter}" enableExitTime="true" exitTime="10000"/>
                    ${onPress(S.press)}
                </AnimationState>
                <!-- press: 250ms → idle -->
                <AnimationState x="400" y="-160" animationId="${press.id}" reset="true" stateName="press" id="${S.press}">
                    ${whenDone(S.idle)}
                </AnimationState>
                <!-- sleep: 졸기 → 눕기 → 잠(반복). 누르면 wake(정면 앉음으로 튀어 오름) -->
                <AnimationState x="600" y="0" animationId="${sleepEnter.id}" reset="true" stateName="sleepEnter" id="${S.sleepEnter}">
                    ${whenDone(S.sleep)}
                    ${onPress(S.wake)}
                </AnimationState>
                <AnimationState x="800" y="0" animationId="${sleep.id}" stateName="sleep" id="${S.sleep}">
                    ${onPress(S.wake)}
                </AnimationState>
                <AnimationState x="600" y="-160" animationId="${wake.id}" reset="true" stateName="wake" id="${S.wake}">
                    ${whenDone(S.idle)}
                </AnimationState>
            </StateMachineLayer>
        </StateMachine>`;

const views = Object.values(view).map((v) => v.body).reverse().join("\n");
const artboard = `<!-- rive-cat:begin (scripts/rive-cat-scene.mjs가 만든다. 손으로 고치지 않는다) -->
    <Artboard viewModelId="0:50" viewModelInstanceId="0:51" defaultStateMachineId="0:7" x="0" y="0" styleId="0:5" width="120" height="120" name="nyang-cat" id="0:2">
        <LayoutComponentStyle name="Artboard Style" id="0:5"/>

        <!-- 도형: docs/design/assets/characters/nyang-cat{,-34,-side,-back,-lie-mid}.svg를 scripts/svg-to-rml.mjs로(누움은 lie-mid에 정점 id) -->
        <Node x="60" y="${FLOOR}" name="rig" id="${RIG}">
            <Node x="0" y="0" name="flip" id="${FLIP}">
${views}
            </Node>
        </Node>

${stateMachine}

${[greet, idle, press, wake, sleepEnter, sleep].map((a) => a.xml()).join("\n\n")}
    </Artboard>
    <!-- rive-cat:end -->`;

let scene = readFileSync(SCENE, "utf8");
const begin = scene.indexOf("<!-- rive-cat:begin");
const end = scene.indexOf("<!-- rive-cat:end -->");
if (begin >= 0 && end > begin) {
  scene = scene.slice(0, begin) + artboard + scene.slice(end + "<!-- rive-cat:end -->".length);
} else {
  // 처음 한 번: 기존 고양이 아트보드를 표시로 감싼 새 블록으로 바꾼다
  const from = scene.indexOf(`    <Artboard viewModelId="0:50" viewModelInstanceId="0:51" defaultStateMachineId="0:7"`);
  const to = scene.indexOf("    </Artboard>", from) + "    </Artboard>".length;
  if (from < 0 || to < from) throw new Error("고양이 아트보드를 찾지 못했다");
  scene = scene.slice(0, from) + "    " + artboard + scene.slice(to);
}
writeFileSync(SCENE, scene);
console.log(`nyang-cat: views ${Object.keys(VIEWS).join(", ")}, morph parts ${view.lie.parts.length}, animations ${[greet, idle, press, wake, sleepEnter, sleep].map((a) => `${a.name}(${a.duration}f, ${a.tracks.size})`).join(" ")}`);
