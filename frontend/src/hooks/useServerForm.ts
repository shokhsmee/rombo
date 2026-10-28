import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import { apiError } from "@/lib/api";
import { notifyError } from "@/lib/notify";

type Errors<V> = Partial<Record<keyof V & string, string>>;
type Rules<V> = Partial<{ [K in keyof V]: (value: V[K], all: V) => string | null }>;

/**
 * Form state bound to a server record:
 *  - loads `record` into the form when it arrives (via `toForm`) and treats that as the clean state
 *  - `dirty` compares with the clean state, `reset()` goes back to it
 *  - `text("name")` spreads value/onChange/error onto an <Input>
 */
export function useServerForm<V extends Record<string, unknown>, R>(opts: {
  initial: V;
  record: R | undefined;
  toForm: (r: R) => V;
  validate?: Rules<V>;
}) {
  const [values, setValues] = useState<V>(opts.initial);
  const [clean, setClean] = useState<V>(opts.initial);
  const [errors, setErrors] = useState<Errors<V>>({});

  useEffect(() => {
    if (opts.record) {
      const v = opts.toForm(opts.record);
      setValues(v);
      setClean(v);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.record]);

  const set = useCallback(<K extends keyof V>(key: K, value: V[K]) => {
    setValues((p) => ({ ...p, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(clean), [values, clean]);

  const check = () => {
    const errs: Errors<V> = {};
    for (const [k, rule] of Object.entries(opts.validate ?? {}) as [keyof V & string, (v: unknown, a: V) => string | null][]) {
      const msg = rule(values[k], values);
      if (msg) errs[k] = msg;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const text = <K extends keyof V & string>(key: K) => ({
    value: (values[key] ?? "") as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value as V[K]),
    error: errors[key],
  });

  return {
    values,
    errors,
    dirty,
    set,
    text,
    check,
    setErrors,
    reset: () => { setValues(clean); setErrors({}); },
    /** Mark current values as saved (after a successful PATCH). */
    commit: () => setClean(values),
  };
}

export type ServerForm = { setErrors: (e: Record<string, string>) => void };

export function applyServerErrors(form: ServerForm, e: unknown, rename: Record<string, string> = {}) {
  const err = apiError(e);
  const fields = Object.keys(err.fields).length ? err.fields : err.field ? { [err.field]: err.message } : {};
  const mapped = Object.fromEntries(Object.entries(fields).map(([k, v]) => [rename[k] ?? k, v]));
  delete mapped.non_field_errors;
  form.setErrors(mapped);
  notifyError(e);
}
