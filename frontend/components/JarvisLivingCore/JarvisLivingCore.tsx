"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./JarvisLivingCore.module.css";
import type { VoiceState } from "../VoiceInterface/voice";

export type CoreDisplayMode = "DASHBOARD" | "FACE";

type JarvisLivingCoreProps = {
  mode: CoreDisplayMode;
  voiceState: VoiceState;
  audioLevel?: number;
  faceRotation?: number;
  heartVisible?: boolean;
  faceRecognitionPulse?: number;
  particleCount?: number;
};

const DEFAULT_PARTICLE_COUNT = 16000;
const TAU = Math.PI * 2;

type FacePoint = {
  x: number;
  y: number;
  z: number;
  region: number;
  energy: number;
};

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pushPoint(points: FacePoint[], point: FacePoint) {
  points.push(point);
}

function addEllipsoid(
  points: FacePoint[],
  count: number,
  center: [number, number, number],
  radius: [number, number, number],
  region: number,
  seedOffset: number,
  shell = false
) {
  for (let index = 0; index < count; index += 1) {
    const seed = seedOffset + index;
    const theta = Math.acos(1 - 2 * seededRandom(seed));
    const phi = TAU * seededRandom(seed + 17.31);
    const shellDepth = shell
      ? 0.82 + seededRandom(seed + 29.7) * 0.18
      : Math.cbrt(seededRandom(seed + 41.2));
    const sinTheta = Math.sin(theta);
    const x = sinTheta * Math.cos(phi) * radius[0] * shellDepth;
    const y = Math.cos(theta) * radius[1] * shellDepth;
    const z = Math.sin(theta) * Math.sin(phi) * radius[2] * shellDepth;
    const frontBias = Math.max(0, z / Math.max(radius[2], 0.01));

    pushPoint(points, {
      x: center[0] + x,
      y: center[1] + y,
      z: center[2] + z + frontBias * 0.05,
      region,
      energy: 0.58 + seededRandom(seed + 61.4) * 0.42,
    });
  }
}

function addCurve(
  points: FacePoint[],
  count: number,
  curve: (t: number, seed: number) => [number, number, number],
  region: number,
  seedOffset: number,
  spread = 0.035
) {
  for (let index = 0; index < count; index += 1) {
    const seed = seedOffset + index;
    const t = count === 1 ? 0.5 : index / (count - 1);
    const base = curve(t, seed);
    pushPoint(points, {
      x: base[0] + (seededRandom(seed + 3.2) - 0.5) * spread,
      y: base[1] + (seededRandom(seed + 7.8) - 0.5) * spread,
      z: base[2] + (seededRandom(seed + 11.6) - 0.5) * spread,
      region,
      energy: 0.78 + seededRandom(seed + 19.5) * 0.22,
    });
  }
}

function createExactFacePoints(requestedCount: number): FacePoint[] {
  const points: FacePoint[] = [];
  const scale = Math.max(0.72, Math.min(1.3, requestedCount / DEFAULT_PARTICLE_COUNT));
  const dense = (count: number) => Math.round(count * scale);

  addEllipsoid(points, dense(7000), [0, 0.12, -0.03], [1.16, 1.5, 0.62], 0, 1, true);
  addEllipsoid(points, dense(3600), [-0.62, -0.08, 0.03], [0.5, 0.78, 0.42], 1, 8001, true);
  addEllipsoid(points, dense(3600), [0.62, -0.08, 0.03], [0.5, 0.78, 0.42], 1, 12001, true);

  // Forehead & Jaw Contours matching the exact face reference
  addCurve(points, dense(1500), (t) => [-0.82 + t * 1.64, 0.82 + Math.sin(t * Math.PI) * 0.12, 0.43 + Math.sin(t * Math.PI) * 0.05], 2, 16001, 0.05);
  addCurve(points, dense(1900), (t) => [-0.92 + t * 1.84, -0.66 - Math.sin(t * Math.PI) * 0.2, 0.28 + Math.sin(t * Math.PI) * 0.14], 3, 18001, 0.05);
  addEllipsoid(points, dense(900), [0, -0.78, 0.26], [0.34, 0.28, 0.24], 4, 20001, true);

  // Eyes & Eyebrows
  const eyeCurve = (side: number) => (t: number): [number, number, number] => {
    const x = side * (0.25 + t * 0.38);
    const lid = Math.sin(t * Math.PI);
    return [x, 0.28 + lid * 0.055, 0.56 + lid * 0.02];
  };
  addCurve(points, dense(900), eyeCurve(-1), 5, 21001, 0.027);
  addCurve(points, dense(900), eyeCurve(1), 5, 22001, 0.027);
  addEllipsoid(points, dense(360), [-0.43, 0.29, 0.58], [0.075, 0.055, 0.035], 6, 23001, true);
  addEllipsoid(points, dense(360), [0.43, 0.29, 0.58], [0.075, 0.055, 0.035], 6, 24001, true);

  const browCurve = (side: number) => (t: number): [number, number, number] => [
    side * (0.16 + t * 0.45),
    0.49 + Math.sin(t * Math.PI) * 0.08,
    0.57 + Math.sin(t * Math.PI) * 0.025,
  ];
  addCurve(points, dense(720), browCurve(-1), 7, 25001, 0.042);
  addCurve(points, dense(720), browCurve(1), 7, 26001, 0.042);

  // Nose Ridge
  addCurve(points, dense(1250), (t) => [
    0.035 * Math.sin(t * Math.PI),
    0.54 - t * 0.72,
    0.47 + Math.sin(t * Math.PI) * 0.16,
  ], 8, 27001, 0.034);
  addEllipsoid(points, dense(680), [0, -0.14, 0.53], [0.18, 0.35, 0.16], 8, 28501, true);

  // Mouth Lips
  const mouthCurve = (offset: number) => (t: number): [number, number, number] => [
    -0.28 + t * 0.56,
    -0.42 + Math.sin(t * Math.PI) * offset,
    0.53 + Math.sin(t * Math.PI) * 0.04,
  ];
  addCurve(points, dense(820), mouthCurve(0.035), 9, 29501, 0.032);
  addCurve(points, dense(700), mouthCurve(-0.025), 9, 30501, 0.032);

  // Holographic contour filaments
  addCurve(points, dense(640), (t) => [
    Math.cos(t * Math.PI * 2) * (0.9 + t * 0.18),
    0.02 + Math.sin(t * Math.PI * 2) * 1.16,
    -0.12 + Math.sin(t * Math.PI * 4) * 0.12,
  ], 10, 31501, 0.05);

  return points;
}

export default function JarvisLivingCore({
  mode,
  voiceState,
  audioLevel = 0,
  faceRotation = 0,
  heartVisible = false,
  faceRecognitionPulse = 0,
  particleCount = DEFAULT_PARTICLE_COUNT,
}: JarvisLivingCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  const voiceStateRef = useRef(voiceState);
  const audioLevelRef = useRef(audioLevel);
  const faceRotationRef = useRef(faceRotation);
  const heartVisibleRef = useRef(heartVisible);
  const faceRecognitionPulseRef = useRef(faceRecognitionPulse);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  useEffect(() => { audioLevelRef.current = audioLevel; }, [audioLevel]);
  useEffect(() => { faceRotationRef.current = faceRotation; }, [faceRotation]);
  useEffect(() => { heartVisibleRef.current = heartVisible; }, [heartVisible]);
  useEffect(() => { faceRecognitionPulseRef.current = faceRecognitionPulse; }, [faceRecognitionPulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const facePoints = createExactFacePoints(particleCount);
    const count = facePoints.length;

    const facePositions = new Float32Array(count * 3);
    const solarPositions = new Float32Array(count * 3);
    const currentPositions = new Float32Array(count * 3);
    const energies = new Float32Array(count);
    const regions = new Float32Array(count);

    // Build Solar Heart-Ball (central radiant star + thousands of orbiting dots)
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const fp = facePoints[i] || { x: 0, y: 0, z: 0, energy: 0.5, region: 0 };
      facePositions[idx] = fp.x;
      facePositions[idx + 1] = fp.y;
      facePositions[idx + 2] = fp.z;
      energies[i] = fp.energy;
      regions[i] = fp.region;

      if (i < count * 0.55) {
        // High density pulsating core orb
        const u = seededRandom(i * 3 + 1);
        const v = seededRandom(i * 3 + 2);
        const theta = u * TAU;
        const phi = Math.acos(2 * v - 1);
        const r = 0.95 * Math.cbrt(seededRandom(i * 3 + 3));
        solarPositions[idx] = r * Math.sin(phi) * Math.cos(theta);
        solarPositions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
        solarPositions[idx + 2] = r * Math.cos(phi) * 0.45;
      } else {
        // Ambient orbiting planetary dots & aura rings
        const angle = seededRandom(i * 7 + 5) * TAU;
        const dist = 1.35 + seededRandom(i * 11 + 3) * 2.8;
        solarPositions[idx] = Math.cos(angle) * dist;
        solarPositions[idx + 1] = Math.sin(angle) * dist * 0.72;
        solarPositions[idx + 2] = (seededRandom(i * 13 + 7) - 0.5) * 0.85;
      }

      // Initial positions based on current mode
      const isFace = modeRef.current === "FACE";
      currentPositions[idx] = (isFace ? facePositions[idx] : solarPositions[idx]) ?? 0;
      currentPositions[idx + 1] = (isFace ? facePositions[idx + 1] : solarPositions[idx + 1]) ?? 0;
      currentPositions[idx + 2] = (isFace ? facePositions[idx + 2] : solarPositions[idx + 2]) ?? 0;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0, 5.1);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(currentPositions, 3));
    geometry.setAttribute("aFacePos", new THREE.BufferAttribute(facePositions, 3));
    geometry.setAttribute("aSolarPos", new THREE.BufferAttribute(solarPositions, 3));
    geometry.setAttribute("aEnergy", new THREE.BufferAttribute(energies, 1));
    geometry.setAttribute("aRegion", new THREE.BufferAttribute(regions, 1));

    const uniforms = {
      uTime: { value: 0 },
      uMorph: { value: modeRef.current === "FACE" ? 1.0 : 0.0 },
      uVoiceIntensity: { value: 0.85 },
      uAudioBoost: { value: 0 },
      uEyeGlow: { value: modeRef.current === "FACE" ? 1.0 : 0.0 },
      uEyeAlert: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        attribute vec3 aFacePos;
        attribute vec3 aSolarPos;
        attribute float aEnergy;
        attribute float aRegion;
        uniform float uTime;
        uniform float uMorph;
        uniform float uVoiceIntensity;
        uniform float uAudioBoost;
        uniform float uEyeGlow;
        uniform float uEyeAlert;
        uniform float uPixelRatio;
        varying float vEnergy;
        varying float vRegion;
        varying float vMorph;
        varying float vEyeGlow;

        void main() {
          vec3 blendedPos = mix(aSolarPos, aFacePos, uMorph);

          float heartbeat = sin(uTime * 2.2) * 0.035 * (1.0 - uMorph);
          float voiceMotion = (0.005 + uVoiceIntensity * 0.004 + uAudioBoost * 0.02);
          
          blendedPos.x += sin(uTime * 0.8 + blendedPos.y * 4.5 + aRegion) * voiceMotion;
          blendedPos.y += cos(uTime * 0.7 + blendedPos.x * 4.0 + aRegion) * voiceMotion;
          blendedPos.z += sin(uTime * 0.95 + blendedPos.z * 5.0) * voiceMotion * 0.7;

          float pulse = 1.0 + heartbeat + sin(uTime * 1.6 + aEnergy * 7.0) * (0.02 + uAudioBoost * 0.05);
          blendedPos *= pulse;

          vec4 mvPosition = modelViewMatrix * vec4(blendedPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float baseSize = mix(1.9, 1.65, uMorph);
          gl_PointSize = (baseSize + aEnergy * 1.8 + uAudioBoost * 1.2) * uPixelRatio * (5.0 / -mvPosition.z);

          vEnergy = aEnergy;
          vRegion = aRegion;
          vMorph = uMorph;
          vEyeGlow = uEyeGlow;
        }
      `,
      fragmentShader: `
        varying float vEnergy;
        varying float vRegion;
        varying float vMorph;
        varying float vEyeGlow;
        uniform float uTime;
        uniform float uEyeAlert;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          float core = smoothstep(0.5, 0.04, dist);
          if (core < 0.01) discard;

          vec3 green = mix(vec3(0.08, 0.42, 0.18), vec3(0.52, 1.0, 0.62), vEnergy);
          if (vRegion == 6.0 || vRegion == 8.0) green = mix(green, vec3(0.72, 1.0, 0.78), 0.42);
          if (vRegion == 6.0) {
            float eyePulse = 0.72 + 0.28 * sin(uTime * 5.0);
            green = mix(green, vec3(0.25, 1.0, 0.38), vEyeGlow * eyePulse);
            green = mix(green, vec3(1.0, 0.04, 0.03), uEyeAlert * eyePulse);
          }
          gl_FragColor = vec4(green, core * (0.38 + vEnergy * 0.56));
        }
      `,
    });

    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.rotation.order = "YXZ";
    scene.add(particleSystem);

    const fieldGeometry = new THREE.BufferGeometry();
    const fieldPositions = new Float32Array(1100 * 3);
    for (let i = 0; i < 1100; i++) {
      const angle = seededRandom(i + 900) * TAU;
      const radius = 1.6 + seededRandom(i + 1200) * 1.4;
      fieldPositions[i * 3] = Math.cos(angle) * radius;
      fieldPositions[i * 3 + 1] = (seededRandom(i + 1500) - 0.5) * 3.0;
      fieldPositions[i * 3 + 2] = (seededRandom(i + 1800) - 0.5) * 1.5 - 0.2;
    }
    fieldGeometry.setAttribute("position", new THREE.BufferAttribute(fieldPositions, 3));
    const fieldMaterial = new THREE.PointsMaterial({
      color: 0x5ae87b,
      size: 0.014,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const field = new THREE.Points(fieldGeometry, fieldMaterial);
    scene.add(field);

    const heartPositions = new Float32Array(1000 * 3);
    for (let index = 0; index < 1000; index += 1) {
      const angle = seededRandom(index + 4400) * TAU;
      const scale = 0.075;
      const heartX = 16 * Math.sin(angle) ** 3;
      const heartY = 13 * Math.cos(angle) - 5 * Math.cos(angle * 2) - 2 * Math.cos(angle * 3) - Math.cos(angle * 4);
      const depth = (seededRandom(index + 4800) - 0.5) * 0.16;
      const offset = index * 3;
      heartPositions[offset] = heartX * scale + (seededRandom(index + 5000) - 0.5) * 0.12;
      heartPositions[offset + 1] = heartY * scale + (seededRandom(index + 5200) - 0.5) * 0.12;
      heartPositions[offset + 2] = depth;
    }
    const heartGeometry = new THREE.BufferGeometry();
    heartGeometry.setAttribute("position", new THREE.BufferAttribute(heartPositions, 3));
    const heartMaterial = new THREE.PointsMaterial({
      color: 0xff5fa2,
      size: 0.045,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const heartSystem = new THREE.Points(heartGeometry, heartMaterial);
    heartSystem.position.set(0, -0.08, 0.76);
    heartSystem.visible = true;
    scene.add(heartSystem);

    const ringGeometry = new THREE.TorusGeometry(1.95, 0.004, 8, 128);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x3acb73,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.3;
    scene.add(ring);

    const ring2Geometry = new THREE.TorusGeometry(2.35, 0.003, 8, 128);
    const ring2Material = new THREE.MeshBasicMaterial({
      color: 0x7efca0,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = new THREE.Mesh(ring2Geometry, ring2Material);
    ring2.rotation.x = Math.PI / 2.7;
    ring2.rotation.y = Math.PI / 6;
    scene.add(ring2);

    const resize = () => {
      const width = canvas.clientWidth || 800;
      const height = canvas.clientHeight || 700;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    let morphValue = modeRef.current === "FACE" ? 1.0 : 0.0;
    let previous = performance.now();

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const elapsed = (now - previous) / 1000;
      previous = now;

      uniforms.uTime.value = now * 0.001;

      const targetMorph = modeRef.current === "FACE" ? 1.0 : 0.0;
      // Form the full face over a short cinematic transition, then hold it stable.
      if (targetMorph === 1) {
        morphValue = Math.min(1, morphValue + elapsed / 3.2);
      } else {
        morphValue = Math.max(0, morphValue - elapsed / 1.2);
      }
      uniforms.uMorph.value = morphValue;

      const state = voiceStateRef.current;
      const intensity =
        state === "LISTENING" ? 1.35 : state === "THINKING" ? 1.7 : state === "SPEAKING" ? 1.9 : 0.85;
      uniforms.uVoiceIntensity.value = intensity;
      uniforms.uAudioBoost.value = audioLevelRef.current;
      uniforms.uEyeGlow.value = modeRef.current === "FACE"
        ? state === "LISTENING" || state === "SPEAKING" || state === "THINKING" ? 1.35 : 0.9
        : 0;
      uniforms.uEyeAlert.value = faceRecognitionPulseRef.current;

      if (targetMorph === 1) {
        const targetRotation = faceRotationRef.current;
        const rotationDelta = targetRotation - particleSystem.rotation.y;
        particleSystem.rotation.y += rotationDelta * Math.min(1, elapsed * 5.5);
        particleSystem.rotation.x = 0;
        particleSystem.rotation.z = 0;
      } else {
        particleSystem.rotation.y += elapsed * 0.06;
      }
      const heartTarget = heartVisibleRef.current ? 1 : 0;
      heartMaterial.opacity += (heartTarget - heartMaterial.opacity) * Math.min(1, elapsed * 4);
      heartSystem.scale.setScalar(0.92 + Math.sin(now * 0.004) * 0.05);
      field.rotation.y += elapsed * 0.04;
      ring.rotation.z += elapsed * 0.08;
      ring2.rotation.z -= elapsed * 0.06;

      renderer.render(scene, camera);
    };

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      fieldGeometry.dispose();
      fieldMaterial.dispose();
      heartGeometry.dispose();
      heartMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      ring2Geometry.dispose();
      ring2Material.dispose();
      renderer.dispose();
      scene.clear();
    };
  }, [particleCount]);

  return (
    <div className={styles.coreContainer}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.ambientGlow} />
    </div>
  );
}
