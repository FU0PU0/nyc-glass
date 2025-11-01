"use client";

import { useEffect, useState } from "react";

export type HoverInfo = { name: string; imageUrl?: string } | null;

export function HUDTooltip({ hoverInfo }: { hoverInfo: HoverInfo }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX + 16, y: e.clientY + 16 });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  if (!hoverInfo) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        pointerEvents: "none",
        zIndex: 40,
        transform: "translate3d(0,0,0)",
        maxWidth: 280,
      }}
    >
      <div
        style={{
          background: "rgba(10,16,24,0.72)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        {hoverInfo.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hoverInfo.imageUrl} alt={hoverInfo.name} style={{ width: "100%", height: 132, objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: 132, background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }} />
        )}
        <div style={{ padding: 12 }}>
          <div style={{ color: "#eaf2ff", fontWeight: 600, letterSpacing: 0.2 }}>{hoverInfo.name}</div>
          <div style={{ color: "#a7b5c6", fontSize: 12, marginTop: 4 }}>New York City</div>
        </div>
      </div>
    </div>
  );
}

export default HUDTooltip;

