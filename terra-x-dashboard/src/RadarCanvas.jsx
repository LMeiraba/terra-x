import { useEffect, useRef } from "react";

// ── Radar Canvas ──────────────────────────────────────────────────────────
// Draws a sonar-style polar obstacle map from sweep angle + distance data.
// Props:
//   readings  — array of { angle: 0-180, distance: 0-300 } (cm)
//   maxRange  — max range in cm to display (default 200)
//   sweepAngle — current live sweep angle (draws the sweep line)

const MAX_RANGE_DEFAULT = 200;
const FADE_STEPS = 180; // readings to keep before fading

export function RadarCanvas({ readings = [], sweepAngle = null, maxRange = MAX_RANGE_DEFAULT }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(cx, cy) - 10; // radius of radar display

    ctx.clearRect(0, 0, W, H);

    // ── Background ──────────────────────────────────────────────────────
    ctx.fillStyle = "#0a0f14";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // ── Grid — concentric range rings ───────────────────────────────────
    const rings = [0.25, 0.5, 0.75, 1.0];
    rings.forEach(fraction => {
      ctx.beginPath();
      ctx.arc(cx, cy, R * fraction, 0, Math.PI * 2);
      ctx.strokeStyle = "#1f6feb22";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Range label
      const labelR = Math.round(maxRange * fraction);
      ctx.fillStyle = "#1f6feb55";
      ctx.font = "9px monospace";
      ctx.fillText(`${labelR}cm`, cx + R * fraction + 2, cy - 2);
    });

    // ── Angle spokes (every 30°) ────────────────────────────────────────
    for (let deg = 0; deg <= 180; deg += 30) {
      const rad = (deg - 180) * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(rad), cy + R * Math.sin(rad));
      ctx.strokeStyle = "#1f6feb18";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Angle label
      ctx.fillStyle = "#1f6feb55";
      ctx.font = "9px monospace";
      ctx.fillText(`${deg}°`, cx + (R + 8) * Math.cos(rad) - 8, cy + (R + 8) * Math.sin(rad) + 4);
    }

    // ── Obstacle dots ────────────────────────────────────────────────────
    const total = readings.length;
    readings.forEach((r, i) => {
      if (r.distance > maxRange) return;
      const alpha = 0.2 + 0.8 * (i / total); // newer = more opaque
      const rad = (r.angle - 180) * (Math.PI / 180); // 0° = left, 90° = front, 180° = right
      const px = cx + (r.distance / maxRange) * R * Math.cos(rad);
      const py = cy + (r.distance / maxRange) * R * Math.sin(rad);

      // Glow
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 6);
      grd.addColorStop(0, `rgba(0,255,136,${alpha})`);
      grd.addColorStop(1, `rgba(0,255,136,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = `rgba(0,255,136,${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Sweep line ────────────────────────────────────────────────────────
    if (sweepAngle !== null) {
      const rad = (sweepAngle - 180) * (Math.PI / 180);
      const grd = ctx.createLinearGradient(cx, cy, cx + R * Math.cos(rad), cy + R * Math.sin(rad));
      grd.addColorStop(0, "rgba(0,255,136,0.4)");
      grd.addColorStop(1, "rgba(0,255,136,0)");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(rad), cy + R * Math.sin(rad));
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sweep arc (fan behind the line)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, (sweepAngle - 30 - 180) * (Math.PI / 180), (sweepAngle - 180) * (Math.PI / 180));
      ctx.closePath();
      ctx.fillStyle = "rgba(0,255,136,0.04)";
      ctx.fill();
    }

    // ── Rover dot ─────────────────────────────────────────────────────────
    ctx.fillStyle = "#58a6ff";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#58a6ff44";
    ctx.lineWidth = 8;
    ctx.stroke();

    // ── Border ────────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "#1f6feb44";
    ctx.lineWidth = 1.5;
    ctx.stroke();

  }, [readings, sweepAngle, maxRange]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
