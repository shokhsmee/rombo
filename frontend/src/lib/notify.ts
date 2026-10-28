import { toast } from "@/components/toast";

import { apiError } from "./api";

export const notifyOk = (message: string) => toast.ok(message);

export const notifyError = (e: unknown) => toast.error(apiError(e).message);
