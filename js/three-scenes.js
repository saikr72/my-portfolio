/* ==========================================================================
   three-scenes.js — WebGL scenes (ES module).
   Every visual is a pure function of a progress value handed in by the
   scroll engine in main.js; nothing accumulates between frames.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SITE = window.SITE;
const D = window.PORTFOLIO;

/* ---------- math ---------- */
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const range = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const frac = v => v - Math.floor(v);
function rng(seed) {
  // mulberry32 — seeded so textures and packet lanes are identical every load
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- shared renderer factory ---------- */
function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(SITE.dprCap());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/* Render only while the canvas is on screen. */
function watchVisibility(el, onChange) {
  const io = new IntersectionObserver(entries => entries.forEach(e => onChange(e.isIntersecting)), { rootMargin: '10% 0px' });
  io.observe(el);
  return io;
}

/* ==========================================================================
   Procedural slab surface: fine grid + PCB traces, drawn once on canvases.
   `map` is the graphite surface, `glow` (emissive map) carries a subset of
   the traces so they pick up each layer's colour.
   ========================================================================== */
function makeSurfaceTextures(renderer) {
  const S = 1024;
  const base = document.createElement('canvas');
  const glow = document.createElement('canvas');
  base.width = base.height = glow.width = glow.height = S;
  const b = base.getContext('2d');
  const g = glow.getContext('2d');
  const r = rng(20180611);

  b.fillStyle = '#20242b';
  b.fillRect(0, 0, S, S);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);

  // fine grid (one path per weight: a single stroke call each)
  const grid = (step, style) => {
    b.strokeStyle = style;
    b.lineWidth = 1;
    b.beginPath();
    for (let i = 0; i <= S; i += step) { b.moveTo(i + 0.5, 0); b.lineTo(i + 0.5, S); b.moveTo(0, i + 0.5); b.lineTo(S, i + 0.5); }
    b.stroke();
  };
  grid(16, 'rgba(255,255,255,0.035)');
  grid(128, 'rgba(255,255,255,0.05)');

  // chips
  for (let i = 0; i < 7; i++) {
    const w = 64 + Math.floor(r() * 4) * 32, hh = 48 + Math.floor(r() * 3) * 32;
    const x = 32 + Math.floor(r() * ((S - w - 64) / 32)) * 32, y = 32 + Math.floor(r() * ((S - hh - 64) / 32)) * 32;
    b.fillStyle = '#1a1d23';
    b.fillRect(x, y, w, hh);
    b.strokeStyle = 'rgba(255,255,255,0.08)';
    b.strokeRect(x + 0.5, y + 0.5, w, hh);
    b.fillStyle = 'rgba(255,255,255,0.07)';
    for (let k = 8; k < w - 4; k += 12) { b.fillRect(x + k, y - 6, 4, 6); b.fillRect(x + k, y + hh, 4, 6); }
  }

  // traces: orthogonal + 45° walks on a 32px lattice, ending in pads
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let i = 0; i < 90; i++) {
    let x = Math.floor(r() * 32) * 32, y = Math.floor(r() * 32) * 32;
    let d = dirs[Math.floor(r() * 4)];
    const pts = [[x, y]];
    const segs = 2 + Math.floor(r() * 5);
    for (let s = 0; s < segs; s++) {
      const len = (1 + Math.floor(r() * 4)) * 32;
      x += d[0] * len; y += d[1] * len;
      pts.push([x, y]);
      const turn = r() < 0.5 ? 4 : 0;
      d = dirs[(dirs.indexOf(d) + (r() < 0.5 ? 1 : 3) + turn) % 8] || d;
      if (Math.abs(d[0]) + Math.abs(d[1]) === 2 && r() < 0.5) d = dirs[Math.floor(r() * 4)];
    }
    const lit = r() < 0.38;
    const draw = (ctx, col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.stroke();
      const e = pts[pts.length - 1];
      ctx.beginPath(); ctx.arc(e[0], e[1], w * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], w * 1.4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    };
    draw(b, 'rgba(255,255,255,0.075)', 3);
    if (lit) draw(g, 'rgba(255,255,255,0.9)', 2);
  }

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mk = c => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  return { map: mk(base), glow: mk(glow) };
}

/* Re-project UVs by face orientation so the surface keeps one density on
   tops and sides alike (RoundedBoxGeometry stretches one tile per face). */
function remapUVs(geo, tile) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv.setXY(i, u / tile + 0.5, v / tile + 0.5);
  }
  uv.needsUpdate = true;
}

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/* ==========================================================================
   Hero: the 8-slab monolith
   ========================================================================== */
/* Yield to the main thread between heavy boot steps so none of them blocks input for long. */
const yieldTask = () => new Promise(r => setTimeout(r, 0));

async function createHero() {
  const canvas = document.getElementById('hero-canvas');
  const wrap = document.getElementById('hero-canvas-wrap');
  const renderer = makeRenderer(canvas);
  await yieldTask();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();
  await yieldTask();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 7, 5);
  const rim = new THREE.DirectionalLight(0x4f8ef7, 1.1);
  rim.position.set(-5, 2, -6);
  scene.add(key, rim);

  /* --- dimensions (world units) --- */
  const W = 2.2, H = 0.36, DP = 1.6, R = 0.07, G0 = 0.045;
  const N = D.LAYERS.length;
  const MID = (N - 1) / 2;
  const PITCH = H + G0;
  const DIAG = Math.hypot(W, DP);

  const tex = makeSurfaceTextures(renderer);
  await yieldTask();
  const slabGeo = new RoundedBoxGeometry(W, H, DP, 5, R);
  remapUVs(slabGeo, 2.4);
  const bandGeo = new THREE.ExtrudeGeometry(roundedRectShape(W + 0.016, DP + 0.016, R + 0.008), { depth: 0.014, bevelEnabled: false, curveSegments: 10 });
  bandGeo.rotateX(-Math.PI / 2);
  bandGeo.translate(0, H / 2 - R - 0.028, 0);

  const rig = new THREE.Group();
  scene.add(rig);

  const slabs = D.LAYERS.map((layer, i) => {
    const col = new THREE.Color(layer.colour);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: tex.map,
      metalness: 0.6, roughness: 0.42,
      clearcoat: 0.55, clearcoatRoughness: 0.3,
      emissive: col, emissiveMap: tex.glow, emissiveIntensity: 0.32
    });
    const g = new THREE.Group();
    const body = new THREE.Mesh(slabGeo, mat);
    const band = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.35), toneMapped: false }));
    g.add(body, band);
    rig.add(g);
    return { g, mat, band, bandCol: col.clone().multiplyScalar(1.35), baseY: (MID - i) * PITCH, k: Math.abs(i - MID) };
  });

  /* soft contact shadow under the stack */
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(DIAG * 1.9, DIAG * 1.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  rig.add(shadow);

  /* --- packets: InstancedMesh of capsules + an additive halo --- */
  const PN = 44;
  const pr = rng(4821);
  const packets = [];
  for (let i = 0; i < PN; i++) {
    const down = pr() < 0.6; // requests go down, responses come back up
    packets.push({
      x: (pr() - 0.5) * W * 0.72, z: (pr() - 0.5) * DP * 0.72,
      down, speed: 0.9 + pr() * 1.7, phase: pr(), len: 0.8 + pr() * 0.5
    });
  }
  const capGeo = new THREE.CapsuleGeometry(0.026, 0.13, 4, 10);
  const pMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const hMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const pMesh = new THREE.InstancedMesh(capGeo, pMat, PN);
  const hMesh = new THREE.InstancedMesh(capGeo, hMat, PN);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const green = new THREE.Color('#5fd39a'), blue = new THREE.Color('#7fb0ff');
  packets.forEach((pk, i) => { pMesh.setColorAt(i, pk.down ? green : blue); hMesh.setColorAt(i, pk.down ? green : blue); });
  pMesh.frustumCulled = hMesh.frustumCulled = false;
  rig.add(pMesh, hMesh);

  /* --- layout state --- */
  let cw = 1, ch = 1;
  let narrow = false;
  let intro = SITE.reduced || SITE.loader.finished ? 1 : 0;
  let current = SITE.hero.progress;
  let visible = true;
  let dirty = true;
  let firstFrame = false;

  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function fitDistance(stackH, fracH, fracW, elev) {
    const t = tanHalf();
    const projH = stackH * Math.cos(elev) + DIAG * Math.sin(elev);
    const dH = projH / (2 * t * fracH);
    const dW = DIAG / (2 * t * camera.aspect * fracW);
    return Math.max(dH, dW) + DIAG * 0.35;
  }
  const spread = () => (narrow ? 0.3 : 0.62);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  /* Pose the stack for progress p. Pure: same inputs -> same frame.
     `look` (About's re-framing) adds per-layer glow + lift and overrides the turn. */
  function poseStack(p, introV, look) {
    const ex = easeInOut(range(p, 0.05, 0.5));
    const sp = spread();

    // slabs: staggered separation (outer slabs lead), slight differential twist
    let topY = -Infinity, botY = Infinity;
    for (let i = 0; i < N; i++) {
      const s = slabs[i];
      const st = 0.05 + (MID - s.k) * 0.03;
      const e = easeInOut(range(p, st, st + 0.36));
      const drop = 1 - easeOut(range(introV, (N - 1 - i) * 0.07, (N - 1 - i) * 0.07 + 0.5));
      const y = s.baseY + (MID - i) * sp * e + drop * (5 + (N - i) * 0.35);
      s.g.position.y = y;
      s.g.rotation.y = (i - MID) * 0.022 * e;
      const lift = look ? look.lift[i] : 0;
      const glow = look ? look.glow[i] : -1;
      s.g.position.x = lift * 0.34;
      s.g.position.z = lift * 0.3;
      s.mat.emissiveIntensity = glow < 0 ? 0.32 : 0.06 + 0.9 * glow;
      s.band.material.color.copy(s.bandCol).multiplyScalar(glow < 0 ? 1 : 0.22 + 0.9 * glow);
      if (i === 0) topY = y; if (i === N - 1) botY = y;
    }
    shadow.position.y = botY - H / 2 - 0.004;
    shadow.material.opacity = 0.9 - ex * 0.35;

    // rig: ~35° turn across the explosion
    rig.rotation.y = look ? look.rot : lerp(-0.24, -0.24 + THREE.MathUtils.degToRad(35), easeInOut(range(p, 0.04, 0.52)));
    return { ex, sp, topY, botY };
  }

  function pose(p, introV) {
    const { ex, sp, topY, botY } = poseStack(p, introV, null);

    // camera: elevation rises and the camera pulls back so the exploded stack fits
    const elev = THREE.MathUtils.degToRad(lerp(12, 24, ex));
    const hWhole = N * H + (N - 1) * G0;
    const hEx = hWhole + (N - 1) * sp;
    const dWhole = narrow ? fitDistance(hWhole, 0.74, 0.78, elev) : fitDistance(hWhole, 0.6, 0.5, elev);
    const dEx = narrow ? fitDistance(hEx, 0.86, 0.6, elev) : fitDistance(hEx, 0.76, 0.5, elev);
    const dist = lerp(dWhole, dEx, ex);
    camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, -0.06 * ex, 0);

    // narrow screens: slide the stack left to make room for right-hand tags
    const shift = narrow ? easeInOut(range(p, 0.36, 0.5)) * cw * 0.15 : 0;
    camera.setViewOffset(cw, ch, shift, 0, cw, ch);

    // packets ride the column between the top and bottom slabs
    const yTop = topY + H / 2 - 0.03, yBot = botY - H / 2 + 0.03;
    const amt = range(p, 0.14, 0.27);
    const q = p * 4.2;
    for (let i = 0; i < PN; i++) {
      const pk = packets[i];
      const f = frac(pk.phase + pk.speed * q);
      const y = pk.down ? lerp(yTop, yBot, f) : lerp(yBot, yTop, f);
      const fade = Math.min(1, f / 0.05, (1 - f) / 0.05);
      const sc = amt * fade;
      _p.set(pk.x, y, pk.z);
      _q.identity();
      _s.set(sc, sc * pk.len, sc);
      _m.compose(_p, _q, _s); pMesh.setMatrixAt(i, _m);
      _s.set(sc * 2.6, sc * pk.len * 1.5, sc * 2.6);
      _m.compose(_p, _q, _s); hMesh.setMatrixAt(i, _m);
    }
    pMesh.instanceMatrix.needsUpdate = true;
    hMesh.instanceMatrix.needsUpdate = true;

    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
  }

  /* Project a local slab point to canvas px. */
  const _v = new THREE.Vector3();
  function project(obj, x, y, z) {
    _v.set(x, y, z).applyMatrix4(obj.matrixWorld).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * cw, y: (-_v.y * 0.5 + 0.5) * ch };
  }

  /* Tag anchors: the silhouette corner of each slab at mid-height. */
  const corners = [[-W / 2, -DP / 2], [W / 2, -DP / 2], [W / 2, DP / 2], [-W / 2, DP / 2]];
  function anchors() {
    return slabs.map((s, i) => {
      const side = narrow ? 'right' : i % 2 === 0 ? 'right' : 'left';
      let best = null;
      for (const [x, z] of corners) {
        const pt = project(s.g, x, 0, z);
        if (!best || (side === 'right' ? pt.x > best.x : pt.x < best.x)) best = pt;
      }
      best.side = side;
      return best;
    });
  }

  /* Whole-state projected bounds (for sizing SAI / KUMAR). */
  function measure() {
    pose(0, 1);
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (const s of slabs) {
      for (const [x, z] of corners) {
        for (const y of [-H / 2, H / 2]) {
          const pt = project(s.g, x, y, z);
          l = Math.min(l, pt.x); r = Math.max(r, pt.x); t = Math.min(t, pt.y); b = Math.max(b, pt.y);
        }
      }
    }
    pose(current, intro);
    return { l, r, t, b };
  }

  function draw() {
    pose(current, intro);
    renderer.render(scene, camera);
    dirty = false;
    if (!firstFrame) { firstFrame = true; SITE.loader.step('frame'); }
    return anchors();
  }

  function resize() {
    cw = Math.max(1, wrap.clientWidth);
    ch = Math.max(1, wrap.clientHeight);
    narrow = cw <= 760;
    renderer.setPixelRatio(SITE.dprCap());
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  resize();
  pose(current, intro);
  // non-blocking shader compile where the GPU supports it (otherwise the first render compiles)
  if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
  new ResizeObserver(() => { resize(); SITE.hero.onSceneResize(); }).observe(wrap);

  watchVisibility(canvas, v => { visible = v; if (v && dirty) SITE.hero.invalidate(); });

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); SITE.hero.sceneFailed(); });

  /* Shared renderer: draw another scene/camera into the corner of this
     renderer's buffer and copy it onto a 2D canvas, so one WebGL context
     serves every scene on the page. The hero is redrawn right after if it
     is on screen; otherwise it is marked dirty for when it returns. */
  function renderTo(target, ctx, sc, cam, cssW, cssH) {
    const pr = renderer.getPixelRatio();
    const k = Math.min(1, cw / cssW, ch / cssH);
    const vw = Math.max(1, Math.floor(cssW * k)), vh = Math.max(1, Math.floor(cssH * k));
    renderer.setViewport(0, 0, vw, vh);
    renderer.setScissor(0, 0, vw, vh);
    renderer.setScissorTest(true);
    renderer.render(sc, cam);
    const src = renderer.domElement;
    const sw = Math.min(src.width, Math.round(vw * pr)), sh = Math.min(src.height, Math.round(vh * pr));
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(src, 0, src.height - sh, sw, sh, 0, 0, target.width, target.height);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    dirty = true;
    if (visible) draw();
  }

  /* Size a 2D target canvas's backing store to its CSS box. */
  function fitTarget(target) {
    const pr = renderer.getPixelRatio();
    const w = Math.max(1, target.clientWidth), h = Math.max(1, target.clientHeight);
    const bw = Math.round(w * pr), bh = Math.round(h * pr);
    if (target.width !== bw || target.height !== bh) { target.width = bw; target.height = bh; }
    return { w, h };
  }

  /* About (Ch 01): the same monolith, reassembled and re-framed by its own
     camera. `look` = { rot, glow[8], lift[8] } computed from scroll in main.js. */
  function aboutView(target) {
    const ctx = target.getContext('2d');
    const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    let w = 1, h = 1, vis = false, pending = null;
    function frame(look) {
      ({ w, h } = fitTarget(target));
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      poseStack(0, 1, look);
      pMesh.visible = hMesh.visible = false;
      const elev = THREE.MathUtils.degToRad(15);
      const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const hWhole = N * H + (N - 1) * G0;
      const projH = hWhole * Math.cos(elev) + DIAG * Math.sin(elev);
      const dist = Math.max(projH / (2 * t * 0.8), (DIAG + 0.7) / (2 * t * cam.aspect * 0.86)) + DIAG * 0.35;
      cam.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
      cam.lookAt(0.12, 0, 0);
      scene.updateMatrixWorld(true);
      renderTo(target, ctx, scene, cam, w, h);
      pMesh.visible = hMesh.visible = true;
    }
    new ResizeObserver(() => { if (pending && vis) frame(pending); }).observe(target);
    watchVisibility(target, v => { vis = v; if (v && pending) frame(pending); });
    return { render(look) { pending = look; if (vis) frame(look); } };
  }

  const api = {
    renderTo, fitTarget, aboutView,
    render(p) {
      current = p;
      if (!visible) { dirty = true; return null; }
      return draw();
    },
    measure,
    setIntro(v) { intro = v; },
    /* Render one frame at a fixed size (used once to export assets/og.png). */
    exportFrame(w, h, p) {
      const prev = { cw, ch, dpr: renderer.getPixelRatio() };
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      cw = w; ch = h; narrow = false;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const saved = current;
      current = p;
      const a = draw();
      const url = canvas.toDataURL('image/png');
      current = saved;
      renderer.setPixelRatio(prev.dpr);
      resize();
      SITE.hero.invalidate();
      return { url, anchors: a, layers: D.LAYERS };
    }
  };
  return api;
}

/* ==========================================================================
   Toolset (Ch 02): skills as nodes on a slowly turning sphere, clustered by
   group. Drawn through the hero's shared renderer.
   ========================================================================== */
function createToolset(shared) {
  const wrap = document.getElementById('tools-canvas-wrap');
  const target = document.getElementById('tools-canvas');
  const ctx = target.getContext('2d');
  const labelLayer = document.getElementById('tools-labels');
  const T = SITE.toolset;
  const reduced = SITE.reduced;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08090a, 4, 9);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const R = 1.6;
  const pivot = new THREE.Group();
  pivot.rotation.set(0.12, 0, -0.07);
  scene.add(pivot);
  const spin = new THREE.Group();
  pivot.add(spin);

  /* dust shell + equator, for structure */
  const DN = 560;
  const dpos = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) {
    const y = 1 - (i / (DN - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    dpos.set([Math.cos(a) * r * R, y * R, Math.sin(a) * r * R], i * 3);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  spin.add(new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0x5b6472, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false })));
  const ringPts = [];
  for (let i = 0; i < 128; i++) { const a = (i / 128) * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); }
  spin.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0x232830, transparent: true, opacity: 0.8 })));

  /* groups on alternating latitudes, items spiralled around each centre */
  const G = D.SKILLS.length;
  const groups = D.SKILLS.map((g, gi) => {
    const lon = (gi / G) * Math.PI * 2, lat = (gi % 2 ? -1 : 1) * 0.34;
    const c = new THREE.Vector3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
    const east = new THREE.Vector3(Math.cos(lon), 0, -Math.sin(lon));
    const north = new THREE.Vector3().crossVectors(c, east).normalize();
    return { lon, lat, c, east, north, colour: new THREE.Color(g.colour), w: { v: 0 }, nodes: [] };
  });
  const nodes = [];
  D.SKILLS.forEach((g, gi) => {
    const gr = groups[gi], n = g.items.length;
    g.items.forEach((label, j) => {
      const r = 0.4 * Math.sqrt((j + 0.5) / n), a = j * 2.399963 + gi;
      const dir = gr.c.clone().multiplyScalar(Math.cos(r))
        .add(gr.east.clone().multiplyScalar(Math.cos(a) * Math.sin(r)))
        .add(gr.north.clone().multiplyScalar(Math.sin(a) * Math.sin(r))).normalize();
      const node = { gi, j, label, dir, lon: Math.atan2(dir.x, dir.z), lat: Math.asin(dir.y), pos: new THREE.Vector3(), el: null, shown: false };
      gr.nodes.push(node);
      nodes.push(node);
    });
  });

  /* edges: a small tree inside each group + a ring through the groups */
  const edges = [];
  groups.forEach(gr => gr.nodes.forEach((nd, j) => {
    if (!j) return;
    let best = gr.nodes[0], bd = Infinity;
    for (let k = 0; k < j; k++) { const d = gr.nodes[k].dir.distanceTo(nd.dir); if (d < bd) { bd = d; best = gr.nodes[k]; } }
    edges.push([best, nd, gr]);
  }));
  groups.forEach((gr, gi) => edges.push([gr.nodes[0], groups[(gi + 1) % G].nodes[0], null]));
  const epos = new Float32Array(edges.length * 6), ecol = new Float32Array(edges.length * 6);
  const egeo = new THREE.BufferGeometry();
  egeo.setAttribute('position', new THREE.BufferAttribute(epos, 3).setUsage(THREE.DynamicDrawUsage));
  egeo.setAttribute('color', new THREE.BufferAttribute(ecol, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, toneMapped: false }));
  lines.frustumCulled = false;
  spin.add(lines);

  const NN = nodes.length;
  const ngeo = new THREE.SphereGeometry(0.042, 16, 12);
  const dots = new THREE.InstancedMesh(ngeo, new THREE.MeshBasicMaterial({ toneMapped: false }), NN);
  const halos = new THREE.InstancedMesh(ngeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }), NN);
  dots.frustumCulled = halos.frustumCulled = false;
  spin.add(dots, halos);

  /* labels (HTML): one per node + one per group */
  const mkLabel = (text, colour, cls) => {
    const el = document.createElement('span');
    el.className = 'node-label' + (cls ? ' ' + cls : '');
    el.style.setProperty('--c', colour);
    el.innerHTML = '<i></i>';
    el.appendChild(document.createTextNode(text));
    labelLayer.appendChild(el);
    return el;
  };
  nodes.forEach(nd => { nd.el = mkLabel(nd.label, D.SKILLS[nd.gi].colour); });
  groups.forEach((gr, gi) => { gr.el = mkLabel(D.SKILLS[gi].group, D.SKILLS[gi].colour, 'node-label--group'); gr.shown = false; });

  /* state */
  const TILT = 0.12;
  const st = { rot: -groups[0].lon + 0.35, tilt: TILT, vel: 0, dim: { v: 0 }, sel: -1, hover: -1, focus: -1, dragging: false, tween: null };
  let w = 1, h = 1, vis = false, needs = true;

  function resize() {
    ({ w, h } = shared.fitTarget(target));
    cam.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = (R * 1.38) / (t * Math.min(1, cam.aspect));
    cam.position.set(0, 0, dist);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    scene.fog.near = dist - R * 0.4;
    scene.fog.far = dist + R * 1.9;
    needs = true;
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3(), _camDir = new THREE.Vector3();
  const bright = gi => { const d = st.dim.v, wv = groups[gi].w.v; return (1 - d) + d * (0.2 + 1.2 * wv); };
  const facing = v => { _v.copy(v).normalize(); return _v.dot(_camDir); };
  function screen(v) { _v.copy(v).project(cam); return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h }; }

  function frame() {
    spin.rotation.y = st.rot;
    pivot.rotation.x = st.tilt;
    scene.updateMatrixWorld(true);
    _camDir.copy(cam.position).normalize();

    nodes.forEach((nd, i) => {
      const gr = groups[nd.gi], lift = 1 + 0.2 * gr.w.v;
      nd.pos.copy(nd.dir).multiplyScalar(R * lift);
      const b = bright(nd.gi), sc = (1 + 0.3 * gr.w.v) * (i === st.focus || i === st.hover ? 1.45 : 1);
      _s.set(sc, sc, sc);
      _m.compose(nd.pos, _q, _s); dots.setMatrixAt(i, _m);
      _s.multiplyScalar(2.3);
      _m.compose(nd.pos, _q, _s); halos.setMatrixAt(i, _m);
      _c.copy(gr.colour).multiplyScalar(b);
      dots.setColorAt(i, _c); halos.setColorAt(i, _c);
    });
    dots.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = true;
    dots.instanceColor.needsUpdate = halos.instanceColor.needsUpdate = true;

    edges.forEach(([a, b, gr], k) => {
      epos.set([a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z], k * 6);
      if (gr) _c.copy(gr.colour).multiplyScalar(0.55 * bright(a.gi));
      else _c.setRGB(0.16, 0.18, 0.21).multiplyScalar(1 - st.dim.v * 0.5);
      ecol.set([_c.r, _c.g, _c.b, _c.r, _c.g, _c.b], k * 6);
    });
    egeo.attributes.position.needsUpdate = egeo.attributes.color.needsUpdate = true;

    shared.renderTo(target, ctx, scene, cam, w, h);

    // labels: selected group's tools, or group names when showing all; plus hover/focus
    const lit = st.focus >= 0 ? st.focus : st.hover;
    nodes.forEach((nd, i) => {
      const world = _v.copy(nd.pos).applyMatrix4(spin.matrixWorld).clone();
      const f = clamp01((facing(world) - 0.05) / 0.3);
      const o = i === lit ? 1 : groups[nd.gi].w.v * f;
      placeLabel(nd, world, o);
    });
    groups.forEach(gr => {
      const world = _v.copy(gr.c).multiplyScalar(R * 1.02).applyMatrix4(spin.matrixWorld).clone();
      const f = clamp01((facing(world) - 0.1) / 0.3);
      placeLabel(gr, world, (1 - st.dim.v) * f);
    });
    needs = false;
  }
  function placeLabel(item, world, o) {
    if (o < 0.02) { if (item.shown) { item.el.style.visibility = 'hidden'; item.shown = false; } return; }
    if (!item.shown) { item.el.style.visibility = 'visible'; item.shown = true; }
    const p = screen(world);
    item.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0)';
    item.el.style.opacity = o.toFixed(3);
  }

  /* loop: only while on screen */
  const AUTO = reduced ? 0 : 0.0022;
  function loop() {
    const dr = gsap.ticker.deltaRatio(60);
    if (!st.dragging && !st.tween) {
      if (Math.abs(st.vel) > 1e-5) { st.rot += st.vel * dr; st.vel *= Math.pow(0.93, dr); needs = true; }
      if (AUTO && st.hover < 0 && st.focus < 0) { st.rot += AUTO * dr; needs = true; }
    }
    if (needs) frame();
  }
  watchVisibility(wrap, v => {
    vis = v;
    if (v) { resize(); gsap.ticker.add(loop); } else gsap.ticker.remove(loop);
  });
  new ResizeObserver(() => { resize(); if (vis) frame(); }).observe(target);

  /* rotate so a longitude faces the camera, by the shortest way round */
  function turnTo(lon, lat) {
    let to = -lon;
    to += Math.PI * 2 * Math.round((st.rot - to) / (Math.PI * 2));
    turnBy(to - st.rot, lat);
  }
  /* turn (and tilt so `lat` sits at eye level; null = default tilt) */
  function turnBy(delta, lat) {
    if (st.tween) st.tween.kill();
    st.vel = 0;
    const tilt = lat == null ? st.tilt : lat;
    st.tween = gsap.to(st, { rot: st.rot + delta, tilt, duration: reduced ? 0 : 0.9, ease: 'power3.inOut', onUpdate: () => { needs = true; }, onComplete: () => { st.tween = null; needs = true; } });
  }

  /* drag (horizontal) — vertical swipes still scroll the page via touch-action: pan-y */
  let lastX = 0, lastT = 0;
  wrap.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    st.dragging = true; lastX = e.clientX; lastT = performance.now();
    if (st.tween) { st.tween.kill(); st.tween = null; }
    st.vel = 0;
    wrap.setPointerCapture(e.pointerId);
    wrap.classList.add('is-dragging');
  });
  wrap.addEventListener('pointermove', e => {
    if (st.dragging) {
      const dx = e.clientX - lastX, now = performance.now();
      const d = dx * 0.0075;
      st.rot += d;
      st.vel = d / Math.max(1, (now - lastT) / 16.7);
      lastX = e.clientX; lastT = now;
      needs = true;
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const r = target.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = -1, bd = 22 * 22;
    nodes.forEach((nd, i) => {
      const world = _v.copy(nd.pos).applyMatrix4(spin.matrixWorld).clone();
      if (facing(world) < 0.05) return;
      const p = screen(world), d = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    if (best !== st.hover) { st.hover = best; needs = true; }
  });
  const endDrag = () => { st.dragging = false; wrap.classList.remove('is-dragging'); };
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);
  wrap.addEventListener('pointerleave', () => { if (st.hover !== -1) { st.hover = -1; needs = true; } });
  wrap.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); turnBy(-0.5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); turnBy(0.5); }
  });

  /* panel -> scene */
  function select(gi) {
    st.sel = gi;
    const d = reduced ? 0 : 0.8;
    gsap.to(st.dim, { v: gi < 0 ? 0 : 1, duration: d, ease: 'power3.out', onUpdate: () => { needs = true; } });
    groups.forEach((gr, k) => gsap.to(gr.w, { v: k === gi ? 1 : 0, duration: d, ease: 'power3.out', onUpdate: () => { needs = true; } }));
    if (gi >= 0) turnTo(groups[gi].lon, groups[gi].lat);
    else turnBy(0, TILT);
  }
  T.on((type, v) => {
    if (type === 'select') select(v);
    if (type === 'focus') {
      st.focus = v == null ? -1 : nodes.findIndex(nd => nd.gi === v[0] && nd.j === v[1]);
      if (st.focus >= 0) turnTo(nodes[st.focus].lon, nodes[st.focus].lat);
      needs = true;
    }
  });
  if (T.selected >= 0) select(T.selected);
  resize();
}

/* ==========================================================================
   Boot
   ========================================================================== */
if (SITE) {
  SITE.loader.step('three');
  if (SITE.webgl) {
    try {
      const hero = await createHero();
      SITE.heroScene = hero;
      SITE.hero.attachScene(hero);
      if (SITE.about) SITE.about.attachView(hero.aboutView(document.getElementById('about-canvas')));
      // Defer the toolset scene until its section nears the viewport.
      const stack = document.getElementById('stack');
      if (stack && SITE.toolset) {
        const io = new IntersectionObserver(entries => {
          if (!entries.some(e => e.isIntersecting)) return;
          io.disconnect();
          try { createToolset(hero); SITE.toolset.sceneReady(); } catch (err) { SITE.toolset.sceneFailed(); }
        }, { rootMargin: '100% 0px' });
        io.observe(stack);
      }
    } catch (err) {
      SITE.hero.sceneFailed();
    }
  }
}
