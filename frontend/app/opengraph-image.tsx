import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 15% 15%, rgba(16,185,129,0.25), transparent 45%), radial-gradient(circle at 85% 85%, rgba(16,185,129,0.15), transparent 45%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#10b981",
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 28,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#10b981" }} />
          TrueDemo
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.15,
            maxWidth: 980,
          }}
        >
          Every other tool guesses what your product does.
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: "#10b981",
            lineHeight: 1.15,
            marginTop: 6,
          }}
        >
          TrueDemo reads your code and gets it right.
        </div>
      </div>
    ),
    { ...size }
  );
}
