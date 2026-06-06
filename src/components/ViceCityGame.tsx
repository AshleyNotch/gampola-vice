import { useState, useCallback, useRef, useEffect } from "react";
import { CityScene } from "./scene/CityScene";
import { GtaHud } from "./GtaHud";
import { useGtaData, CLASS_STATS } from "@/lib/useGtaData";
import type { GtaVehicle } from "@/lib/useGtaData";
import type { CarState } from "./scene/PlayerCar";

interface SelectedVehicle {
  vehicle: GtaVehicle;
  color: string;
  speedMult: number;
  accelMult: number;
}

// ── Vehicle Select Screen ────────────────────────────────────────────────
function VehicleSelect({
  vehicles,
  onSelect,
}: {
  vehicles: GtaVehicle[];
  onSelect: (v: SelectedVehicle) => void;
}) {
  const [highlighted, setHighlighted] = useState(-1);

  const pick = (v: GtaVehicle, i: number) => {
    if (highlighted === i) {
      const stats = CLASS_STATS[v.Class] ?? CLASS_STATS.default;
      onSelect({ vehicle: v, color: stats.color, speedMult: stats.speedMult, accelMult: stats.accelMult });
    } else {
      setHighlighted(i);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#0d0520",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Orbitron, monospace",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg,rgba(0,0,0,0.13) 0px,rgba(0,0,0,0.13) 1px,transparent 2px,transparent 4px)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      <h1
        style={{
          fontSize: "clamp(32px, 6vw, 72px)",
          letterSpacing: "0.12em",
          color: "#ff2d95",
          textShadow: "0 0 30px #ff2d95, 0 0 6px #ff2d95",
          margin: 0,
          lineHeight: 1,
        }}
      >
        GAMPOLA
      </h1>
      <p
        style={{
          fontSize: "clamp(18px, 3vw, 36px)",
          color: "#00e0ff",
          textShadow: "0 0 20px #00e0ff",
          margin: "4px 0 24px",
          letterSpacing: "0.25em",
        }}
      >
        VICE DRIVE
      </p>

      <p style={{ fontSize: 12, color: "#aaa", marginBottom: 20, letterSpacing: "0.2em" }}>
        SELECT VEHICLE — TAP TWICE TO CONFIRM
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 10,
          maxWidth: 820,
          width: "90vw",
          maxHeight: "55vh",
          overflowY: "auto",
          padding: "4px 8px",
        }}
      >
        {vehicles.map((v, i) => {
          const stats = CLASS_STATS[v.Class] ?? CLASS_STATS.default;
          const isHL = highlighted === i;
          return (
            <button
              key={v.Name}
              onClick={() => pick(v, i)}
              style={{
                background: isHL ? `${stats.color}33` : "#ffffff0a",
                border: `1px solid ${isHL ? stats.color : "#ffffff22"}`,
                borderRadius: 6,
                padding: "10px 8px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s",
                boxShadow: isHL ? `0 0 12px ${stats.color}66` : "none",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: stats.color,
                  margin: "0 auto 6px",
                  boxShadow: isHL ? `0 0 8px ${stats.color}` : "none",
                }}
              />
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, lineHeight: 1.3 }}>
                {v.DisplayName}
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>{v.Class}</div>
              {isHL && (
                <div style={{ fontSize: 9, color: "#00e0ff", marginTop: 4 }}>
                  SPD {Math.round(stats.speedMult * 100)}% · ACC {Math.round(stats.accelMult * 100)}%
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: "#555", marginTop: 16, letterSpacing: "0.15em" }}>
        WASD / ARROWS TO DRIVE · R = RADIO
      </p>
    </div>
  );
}

// ── Main Game ────────────────────────────────────────────────────────────
export function ViceCityGame() {
  const gtaData = useGtaData();

  const [phase, setPhase] = useState<"loading" | "select" | "game">("loading");
  const [selected, setSelected] = useState<SelectedVehicle | null>(null);
  const [carState, setCarState] = useState<CarState>({
    x: 0, z: 0, heading: 0, speed: 0, gear: 1, rpm: 0.2,
    braking: false, lat: 7.16412, lng: 80.5737,
  });

  // HUD game state
  const [health] = useState(100);
  const [armor] = useState(75);
  const [money, setMoney] = useState(5000);
  const [wanted, setWanted] = useState(0);

  const moneyTimer = useRef(0);
  const wantedTimer = useRef(0);
  const carRef = useRef(carState);
  carRef.current = carState;

  // Transition from loading → select once data resolves
  useEffect(() => {
    if (!gtaData.loading && phase === "loading") {
      setTimeout(() => setPhase("select"), 600);
    }
  }, [gtaData.loading, phase]);

  // Tick: money accumulates while moving; wanted stars based on speed
  useEffect(() => {
    if (phase !== "game") return;
    const id = setInterval(() => {
      const s = carRef.current;
      const spd = Math.abs(s.speed);
      moneyTimer.current += 0.25;
      if (moneyTimer.current > 1 && spd > 2) {
        setMoney((m) => m + Math.floor(spd * 1.2));
        moneyTimer.current = 0;
      }
      wantedTimer.current += 0.25;
      if (wantedTimer.current > 1) {
        wantedTimer.current = 0;
        const kmh = spd * 3.6;
        if (kmh > 130) setWanted((w) => Math.min(5, w + 1));
        else if (kmh > 100) setWanted((w) => Math.min(3, w > 0 ? w : 0));
        else if (spd < 1) setWanted((w) => Math.max(0, w - 1));
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  const handleCarUpdate = useCallback((s: CarState) => {
    setCarState(s);
  }, []);

  const handleVehicleSelect = useCallback((v: SelectedVehicle) => {
    setSelected(v);
    setPhase("game");
  }, []);

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#0d0520",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Monoton, monospace",
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: "clamp(28px, 5vw, 64px)",
            color: "#ff2d95",
            textShadow: "0 0 30px #ff2d95",
            letterSpacing: "0.1em",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        >
          GAMPOLA
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#00e0ff",
            fontFamily: "Orbitron, monospace",
            letterSpacing: "0.3em",
            textShadow: "0 0 12px #00e0ff",
          }}
        >
          LOADING CITY…
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.65} }`}</style>
      </div>
    );
  }

  // ── Vehicle Select ──
  if (phase === "select") {
    return (
      <VehicleSelect
        vehicles={gtaData.vehicles}
        onSelect={handleVehicleSelect}
      />
    );
  }

  // ── Game ──
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0d0520" }}>
      <CityScene
        onCarUpdate={handleCarUpdate}
        carColor={selected?.color ?? "#1a5fff"}
        speedMult={selected?.speedMult ?? 1}
        accelMult={selected?.accelMult ?? 1}
      />
      <GtaHud
        car={carState}
        vehicleName={selected?.vehicle.DisplayName ?? "Unknown"}
        weapons={gtaData.weapons}
        radioStations={gtaData.radioStations}
        health={health}
        armor={armor}
        money={money}
        wanted={wanted}
      />
    </div>
  );
}
