import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const alt = "ScoreFit — Science-based hypertrophy training";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#07090c",
          padding: "80px",
          fontFamily:
            "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#9ba4ad",
          }}
        >
          scorefit.net
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 36,
            fontSize: 180,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#eceff1",
          }}
        >
          Score
          <span style={{ color: "#ff6a3d" }}>Fit</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 44,
            fontWeight: 600,
            color: "#cdd2d8",
          }}
        >
          Science-based hypertrophy training
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            width: 220,
            height: 8,
            borderRadius: 9999,
            background: "#ff6a3d",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
