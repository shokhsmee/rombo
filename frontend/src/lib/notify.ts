import { notifications } from "@mantine/notifications";

import { apiError } from "./api";

export const notifyOk = (message: string) => notifications.show({ message, color: "teal", autoClose: 2500 });

export const notifyError = (e: unknown) =>
  notifications.show({ title: "Xatolik", message: apiError(e).message, color: "red", autoClose: 5000 });
