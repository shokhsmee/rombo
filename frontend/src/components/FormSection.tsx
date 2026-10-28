import { SimpleGrid } from "@mantine/core";
import type { ReactNode } from "react";

export function FormSheet({ children }: { children: ReactNode }) {
  return <div className="form-sheet">{children}</div>;
}

export function FormSection({ title, children, cols = 2, aside }: {
  title?: string;
  children: ReactNode;
  cols?: number;
  aside?: ReactNode;
}) {
  return (
    <div className="form-section">
      {(title || aside) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          {title && <div className="form-section-title">{title}</div>}
          {aside}
        </div>
      )}
      <SimpleGrid cols={{ base: 1, sm: cols }} spacing="md" verticalSpacing="sm">
        {children}
      </SimpleGrid>
    </div>
  );
}
