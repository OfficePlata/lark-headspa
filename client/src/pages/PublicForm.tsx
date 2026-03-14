import { useState, useMemo } from "react";
import { useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { SalonThemeProvider } from "@/contexts/SalonThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export default function PublicForm() {
  const params = useParams<{ slug: string }>();
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const formType = searchParams.get("type") || "customer";

  const { data, isLoading, error } = trpc.form.getBySlug.useQuery(
    { slug: params.slug || "", formType },
    { enabled: !!params.slug }
  );

  const submitMutation = trpc.form.submit.useMutation();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--salon-bg, #FAF7F2)" }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--salon-primary, #8B7355)" }} />
          <p style={{ color: "var(--salon-text-muted, #8B7D6B)", fontFamily: "var(--salon-font-body, 'Noto Sans JP', sans-serif)" }}>
            読み込み中...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF7F2" }}>
        <div className="text-center p-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            フォームが見つかりません
          </h2>
          <p className="text-gray-500">URLを確認してください</p>
        </div>
      </div>
    );
  }

  const { salon, theme, formTitle, fields } = data;

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitMutation.mutateAsync({
        slug: params.slug || "",
        formType,
        formData,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  if (submitted) {
    return (
      <SalonThemeProvider theme={theme}>
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{
            background: theme.colors.background,
            fontFamily: theme.fonts.body,
          }}
        >
          <div
            className="w-full max-w-lg text-center p-12"
            style={{
              background: theme.colors.surface,
              borderRadius: theme.borderRadius,
              boxShadow: theme.shadow,
            }}
          >
            <CheckCircle2
              className="h-16 w-16 mx-auto mb-6"
              style={{ color: theme.colors.success }}
            />
            <h2
              className="text-2xl font-semibold mb-4"
              style={{
                color: theme.colors.text,
                fontFamily: theme.fonts.heading,
              }}
            >
              送信完了
            </h2>
            <p style={{ color: theme.colors.textMuted }} className="mb-8 leading-relaxed">
              フォームが正常に送信されました。<br />
              ご入力ありがとうございました。
            </p>
            <Button
              onClick={() => {
                setSubmitted(false);
                setFormData({});
              }}
              className="px-8 py-3 text-white transition-all hover:opacity-90"
              style={{
                background: theme.colors.primary,
                borderRadius: theme.borderRadius,
              }}
            >
              新しいフォームを入力
            </Button>
          </div>
        </div>
      </SalonThemeProvider>
    );
  }

  return (
    <SalonThemeProvider theme={theme}>
      <div
        className="min-h-screen py-8 px-4 md:py-16"
        style={{
          background: theme.colors.background,
          fontFamily: theme.fonts.body,
        }}
      >
        {/* Header area */}
        <div className="max-w-2xl mx-auto mb-8 text-center">
          {salon.logoUrl && (
            <img
              src={salon.logoUrl}
              alt={salon.salonName}
              className="h-12 mx-auto mb-4 object-contain"
            />
          )}
          <p
            className="text-sm tracking-widest uppercase mb-2"
            style={{ color: theme.colors.textMuted }}
          >
            {salon.salonName}
          </p>
        </div>

        {/* Form card */}
        <div
          className="w-full max-w-2xl mx-auto"
          style={{
            background: theme.colors.surface,
            borderRadius: theme.borderRadius,
            boxShadow: theme.shadow,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Form header decoration */}
          <div
            className="h-2 rounded-t-xl"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
              borderRadius: `${theme.borderRadius} ${theme.borderRadius} 0 0`,
            }}
          />

          <div className="p-8 md:p-12">
            <div className="flex items-center gap-3 mb-8">
              <Sparkles className="h-5 w-5" style={{ color: theme.colors.accent }} />
              <h1
                className="text-2xl md:text-3xl font-semibold"
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading,
                }}
              >
                {formTitle}
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {(fields as any[]).map((field: any) => (
                <div key={field.fieldName} className="space-y-2">
                  <Label
                    className="text-sm font-medium flex items-center gap-1"
                    style={{ color: theme.colors.text }}
                  >
                    {field.isRequired && (
                      <span style={{ color: theme.colors.error }}>*</span>
                    )}
                    {field.fieldLabel}
                  </Label>

                  {field.fieldType === "select" ? (
                    <Select
                      value={formData[field.fieldName] || ""}
                      onValueChange={(val) =>
                        handleFieldChange(field.fieldName, val)
                      }
                      required={field.isRequired}
                    >
                      <SelectTrigger
                        className="w-full h-12 transition-all"
                        style={{
                          background: theme.colors.inputBg,
                          borderColor: theme.colors.inputBorder,
                          borderRadius: theme.borderRadius,
                          color: theme.colors.text,
                        }}
                      >
                        <SelectValue
                          placeholder={field.placeholder || "オプションを選択"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(field.options)
                          ? field.options
                          : []
                        ).map((opt: string) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.fieldType === "textarea" ? (
                    <Textarea
                      value={formData[field.fieldName] || ""}
                      onChange={(e) =>
                        handleFieldChange(field.fieldName, e.target.value)
                      }
                      placeholder={field.placeholder}
                      required={field.isRequired}
                      rows={4}
                      className="transition-all"
                      style={{
                        background: theme.colors.inputBg,
                        borderColor: theme.colors.inputBorder,
                        borderRadius: theme.borderRadius,
                        color: theme.colors.text,
                      }}
                    />
                  ) : (
                    <Input
                      type={
                        field.fieldType === "number"
                          ? "number"
                          : field.fieldType === "date"
                            ? "date"
                            : field.fieldType === "month"
                              ? "month"
                              : "text"
                      }
                      value={formData[field.fieldName] || ""}
                      onChange={(e) =>
                        handleFieldChange(field.fieldName, e.target.value)
                      }
                      placeholder={field.placeholder}
                      required={field.isRequired}
                      className="h-12 transition-all"
                      style={{
                        background: theme.colors.inputBg,
                        borderColor: theme.colors.inputBorder,
                        borderRadius: theme.borderRadius,
                        color: theme.colors.text,
                      }}
                    />
                  )}
                </div>
              ))}

              {submitMutation.error && (
                <div
                  className="p-4 rounded-lg flex items-center gap-3"
                  style={{
                    background: `${theme.colors.error}10`,
                    border: `1px solid ${theme.colors.error}30`,
                  }}
                >
                  <AlertCircle
                    className="h-5 w-5 shrink-0"
                    style={{ color: theme.colors.error }}
                  />
                  <p className="text-sm" style={{ color: theme.colors.error }}>
                    送信に失敗しました。もう一度お試しください。
                  </p>
                </div>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full h-14 text-lg font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                    borderRadius: theme.borderRadius,
                    boxShadow: `0 4px 12px ${theme.colors.primary}30`,
                  }}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "送信"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-2xl mx-auto mt-8 text-center">
          <p
            className="text-xs"
            style={{ color: theme.colors.textMuted }}
          >
            Powered by Lark Form System
          </p>
        </div>
      </div>
    </SalonThemeProvider>
  );
}
