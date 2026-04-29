// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Indicateur de typing : bulle bot contenant une bobine animée Canvas qui
// se remplit de fil de haut en bas, puis remonte (4 passes en boucle).
// Affiché à la place de "L'assistant écrit…" pendant que Léon génère.

import { useEffect, useRef } from "react";
import { T } from "../../frontend/src/theme";
import { chatStyles } from "./chatStyles";

const N_SPIRES = Math.floor(34 / 2.8); // 12
const FRAMES_PER_PASS = 100;
const PASSES = 4;
const TOTAL_FRAMES = FRAMES_PER_PASS * PASSES;

const WIND_TOP = 7;
const WIND_BOT = 41;
const GAP = 2.8;
const CX = 20;
const RX = 14;
const RY = RX * 0.18;

const BOBBIN_BLUE = "#0000FE";
const THREAD_FRONT = "rgba(245,235,215,0.85)";
const THREAD_BACK = "rgba(245,235,215,0.30)";
const THREAD_HEAD = "rgba(245,235,215,1)";

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function spireY(i, goingDown) {
  return goingDown
    ? WIND_TOP + i * GAP + GAP / 2
    : WIND_BOT - i * GAP - GAP / 2;
}

function drawCompleteSpire(ctx, y) {
  // Arc arrière (haut, pointillés)
  ctx.save();
  ctx.setLineDash([1, 1.5]);
  ctx.strokeStyle = THREAD_BACK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(CX, y, RX, RY, 0, Math.PI, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();
  // Arc avant (bas, plein)
  ctx.strokeStyle = THREAD_FRONT;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(CX, y, RX, RY, 0, 0, Math.PI);
  ctx.stroke();
}

function drawPartialSpire(ctx, y, partialProgress) {
  const angle = partialProgress * 2 * Math.PI;
  // angle ∈ [0, 2π] : sens horaire en partant de la droite (3h),
  // descend en avant jusqu'à 9h (π), remonte en arrière jusqu'à 3h (2π).
  if (angle <= Math.PI) {
    ctx.strokeStyle = THREAD_FRONT;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(CX, y, RX, RY, 0, 0, angle);
    ctx.stroke();
  } else {
    // Avant complet
    ctx.strokeStyle = THREAD_FRONT;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(CX, y, RX, RY, 0, 0, Math.PI);
    ctx.stroke();
    // Partie de l'arrière en pointillés
    ctx.save();
    ctx.setLineDash([1, 1.5]);
    ctx.strokeStyle = THREAD_BACK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(CX, y, RX, RY, 0, Math.PI, angle);
    ctx.stroke();
    ctx.restore();
  }
  // Tête du fil
  const hx = CX + RX * Math.cos(angle);
  const hy = y + RY * Math.sin(angle);
  ctx.beginPath();
  ctx.arc(hx, hy, 3, 0, Math.PI * 2);
  ctx.fillStyle = THREAD_HEAD;
  ctx.fill();
  // Reflet
  ctx.beginPath();
  ctx.arc(hx - 0.8, hy - 0.8, 1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
}

function drawBobbinStructure(ctx) {
  ctx.strokeStyle = BOBBIN_BLUE;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Flasque haut
  roundedRectPath(ctx, 2, 0, 36, 5, 2.5);
  ctx.stroke();
  // Flancs du corps
  ctx.beginPath();
  ctx.moveTo(8, 5);
  ctx.lineTo(4, 43);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(32, 5);
  ctx.lineTo(36, 43);
  ctx.stroke();
  // Flasque bas
  roundedRectPath(ctx, 2, 43, 36, 5, 2.5);
  ctx.stroke();
}

function draw(ctx, t) {
  ctx.clearRect(0, 0, 40, 48);

  const passIndex = Math.floor(t / FRAMES_PER_PASS);
  const passT = (t % FRAMES_PER_PASS) / FRAMES_PER_PASS;
  const goingDown = passIndex % 2 === 0;
  const totalProgress = passT * N_SPIRES;
  const filledCount = Math.floor(totalProgress);
  const partialProgress = totalProgress - filledCount;

  // A — Spires complètes
  for (let i = 0; i < filledCount; i++) {
    drawCompleteSpire(ctx, spireY(i, goingDown));
  }

  // B — Spire en cours
  if (filledCount < N_SPIRES) {
    drawPartialSpire(ctx, spireY(filledCount, goingDown), partialProgress);
  }

  // C — Structure bobine par dessus
  drawBobbinStructure(ctx);
}

function TypingIndicator() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = 40 * dpr;
    canvas.height = 48 * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    let t = 0;
    let raf = 0;
    function frame() {
      draw(ctx, t);
      t = (t + 1) % TOTAL_FRAMES;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ ...chatStyles.messageBase, ...chatStyles.messageAssistant, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 14px" }}>
      <canvas
        ref={canvasRef}
        style={{ width: 40, height: 48, display: "block" }}
        aria-hidden="true"
      />
      <span style={{
        fontFamily: T.fontDisplay,
        fontSize: 11,
        fontStyle: "italic",
        color: T.textSoft,
        letterSpacing: "0.02em",
      }}>
        Léon réfléchit…
      </span>
    </div>
  );
}

export default TypingIndicator;
