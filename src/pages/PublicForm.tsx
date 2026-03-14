import { useEffect, useState, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, AlertCircle, ChevronDown, Check } from "lucide-react";
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

type FormType = "customer" | "monthly_goal" | "yearly_goal" | "karte";

const FORM_TYPE_LABELS: Record<FormType, string> = {
  customer: "新規顧客情報",
  monthly_goal: "月間目標",
  yearly_goal: "年間目標",
  karte: "カルテデータ",
};

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
  // formData can hold string or string[] for multiselect fields
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const loadForm = useCallback(async (type: FormType) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.form.getBySlug(slug, type);
      if (data) {
        setConfig(data);
        // Initialize form data
        const initial: Record<string, string | string[]> = {};
        data.fields.forEach((f) => {
          initial[f.fieldName] = f.fieldType === "multiselect" ? [] : "";
        });
        setFormData(initial);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    // Validate required fields
    const missing = config.fields.filter((f) => {
      if (!f.isRequired) return false;
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
      const result = await api.form.submit(slug, formType, formData);
      if (result.success) {
        setSubmitted(true);
        if (result.larkSynced) {
          toast.success("送信完了 - Lark BASEに保存されました");
        } else {
          toast.success("送信完了");
          if (result.syncError) {
            console.warn("Lark sync warning:", result.syncError);
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
    if (config) {
      const initial: Record<string, string | string[]> = {};
      config.fields.forEach((f) => {
        initial[f.fieldName] = f.fieldType === "multiselect" ? [] : "";
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

                  {field.fieldType === "select" && field.options ? (
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
