import * as THREE from 'three';

export type SceneTheme = 'dark' | 'light';
export type AsciiMode = 'hero' | 'ambient';

/** Caracteres de menor a mayor "tinta". */
const RAMP = ' .·:-=+*#%@';

interface ModeConfig {
  /** Tamaño de cada celda de texto en px CSS (más chico = más detalle). */
  cellW: number;
  cellH: number;
  fps: number;
  cameraZ: number;
  cameraZPortrait: number;
  parallax: number;
  /** Segundos entre visitantes (cometas / asteroides): mínimo y máximo. */
  visitorEvery: [number, number];
}

const MODES: Record<AsciiMode, ModeConfig> = {
  hero: { cellW: 7, cellH: 12, fps: 30, cameraZ: 26, cameraZPortrait: 38, parallax: 1.4, visitorEvery: [5, 11] },
  ambient: { cellW: 6, cellH: 10, fps: 15, cameraZ: 30, cameraZPortrait: 44, parallax: 0, visitorEvery: [7, 16] },
};

/** Paleta espacial: los caracteres van de metálico (poca luz) a blanco (mucha luz). */
const TONES = {
  dark: { low: [137, 147, 163], high: [255, 255, 255] },
  light: { low: [137, 147, 163], high: [17, 19, 23] },
} as const;

interface Moon {
  pivot: THREE.Object3D;
  mesh: THREE.Mesh;
  speed: number;
}

/** Cometa o asteroide que cruza la escena de un borde al otro. */
interface Visitor {
  object: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  duration: number;
  spin: THREE.Vector3;
}

/**
 * Escena espacial renderizada como arte ASCII:
 * three.js dibuja la escena en un render target chico (2×2 muestras por celda),
 * se leen los píxeles y cada celda se convierte en un carácter de la rampa según su luminancia,
 * pintado en un tono de la paleta (más luz → más claro) sobre un canvas 2D.
 */
export class AsciiScene {
  private readonly config: ModeConfig;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  private readonly ctx: CanvasRenderingContext2D;
  private target: THREE.WebGLRenderTarget | null = null;
  private pixels = new Uint8Array(0);
  private cols = 0;
  private rows = 0;
  private theme: SceneTheme;

  /** Planeta + anillo + lunas: se ubica y escala según la pantalla. */
  private readonly system = new THREE.Group();
  private readonly planetBody: THREE.Mesh;
  private readonly moons: Moon[] = [];
  private readonly stars: THREE.Points;

  private visitor: Visitor | null = null;
  private nextVisitorAt: number;

  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly startedAt = performance.now();
  private lastFrame = 0;
  private lastT = 0;
  private frameId = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    theme: SceneTheme,
    private readonly mode: AsciiMode,
    private readonly reducedMotion = false,
  ) {
    this.config = MODES[mode];
    this.theme = theme;
    this.ctx = canvas.getContext('2d')!;
    this.nextVisitorAt = 1.5 + Math.random() * 3;

    // El renderer WebGL trabaja fuera de pantalla: sólo genera la "imagen fuente"
    this.renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false, alpha: true });
    this.renderer.setClearColor(0x000000, 0);

    const sun = new THREE.DirectionalLight(0xffffff, 4);
    sun.position.set(-6, 6, 9);
    this.scene.add(sun, new THREE.AmbientLight(0xffffff, 0.15));

    // Planeta con bandas en escala de grises y lado oscuro tenue (se ve como puntos)
    this.planetBody = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 40),
      new THREE.MeshLambertMaterial({ map: AsciiScene.bandTexture(), emissive: 0x3a404b, emissiveIntensity: 0.5 }),
    );
    this.planetBody.rotation.z = 0.35;
    this.system.add(this.planetBody, AsciiScene.createRing());

    // Lunas alrededor del planeta (radios en unidades del planeta)
    const orbits = [
      { radius: 2.5, size: 0.12, tilt: [0.5, 0, 0.3], speed: 0.55, tone: 0xffffff },
      { radius: 3.1, size: 0.16, tilt: [-0.35, 0, -0.25], speed: -0.35, tone: 0xd9dee7 },
      { radius: 3.7, size: 0.1, tilt: [0.75, 0, 0.15], speed: 0.25, tone: 0xffffff },
    ];
    for (const o of orbits) {
      const pivot = new THREE.Object3D();
      pivot.rotation.set(o.tilt[0], Math.random() * Math.PI * 2, o.tilt[2]);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(o.size, 20, 14),
        new THREE.MeshLambertMaterial({ color: o.tone, emissive: o.tone, emissiveIntensity: 0.25 }),
      );
      mesh.position.x = o.radius;
      const path = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          new THREE.EllipseCurve(0, 0, o.radius, o.radius).getPoints(180).map((p) => new THREE.Vector3(p.x, 0, p.y)),
        ),
        new THREE.LineBasicMaterial({ color: 0x5b6472, transparent: true, opacity: 0.35 }),
      );
      pivot.add(mesh, path);
      this.system.add(pivot);
      this.moons.push({ pivot, mesh, speed: o.speed });
    }
    this.scene.add(this.system);

    this.stars = AsciiScene.createStars(mode === 'hero' ? 900 : 1100);
    this.scene.add(this.stars);

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    if (this.config.parallax) window.addEventListener('pointermove', this.onPointerMove, { passive: true });

    // Espera la fuente monoespaciada para que la grilla quede alineada
    document.fonts?.load(`${this.config.cellH}px "Geist Mono"`).finally(() => {
      if (this.reducedMotion) this.draw(0);
      else this.loop(performance.now());
    });
  }

  setTheme(theme: SceneTheme) {
    this.theme = theme;
    if (this.reducedMotion) this.draw(0);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('pointermove', this.onPointerMove);
    this.removeVisitor();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        const material = obj.material as THREE.Material & { map?: THREE.Texture | null };
        material.map?.dispose();
        material.dispose();
      }
    });
    this.target?.dispose();
    this.renderer.dispose();
  }

  // ---------- construcción ----------

  /** Bandas horizontales (planeta gaseoso) en los grises de la paleta. */
  private static bandTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const bands = ['#d9dee7', '#8993a3', '#ffffff', '#5b6472', '#c3c9d4', '#8993a3', '#eef1f5', '#6b7484', '#d9dee7'];
    let y = 0;
    for (let i = 0; y < 256; i++) {
      const h = 12 + ((i * 37) % 24);
      ctx.fillStyle = bands[i % bands.length];
      ctx.fillRect(0, y, 8, h);
      y += h;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /** Anillo con franjas (vértices coloreados por radio) que en ASCII se ve como bandas de caracteres. */
  private static createRing() {
    const inner = 1.4;
    const outer = 2.2;
    const geometry = new THREE.RingGeometry(inner, outer, 180, 12);
    const pos = geometry.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner);
      const v = 0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI * 3.5)) * (1 - t * 0.4);
      colors.set([v, v, v * 1.05], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ring = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    // Inclinado lo suficiente para que se vea como elipse abierta alrededor del planeta
    ring.rotation.set(-Math.PI / 2 + 0.55, 0, 0.3);
    return ring;
  }

  private static createStars(count: number) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(THREE.MathUtils.randFloat(60, 120));
      positions.set([v.x, v.y, v.z - 40], i * 3);
      const b = THREE.MathUtils.randFloat(0.25, 1);
      colors.set([b, b, b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true }));
  }

  /** Cometa: núcleo brillante con una cola cónica que se desvanece, apuntando hacia atrás del movimiento. */
  private static createComet(direction: THREE.Vector3) {
    const group = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const tailLength = 7;
    const tailGeo = new THREE.ConeGeometry(0.32, tailLength, 16, 8, true);
    // El cono apunta hacia +Y con la punta arriba; se lo corre para que la base quede en el origen (núcleo)
    tailGeo.translate(0, tailLength / 2, 0);
    tailGeo.rotateX(Math.PI); // ahora la base (ancha) está en el núcleo y la punta hacia -Y
    const pos = tailGeo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = -pos.getY(i) / tailLength; // 0 = núcleo, 1 = punta
      const v = Math.pow(1 - t, 1.6) * 0.95;
      colors.set([v, v, v], i * 3);
    }
    tailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const tail = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    // -Y del cono (la punta) debe quedar opuesto a la dirección de viaje
    tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction.clone().negate().normalize());
    group.add(tail, head);
    return group;
  }

  /** Asteroide: roca irregular con caras planas que gira sobre sí misma. */
  private static createAsteroid() {
    const geometry = new THREE.IcosahedronGeometry(0.9, 1);
    const pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const k = 0.7 + Math.random() * 0.5;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.8, pos.getZ(i) * k);
    }
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0xc3c9d4, flatShading: true }));
  }

  // ---------- tamaño y encuadre ----------

  private readonly onPointerMove = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };

  private halfSizeAt(depth: number) {
    const halfH = (this.camera.position.z - depth) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return { halfH, halfW: halfH * this.camera.aspect };
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cols = Math.max(1, Math.floor(w / this.config.cellW));
    this.rows = Math.max(1, Math.floor(h / this.config.cellH));
    this.target?.dispose();
    this.target = new THREE.WebGLRenderTarget(this.cols * 2, this.rows * 2);
    this.pixels = new Uint8Array(this.cols * 2 * this.rows * 2 * 4);
    this.renderer.setSize(this.cols * 2, this.rows * 2, false);

    this.camera.aspect = w / h;
    const portrait = w / h < 0.8;
    this.camera.position.z = portrait ? this.config.cameraZPortrait : this.config.cameraZ;
    this.camera.updateProjectionMatrix();

    // El sistema planetario se ve completo y "lejos", a un costado del contenido central
    const { halfH, halfW } = this.halfSizeAt(0);
    const radius = halfH * (portrait ? 0.2 : 0.26);
    this.system.scale.setScalar(radius);
    if (this.mode === 'hero') {
      // Celular: arriba (el ícono queda debajo) · PC: a la derecha del ícono
      if (portrait) this.system.position.set(halfW * 0.28, halfH * 0.66, 0);
      else this.system.position.set(halfW * 0.52, halfH * 0.3, 0);
    } else {
      // Detrás del feed: abajo a la izquierda, lejos del centro de lectura
      if (portrait) this.system.position.set(-halfW * 0.35, -halfH * 0.6, 0);
      else this.system.position.set(-halfW * 0.55, -halfH * 0.4, 0);
    }

    if (this.reducedMotion) this.draw(0);
  }

  // ---------- visitantes ----------

  private spawnVisitor(t: number) {
    const comet = Math.random() < 0.6;
    const depth = THREE.MathUtils.randFloat(-12, -2);
    const { halfH, halfW } = this.halfSizeAt(depth);
    const sx = Math.random() < 0.5 ? -1 : 1;
    const from = new THREE.Vector3(sx * halfW * 1.25, THREE.MathUtils.randFloat(0.1, 0.9) * halfH, depth);
    const to = new THREE.Vector3(-sx * halfW * 1.25, THREE.MathUtils.randFloat(-0.9, 0.2) * halfH, depth);
    const object = comet ? AsciiScene.createComet(to.clone().sub(from)) : AsciiScene.createAsteroid();
    object.position.copy(from);
    this.scene.add(object);
    this.visitor = {
      object,
      from,
      to,
      start: t,
      duration: comet ? THREE.MathUtils.randFloat(3.5, 5.5) : THREE.MathUtils.randFloat(9, 14),
      spin: comet ? new THREE.Vector3() : new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.2),
    };
  }

  private updateVisitor(t: number, dt: number) {
    if (!this.visitor) {
      if (t >= this.nextVisitorAt) this.spawnVisitor(t);
      return;
    }
    const v = this.visitor;
    const k = (t - v.start) / v.duration;
    if (k >= 1) {
      this.removeVisitor();
      const [min, max] = this.config.visitorEvery;
      this.nextVisitorAt = t + THREE.MathUtils.randFloat(min, max);
      return;
    }
    v.object.position.lerpVectors(v.from, v.to, k);
    v.object.rotation.x += v.spin.x * dt;
    v.object.rotation.y += v.spin.y * dt;
    v.object.rotation.z += v.spin.z * dt;
  }

  private removeVisitor() {
    if (!this.visitor) return;
    this.scene.remove(this.visitor.object);
    this.visitor.object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.visitor = null;
  }

  // ---------- ciclo ----------

  private loop = (now: number) => {
    this.frameId = requestAnimationFrame(this.loop);
    if (now - this.lastFrame < 1000 / this.config.fps) return;
    this.lastFrame = now;
    this.draw((now - this.startedAt) / 1000);
  };

  private draw(t: number) {
    if (!this.target || !this.cols) return;
    const dt = Math.min(0.2, Math.max(0, t - this.lastT));
    this.lastT = t;

    this.planetBody.rotation.y = t * 0.1;
    for (const moon of this.moons) {
      moon.pivot.rotation.y += moon.speed * dt;
      moon.mesh.rotation.y = t;
    }
    this.stars.rotation.y = t * 0.004;
    if (!this.reducedMotion) this.updateVisitor(t, dt);
    if (this.config.parallax) {
      this.camera.position.x += (this.pointer.x * this.config.parallax - this.camera.position.x) * 0.05;
      this.camera.position.y += (-this.pointer.y * this.config.parallax * 0.6 - this.camera.position.y) * 0.05;
    }
    this.camera.lookAt(0, 0, 0);

    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, this.cols * 2, this.rows * 2, this.pixels);
    this.renderer.setRenderTarget(null);

    this.paint();
  }

  /** Convierte los píxeles en caracteres, agrupando por tono para minimizar cambios de estilo. */
  private paint() {
    const { cols, rows, pixels, ctx } = this;
    const { cellW, cellH } = this.config;
    const stride = cols * 2 * 4;
    const tones = TONES[this.theme];
    const STEPS = 8;
    const groups: number[][] = Array.from({ length: STEPS }, () => []);

    for (let row = 0; row < rows; row++) {
      // readPixels empieza abajo a la izquierda: se invierte el eje Y
      const y0 = (rows - 1 - row) * 2;
      for (let col = 0; col < cols; col++) {
        let sum = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const i = (y0 + dy) * stride + (col * 2 + dx) * 4;
            sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          }
        }
        const lum = sum / 4 / 255;
        if (lum < 0.035) continue;
        const charIndex = Math.min(RAMP.length - 1, 1 + Math.floor(lum * (RAMP.length - 1)));
        const tone = Math.min(STEPS - 1, Math.floor(Math.pow(lum, 0.75) * STEPS));
        groups[tone].push(col, row, charIndex);
      }
    }

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.font = `600 ${Math.round(cellH * 0.86)}px "Geist Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'top';
    ctx.globalAlpha = this.theme === 'light' ? 0.75 : 1;
    groups.forEach((cells, tone) => {
      if (!cells.length) return;
      const k = tone / (STEPS - 1);
      const c = tones.low.map((lo, i) => Math.round(lo + (tones.high[i] - lo) * k));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      for (let i = 0; i < cells.length; i += 3) {
        ctx.fillText(RAMP[cells[i + 2]], cells[i] * cellW, cells[i + 1] * cellH);
      }
    });
  }
}
