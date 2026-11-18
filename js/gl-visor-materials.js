import * as THREE from 'three';
import {swatchOutline, beveledSlab, perimeterBand, createQuboSample} from './gl-visor-weave.js?v=1';

// [nombre, descripción, kind]. kind picks the construction; per-code
// deviations (tint, flute pitch, acid-etched face, film colour, mesh gauge)
// live in TINT, SPEC and MESH below.
export const presets = {
 Vc:['Claro','Transparencia limpia, un matiz verde en el canto y reflejos suaves.','plain'],
 Vu:['Ultraclaro','Más transparente que el claro: el canto pierde el matiz verde y los colores pasan sin cambio.','plain'],
 Vp:['Pacífica','Un azul cobalto intenso y transparente, teñido en toda la masa del vidrio.','plain'],
 Vi:['Indigo','Azul acero transparente, más frío y apagado que el Pacífica.','plain'],
 Vb:['Bronce','Un tono bronce cálido y transparente que oscurece la luz sin apagarla.','plain'],
 Vg:['Gris','Gris humo transparente. Baja el brillo y mantiene los colores neutros.','plain'],
 Va:['Acanalado','Canales verticales de relieve bajo. La luz se ondula sin romper la silueta del fondo.','reed'],
 Val:['Acanalado lite','Canales más finos y de menor relieve que el acanalado. El fondo se reconoce mejor.','reed'],
 Ve:['Esmerilado','Una superficie satinada que difunde la luz y suaviza lo que hay detrás.','frost'],
 Vt:['Texturizado','Un relieve martillado de pequeñas gotas que dispersa la luz y desdibuja el fondo.','stipple'],
 Vd:['Diamante','Una trama fina de pequeños relieves facetados, con destellos contenidos.','diamond'],
 Veb:['Eva blanca','Una lámina EVA blanca entre dos vidrios. Opaco, blanco lechoso y con el brillo del vidrio.','eva'],
 Ven:['Eva negra','Una lámina EVA negra entre dos vidrios. Opaco y profundo, con el reflejo del vidrio por delante.','eva'],
 Vab:['Acanalado bronce','Canales suaves sobre un vidrio de tono bronce transparente.','reed'],
 Vag:['Acanalado gris','Los canales del acanalado sobre un vidrio gris humo transparente.','reed'],
 Gr:['Gradient','Transiciones transparentes de ámbar, vino y azul, integradas entre los vidrios.','gradient'],
 Gra:['Gradient acidado','El degradado del Gradient bajo una cara acidada: el color se vuelve difuso y la vista se cierra.','gradient'],
 Ds:['Dichroic Sunset','Color que cambia con el ángulo: de rosa cálido a oro y verde azulado.','dichroic'],
 Dsa:['Dichroic acidado','La película dicroica bajo una cara acidada. Los cambios de color se funden en un velo.','dichroic'],
 In:['Interlayer','Una interlámina azul transparente entre dos hojas de vidrio.','color'],
 Ina:['Interlayer acidado','Una interlámina de color bajo una cara acidada. Aquí en rosa, suave y translúcido.','color'],
 Imc:['Impresión cuadros','Una retícula negra impresa en la interlámina, entre dos vidrios claros.','print'],
 Iml:['Impresión líneas','Bandas verticales negras impresas en la interlámina, entre dos vidrios claros.','print'],
 Tl:['Tela lino','Un tejido muy fino de tono lino claro, protegido entre dos vidrios. Filtra la luz como una cortina.','textile'],
 Ae:['Malla SA-Entramado','Un entramado de hilo grueso en gris topo, denso y de poros pequeños.','mesh'],
 Ap:['Malla SA-Pulida','Hilos claros y brillantes en un tejido abierto, como una arpillera metálica.','mesh'],
 Af:['Malla SA-Fabric','Un tejido metálico muy fino y cerrado que se lee como una tela.','textile'],
 Al:['Malla SA-Lisa','Una trama lisa y fina en gris plata, uniforme en toda la superficie.','textile'],
 Az:['Malla SA-Zigzag','Hilos metálicos en sarga quebrada: el tejido dibuja un zigzag que brilla con el ángulo.','textile'],
 Aq:['Malla SA-Qubo','Hilos metálicos que se cruzan por encima y por debajo, dentro de un laminado fino.','qubo'],
 Ah:['Malla SA-Herringbone','Hebras gruesas tejidas en espiga, de tono gris cálido y relieve marcado.','textile'],
 Ab:['Malla SA-Bilineal','Una retícula abierta de alambre fino plateado, con celdas rectangulares.','mesh'],
 At:['Malla SA-Tejida','Un tejido metálico más cerrado y de tono cálido, protegido entre dos vidrios.','woven'],
 Ac:['Malla SA-Cuadros','Una cuadrícula de alambre plateado de celdas cuadradas. Casi toda la luz pasa.','mesh'],
 Bq:['Malla SB-Qubo','La misma malla Qubo de la Serie A, en la línea alternativa.','qubo'],
 Be:['Malla SB-Entramado','Un entramado más abierto e irregular que el de la Serie A, en gris claro.','mesh'],
 Bl:['Malla SB-Lisa','Una malla cuadrada fina de tono latón, densa y cálida.','mesh'],
 Bp:['Malla SB-Pulida','La malla pulida en la línea alternativa: hilos claros y brillantes en un tejido abierto.','mesh'],
 Cm:['Malla SC-Mosquitera','Una mosquitera de alambre fino: celdas pequeñas y casi toda la luz pasa.','mesh'],
 Cn:['Malla SC-Negra','Una malla cuadrada negra que dibuja una retícula gráfica sobre el fondo.','mesh'],
 Ec:['Espejo claro','Un frente de vidrio limpio y un respaldo reflectante continuo.','mirror'],
 Eb:['Espejo bronce','Un vidrio bronce con respaldo reflectante. El reflejo se calienta y se oscurece.','mirror'],
 Eg:['Espejo gris','Un vidrio gris humo con respaldo reflectante. Un reflejo sobrio y más oscuro.','mirror'],
 Ei:['Espejo interlayer','Una interlámina de color laminada sobre un espejo. Aquí en ámbar cobrizo.','mirror-film'],
 Ep:['Espejo policromático','Un film degradado sobre espejo: el reflejo pasa del cobre al azul cielo.','mirror-film'],
 Ea:['Espejo acanalado','Los canales del acanalado sobre un espejo. El reflejo se parte en bandas verticales.','mirror-reed'],
 Eal:['Espejo acanalado lite','Canales finos sobre un espejo. Las bandas del reflejo son más estrechas.','mirror-reed'],
 Ed:['Espejo diamante','Pequeñas facetas de vidrio que fragmentan suavemente el reflejo.','mirror-diamond'],
 Ee:['Espejo esmerilado','Un frente satinado sobre un respaldo reflectante. El reflejo queda velado y suave.','mirror'],
 Eef:['Espejo esmerilado film','Un espejo de frente satinado con un film de color cobre laminado.','mirror-film'],
 Eep:['Espejo policromático esmerilado','El degradado del policromático bajo un frente satinado. El color se funde en un velo.','mirror-film'],
 Et:['Espejo texturizado','El relieve martillado del texturizado sobre un espejo. El reflejo se rompe en destellos.','mirror-stipple'],
 Etf:['Espejo texturizado film','Un espejo texturizado con un film dorado laminado: oro martillado.','mirror-film'],
 Etp:['Espejo texturizado poly','Cordones de relieve orgánico sobre un espejo policromático, del cobre al azul.','mirror-film'],
};
const W=3, H=2.15;

// Each grid cell is clipped to the original convex outline. No boundary
// vertices are snapped across a cut corner, so relief remains watertight.
export function reliefSlab(kind, thickness=.06, {flutes=20, depth=.04}={}) {
 if(kind==='diamond')return diamondSlab(thickness);
 const poly=swatchOutline(W,H), pos=[], norms=[], uv=[];
 const reed=kind==='reed', nx=reed?flutes*12:192, ny=reed?1:144;
 const height=(x,y)=>{
  if(reed) return depth*(1+Math.cos(x/W*flutes*Math.PI*2));
  const u=(x+y)/W*26, v=(x-y)/W*26;
  const tri=q=>Math.abs(2*(q-Math.floor(q)) - 1);
  return .008*(1-Math.max(tri(u),tri(v)));
 };
 const normal=(x,y)=>{const e=.0001;return new THREE.Vector3(-(height(x+e,y)-height(x-e,y))/(2*e),-(height(x,y+e)-height(x,y-e))/(2*e),1).normalize()};
 function clip(points){for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],out=[];const side=p=>(b.x-a.x)*(p[1]-a.y)-(b.y-a.y)*(p[0]-a.x);for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],sp=side(p),sq=side(q);if(sp>=-1e-9)out.push(p);if((sp>0&&sq<0)||(sp<0&&sq>0)){const t=sp/(sp-sq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}}points=out;if(!points.length)break}return points}
 function vertex(p,z,n){pos.push(p[0],p[1],z);norms.push(n.x,n.y,n.z);uv.push(p[0]/W+.5,p[1]/H+.5)}
 function face(points,back=false){for(let j=1;j<points.length-1;j++){const tri=back?[points[0],points[j+1],points[j]]:[points[0],points[j],points[j+1]];for(const p of tri)vertex(p,back?-thickness/2:thickness/2+height(...p),back?new THREE.Vector3(0,0,-1):normal(...p))}}
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){const a=-W/2+x*W/nx,b=-H/2+y*H/ny;const cell=clip([[a,b],[a+W/nx,b],[a+W/nx,b+H/ny],[a,b+H/ny]]);if(cell.length>2){face(cell);face(cell,true)}}
 // Split perimeter at all grid crossings to meet the clipped front exactly.
 for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y;let ts=[0,1];if(Math.abs(dx)>1e-9)for(let i=0;i<=nx;i++){const t=(-W/2+i*W/nx-a.x)/dx;if(t>0&&t<1)ts.push(t)}if(Math.abs(dy)>1e-9)for(let i=0;i<=ny;i++){const t=(-H/2+i*H/ny-a.y)/dy;if(t>0&&t<1)ts.push(t)}ts=[...new Set(ts)].sort((a,b)=>a-b);const n=new THREE.Vector3(dy,-dx,0).normalize();for(let i=0;i<ts.length-1;i++){const p=[a.x+dx*ts[i],a.y+dy*ts[i]],q=[a.x+dx*ts[i+1],a.y+dy*ts[i+1]];for(const [pt,z] of [[p,-thickness/2],[q,-thickness/2],[q,thickness/2+height(...q)],[p,-thickness/2],[q,thickness/2+height(...q)],[p,thickness/2+height(...p)]])vertex(pt,z,n)}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(norms,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeBoundingSphere();return geo;
}
// Diamond facets are triangulated in their own rotated pattern coordinates.
// Each facet has one plane normal, avoiding jagged highlights from a sampled grid.
function diamondSlab(thickness){
 const poly=swatchOutline(W,H),pos=[],norm=[],uv=[],pitch=W/26,peak=thickness>.07?.0035:.007;
 const toXY=(u,v,z=0)=>new THREE.Vector3((u+v)*pitch/2,(u-v)*pitch/2,z);
 const side=(p,a,b)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
 function clip(points){for(let k=0;k<6;k++){const a=poly[k],b=poly[(k+1)%6],out=[];for(let j=0;j<points.length;j++){const p=points[j],q=points[(j+1)%points.length],sp=side(p,a,b),sq=side(q,a,b);if(sp>=-1e-9)out.push(p);if((sp>0&&sq<0)||(sp<0&&sq>0))out.push(p.clone().lerp(q,sp/(sp-sq)))}points=out;if(!points.length)break}return points}
 function vertex(p,n){pos.push(p.x,p.y,p.z);norm.push(n.x,n.y,n.z);uv.push(p.x/W+.5,p.y/H+.5)}
 function tri(a,b,c,n){vertex(a,n);vertex(b,n);vertex(c,n)}
 for(let u=-46;u<46;u++)for(let v=-46;v<46;v++){
  const corners=[toXY(u,v,thickness/2),toXY(u,v+1,thickness/2),toXY(u+1,v+1,thickness/2),toXY(u+1,v,thickness/2)],center=toXY(u+.5,v+.5,thickness/2+peak);
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],n=b.clone().sub(a).cross(center.clone().sub(a)).normalize(),p=clip([a,b,center]);if(p.length<3)continue;for(let j=1;j<p.length-1;j++)tri(p[0],p[j],p[j+1],n);
   for(let j=0;j<p.length;j++){const a=p[j],b=p[(j+1)%p.length];if(a.distanceToSquared(b)<1e-16)continue;for(let k=0;k<6;k++)if(Math.abs(side(a,poly[k],poly[(k+1)%6]))<1e-8&&Math.abs(side(b,poly[k],poly[(k+1)%6]))<1e-8){const lowA=new THREE.Vector3(a.x,a.y,-thickness/2),lowB=new THREE.Vector3(b.x,b.y,-thickness/2),wallN=new THREE.Vector3(b.y-a.y,a.x-b.x,0).normalize();tri(lowA,lowB,b,wallN);tri(lowA,b,a,wallN);break}}
  }
 }
 const rear=poly.map(p=>new THREE.Vector3(p.x,p.y,-thickness/2));for(let i=1;i<5;i++)tri(rear[0],rear[i+1],rear[i],new THREE.Vector3(0,0,-1));
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeBoundingSphere();return geo;
}
function glass(options={}) {return new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.035,transmission:1,thickness:.17,ior:1.5,attenuationColor:new THREE.Color('#d6e5da'),attenuationDistance:3,envMapIntensity:.8,...options})}
function gradientTexture(){const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,256);g.addColorStop(0,'#edd6a1');g.addColorStop(.32,'#d89583');g.addColorStop(.56,'#ad7e91');g.addColorStop(.8,'#86b1c2');g.addColorStop(1,'#b2dfd9');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function dichroic(mat){mat.iridescence=.75;mat.iridescenceIOR=1.35;mat.iridescenceThicknessRange=[240,440];mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 float facing = abs(dot(normal, normalize(vViewPosition)));
 vec3 sunset = mix(vec3(0.42,0.82,0.76),vec3(0.96,0.64,0.72),smoothstep(0.32,0.95,facing));
 sunset = mix(sunset, vec3(0.98,0.83,0.46), 0.5*exp(-pow((facing-0.68)*5.0,2.0)));
 diffuseColor.rgb *= sunset;`)};mat.customProgramCacheKey=()=> 'study-dichroic-v1';return mat}
function planarUV(geo){const p=geo.attributes.position,a=[];for(let i=0;i<p.count;i++)a.push(p.getX(i)/W+.5,p.getY(i)/H+.5);geo.setAttribute('uv',new THREE.Float32BufferAttribute(a,2));return geo}

// Polychromatic film (Ep, Eep, Etp): copper at the top, sky blue at the base,
// read from the Ep / Eep sample photographs.
function polyTexture(){const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,90,256);g.addColorStop(0,'#c46a35');g.addColorStop(.38,'#d79a72');g.addColorStop(.58,'#b9cfd2');g.addColorStop(1,'#5aaed0');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

// Normal map from a height function sampled on a canvas grid. Canvas rows run
// downwards while v runs upwards (flipY), hence the sign on the y slope.
function normalTexture(width, height, heightAt, strength, wrap) {
  const hgt = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) hgt[y * width + x] = heightAt(x, y);
  const at = (x, y) => wrap ? hgt[((y + height) % height) * width + (x + width) % width]
    : hgt[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d'), img = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = -(at(x + 1, y) - at(x - 1, y)) * strength, ny = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(nx, ny, 1), i = (y * width + x) * 4;
    img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255;
    img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function random(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// Hammered relief of Vt / Et / Etf: overlapping shallow drops on a seamless
// tile, about 65 across the 250 mm swatch.
function stippleNormalMap() {
  const T = 256, rnd = random(7), drops = [];
  for (let i = 0; i < 170; i++) drops.push([rnd() * T, rnd() * T, 7 + rnd() * 6, .5 + rnd() * .5]);
  const tex = normalTexture(T, T, (x, y) => {
    let h = 0;
    for (const [cx, cy, r, a] of drops) {
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      const d2 = Math.min(dx, T - dx) ** 2 + Math.min(dy, T - dy) ** 2;
      if (d2 < r * r * 4) h += a * Math.exp(-d2 / (r * r));
    }
    return h;
  }, 1.6, true);
  tex.repeat.set(7, 7 * H / W);
  return tex;
}

// Etp: raised organic cords, the cell walls of a softly warped Voronoi field,
// drawn once over the whole swatch as in the sample photograph.
function cordsNormalMap() {
  const w = 768, h = Math.round(w * H / W), rnd = random(19), seeds = [];
  for (let i = 0; i < 16; i++) seeds.push([rnd() * w, rnd() * h]);
  return normalTexture(w, h, (x, y) => {
    const wx = x + 14 * Math.sin(y / 37) + 9 * Math.sin((x + y) / 23);
    const wy = y + 14 * Math.sin(x / 41) + 9 * Math.cos((x - y) / 29);
    let a = Infinity, b = Infinity;
    for (const [sx, sy] of seeds) {
      const d = Math.hypot(wx - sx, wy - sy);
      if (d < a) { b = a; a = d; } else if (d < b) b = d;
    }
    const e = (b - a) / 2;
    return e < 5 ? Math.cos(e / 5 * Math.PI / 2) * 5 : 0;
  }, .9, false);
}

// Printed interlayers (Imc, Iml): ink coverage as an alpha map on a tile.
function printAlphaMap(pattern) {
  const T = 64, c = document.createElement('canvas'); c.width = c.height = T;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, T, T); ctx.fillStyle = '#fff';
  if (pattern === 'grid') { ctx.fillRect(0, 0, T * .22, T); ctx.fillRect(0, 0, T, T * .22); }
  else ctx.fillRect(0, 0, T * .4, T);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const across = pattern === 'grid' ? 14 : 22;
  t.repeat.set(across, pattern === 'grid' ? across * H / W : 1);
  t.anisotropy = 8;
  return t;
}

// Body tints. Eb and Eg are the Vb and Vg glass silvered (esVersionEspejoDe).
const BRONZE = { color: '#d2aa8a', attenuation: '#8a5a37', distance: .6, edge: '#8b6a50' };
const GREY = { color: '#b0b2b2', attenuation: '#474b4d', distance: .5, edge: '#6c7173' };
const TINT = {
  Vu: { color: '#ffffff', attenuation: '#eef5f1', distance: 10, edge: '#c3cfc9' },
  Vp: { color: '#7391e6', attenuation: '#2042c4', distance: .5, edge: '#3d5ab8' },
  Vi: { color: '#90bac9', attenuation: '#2c7590', distance: .65, edge: '#4f8597' },
  Vb: BRONZE, Vg: GREY, Eb: BRONZE, Eg: GREY,
  Vab: { color: '#d8b28f', attenuation: '#af784b', distance: .8, edge: '#9b7959' },
  Vag: { color: '#c2c4c3', attenuation: '#5d6264', distance: .8, edge: '#7d8283' },
};

// Per-code deviations from the kind. acid: acid-etched outer face (Gra, Dsa,
// Ina are the acid versions of Gr, Ds, In; Ee of a mirror). film: interlayer
// colour, 'poly' for the polychromatic film. surface: relief carried by the
// front ply as a normal map. flutes/depth: reed pitch (lite = finer, lower).
const SPEC = {
  Val: { flutes: 30, depth: .025 }, Eal: { flutes: 30, depth: .025 },
  Vt: { surface: 'stipple' }, Et: { surface: 'stipple' },
  Veb: { eva: '#efebe3', evaRoughness: .4 }, Ven: { eva: '#0d0e0f', evaRoughness: .28 },
  Gra: { acid: true }, Dsa: { acid: true }, Ina: { acid: true, film: '#c98fa0' },
  Imc: { print: 'grid' }, Iml: { print: 'lines' },
  Ee: { acid: true },
  Ei: { film: '#d88a46' }, Eef: { acid: true, film: '#cf7f52' },
  Ep: { film: 'poly' }, Eep: { acid: true, film: 'poly' },
  Etf: { film: '#d9ad3a', surface: 'stipple' }, Etp: { film: 'poly', surface: 'cords' },
};

// Insert meshes, read from each -04-detail-surface photograph. count = wires
// across the 250 mm swatch, radius = wire radius / pitch, aspect = cell
// height / width. Fabrics too fine for wire geometry use a woven texture.
// Bq is the same mesh as Aq (esEquivalenteIdenticoDe) and Bp shares Ap's
// photographs, so they share parameters.
const AP = { count: 56, radius: .24, color: '#c2b8a3', metalness: .8, roughness: .28 };
const MESH = {
  Ae: { count: 72, radius: .22, color: '#8d8576', metalness: .55, roughness: .55 },
  Ap: AP, Bp: AP,
  Ab: { count: 20, radius: .045, aspect: 1.3, color: '#d3d6d3', metalness: .92, roughness: .2 },
  Ac: { count: 30, radius: .05, color: '#d3d6d3', metalness: .92, roughness: .2 },
  Be: { count: 60, radius: .14, color: '#aaa08c', metalness: .6, roughness: .5 },
  Bl: { count: 84, radius: .16, color: '#b49a5f', metalness: .88, roughness: .3 },
  Cm: { count: 52, radius: .06, color: '#bcc0bc', metalness: .85, roughness: .3 },
  Cn: { count: 40, radius: .1, color: '#1c1d1e', metalness: .4, roughness: .45 },
  Af: { textile: { pattern: 'plain', threads: 220, gap: .38, color: '#7a7468' }, metalness: .5, roughness: .55 },
  Al: { textile: { pattern: 'plain', threads: 180, gap: .44, color: '#85827b' }, metalness: .6, roughness: .45 },
  Az: { textile: { pattern: 'zigzag', threads: 130, gap: .3, color: '#6e6b65' }, metalness: .85, roughness: .35 },
  Ah: { textile: { pattern: 'herringbone', threads: 80, gap: .25, color: '#8a8376', bump: 2 }, metalness: .5, roughness: .55 },
  Tl: { textile: { pattern: 'plain', threads: 240, gap: .42, color: '#bdb8ac' }, metalness: .3, roughness: .6 },
};

// attributes are copied verbatim from glass-types.json (regenerate, do not hand-edit).
export const CATALOGUE = {
  "Vc": {
    "name": "Vidrio Claro",
    "slot": 1,
    "category": "colores",
    "subcategory": "vidrios-base-claros",
    "attributes": {
      "acabado": [
        "claro"
      ],
      "transparencia": "transparente",
      "colorBase": "claro",
      "disponibilidad": "disponible",
      "personalizacionColor": "color-unico",
      "espesorMm": [
        4,
        5,
        6,
        8,
        10,
        12
      ],
      "dimensionMaxMm": [
        2400,
        3600
      ]
    },
    "nominalMm": 6,
    "finish": "Vidrio float"
  },
  "Vu": {
    "name": "Vidrio Ultraclaro",
    "slot": 2,
    "category": "colores",
    "subcategory": "vidrios-base-claros",
    "attributes": {
      "acabado": [
        "claro"
      ],
      "transparencia": "transparente",
      "colorBase": "ultraclaro",
      "disponibilidad": "disponible",
      "personalizacionColor": "color-unico",
      "espesorMm": [
        4,
        5,
        6,
        10
      ],
      "dimensionMaxMm": [
        2400,
        3600
      ]
    },
    "nominalMm": 6,
    "finish": "Ultraclaro"
  },
  "Vp": {
    "name": "Vidrio Pacífica",
    "slot": 3,
    "category": "colores",
    "subcategory": "vidrios-tintados",
    "attributes": {
      "acabado": [
        "coloreado"
      ],
      "transparencia": "transparente",
      "colorBase": "pacifica",
      "disponibilidad": "disponible",
      "espesorMm": [
        6
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Tinte azul"
  },
  "Vi": {
    "name": "Vidrio Indigo",
    "slot": 4,
    "category": "colores",
    "subcategory": "vidrios-tintados",
    "attributes": {
      "acabado": [
        "coloreado"
      ],
      "transparencia": "transparente",
      "colorBase": "indigo",
      "disponibilidad": "disponible",
      "espesorMm": [
        6
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Tinte índigo"
  },
  "Vb": {
    "name": "Vidrio Bronce",
    "slot": 5,
    "category": "colores",
    "subcategory": "vidrios-tintados",
    "attributes": {
      "acabado": [
        "coloreado"
      ],
      "transparencia": "transparente",
      "colorBase": "bronce",
      "disponibilidad": "disponible",
      "espesorMm": [
        6,
        8,
        10
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Tinte bronce"
  },
  "Vg": {
    "name": "Vidrio Gris",
    "slot": 6,
    "category": "colores",
    "subcategory": "vidrios-tintados",
    "attributes": {
      "acabado": [
        "coloreado"
      ],
      "transparencia": "transparente",
      "colorBase": "gris",
      "disponibilidad": "disponible",
      "espesorMm": [
        6,
        8,
        10
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Tinte gris"
  },
  "Va": {
    "name": "Vidrio Acanalado",
    "slot": 7,
    "category": "colores",
    "subcategory": "vidrios-acanalados",
    "attributes": {
      "acabado": [
        "acanalado"
      ],
      "transparencia": "translucido",
      "patron": "acanalado-vertical",
      "colorBase": "claro",
      "disponibilidad": "disponible",
      "espesorMm": [
        5,
        8
      ],
      "dimensionMaxMm": [
        2100,
        3300
      ]
    },
    "nominalMm": 5,
    "finish": "Acanalado"
  },
  "Val": {
    "name": "Vidrio Acanalado Lite",
    "slot": 8,
    "category": "colores",
    "subcategory": "vidrios-acanalados",
    "attributes": {
      "acabado": [
        "acanalado"
      ],
      "transparencia": "translucido",
      "patron": "acanalado-fino",
      "colorBase": "claro",
      "disponibilidad": "disponible",
      "espesorMm": [
        5
      ],
      "dimensionMaxMm": [
        2100,
        3300
      ]
    },
    "nominalMm": 5,
    "finish": "Acanalado fino"
  },
  "Ve": {
    "name": "Vidrio Esmerilado",
    "slot": 9,
    "category": "colores",
    "subcategory": "vidrios-texturizados",
    "attributes": {
      "acabado": [
        "esmerilado"
      ],
      "transparencia": "translucido",
      "colorBase": "claro",
      "disponibilidad": "disponible",
      "espesorMm": [
        5
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 5,
    "finish": "Satinado"
  },
  "Vt": {
    "name": "Vidrio Texturizado",
    "slot": 10,
    "category": "colores",
    "subcategory": "vidrios-texturizados",
    "attributes": {
      "acabado": [
        "texturizado"
      ],
      "transparencia": "translucido",
      "colorBase": "claro",
      "disponibilidad": "disponible",
      "espesorMm": [
        6
      ],
      "dimensionMaxMm": [
        2100,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Martillado"
  },
  "Vd": {
    "name": "Vidrio Diamante",
    "slot": 11,
    "category": "colores",
    "subcategory": "vidrios-texturizados",
    "attributes": {
      "acabado": [
        "texturizado"
      ],
      "transparencia": "translucido",
      "patron": "diamante-grid",
      "colorBase": "claro",
      "disponibilidad": "disponible",
      "espesorMm": [
        5
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 5,
    "finish": "Patrón diamante"
  },
  "Veb": {
    "name": "Vidrio Eva Blanca",
    "slot": 12,
    "category": "colores",
    "subcategory": "vidrios-eva-opacos",
    "attributes": {
      "acabado": [
        "coloreado"
      ],
      "transparencia": "opaco",
      "colorBase": "blanco",
      "disponibilidad": "disponible",
      "espesorMm": [
        8
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "EVA blanca"
  },
  "Ven": {
    "name": "Vidrio Eva Negra",
    "slot": 13,
    "category": "colores",
    "subcategory": "vidrios-eva-opacos",
    "attributes": {
      "acabado": [
        "coloreado"
      ],
      "transparencia": "opaco",
      "colorBase": "negro",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        10
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "EVA negra"
  },
  "Vab": {
    "name": "Vidrio Acanalado Bronce",
    "slot": 14,
    "category": "colores",
    "subcategory": "vidrios-acanalados",
    "attributes": {
      "acabado": [
        "acanalado",
        "coloreado"
      ],
      "transparencia": "translucido",
      "patron": "acanalado-vertical",
      "colorBase": "bronce",
      "disponibilidad": "disponible",
      "espesorMm": [
        9
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 9,
    "finish": "Tinte bronce"
  },
  "Vag": {
    "name": "Vidrio Acanalado Gris",
    "slot": 15,
    "category": "colores",
    "subcategory": "vidrios-acanalados",
    "attributes": {
      "acabado": [
        "acanalado",
        "coloreado"
      ],
      "transparencia": "translucido",
      "patron": "acanalado-vertical",
      "colorBase": "gris",
      "disponibilidad": "disponible",
      "espesorMm": [
        9
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 9,
    "finish": "Tinte gris"
  },
  "Gr": {
    "name": "Gradient",
    "slot": 18,
    "category": "inserciones",
    "subcategory": "gradientes",
    "attributes": {
      "acabado": [
        "gradient"
      ],
      "transparencia": "transparente",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Transición de color"
  },
  "Gra": {
    "name": "Gradient Acidado",
    "slot": 19,
    "category": "inserciones",
    "subcategory": "gradientes",
    "attributes": {
      "acabado": [
        "gradient",
        "esmerilado"
      ],
      "transparencia": "translucido",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Gradient acidado"
  },
  "Ds": {
    "name": "Dichroic Sunset",
    "slot": 20,
    "category": "inserciones",
    "subcategory": "dicroicos",
    "attributes": {
      "acabado": [
        "dicroico"
      ],
      "transparencia": "transparente",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Película dicroica"
  },
  "Dsa": {
    "name": "Dichroic Sunset Acidado",
    "slot": 21,
    "category": "inserciones",
    "subcategory": "dicroicos",
    "attributes": {
      "acabado": [
        "dicroico",
        "esmerilado"
      ],
      "transparencia": "translucido",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Dicroico acidado"
  },
  "In": {
    "name": "Interlayer",
    "slot": 22,
    "category": "inserciones",
    "subcategory": "interlayer-color",
    "attributes": {
      "acabado": [
        "interlayer"
      ],
      "transparencia": "transparente",
      "disponibilidad": "disponible",
      "personalizacionColor": "300-colores",
      "espesorMm": [
        8,
        10,
        12
      ],
      "dimensionMaxMm": [
        1200,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "300 colores"
  },
  "Ina": {
    "name": "Interlayer Acidado",
    "slot": 23,
    "category": "inserciones",
    "subcategory": "interlayer-color",
    "attributes": {
      "acabado": [
        "interlayer",
        "esmerilado"
      ],
      "transparencia": "translucido",
      "disponibilidad": "disponible",
      "personalizacionColor": "300-colores",
      "espesorMm": [
        8,
        10,
        12
      ],
      "dimensionMaxMm": [
        1200,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "300 colores"
  },
  "Imc": {
    "name": "Impresión Cuadros",
    "slot": 24,
    "category": "inserciones",
    "subcategory": "impresiones",
    "attributes": {
      "acabado": [
        "impreso"
      ],
      "transparencia": "transparente",
      "patron": "cuadros",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1600,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Impresión"
  },
  "Iml": {
    "name": "Impresión Líneas",
    "slot": 25,
    "category": "inserciones",
    "subcategory": "impresiones",
    "attributes": {
      "acabado": [
        "impreso"
      ],
      "transparencia": "transparente",
      "patron": "lineas",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1600,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Impresión"
  },
  "Tl": {
    "name": "Tela Lino",
    "slot": 26,
    "category": "inserciones",
    "subcategory": "textiles",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "linen",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ],
      "familia": "malla"
    },
    "nominalMm": 8,
    "finish": "Textil"
  },
  "Ae": {
    "name": "Malla Serie A — Entramado",
    "slot": 31,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "entramado",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Ap": {
    "name": "Malla Serie A — Pulida",
    "slot": 32,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "pulida",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Af": {
    "name": "Malla Serie A — Fabric",
    "slot": 33,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "fabric",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Al": {
    "name": "Malla Serie A — Lisa",
    "slot": 34,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "lisa",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Az": {
    "name": "Malla Serie A — Zigzag",
    "slot": 35,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "zigzag",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Aq": {
    "name": "Malla Serie A — Qubo",
    "slot": 36,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "qubo",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Ah": {
    "name": "Malla Serie A — Herringbone",
    "slot": 37,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "herringbone",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Ab": {
    "name": "Malla Serie A — Bilineal",
    "slot": 38,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "bilineal",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "At": {
    "name": "Malla Serie A — Tejida",
    "slot": 39,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "tejida",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Ac": {
    "name": "Malla Serie A — Cuadros",
    "slot": 40,
    "category": "inserciones",
    "subcategory": "mallas-serie-a",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "cuadros",
      "tier": "premium",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Bq": {
    "name": "Malla Serie B — Qubo",
    "slot": 41,
    "category": "inserciones",
    "subcategory": "mallas-serie-b",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "qubo",
      "tier": "alternativa",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Be": {
    "name": "Malla Serie B — Entramado",
    "slot": 42,
    "category": "inserciones",
    "subcategory": "mallas-serie-b",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "entramado",
      "tier": "alternativa",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Bl": {
    "name": "Malla Serie B — Lisa",
    "slot": 43,
    "category": "inserciones",
    "subcategory": "mallas-serie-b",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "lisa",
      "tier": "alternativa",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Bp": {
    "name": "Malla Serie B — Pulida",
    "slot": 44,
    "category": "inserciones",
    "subcategory": "mallas-serie-b",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "pulida",
      "tier": "alternativa",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Cm": {
    "name": "Malla Serie C — Mosquitera",
    "slot": 44,
    "category": "inserciones",
    "subcategory": "mallas-serie-c",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "mosquitera",
      "disponibilidad": "disponible",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1200,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Cn": {
    "name": "Malla Serie C — Negra",
    "slot": 45,
    "category": "inserciones",
    "subcategory": "mallas-serie-c",
    "attributes": {
      "acabado": [
        "metalizado"
      ],
      "transparencia": "semitransparente",
      "patron": "negra",
      "disponibilidad": "disponible",
      "colorBase": "negro",
      "espesorMm": [
        8,
        12
      ],
      "dimensionMaxMm": [
        1200,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Malla metálica"
  },
  "Ec": {
    "name": "Espejo Claro",
    "slot": 91,
    "category": "reflectivos",
    "subcategory": "espejos-base",
    "attributes": {
      "acabado": [
        "espejado"
      ],
      "transparencia": "espejo",
      "disponibilidad": "disponible",
      "espesorMm": [
        6
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Reflectante"
  },
  "Eb": {
    "name": "Espejo Bronce",
    "slot": 92,
    "category": "reflectivos",
    "subcategory": "espejos-base",
    "attributes": {
      "acabado": [
        "espejado",
        "coloreado"
      ],
      "transparencia": "espejo",
      "colorBase": "bronce",
      "disponibilidad": "disponible",
      "espesorMm": [
        6
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Tinte bronce"
  },
  "Eg": {
    "name": "Espejo Gris",
    "slot": 93,
    "category": "reflectivos",
    "subcategory": "espejos-base",
    "attributes": {
      "acabado": [
        "espejado",
        "coloreado"
      ],
      "transparencia": "espejo",
      "colorBase": "gris",
      "disponibilidad": "disponible",
      "espesorMm": [
        6
      ],
      "dimensionMaxMm": [
        2400,
        3300
      ]
    },
    "nominalMm": 6,
    "finish": "Tinte gris"
  },
  "Ei": {
    "name": "Espejo Interlayer",
    "slot": 94,
    "category": "reflectivos",
    "subcategory": "espejo-color-interlayer",
    "attributes": {
      "acabado": [
        "espejado",
        "interlayer"
      ],
      "transparencia": "espejo",
      "disponibilidad": "disponible",
      "personalizacionColor": "300-colores",
      "espesorMm": [
        8,
        10
      ],
      "dimensionMaxMm": [
        1200,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "300 colores"
  },
  "Ep": {
    "name": "Espejo Polychromatico",
    "slot": 95,
    "category": "reflectivos",
    "subcategory": "espejos-custom",
    "attributes": {
      "acabado": [
        "espejado",
        "dicroico"
      ],
      "transparencia": "espejo",
      "disponibilidad": "custom",
      "espesorMm": [
        8,
        10
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Film policromático"
  },
  "Ea": {
    "name": "Espejo Acanalado",
    "slot": 96,
    "category": "reflectivos",
    "subcategory": "espejos-texturizados",
    "attributes": {
      "acabado": [
        "espejado",
        "acanalado"
      ],
      "transparencia": "espejo",
      "patron": "acanalado-vertical",
      "disponibilidad": "disponible",
      "espesorMm": [
        10
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 10,
    "finish": "Acanalado"
  },
  "Eal": {
    "name": "Espejo Acanalado Lite",
    "slot": 97,
    "category": "reflectivos",
    "subcategory": "espejos-texturizados",
    "attributes": {
      "acabado": [
        "espejado",
        "acanalado"
      ],
      "transparencia": "espejo",
      "patron": "acanalado-fino",
      "disponibilidad": "disponible",
      "espesorMm": [
        10
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 10,
    "finish": "Acanalado fino"
  },
  "Ed": {
    "name": "Espejo Diamante",
    "slot": 98,
    "category": "reflectivos",
    "subcategory": "espejos-texturizados",
    "attributes": {
      "acabado": [
        "espejado",
        "texturizado"
      ],
      "transparencia": "espejo",
      "patron": "diamante-grid",
      "disponibilidad": "disponible",
      "espesorMm": [
        10
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 10,
    "finish": "Patrón diamante"
  },
  "Ee": {
    "name": "Espejo Esmerilado",
    "slot": 99,
    "category": "reflectivos",
    "subcategory": "espejos-texturizados",
    "attributes": {
      "acabado": [
        "espejado",
        "esmerilado"
      ],
      "transparencia": "espejo",
      "disponibilidad": "disponible",
      "acabadoColor": [
        "humo",
        "bronce",
        "negro"
      ],
      "espesorMm": [
        6,
        10
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 6,
    "finish": "Satinado"
  },
  "Eef": {
    "name": "Espejo Esmerilado Film",
    "slot": 100,
    "category": "reflectivos",
    "subcategory": "espejos-con-film-poly",
    "attributes": {
      "acabado": [
        "espejado",
        "esmerilado",
        "interlayer"
      ],
      "transparencia": "espejo",
      "disponibilidad": "disponible",
      "personalizacionColor": "300-colores",
      "espesorMm": [
        8,
        10
      ],
      "dimensionMaxMm": [
        1200,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Film de color"
  },
  "Eep": {
    "name": "Espejo Polychromatico",
    "slot": 101,
    "category": "reflectivos",
    "subcategory": "espejos-custom",
    "attributes": {
      "acabado": [
        "espejado",
        "dicroico"
      ],
      "transparencia": "espejo",
      "disponibilidad": "custom",
      "espesorMm": [
        8,
        10
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 8,
    "finish": "Film policromático"
  },
  "Et": {
    "name": "Espejo Texturizado",
    "slot": 102,
    "category": "reflectivos",
    "subcategory": "espejos-texturizados",
    "attributes": {
      "acabado": [
        "espejado",
        "texturizado"
      ],
      "transparencia": "espejo",
      "disponibilidad": "disponible",
      "espesorMm": [
        10
      ],
      "dimensionMaxMm": [
        2000,
        3000
      ]
    },
    "nominalMm": 10,
    "finish": "Martillado"
  },
  "Etf": {
    "name": "Espejo Texturizado Film",
    "slot": 103,
    "category": "reflectivos",
    "subcategory": "espejos-con-film-poly",
    "attributes": {
      "acabado": [
        "espejado",
        "texturizado",
        "interlayer"
      ],
      "transparencia": "espejo",
      "disponibilidad": "proximamente",
      "espesorMm": [
        10
      ],
      "dimensionMaxMm": [
        1200,
        3000
      ]
    },
    "nominalMm": 10,
    "finish": "Film de color"
  },
  "Etp": {
    "name": "Espejo Texturizado Poly",
    "slot": 104,
    "category": "reflectivos",
    "subcategory": "espejos-con-film-poly",
    "attributes": {
      "acabado": [
        "espejado",
        "texturizado",
        "dicroico"
      ],
      "transparencia": "espejo",
      "disponibilidad": "proximamente",
      "espesorMm": [
        10
      ],
      "dimensionMaxMm": [
        1500,
        3000
      ]
    },
    "nominalMm": 10,
    "finish": "Film policromático"
  }
};
// Nominal total gauges come from glass-types.json. Scene scale uses a 250 mm
// wide reference swatch. Internal ply/film gauges remain illustrative: the
// catalogue does not specify polymer chemistry or a manufacturing layup.
const MM = W / 250;
const LAMINATES = ['gradient', 'dichroic', 'color', 'eva', 'print', 'mirror-film'];
// Relief on a mirror front uses an opaque reflective approximation to avoid
// screen-space refraction tearing at the edge of the opaque backing.
const REFLECTIVE_RELIEF = ['mirror-diamond', 'mirror-reed', 'mirror-stipple'];

export function createSample(code, coarse = false) {
  if (!presets[code]) throw new Error(`Unknown Visor sample: ${code}`);
  const kind = presets[code][2];
  const catalogue = CATALOGUE[code];
  const spec = SPEC[code] || {};
  const tintSpec = TINT[code];
  const total = catalogue.nominalMm * MM;
  const distorts = kind === 'reed' || kind === 'diamond' || kind === 'stipple';

  if (kind === 'qubo' || kind === 'woven' || kind === 'mesh' || kind === 'textile') {
    const options = MESH[code] || {};
    const sample = createQuboSample(W, H, coarse, kind === 'woven',
      { ...options, name: `${code} · ${catalogue.name}` });
    sample.group.userData.layers = ['glass', 'bond', kind === 'textile' ? 'textile' : 'metal-weave', 'bond', 'glass'];
    return {
      ...sample, laminated: true, mirror: false, distorts: false,
      construction: code === 'Tl'
        ? 'Vidrio / interlámina / tejido / interlámina / vidrio'
        : 'Vidrio / interlámina / malla metálica / interlámina / vidrio',
    };
  }

  const group = new THREE.Group();
  group.name = `${code} · ${catalogue.name}`;
  const materials = [];
  const laminated = LAMINATES.includes(kind);
  const mirror = kind.startsWith('mirror');
  const reflectiveRelief = REFLECTIVE_RELIEF.includes(kind);
  const surface = spec.surface;
  const pane = glass({ thickness: distorts ? .72 : kind === 'frost' ? .36 : .185 });
  if (tintSpec) {
    pane.color.set(tintSpec.color);
    pane.attenuationColor.set(tintSpec.attenuation);
    pane.attenuationDistance = tintSpec.distance;
  }
  if (kind === 'frost' || spec.acid) {
    // A satin front over a silvered back needs more haze to read as frosted.
    pane.roughness = kind === 'mirror' ? .42 : .31;
    pane.envMapIntensity = .5;
  }
  if (surface) {
    pane.normalMap = surface === 'cords' ? cordsNormalMap() : stippleNormalMap();
    // Relief seen as reflection (silvered or coloured metal) reads twice as strong.
    pane.normalScale.setScalar(mirror ? .45 : .9);
  }
  // Silvered relief uses the approved reflective approximation (see above).
  if (reflectiveRelief) {
    pane.transmission = 0;
    pane.metalness = 1;
    pane.color.set('#d6d9d6');
    pane.roughness = kind === 'mirror-stipple' ? .1 : .14;
  }
  materials.push(pane);

  const plyThickness = laminated ? total * .375 : total;
  const coreThickness = laminated ? total * .25 : 0;
  const paneOffset = (plyThickness + coreThickness) / 2;
  let geometry;
  if (kind === 'reed' || kind === 'mirror-reed') {
    geometry = reliefSlab('reed', total - .012, spec);
    geometry.translate(0, 0, -.006);
  } else if (kind.includes('diamond')) {
    const peak = mirror ? .0035 : .007;
    geometry = reliefSlab('diamond', total - peak);
    geometry.translate(0, 0, -peak / 2);
  } else {
    geometry = planarUV(beveledSlab(swatchOutline(W, H), plyThickness, .003));
  }

  const front = new THREE.Mesh(geometry, pane);
  front.name = laminated ? 'Front glass ply' : 'Glass body';
  group.add(front);
  let back, film, composite, bondFront, bondBack, bondEdge;
  // The rear ply's own material while separated / assembled.
  let rearOpen = pane, rearAssembled = pane;
  // Opaque cores (EVA, printed ink) sit in the opaque list, so the front
  // ply's transmission pass already sees them: they stay visible assembled.
  const opaqueCore = kind === 'eva' || kind === 'print';
  if (laminated) {
    back = new THREE.Mesh(geometry, pane);
    back.name = 'Rear glass ply';
    front.position.z = paneOffset;
    back.position.z = -paneOffset;
    group.add(back);

    const filmOutline = swatchOutline(W - .014, H - .014);
    if (opaqueCore) {
      const ink = kind === 'eva'
        ? new THREE.MeshStandardMaterial({ color: spec.eva, roughness: spec.evaRoughness, metalness: 0 })
        : new THREE.MeshStandardMaterial({ color: '#141414', roughness: .55, metalness: 0,
          alphaMap: printAlphaMap(spec.print), alphaTest: .5, side: THREE.DoubleSide });
      film = new THREE.Mesh(planarUV(beveledSlab(filmOutline,
        kind === 'eva' ? coreThickness : .003, .001)), ink);
      film.name = kind === 'eva' ? 'Opaque EVA interlayer' : 'Printed interlayer';
      group.add(film);
      materials.push(ink);
    } else {
      const tint = glass({ thickness: coreThickness, roughness: .07 });
      if (kind === 'color') tint.color.set(spec.film || '#5995c2');
      if (kind === 'gradient') tint.map = gradientTexture();
      if (kind === 'dichroic') dichroic(tint);
      if (kind === 'mirror-film') {
        if (spec.film === 'poly') tint.map = polyTexture();
        else tint.color.set(spec.film);
      }

      // Nested transmissive meshes are excluded from Three's transmission
      // buffer. Apply the effective laminate tint on either outer face while
      // assembled; show the actual film and clear plies during separation.
      composite = pane.clone();
      composite.color.copy(tint.color);
      composite.map = tint.map;
      if (kind === 'dichroic') dichroic(composite);
      if (kind === 'mirror-film') {
        // The rear ply is the silvered glass: clear, then the coating.
        rearOpen = rearAssembled = glass();
        materials.push(rearOpen);
        // A relief front over a coloured mirror reads as coloured metal.
        if (surface) {
          composite.transmission = 0;
          composite.metalness = 1;
          composite.roughness = .12;
        }
      } else {
        rearAssembled = composite;
      }
      front.material = composite;
      back.material = rearAssembled;
      materials.push(composite, tint);

      const filmThickness = kind === 'dichroic' ? .004 : coreThickness;
      film = new THREE.Mesh(planarUV(beveledSlab(filmOutline, filmThickness, .001)), tint);
      film.name = kind === 'dichroic' ? 'Dichroic optical film'
        : kind === 'mirror-film' ? 'Colour interlayer' : 'Decorative interlayer';
      film.visible = false;
      group.add(film);
    }

    bondEdge = new THREE.Mesh(perimeterBand(filmOutline, coreThickness),
      new THREE.MeshStandardMaterial({ color: '#b4c1b5', roughness: .3,
        transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide }));
    bondEdge.name = 'Interlayer perimeter';
    group.add(bondEdge);

    if (kind === 'dichroic') {
      const filmThickness = .004;
      const bondThickness = (coreThickness - filmThickness) / 2;
      const bondGeometry = planarUV(beveledSlab(swatchOutline(W - .014, H - .014), bondThickness, .001));
      const bondMaterial = glass({ thickness: bondThickness, ior: 1.48, roughness: .07 });
      bondFront = new THREE.Mesh(bondGeometry, bondMaterial);
      bondBack = new THREE.Mesh(bondGeometry, bondMaterial);
      bondFront.name = 'Front clear bonding layer';
      bondBack.name = 'Rear clear bonding layer';
      bondFront.position.z = (filmThickness + bondThickness) / 2;
      bondBack.position.z = -bondFront.position.z;
      bondFront.visible = bondBack.visible = false;
      group.add(bondFront, bondBack);
      materials.push(bondMaterial);
    }
  }

  if (mirror) {
    // Coatings remain bonded. Do not imply thick silver/copper slabs or a
    // supplier-specific coating chemistry; the rear protection is generic.
    // On a laminated mirror they ride on the rear ply.
    const carrier = kind === 'mirror-film' ? back : group;
    const rearFace = kind === 'mirror-film' ? -plyThickness / 2 : -total / 2;
    const silver = new THREE.Mesh(planarUV(beveledSlab(swatchOutline(W - .006, H - .006), .0012, .0002)),
      new THREE.MeshStandardMaterial({ color: '#d6d9d6', metalness: 1, roughness: .055, envMapIntensity: 1.1 }));
    silver.name = 'Reflective coating';
    silver.position.z = rearFace - .0006;
    const protection = new THREE.Mesh(planarUV(beveledSlab(swatchOutline(W - .006, H - .006), .0012, .0002)),
      new THREE.MeshStandardMaterial({ color: '#535953', metalness: 0, roughness: .84 }));
    protection.name = 'Protective rear coating';
    protection.position.z = rearFace - .0018;
    carrier.add(silver, protection);
    materials.push(silver.material, protection.material);
    if (kind === 'mirror' && !spec.acid) pane.roughness = .025;
  }

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: tintSpec?.edge || '#9baea1', roughness: .24, metalness: .15,
    transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide,
  });
  const edgeGeometry = perimeterBand(swatchOutline(W, H), plyThickness - .01);
  front.add(new THREE.Mesh(edgeGeometry, edgeMaterial));
  if (back) back.add(new THREE.Mesh(edgeGeometry, edgeMaterial));
  group.userData.layers = laminated
    ? kind === 'dichroic' ? ['glass', 'bond', 'dichroic-film', 'bond', 'glass']
      : kind === 'eva' ? ['glass', 'opaque-eva', 'glass']
        : kind === 'print' ? ['glass', 'printed-interlayer', 'glass']
          : kind === 'mirror-film' ? ['glass', 'colour-interlayer', 'glass', 'reflective-coating', 'protective-coating']
            : ['glass', 'decorative-interlayer', 'glass']
    : mirror ? ['glass', 'reflective-coating', 'protective-coating'] : ['glass'];
  // Keep inactive composite/clear materials reachable for GPU cleanup when
  // switching away from an exploded or assembled sample.
  group.userData.resourceMaterials = materials;

  const optical = materials.filter(material => material.transmission > 0).map(material => ({
    material, color: material.color.clone(), attenuation: material.attenuationDistance,
  }));
  const face = spec.acid ? 'Vidrio acidado' : surface ? 'Vidrio texturizado' : 'Vidrio';
  const construction = kind === 'dichroic'
    ? `${face} / interlámina / película dicroica / interlámina / vidrio`
    : kind === 'eva' ? 'Vidrio / lámina EVA opaca / vidrio'
      : kind === 'print' ? 'Vidrio / interlámina impresa / vidrio'
        : kind === 'mirror-film'
          ? `${face} / ${spec.film === 'poly' ? 'film policromático' : 'interlámina de color'} / vidrio / capa reflectante`
          : laminated ? `${face} / interlámina decorativa / vidrio`
            : mirror ? 'Vidrio / capa reflectante / protección posterior' : 'Una sola pieza de vidrio';

  return {
    group, laminated, mirror, distorts, construction,
    setSeparation(value) {
      if (!laminated) return;
      front.position.z = paneOffset + .52 * value;
      back.position.z = -paneOffset - .52 * value;
      const open = value > .001;
      if (!opaqueCore) film.visible = open;
      bondEdge.visible = !open;
      if (composite) {
        front.material = open ? pane : composite;
        back.material = open ? rearOpen : rearAssembled;
      }
      if (bondFront) {
        const offset = (coreThickness + .004) / 4;
        bondFront.position.z = offset + .24 * value;
        bondBack.position.z = -offset - .24 * value;
        bondFront.visible = bondBack.visible = open;
      }
    },
    setDistortion(percent) {
      if (!distorts) return;
      pane.thickness = .12 + percent * .02;
      if (surface) pane.normalScale.setScalar(.3 + percent * .012);
    },
    setClarity(percent) {
      if (mirror) return;
      const p = percent / 100;
      optical.forEach(({ material, color, attenuation }) => {
        material.attenuationDistance = attenuation * (.25 + 1.25 * p);
        material.color.copy(color);
        if (p < .6) material.color.multiplyScalar(.6 + p * 2 / 3);
        else material.color.lerp(new THREE.Color('#ffffff'), (p - .6) * .6);
      });
      if (kind === 'frost') pane.roughness = .43 - .2 * p;
      if (spec.acid) [pane, composite].forEach(material => { if (material) material.roughness = .43 - .2 * p; });
    },
    setLight(percent) {
      materials.forEach(material => { material.envMapIntensity = .3 + percent * .007; });
    },
  };
}
