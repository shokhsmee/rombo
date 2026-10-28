import { CloseButton, TextInput } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";

/** Debounced search box. "/" focuses it from anywhere on the page. */
export function SearchInput({ value, onChange, placeholder = "Qidirish…" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const push = useDebouncedCallback(onChange, 300);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        document.getElementById("list-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <TextInput
      id="list-search"
      w={320}
      leftSection={<IconSearch size={15} stroke={1.6} />}
      placeholder={placeholder}
      value={local}
      onChange={(e) => {
        setLocal(e.currentTarget.value);
        push(e.currentTarget.value);
      }}
      rightSection={
        local ? (
          <CloseButton
            size="sm"
            aria-label="Tozalash"
            onClick={() => {
              setLocal("");
              onChange("");
            }}
          />
        ) : (
          <kbd style={{ fontSize: 11, color: "var(--r-text-faint)" }}>/</kbd>
        )
      }
    />
  );
}
