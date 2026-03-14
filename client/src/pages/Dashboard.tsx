import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Settings,
  Palette,
  Link as LinkIcon,
  FileText,
  LogOut,
  Store,
  ExternalLink,
  Copy,
  CheckCircle2,
} from "lucide-react";
import ThemeSelector from "@/components/ThemeSelector";
import SalonSettings from "@/components/SalonSettings";
import SubmissionList from "@/components/SubmissionList";

export default function Dashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSalonName, setNewSalonName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedSalonId, setSelectedSalonId] = useState<number | null>(null);

  const salonsQuery = trpc.salon.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createSalonMutation = trpc.salon.create.useMutation({
    onSuccess: () => {
      salonsQuery.refetch();
      setShowCreateForm(false);
      setNewSalonName("");
      setNewSlug("");
      toast.success("サロンが作成されました");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">管理画面</CardTitle>
            <CardDescription>ログインしてサロンを管理してください</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
            >
              ログイン
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const salons = salonsQuery.data || [];
  const selectedSalon = salons.find((s) => s.id === selectedSalonId);

  const handleCreateSalon = () => {
    if (!newSalonName || !newSlug) {
      toast.error("サロン名とスラッグを入力してください");
      return;
    }
    createSalonMutation.mutate({
      salonName: newSalonName,
      slug: newSlug,
    });
  };

  const copyFormUrl = (slug: string, formType: string) => {
    const url = `${window.location.origin}/form/${slug}?type=${formType}`;
    navigator.clipboard.writeText(url);
    toast.success("URLをコピーしました");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              サロンフォーム管理
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.name || user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-1" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Salon list */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                サロン一覧
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {showCreateForm && (
              <Card className="mb-4">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs">サロン名</Label>
                    <Input
                      value={newSalonName}
                      onChange={(e) => setNewSalonName(e.target.value)}
                      placeholder="例: カルメ宮崎店"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">スラッグ（URL用）</Label>
                    <Input
                      value={newSlug}
                      onChange={(e) =>
                        setNewSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "")
                        )
                      }
                      placeholder="例: calmer-miyazaki"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreateSalon}
                      disabled={createSalonMutation.isPending}
                      className="flex-1"
                    >
                      {createSalonMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "作成"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                    >
                      キャンセル
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {salons.map((salon) => (
                <button
                  key={salon.id}
                  onClick={() => setSelectedSalonId(salon.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all border ${
                    selectedSalonId === salon.id
                      ? "bg-primary/10 border-primary/30"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                >
                  <p className="font-medium text-sm text-foreground">
                    {salon.salonName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    /{salon.slug}
                  </p>
                </button>
              ))}
              {salons.length === 0 && !showCreateForm && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  サロンがありません。<br />
                  「+」ボタンで作成してください。
                </p>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            {selectedSalon ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                      {selectedSalon.salonName}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      スラッグ: /{selectedSalon.slug}
                    </p>
                  </div>
                </div>

                <Tabs defaultValue="forms" className="space-y-6">
                  <TabsList>
                    <TabsTrigger value="forms" className="gap-1.5">
                      <LinkIcon className="h-4 w-4" />
                      フォームURL
                    </TabsTrigger>
                    <TabsTrigger value="theme" className="gap-1.5">
                      <Palette className="h-4 w-4" />
                      デザイン
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-1.5">
                      <Settings className="h-4 w-4" />
                      Lark設定
                    </TabsTrigger>
                    <TabsTrigger value="submissions" className="gap-1.5">
                      <FileText className="h-4 w-4" />
                      送信履歴
                    </TabsTrigger>
                  </TabsList>

                  {/* Form URLs tab */}
                  <TabsContent value="forms">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">フォームURL一覧</CardTitle>
                        <CardDescription>
                          各フォームのURLをコピーして、お客様やスタッフに共有してください
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { type: "customer", label: "新規顧客情報入力フォーム", icon: "👤" },
                          { type: "karte", label: "顧客管理情報入力フォーム", icon: "📋" },
                          { type: "monthly_goal", label: "月間目標入力フォーム", icon: "📊" },
                          { type: "yearly_goal", label: "年間目標入力フォーム", icon: "🎯" },
                        ].map((form) => (
                          <div
                            key={form.type}
                            className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{form.icon}</span>
                              <div>
                                <p className="font-medium text-sm text-foreground">
                                  {form.label}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  /form/{selectedSalon.slug}?type={form.type}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyFormUrl(selectedSalon.slug, form.type)
                                }
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                コピー
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  window.open(
                                    `/form/${selectedSalon.slug}?type=${form.type}`,
                                    "_blank"
                                  )
                                }
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                開く
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Theme tab */}
                  <TabsContent value="theme">
                    <ThemeSelector
                      salonId={selectedSalon.id}
                      currentThemeId={selectedSalon.themeId}
                      onThemeChanged={() => salonsQuery.refetch()}
                    />
                  </TabsContent>

                  {/* Settings tab */}
                  <TabsContent value="settings">
                    <SalonSettings
                      salon={selectedSalon}
                      onSaved={() => salonsQuery.refetch()}
                    />
                  </TabsContent>

                  {/* Submissions tab */}
                  <TabsContent value="submissions">
                    <SubmissionList salonId={selectedSalon.id} />
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                  <p className="text-muted-foreground">
                    左のサロン一覧からサロンを選択してください
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
