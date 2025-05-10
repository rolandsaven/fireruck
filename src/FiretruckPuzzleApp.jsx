// FiretruckPuzzleApp.jsx  🚒🧩✨  (responsive board + scaled pieces)
// ------------------------------------------------------------------
//  ▸ Board scales to fit viewport (BASE_SIZE → boardPx).
//  ▸ **Piece PNGs now scale proportionally** with the board so they
//    always match the silhouette. All translate/scale transforms factor
//    in the current board → base scale.
// ------------------------------------------------------------------
//  No external deps. Tailwind 4.1 via @tailwindcss/vite.
// ------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";

const BASE_SIZE = 1024;          // puzzle designed in this coord space
const MAX_BOARD_PX = 600;        // max board size on large screens
const SNAP_RADIUS = 40;          // snap tolerance in base units
const CONFETTI_COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"];

export default function FiretruckPuzzleApp() {
  /* -------------------- responsive board -------------------- */
  const calcBoardPx = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Math.min(vw - 32, vh - 192, MAX_BOARD_PX);
  };
  const [boardPx, setBoardPx] = useState(calcBoardPx);
  const scale = boardPx / BASE_SIZE; // <–– key: global scale factor

  useEffect(() => {
    const onResize = () => setBoardPx(calcBoardPx());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* -------------------- state refs -------------------------- */
  const [pieces, setPieces] = useState([]);
  const [completed, setCompleted] = useState(false);
  const dragRef = useRef(null);               // { id, offX, offY, el, lastX, lastY }
  const boardRef = useRef(null);

  /* -------------------- confetti code ----------------------- */
  useEffect(() => {
    if (document.getElementById("cf-keyframes")) return;
    const style = document.createElement("style");
    style.id = "cf-keyframes";
    style.textContent = `@keyframes cf{0%{transform:translate3d(var(--sx),var(--sy),0) rotate(0deg);opacity:1}100%{transform:translate3d(calc(var(--sx)+var(--dx)),calc(var(--sy)+var(--dy)),0) rotate(360deg);opacity:0}}`;
    document.head.appendChild(style);
  }, []);

  const confetti = (xBase, yBase, big = false) => {
    if (!boardRef.current) return;
    const N = big ? 50 : 14;
    for (let i = 0; i < N; i++) {
      const s = (big ? Math.random() * 10 + 6 : Math.random() * 6 + 4) * scale;
      const dx = (Math.random() - 0.5) * (big ? 600 : 240) * scale;
      const dy = (-Math.random() * (big ? 600 : 300) - 200) * scale;
      const sp = document.createElement("span");
      sp.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;width:${s}px;height:${s}px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};--sx:${xBase*scale}px;--sy:${yBase*scale}px;--dx:${dx}px;--dy:${dy}px;animation:cf ${big?1200:900}ms cubic-bezier(.25,.1,.25,1) forwards`;
      boardRef.current.appendChild(sp);
      setTimeout(() => sp.remove(), big ? 1300 : 1000);
    }
  };

  /* -------------------- load manifest ----------------------- */
  const randTray = () => ({
    x: Math.random() * (BASE_SIZE - 150) + 25,
    y: BASE_SIZE + 40 + Math.random() * 60,
  });

  useEffect(() => {
    fetch("/assets/firetruck_manifest.json")
      .then((r) => r.json())
      .then((data) =>
        setPieces(
          data.map((p) => ({
            id: p.file.replace(/\.png$/i, ""),
            src: `/assets/pieces/${p.file}`,
            target: p.target,
            position: randTray(),
            placed: false,
          }))
        )
      );
  }, []);

  /* -------------------- completion -------------------------- */
  useEffect(() => {
    if (pieces.length && pieces.every((p) => p.placed)) {
      setCompleted(true);
      setTimeout(() => confetti(BASE_SIZE / 2, BASE_SIZE / 2, true), 300);
    }
  }, [pieces, scale]);

  /* -------------------- pointer utils ----------------------- */
  const toLocal = (e) => {
    const rect = boardRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const transformStr = (x, y, extraScale = 1) =>
    `translate(${x * scale}px, ${y * scale}px) scale(${scale * extraScale})`;

  /* -------------------- pointer handlers -------------------- */
  const onDown = (id) => (e) => {
    if (completed) return;
    const idx = pieces.findIndex((p) => p.id === id);
    if (idx === -1 || pieces[idx].placed) return;
    const pt = toLocal(e);
    const offsetX = pt.x - pieces[idx].position.x;
    const offsetY = pt.y - pieces[idx].position.y;
    const el = e.currentTarget;
    el.style.zIndex = 60;
    el.style.filter = "drop-shadow(0 6px 10px rgba(0,0,0,.35))";
    dragRef.current = { id, offX: offsetX, offY: offsetY, el };
    el.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragRef.current) return;
    const { offX, offY, el } = dragRef.current;
    const pt = toLocal(e);
    const x = pt.x - offX;
    const y = pt.y - offY;
    el.style.transform = transformStr(x, y, 1.1);
    dragRef.current.lastX = x;
    dragRef.current.lastY = y;
    e.preventDefault();
  };

  const onUp = () => {
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
          // snap
          el.style.transition = "transform 120ms ease-out";
          el.style.transform = transformStr(p.target.x, p.target.y, 1.2);
          confetti(p.target.x, p.target.y);
          setTimeout(() => {
            el.style.transform = transformStr(p.target.x, p.target.y, 1);
            el.style.filter = "none";
            el.style.zIndex = 0;
          }, 120);
          return { ...p, placed: true, position: p.target };
        }
        // not snapped
        el.style.transition = "transform 120ms ease-out";
        el.style.transform = transformStr(x, y, 1);
        el.style.filter = "none";
        el.style.zIndex = 10;
        return { ...p, position: { x, y } };
      })
    );
  };

  /* -------------------- shared img props -------------------- */
  const imgProps = {
    draggable: false,
    onDragStart: (e) => e.preventDefault(),
    className:
      "absolute w-auto h-auto select-none cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.05] duration-150",
  };

  /* -------------------- render ------------------------------- */
  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen py-6 select-none touch-none"
      style={{ backgroundColor: "#FFF4E0" }}
    >
      <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg flex gap-2 items-center animate-pulse">
        🔥 Build&nbsp;the&nbsp;Fire&nbsp;Engine! 🔥
      </h1>

      <div
        ref={boardRef}
        className="relative rounded-xl shadow-inner overflow-visible"
        style={{ width: boardPx, height: boardPx }}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {/* silhouette */}
        <img
          src="/assets/firetruck_silhouette.png"
          alt="fire-engine silhouette"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
        />
        {/* pieces */}
        {pieces.map((piece) => (
          <img
            key={piece.id}
            src={piece.src}
            alt={piece.id}
            style={{ transform: transformStr(piece.position.x, piece.position.y) }}
            onPointerDown={onDown(piece.id)}
            {...imgProps}
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

/* Build steps unchanged (Tailwind CSS 4.1 + Vite plug-in) */
