import * as THREE from 'three';
import {swatchOutline, beveledSlab, perimeterBand, createQuboSample} from './gl-visor-weave.js?v=1';

export const presets = {
 Vc:['Claro','Transparencia limpia, un matiz verde en el canto y reflejos suaves.','plain'],
 Va:['Acanalado','Canales verticales de relieve bajo. La luz se ondula sin romper la silueta del fondo.','reed'],
 Ve:['Esmerilado','Una superficie satinada que difunde la luz y suaviza lo que hay detrás.','frost'],
 Vd:['Diamante','Una trama fina de pequeños relieves facetados, con destellos contenidos.','diamond'],
 Vab:['Acanalado bronce','Canales suaves sobre un vidrio de tono bronce transparente.','reed'],
 Gr:['Gradient','Transiciones transparentes de ámbar, vino y azul, integradas entre los vidrios.','gradient'],
 Ds:['Dichroic Sunset','Color que cambia con el ángulo: de rosa cálido a oro y verde azulado.','dichroic'],
 In:['Interlayer','Una interlámina azul transparente entre dos hojas de vidrio.','color'],
 Aq:['Malla SA-Qubo','Hilos metálicos que se cruzan por encima y por debajo, dentro de un laminado fino.','qubo'],
 At:['Malla SA-Tejida','Un tejido metálico más cerrado y de tono cálido, protegido entre dos vidrios.','woven'],
 Ec:['Espejo claro','Un frente de vidrio limpio y un respaldo reflectante continuo.','mirror'],
 Ed:['Espejo diamante','Pequeñas facetas de vidrio que fragmentan suavemente el reflejo.','mirror-diamond'],
};
const W=3, H=2.15;

// Each grid cell is clipped to the original convex outline. No boundary
// vertices are snapped across a cut corner, so relief remains watertight.
export function reliefSlab(kind, thickness=.06) {
 if(kind==='diamond')return diamondSlab(thickness);
 const poly=swatchOutline(W,H), pos=[], norms=[], uv=[];
 const reed=kind==='reed', nx=reed?240:192, ny=reed?1:144;
 const height=(x,y)=>{
  if(reed) return .04*(1+Math.cos(x/W*20*Math.PI*2));
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

export const CATALOGUE = {
  "Vc": {
    "name": "Vidrio Claro",
    "slot": 1,
    "category": "colores",
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
    "nominalMm": 6
  },
  "Va": {
    "name": "Vidrio Acanalado",
    "slot": 7,
    "category": "colores",
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
    "nominalMm": 5
  },
  "Ve": {
    "name": "Vidrio Esmerilado",
    "slot": 9,
    "category": "colores",
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
    "nominalMm": 5
  },
  "Vd": {
    "name": "Vidrio Diamante",
    "slot": 11,
    "category": "colores",
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
    "nominalMm": 5
  },
  "Vab": {
    "name": "Vidrio Acanalado Bronce",
    "slot": 14,
    "category": "colores",
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
    "nominalMm": 9
  },
  "Gr": {
    "name": "Gradient",
    "slot": 18,
    "category": "inserciones",
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
    "nominalMm": 8
  },
  "Ds": {
    "name": "Dichroic Sunset",
    "slot": 20,
    "category": "inserciones",
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
    "nominalMm": 8
  },
  "In": {
    "name": "Interlayer",
    "slot": 22,
    "category": "inserciones",
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
    "nominalMm": 8
  },
  "Aq": {
    "name": "Malla Serie A — Qubo",
    "slot": 36,
    "category": "inserciones",
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
    "nominalMm": 8
  },
  "At": {
    "name": "Malla Serie A — Tejida",
    "slot": 39,
    "category": "inserciones",
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
    "nominalMm": 8
  },
  "Ec": {
    "name": "Espejo Claro",
    "slot": 91,
    "category": "reflectivos",
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
    "nominalMm": 6
  },
  "Ed": {
    "name": "Espejo Diamante",
    "slot": 98,
    "category": "reflectivos",
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
    "nominalMm": 10
  }
};
// Nominal total gauges come from glass-types.json. Scene scale uses a 250 mm
// wide reference swatch. Internal ply/film gauges remain illustrative: the
// catalogue does not specify polymer chemistry or a manufacturing layup.
const MM = W / 250;

export function createSample(code, coarse = false) {
  if (!presets[code]) throw new Error(`Unknown Visor sample: ${code}`);
  const kind = presets[code][2];
  const catalogue = CATALOGUE[code];
  const total = catalogue.nominalMm * MM;
  const distorts = kind === 'reed' || kind === 'diamond';

  if (kind === 'qubo' || kind === 'woven') {
    const sample = createQuboSample(W, H, coarse, kind === 'woven');
    sample.group.userData.layers = ['glass', 'bond', 'metal-weave', 'bond', 'glass'];
    return {
      ...sample, laminated: true, mirror: false, distorts: false,
      construction: 'Vidrio / interlámina / malla metálica / interlámina / vidrio',
    };
  }

  const group = new THREE.Group();
  group.name = `${code} · ${catalogue.name}`;
  const materials = [];
  const laminated = ['gradient', 'dichroic', 'color'].includes(kind);
  const mirror = kind.startsWith('mirror');
  const pane = glass({ thickness: distorts ? .72 : kind === 'frost' ? .36 : .185 });
  if (code === 'Vab') {
    pane.color.set('#d8b28f');
    pane.attenuationColor.set('#af784b');
    pane.attenuationDistance = .8;
  }
  if (kind === 'frost') {
    pane.roughness = .31;
    pane.envMapIntensity = .5;
  }
  // Silvered facets use the approved reflective approximation to avoid
  // screen-space refraction tearing at the edge of an opaque mirror backing.
  if (kind === 'mirror-diamond') {
    pane.transmission = 0;
    pane.metalness = 1;
    pane.color.set('#d6d9d6');
    pane.roughness = .14;
  }
  materials.push(pane);

  const plyThickness = laminated ? total * .375 : total;
  const coreThickness = laminated ? total * .25 : 0;
  const paneOffset = (plyThickness + coreThickness) / 2;
  let geometry;
  if (kind === 'reed') {
    geometry = reliefSlab('reed', total - .012);
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
  if (laminated) {
    back = new THREE.Mesh(geometry, pane);
    back.name = 'Rear glass ply';
    front.position.z = paneOffset;
    back.position.z = -paneOffset;
    group.add(back);

    const tint = glass({ thickness: coreThickness, roughness: .07 });
    if (kind === 'color') tint.color.set('#5995c2');
    if (kind === 'gradient') tint.map = gradientTexture();
    if (kind === 'dichroic') dichroic(tint);

    // Nested transmissive meshes are excluded from Three's transmission
    // buffer. Apply the effective laminate tint on either outer face while
    // assembled; show the actual film and clear plies during separation.
    composite = pane.clone();
    composite.color.copy(tint.color);
    composite.map = tint.map;
    if (kind === 'dichroic') dichroic(composite);
    front.material = back.material = composite;
    materials.push(composite, tint);

    const filmThickness = kind === 'dichroic' ? .004 : coreThickness;
    film = new THREE.Mesh(planarUV(beveledSlab(
      swatchOutline(W - .014, H - .014), filmThickness, .001)), tint);
    film.name = kind === 'dichroic' ? 'Dichroic optical film' : 'Decorative interlayer';
    film.visible = false;
    group.add(film);

    bondEdge = new THREE.Mesh(perimeterBand(swatchOutline(W - .014, H - .014), coreThickness),
      new THREE.MeshStandardMaterial({ color: '#b4c1b5', roughness: .3,
        transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide }));
    bondEdge.name = 'Interlayer perimeter';
    group.add(bondEdge);

    if (kind === 'dichroic') {
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
    const silver = new THREE.Mesh(planarUV(beveledSlab(swatchOutline(W - .006, H - .006), .0012, .0002)),
      new THREE.MeshStandardMaterial({ color: '#d6d9d6', metalness: 1, roughness: .055, envMapIntensity: 1.1 }));
    silver.name = 'Reflective coating';
    silver.position.z = -total / 2 - .0006;
    const protection = new THREE.Mesh(planarUV(beveledSlab(swatchOutline(W - .006, H - .006), .0012, .0002)),
      new THREE.MeshStandardMaterial({ color: '#535953', metalness: 0, roughness: .84 }));
    protection.name = 'Protective rear coating';
    protection.position.z = -total / 2 - .0018;
    group.add(silver, protection);
    materials.push(silver.material);
    if (kind === 'mirror') pane.roughness = .025;
  }

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: code === 'Vab' ? '#9b7959' : '#9baea1', roughness: .24, metalness: .15,
    transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide,
  });
  const edgeGeometry = perimeterBand(swatchOutline(W, H), plyThickness - .01);
  front.add(new THREE.Mesh(edgeGeometry, edgeMaterial));
  if (back) back.add(new THREE.Mesh(edgeGeometry, edgeMaterial));
  group.userData.layers = laminated
    ? kind === 'dichroic' ? ['glass', 'bond', 'dichroic-film', 'bond', 'glass'] : ['glass', 'decorative-interlayer', 'glass']
    : mirror ? ['glass', 'reflective-coating', 'protective-coating'] : ['glass'];
  // Keep inactive composite/clear materials reachable for GPU cleanup when
  // switching away from an exploded or assembled sample.
  group.userData.resourceMaterials = materials;

  const optical = materials.filter(material => material.transmission > 0).map(material => ({
    material, color: material.color.clone(), attenuation: material.attenuationDistance,
  }));
  const construction = kind === 'dichroic'
    ? 'Vidrio / interlámina / película dicroica / interlámina / vidrio'
    : laminated ? 'Vidrio / interlámina decorativa / vidrio'
      : mirror ? 'Vidrio / capa reflectante / protección posterior' : 'Una sola pieza de vidrio';

  return {
    group, laminated, mirror, distorts, construction,
    setSeparation(value) {
      if (!laminated) return;
      front.position.z = paneOffset + .52 * value;
      back.position.z = -paneOffset - .52 * value;
      const open = value > .001;
      film.visible = open;
      bondEdge.visible = !open;
      front.material = back.material = open ? pane : composite;
      if (bondFront) {
        const offset = (coreThickness + .004) / 4;
        bondFront.position.z = offset + .24 * value;
        bondBack.position.z = -offset - .24 * value;
        bondFront.visible = bondBack.visible = open;
      }
    },
    setDistortion(percent) {
      if (distorts) pane.thickness = .12 + percent * .02;
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
    },
    setLight(percent) {
      materials.forEach(material => { material.envMapIntensity = .3 + percent * .007; });
    },
  };
}
