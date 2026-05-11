/**
 * カルテ 詳細・編集・新規ページ
 *
 *   /karte/new              ... 新規モード
 *   /karte/new?customerRecordId=recXXX ... 顧客固定の新規モード
 *   /karte/:recordId        ... 詳細表示 → 「編集」で編集モード
 *
 * 機能:
 *   - 顧客選択ピッカー (新規時、顧客台帳から検索)
 *   - 来店日 / 顧客区分 / 施術コース / 施術コメント / 金額 / 支払方法 / 写真
 *   - 写真は Lark Drive にアップロード→fileToken でカルテに紐付け
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  Edit3,
  Image as ImageIcon,
  LogOut,
  Save,
  Search,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthSession } from "@/lib/auth-context";
import {
  CUSTOMER_KIND,
  PAYMENT_METHODS,
  TREATMENT_COURSES,
} from "../../shared/types";
import type {
  Customer,
  CustomerKind,
  Karte,
  KarteInput,
  KartePhoto,
  PaymentMethod,
  TreatmentCourse,
} from "../../shared/types";

export default function KarteDetail() {
  const { session, logout } = useAuthSession();
  const [, params] = useRoute<{ recordId: string }>("/karte/:recordId");
  const [, setLocation] = useLocation();
  const recordId = params?.recordId;
  const isNew = recordId === "new";

  // ?customerRecordId=... を URLSearchParams から取得 (wouter は path のみのため)
  const presetCustomerRecordId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("customerRecordId") || undefined;
  }, []);

  const [karte, setKarte] = useState<Karte | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState<KarteInput>(() => emptyInput(presetCustomerRecordId));
  const [photos, setPhotos] = useState<KartePhoto[]>([]); // 表示用 (既存写真 + アップロード済み)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 既存ロード
  useEffect(() => {
    if (!recordId || isNew) return;
    setLoading(true);
    api.karte
      .get(recordId)
      .then((k) => {
        setKarte(k);
        setForm(karteToInput(k));
        setPhotos(k.photos);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "カルテ取得失敗"))
      .finally(() => setLoading(false));
  }, [recordId, isNew]);

  // 新規モードで顧客が事前指定されていれば、その顧客情報を取得
  useEffect(() => {
    if (!isNew || !presetCustomerRecordId) return;
    api.customerLedger
      .get(presetCustomerRecordId)
      .then((c) => setSelectedCustomer(c))
      .catch(() => {
        // 顧客取得失敗時はピッカーで選び直してもらう
      });
  }, [isNew, presetCustomerRecordId]);

  function startEdit() {
    if (!karte) return;
    setForm(karteToInput(karte));
    setPhotos(karte.photos);
    setEditing(true);
    setSaveError(null);
  }

  function cancelEdit() {
    if (isNew) {
      setLocation("/karte");
      return;
    }
    if (karte) {
      setForm(karteToInput(karte));
      setPhotos(karte.photos);
    }
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerRecordId) {
      setSaveError("顧客を選択してください");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload: KarteInput = {
        ...form,
        photoFileTokens: photos.map((p) => p.fileToken),
      };
      const result = isNew
        ? await api.karte.create(payload)
        : await api.karte.update(recordId!, payload);
      toast.success(isNew ? "カルテを作成しました" : "更新しました");
      if (isNew) {
        setLocation(`/karte/${result.recordId}`);
      } else {
        setKarte(result);
        setForm(karteToInput(result));
        setPhotos(result.photos);
        setEditing(false);
      }
    } catch (e) {
      setSaveError(e instanceof ApiError || e instanceof Error ? e.message : "保存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (!recordId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        カルテIDが指定されていません。
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      <Header
        salonName={session.tenant.salonName}
        userDisplayName={session.user.displayName}
        onLogout={() => logout()}
      />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6 text-sm">
          <Link
            href="/karte"
            className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> カルテ一覧
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-medium">
            {isNew ? "新規カルテ" : karte?.karteId || "カルテ詳細"}
          </span>
        </div>

        {loading ? (
          <CenteredCard>読み込み中…</CenteredCard>
        ) : error ? (
          <CenteredCard>
            <span className="text-red-600">{error}</span>
            <button
              onClick={() => setLocation("/karte")}
              className="block mx-auto mt-3 underline text-sm text-slate-600"
            >
              カルテ一覧へ戻る
            </button>
          </CenteredCard>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {isNew ? "新規カルテ" : karte?.karteId}
                </div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  {isNew ? "新規カルテ作成" : karte?.customerName || "—"}
                  {!isNew && karte?.customerKind && (
                    <span
                      className={`text-xs font-normal px-2 py-0.5 rounded-full ${
                        karte.customerKind === "新規"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {karte.customerKind}
                    </span>
                  )}
                </h1>
                {!isNew && karte?.visitDate && (
                  <div className="text-sm text-slate-500 mt-1">来店日: {karte.visitDate}</div>
                )}
              </div>
              {!isNew && !editing && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                  style={{ background: "#8B7355" }}
                >
                  <Edit3 className="w-4 h-4" />
                  編集
                </button>
              )}
              {editing && !isNew && (
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                  キャンセル
                </button>
              )}
            </div>

            {editing ? (
              <KarteEditForm
                form={form}
                onChange={setForm}
                onSubmit={handleSave}
                saving={saving}
                errorMsg={saveError}
                photos={photos}
                onPhotosChange={setPhotos}
                isNew={isNew}
                presetCustomerLocked={!!presetCustomerRecordId && isNew}
                presetCustomer={selectedCustomer}
                onCancel={isNew ? () => setLocation("/karte") : cancelEdit}
              />
            ) : karte ? (
              <KarteReadView karte={karte} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ── 表示モード ──
function KarteReadView({ karte }: { karte: Karte }) {
  return (
    <div className="space-y-4">
      <Card title="顧客" icon={<User className="w-4 h-4" />}>
        <DataRow label="顧客名（自動）" value={karte.customerName || "—"} muted />
        <DataRow label="性別（自動）" value={karte.customerGender || "—"} muted />
        <DataRow label="顧客区分" value={karte.customerKind || "—"} />
        <DataRow
          label="顧客レコード"
          value={
            karte.customerRecordId ? (
              <Link
                href={`/customers/${karte.customerRecordId}`}
                className="text-blue-600 hover:underline"
              >
                顧客台帳で開く →
              </Link>
            ) : (
              "—"
            )
          }
        />
      </Card>

      <Card title="来店・施術" icon={<ClipboardList className="w-4 h-4" />}>
        <DataRow label="来店日" value={karte.visitDate || "—"} />
        <DataRow label="来店年月（自動）" value={karte.visitYearMonth || "—"} muted />
        <DataRow
          label="施術コース"
          value={
            karte.treatmentCourses.length === 0 ? (
              "—"
            ) : (
              <div className="flex gap-1 flex-wrap">
                {karte.treatmentCourses.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )
          }
        />
        <DataRow
          label="施術コメント"
          value={
            karte.treatmentComment ? (
              <p className="whitespace-pre-wrap text-slate-800">{karte.treatmentComment}</p>
            ) : (
              "—"
            )
          }
        />
      </Card>

      <Card title="会計" icon={<ClipboardList className="w-4 h-4" />}>
        <DataRow
          label="施術 支払金額"
          value={karte.treatmentAmount !== null ? `¥${karte.treatmentAmount.toLocaleString()}` : "—"}
        />
        <DataRow
          label="物販 支払金額"
          value={karte.productAmount !== null ? `¥${karte.productAmount.toLocaleString()}` : "—"}
        />
        <DataRow
          label="総支払額（自動）"
          value={karte.totalAmount !== null ? `¥${karte.totalAmount.toLocaleString()}` : "—"}
          muted
        />
        <DataRow
          label="支払方法"
          value={
            karte.paymentMethods.length === 0 ? (
              "—"
            ) : (
              <div className="flex gap-1 flex-wrap">
                {karte.paymentMethods.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )
          }
        />
      </Card>

      <Card title="写真" icon={<ImageIcon className="w-4 h-4" />}>
        {karte.photos.length === 0 ? (
          <div className="px-5 py-6 text-slate-400 text-sm text-center">写真は添付されていません</div>
        ) : (
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {karte.photos.map((p) => (
              <a
                key={p.fileToken}
                href={p.url || `/api/karte/photo/${encodeURIComponent(p.fileToken)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 bg-slate-50 group"
              >
                <img
                  src={p.url || `/api/karte/photo/${encodeURIComponent(p.fileToken)}`}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:opacity-90 transition"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── 編集 / 新規フォーム ──
function KarteEditForm({
  form,
  onChange,
  onSubmit,
  saving,
  errorMsg,
  photos,
  onPhotosChange,
  isNew,
  presetCustomerLocked,
  presetCustomer,
  onCancel,
}: {
  form: KarteInput;
  onChange: (f: KarteInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  errorMsg: string | null;
  photos: KartePhoto[];
  onPhotosChange: (ps: KartePhoto[]) => void;
  isNew: boolean;
  presetCustomerLocked: boolean;
  presetCustomer: Customer | null;
  onCancel: () => void;
}) {
  function set<K extends keyof KarteInput>(key: K, value: KarteInput[K]) {
    onChange({ ...form, [key]: value });
  }

  function toggleCourse(t: TreatmentCourse) {
    const current = form.treatmentCourses || [];
    set(
      "treatmentCourses",
      current.includes(t) ? current.filter((x) => x !== t) : [...current, t]
    );
  }

  function togglePayment(t: PaymentMethod) {
    const current = form.paymentMethods || [];
    set(
      "paymentMethods",
      current.includes(t) ? current.filter((x) => x !== t) : [...current, t]
    );
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    try {
      const uploaded = await Promise.all(arr.map((f) => api.karte.uploadPhoto(f)));
      const newPhotos: KartePhoto[] = uploaded.map((u) => ({
        fileToken: u.fileToken,
        name: u.name,
        url: `/api/karte/photo/${encodeURIComponent(u.fileToken)}`,
      }));
      onPhotosChange([...photos, ...newPhotos]);
      toast.success(`${newPhotos.length} 枚アップロードしました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "写真アップロード失敗");
    }
  }

  function removePhoto(token: string) {
    onPhotosChange(photos.filter((p) => p.fileToken !== token));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl border p-6 space-y-5"
      style={{ borderColor: "#E8DFD0" }}
    >
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {errorMsg}
        </div>
      )}

      {/* 顧客 */}
      <Field label="顧客" required>
        {presetCustomerLocked && presetCustomer ? (
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm">
            {presetCustomer.fullName || `${presetCustomer.lastName} ${presetCustomer.firstName}`}
            <span className="ml-2 text-xs text-slate-500">
              {presetCustomer.customerNo}
            </span>
            <span className="ml-2 text-xs text-slate-400">（顧客詳細から作成）</span>
          </div>
        ) : (
          <CustomerPicker
            value={form.customerRecordId}
            onChange={(c) => set("customerRecordId", c.recordId)}
            initialCustomer={presetCustomer}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="顧客区分">
          <select
            value={form.customerKind ?? ""}
            onChange={(e) =>
              set(
                "customerKind",
                CUSTOMER_KIND.includes(e.target.value as CustomerKind)
                  ? (e.target.value as CustomerKind)
                  : undefined
              )
            }
            className={inputCls}
          >
            <option value="">未選択</option>
            {CUSTOMER_KIND.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="来店日">
          <input
            type="date"
            value={form.visitDate ?? ""}
            onChange={(e) => set("visitDate", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="施術コース（複数選択可）">
        <div className="flex gap-2 flex-wrap">
          {TREATMENT_COURSES.map((c) => {
            const active = (form.treatmentCourses || []).includes(c);
            return (
              <button
                type="button"
                key={c}
                onClick={() => toggleCourse(c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  active
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="施術コメント">
        <textarea
          value={form.treatmentComment ?? ""}
          onChange={(e) => set("treatmentComment", e.target.value)}
          rows={4}
          className={inputCls + " resize-y"}
          placeholder="使用薬剤・施術内容・お客様の要望など"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="施術 支払金額">
          <input
            type="number"
            min={0}
            value={form.treatmentAmount ?? ""}
            onChange={(e) => set("treatmentAmount", e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="¥"
            className={inputCls}
          />
        </Field>
        <Field label="物販 支払金額">
          <input
            type="number"
            min={0}
            value={form.productAmount ?? ""}
            onChange={(e) => set("productAmount", e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="¥"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="支払方法">
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_METHODS.map((m) => {
            const active = (form.paymentMethods || []).includes(m);
            return (
              <button
                type="button"
                key={m}
                onClick={() => togglePayment(m)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="写真">
        <div className="space-y-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
            <Upload className="w-4 h-4" />
            写真を追加
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoUpload(e.target.files)}
            />
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p) => (
                <div
                  key={p.fileToken}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
                >
                  <img
                    src={p.url || `/api/karte/photo/${encodeURIComponent(p.fileToken)}`}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.fileToken)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                    title="この写真を外す"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-300 hover:bg-slate-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving || !form.customerRecordId}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          style={{ background: "#8B7355" }}
        >
          <Save className="w-4 h-4" />
          {saving ? "保存中…" : isNew ? "登録" : "保存"}
        </button>
      </div>
    </form>
  );
}

// ── 顧客ピッカー ──
function CustomerPicker({
  value,
  onChange,
  initialCustomer,
}: {
  value: string;
  onChange: (c: Customer) => void;
  initialCustomer: Customer | null;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(initialCustomer);

  useEffect(() => {
    setSelected(initialCustomer);
  }, [initialCustomer]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.customerLedger
      .list({ q: keyword.trim() || undefined, pageSize: 30, sort: "recent" })
      .then((res) => setList(res.items))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [open, keyword]);

  if (selected && selected.recordId === value) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
        <div>
          <div className="text-sm font-medium text-slate-800">
            {selected.fullName || `${selected.lastName} ${selected.firstName}`.trim()}
          </div>
          <div className="text-xs text-slate-500">{selected.customerNo}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setOpen(true);
          }}
          className="text-xs text-slate-500 hover:text-slate-800 underline"
        >
          変更
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-left text-sm text-slate-600 hover:bg-slate-50"
      >
        {value ? "顧客を選び直す…" : "顧客を選択…"}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-80 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="姓・名・フリガナ・電話で検索"
                className="w-full pl-9 pr-3 py-1.5 rounded border border-slate-300 text-sm"
              />
            </div>
          </div>
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-sm">読み込み中…</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">該当する顧客がありません</div>
          ) : (
            <ul>
              {list.map((c) => (
                <li key={c.recordId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      onChange(c);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                  >
                    <div className="text-sm font-medium text-slate-800">
                      {c.fullName || `${c.lastName} ${c.firstName}`.trim()}
                    </div>
                    <div className="text-xs text-slate-500 flex gap-2">
                      <span>{c.customerNo}</span>
                      {c.phone && <span>{c.phone}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── ヘルパー ──
function emptyInput(customerRecordId?: string): KarteInput {
  return {
    customerRecordId: customerRecordId ?? "",
    customerKind: undefined,
    visitDate: undefined,
    treatmentCourses: [],
    treatmentComment: "",
    paymentMethods: [],
  };
}

function karteToInput(k: Karte): KarteInput {
  return {
    customerRecordId: k.customerRecordId ?? "",
    customerKind: k.customerKind || undefined,
    visitDate: k.visitDate ?? undefined,
    treatmentCourses: k.treatmentCourses,
    treatmentComment: k.treatmentComment,
    treatmentAmount: k.treatmentAmount ?? undefined,
    productAmount: k.productAmount ?? undefined,
    paymentMethods: k.paymentMethods,
    photoFileTokens: k.photos.map((p) => p.fileToken),
  };
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: "#E8DFD0" }}
    >
      <header className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700 inline-flex items-center gap-2 w-full">
        {icon}
        {title}
      </header>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 px-5 py-3 text-sm items-center">
      <div className={`text-slate-500 ${muted ? "italic" : ""}`}>{label}</div>
      <div className={`text-slate-800 ${muted ? "text-slate-500" : ""}`}>{value}</div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-center py-16 text-slate-500 bg-white rounded-2xl border"
      style={{ borderColor: "#E8DFD0" }}
    >
      {children}
    </div>
  );
}

function Header({
  salonName,
  userDisplayName,
  onLogout,
}: {
  salonName: string;
  userDisplayName: string;
  onLogout: () => void;
}) {
  return (
    <header className="border-b bg-white" style={{ borderColor: "#E8DFD0" }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#8B7355" }}
          >
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span
              className="text-base font-bold truncate"
              style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}
            >
              {salonName}
            </span>
            <span className="text-xs text-slate-500 truncate">カルテ</span>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/customers"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            <Users className="w-4 h-4" />
            顧客台帳
          </Link>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-slate-300 text-white text-xs font-semibold flex items-center justify-center">
              {userDisplayName.slice(0, 1)}
            </div>
            <span className="text-xs text-slate-700 max-w-[10rem] truncate">
              {userDisplayName}
            </span>
          </div>
          <button
            onClick={onLogout}
            title="ログアウト"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </div>
    </header>
  );
}
