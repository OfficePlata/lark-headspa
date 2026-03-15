import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearch } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, AlertCircle, ChevronDown, Check, Camera, X, Search } from "lucide-react";
import { api } from "@/lib/api";

interface FormField {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  options: string[] | null;
  placeholder: string | null;
  isRequired: boolean;
  sortOrder: number;
}

interface FormConfig {
  salon: { id: number; salonName: string; slug: string; logoUrl: string | null };
  theme: {
    id: string;
    colors: Record<string, string>;
    fonts: { heading: string; body: string };
    borderRadius: string;
    shadow: string;
  };
  formTitle: string;
  fields: FormField[];
}

interface CustomerOption {
  recordId: string;
  customerNo: string;
  name: string;
}

interface PhotoFile {
  file: File;
  preview: string;
  uploading: boolean;
  token?: string;
  error?: string;
}

type FormType = "customer" | "monthly_goal" | "yearly_goal" | "karte";

const FORM_TYPE_LABELS: Record<FormType, string> = {
  customer: "新規顧客情報",
  monthly_goal: "月間目標",
  yearly_goal: "年間目標",
  karte: "カルテデータ",
};

// ============================================================
// Customer Lookup Component
// ============================================================
function CustomerLookupField({
  value,
  onChange,
  slug,
  colors,
  borderRadius,
  placeholder,
}: {
  value: string; // JSON: {"recordId":"xxx","customerNo":"C-004","name":"山田 太郎"}
  onChange: (val: string) => void;
  slug: string;
  colors: Record<string, string>;
  borderRadius: string;
  placeholder: string;
}) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.customers.list(slug);
        setCustomers(data.customers || []);
        if (data.error) setLoadError(data.error);
      } catch (err: any) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.customerNo.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    );
  });

  // Parse the stored JSON value
  let parsedValue: { recordId?: string; customerNo?: string; name?: string } = {};
  try {
    if (value) parsedValue = JSON.parse(value);
  } catch { /* not JSON, ignore */ }
  const selectedRecordId = parsedValue.recordId || "";
  const selectedDisplay = parsedValue.customerNo
    ? `${parsedValue.customerNo} - ${parsedValue.name || ""}`
    : "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-left flex items-center justify-between transition-colors"
        style={{
          background: colors.inputBg,
          border: `1px solid ${open ? colors.inputFocus : colors.inputBorder}`,
          borderRadius,
          color: selectedDisplay ? colors.text : colors.textMuted,
        }}
      >
        <span className="truncate">
          {selectedDisplay || placeholder || "顧客を選択"}
        </span>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: colors.textMuted }} />
        ) : (
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 transition-transform"
            style={{ color: colors.textMuted, transform: open ? "rotate(180deg)" : "" }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute z-50 w-full mt-1 overflow-hidden"
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight: "300px",
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: colors.border }}>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: colors.textMuted }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="番号・名前で検索..."
                className="w-full pl-9 pr-3 py-2 text-sm focus:outline-none"
                style={{
                  background: colors.inputBg,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius,
                  color: colors.text,
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto" style={{ maxHeight: "230px" }}>
            {loadError && (
              <div className="px-4 py-3 text-xs" style={{ color: colors.error }}>
                取得エラー: {loadError}
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.primary }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: colors.textMuted }}>
                {customers.length === 0 ? "顧客データがありません" : "該当する顧客が見つかりません"}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.recordId}
                  type="button"
                  onClick={() => {
                    onChange(JSON.stringify({
                      recordId: c.recordId,
                      customerNo: c.customerNo,
                      name: c.name,
                    }));
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full px-4 py-3 text-left flex items-center justify-between transition-colors text-sm"
                  style={{
                    background: selectedRecordId === c.recordId ? `${colors.primary}10` : "transparent",
                    color: colors.text,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedRecordId !== c.recordId) e.currentTarget.style.background = colors.surfaceHover || `${colors.primary}05`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selectedRecordId === c.recordId ? `${colors.primary}10` : "transparent";
                  }}
                >
                  <div>
                    <span className="font-medium" style={{ color: colors.primary }}>{c.customerNo}</span>
                    <span className="mx-2" style={{ color: colors.border }}>|</span>
                    <span>{c.name}</span>
                  </div>
                  {selectedRecordId === c.recordId && (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: colors.primary }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Photo Upload Component
// ============================================================
function PhotoUploadField({
  photos,
  onAdd,
  onRemove,
  colors,
  borderRadius,
  slug,
}: {
  photos: PhotoFile[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
  colors: Record<string, string>;
  borderRadius: string;
  slug: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {/* Photo previews */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {photos.map((photo, idx) => (
            <div
              key={idx}
              className="relative w-24 h-24 overflow-hidden"
              style={{ borderRadius, border: `1px solid ${colors.border}` }}
            >
              <img
                src={photo.preview}
                alt={`写真 ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {photo.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
              )}
              {photo.error && (
                <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
              )}
              {photo.token && (
                <div className="absolute top-1 left-1">
                  <CheckCircle className="w-4 h-4" style={{ color: colors.success }} />
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add photo button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-3 w-full px-4 py-4 transition-all"
        style={{
          background: colors.inputBg,
          border: `2px dashed ${colors.inputBorder}`,
          borderRadius,
          color: colors.textMuted,
        }}
      >
        <Camera className="w-5 h-5" />
        <span className="text-sm">
          {photos.length === 0 ? "写真を選択またはカメラで撮影" : "写真を追加"}
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAdd(e.target.files);
          }
          // Reset so the same file can be selected again
          e.target.value = "";
        }}
      />

      <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
        JPEG, PNG, GIF, WebP対応（各10MBまで）
      </p>
    </div>
  );
}

// ============================================================
// Main PublicForm Component
// ============================================================
export default function PublicForm() {
  const params = useParams<{ slug: string }>();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const slug = params.slug || "";
  const initialType = (searchParams.get("type") as FormType) || "customer";

  const [formType, setFormType] = useState<FormType>(initialType);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadForm = useCallback(async (type: FormType) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.form.getBySlug(slug, type);
      if (data) {
        setConfig(data);
        const initial: Record<string, string | string[]> = {};
        data.fields.forEach((f) => {
          if (f.fieldType === "multiselect") {
            initial[f.fieldName] = [];
          } else if (f.fieldType === "photo") {
            // Photos are handled separately
          } else {
            initial[f.fieldName] = "";
          }
        });
        setFormData(initial);
        setPhotos([]);
      } else {
        setError("フォームが見つかりません");
      }
    } catch (err: any) {
      setError(err.message || "フォームの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) loadForm(formType);
  }, [slug, formType, loadForm]);

  const handleMultiselectToggle = (fieldName: string, option: string) => {
    setFormData((prev) => {
      const current = prev[fieldName];
      const arr = Array.isArray(current) ? [...current] : [];
      const idx = arr.indexOf(option);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        arr.push(option);
      }
      return { ...prev, [fieldName]: arr };
    });
  };

  const handleAddPhotos = async (files: FileList) => {
    const newPhotos: PhotoFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      newPhotos.push({ file, preview, uploading: true });
    }

    const startIdx = photos.length;
    setPhotos((prev) => [...prev, ...newPhotos]);

    // Upload each photo
    for (let i = 0; i < newPhotos.length; i++) {
      try {
        const result = await api.photos.upload(slug, newPhotos[i].file);
        setPhotos((prev) => {
          const updated = [...prev];
          const idx = startIdx + i;
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], uploading: false, token: result.fileToken };
          }
          return updated;
        });
      } catch (err: any) {
        setPhotos((prev) => {
          const updated = [...prev];
          const idx = startIdx + i;
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], uploading: false, error: err.message };
          }
          return updated;
        });
        toast.error(`写真のアップロードに失敗: ${err.message}`);
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      // Revoke the object URL to free memory
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    // Check if any photos are still uploading
    if (photos.some((p) => p.uploading)) {
      toast.error("写真のアップロード中です。完了後に送信してください。");
      return;
    }

    // Validate required fields
    const missing = config.fields.filter((f) => {
      if (!f.isRequired) return false;
      if (f.fieldType === "photo") return false; // photos validated separately if needed
      const val = formData[f.fieldName];
      if (Array.isArray(val)) return val.length === 0;
      return !val?.toString().trim();
    });
    if (missing.length > 0) {
      toast.error(`必須項目を入力してください: ${missing.map((f) => f.fieldLabel).join("、")}`);
      return;
    }

    setSubmitting(true);
    try {
      // Collect photo tokens
      const photoTokens = photos
        .filter((p) => p.token)
        .map((p) => p.token!);

      const result = await api.form.submit(slug, formType, formData, photoTokens.length > 0 ? photoTokens : undefined);
      if (result.success) {
        setSubmitted(true);
        if (result.larkSynced) {
          toast.success("送信完了 - Lark BASEに保存されました");
        } else {
          toast.warning("送信完了（D1保存済み）");
          if (result.syncError) {
            toast.error(`Lark同期エラー: ${result.syncError}`, { duration: 8000 });
            console.error("Lark sync error:", result.syncError);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setPhotos([]);
    if (config) {
      const initial: Record<string, string | string[]> = {};
      config.fields.forEach((f) => {
        if (f.fieldType === "multiselect") {
          initial[f.fieldName] = [];
        } else if (f.fieldType === "photo") {
          // skip
        } else {
          initial[f.fieldName] = "";
        }
      });
      setFormData(initial);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#8B7355" }} />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#C75050" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "#3D3226" }}>
            {error || "フォームが見つかりません"}
          </h2>
          <a href="/" className="text-sm underline" style={{ color: "#8B7355" }}>
            トップページへ戻る
          </a>
        </div>
      </div>
    );
  }

  const { theme, salon } = config;
  const c = theme.colors;

  return (
    <div className="min-h-screen" style={{ background: c.background, fontFamily: theme.fonts.body }}>
      {/* Header with salon name */}
      <header className="py-6 px-4 text-center" style={{ background: c.primary }}>
        {salon.logoUrl && (
          <img src={salon.logoUrl} alt={salon.salonName} className="h-12 mx-auto mb-3 object-contain" />
        )}
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: theme.fonts.heading }}
        >
          {salon.salonName}
        </h1>
      </header>

      {/* Form type tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(Object.keys(FORM_TYPE_LABELS) as FormType[]).map((ft) => (
            <button
              key={ft}
              onClick={() => { setFormType(ft); setSubmitted(false); }}
              className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
              style={{
                background: formType === ft ? c.primary : c.surface,
                color: formType === ft ? "#FFFFFF" : c.textMuted,
                border: `1px solid ${formType === ft ? c.primary : c.border}`,
              }}
            >
              {FORM_TYPE_LABELS[ft]}
            </button>
          ))}
        </div>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl p-8 md:p-10"
          style={{
            background: c.surface,
            boxShadow: theme.shadow,
            borderRadius: theme.borderRadius,
          }}
        >
          <h2
            className="text-2xl font-bold text-center mb-8"
            style={{ fontFamily: theme.fonts.heading, color: c.text }}
          >
            {config.formTitle}
          </h2>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: c.success }} />
              <h3 className="text-xl font-bold mb-2" style={{ color: c.text }}>
                送信が完了しました
              </h3>
              <p className="mb-6" style={{ color: c.textMuted }}>
                ご入力ありがとうございました。
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
                style={{ background: c.primary, borderRadius: theme.borderRadius }}
              >
                新しいフォームを入力する
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {config.fields.map((field) => (
                <div key={field.fieldName}>
                  <label className="block text-sm font-medium mb-2" style={{ color: c.text }}>
                    {field.isRequired && (
                      <span className="mr-1" style={{ color: c.error }}>*</span>
                    )}
                    {field.fieldLabel}
                  </label>

                  {/* Customer Lookup Field */}
                  {field.fieldType === "customer_lookup" ? (
                    <CustomerLookupField
                      value={(formData[field.fieldName] as string) || ""}
                      onChange={(val) => setFormData((prev) => ({ ...prev, [field.fieldName]: val }))}
                      slug={slug}
                      colors={c}
                      borderRadius={theme.borderRadius}
                      placeholder={field.placeholder || "顧客を選択"}
                    />
                  ) : field.fieldType === "photo" ? (
                    /* Photo Upload Field */
                    <PhotoUploadField
                      photos={photos}
                      onAdd={handleAddPhotos}
                      onRemove={handleRemovePhoto}
                      colors={c}
                      borderRadius={theme.borderRadius}
                      slug={slug}
                    />
                  ) : field.fieldType === "select" && field.options ? (
                    <div className="relative">
                      <select
                        value={(formData[field.fieldName] as string) || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.fieldName]: e.target.value }))}
                        className="w-full px-4 py-3 appearance-none transition-colors focus:outline-none"
                        style={{
                          background: c.inputBg,
                          border: `1px solid ${c.inputBorder}`,
                          borderRadius: theme.borderRadius,
                          color: formData[field.fieldName] ? c.text : c.textMuted,
                        }}
                        onFocus={(e) => { e.target.style.borderColor = c.inputFocus; }}
                        onBlur={(e) => { e.target.style.borderColor = c.inputBorder; }}
                      >
                        <option value="">{field.placeholder || "オプションを選択"}</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                        style={{ color: c.textMuted }}
                      />
                    </div>
                  ) : field.fieldType === "multiselect" && field.options ? (
                    <div className="space-y-2">
                      {field.options.map((opt) => {
                        const selected = Array.isArray(formData[field.fieldName])
                          ? (formData[field.fieldName] as string[]).includes(opt)
                          : false;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleMultiselectToggle(field.fieldName, opt)}
                            className="flex items-center gap-3 w-full px-4 py-3 transition-all text-left"
                            style={{
                              background: selected ? `${c.primary}10` : c.inputBg,
                              border: `1px solid ${selected ? c.primary : c.inputBorder}`,
                              borderRadius: theme.borderRadius,
                              color: c.text,
                            }}
                          >
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={{
                                background: selected ? c.primary : "transparent",
                                border: `2px solid ${selected ? c.primary : c.inputBorder}`,
                              }}
                            >
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : field.fieldType === "textarea" ? (
                    <textarea
                      value={(formData[field.fieldName] as string) || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.fieldName]: e.target.value }))}
                      placeholder={field.placeholder || ""}
                      rows={4}
                      className="w-full px-4 py-3 transition-colors focus:outline-none resize-none"
                      style={{
                        background: c.inputBg,
                        border: `1px solid ${c.inputBorder}`,
                        borderRadius: theme.borderRadius,
                        color: c.text,
                      }}
                      onFocus={(e) => { e.target.style.borderColor = c.inputFocus; }}
                      onBlur={(e) => { e.target.style.borderColor = c.inputBorder; }}
                    />
                  ) : (
                    <input
                      type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "month" ? "month" : "text"}
                      value={(formData[field.fieldName] as string) || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.fieldName]: e.target.value }))}
                      placeholder={field.placeholder || ""}
                      className="w-full px-4 py-3 transition-colors focus:outline-none"
                      style={{
                        background: c.inputBg,
                        border: `1px solid ${c.inputBorder}`,
                        borderRadius: theme.borderRadius,
                        color: c.text,
                      }}
                      onFocus={(e) => { e.target.style.borderColor = c.inputFocus; }}
                      onBlur={(e) => { e.target.style.borderColor = c.inputBorder; }}
                    />
                  )}
                </div>
              ))}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: c.primary, borderRadius: theme.borderRadius }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    "送信"
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-sm" style={{ color: c.textMuted }}>
        Powered by Salon Form System
      </footer>
    </div>
  );
}
