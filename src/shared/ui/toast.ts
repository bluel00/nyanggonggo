"use client";

import { toast } from "sonner";

/** 짧은 안내 토스트. 같은 문구는 쌓지 않고 하나로 갱신한다. */
export function showToast(message: string): void {
  toast(message, { id: message });
}
