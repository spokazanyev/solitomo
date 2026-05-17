import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Солитон — российский производитель PDU и блоков розеток";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg,#0369a1 0%,#0c4a6e 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            fontWeight: 700,
            opacity: 0.85,
          }}
        >
          SOLITON
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1,
            }}
          >
            PDU и блоки розеток 19″ для серверных шкафов и ЦОД
          </div>
          <div style={{ fontSize: 26, opacity: 0.85 }}>
            Российский производитель · 66 моделей · 19+ лет · КП за 1 день
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
