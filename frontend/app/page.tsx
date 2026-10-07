"use client";

import { useEffect, useState, useRef } from "react";
import PermissionModal, {
  type PendingAction,
} from "../components/JarvisFace/PermissionModal";
import VoiceInterface from "../components/VoiceInterface/VoiceInterface";
import Dashboard from "../components/Dashboard/Dashboard";
import ActivityStream, {
  type ActivityEvent,
} from "../components/ActivityStream/ActivityStream";
import JarvisLivingCore, {
  type CoreDisplayMode,
} from "../components/JarvisLivingCore/JarvisLivingCore";
import JarvisVoiceWaves from "../components/JarvisVoiceWaves/JarvisVoiceWaves";
import JarvisGlassPanels from "../components/JarvisGlassPanels/JarvisGlassPanels";
import SystemHUD, {
  type SystemTelemetry,
} from "../components/SystemHUD/SystemHUD";
import type { VoiceState } from "../components/VoiceInterface/voice";

const API_BASE = "http://127.0.0.1:8001";

type ApiResult = {
  status?: string;
  message?: string;
  action?: string;
  target?: string;
  required_level?: string;
  prompt?: {
    title?: string;
    action?: string;
    target?: string;
    message?: string;
  };
  params?: Record<string, unknown>;
  response?: string;
};

type SpeechRequest = {
  id: number;
  text: string;
};

type HandLandmark = { x: number; y: number; z: number };
type HandsResults = { multiHandLandmarks?: HandLandmark[][] };
type HandsTracker = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: HandsResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};
type HandsConstructor = new (options: { locateFile: (file: string) => string }) => HandsTracker;
type FaceMeshResults = { multiFaceLandmarks?: HandLandmark[][] };
type FaceMeshTracker = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: FaceMeshResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};
type FaceMeshConstructor = new (options: { locateFile: (file: string) => string }) => FaceMeshTracker;

export default function Home() {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [statusMessage, setStatusMessage] = useState("JARVIS operating core online.");
  const [speechRequest, setSpeechRequest] = useState<SpeechRequest | null>(null);
  const [faceState, setFaceState] = useState<VoiceState>("IDLE");
  const [coreMode, setCoreMode] = useState<CoreDisplayMode>("DASHBOARD");
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [telemetryConnected, setTelemetryConnected] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [lastSpokenCommand, setLastSpokenCommand] = useState("");
  const [clapPulse, setClapPulse] = useState(0);
  const [clapHeard, setClapHeard] = useState(false);
  const [wakeGateEnabled, setWakeGateEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("jarvis-clap-activated") !== "1";
  });
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(false);
  const [faceScanRequest, setFaceScanRequest] = useState(0);
  const [faceRotation, setFaceRotation] = useState(0);
  const [faceScanComplete, setFaceScanComplete] = useState(false);
  const [faceScanCountdown, setFaceScanCountdown] = useState<number | null>(null);
  const [heartVisible, setHeartVisible] = useState(false);
  const [faceRecognitionPulse, setFaceRecognitionPulse] = useState(0);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const handsTrackerRef = useRef<HandsTracker | null>(null);
  const handFrameRef = useRef<number | null>(null);
  const heartHideTimerRef = useRef<number | null>(null);
  const faceMeshRef = useRef<FaceMeshTracker | null>(null);
  const faceFrameRef = useRef<number | null>(null);
  const lastHeadDirectionRef = useRef<"left" | "right" | "straight">("straight");
  const lastHeadAnnouncementRef = useRef(0);
  const faceSeenRef = useRef(false);
  const faceScanCompleteRef = useRef(false);
  const faceScanStartedRef = useRef(false);
  const handTrackingEnabledRef = useRef(false);
  const faceAlertTimerRef = useRef<number | null>(null);
  const faceScanCountdownRef = useRef<number | null>(null);
  const lastVoiceActivityStateRef = useRef<VoiceState | null>(null);

  function addActivity(label: string, detail?: string) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour12: false });
    const event: ActivityEvent = detail
      ? { id: Date.now() + Math.random(), label, detail, timestamp }
      : { id: Date.now() + Math.random(), label, timestamp };
    setEvents((current) => [event, ...current].slice(0, 6));
  }

  async function runShortcut(label: string, action: string, params: Record<string, unknown> = {}) {
    const message = await submitAction(action, params);
    addActivity(label, message || "Command unavailable");
  }

  // Real-time backend telemetry link
  useEffect(() => {
    addActivity("CORE INITIALIZED", "Voice channel ready");

    let active = true;
    const fetchTelemetry = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/stats`);
        if (!response.ok) throw new Error("Telemetry unavailable");
        const result: SystemTelemetry = await response.json();
        if (active) {
          setTelemetry(result);
          setTelemetryConnected(true);
        }
      } catch {
        if (active) setTelemetryConnected(false);
      }
    };

    void fetchTelemetry();
    const interval = window.setInterval(fetchTelemetry, 3500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!cameraEnabled) {
      if (handFrameRef.current !== null) cancelAnimationFrame(handFrameRef.current);
      handFrameRef.current = null;
      handsTrackerRef.current?.close?.();
      handsTrackerRef.current = null;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
      if (faceScanCountdownRef.current !== null) window.clearInterval(faceScanCountdownRef.current);
      faceScanCountdownRef.current = null;
      faceSeenRef.current = false;
      faceScanCompleteRef.current = false;
      faceScanStartedRef.current = false;
      setFaceScanComplete(false);
      setFaceScanCountdown(null);
      setFaceRotation(0);
      handTrackingEnabledRef.current = false;
      setHandTrackingEnabled(false);
      return;
    }

    let active = true;
    const loadHandsTracker = () => new Promise<HandsConstructor>((resolve, reject) => {
      const existing = (window as Window & { Hands?: HandsConstructor }).Hands;
      if (existing) {
        resolve(existing);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
      script.onload = () => {
        const hands = (window as Window & { Hands?: HandsConstructor }).Hands;
        if (hands) resolve(hands);
        else reject(new Error("Hand tracker unavailable"));
      };
      script.onerror = () => reject(new Error("Hand tracker failed to load"));
      document.head.appendChild(script);
    });
    const loadFaceMesh = () => new Promise<FaceMeshConstructor>((resolve, reject) => {
      const existing = (window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh;
      if (existing) {
        resolve(existing);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
      script.onload = () => {
        const faceMesh = (window as Window & { FaceMesh?: FaceMeshConstructor }).FaceMesh;
        if (faceMesh) resolve(faceMesh);
        else reject(new Error("Face tracker unavailable"));
      };
      script.onerror = () => reject(new Error("Face tracker failed to load"));
      document.head.appendChild(script);
    });

    void navigator.mediaDevices?.getUserMedia({ video: true, audio: false }).then((stream) => {
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      const startAutomaticFaceScan = () => {
        if (!active || faceScanStartedRef.current || handTrackingEnabledRef.current) return;
        faceScanStartedRef.current = true;
        setFaceRecognitionPulse(1);
        setFaceScanCountdown(3);
        addActivity("FACE SCAN STARTED", "Automatic scan active - hold still");
        if (faceAlertTimerRef.current !== null) window.clearTimeout(faceAlertTimerRef.current);
        faceAlertTimerRef.current = window.setTimeout(() => setFaceRecognitionPulse(0), 3200);
        if (faceScanCountdownRef.current !== null) window.clearInterval(faceScanCountdownRef.current);
        faceScanCountdownRef.current = window.setInterval(() => {
          setFaceScanCountdown((current) => {
            if (current === null || current <= 1) {
              if (faceScanCountdownRef.current !== null) window.clearInterval(faceScanCountdownRef.current);
              faceScanCountdownRef.current = null;
              setFaceScanComplete(true);
              faceScanCompleteRef.current = true;
              addActivity("FACE SCAN COMPLETE", "Head movement tracking connected");
              setSpeechRequest({ id: Date.now(), text: "Face scan complete. Head tracking is now active, Sir." });
              return null;
            }
            return current - 1;
          });
        }, 1000);
      };

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        void cameraVideoRef.current.play().then(startAutomaticFaceScan).catch(() => startAutomaticFaceScan());
      }

      void loadHandsTracker().then((Hands) => {
        if (!active || !cameraVideoRef.current) return;
        const tracker = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
        tracker.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.7, minTrackingConfidence: 0.65 });
        tracker.onResults((results) => {
          const landmarks = results.multiHandLandmarks?.[0];
          if (!landmarks) return;
          const thumb = landmarks[4];
          const index = landmarks[8];
          const middle = landmarks[12];
          if (!thumb || !index || !middle) return;
          const pinchDistance = Math.hypot(thumb.x - index.x, thumb.y - index.y);
          const middleDistance = Math.hypot(thumb.x - middle.x, thumb.y - middle.y);
          const isFingerHeart = pinchDistance < 0.09 && middleDistance > 0.12;
          if (isFingerHeart) {
            setHeartVisible(true);
            if (heartHideTimerRef.current !== null) window.clearTimeout(heartHideTimerRef.current);
            heartHideTimerRef.current = window.setTimeout(() => setHeartVisible(false), 900);
          }

          if (handTrackingEnabledRef.current) {
            const wrist = landmarks[0];
            const indexBase = landmarks[5];
            const pinkyBase = landmarks[17];
            if (!wrist || !indexBase || !pinkyBase) return;
            const palmCenterX = (wrist.x + indexBase.x + pinkyBase.x) / 3;
            const handOffset = palmCenterX - 0.5;
            const handRotation = Math.max(-0.82, Math.min(0.82, handOffset * 2.3));
            setFaceRotation((current) => Math.abs(current - handRotation) > 0.015 ? handRotation : current);
          }
        });
        handsTrackerRef.current = tracker;

        const trackHands = () => {
          if (!active || !cameraVideoRef.current || cameraVideoRef.current.readyState < 2) return;
          void tracker.send({ image: cameraVideoRef.current }).finally(() => {
            handFrameRef.current = requestAnimationFrame(trackHands);
          });
        };
        trackHands();
      }).catch(() => {
        addActivity("HAND TRACKING", "Vision model unavailable");
      });

      void loadFaceMesh().then((FaceMesh) => {
        if (!active || !cameraVideoRef.current) return;
        const tracker = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        tracker.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.7, minTrackingConfidence: 0.65 });
        tracker.onResults((results) => {
          const landmarks = results.multiFaceLandmarks?.[0];
          if (!landmarks) {
            faceSeenRef.current = false;
            return;
          }

          if (!faceSeenRef.current && !faceScanStartedRef.current) {
            faceSeenRef.current = true;
            startAutomaticFaceScan();
          } else {
            faceSeenRef.current = true;
          }

          if (!faceScanCompleteRef.current || handTrackingEnabledRef.current) return;

          const nose = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          if (!nose || !leftEye || !rightEye) return;
          const eyeCenter = (leftEye.x + rightEye.x) / 2;
          const eyeSpan = Math.max(Math.abs(rightEye.x - leftEye.x), 0.01);
          const yaw = (nose.x - eyeCenter) / eyeSpan;
          const nextDirection = yaw < -0.18 ? "left" : yaw > 0.18 ? "right" : "straight";
          const now = Date.now();
          const continuousRotation = Math.max(-0.82, Math.min(0.82, yaw * 1.65));
          setFaceRotation(continuousRotation);
          if (nextDirection !== lastHeadDirectionRef.current && now - lastHeadAnnouncementRef.current > 1800) {
            lastHeadDirectionRef.current = nextDirection;
            lastHeadAnnouncementRef.current = now;
            if (nextDirection !== "straight") {
              setSpeechRequest({
                id: now,
                text: nextDirection === "left" ? "Turning left, Sir." : "Turning right, Sir.",
              });
            }
          }
        });
        faceMeshRef.current = tracker;

        const trackFace = () => {
          if (!active || !cameraVideoRef.current || cameraVideoRef.current.readyState < 2) return;
          void tracker.send({ image: cameraVideoRef.current }).finally(() => {
            faceFrameRef.current = requestAnimationFrame(trackFace);
          });
        };
        trackFace();
      }).catch(() => {
        addActivity("FACE TRACKING", "Vision model unavailable");
      });
    }).catch(() => setCameraEnabled(false));

    return () => {
      active = false;
      if (handFrameRef.current !== null) cancelAnimationFrame(handFrameRef.current);
      if (faceFrameRef.current !== null) cancelAnimationFrame(faceFrameRef.current);
      handsTrackerRef.current?.close?.();
      faceMeshRef.current?.close?.();
      handsTrackerRef.current = null;
      faceMeshRef.current = null;
      faceSeenRef.current = false;
      faceScanCompleteRef.current = false;
      faceScanStartedRef.current = false;
      handTrackingEnabledRef.current = false;
      if (faceScanCountdownRef.current !== null) window.clearInterval(faceScanCountdownRef.current);
      faceScanCountdownRef.current = null;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraEnabled, faceScanRequest]);

  async function submitAction(action: string, params: Record<string, unknown> = {}): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params }),
      });
      if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
      const result: ApiResult = await response.json();
      return result.message || "Command executed.";
    } catch (err) {
      return null;
    }
  }

  async function submitBrainCommand(rawText: string): Promise<string> {
    addActivity("COMMAND PROCESSING", rawText.slice(0, 40));
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${API_BASE}/api/brain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: rawText }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error(`Brain returned HTTP ${response.status}`);
        const result: ApiResult = await response.json();

        if (result.status === "confirmation_required") {
          if (!result.action) {
            addActivity("ACTION ERROR", "Permission response did not include an action");
            return "I could not identify the protected action, Sir.";
          }
          setPendingAction({
            ...result,
            action: result.action,
            originalAction: result.action,
            ...(result.params ? { originalParams: result.params } : {}),
          });
          addActivity("PERMISSION REQUIRED", result.action || "Protected action");
          return result.message || "Permission is required before I can perform that action, Sir.";
        }

        if (result.status === "error") {
          addActivity("ACTION ERROR", result.message || "Command failed");
          return result.message || "I could not complete that command, Sir.";
        }

        if (result.status === "success") {
          addActivity("ACTION VERIFIED", result.message || result.action || "Action completed");
        }
        return result.message || result.response || "Command completed, Sir.";
      } catch (error) {
        lastError = error;
      }
    }
    addActivity("COMMAND ERROR", lastError instanceof Error ? lastError.message : "Brain unavailable");
    return "I could not connect to the JARVIS brain, Sir.";
  }

  function beginFaceScan() {
    faceSeenRef.current = false;
    faceScanCompleteRef.current = false;
    faceScanStartedRef.current = false;
    lastHeadDirectionRef.current = "straight";
    lastHeadAnnouncementRef.current = 0;
    setFaceScanComplete(false);
    setFaceScanCountdown(null);
    setFaceRotation(0);
    setCameraEnabled(true);
    setFaceScanRequest((current) => current + 1);
  }

  function setHandTracking(enabled: boolean) {
    handTrackingEnabledRef.current = enabled;
    setHandTrackingEnabled(enabled);
    if (enabled) {
      setCameraEnabled(true);
      addActivity("HAND TRACKING ENABLED", "Hand position controls face rotation");
    } else {
      setFaceRotation(0);
      setCameraEnabled(false);
      addActivity("HAND TRACKING DISABLED", "Face rotation control released");
    }
  }

  // Voice Command Processing Router
  async function handleVoiceCommand(rawText: string): Promise<string | null> {
    const text = rawText.toLowerCase().trim().replace(/[.,!?]/g, "");
    setLastSpokenCommand(rawText);
    addActivity("VOICE INPUT", rawText.slice(0, 32));

    const wantsHud =
      /(back|return|go|show|open|take).*(hud|dashboard|home|main)/i.test(text) ||
      /(hud|dashboard|home|main).*(back|return|go|show|open)/i.test(text) ||
      /back to (the )?(hood|hud|home)/i.test(text);

    // HUD navigation must win over face-related words in a transcribed sentence.
    if (wantsHud) {
      setCoreMode("DASHBOARD");
      addActivity("COMMAND HUD", "Core returned to operating HUD");
      return "Returning to the operating HUD, Sir.";
    }

    const asksIfJarvisCanSee =
      /(can|do|are).*(see|look at|watch).*(my face|me)/i.test(text) ||
      /(see|look at|watch).*(my face|me)/i.test(text) ||
      text.includes("look at me") ||
      text.includes("look on me");

    if (asksIfJarvisCanSee) {
      if (!cameraEnabled || !faceScanCompleteRef.current) {
        beginFaceScan();
        addActivity("VISION REQUEST", "Automatic face scan started");
        return "Yes, Sir. I am looking at you now. Hold still for the three-second face scan.";
      }

      addActivity("VISION CONFIRMED", "Face tracking is active");
      return "Yes, Sir. I can see your face and face tracking is active.";
    }

    if (
      text.includes("stop hand tracking") ||
      text.includes("disable hand tracking") ||
      text.includes("disconnect hand tracking") ||
      text.includes("stop hand track")
    ) {
      setHandTracking(false);
      return "Hand tracking disabled, Sir.";
    }

    if (
      text.includes("hand tracking") ||
      text.includes("hand track") ||
      text.includes("track my hand") ||
      text.includes("use my hand") ||
      text.includes("control with my hand") ||
      text.includes("control my face with hand")
    ) {
      setHandTracking(true);
      return "Hand tracking enabled. Move your hand left or right to control my face, Sir.";
    }

    if (
      text.includes("scan my face") ||
      text.includes("scan my face please") ||
      text.includes("recognize my face") ||
      text.includes("check my face")
    ) {
      beginFaceScan();
      addActivity("FACE SCAN REQUESTED", "Voice command accepted");
      return "Scanning your face now. Please keep your face centered and hold still, Sir.";
    }

    if (text.includes("open camera") || text.includes("turn on camera") || text.includes("camera on")) {
      beginFaceScan();
      addActivity("CAMERA ENABLED", "Face tracking channel opened");
      return "Camera enabled. Say scan my face, or keep your face centered for scanning, Sir.";
    }

    if (text.includes("close camera") || text.includes("turn off camera") || text.includes("camera off")) {
      setCameraEnabled(false);
      addActivity("CAMERA DISABLED", "Face tracking channel closed");
      return "Camera disabled, Sir.";
    }

    if (
      text.includes("disconnect the face scanner") ||
      text.includes("disconnect face scanner") ||
      text.includes("disconnect the face scan") ||
      text.includes("stop face scanner") ||
      text.includes("stop face scan")
    ) {
      setCameraEnabled(false);
      setFaceScanComplete(false);
      setFaceScanCountdown(null);
      setFaceRotation(0);
      addActivity("FACE SCANNER DISCONNECTED", "Voice channel remains active");
      return "Face scanner disconnected. Voice channel remains active, Sir.";
    }

    if (text.includes("heart") || text.includes("finger heart")) {
      setHeartVisible(true);
      addActivity("HEART SIGNAL", "Particle heart displayed");
      return "Heart signal recognized. Displaying the particle heart, Sir.";
    }

    if (text.includes("hide heart") || text.includes("close heart")) {
      setHeartVisible(false);
      return "Heart signal hidden, Sir.";
    }

    if (text.includes("turn your head left") || text.includes("turn head left") || text.includes("face left")) {
      setFaceRotation(-0.48);
      return "Turning my face left, Sir.";
    }

    if (text.includes("turn your head right") || text.includes("turn head right") || text.includes("face right")) {
      setFaceRotation(0.48);
      return "Turning my face right, Sir.";
    }

    if (text.includes("look straight") || text.includes("face straight") || text.includes("look forward")) {
      setFaceRotation(0);
      return "Looking straight ahead, Sir.";
    }

    if (text.includes("rotate your head") || text.includes("rotate head") || text.includes("turn around")) {
      setFaceRotation((current) => current + Math.PI * 2);
      return "Rotating the face through three hundred and sixty degrees, Sir.";
    }

    // 1. Morph to Face
    if (
      text.includes("face") ||
      text.includes("show me your face") ||
      text.includes("your face") ||
      text.includes("who are you")
    ) {
      setCoreMode("FACE");
      addActivity("NEURAL AVATAR", "Face matrix assembled");
      return "Assembling neural face matrix. I am listening, Sir.";
    }

    // 2. Return to Dashboard
    if (
      text === "dashboard" ||
      text.includes("back to dashboard") ||
      (text.includes("back") && text.includes("dashboard")) ||
      text.includes("return to dashboard") ||
      text.includes("return to the dashboard") ||
      text.includes("go to dashboard") ||
      text.includes("go to the dashboard") ||
      text.includes("show dashboard") ||
      text.includes("main dashboard") ||
      text.includes("dashboard") ||
      text.includes("hud") ||
      text.includes("close face") ||
      text.includes("main") ||
      text.includes("home")
    ) {
      setCoreMode("DASHBOARD");
      addActivity("COMMAND HUD", "Core returned to solar dashboard");
      return "Returning to main operating HUD, Sir.";
    }

    // 3. Wake / Greeting
    if (text.includes("wake up") || text.includes("hello jarvis") || text.includes("hi jarvis")) {
      setWakeGateEnabled(false);
      window.localStorage.setItem("jarvis-clap-activated", "1");
      setStatusMessage("Main engine started. JARVIS is listening in real time.");
      addActivity("MAIN ENGINE STARTED", "Wake phrase accepted after clap");
      return "Main engine started. Hello, Sir. All systems are synchronized and listening.";
    }

    // 4. Volume Controls
    if (text.includes("volume up") || text.includes("increase volume")) {
      return submitBrainCommand(rawText);
    }

    if (text.includes("volume down") || text.includes("decrease volume") || text.includes("reduce volume")) {
      return submitBrainCommand(rawText);
    }

    if (text.includes("mute") || text.includes("unmute")) {
      return submitBrainCommand(rawText);
    }

    // 5. Open Browser / Web Search
    if (text.includes("open browser") || text.includes("chrome")) {
      return submitBrainCommand(rawText);
    }

    if (text.includes("search for") || text.includes("search")) {
      return submitBrainCommand(rawText);
    }

    // 6. System health & metrics
    if (text.includes("system health") || text.includes("status")) {
      const cpu = telemetry?.cpu ? Math.round(telemetry.cpu) : 18;
      const ram = telemetry?.ram_percent ? Math.round(telemetry.ram_percent) : 42;
      return `All systems optimal. CPU is at ${cpu} percent, memory at ${ram} percent.`;
    }

    if (text.includes("show revenue") || text.includes("revenue") || text.includes("sales")) {
      return "Real-time revenue is tracking at ninety-four thousand dollars, with sales volume up twelve percent.";
    }

    if (text.includes("security")) {
      return "Security protocols active. Perimeter firewall and authorization shields at level four.";
    }

    if (text.includes("shutdown system") || text.includes("shutdown")) {
      return "Safety protocol engaged. Operational systems standing by.";
    }

    return submitBrainCommand(rawText);
  }

  return (
    <div className="jarvisBoot">
      <div className="dashboardShell">
        <Dashboard
          face={
            <div className={`coreStage ${coreMode === "DASHBOARD" ? "dashboardBootCore" : "faceCoreStage"}`}>
              <div className="coreOrbit orbitOne" />
              <div className="coreOrbit orbitTwo" />
              <div className="coreOrbit orbitThree" />
              <div className="coreCrosshair crosshairTop" />
              <div className="coreCrosshair crosshairBottom" />
              {cameraEnabled && (
                <video
                  ref={cameraVideoRef}
                  className="faceCameraPreview"
                  muted
                  playsInline
                  disablePictureInPicture
                  controls={false}
                  aria-label="JARVIS face tracking camera"
                />
              )}
              {cameraEnabled && handTrackingEnabled && (
                <div className="handTrackingStatus" aria-live="polite">
                  <span>HAND TRACKING ACTIVE</span>
                  <strong>MOVE LEFT / RIGHT</strong>
                  <small>JARVIS FACE CONTROL</small>
                </div>
              )}
              {cameraEnabled && !handTrackingEnabled && !faceScanComplete && (
                <div className="faceScanStatus" aria-live="polite">
                  <span className="faceScanStatusLabel">
                    {faceScanCountdown === null ? "SEARCHING FOR FACE" : "FACE SCAN"}
                  </span>
                  <strong>{faceScanCountdown ?? "..."}</strong>
                  <span>{faceScanCountdown === null ? "Center your face" : "Hold still"}</span>
                </div>
              )}
              <JarvisLivingCore
                mode={coreMode}
                voiceState={faceState}
                audioLevel={clapPulse}
                faceRotation={faceRotation}
                heartVisible={heartVisible}
                faceRecognitionPulse={faceRecognitionPulse}
                particleCount={16000}
              />
              {coreMode === "DASHBOARD" && (
                <>
                  <div className="coreIdentity" aria-live="polite">
                    <span className="coreIdentityLabel">NEURAL OPERATING CORE</span>
                    <strong>JARVIS</strong>
                    <span>ASHFAQ AHAMED</span>
                  </div>
                  <div className="coreTelemetryTag tagLeft">PARTICLE FIELD // 16K</div>
                  <div className="coreTelemetryTag tagRight">CORE ONLINE</div>
                </>
              )}
              {coreMode === "DASHBOARD" && (
                <JarvisGlassPanels
                  telemetry={telemetry}
                  connected={telemetryConnected}
                  activeCommand={lastSpokenCommand}
                />
              )}
            </div>
          }
          top={
            <div className="hudTopline">
              <div>
                <span className="eyebrow">SYSTEM / DATA</span>
                <h1>J A R V I S</h1>
                <small>OPERATING CORE</small>
              </div>
              <div className="topStatus">
                <span>SYSTEM ONLINE</span>
                <span>SECURITY ACTIVE</span>
              </div>
            </div>
          }
          left={
            <div className="leftColumn">
              <nav className="coreRail" aria-label="JARVIS navigation">
                <span className="railBrand">JARVIS // OS</span>
                <button className="railItem active" type="button" onClick={() => setCoreMode("DASHBOARD")}>HOME</button>
                <button className="railItem" type="button" onClick={() => runShortcut("BROWSER", "open_chrome", { url: "https://www.google.com" })}>BROWSER</button>
                <button className="railItem" type="button" onClick={() => runShortcut("CALCULATOR", "launch_app", { app: "calculator" })}>CALCULATOR</button>
                <button className="railItem" type="button" onClick={() => runShortcut("NOTEPAD", "launch_app", { app: "notepad" })}>NOTEPAD</button>
                <span className="railItem unavailable">FILES // STANDBY</span>
              </nav>
              <SystemHUD telemetry={telemetry} connected={telemetryConnected} />
            </div>
          }
          right={
            <div className="rightHUD">
              <div className="coreReadout">
                <span className="eyebrow">JARVIS CORE</span>
                <div>
                  <span>STATUS</span>
                  <strong className="activeText">ONLINE</strong>
                </div>
                <div>
                  <span>VOICE</span>
                  <strong className="activeText">READY</strong>
                </div>
                <div>
                  <span>BRAIN</span>
                  <strong className={telemetryConnected ? "activeText" : "warningText"}>
                    {telemetryConnected ? "READY" : "OFFLINE"}
                  </strong>
                </div>
                <div>
                  <span>SECURITY</span>
                  <strong className="activeText">ACTIVE</strong>
                </div>
              </div>
              <ActivityStream events={events} />
            </div>
          }
          bottom={
            <div style={{ display: "flex", justifyContent: "center", width: "100%", paddingBottom: "12px" }}>
              <JarvisVoiceWaves
                voiceState={faceState}
                audioLevel={clapPulse}
              />
              <VoiceInterface
                disabled={false}
                requireClap={wakeGateEnabled}
                onClap={() => {
                  setClapHeard(true);
                  setClapPulse(1);
                  setWakeGateEnabled(false);
                  window.localStorage.setItem("jarvis-clap-activated", "1");
                  addActivity("CLAP DETECTED", "Voice channel armed for wake phrase");
                  window.setTimeout(() => {
                    setClapHeard(false);
                    setClapPulse(0);
                  }, 1800);
                }}
                speechRequest={speechRequest}
                onStateChange={(state: VoiceState) => {
                  setFaceState(state);
                  if (lastVoiceActivityStateRef.current === state) return;
                  lastVoiceActivityStateRef.current = state;
                  if (state === "LISTENING") addActivity("MICROPHONE ACTIVE", "Speech Recognition listening");
                  if (state === "THINKING") addActivity("COMMAND PROCESSING", "Recognized speech is being handled");
                  if (state === "SPEAKING") addActivity("JARVIS RESPONDING", "Text-to-speech output active");
                  if (state === "ERROR") addActivity("VOICE ERROR", "Speech channel requires attention");
                }}
                onCommand={async (voiceCommand) => {
                  const message = await handleVoiceCommand(voiceCommand);
                  return message ? { text: message } : null;
                }}
              />
            </div>
          }
          developerTools={null}
        >
          <PermissionModal
            pendingAction={pendingAction}
            onAllowOnce={async () => {
              if (!pendingAction?.originalAction) {
                setPendingAction(null);
                return;
              }
              const result = await submitAction(pendingAction.originalAction, {
                ...(pendingAction.originalParams || {}),
                confirmed: true,
              });
              addActivity(
                result ? "ACTION VERIFIED" : "ACTION ERROR",
                result || "Protected action failed",
              );
              setPendingAction(null);
              setSpeechRequest({
                id: Date.now(),
                text: result || "I could not complete that protected action, Sir.",
              });
            }}
            onDeny={() => {
              addActivity("ACTION DENIED", pendingAction?.action || "Protected action");
              setPendingAction(null);
            }}
          />
        </Dashboard>
      </div>
    </div>
  );
}