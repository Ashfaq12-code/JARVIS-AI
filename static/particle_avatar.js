/**
 * JARVIS 3D Particle Avatar Engine - Ultra High-Fidelity
 * Exact Human Face & Mountain/Hill Landscapes matching Reference Images.
 */

class ParticleAvatarEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.currentStep = 1;
    this.targetStep = 1;
    this.morphProgress = 0; // 0 to 1 between steps
    this.audioLevel = 0.0;  // 0.0 to 1.0 from microphone

    // Real-Time 3D Head Tracking (from Webcam Hand Motion & Mouse)
    this.headRotationY = 0.0;
    this.headRotationX = 0.0;
    this.targetRotY = 0.0;
    this.targetRotX = 0.0;

    // Fiery Eyes & Sound/Clap Pulse State
    this.eyeIndices = [];
    this.eyeStrobeFlashes = 0;
    this.eyeStrobeTimer = 0;
    this.eyeIsOn = true;
    this.shockwaveActive = false;
    this.shockwaveRadius = 0.0;
    this.shockwaveStrength = 0.0;

    this.initThree();
    this.createParticles();
    this.createHaloRings();
    this.createCyberMountains();
    this.setupResizeListener();
    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020814, 0.025);

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 14.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.clock = new THREE.Clock();
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(0, 240, 255, 0.95)');
    grad.addColorStop(0.5, 'rgba(0, 140, 255, 0.4)');
    grad.addColorStop(0.8, 'rgba(0, 50, 180, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  createParticles() {
    // 32,000 particles for avatar body, head, and facial energy core
    this.particleCount = 32000;
    this.geometry = new THREE.BufferGeometry();

    this.posStep1 = new Float32Array(this.particleCount * 3);
    this.posStep2 = new Float32Array(this.particleCount * 3);
    this.posStep3 = new Float32Array(this.particleCount * 3);
    this.posStep4 = new Float32Array(this.particleCount * 3);
    this.posStep5 = new Float32Array(this.particleCount * 3);

    this.currentPositions = new Float32Array(this.particleCount * 3);
    this.colors = new Float32Array(this.particleCount * 3);

    const cyan = new THREE.Color(0x00f0ff);
    const orange = new THREE.Color(0xff6a00);
    const gold = new THREE.Color(0xffb800);
    const brightWhite = new THREE.Color(0xffffff);

    // Build the anatomical human head, bust, and fiery glowing eyes
    const numRings = 85;
    const particlesPerRing = Math.floor((this.particleCount - 4200) / numRings);

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;

      // -------------------------------------------------------------
      // STEP 1: Rotating HUD Core Orb & Ambient Cyber Dust
      // -------------------------------------------------------------
      if (i < 10000) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = 2.3 * Math.cbrt(Math.random());
        this.posStep1[idx] = r * Math.sin(phi) * Math.cos(theta);
        this.posStep1[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
        this.posStep1[idx + 2] = r * Math.cos(phi) * 0.45;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = 3.2 + Math.random() * 9.0;
        this.posStep1[idx] = Math.cos(angle) * dist;
        this.posStep1[idx + 1] = (Math.sin(angle) * dist) * 0.55;
        this.posStep1[idx + 2] = (Math.random() - 0.5) * 3.5;
      }

      // -------------------------------------------------------------
      // STEP 2: The Arc Swirl Ignition (Image 2)
      // -------------------------------------------------------------
      const t2 = i / this.particleCount;
      const arcAngle = t2 * Math.PI * 1.4;
      const arcRadius = 0.8 + t2 * 4.8;
      const spread2 = (Math.random() - 0.5) * (0.2 + t2 * 2.0);

      this.posStep2[idx] = Math.sin(arcAngle) * arcRadius + spread2;
      this.posStep2[idx + 1] = -5.5 + arcAngle * 2.8 + (Math.random() - 0.5) * 0.9;
      this.posStep2[idx + 2] = (Math.random() - 0.5) * (0.3 + t2 * 2.5);

      // -------------------------------------------------------------
      // STEP 3: Silhouette Contour (Image 3)
      // -------------------------------------------------------------
      if (i < 16000) {
        const frac3 = i / 16000;
        const angle3 = frac3 * Math.PI * 2;
        const y3 = -2.0 + frac3 * 5.0;
        let r3 = 1.7;
        if (y3 > 0.5) {
          r3 = Math.sqrt(Math.max(0.1, 3.8 - (y3 - 1.2) * (y3 - 1.2)));
        } else if (y3 > -0.6) {
          r3 = 0.92;
        } else {
          r3 = 1.0 + (-y3) * 2.2;
        }
        const jitter = (Math.random() - 0.5) * 0.25;
        this.posStep3[idx] = Math.cos(angle3) * (r3 + jitter);
        this.posStep3[idx + 1] = y3;
        this.posStep3[idx + 2] = Math.sin(angle3) * (r3 * 0.65 + jitter);
      } else {
        const fracCore = (i - 16000) / 16000;
        const swAngle = fracCore * Math.PI * 4.5;
        const swR = (1.0 - fracCore * 0.75) * 3.2;
        this.posStep3[idx] = Math.cos(swAngle) * swR + (Math.random() - 0.5) * 0.4;
        this.posStep3[idx + 1] = -5.0 + fracCore * 6.0;
        this.posStep3[idx + 2] = Math.sin(swAngle) * swR * 0.45;
      }

      // -------------------------------------------------------------
      // STEP 4 & 5: TRUE ANATOMICAL HUMAN FACE, HEAD & BUST (Images 4 & 5)
      // -------------------------------------------------------------
      let x5 = 0, y5 = 0, z5 = 0;
      let isFieryEye = false;
      let isFaceCore = false;

      if (i < 1600) {
        // 1. FIERY GLOWING EYES (Left & Right Pupils / Irises / Coronas)
        isFieryEye = true;
        this.eyeIndices.push(i);

        const isLeft = i < 800;
        const side = isLeft ? -1 : 1;
        const eyeIdx = i % 800;
        const u = eyeIdx / 800;
        const angle = u * Math.PI * 2 * 6; // Concentric rings & radial filaments
        const r = Math.sqrt(u) * 0.28;

        x5 = side * (0.58 + Math.cos(angle) * r);
        y5 = 1.28 + Math.sin(angle) * (r * 0.78);
        z5 = 1.08 + (Math.random() - 0.5) * 0.04;

      } else if (i < 2800) {
        // 2. EYEBROWS (Natural Arching Supraorbital Brow Line)
        const isLeft = (i - 1600) < 600;
        const side = isLeft ? -1 : 1;
        const u = ((i - 1600) % 600) / 600;
        const bx = 0.20 + u * 0.88;
        const by = 1.45 + Math.sin(u * Math.PI) * 0.13 - u * 0.04;
        const bz = 1.15 - u * 0.32;

        x5 = side * bx;
        y5 = by + (Math.random() - 0.5) * 0.035;
        z5 = bz;
        isFaceCore = true;

      } else if (i < 6200) {
        // 3. DETAILED ANATOMICAL NOSE (Bridge, Dorsum, Tip, Alar Wings, Columella)
        const u = (i - 2800) / 3400;
        const ny = 0.68 + (1.0 - u) * 0.72; // y from 0.68 (base) to 1.40 (nasion)
        const relY = (ny - 0.68) / 0.72; // 0 at base to 1 at top
        const bridgeW = 0.12 + (1.0 - relY) * 0.20;
        const angle = ((i % 34) / 34) * Math.PI - Math.PI / 2;
        const nx = Math.sin(angle) * bridgeW;

        // Nose profile jutting forward prominently in Z
        let nz = 1.06 + Math.sin(relY * Math.PI * 0.85) * 0.48;
        if (ny >= 0.78 && ny <= 0.96) {
          nz += 0.14 * (1.0 - Math.abs(nx) / (bridgeW + 0.01)); // Distinct Nose Tip
        }

        x5 = nx + (Math.random() - 0.5) * 0.02;
        y5 = ny;
        z5 = nz;
        isFaceCore = true;

      } else if (i < 10500) {
        // 4. ANATOMICAL LIPS & PHILTRUM (Cupid's Bow, Mouth Slit, Full Lower Lip)
        const u = (i - 6200) / 4300;
        const ly = 0.30 + u * 0.38; // y from 0.30 to 0.68
        const lxAngle = ((i % 55) / 55) * 2 - 1; // -1 to +1 across mouth width
        const mouthW = 0.58 * Math.sqrt(Math.max(0.01, 1.0 - Math.pow((ly - 0.49) / 0.19, 2)));
        const lx = lxAngle * mouthW;

        let lz = 1.14 + Math.cos(lxAngle * Math.PI * 0.5) * 0.18;
        if (ly > 0.47 && ly < 0.52) {
          lz -= 0.06; // Oral fissure groove
        }
        if (ly > 0.58 && Math.abs(lx) < 0.16) {
          lz -= 0.04; // Philtrum depression
        }

        x5 = lx + (Math.random() - 0.5) * 0.02;
        y5 = ly;
        z5 = lz;
        isFaceCore = true;

      } else if (i < 15500) {
        // 5. CHISELED CHIN & JAWLINE (Mental Protuberance & Mandible)
        const u = (i - 10500) / 5000;
        const isLeft = (i % 2 === 0);
        const side = isLeft ? -1 : 1;

        if (u < 0.45) {
          // Masculine Sculpted Chin
          const cu = u / 0.45;
          const cy = 0.02 + cu * 0.28;
          const cAngle = ((i % 40) / 40) * 2 - 1;
          const cw = 0.44 * (1.0 - (cy - 0.02) * 0.5);
          x5 = cAngle * cw;
          y5 = cy;
          z5 = 1.18 + Math.cos(cAngle * Math.PI * 0.5) * 0.14;
          isFaceCore = true;
        } else {
          // Mandibular Jawline sweeping sharply back and up to ears
          const ju = (u - 0.45) / 0.55;
          const jx = 0.42 + ju * 1.05;
          const jy = 0.15 + ju * 0.58;
          const jz = 1.15 - ju * 1.15;
          x5 = side * (jx + (Math.random() - 0.5) * 0.04);
          y5 = jy + (Math.random() - 0.5) * 0.03;
          z5 = jz;
        }

      } else if (i < 21000) {
        // 6. CHEEKBONES, TEMPLES & FOREHEAD (Frontal Bone & Zygomatic Arch)
        const u = (i - 15500) / 5500;
        const isLeft = (i % 2 === 0);
        const side = isLeft ? -1 : 1;

        if (u < 0.5) {
          // High Cheekbones & Temples
          const cu = u / 0.5;
          const cy = 0.85 + cu * 0.75;
          const cx = side * (0.65 + cu * 0.78);
          const cz = 1.04 - cu * 0.46 + (Math.random() - 0.5) * 0.05;
          x5 = cx;
          y5 = cy;
          z5 = cz;
          if (cz > 0.8) isFaceCore = true;
        } else {
          // Frontal Forehead Vault
          const fu = (u - 0.5) / 0.5;
          const fy = 1.60 + fu * 0.82;
          const fw = Math.sqrt(Math.max(0.04, 1.0 - Math.pow((fy - 1.60) / 0.85, 2))) * 1.55;
          const fAngle = ((i % 50) / 50) * Math.PI;
          x5 = Math.cos(fAngle) * fw;
          y5 = fy;
          z5 = Math.sin(fAngle) * (fw * 0.78) * 0.88;
        }

      } else if (i < 25000) {
        // 7. CRANIUM VAULT & BACK OF SKULL (True Anatomical Skull Dome)
        const u = (i - 21000) / 4000;
        const angle = u * Math.PI * 2 * 18;
        const cy = 0.5 + u * 2.0;
        const cr = Math.sqrt(Math.max(0.05, 1.0 - Math.pow((cy - 1.5) / 1.1, 2))) * 1.65;
        x5 = Math.cos(angle) * cr;
        y5 = cy;
        z5 = -0.15 - Math.abs(Math.sin(angle)) * (cr * 0.95);

      } else if (i < 28500) {
        // 8. ANATOMICAL NECK (Sternocleidomastoid Muscles & Adam's Apple - NOT A CYLINDER!)
        const u = (i - 25000) / 3500;
        const ny = -1.05 + u * 1.10;
        const angle = ((i % 45) / 45) * Math.PI * 2;
        const nr = 0.88 + (1.0 - u) * 0.25;
        let nx = Math.cos(angle) * nr;
        let nz = Math.sin(angle) * (nr * 0.82);

        // Thyroid cartilage (Adam's Apple) forward projection
        if (nz > 0.3 && Math.abs(nx) < 0.25 && ny > -0.55 && ny < -0.3) {
          nz += 0.16;
        }
        x5 = nx;
        y5 = ny;
        z5 = nz;

      } else {
        // 9. MASCULINE CLAVICLES, TRAPEZIUS & ATHLETIC SHOULDERS (NOT A CONE!)
        const u = (i - 28500) / 3500;
        const isLeft = (i % 2 === 0);
        const side = isLeft ? -1 : 1;
        const su = (i % 100) / 100; // 0 at sternum notch to 1 at shoulder joint
        const sx = side * (0.2 + su * 3.4);
        const sy = -1.0 - su * 0.65 - (u * 1.5);
        const sz = 0.85 - su * 0.65 + (Math.random() - 0.5) * 0.15;

        x5 = sx;
        y5 = sy;
        z5 = sz;
      }

      this.posStep4[idx] = x5;
      this.posStep4[idx + 1] = y5;
      this.posStep4[idx + 2] = z5;

      this.posStep5[idx] = x5;
      this.posStep5[idx + 1] = y5;
      this.posStep5[idx + 2] = z5;

      // Current positions initialize to Step 1
      this.currentPositions[idx] = this.posStep1[idx];
      this.currentPositions[idx + 1] = this.posStep1[idx + 1];
      this.currentPositions[idx + 2] = this.posStep1[idx + 2];

      // -------------------------------------------------------------
      // EXACT COLORS: FIRE ORANGE & RED MIXED GLOWING EYES & RADIANT AURA
      // -------------------------------------------------------------
      if (isFieryEye) {
        // BLAZING FIRE ORANGE & CRIMSON RED MIXED GLOWING EYES
        const eyeRad = Math.sqrt((i % 800) / 800);

        if (eyeRad < 0.22) {
          // Blazing Incandescent Pupil Core (White-Gold Fire)
          this.colors[idx] = 1.0;
          this.colors[idx + 1] = 0.95;
          this.colors[idx + 2] = 0.65;
        } else if (eyeRad < 0.65) {
          // Mixed Fire Orange and Hot Red Flame Filaments
          const isRed = (i % 3 === 0);
          if (isRed) {
            // Intense Fire Red
            this.colors[idx] = 1.0;
            this.colors[idx + 1] = 0.08;
            this.colors[idx + 2] = 0.02;
          } else {
            // Vivid Fire Orange
            this.colors[idx] = 1.0;
            this.colors[idx + 1] = 0.45;
            this.colors[idx + 2] = 0.0;
          }
        } else {
          // Deep Fiery Crimson Red & Dark Amber Rim
          const isDeepRed = (i % 2 === 0);
          this.colors[idx] = isDeepRed ? 1.0 : 0.95;
          this.colors[idx + 1] = isDeepRed ? 0.04 : 0.25;
          this.colors[idx + 2] = 0.02;
        }

      } else if (isFaceCore && z5 > 0.4) {
        // RADIANT FIERY AMBER & ORANGE CENTRAL AURA (Images 4 & 5)
        const distFromCenter = Math.sqrt(x5 * x5 + (y5 - 0.9) * (y5 - 0.9) * 2.2);

        if (distFromCenter < 0.65) {
          // Core Fire Light (Nose, Mouth, Chin)
          this.colors[idx] = 1.0;
          this.colors[idx + 1] = 0.58;
          this.colors[idx + 2] = 0.02; // Blazing fiery amber
        } else if (distFromCenter < 1.25) {
          // Mid Warm Fire Glow
          this.colors[idx] = 1.0;
          this.colors[idx + 1] = 0.28;
          this.colors[idx + 2] = 0.04; // Fiery orange/red
        } else {
          // Outer Transition into Cyber Cyan
          this.colors[idx] = 0.0;
          this.colors[idx + 1] = 0.88;
          this.colors[idx + 2] = 1.0;
        }

      } else {
        // ELECTRIC CYAN SCANLINES & CYBER MATRIX
        this.colors[idx] = 0.0;
        this.colors[idx + 1] = 0.88;
        this.colors[idx + 2] = 1.0;
      }
    }

    // Preserve baseline color matrix for fiery eye strobe & pulses
    this.initialColors = new Float32Array(this.colors);

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.currentPositions, 3)
    );
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3)
    );

    const glowTexture = this.createGlowTexture();

    this.material = new THREE.PointsMaterial({
      size: 0.135,
      map: glowTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.particleSystem);
  }

  createHaloRings() {
    // 8 Concentric shockwave halo rings behind the head (Image 5)
    this.haloGroup = new THREE.Group();
    this.haloRings = [];

    const ringCount = 8;
    for (let r = 0; r < ringCount; r++) {
      const radius = 2.2 + r * 1.05;
      const ringGeo = new THREE.BufferGeometry();
      const segments = 160;
      const ringPositions = new Float32Array(segments * 3);

      for (let s = 0; s < segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        ringPositions[s * 3] = Math.cos(theta) * radius;
        ringPositions[s * 3 + 1] = Math.sin(theta) * radius + 1.2;
        ringPositions[s * 3 + 2] = -1.6;
      }

      ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));

      const ringMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
      });

      const line = new THREE.LineLoop(ringGeo, ringMat);
      this.haloRings.push(line);
      this.haloGroup.add(line);
    }

    this.scene.add(this.haloGroup);
  }

  createCyberMountains() {
    // DEDICATED CYBER HILL & MOUNTAIN LANDSCAPES (100% Matching Image 5)
    // Towering mountain crests on the left and right sides in cyan and gold!
    const mountainParticleCount = 20000;
    const mountainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(mountainParticleCount * 3);
    const colors = new Float32Array(mountainParticleCount * 3);

    const cyan = new THREE.Color(0x00f0ff);
    const gold = new THREE.Color(0xffaa00);
    const orange = new THREE.Color(0xff6600);
    const white = new THREE.Color(0xffffff);

    for (let i = 0; i < mountainParticleCount; i++) {
      const idx = i * 3;

      // Distribute across left and right flanks (avoiding center where head is)
      const side = Math.random() > 0.5 ? 1 : -1;
      const u = Math.random(); // 0 to 1
      const xDist = 3.6 + Math.pow(u, 0.8) * 11.5;
      const x = side * xDist;

      // Depth from front to back
      const z = -5.0 + Math.random() * 12.0;

      // Mountain / Hill Profile: High jagged peaks reaching up to y = 1.8
      const distRatio = (xDist - 3.6) / 11.5;
      // Multi-frequency hill formula
      const ridgeNoise1 = Math.sin(x * 0.75 + z * 0.4);
      const ridgeNoise2 = Math.cos(x * 1.6 - z * 0.9) * 0.5;
      const ridgeNoise3 = Math.sin(x * 3.2 + z * 1.5) * 0.25;

      // Mountain height peaks in mid-outer regions
      const peakHeight = 2.4 * Math.sin(distRatio * Math.PI * 0.9);
      const y = -4.2 + peakHeight + (ridgeNoise1 + ridgeNoise2 + ridgeNoise3) * 1.6;

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      // Mountain coloring: Glowing cyan on high peaks, gold & orange strata in valleys
      if (y > -0.8) {
        // High Peak: Electric Cyan & Snow-White
        const isWhite = Math.random() > 0.65;
        const col = isWhite ? white : cyan;
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;
      } else if (y > -2.2) {
        // Mid Slope: Cyan transitioning into Gold
        const isGold = Math.random() > 0.45;
        const col = isGold ? gold : cyan;
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;
      } else {
        // Base / Valleys: Fiery Gold and Amber Strata
        const col = Math.random() > 0.3 ? orange : gold;
        colors[idx] = col.r;
        colors[idx + 1] = col.g;
        colors[idx + 2] = col.b;
      }
    }

    mountainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    mountainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const glowTexture = this.createGlowTexture();

    this.mountainMaterial = new THREE.PointsMaterial({
      size: 0.12,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.0, // Hidden until Step 5
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mountainSystem = new THREE.Points(mountainGeo, this.mountainMaterial);
    this.scene.add(this.mountainSystem);
  }

  setStep(step) {
    this.targetStep = Math.max(1, Math.min(5, step));
  }

  setupResizeListener() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // Smoothly step morphing progress
    if (this.currentStep !== this.targetStep) {
      this.morphProgress += delta * 1.9;
      if (this.morphProgress >= 1.0) {
        this.morphProgress = 0;
        if (this.currentStep < this.targetStep) {
          this.currentStep++;
        } else {
          this.currentStep--;
        }
      }
    }

    let fromPos, toPos;
    const stepA = this.currentStep;
    const stepB = (this.currentStep < this.targetStep)
      ? this.currentStep + 1
      : (this.currentStep > this.targetStep ? this.currentStep - 1 : this.currentStep);

    const getBuffer = (s) => {
      if (s === 1) return this.posStep1;
      if (s === 2) return this.posStep2;
      if (s === 3) return this.posStep3;
      if (s === 4) return this.posStep4;
      return this.posStep5;
    };

    fromPos = getBuffer(stepA);
    toPos = getBuffer(stepB);

    const positions = this.geometry.attributes.position.array;
    const pCount = this.particleCount;
    const t = this.morphProgress;
    const easeT = 0.5 - 0.5 * Math.cos(t * Math.PI);

    const audioBounce = 1.0 + this.audioLevel * 0.45;

    // Smoothly interpolate head yaw & pitch from hand tracking
    this.headRotationY += (this.targetRotY - this.headRotationY) * 0.12;
    this.headRotationX += (this.targetRotX - this.headRotationX) * 0.12;

    const cosY = Math.cos(this.headRotationY);
    const sinY = Math.sin(this.headRotationY);
    const cosX = Math.cos(this.headRotationX);
    const sinX = Math.sin(this.headRotationX);

    for (let i = 0; i < pCount; i++) {
      const idx = i * 3;
      const xA = fromPos[idx];
      const yA = fromPos[idx + 1];
      const zA = fromPos[idx + 2];

      const xB = toPos[idx];
      const yB = toPos[idx + 1];
      const zB = toPos[idx + 2];

      let curX = xA + (xB - xA) * easeT;
      let curY = yA + (yB - yA) * easeT;
      let curZ = zA + (zB - zA) * easeT;

      // Step 1: Gentle orb rotation
      if (stepA === 1 && stepB === 1) {
        const rotSpeed = 0.45;
        const cosR = Math.cos(rotSpeed * delta);
        const sinR = Math.sin(rotSpeed * delta);
        const prevX = curX;
        curX = prevX * cosR - curZ * sinR;
        curZ = prevX * sinR + curZ * cosR;
        this.posStep1[idx] = curX;
        this.posStep1[idx + 2] = curZ;
      }

      // Step 4 & 5: Horizontal wave ripples across the glowing Amber Voice Core
      if ((stepA >= 4 || stepB >= 4) && curY > 0.5 && curY < 1.7 && Math.abs(curX) < 1.1) {
        // Horizontal undulating sine heat waves
        const wave = Math.sin(curY * 18.0 - elapsedTime * 6.0) * (0.04 + this.audioLevel * 0.08);
        curZ += wave;
        curX *= audioBounce;
      }

      // Apply 3D Head Tracking Rotation to Human Avatar (Steps 3, 4, 5)
      if ((stepA >= 3 || stepB >= 3) && curY > -2.0) {
        const pivotY = 1.25;
        const py = curY - pivotY;

        // Yaw (turn left/right)
        const rx = curX * cosY + curZ * sinY;
        const rz = -curX * sinY + curZ * cosY;

        // Pitch (tilt up/down)
        const ry = py * cosX - rz * sinX;
        const rz2 = py * sinX + rz * cosX;

        curX = rx;
        curY = ry + pivotY;
        curZ = rz2;
      }

      // Clap / Sound Shockwave Explosion Pulse
      if (this.shockwaveActive) {
        const dX = curX;
        const dY = curY - 1.25;
        const dZ = curZ;
        const dist = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
        const waveDiff = Math.abs(dist - this.shockwaveRadius);
        if (waveDiff < 0.8) {
          const push = (1.0 - waveDiff / 0.8) * 0.45 * this.shockwaveStrength;
          curZ += push;
          curX += (dX / (dist + 0.001)) * push * 0.5;
        }
      }

      positions[idx] = curX;
      positions[idx + 1] = curY;
      positions[idx + 2] = curZ;
    }

    this.geometry.attributes.position.needsUpdate = true;

    // Handle Rapid Fiery Eye Strobe on Clap / Sound Trigger
    if (this.eyeStrobeFlashes > 0) {
      this.eyeStrobeTimer += delta;
      if (this.eyeStrobeTimer >= 0.08) {
        this.eyeStrobeTimer = 0;
        this.eyeIsOn = !this.eyeIsOn;
        this.eyeStrobeFlashes--;

        const colArr = this.geometry.attributes.color.array;
        const eCount = this.eyeIndices.length;
        for (let k = 0; k < eCount; k++) {
          const eIdx = this.eyeIndices[k] * 3;
          if (this.eyeIsOn) {
            colArr[eIdx] = Math.min(1.0, this.initialColors[eIdx] * 1.5);
            colArr[eIdx + 1] = Math.min(1.0, this.initialColors[eIdx + 1] * 1.5);
            colArr[eIdx + 2] = Math.min(1.0, this.initialColors[eIdx + 2] * 1.5);
          } else {
            colArr[eIdx] = 0.02;
            colArr[eIdx + 1] = 0.02;
            colArr[eIdx + 2] = 0.06;
          }
        }
        this.geometry.attributes.color.needsUpdate = true;
      }
    } else if (stepA >= 3 || stepB >= 3) {
      // Living Fire Flame Shimmer on the Eyes (Mixed fire orange & red glowing)
      const colArr = this.geometry.attributes.color.array;
      const eCount = this.eyeIndices.length;
      const flickerTime = elapsedTime * 7.0;
      for (let k = 0; k < eCount; k++) {
        const eIdx = this.eyeIndices[k] * 3;
        const flame = 1.0 + Math.sin(flickerTime + (k % 47) * 0.4) * 0.18 + Math.cos(flickerTime * 1.5 + k) * 0.12;
        colArr[eIdx] = Math.min(1.0, this.initialColors[eIdx] * flame);
        colArr[eIdx + 1] = Math.min(1.0, this.initialColors[eIdx + 1] * flame);
        colArr[eIdx + 2] = Math.min(1.0, this.initialColors[eIdx + 2] * flame);
      }
      this.geometry.attributes.color.needsUpdate = true;
    }

    if (this.shockwaveActive) {
      this.shockwaveRadius += delta * 8.5;
      this.shockwaveStrength -= delta * 2.0;
      if (this.shockwaveRadius > 10.0 || this.shockwaveStrength <= 0) {
        this.shockwaveActive = false;
      }
    }

    // Step 5 Visibility Weight
    const step5Weight = (this.currentStep === 5 && this.targetStep === 5)
      ? 1.0
      : (this.currentStep === 4 && this.targetStep === 5 ? easeT : (this.currentStep === 5 && this.targetStep === 4 ? 1 - easeT : 0));

    // Animate Concentric Halo Shockwaves (slight tilt with head)
    this.haloGroup.rotation.y = this.headRotationY * 0.35;
    this.haloGroup.rotation.x = this.headRotationX * 0.35;

    this.haloRings.forEach((ring, idx) => {
      ring.material.opacity = step5Weight * (0.6 - idx * 0.065);
      const s = 1.0 + Math.sin(elapsedTime * 1.8 + idx * 0.5) * 0.035;
      ring.scale.set(s, s, 1);
    });

    // Animate Cyber Mountain Terrain (Left & Right Hills)
    this.mountainMaterial.opacity = step5Weight * 0.88;
    if (step5Weight > 0.05) {
      const mPos = this.mountainSystem.geometry.attributes.position.array;
      const count = mPos.length / 3;
      for (let k = 0; k < count; k++) {
        const kx = mPos[k * 3];
        const kz = mPos[k * 3 + 2];
        const baseHeight = -4.2 + (Math.abs(kx) - 3.6) * 0.45;
        const wave = Math.sin(kx * 0.8 + elapsedTime * 1.4) * Math.cos(kz * 0.6 + elapsedTime * 0.9);
        mPos[k * 3 + 1] = baseHeight + wave * (0.35 + this.audioLevel * 0.7);
      }
      this.mountainSystem.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  setHeadRotation(yaw, pitch) {
    this.targetRotY = Math.max(-0.85, Math.min(0.85, yaw));
    this.targetRotX = Math.max(-0.35, Math.min(0.35, pitch));
  }

  triggerClapReaction() {
    this.eyeStrobeFlashes = 10; // Rapidly flash 10 times (on/off repeatedly)
    this.eyeStrobeTimer = 0;
    this.eyeIsOn = true;
    this.shockwaveActive = true;
    this.shockwaveRadius = 0.2;
    this.shockwaveStrength = 1.0;
  }
}

window.ParticleAvatarEngine = ParticleAvatarEngine;
