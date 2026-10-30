/**
 * SVG 안쪽을 여닫는 태그의 차례로 편다. 속성은 이름순이고 id는 뺀다. 원본 SVG 파일과 앱의 인라인 SVG(React가 그린 마크업)를
 * 그림(요소, 순서, 모양, 색)으로 비교할 때 쓴다(캐릭터·로고 일치 테스트).
 * wrapperAttr를 주면 그 속성이 있는 감싼 그룹(예: 로딩 캐릭터의 data-loading-motion)은 여닫는 태그를 함께 뺀다.
 */
export function drawingTags(svg: string, wrapperAttr?: string): string[] {
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
  const tags: string[] = [];
  // 열린 g마다 감싼 그룹인지(닫는 태그를 뺄지)
  const wrappers: boolean[] = [];
  for (const [, close, name, rawAttrs, selfClose] of inner.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    if (close) {
      if (!wrappers.pop()) tags.push(`</${name}>`);
      continue;
    }
    const attrs = [...rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)].filter(([, key]) => key !== "id");
    const wrapper = wrapperAttr !== undefined && attrs.some(([, key]) => key === wrapperAttr);
    if (!wrapper) tags.push(`<${name} ${attrs.map(([, key, value]) => `${key}="${value}"`).sort().join(" ")}>`);
    if (selfClose) {
      if (!wrapper) tags.push(`</${name}>`);
    } else {
      wrappers.push(wrapper);
    }
  }
  return tags;
}
