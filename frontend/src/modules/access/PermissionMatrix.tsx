import { Badge, Checkbox, Text } from "@mantine/core";
import { IconCheck, IconMinus } from "@tabler/icons-react";
import { Fragment } from "react";

import type { PageKey, PermAction } from "@/auth/AuthProvider";

import { ACTIONS, groupPages, type PageDef, type Permission } from "./api";

type Props = {
  pages: PageDef[];
  value: Permission[];
  onChange?: (v: Permission[]) => void; // omit = read-only
};

const empty = (page_key: PageKey): Permission => ({
  page_key, can_view: false, can_create: false, can_update: false, can_delete: false,
});

/** Pages × CRUD checkbox grid. Ticking a write action also ticks view; unticking view clears the row. */
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

  const rowState = (page: PageDef) => {
    const on = page.actions.filter((a) => get(page.key)[`can_${a}`]).length;
    return { all: on === page.actions.length, some: on > 0 && on < page.actions.length };
  };

  return (
    <table className="dt matrix">
      <thead>
        <tr>
          <th style={{ width: "40%" }}>Sahifa</th>
          {ACTIONS.map((a) => <th key={a.key}>{a.label}</th>)}
          {onChange && <th style={{ width: 70 }}>Hammasi</th>}
        </tr>
      </thead>
      <tbody>
        {groupPages(pages).map(([group, items]) => (
          <Fragment key={group}>
            <tr className="group-row"><td colSpan={onChange ? 6 : 5}>{group}</td></tr>
            {items.map((page) => {
              const row = get(page.key);
              const rs = rowState(page);
              return (
                <tr key={page.key}>
                  <td>
                    <Text size="sm" span>{page.label}</Text>
                    {page.planned && <Badge ml={8} size="xs" color="gray" variant="outline">tez orada</Badge>}
                  </td>
                  {ACTIONS.map((a) => {
                    const supported = page.actions.includes(a.key);
                    const checked = row[`can_${a.key}`];
                    return (
                      <td key={a.key}>
                        {!supported ? (
                          <Text c="dimmed" size="xs">—</Text>
                        ) : onChange ? (
                          <Checkbox
                            size="xs"
                            style={{ display: "inline-block" }}
                            checked={checked}
                            onChange={(e) => setCell(page, a.key, e.currentTarget.checked)}
                            aria-label={`${page.label}: ${a.label}`}
                          />
                        ) : checked ? (
                          <IconCheck size={15} color="var(--mantine-color-teal-7)" />
                        ) : (
                          <IconMinus size={13} color="var(--r-text-faint)" />
                        )}
                      </td>
                    );
                  })}
                  {onChange && (
                    <td>
                      <Checkbox
                        size="xs"
                        style={{ display: "inline-block" }}
                        checked={rs.all}
                        indeterminate={rs.some}
                        onChange={(e) => setRow(page, e.currentTarget.checked)}
                        aria-label={`${page.label}: hammasi`}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
