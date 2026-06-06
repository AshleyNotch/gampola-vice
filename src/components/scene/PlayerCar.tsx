import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface CarState {
  x: number;
  z: number;
  heading: number; // radians, 0=north(-Z), π/2=east(+X), clockwise
  speed: number;   // m/s
  gear: number;
  rpm: number;
  braking: boolean;
  lat: number;
  lng: number;
}

interface PlayerCarProps {
  onUpdate: (s: CarState) => void;
  color?: string;
  speedMult?: number;
  accelMult?: number;
}

const BASE_MAX_SPEED = 40;
const BASE_ACCEL = 15;
const BRAKE_F = 34;
const FRICTION = 5;
const TURN_RATE = 2.1; // rad/s

const START_LAT = 7.16412;
const START_LNG = 80.5737;
const MPD = 111000; // meters per degree lat

export function PlayerCar({
  onUpdate,
  color = "#1a5fff",
  speedMult = 1,
  accelMult = 1,
}: PlayerCarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wheelFL = useRef<THREE.Mesh>(null);
  const wheelFR = useRef<THREE.Mesh>(null);
  const wheelRL = useRef<THREE.Mesh>(null);
  const wheelRR = useRef<THREE.Mesh>(null);
  const brakeMat0 = useRef<THREE.MeshStandardMaterial>(null);
  const brakeMat1 = useRef<THREE.MeshStandardMaterial>(null);
  const { camera } = useThree();

  const keys = useRef<Set<string>>(new Set());
  const phys = useRef<CarState>({
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    gear: 1,
    rpm: 0.2,
    braking: false,
    lat: START_LAT,
    lng: START_LNG,
  });
  const hudTimer = useRef(0);
  const camPos = useRef(new THREE.Vector3(0, 10, 22));
  const camLook = useRef(new THREE.Vector3(0, 1, 0));

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k))
        e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) =>
      keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useFrame((_state, delta: number) => {
    const dt = Math.min(delta, 0.05);
    const p = phys.current;
    const k = keys.current;

    const MAX_SPEED = BASE_MAX_SPEED * speedMult;
    const ACCEL = BASE_ACCEL * accelMult;
    const MAX_REV = MAX_SPEED * 0.35;

    const fwd = k.has("arrowup") || k.has("w");
    const back = k.has("arrowdown") || k.has("s");
    const left = k.has("arrowleft") || k.has("a");
    const right = k.has("arrowright") || k.has("d");

    // Throttle / brake
    if (fwd) {
      p.speed = Math.min(MAX_SPEED, p.speed + ACCEL * dt);
      p.braking = false;
    } else if (back) {
      if (p.speed > 1) {
        p.speed = Math.max(0, p.speed - BRAKE_F * dt);
        p.braking = true;
      } else {
        p.speed = Math.max(-MAX_REV, p.speed - ACCEL * 0.55 * dt);
        p.braking = false;
      }
    } else {
      p.braking = false;
      if (p.speed > 0) p.speed = Math.max(0, p.speed - FRICTION * dt);
      else if (p.speed < 0) p.speed = Math.min(0, p.speed + FRICTION * dt);
    }

    // Steering
    if (Math.abs(p.speed) > 0.5) {
      const sf = Math.min(1, Math.abs(p.speed) / 7);
      const dir = p.speed >= 0 ? 1 : -1;
      if (left) p.heading -= TURN_RATE * dt * sf * dir;
      if (right) p.heading += TURN_RATE * dt * sf * dir;
    }

    // Move — heading 0 = north(-Z), π/2 = east(+X)
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z -= Math.cos(p.heading) * p.speed * dt;

    // GPS
    p.lat = START_LAT - p.z / MPD;
    p.lng =
      START_LNG + p.x / (MPD * Math.cos((START_LAT * Math.PI) / 180));

    // Gear + RPM
    const spd = Math.abs(p.speed);
    p.gear =
      spd < 6 ? 1 : spd < 13 ? 2 : spd < 21 ? 3 : spd < 29 ? 4 : spd < 35 ? 5 : 6;
    p.rpm = 0.18 + (spd / MAX_SPEED) * 0.82;

    // Apply to 3D mesh
    const g = groupRef.current;
    if (g) {
      g.position.set(p.x, 0, p.z);
      g.rotation.y = -p.heading;

      // Spin wheels proportional to speed
      const spin = p.speed * dt * 1.85;
      for (const ref of [wheelFL, wheelFR, wheelRL, wheelRR]) {
        if (ref.current) ref.current.rotation.x += spin;
      }
    }

    // Brake lights
    const bi = p.braking ? 2.5 : 0.35;
    if (brakeMat0.current) brakeMat0.current.emissiveIntensity = bi;
    if (brakeMat1.current) brakeMat1.current.emissiveIntensity = bi;

    // Camera follow — behind & above the car
    const dist = 22;
    const height = 9 + spd * 0.07;
    const tx = p.x - Math.sin(p.heading) * dist;
    const tz = p.z + Math.cos(p.heading) * dist;
    camPos.current.lerp(new THREE.Vector3(tx, height, tz), 0.05);
    camLook.current.lerp(new THREE.Vector3(p.x, 1.2, p.z), 0.06);
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);

    // Push state to HUD ~8x/s
    hudTimer.current += dt;
    if (hudTimer.current > 0.12) {
      hudTimer.current = 0;
      onUpdate({ ...p });
    }
  });

  return (
    <group ref={groupRef}>
      {/* ── Chassis ── */}
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[2.0, 0.55, 4.4]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.82} />
      </mesh>

      {/* ── Cabin ── */}
      <mesh castShadow position={[0, 1.2, -0.18]}>
        <boxGeometry args={[1.72, 0.8, 2.72]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.82} />
      </mesh>

      {/* ── Roof spoiler ── */}
      <mesh castShadow position={[0, 1.65, 1.0]}>
        <boxGeometry args={[1.6, 0.1, 0.48]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.82} />
      </mesh>

      {/* ── Front windshield ── */}
      <mesh position={[0, 1.17, -1.56]}>
        <boxGeometry args={[1.6, 0.62, 0.07]} />
        <meshStandardMaterial
          color="#88ccff"
          roughness={0.0}
          metalness={0.05}
          opacity={0.38}
          transparent
        />
      </mesh>

      {/* ── Rear windshield ── */}
      <mesh position={[0, 1.17, 1.22]}>
        <boxGeometry args={[1.6, 0.58, 0.07]} />
        <meshStandardMaterial
          color="#88ccff"
          roughness={0.0}
          metalness={0.05}
          opacity={0.38}
          transparent
        />
      </mesh>

      {/* ── Side windows ── */}
      <mesh position={[-0.87, 1.17, -0.18]}>
        <boxGeometry args={[0.07, 0.55, 1.8]} />
        <meshStandardMaterial
          color="#88ccff"
          roughness={0.0}
          opacity={0.38}
          transparent
        />
      </mesh>
      <mesh position={[0.87, 1.17, -0.18]}>
        <boxGeometry args={[0.07, 0.55, 1.8]} />
        <meshStandardMaterial
          color="#88ccff"
          roughness={0.0}
          opacity={0.38}
          transparent
        />
      </mesh>

      {/* ── Front bumper ── */}
      <mesh position={[0, 0.32, -2.27]}>
        <boxGeometry args={[2.02, 0.24, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>

      {/* ── Rear bumper ── */}
      <mesh position={[0, 0.32, 2.27]}>
        <boxGeometry args={[2.02, 0.24, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>

      {/* ── Headlights ── */}
      <mesh position={[-0.62, 0.55, -2.25]}>
        <boxGeometry args={[0.58, 0.28, 0.06]} />
        <meshStandardMaterial
          color="#fffce0"
          emissive="#fffce0"
          emissiveIntensity={1.5}
        />
      </mesh>
      <mesh position={[0.62, 0.55, -2.25]}>
        <boxGeometry args={[0.58, 0.28, 0.06]} />
        <meshStandardMaterial
          color="#fffce0"
          emissive="#fffce0"
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Headlight point lights */}
      <pointLight
        position={[-0.62, 0.55, -3.0]}
        intensity={40}
        color="#fffee8"
        distance={30}
        decay={2}
      />
      <pointLight
        position={[0.62, 0.55, -3.0]}
        intensity={40}
        color="#fffee8"
        distance={30}
        decay={2}
      />

      {/* ── Tail lights ── */}
      <mesh position={[-0.62, 0.55, 2.25]}>
        <boxGeometry args={[0.58, 0.28, 0.06]} />
        <meshStandardMaterial
          ref={brakeMat0}
          color="#ff0808"
          emissive="#ff0808"
          emissiveIntensity={0.35}
        />
      </mesh>
      <mesh position={[0.62, 0.55, 2.25]}>
        <boxGeometry args={[0.58, 0.28, 0.06]} />
        <meshStandardMaterial
          ref={brakeMat1}
          color="#ff0808"
          emissive="#ff0808"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* ── Wheels — FL FR RL RR ── */}
      {(
        [
          [-1.06, 0.36, -1.45, wheelFL],
          [1.06, 0.36, -1.45, wheelFR],
          [-1.06, 0.36, 1.45, wheelRL],
          [1.06, 0.36, 1.45, wheelRR],
        ] as [number, number, number, { current: THREE.Mesh | null }][]
      ).map(([wx, wy, wz, ref], i) => (
        <group key={i} position={[wx, wy, wz]}>
          {/* Tyre */}
          <mesh ref={ref} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.22, 14]} />
            <meshStandardMaterial color="#111" roughness={0.92} />
          </mesh>
          {/* Rim */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.22, 0.22, 0.23, 8]} />
            <meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Hub cap dot */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[wx < 0 ? -0.115 : 0.115, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.01, 6]} />
            <meshStandardMaterial color="#555" metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ── Soft under-glow (Vice City style) ── */}
      <pointLight position={[0, 0.1, 0]} intensity={3} color="#8800ff" distance={6} decay={2} />
    </group>
  );
}
