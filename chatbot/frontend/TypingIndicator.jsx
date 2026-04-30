// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Indicateur de typing INLINE : rendu sans bulle (la bulle est fournie par
// ChatMessage), juste un canvas 28×32 (bobine animée) à gauche + texte
// "Je réfléchis…" à droite. Disparaît dès qu'un premier token est reçu.

import { useEffect, useRef, useState } from "react";
import { T } from "../../frontend/src/theme";

// Cycle progressif de messages pour rassurer pendant que Léon réfléchit.
// `until` = ms écoulées depuis le mount, exclusif (le 1er match l'emporte).
// Chaque phase dure 3 s.
const PHASES = [
  { until: 3000,        text: "Léon écrit…" },
  { until: 6000,        text: "Léon regarde ça…" },
  { until: 9000,        text: "Léon prépare la meilleure réponse possible…" },
  { until: 12000,       text: "Encore un instant, Léon finalise sa réponse 🙂" },
  { until: Infinity,    text: "Merci de patienter, Léon termine l'analyse." },
];

const N_SPIRES = 11;
const FRAMES_PER_PASS = 100;
const PASSES = 4;
const TOTAL_FRAMES = FRAMES_PER_PASS * PASSES;

const WIND_TOP = 5;
const WIND_BOT = 27;
const GAP = 2;
const CX = 14;
const RX = 10;
const RY = RX * 0.18;

const BOBBIN_BLUE = "#0000FE"; // T.bleu — flasques + flancs
const THREAD_FRONT = "rgba(232,220,200,0.95)"; // T.lin — arc avant
const THREAD_BACK = "rgba(232,220,200,0.35)";  // T.lin — arc arrière (pointillés)
const THREAD_HEAD = "rgba(232,220,200,1)";     // T.lin — tête du fil

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
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(CX, y, RX, RY, 0, Math.PI, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();
  // Arc avant (bas, plein)
  ctx.strokeStyle = THREAD_FRONT;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(CX, y, RX, RY, 0, 0, Math.PI);
  ctx.stroke();
}

function drawPartialSpire(ctx, y, partialProgress) {
  const angle = partialProgress * 2 * Math.PI;
  if (angle <= Math.PI) {
    ctx.strokeStyle = THREAD_FRONT;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(CX, y, RX, RY, 0, 0, angle);
    ctx.stroke();
  } else {
    ctx.strokeStyle = THREAD_FRONT;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(CX, y, RX, RY, 0, 0, Math.PI);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([1, 1.5]);
    ctx.strokeStyle = THREAD_BACK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(CX, y, RX, RY, 0, Math.PI, angle);
    ctx.stroke();
    ctx.restore();
  }
  // Tête du fil
  const hx = CX + RX * Math.cos(angle);
  const hy = y + RY * Math.sin(angle);
  ctx.beginPath();
  ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = THREAD_HEAD;
  ctx.fill();
  // Reflet
  ctx.beginPath();
  ctx.arc(hx - 0.6, hy - 0.6, 0.7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
}

function drawBobbinStructure(ctx) {
  ctx.strokeStyle = BOBBIN_BLUE;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Flasque haut
  roundedRectPath(ctx, 2, 0, 24, 4, 2);
  ctx.stroke();
  // Flancs du corps
  ctx.beginPath();
  ctx.moveTo(5, 4);
  ctx.lineTo(3, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(23, 4);
  ctx.lineTo(25, 28);
  ctx.stroke();
  // Flasque bas
  roundedRectPath(ctx, 2, 28, 24, 4, 2);
  ctx.stroke();
}

function draw(ctx, t) {
  ctx.clearRect(0, 0, 28, 32);

  const passIndex = Math.floor(t / FRAMES_PER_PASS);
  const passT = (t % FRAMES_PER_PASS) / FRAMES_PER_PASS;
  const goingDown = passIndex % 2 === 0;
  const totalProgress = passT * N_SPIRES;
  const filledCount = Math.floor(totalProgress);
  const partialProgress = totalProgress - filledCount;

  for (let i = 0; i < filledCount; i++) {
    drawCompleteSpire(ctx, spireY(i, goingDown));
  }
  if (filledCount < N_SPIRES) {
    drawPartialSpire(ctx, spireY(filledCount, goingDown), partialProgress);
  }
  drawBobbinStructure(ctx);
}

function TypingIndicator() {
  const canvasRef = useRef(null);
  const [text, setText] = useState(PHASES[0].text);

  // Cycle de texte : chaque phase auto-programme la suivante via setTimeout
  // pour ne se réveiller qu'au franchissement du prochain seuil — pas de
  // setInterval qui tourne pour rien.
  useEffect(() => {
    const start = performance.now();
    let timeoutId = null;
    function tick() {
      const elapsed = performance.now() - start;
      const phase = PHASES.find((p) => elapsed < p.until) || PHASES[PHASES.length - 1];
      setText(phase.text);
      if (phase.until !== Infinity) {
        timeoutId = setTimeout(tick, Math.max(50, phase.until - elapsed));
      }
    }
    tick();
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, []);

  // Animation Canvas (indépendante du cycle de texte).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = 28 * dpr;
    canvas.height = 32 * dpr;
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
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <canvas
        ref={canvasRef}
        style={{ width: 28, height: 32, display: "block", flexShrink: 0 }}
        aria-hidden="true"
      />
      {/* key={text} → React remonte le span à chaque changement de phase,
          ce qui rejoue l'animation CSS de fade-up sur le nouveau texte. */}
      <span
        key={text}
        style={{
          fontFamily: T.fontDisplay,
          fontSize: 12,
          fontStyle: "italic",
          color: T.textSoft,
          animation: "leon-text-fade 280ms ease-out",
          display: "inline-block",
        }}
      >
        {text}
      </span>
    </div>
  );
}

export default TypingIndicator;
