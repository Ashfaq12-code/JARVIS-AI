"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  requestMicrophoneAccess,
  speakJarvisResponse,
  type SpeechRecognitionLike,
  type VoiceState,
} from "./voice";

type VoiceResponse = {
  text: string;
};

type SpeechRequest = {
  id: number;
  text: string;
};

type VoiceInterfaceProps = {
  disabled?: boolean;
  requireClap?: boolean;
  onClap?: () => void;
  onCommand: (command: string) => Promise<VoiceResponse | null>;
  onStateChange?: (state: VoiceState) => void;
  speechRequest?: SpeechRequest | null;
};

const STATE_LABELS: Record<VoiceState, string> = {
  IDLE: "MIC",
  LISTENING: "LISTENING",
  THINKING: "THINKING",
  EXECUTING: "EXECUTING",
  SPEAKING: "SPEAKING",
  CONFIRMATION_REQUIRED: "CONFIRM",
  ERROR: "ERROR",
};

export default function VoiceInterface({
  disabled = false,
  requireClap = false,
  onClap,
  onCommand,
  onStateChange,
  speechRequest,
}: VoiceInterfaceProps) {
  const [state, setState] = useState<VoiceState>("IDLE");
  const [recognizedCommand, setRecognizedCommand] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const processingRef = useRef(false);
  const startInProgressRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const recognitionErrorRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const lastSpeechRequestId = useRef<number | null>(null);
  const requireClapRef = useRef(requireClap);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserFrameRef = useRef<number | null>(null);
  const clapWindowUntilRef = useRef(0);
  const lastClapAtRef = useRef(0);
  const noiseFloorRef = useRef(0.02);
  const speakingRef = useRef(false);

  useEffect(() => {
    requireClapRef.current = requireClap;
  }, [requireClap]);

  function stopAudioMonitor() {
    if (analyserFrameRef.current !== null) {
      cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }
    audioContextRef.current?.close();
    audioContextRef.current = null;
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
  }

  function startClapMonitor(stream: MediaStream) {
    if (!requireClap || audioContextRef.current) return;

    const AudioContextConstructor = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.18;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    audioContextRef.current = context;

    const monitor = () => {
      if (!mountedRef.current) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      let peak = 0;
      for (const sample of samples) {
        const amplitude = Math.abs(sample - 128) / 128;
        sum += amplitude * amplitude;
        peak = Math.max(peak, amplitude);
      }
      const rms = Math.sqrt(sum / samples.length);
      const noiseFloor = noiseFloorRef.current;
      noiseFloorRef.current = noiseFloor * 0.96 + Math.min(rms, 0.12) * 0.04;

      if (
        rms > 0.16 &&
        peak > 0.42 &&
        rms > noiseFloor * 2.8 &&
        Date.now() - lastClapAtRef.current > 1200
      ) {
        lastClapAtRef.current = Date.now();
        clapWindowUntilRef.current = Date.now() + 8000;
        onClap?.();
      }
      analyserFrameRef.current = requestAnimationFrame(monitor);
    };

    void context.resume();
    monitor();
  }

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  async function speak(text: string) {
    speakingRef.current = true;
    setState("SPEAKING");
    setErrorMessage("");

    try {
      await speakJarvisResponse(text);
    } catch (error) {
      setState("ERROR");
      setErrorMessage(
        error instanceof Error ? error.message : "JARVIS speech output failed."
      );
    } finally {
      speakingRef.current = false;
      if (mountedRef.current && !disabled && !intentionalStopRef.current) {
        setState("IDLE");
        scheduleListeningRestart(220);
      }
    }
  }

  useEffect(() => {
    if (!speechRequest || speechRequest.id === lastSpeechRequestId.current) {
      return;
    }

    lastSpeechRequestId.current = speechRequest.id;
    void speak(speechRequest.text);
  }, [speechRequest]);

  useEffect(() => {
    const timer = window.setTimeout(() => void startListening(), 250);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      recognitionRef.current?.abort();
      stopAudioMonitor();
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function startListening() {
    if (
      disabled ||
      startInProgressRef.current ||
      recognitionRef.current ||
      processingRef.current
    ) {
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      console.error("[JARVIS Voice] error", "SpeechRecognition unsupported");
      setState("ERROR");
      setErrorMessage("Browser speech recognition is unavailable.");
      return;
    }

    console.log("[JARVIS Voice] recognition supported");
    setErrorMessage("");
    startInProgressRef.current = true;
    intentionalStopRef.current = false;
    recognitionErrorRef.current = false;

    try {
      const stream = await requestMicrophoneAccess();
      microphoneStreamRef.current = stream;
      startClapMonitor(stream);
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        startInProgressRef.current = false;
        console.log("[JARVIS Voice] starting");
        setState("LISTENING");
      };
      recognition.onresult = (event) => {
        const result = event.results[event.resultIndex];
        if (!result?.isFinal) return;

        const transcript = result?.[0]?.transcript.trim() || "";

        if (!transcript) return;

        const isDashboardNavigation =
          /dashboard|hud/i.test(transcript) &&
          /back|return|go|show|main|home|close/i.test(transcript);

        const isVisionCommand =
          /(see|look at|watch|scan|recognize).*(me|my face)/i.test(transcript) ||
          /(?:my face|look at me|see me|hand tracking|hand track|track my hand|use my hand|control my face)/i.test(transcript);

        if (requireClapRef.current && Date.now() > clapWindowUntilRef.current && !isDashboardNavigation && !isVisionCommand) {
          setState("LISTENING");
          return;
        }

        console.log("[JARVIS Voice] result", transcript);
        setRecognizedCommand(transcript);
        processingRef.current = true;
        setState("THINKING");
        stopRecognition(recognition);

        void onCommand(transcript)
          .then((response) => (response ? speak(response.text) : scheduleListeningRestart(180)))
          .catch((error) => {
            setState("ERROR");
            setErrorMessage(
              error instanceof Error ? error.message : "Voice command failed."
            );
            scheduleListeningRestart(1200);
          })
          .finally(() => {
            processingRef.current = false;
            recognitionErrorRef.current = false;
            setState((current) => current === "THINKING" ? "IDLE" : current);
            scheduleListeningRestart(180);
          });
      };
      recognition.onerror = (event) => {
        console.error("[JARVIS Voice] error", event.error, event.message);

        if (event.error === "aborted" && (processingRef.current || intentionalStopRef.current)) {
          return;
        }

        if (event.error === "no-speech") {
          recognitionErrorRef.current = false;
          setState("LISTENING");
          scheduleListeningRestart(350);
          return;
        }

        recognitionErrorRef.current = true;
        setState("ERROR");
        setErrorMessage(getRecognitionErrorMessage(event.error));
        if (event.error !== "not-allowed" && event.error !== "service-not-allowed") {
          recognitionErrorRef.current = false;
          scheduleListeningRestart(1200);
        }
      };
      recognition.onend = () => {
        console.log("[JARVIS Voice] stopped");
        recognitionRef.current = null;
        startInProgressRef.current = false;

        if (!processingRef.current && !speakingRef.current && !intentionalStopRef.current && !recognitionErrorRef.current) {
          scheduleListeningRestart(180);
        }
      };

      console.log("[JARVIS Voice] starting");
      recognition.start();
    } catch (error) {
      console.error("[JARVIS Voice] error", error);
      recognitionRef.current = null;
      startInProgressRef.current = false;
      setState("ERROR");
      setErrorMessage(getMicrophoneErrorMessage(error));
    }
  }

  function stopListening() {
    intentionalStopRef.current = true;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    stopRecognition(recognitionRef.current);
    setState("IDLE");
  }

  function scheduleListeningRestart(delay: number) {
    if (disabled || intentionalStopRef.current || processingRef.current || !mountedRef.current) return;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (!disabled && !processingRef.current && !speakingRef.current && !recognitionRef.current) {
        setState("IDLE");
        void startListening();
      }
    }, delay);
  }

  function stopRecognition(recognition: SpeechRecognitionLike | null) {
    if (!recognition) return;

    try {
      recognition.stop();
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "InvalidStateError") {
        console.error("[JARVIS Voice] error", error);
      }
    }
  }

  function getRecognitionErrorMessage(error: string) {
    switch (error) {
      case "not-allowed":
        return "MICROPHONE ACCESS DENIED. Check Chrome site microphone permission.";
      case "service-not-allowed":
        return "Speech recognition service is not allowed in this browser.";
      case "audio-capture":
        return "No microphone was detected. Check your microphone device.";
      case "no-speech":
        return "I didn't hear anything. Please try again.";
      case "network":
        return "Speech recognition network error.";
      case "aborted":
        return "Speech recognition was aborted.";
      default:
        return `Speech recognition failed (${error || "unknown"}).`;
    }
  }

  function getMicrophoneErrorMessage(error: unknown) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return "MICROPHONE ACCESS DENIED. Check Chrome site microphone permission.";
    }

    return error instanceof Error ? error.message : "Microphone is unavailable.";
  }

  return (
    <div className="voiceInterface flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-green-400/25 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-green-300">Microphone Channel</p>
          <p className="mt-1 text-sm text-green-100/70">
            {recognizedCommand || "Microphone ready for a JARVIS command."}
          </p>
        </div>
        <button
          type="button"
          onClick={state === "LISTENING" ? stopListening : startListening}
          disabled={disabled || state === "THINKING" || state === "EXECUTING" || state === "SPEAKING"}
          className="min-w-32 rounded-xl border border-green-400/60 bg-green-500/10 px-5 py-3 text-sm font-semibold tracking-[0.18em] text-green-200 transition hover:bg-green-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {STATE_LABELS[state]}
        </button>
      </div>
      {errorMessage && <p className="text-xs text-amber-200">{errorMessage}</p>}
    </div>
  );
}