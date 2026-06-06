interface GameHudProps {
  speed: number;
  location: string;
}

export function GameHud({ speed, location }: GameHudProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* Location banner */}
      <div className="absolute left-4 top-4 rounded-md border border-border bg-card px-4 py-2 backdrop-blur-sm">
        <p className="font-display text-xl text-secondary text-glow-cyan">{location}</p>
        <p className="font-heading text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Gampola · Sri Lanka
        </p>
      </div>

      {/* Speedometer */}
      <div className="absolute bottom-4 right-4 rounded-md border border-border bg-card px-5 py-3 text-right backdrop-blur-sm">
        <p className="font-heading text-4xl font-bold leading-none text-primary text-glow-pink tabular-nums">
          {speed}
        </p>
        <p className="font-heading text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          km/h
        </p>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 rounded-md border border-border bg-card px-4 py-2 backdrop-blur-sm">
        <p className="font-heading text-xs uppercase tracking-widest text-accent">
          WASD / Arrows to drive
        </p>
      </div>
    </div>
  );
}
