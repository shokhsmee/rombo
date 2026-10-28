// Telegram: Chatlar / Akkauntlar (uzbridge telegram/TelegramApp.tsx).
import { NavLink } from "react-router-dom";

import { AccountsPage } from "./AccountsPage";
import { ChatsPage } from "./ChatsPage";

export function TelegramPage({ tab }: { tab: "chats" | "accounts" }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-title">Telegram</h1>
        <nav className="flex gap-1 rounded-lg border border-line bg-surface p-0.5 text-sm">
          {([["/telegram", "Chatlar"], ["/telegram/accounts", "Akkauntlar"]] as const).map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `rounded-md px-3 py-1 ${isActive ? "bg-accent font-semibold text-white" : "text-muted hover:text-ink"}`}>{label}</NavLink>
          ))}
        </nav>
      </div>
      {tab === "chats" ? <ChatsPage /> : <AccountsPage />}
    </div>
  );
}
