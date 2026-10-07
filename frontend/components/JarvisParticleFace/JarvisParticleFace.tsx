"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./JarvisParticleFace.module.css";

export type JarvisParticleFaceState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "EXECUTING"
  | "SPEAKING"
  | "CONFIRMATION_REQUIRED"
  | "ERROR"
  | "ROTATING";

export type FaceDirection = "front" | "left" | "right" | "back" | "up" | "down";

type JarvisParticleFaceProps = {
  state: JarvisParticleFaceState;
  direction?: FaceDirection;
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
    const shellDepth = shell ? 0.82 + seededRandom(seed + 29.7) * 0.18 : Math.cbrt(seededRandom(seed + 41.2));
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

function createFacePoints(requestedCount: number) {
  const points: FacePoint[] = [];
  const scale = Math.max(0.72, Math.min(1.3, requestedCount / DEFAULT_PARTICLE_COUNT));
  const dense = (count: number) => Math.round(count * scale);

  // A volumetric cranium and cheeks establish real depth behind the facial landmarks.
  addEllipsoid(points, dense(7000), [0, 0.12, -0.03], [1.16, 1.5, 0.62], 0, 1, true);
  addEllipsoid(points, dense(3600), [-0.62, -0.08, 0.03], [0.5, 0.78, 0.42], 1, 8001, true);
  addEllipsoid(points, dense(3600), [0.62, -0.08, 0.03], [0.5, 0.78, 0.42], 1, 12001, true);

  // Forehead, jaw and chin contours are deliberately denser than the outer silhouette.
  addCurve(points, dense(1500), (t) => [-0.82 + t * 1.64, 0.82 + Math.sin(t * Math.PI) * 0.12, 0.43 + Math.sin(t * Math.PI) * 0.05], 2, 16001, 0.05);
  addCurve(points, dense(1900), (t) => [-0.92 + t * 1.84, -0.66 - Math.sin(t * Math.PI) * 0.2, 0.28 + Math.sin(t * Math.PI) * 0.14], 3, 18001, 0.05);
  addEllipsoid(points, dense(900), [0, -0.78, 0.26], [0.34, 0.28, 0.24], 4, 20001, true);

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

  addCurve(points, dense(1250), (t) => [
    0.035 * Math.sin(t * Math.PI),
    0.54 - t * 0.72,
    0.47 + Math.sin(t * Math.PI) * 0.16,
  ], 8, 27001, 0.034);
  addEllipsoid(points, dense(680), [0, -0.14, 0.53], [0.18, 0.35, 0.16], 8, 28501, true);

  const mouthCurve = (offset: number) => (t: number): [number, number, number] => [
    -0.28 + t * 0.56,
    -0.42 + Math.sin(t * Math.PI) * offset,
    0.53 + Math.sin(t * Math.PI) * 0.04,
  ];
  addCurve(points, dense(820), mouthCurve(0.035), 9, 29501, 0.032);
  addCurve(points, dense(700), mouthCurve(-0.025), 9, 30501, 0.032);

  // A small set of energy filaments gives the point cloud a holographic contour.
  addCurve(points, dense(640), (t) => [
    Math.cos(t * Math.PI * 2) * (0.9 + t * 0.18),
    0.02 + Math.sin(t * Math.PI * 2) * 1.16,
    -0.12 + Math.sin(t * Math.PI * 4) * 0.12,
  ], 10, 31501, 0.05);

  return points;
}

function directionRotation(direction: FaceDirection): [number, number] {
  switch (direction) {
    case "left": return [-0.48, -0.42];
    case "right": return [0.48, 0.42];
    case "back": return [0, Math.PI];
    case "up": return [-0.34, 0];
    case "down": return [0.34, 0];
    default: return [0, 0];
  }
}

export default function JarvisParticleFace({
  state,
  direction = "front",
  particleCount = DEFAULT_PARTICLE_COUNT,
}: JarvisParticleFaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const directionRef = useRef(direction);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const points = createFacePoints(Math.max(12000, Math.min(24000, particleCount)));
    const positions = new Float32Array(points.length * 3);
    const basePositions = new Float32Array(points.length * 3);
    const energies = new Float32Array(points.length);
    const regions = new Float32Array(points.length);

    points.forEach((point, index) => {
      const offset = index * 3;
      positions[offset] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
      basePositions[offset] = point.x;
      basePositions[offset + 1] = point.y;
      basePositions[offset + 2] = point.z;
      energies[index] = point.energy;
      regions[index] = point.region;
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0, 5.1);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aBasePosition", new THREE.BufferAttribute(basePositions, 3));
    geometry.setAttribute("aEnergy", new THREE.BufferAttribute(energies, 1));
    geometry.setAttribute("aRegion", new THREE.BufferAttribute(regions, 1));

    const uniforms = {
      uTime: { value: 0 },
      uState: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        attribute vec3 aBasePosition;
        attribute float aEnergy;
        attribute float aRegion;
        uniform float uTime;
        uniform float uState;
        uniform float uPixelRatio;
        varying float vEnergy;
        varying float vRegion;
        void main() {
          vec3 point = aBasePosition;
          float motion = 0.004 + uState * 0.003;
          point.x += sin(uTime * 0.7 + aBasePosition.y * 5.0 + aRegion) * motion;
          point.y += cos(uTime * 0.62 + aBasePosition.x * 4.0 + aRegion) * motion;
          point.z += sin(uTime * 0.85 + aBasePosition.z * 6.0) * motion * 0.7;
          float pulse = 1.0 + sin(uTime * (1.2 + uState * 0.3) + aEnergy * 8.0) * (0.025 + uState * 0.012);
          point *= pulse;
          vec4 mvPosition = modelViewMatrix * vec4(point, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (1.65 + aEnergy * 1.9 + uState * 0.55) * uPixelRatio * (5.0 / -mvPosition.z);
          vEnergy = aEnergy;
          vRegion = aRegion;
        }
      `,
      fragmentShader: `
        varying float vEnergy;
        varying float vRegion;
        void main() {
          vec2 point = gl_PointCoord - vec2(0.5);
          float distanceFromCenter = length(point);
          float core = smoothstep(0.5, 0.04, distanceFromCenter);
          if (core < 0.01) discard;
          vec3 green = mix(vec3(0.08, 0.42, 0.18), vec3(0.52, 1.0, 0.62), vEnergy);
          if (vRegion == 6.0 || vRegion == 8.0) green = mix(green, vec3(0.72, 1.0, 0.78), 0.42);
          gl_FragColor = vec4(green, core * (0.38 + vEnergy * 0.56));
        }
      `,
    });

    const facePoints = new THREE.Points(geometry, material);
    facePoints.rotation.order = "YXZ";
    scene.add(facePoints);

    const fieldGeometry = new THREE.BufferGeometry();
    const fieldPositions = new Float32Array(900 * 3);
    for (let index = 0; index < 900; index += 1) {
      const angle = seededRandom(index + 900) * TAU;
      const radius = 1.55 + seededRandom(index + 1200) * 0.95;
      fieldPositions[index * 3] = Math.cos(angle) * radius;
      fieldPositions[index * 3 + 1] = (seededRandom(index + 1500) - 0.5) * 2.8;
      fieldPositions[index * 3 + 2] = (seededRandom(index + 1800) - 0.5) * 1.1 - 0.2;
    }
    fieldGeometry.setAttribute("position", new THREE.BufferAttribute(fieldPositions, 3));
    const fieldMaterial = new THREE.PointsMaterial({ color: 0x36d875, size: 0.012, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    const field = new THREE.Points(fieldGeometry, fieldMaterial);
    scene.add(field);

    const ringGeometry = new THREE.TorusGeometry(1.9, 0.004, 8, 128);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x3acb73, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.3;
    scene.add(ring);

    const resize = () => {
      const width = canvas.clientWidth || 640;
      const height = canvas.clientHeight || 560;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    let previous = performance.now();
    let rotationX = 0;
    let rotationY = 0;
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const elapsed = (now - previous) / 1000;
      previous = now;
      uniforms.uTime.value = now * 0.001;
      const activeState = stateRef.current;
      const stateIntensity = activeState === "LISTENING" ? 1.3 : activeState === "THINKING" ? 1.6 : activeState === "SPEAKING" ? 1.8 : activeState === "ERROR" ? 0.7 : 0.85;
      uniforms.uState.value = stateIntensity;
      const target = directionRotation(directionRef.current);
      rotationX += (target[0] - rotationX) * Math.min(1, elapsed * 3.8);
      rotationY += (target[1] - rotationY) * Math.min(1, elapsed * 3.8);
      facePoints.rotation.x = rotationX;
      facePoints.rotation.y = rotationY;
      field.rotation.y += elapsed * 0.04;
      ring.rotation.z += elapsed * (activeState === "THINKING" ? 0.35 : 0.08);
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
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();
      scene.clear();
    };
  }, [particleCount]);

  return (
    <section className={`${styles.stage} ${styles[state.toLowerCase()]}`} aria-label={`JARVIS particle face ${state.toLowerCase()}`}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.scan} aria-hidden="true" />
      <div className={styles.readout}><span />{state === "ROTATING" ? "ORIENTATION" : state}</div>
      <div className={styles.axis} aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}