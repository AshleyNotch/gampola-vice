import { useState, useEffect } from "react";

export interface GtaVehicle {
  Name: string;
  DisplayName: string; // normalised to English string
  Class: string;       // normalised to Title Case
  Type?: string;
}

export interface GtaWeapon {
  Name: string;
  DisplayName: string;
  Group: string;
}

export interface GtaRadioStation {
  Name: string;
  DisplayName: string;
}

export interface GtaData {
  vehicles: GtaVehicle[];
  weapons: GtaWeapon[];
  radioStations: GtaRadioStation[];
  loading: boolean;
}

const BASE =
  "https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master";

// Normalise DisplayName which can be a string OR {Hash, English, ...}
function toStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const o = val as Record<string, unknown>;
    if (typeof o.English === "string") return o.English;
    const first = Object.values(o).find((v) => typeof v === "string");
    if (typeof first === "string") return first;
  }
  return String(val ?? "");
}

// Title-case e.g. "SUPER" → "Super", "SPORTS_CLASSIC" → "Sports Classic"
function toTitle(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const FALLBACK_VEHICLES: GtaVehicle[] = [
  { Name: "adder",     DisplayName: "Adder",      Class: "Super"  },
  { Name: "zentorno",  DisplayName: "Zentorno",    Class: "Super"  },
  { Name: "t20",       DisplayName: "T20",         Class: "Super"  },
  { Name: "infernus",  DisplayName: "Infernus",    Class: "Super"  },
  { Name: "cheetah",   DisplayName: "Cheetah",     Class: "Super"  },
  { Name: "entityxf",  DisplayName: "Entity XF",   Class: "Super"  },
  { Name: "osiris",    DisplayName: "Osiris",       Class: "Super"  },
  { Name: "elegy2",    DisplayName: "Elegy RH8",   Class: "Sports" },
  { Name: "sultan",    DisplayName: "Sultan",       Class: "Sports" },
  { Name: "banshee",   DisplayName: "Banshee",     Class: "Sports" },
  { Name: "feltzer2",  DisplayName: "Feltzer",     Class: "Sports" },
  { Name: "comet2",    DisplayName: "Comet",       Class: "Sports" },
  { Name: "buffalo",   DisplayName: "Buffalo",     Class: "Muscle" },
  { Name: "dominator", DisplayName: "Dominator",   Class: "Muscle" },
  { Name: "gauntlet",  DisplayName: "Gauntlet",    Class: "Muscle" },
];

const FALLBACK_WEAPONS: GtaWeapon[] = [
  { Name: "weapon_unarmed",      DisplayName: "Fists",          Group: "GROUP_UNARMED" },
  { Name: "weapon_pistol",       DisplayName: "Pistol",         Group: "GROUP_PISTOL"  },
  { Name: "weapon_smg",          DisplayName: "SMG",            Group: "GROUP_SMG"     },
  { Name: "weapon_assaultrifle", DisplayName: "Assault Rifle",  Group: "GROUP_RIFLE"   },
  { Name: "weapon_sniperrifle",  DisplayName: "Sniper Rifle",   Group: "GROUP_SNIPER"  },
];

const FALLBACK_RADIO: GtaRadioStation[] = [
  { Name: "RADIO_01_CLASS_ROCK",   DisplayName: "Los Santos Rock Radio" },
  { Name: "RADIO_02_POP",          DisplayName: "Non-Stop-Pop FM"       },
  { Name: "RADIO_03_HIPHOP_NEW",   DisplayName: "Radio Los Santos"      },
  { Name: "RADIO_04_PUNK",         DisplayName: "Channel X"             },
  { Name: "RADIO_07_DANCE_02",     DisplayName: "Soulwax FM"            },
  { Name: "RADIO_08_MEXICAN",      DisplayName: "East Los FM"           },
  { Name: "RADIO_12_REGGAE",       DisplayName: "Blue Ark"              },
  { Name: "RADIO_13_JAZZ",         DisplayName: "Lowdown 91.1"          },
  { Name: "RADIO_15_MOTOWN",       DisplayName: "Space 103.2"           },
];

export function useGtaData(): GtaData {
  // Start immediately with fallbacks so UI never blocks on a network call
  const [data, setData] = useState<GtaData>({
    vehicles: FALLBACK_VEHICLES,
    weapons: FALLBACK_WEAPONS,
    radioStations: FALLBACK_RADIO,
    loading: false,
  });

  useEffect(() => {
    const ctrl = new AbortController();

    Promise.allSettled([
      fetch(`${BASE}/vehicles.json`, { signal: ctrl.signal }).then((r) => r.json()),
      fetch(`${BASE}/weapons.json`,  { signal: ctrl.signal }).then((r) => r.json()),
      fetch(`${BASE}/radioStations.json`, { signal: ctrl.signal }).then((r) => r.json()),
    ]).then(([vehR, weapR, radioR]) => {
      if (ctrl.signal.aborted) return;

      const vehicles: GtaVehicle[] = (() => {
        if (vehR.status !== "fulfilled") return FALLBACK_VEHICLES;
        const raw = vehR.value as Record<string, unknown>[];
        if (!Array.isArray(raw)) return FALLBACK_VEHICLES;
        const cars = raw
          .filter((v) => {
            const t = String(v.Type ?? "").toUpperCase();
            return !t || t === "CAR" || t.includes("CAR");
          })
          .map((v) => ({
            Name:        String(v.Name ?? ""),
            DisplayName: toStr(v.DisplayName),
            Class:       toTitle(String(v.Class ?? "Unknown")),
            Type:        String(v.Type ?? ""),
          }))
          .filter((v) => v.Name && v.DisplayName)
          .slice(0, 55);
        return cars.length > 0 ? cars : FALLBACK_VEHICLES;
      })();

      const weapons: GtaWeapon[] = (() => {
        if (weapR.status !== "fulfilled") return FALLBACK_WEAPONS;
        const raw = weapR.value as Record<string, unknown>[];
        if (!Array.isArray(raw)) return FALLBACK_WEAPONS;
        return raw
          .map((w) => ({
            Name:        String(w.Name ?? ""),
            DisplayName: toStr(w.DisplayName),
            Group:       String(w.Group ?? ""),
          }))
          .filter((w) => w.Group?.startsWith("GROUP_") && w.Name);
      })();

      const radioStations: GtaRadioStation[] = (() => {
        if (radioR.status !== "fulfilled") return FALLBACK_RADIO;
        const raw = radioR.value as Record<string, unknown>[];
        if (!Array.isArray(raw)) return FALLBACK_RADIO;
        return raw.map((s) => ({
          Name:        String(s.Name ?? ""),
          DisplayName: toStr(s.DisplayName),
        }));
      })();

      setData({ vehicles, weapons, radioStations, loading: false });
    }).catch(() => { /* already have fallbacks, nothing to do */ });

    return () => ctrl.abort();
  }, []);

  return data;
}

// Vehicle class → driving stats + colour
export const CLASS_STATS: Record<
  string,
  { speedMult: number; accelMult: number; color: string }
> = {
  Super:          { speedMult: 1.00, accelMult: 1.00, color: "#ff2033" },
  Sports:         { speedMult: 0.88, accelMult: 0.90, color: "#1a5fff" },
  "Sports Classic": { speedMult: 0.83, accelMult: 0.85, color: "#cc8800" },
  Muscle:         { speedMult: 0.82, accelMult: 0.95, color: "#ff6b1a" },
  Coupe:          { speedMult: 0.78, accelMult: 0.85, color: "#c0c0c0" },
  Suv:            { speedMult: 0.72, accelMult: 0.75, color: "#4a7a30" },
  Sedan:          { speedMult: 0.68, accelMult: 0.70, color: "#888888" },
  Compact:        { speedMult: 0.70, accelMult: 0.78, color: "#60cc60" },
  Van:            { speedMult: 0.62, accelMult: 0.65, color: "#775533" },
  default:        { speedMult: 0.75, accelMult: 0.78, color: "#8844cc" },
};
