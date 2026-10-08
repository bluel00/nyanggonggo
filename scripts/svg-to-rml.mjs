#!/usr/bin/env node
/**
 * 캐릭터 SVG → Rive RML 도형 변환기(docs/design/characters.md, architecture.md 12절 47).
 *
 * Rive CLI에는 SVG 가져오기가 없어서(`rive docs assets`: SVG는 편집기에서만 도형으로 바뀐다) path를 RML 정점으로 옮긴다.
 *
 * 사용법
 *   node scripts/svg-to-rml.mjs <svg> --id-base=<n>                       도형 조각을 표준 출력으로
 *   node scripts/svg-to-rml.mjs <svg> --id-base=<n> --replace=<scene.rml> --marker=<이름>
 *       scene.rml 안의 `<!-- svg-to-rml:begin <이름> -->` ~ `<!-- svg-to-rml:end <이름> -->` 사이만 바꾼다
 *       (애니메이션과 상태 머신은 손으로 쓴 그대로 둔다)
 *   그룹 이름 → id 표는 표준 오류로 출력한다. 애니메이션의 KeyedObject objectId가 이 id를 쓴다.
 *
 * 옮기는 규칙
 *   - <g id transform="translate(x y)"> → <Node name=id x y id="0:n">. translate가 곧 회전 기준점이다.
 *     opacity가 있으면 그대로 둔다(eyes-closed·eyes-happy의 0).
 *   - <path> 하나 → <Shape name=id>. 하위 경로(M마다)는 PointsPath 하나씩, fill → Fill, stroke → Stroke(굵기·cap·join).
 *   - 그리기 순서를 뒤집는다: SVG는 나중에 쓴 것이 위, RML은 먼저 쓴 형제가 위다. 한 Shape 안에서는 Fill 다음 Stroke
 *     (나중에 쓴 페인트가 위라 SVG와 같다).
 *   - 곡선 핸들은 정점 기준 극좌표다(각도는 라디안, y는 아래로). 2차 곡선(Q)은 3차로 바꾼다.
 *   - 감김 방향(isClockwise)은 정점 순서의 부호 있는 넓이로 계산한다.
 *
 * 한계(이 저장소의 캐릭터 SVG에 필요한 것만 다룬다)
 *   - 요소: svg, g, path뿐. rect·circle·ellipse·polygon·use·defs·gradient·mask·clipPath·text는 없다(characters.md가 금지).
 *   - transform: translate만. rotate·scale·matrix는 없다.
 *   - path 명령: M m L l H V C c Q q Z z. 호(a)는 "a rx ry 0 1 0 2rx 0 a rx ry 0 1 0 -2rx 0" 꼴의 타원 한 쌍만
 *     Ellipse로 바꾼다. S T A h v와 일반 호는 지원하지 않는다(만나면 오류로 멈춘다).
 *   - 속성: fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, opacity(g). 색은 #RRGGBB.
 */
import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const [svgPath, ...rest] = argv;
  const options = Object.fromEntries(
    rest.map((arg) => {
      const match = /^--([\w-]+)=(.*)$/.exec(arg);
      if (!match) throw new Error(`알 수 없는 인자: ${arg}`);
      return [match[1], match[2]];
    }),
  );
  if (!svgPath || options["id-base"] === undefined) {
    throw new Error("사용법: node scripts/svg-to-rml.mjs <svg> --id-base=<n> [--replace=<scene.rml> --marker=<이름>]");
  }
  if (options.replace && !options.marker) throw new Error("--replace에는 --marker가 필요하다");
  return { svgPath, idBase: Number(options["id-base"]), replace: options.replace, marker: options.marker };
}

// ── 아주 작은 SVG 파서(g, path만) ──
function parseAttrs(source) {
  const out = {};
  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) out[match[1]] = match[2];
  return out;
}

function parseTree(source) {
  const root = { tag: "root", attrs: {}, children: [] };
  const stack = [root];
  for (const match of source.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g)) {
    const [, close, tag, rest, self] = match;
    if (!["svg", "g", "path"].includes(tag)) throw new Error(`지원하지 않는 요소: <${tag}>`);
    if (close) {
      stack.pop();
      continue;
    }
    const node = { tag, attrs: parseAttrs(rest), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!self) stack.push(node);
  }
  return root;
}

// ── path d → 윤곽 목록 ──
const isCommand = (token) => /^[a-zA-Z]$/.test(token);

function parsePath(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let index = 0;
  let command = null;
  let current = [0, 0];
  let start = [0, 0];
  let contour = null;
  const contours = [];
  const num = () => parseFloat(tokens[index++]);

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    switch (command) {
      case "M":
      case "m": {
        const x = num();
        const y = num();
        current = command === "m" ? [current[0] + x, current[1] + y] : [x, y];
        start = current.slice();
        contour = { closed: false, start: current.slice(), segs: [] };
        contours.push(contour);
        command = command === "m" ? "l" : "L"; // 이어지는 좌표쌍은 선이다
        break;
      }
      case "L":
      case "l": {
        const x = num();
        const y = num();
        const p = command === "l" ? [current[0] + x, current[1] + y] : [x, y];
        contour.segs.push({ type: "L", p });
        current = p;
        break;
      }
      case "H": {
        const p = [num(), current[1]];
        contour.segs.push({ type: "L", p });
        current = p;
        break;
      }
      case "V": {
        const p = [current[0], num()];
        contour.segs.push({ type: "L", p });
        current = p;
        break;
      }
      case "C":
      case "c": {
        const v = [num(), num(), num(), num(), num(), num()];
        const o = command === "c" ? current : [0, 0];
        const c1 = [o[0] + v[0], o[1] + v[1]];
        const c2 = [o[0] + v[2], o[1] + v[3]];
        const p = [o[0] + v[4], o[1] + v[5]];
        contour.segs.push({ type: "C", c1, c2, p });
        current = p;
        break;
      }
      case "Q":
      case "q": {
        const v = [num(), num(), num(), num()];
        const o = command === "q" ? current : [0, 0];
        const q = [o[0] + v[0], o[1] + v[1]];
        const p = [o[0] + v[2], o[1] + v[3]];
        // 2차 → 3차: c1 = p0 + 2/3(q - p0), c2 = p + 2/3(q - p)
        const c1 = [current[0] + (2 / 3) * (q[0] - current[0]), current[1] + (2 / 3) * (q[1] - current[1])];
        const c2 = [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
        contour.segs.push({ type: "C", c1, c2, p });
        current = p;
        break;
      }
      case "a": {
        const rx = num();
        const ry = num();
        const rotation = num();
        num(); // large-arc
        num(); // sweep
        const dx = num();
        const dy = num();
        if (dy !== 0 || rotation !== 0 || Math.abs(Math.abs(dx) - rx * 2) > 1e-6) {
          throw new Error(`지원하지 않는 호: ${d}`);
        }
        contour.ellipse ??= { cx: current[0] + dx / 2, cy: current[1], rx, ry };
        current = [current[0] + dx, current[1] + dy];
        break;
      }
      case "Z":
      case "z":
        contour.closed = true;
        current = start.slice();
        break;
      default:
        throw new Error(`지원하지 않는 path 명령: ${command}`);
    }
  }
  return contours;
}

// ── 윤곽 → RML 정점 ──
const round = (n) => +n.toFixed(4);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const angle = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
const samePoint = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

function contourVertices(contour) {
  // 정점은 시작점과 각 세그먼트의 끝점. in 핸들은 들어오는 세그먼트의 c2, out 핸들은 나가는 세그먼트의 c1
  const points = [contour.start, ...contour.segs.map((seg) => seg.p)];
  const vertices = points.map((p) => ({ p, in: null, out: null }));
  contour.segs.forEach((seg, k) => {
    if (seg.type !== "C") return;
    vertices[k].out = seg.c1;
    vertices[k + 1].in = seg.c2;
  });
  // 닫힌 윤곽의 끝점이 시작점과 같으면 합친다(시작점이 마지막 세그먼트의 in 핸들을 갖는다)
  if (contour.closed && vertices.length > 1 && samePoint(vertices[vertices.length - 1].p, vertices[0].p)) {
    vertices[0].in = vertices.pop().in;
  }
  return vertices;
}

function signedArea(vertices) {
  let area = 0;
  for (let k = 0; k < vertices.length; k++) {
    const [x1, y1] = vertices[k].p;
    const [x2, y2] = vertices[(k + 1) % vertices.length].p;
    area += x1 * y2 - x2 * y1;
  }
  return area; // y가 아래로 자라는 좌표에서 양수면 시계 방향
}

function vertexXml(vertex, indent) {
  const [x, y] = vertex.p;
  const hasIn = vertex.in && dist(vertex.p, vertex.in) > 1e-6;
  const hasOut = vertex.out && dist(vertex.p, vertex.out) > 1e-6;
  if (!hasIn && !hasOut) return `${indent}<StraightVertex x="${round(x)}" y="${round(y)}"/>`;
  const attrs = [`x="${round(x)}"`, `y="${round(y)}"`];
  if (hasIn) attrs.push(`inRotation="${round(angle(vertex.p, vertex.in))}"`, `inDistance="${round(dist(vertex.p, vertex.in))}"`);
  if (hasOut) attrs.push(`outRotation="${round(angle(vertex.p, vertex.out))}"`, `outDistance="${round(dist(vertex.p, vertex.out))}"`);
  return `${indent}<CubicDetachedVertex ${attrs.join(" ")}/>`;
}

function color(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`지원하지 않는 색: ${hex}`);
  return `FF${hex.slice(1).toUpperCase()}`;
}

function createConverter(idBase) {
  const ids = {};
  let nextId = idBase;
  let unnamed = 0;

  function pathShape(node, indent) {
    const attrs = node.attrs;
    const inner = `${indent}    `;
    const lines = [`${indent}<Shape name="${attrs.id ?? `path-${++unnamed}`}">`];
    for (const contour of parsePath(attrs.d)) {
      if (contour.ellipse) {
        const e = contour.ellipse;
        lines.push(
          `${inner}<Ellipse x="${round(e.cx)}" y="${round(e.cy)}" width="${round(e.rx * 2)}" height="${round(e.ry * 2)}" originX="0.5" originY="0.5" name="Path"/>`,
        );
        continue;
      }
      const vertices = contourVertices(contour);
      const clockwise = contour.closed ? signedArea(vertices) > 0 : true;
      lines.push(`${inner}<PointsPath isClosed="${contour.closed}" isClockwise="${clockwise}" name="Path">`);
      for (const vertex of vertices) lines.push(vertexXml(vertex, `${inner}    `));
      lines.push(`${inner}</PointsPath>`);
    }
    if (attrs.fill && attrs.fill !== "none") {
      lines.push(`${inner}<Fill name="Fill"><SolidColor colorValue="${color(attrs.fill)}" name="Color"/></Fill>`);
    }
    if (attrs.stroke) {
      const cap = attrs["stroke-linecap"] ?? "butt";
      const join = attrs["stroke-linejoin"] ?? "miter";
      lines.push(
        `${inner}<Stroke thickness="${attrs["stroke-width"] ?? 1}" cap="${cap}" join="${join}" name="Stroke"><SolidColor colorValue="${color(attrs.stroke)}" name="Color"/></Stroke>`,
      );
    }
    lines.push(`${indent}</Shape>`);
    return lines.join("\n");
  }

  function groupXml(node, indent) {
    const attrs = node.attrs;
    const transform = attrs.transform ?? "";
    const match = /^\s*translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)\s*$/.exec(transform);
    if (transform && !match) throw new Error(`지원하지 않는 transform: ${transform}`);
    const [x, y] = match ? [parseFloat(match[1]), parseFloat(match[2])] : [0, 0];
    const name = attrs.id ?? `group-${nextId}`;
    const id = `0:${nextId++}`;
    ids[name] = id;
    const opacity = attrs.opacity !== undefined ? ` opacity="${attrs.opacity}"` : "";
    const lines = [`${indent}<Node x="${x}" y="${y}"${opacity} name="${name}" id="${id}">`];
    for (const child of [...node.children].reverse()) lines.push(childXml(child, `${indent}    `));
    lines.push(`${indent}</Node>`);
    return lines.join("\n");
  }

  function childXml(node, indent) {
    return node.tag === "g" ? groupXml(node, indent) : pathShape(node, indent);
  }

  return {
    convert(svgSource, indent) {
      const svg = parseTree(svgSource).children[0];
      if (svg?.tag !== "svg") throw new Error("svg 루트가 없다");
      const body = [...svg.children].reverse().map((child) => childXml(child, indent)).join("\n");
      return { body, ids };
    },
  };
}

const { svgPath, idBase, replace, marker } = parseArgs(process.argv.slice(2));
const INDENT = "        ";
const { body, ids } = createConverter(idBase).convert(readFileSync(svgPath, "utf8"), INDENT);

if (replace) {
  const scene = readFileSync(replace, "utf8");
  const begin = `<!-- svg-to-rml:begin ${marker} -->`;
  const end = `<!-- svg-to-rml:end ${marker} -->`;
  const from = scene.indexOf(begin);
  const to = scene.indexOf(end);
  if (from < 0 || to < from) throw new Error(`${replace}에 ${begin} ~ ${end} 표시가 없다`);
  const next = `${scene.slice(0, from + begin.length)}\n${body}\n${INDENT}${scene.slice(to)}`;
  writeFileSync(replace, next);
} else {
  process.stdout.write(`${body}\n`);
}
process.stderr.write(`${JSON.stringify(ids, null, 2)}\n`);
