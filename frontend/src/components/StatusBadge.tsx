/** Small square dot + label. Quieter than coloured pills in dense tables. */
export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="status">
      <span className="status-dot" style={{ background: color }} />
      {label}
    </span>
  );
}

export function ActiveDot({ active, on = "Faol", off = "Nofaol" }: { active: boolean; on?: string; off?: string }) {
  return <StatusDot color={active ? "#2f9e44" : "#adb5bd"} label={active ? on : off} />;
}
