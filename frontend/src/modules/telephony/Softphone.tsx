// The phone inside Rombo: SIP over WebSocket (WebRTC) to the PBX (Asterisk: wss://<pbx>:8089/ws).
// Ported from uzbridge crm/Softphone.tsx. Shown when the user's extension has "browser phone" on and the
// settings have a WSS address; it reports its calls to the backend like a PBX webhook would.
import { Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UA, WebSocketInterface } from "jssip";
import type { RTCSession } from "jssip/lib/RTCSession";

import { api } from "@/lib/api";

import { useMyPhone } from "./api";
import { dialRequests, fmtDuration, fmtPhone, setPhoneReady } from "./live";

type Live = { session: RTCSession; number: string; direction: "in" | "out"; state: "ringing" | "talking"; since: number };

/** What the PBX dials: Uzbek numbers as 9 digits (901112233), not +998901112233. */
export function dialable(n: string) {
  const d = n.replace(/\D+/g, "");
  if (d.length === 12 && d.startsWith("998")) return d.slice(3);
  if (d.length === 10 && d.startsWith("0")) return d.slice(1);
  return d || n;
}

const PC: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/** A ringtone for incoming calls (no audio file: two tones every 2 s). */
const ring = (() => {
  let ctx: AudioContext | null = null;
  let timer: number | undefined;
  const beep = () => {
    if (!ctx) return;
    for (const f of [440, 480]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.value = 0.08;
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 1);
    }
  };
  return {
    start() { try { ctx = ctx ?? new AudioContext(); void ctx.resume(); beep(); timer = window.setInterval(beep, 2000); } catch { /* no audio */ } },
    stop() { window.clearInterval(timer); timer = undefined; },
  };
})();

const report = (body: Record<string, unknown>) => void api.post("/telephony/softphone/", body).catch(() => undefined);

export function Softphone() {
  const me = useMyPhone(true);
  const cfg = me.data?.phone;
  const enabled = !!(me.data?.enabled && cfg?.softphone && cfg.wss && cfg.sip_login && cfg.sip_password);
  const [reg, setReg] = useState<"off" | "connecting" | "ready" | "error">("off");
  const [why, setWhy] = useState("");
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [muted, setMuted] = useState(false);
  const [, tick] = useState(0);
  const ua = useRef<UA | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || !cfg) return;
    setReg("connecting");
    let agent: UA;
    try {
      // a wrong address must never take the page down: the phone just shows "ulanmadi"
      const domain = cfg.domain || new URL(cfg.wss.replace(/^wss?/, "https")).hostname;
      agent = new UA({ sockets: [new WebSocketInterface(cfg.wss)], uri: `sip:${cfg.sip_login}@${domain}`, password: cfg.sip_password, display_name: cfg.extension, register: true });
    } catch {
      setReg("error");
      return;
    }
    const fail = (cause: string) => { setReg("error"); setPhoneReady(false); setWhy(cause); };
    let connected = false;
    agent.on("connected", () => { connected = true; setWhy(""); });
    agent.on("disconnected", () => { if (!connected) fail("WebSocket ulanmadi — sertifikat yoki manzil (wss://…:8089/ws)"); });
    agent.on("registered", () => { setReg("ready"); setPhoneReady(true); setWhy(""); });
    agent.on("unregistered", () => { setReg("off"); setPhoneReady(false); });
    agent.on("registrationFailed", (e: { cause?: string; response?: { status_code?: number } }) =>
      fail(`${e.cause ?? "xato"}${e.response?.status_code ? ` (${e.response.status_code})` : ""}`));
    agent.on("newRTCSession", (e: { session: RTCSession; originator: string }) => {
      const s = e.session;
      const incoming = e.originator === "remote";
      const number = s.remote_identity?.uri?.user ?? "";
      const id = String(s.id);
      setLive({ session: s, number, direction: incoming ? "in" : "out", state: "ringing", since: Date.now() });
      setOpen(true);
      report({ call_id: id, event: "ringing", direction: incoming ? "in" : "out", from: incoming ? number : cfg.extension, to: incoming ? cfg.extension : number });
      let answeredAt = 0;
      s.on("confirmed", () => {
        answeredAt = Date.now();
        setLive((l) => (l ? { ...l, state: "talking", since: answeredAt } : l));
        report({ call_id: id, event: "answer" });
      });
      // the other side's voice (and the PBX's ringback): an outgoing call has its connection already, an incoming
      // one gets it on "peerconnection" — miss the first and outgoing calls are silent
      const hear = (pc: RTCPeerConnection) => {
        pc.addEventListener("track", (t) => {
          if (audio.current) { audio.current.srcObject = t.streams[0]; void audio.current.play().catch(() => undefined); }
        });
      };
      if (s.connection) hear(s.connection);
      else s.on("peerconnection", (pe: { peerconnection: RTCPeerConnection }) => hear(pe.peerconnection));
      if (incoming) ring.start();
      s.on("accepted", () => ring.stop());
      const done = () => {
        ring.stop();
        report({ call_id: id, event: "hangup", billsec: answeredAt ? Math.round((Date.now() - answeredAt) / 1000) : 0 });
        setLive(null);
        setMuted(false);
      };
      s.on("ended", done);
      s.on("failed", done);
    });
    try {
      agent.start();
    } catch {
      setReg("error");
      return;
    }
    ua.current = agent;
    return () => { setPhoneReady(false); try { agent.stop(); } catch { /* already down */ } ua.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cfg?.wss, cfg?.sip_login, cfg?.sip_password, cfg?.domain, cfg?.extension]);

  const call = (n: string) => {
    if (!ua.current || !n.trim() || !cfg) return;
    try {
      const domain = cfg.domain || new URL(cfg.wss.replace(/^wss?/, "https")).hostname;
      ua.current.call(`sip:${dialable(n)}@${domain}`, { mediaConstraints: { audio: true, video: false }, pcConfig: PC });
    } catch {
      setReg("error");
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => dialRequests.on(({ number }) => { setNum(number); call(number); }), [cfg]);
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [live]);

  if (!enabled) return null;
  const dot = { off: "bg-faint", connecting: "bg-warn", ready: "bg-ok", error: "bg-bad" }[reg];
  const state = { off: "o'chiq", connecting: "ulanmoqda…", ready: "ulangan", error: "ulanmadi" }[reg];
  const elapsed = live ? fmtDuration(Math.round((Date.now() - live.since) / 1000)) : "";
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      <audio ref={audio} autoPlay />
      {open && (
        <div className="pop w-72 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-ground/60 px-3 py-2">
            <span className={`size-2 rounded-full ${dot}`} />
            <span className="text-xs font-semibold">Telefon · {cfg?.extension}</span>
            <span className="ml-auto text-xs text-muted">{state}</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Yopish"><X className="size-4" /></button>
          </div>
          {reg === "error" && why && (
            <div className="border-b border-line bg-bad-soft px-3 py-2 text-xs text-bad">
              {why}{/Authentication|401|403/i.test(why) ? " — SIP login yoki parol noto'g'ri (Telefoniya → Sozlamalar)" : ""}
              {/WebSocket/i.test(why) && <> · <a className="underline" href={(cfg?.wss ?? "").replace(/^wss/, "https")} target="_blank" rel="noreferrer">sertifikatni ochib tasdiqlang</a></>}
            </div>
          )}
          {live ? (
            <div className="p-4 text-center">
              <p className="t-label">{live.direction === "in" ? "Kiruvchi" : "Chiquvchi"} · {live.state === "ringing" ? "jiringlamoqda" : elapsed}</p>
              <p className="mt-1 text-lg font-bold tabular">{fmtPhone(live.number)}</p>
              <div className="mt-4 flex justify-center gap-2">
                {live.direction === "in" && live.state === "ringing" && (
                  <button type="button" onClick={() => { ring.stop(); live.session.answer({ mediaConstraints: { audio: true, video: false }, pcConfig: PC }); }}
                    className="rounded-full bg-ok px-5 py-2 text-sm font-semibold text-white">Javob</button>
                )}
                {live.state === "talking" && (
                  <button type="button" onClick={() => { if (muted) live.session.unmute({ audio: true }); else live.session.mute({ audio: true }); setMuted(!muted); }}
                    className={`rounded-full border px-4 py-2 text-sm ${muted ? "border-warn bg-warn-soft text-warn" : "border-line"}`}>{muted ? "Mikrofon o'chiq" : "Mikrofon"}</button>
                )}
                <button type="button" onClick={() => live.session.terminate()} className="rounded-full bg-bad px-5 py-2 text-sm font-semibold text-white">Tugatish</button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <input value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && call(num)} placeholder="Raqam"
                className="h-11 w-full rounded-lg border border-line bg-surface text-center font-mono text-lg tabular outline-none focus:border-accent" />
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                  <button key={k} type="button" onClick={() => setNum((n) => n + k)} className="rounded-lg border border-line bg-ground/60 py-2 font-mono text-base hover:border-accent">{k}</button>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => setNum((n) => n.slice(0, -1))} className="flex-1 rounded-lg border border-line py-2 text-sm text-muted" aria-label="O'chirish">⌫</button>
                <button type="button" onClick={() => call(num)} disabled={reg !== "ready" || !num} className="flex-[2] rounded-lg bg-ok py-2 text-sm font-semibold text-white disabled:opacity-40">Qo'ng'iroq</button>
              </div>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Telefon"
        className={`flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-lg ${live ? "animate-pulse bg-ok" : "bg-accent"}`}>
        <Phone className="size-4" strokeWidth={1.75} />
        {live ? (live.state === "ringing" ? fmtPhone(live.number) : elapsed) : <span className={`size-2 rounded-full ${dot}`} />}
      </button>
    </div>
  );
}
