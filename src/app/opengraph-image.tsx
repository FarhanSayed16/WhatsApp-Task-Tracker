import { ImageResponse } from "next/og";

export const alt = "TaskTracker — WhatsApp group checklists";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(145deg, #D7E4DC 0%, #EEF6F1 48%, #B8D9C6 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 36,
              background: "#0D9E5F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 64,
              fontWeight: 800,
            }}
          >
            {"✓"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 3,
                color: "#0D9E5F",
                textTransform: "uppercase",
              }}
            >
              TaskTracker
            </div>
            <div
              style={{
                fontSize: 54,
                fontWeight: 800,
                color: "#14241C",
                lineHeight: 1.1,
                marginTop: 6,
              }}
            >
              WhatsApp checklists
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: 28,
            color: "#3D5C4C",
            lineHeight: 1.35,
          }}
        >
          <div>Tap the link. Tick tasks. Live on the professor dashboard.</div>
          <div style={{ fontSize: 22, color: "#0D9E5F", fontWeight: 700 }}>
            No app install · No student login
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
