// Kunduzgi / tungi rejim (from uzbridge): the choice is kept in this browser; "system" follows the OS.
// Applied on <html data-theme> before the first paint (index.html).
import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "rombo-theme";

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState<Theme>(readTheme);
  useEffect(() => applyTheme(t), [t]);
  const set = (v: Theme) => {
    setT(v);
    try {
      if (v === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch {
      /* private mode: the choice lives until reload */
    }
  };
  return [t, set];
}
