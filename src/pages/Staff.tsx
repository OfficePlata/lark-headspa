/**
 * スタッフ管理 (/staff)  — Phase B-2
 *
 * 加盟店オーナー (role=owner) が自店舗のスタッフを管理する。
 *   - 一覧表示 (有効/無効、ロール、最終ログイン)
 *   - 新規追加 (メール / 表示名 / 初期パスワード / ロール)
 *   - 編集 (表示名 / ロール変更 / 有効化トグル)
 *   - パスワードリセット (新パスワード設定 → 該当ユーザーの既存セッションは無効化)
 *
 * セキュリティガード (サーバー側でも実施):
 *   - 自分自身を無効化できない
 *   - 最後の有効なオーナーは無効化/降格できない
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit3,
  Key,
  Plus,
  Save,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/auth-context";
import AppShell from "@/components/AppShell";
import type {
  StaffCreateInput,
  StaffUpdateInput,
  StaffUser,
} from "../../shared/types";

export default function StaffPage() {
  const { session } = useAuthSession();
  const [items, setItems] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);

  const isOwner = session.user.role === "owner";

  function reload() {
    setLoading(true);
    api.staff
      .list()
      .then((res) => {
        setItems(res.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "スタッフ取得失敗"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      setError("スタッフ管理画面はオーナーのみ閲覧できます");
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  async function handleToggleActive(target: StaffUser) {
    if (target.isSelf && target.isActive) {
      toast.error("自分自身を無効化することはできません");
      return;
    }
    try {
      await api.staff.update(target.id, { isActive: !target.isActive });
      toast.success(`${target.displayName} を${target.isActive ? "無効化" : "有効化"}しました`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失敗");
    }
  }

  return (
    <AppShell subtitle="スタッフ管理" activeNav="staff">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/dashboard"
              className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> ダッシュボード
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-800 inline-flex items-center gap-2">
              <Users className="w-5 h-5" />
              スタッフ管理
            </h1>
          </div>
          {isOwner && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
              style={{ background: "var(--theme-primary)" }}
            >
              <Plus className="w-4 h-4" />
              スタッフを追加
            </button>
          )}
        </div>

        {loading ? (
          <CenteredCard>読み込み中…</CenteredCard>
        ) : error ? (
          <CenteredCard>
            <span className="text-red-600">{error}</span>
          </CenteredCard>
        ) : items.length === 0 ? (
          <CenteredCard>スタッフが登録されていません</CenteredCard>
        ) : (
          <StaffTable
            items={items}
            onEdit={(s) => setEditing(s)}
            onResetPassword={(s) => setResetTarget(s)}
            onToggleActive={handleToggleActive}
          />
        )}
      </div>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
            toast.success("スタッフを追加しました");
          }}
        />
      )}
      {editing && (
        <EditModal
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            toast.success("更新しました");
          }}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={() => {
            setResetTarget(null);
            toast.success("パスワードをリセットしました。次回ログインから新パスワードが必要です");
          }}
        />
      )}
    </AppShell>
  );
}

// ── 一覧テーブル ──
function StaffTable({
  items,
  onEdit,
  onResetPassword,
  onToggleActive,
}: {
  items: StaffUser[];
  onEdit: (s: StaffUser) => void;
  onResetPassword: (s: StaffUser) => void;
  onToggleActive: (s: StaffUser) => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">表示名</th>
              <th className="px-4 py-3 text-left">メール</th>
              <th className="px-4 py-3 text-left">ロール</th>
              <th className="px-4 py-3 text-left">状態</th>
              <th className="px-4 py-3 text-left">最終ログイン</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((s) => (
              <tr key={s.id} className={s.isActive ? "" : "bg-slate-50/50"}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-medium text-slate-800">{s.displayName}</span>
                  {s.isSelf && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      自分
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.email}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={s.role} />
                </td>
                <td className="px-4 py-3">
                  {s.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
                      <UserCheck className="w-3 h-3" />
                      有効
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600">
                      <UserX className="w-3 h-3" />
                      無効
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString("ja-JP") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => onEdit(s)}
                      title="編集"
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onResetPassword(s)}
                      title="パスワードリセット"
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onToggleActive(s)}
                      title={s.isActive ? "無効化" : "有効化"}
                      disabled={s.isSelf && s.isActive}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {s.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: StaffUser["role"] }) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
        <ShieldCheck className="w-3 h-3" />
        オーナー
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
      スタッフ
    </span>
  );
}

// ── 新規追加モーダル ──
function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<StaffCreateInput>({
    email: "",
    displayName: "",
    password: "",
    role: "staff",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function set<K extends keyof StaffCreateInput>(key: K, value: StaffCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.email.trim()) return setErrorMsg("メールは必須");
    if (!form.displayName.trim()) return setErrorMsg("表示名は必須");
    if (form.password.length < 8) return setErrorMsg("パスワードは8文字以上");
    setSubmitting(true);
    try {
      await api.staff.create(form);
      onCreated();
    } catch (e) {
      setErrorMsg(e instanceof ApiError || e instanceof Error ? e.message : "追加失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="スタッフを追加">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {errorMsg}
          </div>
        )}
        <Field label="メールアドレス" required>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="staff@example.com"
            className={inputCls}
          />
        </Field>
        <Field label="表示名" required>
          <input
            type="text"
            required
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="山田"
            className={inputCls}
          />
        </Field>
        <Field label="初期パスワード" required help="8文字以上。本人に伝達後、本人がリセット可能">
          <input
            type="text"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="ロール">
          <select
            value={form.role}
            onChange={(e) => set("role", e.target.value as "owner" | "staff")}
            className={inputCls}
          >
            <option value="staff">スタッフ (通常)</option>
            <option value="owner">オーナー (スタッフ管理も可)</option>
          </select>
        </Field>
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="追加" />
      </form>
    </Modal>
  );
}

// ── 編集モーダル ──
function EditModal({
  target,
  onClose,
  onSaved,
}: {
  target: StaffUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<StaffUpdateInput>({
    displayName: target.displayName,
    role: target.role,
    isActive: target.isActive,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function set<K extends keyof StaffUpdateInput>(key: K, value: StaffUpdateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.staff.update(target.id, form);
      onSaved();
    } catch (e) {
      setErrorMsg(e instanceof ApiError || e instanceof Error ? e.message : "更新失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`${target.displayName} を編集`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {errorMsg}
          </div>
        )}
        <Field label="表示名">
          <input
            type="text"
            value={form.displayName ?? ""}
            onChange={(e) => set("displayName", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="ロール" help={target.isSelf ? "自分のロールを下げる場合は他にオーナーが必要" : undefined}>
          <select
            value={form.role}
            onChange={(e) => set("role", e.target.value as "owner" | "staff")}
            className={inputCls}
          >
            <option value="staff">スタッフ</option>
            <option value="owner">オーナー</option>
          </select>
        </Field>
        <Field label="状態">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              disabled={target.isSelf}
              onChange={(e) => set("isActive", e.target.checked)}
              className="w-4 h-4"
            />
            有効
            {target.isSelf && (
              <span className="text-xs text-slate-400">(自分自身は無効化できません)</span>
            )}
          </label>
        </Field>
        <Field label="メールアドレス">
          <div className="text-sm text-slate-500 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            {target.email}
            <span className="ml-2 text-xs">(変更不可)</span>
          </div>
        </Field>
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="保存" />
      </form>
    </Modal>
  );
}

// ── パスワードリセットモーダル ──
function ResetPasswordModal({
  target,
  onClose,
  onReset,
}: {
  target: StaffUser;
  onClose: () => void;
  onReset: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 8) return setErrorMsg("パスワードは8文字以上");
    setSubmitting(true);
    try {
      await api.staff.resetPassword(target.id, password);
      onReset();
    } catch (e) {
      setErrorMsg(e instanceof ApiError || e instanceof Error ? e.message : "リセット失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`${target.displayName} のパスワードを再設定`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {errorMsg}
          </div>
        )}
        <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
          リセット後、{target.displayName} の既存セッションは全て無効化されます。
          新パスワードを本人にすぐ伝達してください。
        </div>
        <Field label="新パスワード" required help="8文字以上">
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className={inputCls}
          />
        </Field>
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="リセット" />
      </form>
    </Modal>
  );
}

// ── 共通 ──
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  submitting,
  submitLabel,
}: {
  onClose: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-300 hover:bg-slate-50"
      >
        キャンセル
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--theme-primary)" }}
      >
        <Save className="w-4 h-4" />
        {submitting ? "処理中…" : submitLabel}
      </button>
    </div>
  );
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {help && <span className="block text-xs text-slate-400 mt-1">{help}</span>}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white";

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-center py-16 text-slate-500 bg-white rounded-2xl border"
      style={{ borderColor: "var(--theme-border)" }}
    >
      {children}
    </div>
  );
}

