import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Plus, Settings, Eye, Palette, History, ChevronRight,
  Loader2, ExternalLink, Copy, Check, X
} from "lucide-react";
import { api } from "@/lib/api";
import { THEMES, THEME_LIST, type ThemeConfig } from "@shared/themes";

// ============================================================
// Types
// ============================================================
interface Salon {
  id: number;
  salon_name: string;
  slug: string;
  theme_id: string;
  logo_url: string | null;
  lark_app_id: string | null;
  lark_app_secret: string | null;
  lark_bitable_app_token: string | null;
  lark_customer_table_id: string | null;
  lark_monthly_goal_table_id: string | null;
  lark_yearly_goal_table_id: string | null;
  lark_karte_table_id: string | null;
}

type Tab = "overview" | "theme" | "lark" | "submissions";

// ============================================================
// Dashboard
// ============================================================
export default function Dashboard() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadSalons = useCallback(async () => {
    try {
      const data = await api.salons.list();
      setSalons(data);
    } catch (err: any) {
      toast.error("サロン一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSalons(); }, [loadSalons]);

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      {/* Header */}
      <header className="border-b bg-white" style={{ borderColor: "#E8DFD0" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#8B7355" }}>
              <Settings className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}>
              管理画面
            </span>
          </a>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: "#8B7355" }}
          >
            <Plus className="w-4 h-4" />
            サロン追加
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#8B7355" }} />
          </div>
        ) : salons.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreateModal(true)} />
        ) : !selectedSalon ? (
          <SalonList salons={salons} onSelect={setSelectedSalon} />
        ) : (
          <SalonDetail
            salon={selectedSalon}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onBack={() => { setSelectedSalon(null); setActiveTab("overview"); }}
            onUpdate={(updated) => {
              setSelectedSalon(updated);
              setSalons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }}
          />
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSalonModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(salon) => {
            setSalons((prev) => [salon, ...prev]);
            setShowCreateModal(false);
            toast.success("サロンを作成しました");
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: "#F5F0E8" }}>
        <Plus className="w-10 h-10" style={{ color: "#8B7355" }} />
      </div>
      <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}>
        サロンを作成しましょう
      </h2>
      <p className="mb-8" style={{ color: "#8B7D6B" }}>
        サロンを作成して、顧客情報入力フォームを公開できます。
      </p>
      <button
        onClick={onCreateClick}
        className="px-8 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
        style={{ background: "#8B7355" }}
      >
        最初のサロンを作成
      </button>
    </div>
  );
}

function SalonList({ salons, onSelect }: { salons: Salon[]; onSelect: (s: Salon) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}>
        サロン一覧
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {salons.map((salon) => {
          const theme = THEMES[salon.theme_id] || THEMES.calmer;
          return (
            <motion.button
              key={salon.id}
              whileHover={{ y: -2 }}
              onClick={() => onSelect(salon)}
              className="text-left p-6 rounded-2xl bg-white border transition-shadow hover:shadow-lg"
              style={{ borderColor: "#E8DFD0" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-full"
                  style={{ background: theme.colors.primary }}
                />
                <ChevronRight className="w-5 h-5" style={{ color: "#8B7D6B" }} />
              </div>
              <h3 className="text-lg font-bold mb-1" style={{ color: "#3D3226" }}>
                {salon.salon_name}
              </h3>
              <p className="text-sm mb-3" style={{ color: "#8B7D6B" }}>
                /{salon.slug}
              </p>
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: theme.colors.background, color: theme.colors.primary }}
              >
                {theme.nameJa}テーマ
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function SalonDetail({
  salon, activeTab, onTabChange, onBack, onUpdate,
}: {
  salon: Salon;
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  onBack: () => void;
  onUpdate: (s: Salon) => void;
}) {
  const tabs: { id: Tab; label: string; icon: typeof Eye }[] = [
    { id: "overview", label: "概要", icon: Eye },
    { id: "theme", label: "テーマ", icon: Palette },
    { id: "lark", label: "Lark設定", icon: Settings },
    { id: "submissions", label: "送信履歴", icon: History },
  ];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm mb-6 transition-colors hover:opacity-70"
        style={{ color: "#8B7355" }}
      >
        ← サロン一覧に戻る
      </button>

      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}>
        {salon.salon_name}
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{
              background: activeTab === tab.id ? "#8B7355" : "#FFFFFF",
              color: activeTab === tab.id ? "#FFFFFF" : "#8B7D6B",
              border: `1px solid ${activeTab === tab.id ? "#8B7355" : "#E8DFD0"}`,
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab salon={salon} />}
      {activeTab === "theme" && <ThemeTab salon={salon} onUpdate={onUpdate} />}
      {activeTab === "lark" && <LarkSettingsTab salon={salon} onUpdate={onUpdate} />}
      {activeTab === "submissions" && <SubmissionsTab salon={salon} />}
    </div>
  );
}

// ---------- Overview Tab ----------
function OverviewTab({ salon }: { salon: Salon }) {
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = window.location.origin;
  const formTypes = [
    { type: "customer", label: "新規顧客情報" },
    { type: "karte", label: "カルテデータ" },
    { type: "monthly_goal", label: "月間目標" },
    { type: "yearly_goal", label: "年間目標" },
  ];

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    toast.success("URLをコピーしました");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border" style={{ borderColor: "#E8DFD0" }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: "#3D3226" }}>フォームURL</h3>
        <div className="space-y-3">
          {formTypes.map((ft) => {
            const url = `${baseUrl}/form/${salon.slug}?type=${ft.type}`;
            return (
              <div key={ft.type} className="flex items-center gap-3">
                <span className="text-sm font-medium w-32 shrink-0" style={{ color: "#8B7D6B" }}>
                  {ft.label}
                </span>
                <code
                  className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                  style={{ background: "#F5F0E8", color: "#6B5740" }}
                >
                  {url}
                </code>
                <button
                  onClick={() => copyUrl(url, ft.type)}
                  className="p-2 rounded-lg transition-colors hover:opacity-70"
                  style={{ color: "#8B7355" }}
                >
                  {copied === ft.type ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={`/form/${salon.slug}?type=${ft.type}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg transition-colors hover:opacity-70"
                  style={{ color: "#8B7355" }}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border" style={{ borderColor: "#E8DFD0" }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: "#3D3226" }}>Lark連携ステータス</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "App ID", value: salon.lark_app_id },
            { label: "App Secret", value: salon.lark_app_secret ? "設定済み" : null },
            { label: "Bitable Token", value: salon.lark_bitable_app_token },
            { label: "顧客テーブル", value: salon.lark_customer_table_id },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: item.value ? "#6B8E6B" : "#C75050" }}
              />
              <span className="text-sm" style={{ color: "#8B7D6B" }}>
                {item.label}: {item.value ? "設定済み" : "未設定"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Theme Tab ----------
function ThemeTab({ salon, onUpdate }: { salon: Salon; onUpdate: (s: Salon) => void }) {
  const [saving, setSaving] = useState(false);

  const handleSelectTheme = async (themeId: string) => {
    setSaving(true);
    try {
      await api.salons.update(salon.id, { themeId });
      onUpdate({ ...salon, theme_id: themeId });
      toast.success("テーマを変更しました");
    } catch (err: any) {
      toast.error("テーマの変更に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold mb-6" style={{ color: "#3D3226" }}>
        デザインテーマを選択
      </h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {THEME_LIST.map((theme) => {
          const isSelected = salon.theme_id === theme.id;
          return (
            <motion.button
              key={theme.id}
              whileHover={{ y: -2 }}
              onClick={() => handleSelectTheme(theme.id)}
              disabled={saving}
              className="text-left rounded-2xl overflow-hidden border-2 transition-all"
              style={{
                borderColor: isSelected ? theme.colors.primary : "#E8DFD0",
                boxShadow: isSelected ? `0 0 0 2px ${theme.colors.primary}` : "none",
              }}
            >
              {/* Theme Preview */}
              <div className="p-6" style={{ background: theme.colors.background }}>
                <div className="rounded-xl p-4 mb-3" style={{ background: theme.colors.surface, boxShadow: theme.shadow }}>
                  <div className="h-3 rounded-full mb-2 w-3/4" style={{ background: theme.colors.primary }} />
                  <div className="h-2 rounded-full mb-1.5 w-full" style={{ background: theme.colors.border }} />
                  <div className="h-2 rounded-full w-2/3" style={{ background: theme.colors.border }} />
                  <div className="mt-3 h-8 rounded-lg" style={{ background: theme.colors.primary }} />
                </div>
              </div>
              {/* Theme Info */}
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold" style={{ color: "#3D3226" }}>
                    {theme.nameJa}
                  </span>
                  {isSelected && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ background: theme.colors.primary }}
                    >
                      選択中
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "#8B7D6B" }}>
                  {theme.description}
                </p>
                {/* Color swatches */}
                <div className="flex gap-1.5 mt-3">
                  {[theme.colors.primary, theme.colors.primaryLight, theme.colors.secondary, theme.colors.accent, theme.colors.background].map((color, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border"
                      style={{ background: color, borderColor: "#E8DFD0" }}
                    />
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Lark Settings Tab ----------
function LarkSettingsTab({ salon, onUpdate }: { salon: Salon; onUpdate: (s: Salon) => void }) {
  const [form, setForm] = useState({
    larkAppId: salon.lark_app_id || "",
    larkAppSecret: salon.lark_app_secret || "",
    larkBitableAppToken: salon.lark_bitable_app_token || "",
    larkCustomerTableId: salon.lark_customer_table_id || "",
    larkMonthlyGoalTableId: salon.lark_monthly_goal_table_id || "",
    larkYearlyGoalTableId: salon.lark_yearly_goal_table_id || "",
    larkKarteTableId: salon.lark_karte_table_id || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.salons.update(salon.id, form);
      onUpdate({
        ...salon,
        lark_app_id: form.larkAppId,
        lark_app_secret: form.larkAppSecret,
        lark_bitable_app_token: form.larkBitableAppToken,
        lark_customer_table_id: form.larkCustomerTableId,
        lark_monthly_goal_table_id: form.larkMonthlyGoalTableId,
        lark_yearly_goal_table_id: form.larkYearlyGoalTableId,
        lark_karte_table_id: form.larkKarteTableId,
      });
      toast.success("Lark設定を保存しました");
    } catch (err: any) {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "larkAppId", label: "Lark App ID", placeholder: "cli_xxxxxxxxxx", hint: "Lark Open Platform > アプリ > App ID" },
    { key: "larkAppSecret", label: "Lark App Secret", placeholder: "xxxxxxxxxx", hint: "Lark Open Platform > アプリ > App Secret", type: "password" },
    { key: "larkBitableAppToken", label: "Bitable App Token", placeholder: "bascnxxxxxxxxxx", hint: "Bitable URL内のapp_tokenパラメータ" },
    { key: "larkCustomerTableId", label: "顧客テーブルID", placeholder: "tblxxxxxxxxxx", hint: "新規顧客データ用テーブル" },
    { key: "larkKarteTableId", label: "カルテテーブルID", placeholder: "tblxxxxxxxxxx", hint: "カルテデータ用テーブル" },
    { key: "larkMonthlyGoalTableId", label: "月間目標テーブルID", placeholder: "tblxxxxxxxxxx", hint: "月間目標データ用テーブル" },
    { key: "larkYearlyGoalTableId", label: "年間目標テーブルID", placeholder: "tblxxxxxxxxxx", hint: "年間目標データ用テーブル" },
  ];

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-bold mb-2" style={{ color: "#3D3226" }}>Lark API設定</h3>
      <p className="text-sm mb-6" style={{ color: "#8B7D6B" }}>
        Lark Open Platformで作成したアプリの認証情報と、Bitable（多次元表）のテーブルIDを入力してください。
      </p>

      <div className="space-y-5">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium mb-1" style={{ color: "#3D3226" }}>
              {field.label}
            </label>
            <input
              type={field.type || "text"}
              value={form[field.key as keyof typeof form]}
              onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full px-4 py-3 rounded-xl border transition-colors focus:outline-none"
              style={{ borderColor: "#D4C5A9", background: "#FFFFFF" }}
              onFocus={(e) => { e.target.style.borderColor = "#B8956A"; }}
              onBlur={(e) => { e.target.style.borderColor = "#D4C5A9"; }}
            />
            <p className="text-xs mt-1" style={{ color: "#8B7D6B" }}>{field.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          style={{ background: "#8B7355" }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          設定を保存
        </button>
      </div>
    </div>
  );
}

// ---------- Submissions Tab ----------
function SubmissionsTab({ salon }: { salon: Salon }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const data = await api.salons.submissions(salon.id, filterType || undefined);
        setSubmissions(data);
      } catch {
        toast.error("送信履歴の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [salon.id, filterType]);

  const formTypeLabels: Record<string, string> = {
    customer: "新規顧客", monthly_goal: "月間目標", yearly_goal: "年間目標", karte: "カルテ",
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h3 className="text-lg font-bold" style={{ color: "#3D3226" }}>送信履歴</h3>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setLoading(true); }}
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{ borderColor: "#D4C5A9" }}
        >
          <option value="">すべて</option>
          <option value="customer">新規顧客</option>
          <option value="karte">カルテ</option>
          <option value="monthly_goal">月間目標</option>
          <option value="yearly_goal">年間目標</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8B7355" }} />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12" style={{ color: "#8B7D6B" }}>
          送信データはまだありません
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub: any) => (
            <div
              key={sub.id}
              className="bg-white rounded-xl p-4 border"
              style={{ borderColor: "#E8DFD0" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: "#F5F0E8", color: "#8B7355" }}
                  >
                    {formTypeLabels[sub.form_type] || sub.form_type}
                  </span>
                  <span className="text-xs" style={{ color: "#8B7D6B" }}>
                    {new Date(sub.created_at).toLocaleString("ja-JP")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {sub.larkSynced ? (
                    <span className="text-xs flex items-center gap-1" style={{ color: "#6B8E6B" }}>
                      <Check className="w-3 h-3" /> Lark同期済
                    </span>
                  ) : (
                    <span className="text-xs flex items-center gap-1" style={{ color: "#C75050" }}>
                      <X className="w-3 h-3" /> 未同期
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: "#3D3226" }}>
                {Object.entries(sub.formData || {}).slice(0, 6).map(([k, v]) => (
                  <div key={k}>
                    <span style={{ color: "#8B7D6B" }}>{k}:</span> {String(v)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Create Salon Modal ----------
function CreateSalonModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (salon: Salon) => void;
}) {
  const [salonName, setSalonName] = useState("");
  const [slug, setSlug] = useState("");
  const [themeId, setThemeId] = useState("calmer");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!salonName.trim() || !slug.trim()) {
      toast.error("サロン名とスラッグは必須です");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error("スラッグは半角英数字とハイフンのみ使用できます");
      return;
    }

    setCreating(true);
    try {
      const result = await api.salons.create({ salonName, slug, themeId });
      const newSalon: Salon = {
        id: result.id,
        salon_name: salonName,
        slug,
        theme_id: themeId,
        logo_url: null,
        lark_app_id: null,
        lark_app_secret: null,
        lark_bitable_app_token: null,
        lark_customer_table_id: null,
        lark_monthly_goal_table_id: null,
        lark_yearly_goal_table_id: null,
        lark_karte_table_id: null,
      };
      onCreated(newSalon);
    } catch (err: any) {
      toast.error(err.message || "作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 w-full max-w-md mx-4"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <h3 className="text-xl font-bold mb-6" style={{ fontFamily: "'Noto Serif JP', serif", color: "#3D3226" }}>
          新しいサロンを作成
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#3D3226" }}>
              サロン名 <span style={{ color: "#C75050" }}>*</span>
            </label>
            <input
              type="text"
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder="例：Calmer Head Spa"
              className="w-full px-4 py-3 rounded-xl border focus:outline-none"
              style={{ borderColor: "#D4C5A9" }}
              onFocus={(e) => { e.target.style.borderColor = "#B8956A"; }}
              onBlur={(e) => { e.target.style.borderColor = "#D4C5A9"; }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#3D3226" }}>
              スラッグ（URL用） <span style={{ color: "#C75050" }}>*</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="例：calmer-headspa"
              className="w-full px-4 py-3 rounded-xl border focus:outline-none"
              style={{ borderColor: "#D4C5A9" }}
              onFocus={(e) => { e.target.style.borderColor = "#B8956A"; }}
              onBlur={(e) => { e.target.style.borderColor = "#D4C5A9"; }}
            />
            <p className="text-xs mt-1" style={{ color: "#8B7D6B" }}>
              フォームURL: /form/{slug || "your-slug"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#3D3226" }}>
              デザインテーマ
            </label>
            <div className="grid grid-cols-5 gap-2">
              {THEME_LIST.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all"
                  style={{
                    borderColor: themeId === t.id ? t.colors.primary : "#E8DFD0",
                  }}
                >
                  <div className="w-8 h-8 rounded-full" style={{ background: t.colors.primary }} />
                  <span className="text-[10px]" style={{ color: "#3D3226" }}>{t.nameJa}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border font-medium transition-colors"
            style={{ borderColor: "#E8DFD0", color: "#8B7D6B" }}
          >
            キャンセル
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 px-4 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#8B7355" }}
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            作成
          </button>
        </div>
      </motion.div>
    </div>
  );
}
