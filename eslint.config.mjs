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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
  {
    files: ["src/{views,widgets,features,entities,shared}/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: layerImport(SERVER).map((p) => ({
            ...p,
            message: "FSD 계층은 src/server를 import하지 않는다. 공유는 src/contract만.",
          })),
        },
      ],
    },
  },
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
