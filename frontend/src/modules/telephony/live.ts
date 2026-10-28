// Calling a number from anywhere: the browser phone when it is registered, else the phone's own dialer (tel:).
// Ported from uzbridge crm/live.tsx (Rombo has no PBX click-to-call yet).

type Listener<T> = (v: T) => void;

function bus<T>() {
  const ls = new Set<Listener<T>>();
  return {
    on(l: Listener<T>) { ls.add(l); return () => { ls.delete(l); }; },
    emit(v: T) { ls.forEach((l) => l(v)); },
  };
}

export const dialRequests = bus<{ number: string }>();

let phoneReady = false;
export const setPhoneReady = (v: boolean) => { phoneReady = v; };

export function dial(number: string) {
  if (!number) return;
  if (phoneReady) dialRequests.emit({ number });
  else window.location.href = `tel:${number.replace(/[^\d+]/g, "")}`;
}

/** 154 -> "2:34" */
export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** "+998901112233" -> "+998 90 111 22 33" */
export function fmtPhone(n: string | null | undefined) {
  const d = (n ?? "").replace(/\D+/g, "");
  if (d.length === 12 && d.startsWith("998")) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  return n ?? "";
}
