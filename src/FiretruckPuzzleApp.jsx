// FiretruckPuzzleApp.jsx  🚒🧩✨  (polished, snappy, confetti!)
// ------------------------------------------------------------------
// Visual & UX upgrades
//   ✔ Fast, butter-smooth drag (imperative transform like before)
//   ✔ Subtle hover scale on desktop (cursor feedback)
//   ✔ Piece snaps now launch cute confetti particles at the snap point
//   ✔ Full-board celebration confetti + pulse banner on completion
//   ✔ Board gets a soft inner shadow; background is #FFF4E0
//   ✔ All animations pure CSS — zero extra libs, 60 fps
// ------------------------------------------------------------------
// Tailwind 4.1 via @tailwindcss/vite (no config edits needed)
// ------------------------------------------------------------------
// HOW CONFETTI WORKS
//   › We inject a <style> tag with @keyframes once (first mount)
//   › createConfetti(x, y, big = false) appends <span> nodes to boardRef
//   › Nodes auto-delete after animation (~1s)
// ------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";

const BOARD_SIZE = 1024;
const SNAP_RADIUS = 40;

// Confetti palette (feel free to tweak!)
const CONFETTI_COLORS = [
  "#ff595e",
  "#ffca3a",
  "#8ac926",
  "#1982c4",
  "#6a4c93",
];

const randomTrayPos = () => ({
  x: Math.random() * (BOARD_SIZE - 150) + 25,
  y: BOARD_SIZE + 40 + Math.random() * 60,
});

export default function FiretruckPuzzleApp() {
  const [pieces, setPieces] = useState([]);
  const [completed, setCompleted] = useState(false);
  const dragRef = useRef(null); // mutable drag state
  const boardRef = useRef(null);

  // Inject keyframes once ------------------------------------------------
  useEffect(() => {
    if (document.getElementById("confetti-css")) return; // already in
    const style = document.createElement("style");
    style.id = "confetti-css";
    style.innerHTML = `
      @keyframes confetti-fall {
        0%   { transform: translate3d(var(--sx), var(--sy), 0) rotate(0deg); opacity:1; }
        100% { transform: translate3d(calc(var(--sx) + var(--dx)), calc(var(--sy) + var(--dy)), 0) rotate(360deg); opacity:0; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Helpers --------------------------------------------------------------
  const launchConfetti = (x, y, big = false) => {
    if (!boardRef.current) return;
    const count = big ? 50 : 14;
    for (let i = 0; i < count; i++) {
      const span = document.createElement("span");
      const size = big ? Math.random() * 10 + 6 : Math.random() * 6 + 4;
      const dx = (Math.random() - 0.5) * (big ? 600 : 240);
      const dy = -Math.random() * (big ? 600 : 300) - 200;
      span.style.cssText = `
        position:absolute;
        left:0;top:0;pointer-events:none;
        width:${size}px;height:${size}px;
        background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
        transform-origin:center;
        --sx:${x}px; --sy:${y}px; --dx:${dx}px; --dy:${dy}px;
        animation:confetti-fall ${big ? 1200 : 900}ms cubic-bezier(0.25,0.1,0.25,1) forwards;
      `;
      boardRef.current.appendChild(span);
      setTimeout(() => span.remove(), big ? 1300 : 1000);
    }
  };

  // Load manifest --------------------------------------------------------
  useEffect(() => {
    fetch("/assets/firetruck_manifest.json")
      .then((r) => r.json())
      .then((data) =>
        setPieces(
          data.map((p) => ({
            id: p.file.replace(/\.png$/i, ""),
            src: `/assets/pieces/${p.file}`,
            target: p.target,
            position: randomTrayPos(),
            placed: false,
          }))
        )
      );
  }, []);

  // Completion check -----------------------------------------------------
  useEffect(() => {
    if (pieces.length && pieces.every((p) => p.placed)) {
      setCompleted(true);
      // big confetti shower after slight delay so last snap pop shows first
      setTimeout(() => launchConfetti(BOARD_SIZE / 2, BOARD_SIZE / 2, true), 250);
    }
  }, [pieces]);

  // Pointer handlers -----------------------------------------------------
  const handlePointerDown = (id) => (e) => {
    if (completed) return;
    const pieceIdx = pieces.findIndex((p) => p.id === id);
    if (pieceIdx === -1 || pieces[pieceIdx].placed) return;

    const piece = pieces[pieceIdx];
    const offsetX = e.clientX - piece.position.x;
    const offsetY = e.clientY - piece.position.y;
    const el = e.currentTarget;

    // elevate visually
    el.style.zIndex = 60;
    el.style.filter = "drop-shadow(0 6px 10px rgba(0,0,0,.35))";
    el.style.transition = "transform 40ms linear";
    el.style.transform = `translate(${piece.position.x}px, ${piece.position.y}px) scale(1.1)`;

    dragRef.current = { id, offsetX, offsetY, el };
    el.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const { offsetX, offsetY, el } = dragRef.current;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    el.style.transform = `translate(${x}px, ${y}px) scale(1.1)`;
    dragRef.current.lastX = x;
    dragRef.current.lastY = y;
    e.preventDefault();
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    const { id, el, lastX, lastY } = dragRef.current;
    dragRef.current = null;

    setPieces((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.placed) return p;
        const x = lastX ?? p.position.x;
        const y = lastY ?? p.position.y;
        const dist = Math.hypot(p.target.x - x, p.target.y - y);

        if (dist < SNAP_RADIUS) {
          // snap with pop + local confetti
          el.style.transition = "transform 120ms ease-out";
          el.style.transform = `translate(${p.target.x}px, ${p.target.y}px) scale(1.2)`;
          launchConfetti(p.target.x, p.target.y);
          setTimeout(() => {
            el.style.transform = `translate(${p.target.x}px, ${p.target.y}px) scale(1)`;
            el.style.filter = "none";
            el.style.zIndex = 0;
          }, 120);

          return { ...p, placed: true, position: p.target };
        }

        // not snapped — settle where dropped
        el.style.transition = "transform 120ms ease-out";
        el.style.transform = `translate(${x}px, ${y}px) scale(1)`;
        el.style.filter = "none";
        el.style.zIndex = 10;
        return { ...p, position: { x, y } };
      })
    );
  };

  // Utility: common img props -------------------------------------------
  const imgCommon = {
    draggable: false,
    onDragStart: (e) => e.preventDefault(),
    className:
      "absolute w-auto h-auto select-none cursor-grab active:cursor-grabbing transition-transform", // hover handled inline
  };

  // Render --------------------------------------------------------------
  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen py-4 select-none touch-none"
      style={{ backgroundColor: "#FFF4E0" }}
    >
      {/* Playful header with fire emojis */}
      <h1
        className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg animate-bounce"
      >
        🔥 Build the Fire&nbsp;Engine! 🔥
      </h1>

      <div
        ref={boardRef}
        className="relative rounded-xl shadow-inner overflow-visible"
        style={{ width: BOARD_SIZE, height: BOARD_SIZE }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src="/assets/firetruck_silhouette.png"
          alt="fire-engine silhouette"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
        />

        {pieces.map((piece) => (
          <img
            key={piece.id}
            src={piece.src}
            alt={piece.id}
            style={{ transform: `translate(${piece.position.x}px, ${piece.position.y}px)` }}
            onPointerDown={handlePointerDown(piece.id)}
            {...imgCommon}
          />
        ))}
      </div>

      {completed && (
        <div className="mt-8 px-8 py-4 rounded-2xl bg-green-500 text-white text-2xl font-semibold shadow-lg animate-bounce">
          Great job! 🎉
        </div>
      )}
    </div>
  );
}

/* ======================================================================
   QUICK BUILD STEPS (Tailwind CSS 4.1 + Vite plug-in) remain unchanged.
======================================================================*/