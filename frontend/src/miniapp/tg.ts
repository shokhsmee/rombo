// Thin typed wrapper over window.Telegram.WebApp. Every call is optional: outside Telegram (local preview in a
// browser) the app still works, with in-page buttons instead of Telegram's MainButton / BackButton.
import { useEffect, useRef } from "react";

type Haptic = "light" | "medium" | "heavy";
type Notice = "success" | "error" | "warning";

interface BottomButton {
  setText(t: string): void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  isVisible: boolean;
}

interface WebApp {
  initData: string;
  platform: string;
  colorScheme: "light" | "dark";
  version: string;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  isVersionAtLeast?(v: string): boolean;
  openLink(url: string): void;
  showConfirm?(msg: string, cb: (ok: boolean) => void): void;
  showAlert?(msg: string, cb?: () => void): void;
  MainButton: BottomButton;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: {
    impactOccurred(s: Haptic): void;
    notificationOccurred(t: Notice): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: WebApp };
  }
}

export const tg: WebApp | undefined = window.Telegram?.WebApp;

/** True only inside a Telegram client (the SDK script also loads in a browser, with empty initData). */
export const inTelegram = Boolean(tg && tg.initData);

const v = (min: string) => Boolean(tg?.isVersionAtLeast?.(min));

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  if (v("6.1")) {
    tg.setHeaderColor?.("secondary_bg_color");
    tg.setBackgroundColor?.("secondary_bg_color");
  }
}

export const haptic = {
  tap: () => tg?.HapticFeedback?.impactOccurred("light"),
  select: () => tg?.HapticFeedback?.selectionChanged(),
  ok: () => tg?.HapticFeedback?.notificationOccurred("success"),
  error: () => tg?.HapticFeedback?.notificationOccurred("error"),
};

export function confirm(message: string): Promise<boolean> {
  if (inTelegram && tg?.showConfirm && v("6.2")) {
    return new Promise((resolve) => tg.showConfirm!(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

export function alert(message: string) {
  if (inTelegram && tg?.showAlert && v("6.2")) tg.showAlert(message);
  else window.alert(message);
}

export function openLink(url: string) {
  if (inTelegram) tg!.openLink(url);
  else window.open(url, "_blank");
}

/** Telegram's back button while mounted; `null` hides it (the home screen). */
export function useBackButton(onBack: (() => void) | null) {
  useEffect(() => {
    if (!inTelegram || !v("6.1")) return;
    const bb = tg!.BackButton;
    if (!onBack) {
      bb.hide();
      return;
    }
    bb.show();
    bb.onClick(onBack);
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [onBack]);
}

/** Telegram's big bottom button. Returns false outside Telegram: the caller renders its own button. */
export function useMainButton(opts: { text: string; onClick: () => void; disabled?: boolean; busy?: boolean;
  visible?: boolean }) {
  const cb = useRef(opts.onClick);
  cb.current = opts.onClick;
  const visible = opts.visible ?? true;
  useEffect(() => {
    if (!inTelegram) return;
    const mb = tg!.MainButton;
    const handler = () => cb.current();
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, []);
  useEffect(() => {
    if (!inTelegram) return;
    const mb = tg!.MainButton;
    mb.setText(opts.text);
    if (!visible) {
      mb.hide();
      return;
    }
    mb.show();
    if (opts.disabled) mb.disable();
    else mb.enable();
    if (opts.busy) mb.showProgress(false);
    else mb.hideProgress();
  }, [opts.text, opts.disabled, opts.busy, visible]);
  return inTelegram;
}
