import { useEffect, useRef, useState } from "react";
import carSprite from "@/assets/car.png";
import { useGoogleMaps } from "@/lib/useGoogleMaps";
import { GameHud } from "@/components/GameHud";

// Gampola, Sri Lanka
const START = { lat: 7.16412, lng: 80.5737 };

const LANDMARKS = [
  { name: "Gampola Town", lat: 7.16412, lng: 80.5737 },
  { name: "Ambuluwawa Tower", lat: 7.14985, lng: 80.56671 },
  { name: "Gampola Bridge", lat: 7.16128, lng: 80.57749 },
];

// Vice City neon dark map style
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a0b2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#ff5fd2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#13031f" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1a3a" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#1f0d36" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#3a1f5c" }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#52306e" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#00e0ff" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0090aa" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7af9ff" }] },
];

const M_PER_DEG = 111000;
const MAX_SPEED = 26; // m/s
const ACCEL = 14;
const BRAKE = 22;
const FRICTION = 7;
const TURN_RATE = 130; // deg/s at full effect

export function ViceCityGame() {
  const { ready, error } = useGoogleMaps();
  const mapDiv = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const carRef = useRef<HTMLImageElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const state = useRef({ ...START, heading: 0, speed: 0 });
  const [hud, setHud] = useState({ speed: 0, location: "Gampola" });
  const [started, setStarted] = useState(false);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      keys.current[k] = true;
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // init map
  useEffect(() => {
    if (!ready || !mapDiv.current || mapRef.current) return;
    const g = window.google;
    const map = new g.maps.Map(mapDiv.current, {
      center: START,
      zoom: 18,
      disableDefaultUI: true,
      gestureHandling: "none",
      keyboardShortcuts: false,
      styles: MAP_STYLE,
      backgroundColor: "#1a0b2e",
    });
    mapRef.current = map;

    LANDMARKS.forEach((lm) => {
      new g.maps.Marker({
        position: { lat: lm.lat, lng: lm.lng },
        map,
        title: lm.name,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#ffe600",
          fillOpacity: 1,
          strokeColor: "#ff2d95",
          strokeWeight: 3,
        },
      });
    });
  }, [ready]);

  // game loop
  useEffect(() => {
    if (!ready || !started) return;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = state.current;
      const k = keys.current;

      const fwd = k["arrowup"] || k["w"];
      const back = k["arrowdown"] || k["s"];
      const left = k["arrowleft"] || k["a"];
      const right = k["arrowright"] || k["d"];

      if (fwd) s.speed += ACCEL * dt;
      else if (back) s.speed -= BRAKE * dt;
      else {
        if (s.speed > 0) s.speed = Math.max(0, s.speed - FRICTION * dt);
        else if (s.speed < 0) s.speed = Math.min(0, s.speed + FRICTION * dt);
      }
      s.speed = Math.max(-MAX_SPEED * 0.4, Math.min(MAX_SPEED, s.speed));

      const speedFactor = Math.min(1, Math.abs(s.speed) / 6);
      const dir = s.speed >= 0 ? 1 : -1;
      if (left) s.heading -= TURN_RATE * dt * speedFactor * dir;
      if (right) s.heading += TURN_RATE * dt * speedFactor * dir;

      const rad = (s.heading * Math.PI) / 180;
      const dist = s.speed * dt;
      s.lat += (dist * Math.cos(rad)) / M_PER_DEG;
      s.lng += (dist * Math.sin(rad)) / (M_PER_DEG * Math.cos((s.lat * Math.PI) / 180));

      if (mapRef.current) mapRef.current.setCenter({ lat: s.lat, lng: s.lng });
      if (carRef.current) carRef.current.style.transform = `translate(-50%, -50%) rotate(${s.heading}deg)`;

      hudT += dt;
      if (hudT > 0.15) {
        hudT = 0;
        const nearest = LANDMARKS.reduce(
          (best, lm) => {
            const d = Math.hypot((lm.lat - s.lat) * M_PER_DEG, (lm.lng - s.lng) * M_PER_DEG);
            return d < best.d ? { d, name: lm.name } : best;
          },
          { d: Infinity, name: "Gampola" }
        );
        setHud({
          speed: Math.round(Math.abs(s.speed) * 3.6),
          location: nearest.d < 220 ? nearest.name : "Gampola Streets",
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, started]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <div ref={mapDiv} className="absolute inset-0" />

      {/* Vignette + scanlines overlay */}
      <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-40" />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ boxShadow: "inset 0 0 200px 40px oklch(0.1 0.06 300 / 0.85)" }}
      />

      {/* Car */}
      <img
        ref={carRef}
        src={carSprite}
        alt="Player car"
        width={72}
        height={72}
        className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[72px] w-[72px] drop-shadow-[0_0_12px_oklch(0.7_0.27_350)]"
        style={{ transform: "translate(-50%, -50%) rotate(0deg)" }}
      />

      <GameHud speed={hud.speed} location={hud.location} />

      {error && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/90 p-6 text-center">
          <p className="font-heading text-destructive">Map failed to load: {error}</p>
        </div>
      )}

      {ready && !started && !error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 px-6 text-center backdrop-blur-sm">
          <h1 className="font-display text-5xl text-primary text-glow-pink animate-flicker md:text-7xl">
            Gampola
          </h1>
          <p className="mt-2 font-display text-2xl text-secondary text-glow-cyan md:text-4xl">
            Vice Drive
          </p>
          <p className="mt-6 max-w-md font-body text-lg text-muted-foreground">
            Cruise the real streets of Gampola. Arrow keys / WASD to drive. Find Ambuluwawa Tower.
          </p>
          <button
            onClick={() => setStarted(true)}
            className="mt-8 rounded-md bg-sunset px-10 py-3 font-heading text-lg font-bold uppercase tracking-widest text-primary-foreground shadow-[var(--glow-pink)] transition-transform hover:scale-105"
          >
            Start Engine
          </button>
        </div>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background">
          <p className="font-display text-3xl text-primary text-glow-pink animate-flicker">
            Loading Gampola…
          </p>
        </div>
      )}
    </div>
  );
}
