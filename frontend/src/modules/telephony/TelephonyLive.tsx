// Mounted once in the shell: the call popup and the browser phone, for users with the telephony page.
// The phone (JsSIP, ~200 kB) is loaded only for users whose extension has the browser phone on.
import { Component, lazy, Suspense, type ReactNode } from "react";

import { useCan } from "@/auth/AuthProvider";

import { useMyPhone } from "./api";
import { CallPopup } from "./CallPopup";

const Softphone = lazy(() => import("./Softphone").then((m) => ({ default: m.Softphone })));

export function TelephonyLive() {
  const on = useCan("telephony").view;
  return on ? <Safe><CallPopup /><Phone /></Safe> : null;
}

function Phone() {
  const me = useMyPhone(true);
  const p = me.data?.phone;
  if (!me.data?.enabled || !p?.softphone || !p.wss || !p.sip_password) return null;
  return <Suspense fallback={null}><Softphone /></Suspense>;
}

/** The popup and the phone sit on every page: a failure there must never blank the app. */
class Safe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error("telephony", e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
