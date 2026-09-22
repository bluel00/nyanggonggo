/** 텍스트를 클립보드에 복사한다. Clipboard API가 없거나 막히면 선택 영역 복사로 한 번 더 시도하고, 그래도 안 되면 throw */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // 아래 대체 방식으로
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand?.("copy") ?? false;
  textarea.remove();
  if (!ok) throw new Error("copy failed");
}
