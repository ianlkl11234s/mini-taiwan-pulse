/**
 * 會員專區最下方的「刪除帳號」（危險操作，規格見 docs/design-system/spec.md §5.39）。
 *
 * 兩段式：先按「刪除帳號」展開確認區塊（寫清會刪什麼、無法復原）→ 輸入確認字 → 紅色「永久刪除」。
 * 站主帳號不渲染（後端也會以 42501 拒絕）。邏輯在 src/lib/accountDeletion.ts。
 */
import { useState } from "react";
import { accountDeletionNotice, deleteMyAccount, type AccountDeletionResult } from "../../lib/accountDeletion";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";

export function deletionErrorText(result: Extract<AccountDeletionResult, { ok: false }>, { t }: Pick<LocaleSnapshot, "t">): string {
  if (result.reason === "owner") return t("member.account.deleteOwner");
  if (result.reason === "unavailable") return t("member.account.deleteUnavailable");
  return t("member.account.deleteFailed");
}

export function confirmWordMatches(input: string, word: string): boolean {
  return input.trim().toLocaleLowerCase() === word.trim().toLocaleLowerCase();
}

interface BoxProps {
  typed: string;
  busy: boolean;
  error: { text: string; detail: string } | null;
  onType: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 展開後的確認區塊（純呈現，方便測試）。 */
export function DeleteAccountConfirm({ typed, busy, error, onType, onCancel, onConfirm }: BoxProps) {
  const { t } = useLocale();
  const word = t("member.account.deleteConfirmWord");
  const ready = confirmWordMatches(typed, word) && !busy;
  return (
    <form className="member-danger-box" onSubmit={(event) => { event.preventDefault(); if (ready) onConfirm(); }}>
      <strong>{t("member.account.deleteTitle")}</strong>
      <p>{t("member.account.deleteBody")}</p>
      <label>{t("member.account.deleteConfirmLabel", { word })}
        <input value={typed} autoComplete="off" disabled={busy} onChange={(event) => onType(event.target.value)} />
      </label>
      {error && <p role="alert" className="member-danger-error" title={error.detail || undefined}>{error.text}</p>}
      <div className="member-actions">
        <button type="button" disabled={busy} onClick={onCancel}>{t("member.cancel")}</button>
        <button type="submit" className="member-danger" disabled={!ready}>{busy ? t("member.account.deleting") : t("member.account.deleteSubmit")}</button>
      </div>
    </form>
  );
}

export function DeleteAccountSection() {
  const i18n = useLocale();
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; detail: string } | null>(null);

  const reset = () => { setOpen(false); setTyped(""); setError(null); };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteMyAccount();
    if (result.ok) {
      // 登出後面板會以訪客身分重掛，提示交給模組層 store 顯示
      accountDeletionNotice.set({ signedOut: result.signedOut });
      setBusy(false);
      reset();
      return;
    }
    setBusy(false);
    setError({ text: deletionErrorText(result, i18n), detail: result.detail });
  };

  return (
    <div className="member-danger-zone">
      {open
        ? <DeleteAccountConfirm typed={typed} busy={busy} error={error} onType={setTyped} onCancel={reset} onConfirm={() => void confirm()} />
        : <button type="button" className="member-danger" onClick={() => setOpen(true)}>{t("member.account.delete")}</button>}
    </div>
  );
}
