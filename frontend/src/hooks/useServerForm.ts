import { useForm, type FormValidateInput, type UseFormReturnType } from "@mantine/form";
import { useEffect } from "react";

import { apiError } from "@/lib/api";
import { notifyError } from "@/lib/notify";

/**
 * Mantine form bound to a server record:
 *  - loads `record` into the form once it arrives (via `toForm`)
 *  - maps API field errors {"error": {"fields": {...}}} back onto inputs
 */
export function useServerForm<V extends Record<string, unknown>, R>(opts: {
  initial: V;
  record: R | undefined;
  toForm: (r: R) => V;
  validate?: FormValidateInput<V>;
}) {
  const form = useForm<V>({ mode: "controlled", initialValues: opts.initial, validate: opts.validate });

  useEffect(() => {
    if (opts.record) {
      const values = opts.toForm(opts.record);
      form.setValues(values);
      form.resetDirty(values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.record]);

  return form;
}

export function applyServerErrors<V>(form: UseFormReturnType<V>, e: unknown, rename: Record<string, string> = {}) {
  const err = apiError(e);
  const fields = Object.keys(err.fields).length ? err.fields : err.field ? { [err.field]: err.message } : {};
  const mapped = Object.fromEntries(Object.entries(fields).map(([k, v]) => [rename[k] ?? k, v]));
  if (Object.keys(mapped).length && !("non_field_errors" in mapped)) form.setErrors(mapped);
  notifyError(e);
}
