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
  // FSD 계층: src/server 금지 + 계층 방향(views → widgets → features → entities → shared, 아래로만).
  // 같은 파일에 no-restricted-imports를 두 번 걸면 나중 설정이 덮어쓰므로 계층마다 한 번에 합친다.
  ...FSD_LAYERS.map((layer, index) => {
    const upper = FSD_LAYERS.slice(0, index);
    return {
      files: [`src/${layer}/**`],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
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
            ],
          },
        ],
      },
    };
  }),
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
