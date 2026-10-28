import { Group, Loader, Pagination, Select, Text } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconSelector } from "@tabler/icons-react";
import type { ReactNode } from "react";

import type { ListParams } from "@/hooks/useListParams";
import type { Page } from "@/lib/api";

export type Column<T> = {
  key: string;
  title: ReactNode;
  render: (row: T) => ReactNode;
  sort?: string; // API sort field; omit = not sortable
  width?: number | string;
  align?: "left" | "right" | "center";
};

type Props<T> = {
  columns: Column<T>[];
  data: Page<T> | undefined;
  loading: boolean;
  params: ListParams;
  onParams: (p: Partial<{ page: number; size: number; sort: string }>) => void;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
  rowKey?: (row: T) => string | number;
};

function nextSort(current: string, field: string) {
  if (current === field) return `-${field}`;
  if (current === `-${field}`) return "";
  return field;
}

export function DataTable<T>({ columns, data, loading, params, onParams, onRowClick, toolbar, empty, rowKey }: Props<T>) {
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const from = total ? (params.page - 1) * params.size + 1 : 0;
  const to = Math.min(params.page * params.size, total);
  const pages = Math.max(1, Math.ceil(total / params.size));

  return (
    <div className="dt-wrap">
      {toolbar && <div className="dt-toolbar">{toolbar}</div>}
      <div style={{ overflowX: "auto" }}>
        <table className="dt">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = c.sort && params.sort.replace("-", "") === c.sort;
                const Icon = !active ? IconSelector : params.sort.startsWith("-") ? IconArrowDown : IconArrowUp;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width, textAlign: c.align }}
                    data-sortable={!!c.sort}
                    onClick={c.sort ? () => onParams({ sort: nextSort(params.sort, c.sort!) }) : undefined}
                  >
                    <Group gap={4} wrap="nowrap" justify={c.align === "right" ? "flex-end" : "flex-start"}>
                      {c.title}
                      {c.sort && <Icon size={12} stroke={1.6} opacity={active ? 1 : 0.4} />}
                    </Group>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row) : i}
                data-clickable={!!onRowClick}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <div className="dt-empty">{empty ?? (params.q ? `"${params.q}" bo'yicha hech narsa topilmadi` : "Hozircha yozuv yo'q")}</div>
        )}
        {loading && items.length === 0 && (
          <div className="dt-empty">
            <Loader size="xs" />
          </div>
        )}
      </div>
      <div className="dt-footer">
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {from}–{to} / {total}
          </Text>
          {loading && items.length > 0 && <Loader size={12} />}
        </Group>
        <Group gap="sm">
          <Select
            size="xs"
            w={76}
            data={["25", "50", "100"]}
            value={String(params.size)}
            onChange={(v) => onParams({ size: Number(v), page: 1 })}
            aria-label="Sahifadagi qatorlar"
          />
          <Pagination size="sm" total={pages} value={params.page} onChange={(page) => onParams({ page })} withEdges={pages > 7} />
        </Group>
      </div>
    </div>
  );
}
