import { ImageResponse } from "next/og";
import type { OgFont } from "@/server/og/og-assets";
import { SERVICE_NAME } from "@/shared/config/service";
import { OG_COLORS, type OgModel } from "./og-model";

/** OG 이미지 크기(1200x630, handoff 화면 7: 600x315 논리 레이아웃을 2배로) */
export const OG_SIZE = { width: 1200, height: 630 };

/**
 * OG 이미지를 그린다. model이 없으면(조회 실패, 잘못된 id) 서비스명만 있는 기본 이미지.
 * fonts가 비면 satori 기본 폰트로 그린다(한글이 빈 칸일 수 있다).
 */
export function renderOgImage(model: OgModel | null, photo: string | null, fonts: OgFont[], headers?: HeadersInit) {
  return new ImageResponse(model ? <AnimalCard model={model} photo={photo} /> : <Fallback />, {
    ...OG_SIZE,
    fonts: fonts.length ? fonts : undefined,
    headers,
  });
}

const FONT = "Pretendard";

function ServicePill() {
  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        left: 48,
        display: "flex",
        padding: "10px 24px",
        borderRadius: 999,
        background: OG_COLORS.photoPill,
        color: OG_COLORS.text,
        fontSize: 24,
        fontWeight: 700,
      }}
    >
      {SERVICE_NAME}
    </div>
  );
}

function AnimalCard({ model, photo }: { model: OgModel; photo: string | null }) {
  const status = OG_COLORS.status[model.variant];
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: OG_COLORS.canvas, fontFamily: FONT }}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- satori 전용 img
        <img
          src={photo}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 35%" }}
        />
      )}
      <ServicePill />
      <div
        style={{
          position: "absolute",
          left: 48,
          bottom: 48,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 760,
          padding: "28px 32px",
          borderRadius: 32,
          background: OG_COLORS.bg,
          color: OG_COLORS.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 48,
              padding: "0 20px 0 16px",
              borderRadius: 999,
              background: status.bg,
              color: status.text,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 999, background: status.dot }} />
            {model.badgeText}
          </div>
          {model.dDayText && <div style={{ fontSize: 40, fontWeight: 700, color: status.text }}>{model.dDayText}</div>}
        </div>
        <div style={{ fontSize: 40, fontWeight: 700 }}>{model.title}</div>
        {model.sub && <div style={{ fontSize: 28, fontWeight: 400, color: OG_COLORS.text2 }}>{model.sub}</div>}
      </div>
    </div>
  );
}

function Fallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        width: "100%",
        height: "100%",
        background: OG_COLORS.canvas,
        color: OG_COLORS.text,
        fontFamily: FONT,
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700 }}>{SERVICE_NAME}</div>
      <div style={{ fontSize: 32, fontWeight: 400, color: OG_COLORS.text2 }}>유기동물 공고</div>
    </div>
  );
}
