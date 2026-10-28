import { Check, Minus } from "lucide-react";
import { Fragment } from "react";

import type { PageKey, PermAction } from "@/auth/AuthProvider";
import { Checkbox } from "@/components/ui";

import { ACTIONS, groupPages, type PageDef, type Permission } from "./api";

type Props = {
  pages: PageDef[];
  value: Permission[];
  onChange?: (v: Permission[]) => void; // omit = read-only
};

const empty = (page_key: PageKey): Permission => ({
  page_key, can_view: false, can_create: false, can_update: false, can_delete: false,
});

/** Pages × CRUD grid. Ticking a write action also ticks view; unticking view clears the row. */
export function PermissionMatrix({ pages, value, onChange }: Props) {
  const byKey = new Map(value.map((p) => [p.page_key, p]));
  const get = (k: PageKey) => byKey.get(k) ?? empty(k);

  const setCell = (page: PageDef, action: PermAction, checked: boolean) => {
    const row = { ...get(page.key), [`can_${action}`]: checked };
    if (action !== "view" && checked) row.can_view = true;
    if (action === "view" && !checked) Object.assign(row, { can_create: false, can_update: false, can_delete: false });
    onChange?.([...value.filter((p) => p.page_key !== page.key), row]);
  };

  const setRow = (page: PageDef, checked: boolean) => {
    const row = empty(page.key);
    if (checked) page.actions.forEach((a) => (row[`can_${a}`] = true));
    onChange?.([...value.filter((p) => p.page_key !== page.key), row]);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-3 text-left font-medium">Sahifa</th>
            {ACTIONS.map((a) => <th key={a.key} className="w-24 px-2 py-3 text-center font-medium">{a.label}</th>)}
            {onChange && <th className="w-20 px-2 py-3 text-center font-medium">Hammasi</th>}
          </tr>
        </thead>
        <tbody>
          {groupPages(pages).map(([group, items]) => (
            <Fragment key={group}>
              <tr className="border-b border-line bg-ground/60">
                <td colSpan={onChange ? 6 : 5} className="t-label px-4 py-1.5">{group}</td>
              </tr>
              {items.map((page) => {
                const row = get(page.key);
                const on = page.actions.filter((a) => row[`can_${a}`]).length;
                return (
                  <tr key={page.key} className="border-b border-line last:border-0 hover:bg-ground/50">
                    <td className="px-4 py-2.5">
                      {page.label}
                      {page.planned && <span className="ml-2 rounded-full bg-sunk px-1.5 py-px text-2xs font-medium text-muted">tez orada</span>}
                    </td>
                    {ACTIONS.map((a) => {
                      const supported = page.actions.includes(a.key);
                      const checked = row[`can_${a.key}`];
                      return (
                        <td key={a.key} className="px-2 py-2.5 text-center">
                          {!supported ? (
                            <span className="text-faint">·</span>
                          ) : onChange ? (
                            <Checkbox label={`${page.label}: ${a.label}`} checked={checked} onChange={(x) => setCell(page, a.key, x)} />
                          ) : checked ? (
                            <Check className="mx-auto size-4 text-ok" strokeWidth={2.25} />
                          ) : (
                            <Minus className="mx-auto size-3.5 text-faint" />
                          )}
                        </td>
                      );
                    })}
                    {onChange && (
                      <td className="px-2 py-2.5 text-center">
                        <Checkbox label={`${page.label}: hammasi`} checked={on === page.actions.length}
                          indeterminate={on > 0 && on < page.actions.length} onChange={(x) => setRow(page, x)} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
