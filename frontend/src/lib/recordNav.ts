// Odoo-style record pager: the list remembers the ids it shows; the record page steps ‹ › through them.
const key = (k: string) => `rombo-nav:${k}`;

export function rememberIds(navKey: string, ids: number[]) {
  try {
    sessionStorage.setItem(key(navKey), JSON.stringify(ids));
  } catch {
    /* storage off: no pager, nothing else breaks */
  }
}

export function recordNav(navKey: string, id: number) {
  let ids: number[] = [];
  try {
    ids = JSON.parse(sessionStorage.getItem(key(navKey)) ?? "[]");
  } catch {
    ids = [];
  }
  const pos = ids.indexOf(id);
  return {
    pos,
    total: ids.length,
    prev: pos > 0 ? ids[pos - 1] : null,
    next: pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null,
  };
}
