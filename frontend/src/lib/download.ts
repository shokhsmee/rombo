import { AxiosError } from "axios";

import { api, cleanParams } from "./api";

/** GET a file through the authenticated client and hand it to the browser as a download. */
export async function download(url: string, params: Record<string, unknown> = {}, fallbackName = "fayl.xlsx") {
  try {
    const r = await api.get<Blob>(url, { params: cleanParams(params), paramsSerializer: { indexes: null }, responseType: "blob" });
    const header = String(r.headers["content-disposition"] ?? "");
    const name = /filename="([^"]+)"/.exec(header)?.[1] ?? fallbackName;
    const href = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (e) {
    // a blob response hides the JSON error body: read it back so the toast says what went wrong
    const data = (e as AxiosError<Blob>).response?.data;
    if (data instanceof Blob) {
      try {
        const body = JSON.parse(await data.text());
        (e as AxiosError<unknown>).response!.data = body;
      } catch { /* not JSON */ }
    }
    throw e;
  }
}
