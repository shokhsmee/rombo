// Calling a number from anywhere: the browser phone when it is registered, else the provider's click-to-call
// (Moi Zvonki rings the employee's own mobile, an IP-PBX its extension), else the device dialer (tel:).
// Ported from uzbridge crm/live.tsx.
import { toast } from "@/components/toast";
import { api, apiError } from "@/lib/api";
import { bus } from "@/lib/live";

export const dialRequests = bus<{ number: string }>();

let phoneReady = false;
export const setPhoneReady = (v: boolean) => { phoneReady = v; };

export async function dial(number: string) {
  if (!number) return;
  if (phoneReady) {
    dialRequests.emit({ number });
    return;
  }
  try {
    const { data } = await api.post<{ ok: boolean; mobile?: boolean }>("/telephony/dial/", { number });
    toast.ok(data.mobile ? "Telefoningizga qo'ng'iroq keladi — javob bering" : "Qo'ng'iroq ulanmoqda");
  } catch (e) {
    const err = apiError(e);
    if (err.code === "network" || /sozlanmagan|biriktirilmagan|ulanmagan/.test(err.message)) {
      window.location.href = `tel:${number.replace(/[^\d+]/g, "")}`;
    } else {
      toast.error(err.message);
    }
  }
}

/** 154 -> "2:34" */
export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** "+998901112233" -> "+998 90 111 22 33" */
export function fmtPhone(n: string | null | undefined) {
  const d = (n ?? "").replace(/\D+/g, "");
  if (d.length === 12 && d.startsWith("998")) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  return n ?? "";
}
