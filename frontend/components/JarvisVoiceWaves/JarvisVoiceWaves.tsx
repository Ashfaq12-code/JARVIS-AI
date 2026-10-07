"use client";

import { useEffect, useRef } from "react";
import styles from "./JarvisVoiceWaves.module.css";
import type { VoiceState } from "../VoiceInterface/voice";

type JarvisVoiceWavesProps = {
  voiceState: VoiceState;
  audioLevel?: number;
};

export default function JarvisVoiceWaves({
  voiceState,
  audioLevel = 0,
}: JarvisVoiceWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    let frame = 0;
    const listening = voiceState === "LISTENING";

    const draw = (phase: number) => {
      ctx.clearRect(0, 0, width, height);
      const boost = voiceState === "LISTENING"
        ? 6 + audioLevel * 18
        : voiceState === "SPEAKING" ? 14
        : voiceState === "THINKING" ? 10
        : voiceState === "ERROR" ? 4 : 2.5;
      const beat = listening ? Math.max(0, Math.sin(phase * 0.006)) ** 10 : 0;

      ctx.beginPath();
      ctx.strokeStyle = "#5ae87b";
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(90, 232, 123, 0.85)";
      for (let x = 0; x < width; x++) {
        const normX = (x / width) * 2 - 1;
        const envelope = Math.exp(-normX * normX * 3.6);
        const spike = Math.abs(normX) < 0.1
          ? Math.sin((normX + 0.1) * Math.PI * 10) * beat * 17
          : 0;
        const y = height / 2 + (spike + Math.sin(x * 0.11 + phase * 0.002) * (1.5 + boost * 0.35)) * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (listening) frame = requestAnimationFrame(draw);
    };

    draw(0);
    return () => cancelAnimationFrame(frame);
  }, [voiceState, audioLevel]);

  return (
    <div
      className={styles.waveDock}
      aria-label={`JARVIS voice state: ${voiceState.toLowerCase()}`}
      aria-live="polite"
    >
      <canvas
        ref={canvasRef}
        width={220}
        height={34}
        className={styles.canvas}
      />
    </div>
  );
}
