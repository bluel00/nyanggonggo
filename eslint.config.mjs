import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 경계 규칙 (docs/architecture.md 3절). alias(@/)와 상위 상대경로(../) 모두 막는다.
const layerImport = (layers) => [
  { regex: `^@/(${layers})(/.*)?$` },
  { regex: `^(\.\./)+(${layers})(/.*)?$` },
];

const FSD_FOR_SERVER = "entities|features|widgets|views|shared/ui";
const SERVER = "server";
/** 위(views)에서 아래(shared) 순서 */
const FSD_LAYERS = ["views", "widgets", "features", "entities", "shared"];
/** slice로 나뉘는 계층. shared는 slice가 없고 파일 하나가 공개 API다(barrel을 두지 않는다) */
const SLICE_LAYERS = ["views", "widgets", "features", "entities"];
const TEST_FILES = ["**/*.test.ts", "**/*.test.tsx"];

const slicesOf = (layer) =>
  readdirSync(new URL(`./src/${layer}`, import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

/** 다른 slice를 공개 API(slice의 index.ts)를 거치지 않고 가져온다. own은 자기 slice(안에서는 상대경로로 가져온다) */
const deepImport = (own) => ({
  regex: `^@/(${SLICE_LAYERS.join("|")})/${own ? `(?!${own}/)` : ""}[^/]+/.+$`,
  message: "다른 slice는 공개 API(slice의 index.ts)로만 import한다(테스트 파일은 예외).",
});

/**
 * FSD 계층의 import 규칙. 같은 파일에 no-restricted-imports를 두 번 걸면 나중 설정이 덮어쓰므로 파일 묶음마다 한 번에 합친다.
 * - src/server 금지, 계층 방향(views → widgets → features → entities → shared, 아래로만): 테스트에도 적용
 * - 같은 계층의 다른 slice import 금지: 테스트에도 적용
 * - 다른 slice는 공개 API(index)로만: app 계층에도 적용하고 테스트 파일은 뺀다
 */
function fsdConfigs() {
  const restrict = (patterns) => ({ "no-restricted-imports": ["error", { patterns }] });
  const layerRules = (layer) => {
    const upper = FSD_LAYERS.slice(0, FSD_LAYERS.indexOf(layer));
    return [
      ...layerImport(SERVER).map((p) => ({
        ...p,
        message: "FSD 계층은 src/server를 import하지 않는다. 공유는 src/contract만.",
      })),
      ...(upper.length
        ? layerImport(upper.join("|")).map((p) => ({
            ...p,
            message: `FSD 계층 방향 위반: ${layer}는 ${upper.join(", ")}를 import하지 않는다(views → widgets → features → entities → shared).`,
          }))
        : []),
    ];
  };
  const sliceRules = (layer, slice, others) => {
    const message = `같은 계층의 다른 slice를 import하지 않는다(${layer}/${slice}).`;
    return [
      { regex: `^@/${layer}/(?!${slice}(/|$))`, message },
      ...(others.length ? [{ regex: `^(\\.\\./)+(${layer}/)?(${others.join("|")})(/|$)`, message }] : []),
    ];
  };

  return [
    { files: ["src/app/**"], ignores: TEST_FILES, rules: restrict([deepImport(null)]) },
    { files: ["src/shared/**"], rules: restrict(layerRules("shared")) },
    ...SLICE_LAYERS.flatMap((layer) => {
      const slices = slicesOf(layer);
      return slices.flatMap((slice) => {
        const files = [`src/${layer}/${slice}/**`];
        const patterns = [...layerRules(layer), ...sliceRules(layer, slice, slices.filter((s) => s !== slice))];
        return [
          { files, rules: restrict(patterns) },
          { files, ignores: TEST_FILES, rules: restrict([...patterns, deepImport(slice)]) },
        ];
      });
    }),
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 구조 분해로 필드를 빼낼 때 쓰는 _ 접두어 변수는 허용한다.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ["src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: layerImport(FSD_FOR_SERVER).map((p) => ({
            ...p,
            message: "src/server는 FSD 계층을 import하지 않는다. 공유는 src/contract만.",
          })),
        },
      ],
    },
  },
  ...fsdConfigs(),
  {
    files: ["src/contract/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: layerImport(`${SERVER}|${FSD_FOR_SERVER}|shared`).map((p) => ({
            ...p,
            message: "src/contract는 서버와 FSD 계층 어느 쪽도 import하지 않는다.",
          })),
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 프리뷰 번들과 명세 문서는 앱 코드가 아니다.
    "docs/**",
  ]),
]);

export default eslintConfig;
