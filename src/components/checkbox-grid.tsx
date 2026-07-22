export function CheckboxGrid() {
  const cols = 24;
  const rows = 10;
  const cells = Array.from({ length: cols * rows });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute inset-0 grid gap-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cells.map((_, i) => {
          const seed = (i * 37) % 100;
          const isLit = seed < 6;
          const isRed = seed < 2;
          return (
            <div key={i} className="flex aspect-square items-center justify-center">
              {isLit ? (
                <span
                  className={`h-1.5 w-1.5 rounded-[1px] ${
                    isRed ? "bg-[#ed1515]" : "bg-white/40"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(237,21,21,0.15),transparent_60%)]" />
    </div>
  );
}
