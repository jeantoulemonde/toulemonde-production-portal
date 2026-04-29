// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Icône Canvas pour le bouton flottant : 3 niveaux d'arcs SVG rotatifs
// concentriques + point central qui pulse. Aucune dépendance externe.

import { useEffect, useRef } from "react";

function draw(ctx, t) {
  const cx = 20, cy = 20;
  ctx.clearRect(0, 0, 40, 40);

  // Arc externe — sens horaire, lent
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.012);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.012 + Math.PI);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Arc intermédiaire — sens inverse, vitesse moyenne
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-t * 0.018);
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-t * 0.018 + Math.PI);
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Arc interne — rotation rapide
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.028);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.028 + Math.PI);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Point central qui pulse
  const pulse = 2.5 + Math.sin(t * 0.06) * 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
}

function ChatIcon() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = 40 * dpr;
    canvas.height = 40 * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    let t = 0;
    let raf = 0;
    function frame() {
      draw(ctx, t);
      t += 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 40, height: 40, display: "block" }}
      aria-hidden="true"
    />
  );
}

export default ChatIcon;
