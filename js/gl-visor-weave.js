import * as THREE from 'three';

// Visual construction study from the original Aq / Qo_2 sample photographs.
// The plan outline is the existing Visor outline; ply and wire dimensions are
// illustrative scene units, not supplier specifications or measured millimetres.
export function createQuboSample(w, h, coarse = false, woven = false) {
  const group = new THREE.Group();
  group.name = woven ? 'At · laminated woven metal' : 'Aq · laminated woven metal';
  const outline = swatchOutline(w, h);
  const plyThickness = 0.036;
  const coreThickness = 0.024;
  const paneGeo = beveledSlab(outline, plyThickness, 0.004);
  const paneMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.025,
    transmission: 1, thickness: 0.076, ior: 1.5,
    attenuationColor: new THREE.Color('#dcebe3'), attenuationDistance: 2.8,
    envMapIntensity: 1.0, specularIntensity: 1.0,
    side: THREE.FrontSide,
  });
  const front = new THREE.Mesh(paneGeo, paneMat);
  const back = new THREE.Mesh(paneGeo, paneMat);
  front.name = 'Front glass ply';
  back.name = 'Rear glass ply';
  const paneOffset = (plyThickness + coreThickness) / 2;
  front.position.z = paneOffset;
  back.position.z = -paneOffset;
  group.add(front, back);

  // Two thin interlayer solids are represented at their perimeter in the
  // assembled state. A matched glass/polymer interface is almost invisible
  // face-on. Avoid adding coincident transmissive faces to the realtime pass.
  const filmMat = new THREE.MeshPhysicalMaterial({
    color: '#f0e9d2', metalness: 0, roughness: 0.18,
    transmission: 0.98, thickness: coreThickness / 2, ior: 1.48,
    attenuationColor: new THREE.Color('#efe8cd'), attenuationDistance: 4,
    envMapIntensity: 0.45,
  });
  const filmGeo = beveledSlab(swatchOutline(w - 0.006, h - 0.006), coreThickness / 2, 0.001);
  const filmFront = new THREE.Mesh(filmGeo, filmMat);
  const filmBack = new THREE.Mesh(filmGeo, filmMat);
  filmFront.name = 'Front interlayer';
  filmBack.name = 'Rear interlayer';
  group.add(filmFront, filmBack);

  const edgeMat = new THREE.MeshPhysicalMaterial({
    color: '#c6d9ce', metalness: 0.08, roughness: 0.2,
    transparent: true, opacity: 0.4, depthWrite: false,
    envMapIntensity: 0.65, side: THREE.DoubleSide,
  });
  // Narrow edge ribbons make the two independently beveled plies readable
  // from the side without outlining the faces in opaque white lines.
  const edgeGeo = perimeterBand(outline, plyThickness - 0.008);
  const frontEdge = new THREE.Mesh(edgeGeo, edgeMat);
  const backEdge = new THREE.Mesh(edgeGeo, edgeMat);
  front.add(frontEdge);
  back.add(backEdge);
  const bond = new THREE.Mesh(perimeterBand(swatchOutline(w - 0.009, h - 0.009), coreThickness),
    new THREE.MeshStandardMaterial({ color: '#b8b19b', roughness: 0.3,
      metalness: 0.15, transparent: true, opacity: 0.32, depthWrite: false,
      side: THREE.DoubleSide }));
  bond.name = 'Bond line at laminate edge';
  group.add(bond);

  const wireMat = new THREE.MeshStandardMaterial({
    color: woven ? '#9e9277' : '#a68e57', metalness: 0.88, roughness: 0.32,
    envMapIntensity: 1.05,
  });
  const wire = new THREE.Mesh(wovenWireGeometry(w, h, coarse, woven ? 92 : 64), wireMat);
  wire.name = woven ? 'Tejida · continuous metallic weave' : 'Qubo · continuous metallic weave';
  group.add(wire);

  let separation = 0;
  function setSeparation(value) {
    separation = value;
    front.position.z = paneOffset + value * 0.62;
    back.position.z = -paneOffset - value * 0.62;
    filmFront.position.z = coreThickness / 4 + value * 0.28;
    filmBack.position.z = -coreThickness / 4 - value * 0.28;
    filmFront.visible = filmBack.visible = value > 0.001;
    bond.visible = value < 0.001;
  }
  setSeparation(0);

  return {
    group,
    setSeparation,
    get separation() { return separation; },
    setClarity(pct) {
      // Change optical absorption, never the model's actual layer thickness.
      paneMat.attenuationDistance = 2.8 * (0.25 + (pct / 100) * 1.25);
    },
    setLight(pct) {
      const p = pct / 100;
      paneMat.envMapIntensity = 0.4 + p * 0.4;
      wireMat.envMapIntensity = 0.5 + p * 0.9;
    },
  };
}

export function makeQuboStudio() {
  const studio = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.18, 0.17), side: THREE.BackSide }));
  studio.add(room);
  function softbox(w, h, x, y, z, strength) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(strength, strength, strength * 0.97), side: THREE.DoubleSide }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  softbox(0.9, 6.0, -4.4, 1.6, 4.0, 2.4);
  softbox(3.0, 4.0, 4.5, 2.2, 3.5, 1.2);
  softbox(5.5, 1.4, 0, 5.8, 1.0, 2.0);
  softbox(1.0, 5.5, 3.5, 0.0, -4.8, 1.7);
  return studio;
}

export function swatchOutline(w, h) {
  const x = w / 2, y = h / 2, cut = Math.min(w, h) * 0.26;
  return [new THREE.Vector2(-x, -y), new THREE.Vector2(x - cut, -y),
    new THREE.Vector2(x, -y + cut), new THREE.Vector2(x, y),
    new THREE.Vector2(-x + cut, y), new THREE.Vector2(-x, y - cut)];
}

export function beveledSlab(outline, thickness, bevel) {
  // ExtrudeGeometry expands the bevel outwards. Offset the source polygon
  // inward so the widest ring retains the exact original silhouette.
  const inset = insetPolygon(outline, bevel);
  const shape = new THREE.Shape(inset);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel, steps: 1,
    bevelEnabled: true, bevelSegments: 3, bevelSize: bevel,
    bevelThickness: bevel, curveSegments: 1,
  });
  geo.translate(0, 0, -thickness / 2 + bevel);
  return geo;
}

function insetPolygon(points, distance) {
  return points.map((p, i) => {
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const a = p.clone().sub(prev).normalize();
    const b = next.clone().sub(p).normalize();
    const na = new THREE.Vector2(-a.y, a.x), nb = new THREE.Vector2(-b.y, b.x);
    return p.clone().add(na.clone().add(nb).multiplyScalar(distance / (1 + na.dot(nb))));
  });
}

export function perimeterBand(points, thickness) {
  const pos = [], indices = [];
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    const start = pos.length / 3;
    pos.push(p.x, p.y, -thickness / 2, next.x, next.y, -thickness / 2,
      next.x, next.y, thickness / 2, p.x, p.y, thickness / 2);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function wovenWireGeometry(w, h, coarse, countAcross = 64) {
  const pitch = w / countAcross;
  const radius = pitch * 0.12, amplitude = radius * 1.03;
  const inset = 0.055;
  const poly = insetPolygon(swatchOutline(w, h), inset + radius);
  const sides = coarse ? 5 : 6, samples = coarse ? 3 : 4;
  const positions = [], normals = [], indices = [];

  // Intersect each continuous wire with the inset polygon, including its
  // diagonal cuts. This trims the real weave to the sample outline.
  function limits(fixed, vertical) {
    const hits = [];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const a = vertical ? p.x : p.y, b = vertical ? q.x : q.y;
      if (Math.abs(b - a) < 1e-8) return;
      const t = (fixed - a) / (b - a);
      if (t >= 0 && t <= 1) hits.push(vertical ? p.y + t * (q.y - p.y) : p.x + t * (q.x - p.x));
    });
    return hits.length >= 2 ? [Math.min(...hits), Math.max(...hits)] : null;
  }

  function strand(fixed, index, vertical) {
    const range = limits(fixed, vertical);
    if (!range) return;
    const [start, end] = range;
    const count = Math.ceil((end - start) / pitch * samples);
    const base = positions.length / 3;
    // At every crossing warp is above weft, then below at the next crossing.
    // Opposite phases ensure strands do not intersect at their centers.
    const sign = (index % 2 === 0 ? 1 : -1) * (vertical ? 1 : -1);
    for (let j = 0; j <= count; j++) {
      const t = start + (end - start) * j / count;
      const phase = Math.PI * t / pitch;
      const z = sign * amplitude * Math.cos(phase);
      const slope = -sign * amplitude * Math.PI / pitch * Math.sin(phase);
      const length = Math.sqrt(1 + slope * slope);
      for (let k = 0; k <= sides; k++) {
        const theta = k / sides * Math.PI * 2;
        const c = Math.cos(theta), s = Math.sin(theta);
        const nx = vertical ? c : -s * slope / length;
        const ny = vertical ? -s * slope / length : c;
        const nz = s / length;
        positions.push((vertical ? fixed : t) + nx * radius,
          (vertical ? t : fixed) + ny * radius, z + nz * radius);
        normals.push(nx, ny, nz);
      }
    }
    for (let j = 0; j < count; j++) {
      for (let k = 0; k < sides; k++) {
        const a = base + j * (sides + 1) + k, b = a + sides + 1;
        if (vertical) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    // Close cut wire ends, which can be seen along the clear glass margin.
    for (const endRing of [0, count]) {
      const center = positions.length / 3;
      const t = endRing ? end : start;
      positions.push(vertical ? fixed : t, vertical ? t : fixed,
        sign * amplitude * Math.cos(Math.PI * t / pitch));
      normals.push(vertical ? 0 : (endRing ? 1 : -1), vertical ? (endRing ? 1 : -1) : 0, 0);
      for (let k = 0; k < sides; k++) {
        const a = base + endRing * (sides + 1) + k;
        if ((vertical && !endRing) || (!vertical && endRing)) indices.push(center, a, a + 1);
        else indices.push(center, a + 1, a);
      }
    }
  }
  for (let i = Math.ceil(-w / 2 / pitch); i <= Math.floor(w / 2 / pitch); i++) strand(i * pitch, i, true);
  for (let j = Math.ceil(-h / 2 / pitch); j <= Math.floor(h / 2 / pitch); j++) strand(j * pitch, j, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export function makeQuboBackdrop() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 768;
  const ctx = canvas.getContext('2d');
  const wash = ctx.createRadialGradient(330, 280, 20, 480, 360, 750);
  wash.addColorStop(0, '#575b56');
  wash.addColorStop(0.5, '#303634');
  wash.addColorStop(1, '#111716');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1024, 768);
  // A quiet studio wall gives clear openings a readable background, without
  // the old white stripe masking the metal detail across the whole sample.
  const light = ctx.createLinearGradient(220, 0, 560, 0);
  light.addColorStop(0, 'rgba(210,214,204,0)');
  light.addColorStop(0.48, 'rgba(210,214,204,0.08)');
  light.addColorStop(0.52, 'rgba(210,214,204,0.08)');
  light.addColorStop(1, 'rgba(210,214,204,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 1024, 768);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
