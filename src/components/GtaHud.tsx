import { useEffect, useRef, useState } from "react";
import type { CarState } from "./scene/PlayerCar";
import type { GtaWeapon, GtaRadioStation } from "@/lib/useGtaData";

interface GtaHudProps {
  car: CarState;
  vehicleName: string;
  weapons: GtaWeapon[];
  radioStations: GtaRadioStation[];
  health: number;
  armor: number;
  money: number;
  wanted: number;
}

const CELL = 70; // matches CityGrid
const MINIMAP_R = 90; // canvas radius px
const MAP_SCALE = 1.2; // world-units per pixel

// Gampola zone names by rough world-space distance
const ZONES: { name: string; x: number; z: number; r: number }[] = [
  { name: "Gampola Town Centre", x: 0,    z: 0,    r: 90  },
  { name: "Mahaweli District",   x: 0,    z: 270,  r: 80  },
  { name: "Ambuluwawa Heights",  x: -220, z: 200,  r: 100 },
  { name: "Railway Quarter",     x: 105,  z: -18,  r: 70  },
  { name: "Buddhist Quarter",    x: -42,  z: 38,   r: 60  },
  { name: "Peradeniya Road",     x: 0,    z: -200, r: 70  },
  { name: "Gampola Streets",     x: 0,    z: 0,    r: 9999},
];

function getZone(x: number, z: number) {
  for (const zone of ZONES) {
    if (Math.hypot(x - zone.x, z - zone.z) < zone.r) return zone.name;
  }
  return "Gampola";
}

// ── Minimap ───────────────────────────────────────────────────────────────
function Minimap({ car }: { car: CarState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = MINIMAP_R * 2;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const cx = MINIMAP_R, cz = MINIMAP_R;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cz, MINIMAP_R - 1, 0, Math.PI * 2);
    ctx.clip();

    // Background
    ctx.fillStyle = "#090912";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Helper: world → canvas (north = up, fixed orientation)
    const toCanvas = (wx: number, wz: number) => ({
      px: cx + (wx - car.x) / MAP_SCALE,
      py: cz + (wz - car.z) / MAP_SCALE,
    });

    // Draw roads
    const ROAD_POSITIONS = Array.from({ length: 7 }, (_, i) => (i - 3) * CELL);
    ctx.strokeStyle = "#2a2a40";
    ctx.lineWidth = CELL === 70 ? ROAD_W(true) : ROAD_W(false);

    // N-S roads
    ROAD_POSITIONS.forEach((rx) => {
      ctx.lineWidth = rx === 0 ? 14 / MAP_SCALE : 8 / MAP_SCALE;
      ctx.beginPath();
      const t = toCanvas(rx, -500);
      const b = toCanvas(rx, 500);
      ctx.moveTo(t.px, t.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    });
    // E-W roads
    ROAD_POSITIONS.forEach((rz) => {
      ctx.lineWidth = rz === 0 ? 14 / MAP_SCALE : 8 / MAP_SCALE;
      ctx.beginPath();
      const l = toCanvas(-500, rz);
      const r = toCanvas(500, rz);
      ctx.moveTo(l.px, l.py);
      ctx.lineTo(r.px, r.py);
      ctx.stroke();
    });

    // River
    const rv0 = toCanvas(-400, 255), rv1 = toCanvas(400, 325);
    ctx.fillStyle = "#1a4a6a";
    ctx.fillRect(rv0.px, rv0.py, rv1.px - rv0.px, rv1.py - rv0.py);

    // Landmark blips
    const landmarks = [
      { x: 8,    z: -22,  color: "#ffe600" },
      { x: -42,  z: 38,   color: "#ffaa00" },
      { x: 105,  z: -18,  color: "#00e0ff" },
      { x: -220, z: 200,  color: "#ff2d95" },
    ];
    landmarks.forEach(({ x, z, color }) => {
      const { px, py } = toCanvas(x, z);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Player — white arrow pointing in heading direction
    const arrowSize = 7;
    const h = -car.heading; // canvas rotation (inverted because canvas Y↓)
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(h);
    ctx.beginPath();
    ctx.moveTo(0, -arrowSize);
    ctx.lineTo(-arrowSize * 0.55, arrowSize * 0.7);
    ctx.lineTo(0, arrowSize * 0.3);
    ctx.lineTo(arrowSize * 0.55, arrowSize * 0.7);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    // Compass ring
    ctx.restore();

    // Circle border
    ctx.beginPath();
    ctx.arc(cx, cz, MINIMAP_R - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff2d9580";
    ctx.lineWidth = 2;
    ctx.stroke();

    // North label
    ctx.fillStyle = "#ffffff99";
    ctx.font = "bold 10px Orbitron, monospace";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, 12);
  });

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ display: "block" }}
    />
  );
}

// Hack: avoid passing MAP_SCALE into a const (TS strict)
function ROAD_W(_main: boolean) { return 10; }

// ── Wanted Stars ──────────────────────────────────────────────────────────
function WantedStars({ level }: { level: number }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width={18} height={18} viewBox="0 0 18 18">
          <polygon
            points="9,1 11.5,6.5 17.5,7.2 13,11.5 14.5,17.5 9,14.5 3.5,17.5 5,11.5 0.5,7.2 6.5,6.5"
            fill={i < level ? "#ffd700" : "#333"}
            stroke={i < level ? "#ff9900" : "#555"}
            strokeWidth="0.8"
          />
        </svg>
      ))}
    </div>
  );
}

// ── Bar ───────────────────────────────────────────────────────────────────
function StatBar({ value, max, color, icon }: { value: number; max: number; color: string; icon: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{icon}</span>
      <div style={{ width: 130, height: 10, background: "#222", borderRadius: 5, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            transition: "width 0.3s",
            borderRadius: 5,
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontFamily: "Orbitron, monospace", color: "#aaa", minWidth: 28, textAlign: "right" }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

// ── Main HUD ─────────────────────────────────────────────────────────────
export function GtaHud({
  car,
  vehicleName,
  weapons,
  radioStations,
  health,
  armor,
  money,
  wanted,
}: GtaHudProps) {
  const [weaponIdx] = useState(0);
  const [radioIdx, setRadioIdx] = useState(0);
  const zone = getZone(car.x, car.z);
  const kmh = Math.round(Math.abs(car.speed) * 3.6);
  const weapon = weapons[weaponIdx] ?? { DisplayName: "Fists", Name: "weapon_unarmed" };
  const radio = radioStations[radioIdx] ?? { DisplayName: "Off" };

  // Cycle radio on R key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") {
        setRadioIdx((i) => (i + 1) % Math.max(1, radioStations.length));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [radioStations.length]);

  const hudStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    fontFamily: "Orbitron, monospace",
    color: "#fff",
    userSelect: "none",
  };

  return (
    <div style={hudStyle}>
      {/* ── Top-right: money + wanted ── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: "#44ff66",
            textShadow: "0 0 10px #44ff6688",
            fontWeight: 700,
          }}
        >
          ${money.toLocaleString()}
        </div>
        <WantedStars level={wanted} />
      </div>

      {/* ── Top-left: radio ── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 20,
          background: "#0008",
          backdropFilter: "blur(6px)",
          border: "1px solid #ff2d9540",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 11,
          color: "#ccc",
          maxWidth: 220,
        }}
      >
        <div style={{ color: "#00e0ff", marginBottom: 2, fontSize: 10 }}>
          ♫ NOW PLAYING
        </div>
        <div style={{ color: "#fff", fontSize: 12 }}>{radio.DisplayName}</div>
        <div style={{ color: "#888", fontSize: 9, marginTop: 2 }}>Press R to change</div>
      </div>

      {/* ── Bottom-left: minimap + speed ── */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid #ff2d9560",
            boxShadow: "0 0 16px #ff2d9540",
          }}
        >
          <Minimap car={car} />
        </div>
        {/* Speed + gear below radar */}
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              textShadow: "0 0 12px #ff2d95",
              lineHeight: 1,
            }}
          >
            {kmh}
          </span>
          <span style={{ fontSize: 11, color: "#aaa" }}>KM/H</span>
          <span style={{ fontSize: 14, color: "#00e0ff", textShadow: "0 0 8px #00e0ff" }}>
            G{car.gear}
          </span>
        </div>
      </div>

      {/* ── Bottom-right: health + armor + weapon ── */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          background: "#0008",
          backdropFilter: "blur(6px)",
          border: "1px solid #ffffff18",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        {/* Weapon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingBottom: 6,
            borderBottom: "1px solid #ffffff18",
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: 11, color: "#ccc" }}>{weapon.DisplayName}</span>
          <span style={{ fontSize: 16 }}>🔫</span>
          <span style={{ fontSize: 12, color: "#ffe600" }}>∞</span>
        </div>
        {/* Health */}
        <StatBar value={health} max={100} color="#e83040" icon="❤" />
        {/* Armor */}
        <StatBar value={armor} max={100} color="#70b0d0" icon="🛡" />
        {/* Vehicle */}
        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
          {vehicleName}
        </div>
      </div>

      {/* ── Location banner (fades after appearing) ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: 20,
          transform: "translateY(-50%)",
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontSize: 15,
            color: "#ffffffcc",
            textShadow: "0 0 8px #ffffff44",
            fontWeight: 400,
          }}
        >
          {zone}
        </div>
        <div style={{ fontSize: 10, color: "#ffffff66" }}>Gampola · Sri Lanka</div>
      </div>

      {/* ── Controls hint (small, bottom-centre) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 9,
          color: "#ffffff44",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        WASD / Arrows · R = Radio
      </div>
    </div>
  );
}
