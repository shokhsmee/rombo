// Telegram chats (ported from uzbridge telegram/Chats.tsx): the employee's own Telegram, two panes. Messages are
// read live from Telegram and pushed over the socket; Rombo stores none of their text.
import dayjs from "dayjs";
import { Check, CheckCheck, Copy, FileText, Paperclip, Pencil, Send, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { SearchInput } from "@/components/SearchInput";
import { toast } from "@/components/toast";
import { Button, IconButton, Pill, Segmented, Spinner } from "@/components/ui";
import { api, apiError } from "@/lib/api";
import { liveEvents } from "@/lib/live";
import { notifyError, notifyOk } from "@/lib/notify";

import { useAccounts, useBlobUrl, useChats, useLiveChats, type Chat, type Message } from "./api";

type Section = "all" | "private" | "group" | "channel";
const UPLOAD_MB = 15;

function Avatar({ chat, size = "size-10" }: { chat: Chat; size?: string }) {
  const url = useBlobUrl(chat.photo ? `/telegram/chats/${chat.id}/photo/?v=${chat.photo}` : null);
  const initials = chat.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  return url
    ? <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    : <span className={`${size} grid shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink`}>{initials}</span>;
}

export function ChatsPage() {
  const accounts = useAccounts();
  const stored = useChats();
  const fresh = useLiveChats();
  const [chats, setChats] = useState<Chat[]>([]);
  const [section, setSection] = useState<Section>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [account, setAccount] = useState<number | null>(null);

  useEffect(() => {
    const byId = new Map((stored.data ?? []).map((c) => [c.id, c]));
    (fresh.data ?? []).forEach((c) => byId.set(c.id, { ...byId.get(c.id), ...c }));
    setChats([...byId.values()]);
  }, [stored.data, fresh.data]);

  useEffect(() => liveEvents.on((m) => {
    if (m.type !== "tg") return;
    if (m.ev === "message") {
      const c = { ...(m.chat as Chat), last: m.message as Message };
      setChats((list) => [c, ...list.filter((x) => x.id !== c.id)]);
    } else if (m.ev === "unread") {
      setChats((list) => list.map((x) => (x.id === m.chat_id ? { ...x, unread: m.unread } : x)));
    } else if (m.ev === "read") {
      setChats((list) => list.map((x) => (x.id === m.chat_id ? { ...x, last_read_out: m.last_read_out } : x)));
    }
  }), []);

  const mine = (accounts.data?.accounts ?? []).filter((a) => a.mine);
  const list = useMemo(() => chats
    .filter((c) => section === "all" || c.kind === section)
    .filter((c) => !account || c.account_id === account)
    .filter((c) => !q || [c.name, c.username, c.phone, c.client?.name].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? "")), [chats, section, account, q]);
  const unreadIn = (s: Section) => chats.filter((c) => (s === "all" || c.kind === s) && c.unread > 0 && c.kind !== "channel").length;
  const open = chats.find((c) => c.id === openId) ?? null;
  const total = unreadIn("all");
  useEffect(() => { document.title = total ? `(${total}) Telegram · Rombo` : "Rombo ERP"; return () => { document.title = "Rombo ERP"; }; }, [total]);

  if (accounts.isLoading) return <div className="grid h-40 place-items-center"><Spinner className="size-5" /></div>;
  if (!mine.length) {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed border-line p-8 text-center">
        <p className="t-h2">Telegram ulanmagan</p>
        <p className="text-sm text-muted">O'z Telegram akkauntingizni ulang — mijozlar yozishmalari shu yerda bo'ladi.</p>
        <Link to="/telegram/accounts" className="mx-auto"><Button>Akkaunt ulash</Button></Link>
      </div>
    );
  }
  const broken = mine.filter((a) => !a.connected);
  return (
    <div className="grid gap-2">
      {broken.length > 0 && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {broken.map((a) => a.name).join(", ")} — ulanmagan. <Link to="/telegram/accounts" className="underline">Akkauntlar</Link>
        </p>
      )}
      <div className="grid h-[calc(100dvh-10rem)] min-h-[480px] overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`flex min-h-0 flex-col border-r border-line ${open ? "hidden md:flex" : "flex"}`}>
          <div className="grid gap-2 border-b border-line p-2">
            <SearchInput value={q} onChange={setQ} placeholder="Ism, @username, raqam…" />
            <Segmented size="sm" value={section} onChange={setSection} options={([["all", "Barchasi"], ["private", "Shaxsiy"], ["group", "Guruh"], ["channel", "Kanal"]] as [Section, string][]).map(([value, label]) => ({
              value, label: unreadIn(value) ? `${label} ${unreadIn(value)}` : label,
            }))} />
            {mine.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {[{ id: 0, name: "Hammasi" }, ...mine].map((a) => (
                  <button key={a.id} type="button" onClick={() => setAccount(a.id || null)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${(account ?? 0) === a.id ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted"}`}>{a.name}</button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {fresh.isFetching && !chats.length && <div className="grid h-20 place-items-center"><Spinner /></div>}
            {list.map((c) => (
              <button key={c.id} type="button" onClick={() => setOpenId(c.id)}
                className={`flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left hover:bg-ground ${openId === c.id ? "bg-accent-soft/60" : ""}`}>
                <Avatar chat={c} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate font-medium">{c.name}</span>
                    {c.kind !== "private" && <Users className="size-3.5 shrink-0 text-muted" />}
                    {c.client && <UserPlus className="size-3.5 shrink-0 text-ok" />}
                    <span className="ml-auto shrink-0 text-2xs text-muted">{c.last_at ? (dayjs(c.last_at).isSame(dayjs(), "day") ? dayjs(c.last_at).format("HH:mm") : dayjs(c.last_at).format("DD.MM")) : ""}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <span className="truncate">{c.last ? `${c.last.out ? "Siz: " : ""}${c.last.text || (c.last.media ? `[${c.last.media}]` : "")}` : c.username ? `@${c.username}` : c.phone}</span>
                    {c.unread > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-2xs font-semibold text-white">{c.unread}</span>}
                  </span>
                </span>
              </button>
            ))}
            {!list.length && !fresh.isFetching && <p className="p-6 text-center text-sm text-muted">Chat yo'q</p>}
          </div>
        </aside>
        {open ? <Conversation key={open.id} chat={open} onBack={() => setOpenId(null)} crmOn={!!accounts.data?.crm}
          onChat={(c) => setChats((l) => l.map((x) => (x.id === c.id ? { ...x, ...c } : x)))} />
          : <div className="hidden place-items-center text-sm text-muted md:grid">Chatni tanlang</div>}
      </div>
    </div>
  );
}

function Conversation({ chat, onBack, onChat, crmOn }: { chat: Chat; onBack: () => void; onChat: (c: Chat) => void; crmOn: boolean }) {
  const canLead = useCan("crm").create;
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(() => sessionStorage.getItem(`tg.draft.${chat.id}`) ?? "");
  const [editing, setEditing] = useState<Message | null>(null);
  const [linking, setLinking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.post(`/telegram/chats/${chat.id}/open/`).then((r) => {
      setMessages(r.data.messages); setHasMore(r.data.has_more); setLoading(false);
      onChat({ ...r.data.chat, unread: 0 });
      requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight }));
    }).catch((e) => { setLoading(false); notifyError(e); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);
  useEffect(() => { try { sessionStorage.setItem(`tg.draft.${chat.id}`, text); } catch { /* private mode */ } }, [chat.id, text]);
  useEffect(() => liveEvents.on((m) => {
    if (m.type !== "tg") return;
    if (m.ev === "message" && m.chat?.id === chat.id) {
      setMessages((l) => (l.some((x) => x.tg_id === m.message.tg_id) ? l : [...l.filter((x) => !(x.pending && x.text === m.message.text)), m.message]));
      requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }));
      if (!m.message.out) void api.post(`/telegram/chats/${chat.id}/read/`);
    } else if (m.ev === "update" && (m.message.chat_id === chat.id || !m.message.chat_id)) {
      setMessages((l) => l.map((x) => (x.tg_id === m.message.tg_id ? { ...x, ...m.message } : x)));
    } else if (m.ev === "delete" && (m.chat_id === chat.id || m.chat_id === null)) {
      setMessages((l) => l.filter((x) => !m.tg_ids.includes(x.tg_id)));
    }
  }), [chat.id]);

  const older = async () => {
    if (!hasMore || !messages.length) return;
    const h = box.current?.scrollHeight ?? 0;
    const r = await api.get(`/telegram/chats/${chat.id}/older/`, { params: { before_tg: messages[0].tg_id } });
    setMessages((l) => [...r.data.messages, ...l]); setHasMore(r.data.has_more);
    requestAnimationFrame(() => box.current && (box.current.scrollTop = box.current.scrollHeight - h));
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (editing) {
      try { await api.put(`/telegram/chats/${chat.id}/messages/${editing.tg_id}/`, { text: t }); setEditing(null); setText(""); } catch (e) { notifyError(e); }
      return;
    }
    const temp: Message = { tg_id: -Date.now(), out: true, date: new Date().toISOString(), text: t, pending: true };
    setMessages((l) => [...l, temp]); setText("");
    requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight }));
    try {
      const r = await api.post<Message>(`/telegram/chats/${chat.id}/send/`, { text: t });
      setMessages((l) => (l.some((x) => x.tg_id === r.data.tg_id) ? l.filter((x) => x.tg_id !== temp.tg_id) : l.map((x) => (x.tg_id === temp.tg_id ? r.data : x))));
    } catch (e) {
      setMessages((l) => l.filter((x) => x.tg_id !== temp.tg_id)); setText(t); notifyError(e);
    }
  };
  const upload = async (files: FileList | null) => {
    for (const [i, f] of [...(files ?? [])].entries()) {
      if (f.size > UPLOAD_MB * 1024 * 1024) { toast.error(`${f.name}: ${UPLOAD_MB} MB dan katta`); continue; }
      const fd = new FormData();
      fd.append("file", f);
      if (i === 0 && text.trim()) fd.append("caption", text.trim());
      try { const r = await api.post<Message>(`/telegram/chats/${chat.id}/file/`, fd); setMessages((l) => [...l, r.data]); if (i === 0) setText(""); } catch (e) { notifyError(e); }
    }
  };
  const remove = async (m: Message) => {
    try { await api.delete(`/telegram/chats/${chat.id}/messages/${m.tg_id}/`); setMessages((l) => l.filter((x) => x.tg_id !== m.tg_id)); } catch (e) { notifyError(e); }
  };
  const linkClient = async (body: Record<string, unknown>) => {
    try { onChat((await api.post<Chat>(`/telegram/chats/${chat.id}/client/`, body)).data); setLinking(false); } catch (e) { notifyError(e); }
  };
  const makeLead = async () => {
    try { onChat((await api.post<Chat>(`/telegram/chats/${chat.id}/lead/`)).data); notifyOk("Lid ochildi"); } catch (e) { notifyError(e); }
  };

  let lastDay = "";
  return (
    <section className="flex min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <button type="button" className="text-sm text-accent-ink md:hidden" onClick={onBack}>←</button>
        <Avatar chat={chat} size="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{chat.name}</p>
          <p className="truncate text-xs text-muted">{chat.username ? `@${chat.username}` : chat.phone}</p>
        </div>
        {chat.kind === "private" && (chat.client
          ? <Link to={`/clients/${chat.client.id}`}><Pill tone="ok">{chat.client.name}</Pill></Link>
          : linking
            ? <span className="flex items-center gap-1">
                <EntitySelect endpoint="clients" className="w-52" placeholder="Mijozni tanlang" value={null} onChange={(id) => id && linkClient({ client_id: id })} />
                <Button size="sm" variant="ghost" onClick={() => linkClient({ new: true })}>Yangi</Button>
              </span>
            : <Button size="sm" variant="ghost" onClick={() => setLinking(true)}>Mijozga bog'lash</Button>)}
        {chat.client && chat.kind === "private" && <IconButton label="Bog'lanishni olib tashlash" onClick={() => linkClient({ client_id: null })}>×</IconButton>}
        {crmOn && (chat.lead
          ? <Link to={`/crm/leads/${chat.lead.id}`}><Pill tone="accent">{chat.lead.code}</Pill></Link>
          : canLead && chat.kind === "private" && <Button size="sm" variant="soft" onClick={makeLead}>Lid ochish</Button>)}
      </header>
      <div ref={box} onScroll={(e) => e.currentTarget.scrollTop < 40 && void older()} className="min-h-0 flex-1 overflow-y-auto bg-ground/60 px-3 py-3">
        {loading && <div className="grid h-20 place-items-center"><Spinner /></div>}
        {messages.map((m) => {
          const day = dayjs(m.date).format("YYYY-MM-DD");
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.tg_id}>
              {sep && <p className="my-2 text-center text-2xs text-muted">{dayjs(m.date).isSame(dayjs(), "day") ? "Bugun" : dayjs(m.date).format("DD.MM.YYYY")}</p>}
              <Bubble m={m} chat={chat} onEdit={() => { setEditing(m); setText(m.text); }} onDelete={() => remove(m)} />
            </div>
          );
        })}
      </div>
      {chat.kind === "channel" ? <p className="border-t border-line p-3 text-center text-sm text-muted">Kanal — faqat o'qish</p> : (
        <div className="flex items-end gap-2 border-t border-line p-2">
          <input ref={file} type="file" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          <IconButton label="Fayl" onClick={() => file.current?.click()}><Paperclip className="size-4" /></IconButton>
          <textarea value={text} rows={1} placeholder={editing ? "Tahrirlash…" : "Xabar…"} onChange={(e) => setText(e.target.value)}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); void upload(e.clipboardData.files); } }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } if (e.key === "Escape" && editing) { setEditing(null); setText(""); } }}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
          <IconButton label="Yuborish" onClick={() => void send()}><Send className="size-4 text-accent-ink" /></IconButton>
        </div>
      )}
    </section>
  );
}

function Bubble({ m, chat, onEdit, onDelete }: { m: Message; chat: Chat; onEdit: () => void; onDelete: () => void }) {
  const read = m.out && m.tg_id <= chat.last_read_out;
  return (
    <div className={`group my-1 flex ${m.out ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm shadow-sm ${m.out ? "bg-accent-soft" : "bg-surface"} ${m.pending ? "opacity-60" : ""}`}>
        {chat.kind !== "private" && !m.out && m.sender_name && <p className="text-xs font-semibold text-accent-ink">{m.sender_name}</p>}
        {m.file && <Media chatId={chat.id} m={m} />}
        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
        {!!m.reactions?.length && <p className="mt-0.5 text-xs">{m.reactions.map((r) => `${r.emoji} ${r.count}`).join("  ")}</p>}
        <p className="mt-0.5 flex items-center justify-end gap-1 text-2xs text-muted">
          {m.edited && "tahrirlangan · "}{dayjs(m.date).format("HH:mm")}
          {m.out && (m.pending ? <Spinner className="size-2.5" /> : read ? <CheckCheck className="size-3 text-accent-ink" /> : <Check className="size-3" />)}
        </p>
      </div>
      {!m.pending && (
        <span className="ml-1 hidden items-start gap-0.5 group-hover:flex">
          <IconButton label="Nusxa" onClick={() => { void navigator.clipboard?.writeText(m.text); notifyOk("Nusxa olindi"); }}><Copy className="size-3.5" /></IconButton>
          {m.out && m.text && !m.file && <IconButton label="Tahrirlash" onClick={onEdit}><Pencil className="size-3.5" /></IconButton>}
          {m.out && <IconButton label="O'chirish" onClick={onDelete}><Trash2 className="size-3.5" /></IconButton>}
        </span>
      )}
    </div>
  );
}

function Media({ chatId, m }: { chatId: number; m: Message }) {
  const f = m.file!;
  const image = f.mime.startsWith("image/") && m.media !== "sticker";
  const av = f.mime.startsWith("video/") || f.mime.startsWith("audio/");
  const [want, setWant] = useState(image || (av && f.size < 20 * 1024 * 1024));
  const url = useBlobUrl(want ? `/telegram/chats/${chatId}/messages/${m.tg_id}/file/` : null);
  const download = async () => {
    try {
      const r = await api.get(`/telegram/chats/${chatId}/messages/${m.tg_id}/file/`, { params: { download: 1 }, responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data); a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { toast.error(apiError(e).message); }
  };
  if (image) return url ? <img src={url} alt={f.name} className="mb-1 max-h-72 rounded-lg" /> : <Spinner />;
  if (av && url) return f.mime.startsWith("video/") ? <video src={url} controls className="mb-1 max-h-72 rounded-lg" /> : <audio src={url} controls className="mb-1 w-64" />;
  if (av && !want) return <Button size="sm" variant="ghost" onClick={() => setWant(true)}>▶ {f.name}</Button>;
  return (
    <button type="button" onClick={() => void download()} className="mb-1 flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-left text-xs">
      <FileText className="size-5 text-accent-ink" /><span className="min-w-0"><span className="block truncate font-medium">{f.name}</span>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
    </button>
  );
}
