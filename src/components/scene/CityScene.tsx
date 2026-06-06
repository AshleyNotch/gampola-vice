import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Stars, AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import { CityGrid } from "./CityGrid";
import { PlayerCar } from "./PlayerCar";
import type { CarState } from "./PlayerCar";

interface CitySceneProps {
  onCarUpdate: (s: CarState) => void;
  carColor: string;
  speedMult: number;
  accelMult: number;
}

export function CityScene({
  onCarUpdate,
  carColor,
  speedMult,
  accelMult,
}: CitySceneProps) {
  return (
    <Canvas
      shadows="basic"
      dpr={[1, 1.5]}                     // cap pixel ratio on HiDPI screens
      camera={{ position: [0, 10, 22], fov: 65, near: 0.5, far: 900 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      {/* Adaptive resolution — drops DPR when framerate falls */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />

      {/* ── Atmosphere ── */}
      <fog attach="fog" args={["#1a0b2e", 200, 650]} />

      {/* ── Sky & Stars ── */}
      <Sky
        distance={4500}
        sunPosition={[80, 30, -120]}
        inclination={0.52}
        azimuth={0.22}
        turbidity={8}
        rayleigh={0.4}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <Stars radius={400} depth={60} count={2000} factor={4} fade />

      {/* ── Lighting — only 2 shadow-casting lights total ── */}
      <ambientLight intensity={0.45} color="#b8c8e8" />
      <directionalLight
        position={[80, 120, -80]}
        intensity={1.3}
        color="#ffddaa"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-camera-left={-180}
        shadow-camera-right={180}
        shadow-camera-top={180}
        shadow-camera-bottom={-180}
        shadow-bias={-0.001}
      />
      {/* Soft fill from opposite side — no shadow */}
      <directionalLight position={[-60, 40, 80]} intensity={0.3} color="#88aaff" />

      {/* ── World ── */}
      <Suspense fallback={null}>
        <CityGrid />
        <PlayerCar
          onUpdate={onCarUpdate}
          color={carColor}
          speedMult={speedMult}
          accelMult={accelMult}
        />
      </Suspense>
    </Canvas>
  );
}

export type { CarState };
