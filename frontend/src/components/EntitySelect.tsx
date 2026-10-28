import { Select, type SelectProps } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { api, type Page } from "@/lib/api";

type Option = { id: number; code?: string | null; name?: string; username?: string; full_name?: string };

const label = (o: Option) => {
  const name = o.name ?? o.full_name ?? o.username ?? `#${o.id}`;
  return o.code ? `${name} · ${o.code}` : name;
};

/**
 * Searchable remote picker for any list endpoint (clients, employees, users...).
 * `current` is the already-selected record so its label shows before any search.
 */
export function EntitySelect({ endpoint, value, onChange, current, extraParams, ...rest }: {
  endpoint: string;
  value?: number | null;
  onChange?: (id: number | null) => void;
  current?: Option | null;
  extraParams?: Record<string, string>;
} & Omit<SelectProps, "value" | "onChange" | "data">) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Option | null>(null);
  const [debounced] = useDebouncedValue(search, 250);

  // Mantine writes the chosen option's label into the search box; don't send that to the server.
  const selectedOption = picked?.id === value ? picked : current?.id === value ? current : null;
  const q = selectedOption && debounced === label(selectedOption) ? "" : debounced;

  const { data, isFetching } = useQuery({
    queryKey: ["picker", endpoint, q, extraParams],
    queryFn: async () =>
      (await api.get<Page<Option>>(`/${endpoint}/`, { params: { q, size: 20, ...extraParams } })).data,
    staleTime: 30_000,
  });

  const list = useMemo(() => {
    const items = [...(data?.items ?? [])];
    if (selectedOption && !items.some((o) => o.id === selectedOption.id)) items.unshift(selectedOption);
    return items;
  }, [data, selectedOption]);

  return (
    <Select
      searchable
      clearable
      nothingFoundMessage={isFetching ? "Qidirilmoqda…" : "Topilmadi"}
      data={list.map((o) => ({ value: String(o.id), label: label(o) }))}
      value={value ? String(value) : null}
      onChange={(v) => {
        setPicked(list.find((o) => String(o.id) === v) ?? null);
        onChange?.(v ? Number(v) : null);
      }}
      searchValue={search}
      onSearchChange={setSearch}
      filter={({ options }) => options} // server already filtered
      {...rest}
    />
  );
}
