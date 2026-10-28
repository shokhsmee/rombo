import { Button, Group, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";

/** Sticky action bar above a form sheet: Save / Discard / Delete + slot for status controls. */
export function FormBar({ dirty, saving, canSave, onReset, onDelete, deleteLabel, left, right }: {
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  onReset: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const confirmDelete = () =>
    modals.openConfirmModal({
      title: "O'chirishni tasdiqlang",
      children: <Text size="sm">{deleteLabel ?? "Yozuv arxivga o'tkaziladi. Davom etasizmi?"}</Text>,
      labels: { confirm: "O'chirish", cancel: "Bekor qilish" },
      confirmProps: { color: "red" },
      onConfirm: onDelete,
    });

  return (
    <div className="form-bar">
      <Group gap="xs">
        {canSave && (
          <Button type="submit" loading={saving} disabled={!dirty}>
            Saqlash
          </Button>
        )}
        {canSave && dirty && (
          <Button variant="default" onClick={onReset}>
            Bekor qilish
          </Button>
        )}
        {left}
      </Group>
      <Group gap="xs">
        {right}
        {onDelete && (
          <Button variant="subtle" color="red" leftSection={<IconTrash size={15} />} onClick={confirmDelete}>
            O'chirish
          </Button>
        )}
      </Group>
    </div>
  );
}
