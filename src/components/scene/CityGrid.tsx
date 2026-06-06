import { useMemo } from "react";
import * as THREE from "three";

// Seeded LCG for deterministic city layout
function lcg(seed: number) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// Sri Lankan painted walls + Vice City neons
const BLDG_COLORS = [
  "#ddd4ba", "#c8a878", "#d4997a", "#8fbcd4",
  "#bcc87a", "#a0a098", "#d4b8a8", "#7ab4a0",
  "#e8d8b0", "#c4b090", "#9ab8d0", "#b8d4a0",
];
const NEON_COLORS = ["#ff2d95", "#00e0ff", "#ffe600", "#9d4fff", "#ff6b00"];

const CELL  = 70;    // road-centre to road-centre spacing (m)
const ROAD_W_MAIN = 14;
const ROAD_W_SEC  = 8;
const CITY_EXT = 3;  // cells either side of centre → −3..+3

// Road positions
const ROAD_POS = Array.from({ length: CITY_EXT * 2 + 1 }, (_, i) => (i - CITY_EXT) * CELL);

interface BldgDef { x: number; z: number; w: number; h: number; d: number; color: string; neon?: string }
interface TreeDef { x: number; z: number; height: number }
interface LightDef { x: number; z: number }
interface ParkedDef { x: number; z: number; ry: number; color: string }

const PARKED_COLORS = ["#cc2020","#2040cc","#208040","#ccaa20","#888","#cc6020","#204070","#602080"];

export function CityGrid() {
  const { buildings, trees, lights, parked } = useMemo(() => {
    const buildings: BldgDef[] = [];
    const trees: TreeDef[]     = [];
    const lights: LightDef[]   = [];
    const parked: ParkedDef[]  = [];

    // Building blocks between consecutive roads
    for (let bi = 0; bi < ROAD_POS.length - 1; bi++) {
      for (let bj = 0; bj < ROAD_POS.length - 1; bj++) {
        const rx0 = ROAD_POS[bi], rx1 = ROAD_POS[bi + 1];
        const rz0 = ROAD_POS[bj], rz1 = ROAD_POS[bj + 1];
        const rw = rx0 === 0 || rx1 === 0 ? ROAD_W_MAIN : ROAD_W_SEC;
        const rd = rz0 === 0 || rz1 === 0 ? ROAD_W_MAIN : ROAD_W_SEC;

        const blockCX = (rx0 + rx1) / 2;
        const blockCZ = (rz0 + rz1) / 2;
        const blockW  = rx1 - rx0 - rw;
        const blockD  = rz1 - rz0 - rd;
        if (blockW < 10 || blockD < 10) continue;

        const rng = lcg(bi * 97 + bj * 31 + 7);
        const distFromCentre = Math.sqrt(blockCX ** 2 + blockCZ ** 2);
        const isDense  = distFromCentre < 100;
        const isMid    = distFromCentre < 180;
        const numBldgs = isDense ? 3 + Math.floor(rng() * 4) : isMid ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);

        // Place buildings inside block
        for (let b = 0; b < numBldgs; b++) {
          const bw = 8 + rng() * (isDense ? 22 : 30);
          const bd = 8 + rng() * (isDense ? 22 : 30);
          const bh = isDense ? 6 + rng() * 28 : isMid ? 4 + rng() * 14 : 3 + rng() * 8;
          const bxOff = (rng() - 0.5) * Math.max(0, blockW - bw - 4);
          const bzOff = (rng() - 0.5) * Math.max(0, blockD - bd - 4);
          const col   = BLDG_COLORS[Math.floor(rng() * BLDG_COLORS.length)];
          const neon  = (isDense && rng() > 0.65) ? NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)] : undefined;
          buildings.push({ x: blockCX + bxOff, z: blockCZ + bzOff, w: bw, h: bh, d: bd, color: col, neon });
        }

        // Trees near block edges
        if (rng() > 0.45) {
          const side = rng() > 0.5 ? 1 : -1;
          trees.push({
            x: blockCX + side * (blockW / 2 + 2) * (rng() > 0.5 ? 0.6 : -0.6),
            z: blockCZ + (rng() - 0.5) * blockD * 0.7,
            height: 5 + rng() * 6,
          });
        }
        if (rng() > 0.55) {
          trees.push({
            x: blockCX + (rng() - 0.5) * blockW * 0.7,
            z: blockCZ + (rng() > 0.5 ? 1 : -1) * (blockD / 2 + 2) * 0.6,
            height: 4 + rng() * 7,
          });
        }

        // Parked cars on the road edge of the block
        if (rng() > 0.4) {
          const side = rng() > 0.5 ? 1 : -1;
          const px = rx0 + rw / 2 + 2.5;
          const pz = blockCZ + (rng() - 0.5) * blockD * 0.6;
          parked.push({ x: px * side, z: pz, ry: side > 0 ? 0 : Math.PI, color: PARKED_COLORS[Math.floor(rng() * PARKED_COLORS.length)] });
        }
      }
    }

    // Street lights along main roads every 35m
    for (let pos = -280; pos <= 280; pos += 35) {
      lights.push({ x: ROAD_W_MAIN / 2 + 2, z: pos });
      lights.push({ x: -(ROAD_W_MAIN / 2 + 2), z: pos });
      lights.push({ x: pos, z: ROAD_W_MAIN / 2 + 2 });
      lights.push({ x: pos, z: -(ROAD_W_MAIN / 2 + 2) });
    }

    return { buildings, trees, lights, parked };
  }, []);

  // Road material (shared)
  const roadMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#252535", roughness: 0.95 }),
    []
  );
  const sidewalkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#484848", roughness: 0.85 }),
    []
  );

  return (
    <group>
      {/* ── Ground ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#1c1c24" roughness={0.95} />
      </mesh>

      {/* ── N-S Roads ── */}
      {ROAD_POS.map((x) => {
        const w = x === 0 ? ROAD_W_MAIN : ROAD_W_SEC;
        return (
          <mesh key={`ns-${x}`} position={[x, 0.01, 0]} material={roadMat}>
            <boxGeometry args={[w, 0.02, 600]} />
          </mesh>
        );
      })}

      {/* ── E-W Roads ── */}
      {ROAD_POS.map((z) => {
        const d = z === 0 ? ROAD_W_MAIN : ROAD_W_SEC;
        return (
          <mesh key={`ew-${z}`} position={[0, 0.01, z]} material={roadMat}>
            <boxGeometry args={[600, 0.02, d]} />
          </mesh>
        );
      })}

      {/* ── Sidewalks alongside main roads ── */}
      {ROAD_POS.map((x) => {
        const hw = (x === 0 ? ROAD_W_MAIN : ROAD_W_SEC) / 2;
        return [1, -1].map((side) => (
          <mesh key={`sw-ns-${x}-${side}`} position={[x + side * (hw + 2), 0.015, 0]} material={sidewalkMat}>
            <boxGeometry args={[3.5, 0.025, 600]} />
          </mesh>
        ));
      })}
      {ROAD_POS.map((z) => {
        const hd = (z === 0 ? ROAD_W_MAIN : ROAD_W_SEC) / 2;
        return [1, -1].map((side) => (
          <mesh key={`sw-ew-${z}-${side}`} position={[0, 0.015, z + side * (hd + 2)]} material={sidewalkMat}>
            <boxGeometry args={[600, 0.025, 3.5]} />
          </mesh>
        ));
      })}

      {/* ── Centre-line markings on main roads ── */}
      {Array.from({ length: 20 }, (_, i) => i * 26 - 250).flatMap((pos) => [
        <mesh key={`ml-ns-${pos}`} position={[0, 0.04, pos]}>
          <boxGeometry args={[0.25, 0.01, 12]} />
          <meshStandardMaterial color="#ffe040" />
        </mesh>,
        <mesh key={`ml-ew-${pos}`} position={[pos, 0.04, 0]}>
          <boxGeometry args={[12, 0.01, 0.25]} />
          <meshStandardMaterial color="#ffe040" />
        </mesh>,
      ])}

      {/* ── Buildings ── */}
      {buildings.map((b, i) => (
        <group key={`b-${i}`} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} roughness={0.82} />
          </mesh>
          <mesh position={[0, b.h + 0.15, 0]}>
            <boxGeometry args={[b.w + 0.3, 0.3, b.d + 0.3]} />
            <meshStandardMaterial color="#555" roughness={0.9} />
          </mesh>
          {/* Neon sign — emissive only, no point light */}
          {b.neon && (
            <mesh position={[0, b.h * 0.6, b.d / 2 + 0.15]}>
              <boxGeometry args={[Math.min(b.w * 0.7, 6), 1.6, 0.2]} />
              <meshStandardMaterial color={b.neon} emissive={b.neon} emissiveIntensity={3} />
            </mesh>
          )}
        </group>
      ))}

      {/* ── Coconut Palm Trees ── */}
      {trees.map((t, i) => (
        <group key={`t-${i}`} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.height / 2, 0]}>
            <cylinderGeometry args={[0.14, 0.2, t.height, 6]} />
            <meshStandardMaterial color="#7a5530" roughness={0.9} />
          </mesh>
          <mesh position={[0, t.height + 0.6, 0]}>
            <sphereGeometry args={[1.3, 7, 6]} />
            <meshStandardMaterial color="#2a6a1a" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* ── Street Lights — emissive only, no point lights ── */}
      {lights.map((l, i) => (
        <group key={`l-${i}`} position={[l.x, 0, l.z]}>
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 7, 5]} />
            <meshStandardMaterial color="#444" roughness={0.7} />
          </mesh>
          <mesh position={[0, 7.3, 0]}>
            <sphereGeometry args={[0.28, 7, 7]} />
            <meshStandardMaterial color="#ffcc55" emissive="#ffcc55" emissiveIntensity={2.2} />
          </mesh>
        </group>
      ))}

      {/* ── Parked Cars ── */}
      {parked.map((c, i) => (
        <group key={`pc-${i}`} position={[c.x, 0, c.z]} rotation={[0, c.ry, 0]}>
          <mesh castShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[1.9, 0.55, 4.2]} />
            <meshStandardMaterial color={c.color} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh castShadow position={[0, 1.08, -0.2]}>
            <boxGeometry args={[1.65, 0.72, 2.5]} />
            <meshStandardMaterial color={c.color} roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ── Mahaweli River (south) ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 290]}>
        <planeGeometry args={[700, 70]} />
        <meshStandardMaterial color="#1a4a6a" roughness={0.1} metalness={0.5} />
      </mesh>
      {/* River banks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 256]}>
        <planeGeometry args={[700, 5]} />
        <meshStandardMaterial color="#6a5a3a" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 324]}>
        <planeGeometry args={[700, 5]} />
        <meshStandardMaterial color="#6a5a3a" roughness={0.9} />
      </mesh>

      {/* ── Clock Tower (town centre landmark) ── */}
      <group position={[8, 0, -22]}>
        <mesh castShadow position={[0, 9, 0]}>
          <boxGeometry args={[3.5, 18, 3.5]} />
          <meshStandardMaterial color="#ddd0b0" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 18.5, 0]}>
          <boxGeometry args={[4.2, 1, 4.2]} />
          <meshStandardMaterial color="#888" roughness={0.8} />
        </mesh>
        {/* Clock face (emissive circle stand-in) */}
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ry, i) => (
          <mesh key={i} position={[
            Math.sin(ry) * 1.8,
            16.5,
            Math.cos(ry) * 1.8,
          ]} rotation={[0, ry, 0]}>
            <circleGeometry args={[1.0, 16]} />
            <meshStandardMaterial color="#fff8e0" emissive="#fff8e0" emissiveIntensity={0.6} />
          </mesh>
        ))}
        {/* single light for clock tower — kept for ambiance */}
        <pointLight position={[0, 16, 0]} intensity={6} color="#fff5cc" distance={18} decay={2} />
      </group>

      {/* ── Buddhist Stupa / Temple ── */}
      <group position={[-42, 0, 38]}>
        {/* Base platform */}
        <mesh receiveShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[14, 1, 14]} />
          <meshStandardMaterial color="#e8d8a0" roughness={0.8} />
        </mesh>
        {/* Dome */}
        <mesh castShadow position={[0, 6, 0]}>
          <sphereGeometry args={[5, 16, 12]} />
          <meshStandardMaterial color="#f0e8c0" roughness={0.6} />
        </mesh>
        {/* Spire */}
        <mesh castShadow position={[0, 12.5, 0]}>
          <coneGeometry args={[0.6, 4, 8]} />
          <meshStandardMaterial color="#d4aa20" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* ── Railway Station (east) ── */}
      <group position={[105, 0, -18]}>
        <mesh castShadow receiveShadow position={[0, 2.5, 0]}>
          <boxGeometry args={[28, 5, 10]} />
          <meshStandardMaterial color="#d4c4a0" roughness={0.8} />
        </mesh>
        {/* Platform canopy */}
        <mesh position={[0, 5.6, 0]}>
          <boxGeometry args={[30, 0.3, 14]} />
          <meshStandardMaterial color="#a08860" roughness={0.7} />
        </mesh>
        {/* Station sign neon */}
        <mesh position={[0, 6.5, -5.3]}>
          <boxGeometry args={[10, 1.4, 0.2]} />
          <meshStandardMaterial color="#00e0ff" emissive="#00e0ff" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* ── Ambuluwawa Hill outline (SW) ── */}
      <mesh castShadow receiveShadow position={[-220, 0, 200]}>
        <coneGeometry args={[60, 80, 8]} />
        <meshStandardMaterial color="#1a3a10" roughness={0.95} />
      </mesh>
      {/* Tower on hill */}
      <mesh castShadow position={[-220, 82, 200]}>
        <cylinderGeometry args={[2, 3, 18, 8]} />
        <meshStandardMaterial color="#888" roughness={0.8} />
      </mesh>
    </group>
  );
}
