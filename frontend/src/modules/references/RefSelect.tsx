import { Select } from "@/components/ui";

import { useRefs, type RefKind } from "./api";

/** Picker for one reference list. Inactive items are hidden unless the record already uses them. */
export function RefSelect({ kind, value, onChange, error, disabled, placeholder = "—", className }: {
  kind: RefKind;
  value: number | null;
  onChange: (id: number | null) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const refs = useRefs(kind);
  const items = (refs.data ?? []).filter((r) => r.is_active || r.id === value);
  return (
    <Select value={value ?? ""} error={error} disabled={disabled} className={className}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{placeholder}</option>
      {items.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_active ? "" : " (nofaol)"}</option>)}
    </Select>
  );
}
