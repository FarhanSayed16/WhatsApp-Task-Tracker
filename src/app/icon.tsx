import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0D9E5F",
          borderRadius: 112,
          color: "#FFFFFF",
          fontSize: 280,
          fontWeight: 800,
        }}
      >
        {"✓"}
      </div>
    ),
    { ...size }
  );
}
