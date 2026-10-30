import { useQuery } from "@tanstack/react-query";
import { Check, Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCan } from "@/auth/AuthProvider";
import { Input } from "@/components/ui";
import { api, type Page } from "@/lib/api";

import type { Product, ProductRef } from "./api";
import { CATEGORY, qty } from "./labels";

export type LineProduct = Pick<ProductRef, "id" | "code" | "name" | "unit">;

/**
 * Name cell of a purchase line: free text, with warehouse products suggested while typing.
 * Picking one links the line to it (name and unit follow); typing again unlinks it.
 */
export function ProductCombo({ name, product, disabled, onText, onPick, placeholder = "Material" }: {
  name: string;
  product: LineProduct | null;
  disabled?: boolean;
  onText: (name: string) => void;
  onPick: (p: LineProduct) => void;
  placeholder?: string;
}) {
  // every hook runs on every render: no short-circuit between them
  const reads = [useCan("products"), useCan("inventory"), useCan("procurement"), useCan("purchase_orders"), useCan("goods_receipts")];
  const canRead = reads.some((c) => c.view);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(name.trim()), 250);
    return () => clearTimeout(t);
  }, [name]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const { data } = useQuery({
    queryKey: ["picker", "inventory/products", "combo", q],
    queryFn: async () => (await api.get<Page<Product>>("/inventory/products/", { params: { q, size: 8, is_active: true } })).data,
    enabled: open && canRead && !disabled,
    staleTime: 30_000,
  });
  const items = (data?.items ?? []).filter((p) => p.id !== product?.id);

  const pick = (p: Product) => {
    onPick({ id: p.id, code: p.code, name: p.name, unit: p.unit });
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={box} className="relative grid gap-0.5">
      <Input value={name} disabled={disabled} placeholder={placeholder} className="min-w-44"
        onFocus={() => setOpen(true)} onKeyDown={onKey}
        onChange={(e) => { onText(e.target.value); setActive(0); setOpen(true); }} />
      {product ? (
        <span className="inline-flex items-center gap-1 px-1 text-2xs text-ok"><Check className="size-3" strokeWidth={2} />{product.code} · omborda</span>
      ) : name.trim() && !disabled ? (
        <span className="px-1 text-2xs text-muted">ombor mahsulotiga bog'lanmagan — kirimda tanlanadi</span>
      ) : null}
      {open && !disabled && items.length > 0 && (
        <div className="pop anim-pop absolute left-0 top-10 z-40 w-80 max-w-[80vw] origin-top py-1">
          <p className="px-3 pb-1 pt-0.5 text-2xs uppercase tracking-wider text-faint">Ombor mahsulotlari</p>
          {items.map((p, i) => (
            <button key={p.id} type="button" onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? "bg-ground" : ""}`}>
              <Package className="size-3.5 shrink-0 text-muted" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.name}</span>
                <span className="block text-2xs text-muted">{p.code} · {CATEGORY[p.category]}</span>
              </span>
              <span className="shrink-0 text-2xs tabular text-muted">{qty(p.qty_on_hand)} {p.unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
