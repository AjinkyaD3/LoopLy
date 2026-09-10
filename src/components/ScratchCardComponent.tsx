"use client";

import { useRef, useState, useEffect } from "react";
import { Sparkles, Gift } from "lucide-react";

interface Props {
  revealedPrize: string;
  onScratchComplete?: () => void;
}

export default function ScratchCardComponent({ revealedPrize, onScratchComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI Canvas support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);

    // Draw the "scratch off" overlay
    ctx.fillStyle = "#cbd5e1"; // slate-300
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Add some pattern/text to the overlay
    ctx.fillStyle = "#94a3b8"; // slate-400
    ctx.font = "bold 16px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCRATCH TO REVEAL", rect.width / 2, rect.height / 2);
  }, []);

  const handleReveal = () => {
    if (isRevealed) return;
    setIsRevealed(true);
    
    // Clear canvas fully
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    if (onScratchComplete) onScratchComplete();
  };

  // Canvas scratching logic
  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || isRevealed) return;

    const rect = canvas.getBoundingClientRect();
    
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x - rect.left, y - rect.top, 25, 0, 2 * Math.PI);
    ctx.fill();

    // Check if enough is scratched
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;
    
    // Only check alpha channel (every 4th value)
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) transparentPixels++;
    }

    const totalPixels = pixels.length / 4;
    const scratchedPercentage = (transparentPixels / totalPixels) * 100;

    if (scratchedPercentage > 40) {
      handleReveal();
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsScratching(true);
    scratch(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratching) return;
    scratch(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsScratching(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative w-full h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center select-none touch-none">
      {/* Underlying Prize Layer */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        {isRevealed ? (
          <div className="animate-in zoom-in duration-300">
            <Gift className="w-10 h-10 text-white mx-auto mb-2 opacity-80" />
            <p className="text-white font-black text-lg leading-tight">{revealedPrize}</p>
          </div>
        ) : (
          <div className="text-indigo-200">
            <Sparkles className="w-8 h-8 mx-auto opacity-50" />
            <span className="sr-only">{revealedPrize}</span>
          </div>
        )}
      </div>

      {/* The Scratchable Canvas Layer */}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`absolute inset-0 w-full h-full cursor-crosshair transition-opacity duration-500 ${
          isRevealed ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
