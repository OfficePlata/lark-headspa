import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Key, Database, Info } from "lucide-react";
import type { Salon } from "../../../drizzle/schema";

interface SalonSettingsProps {
  salon: Salon;
  onSaved: () => void;
}

export default function SalonSettings({ salon, onSaved }: SalonSettingsProps) {
  const [form, setForm] = useState({
    salonName: salon.salonName,
    larkAppId: salon.larkAppId || "",
    larkAppSecret: salon.larkAppSecret || "",
    larkBitableAppToken: salon.larkBitableAppToken || "",
    larkCustomerTableId: salon.larkCustomerTableId || "",
    larkMonthlyGoalTableId: salon.larkMonthlyGoalTableId || "",
    larkYearlyGoalTableId: salon.larkYearlyGoalTableId || "",
    larkKarteTableId: salon.larkKarteTableId || "",
  });

  useEffect(() => {
    setForm({
      salonName: salon.salonName,
      larkAppId: salon.larkAppId || "",
      larkAppSecret: salon.larkAppSecret || "",
      larkBitableAppToken: salon.larkBitableAppToken || "",
      larkCustomerTableId: salon.larkCustomerTableId || "",
      larkMonthlyGoalTableId: salon.larkMonthlyGoalTableId || "",
      larkYearlyGoalTableId: salon.larkYearlyGoalTableId || "",
      larkKarteTableId: salon.larkKarteTableId || "",
    });
  }, [salon]);

  const updateMutation = trpc.salon.update.useMutation({
    onSuccess: () => {
      onSaved();
      toast.success("設定を保存しました");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: salon.id,
      ...form,
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            基本設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>サロン名</Label>
            <Input
              value={form.salonName}
              onChange={(e) => setForm({ ...form, salonName: e.target.value })}
              placeholder="サロン名を入力"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lark API settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Lark API設定
          </CardTitle>
          <CardDescription>
            Lark Open Platformで作成したアプリのApp IDとApp Secretを入力してください。
            フォーム送信データがLark BASEに自動保存されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>1. <a href="https://open.larksuite.com" target="_blank" rel="noopener" className="text-primary underline">Lark Open Platform</a> でアプリを作成</p>
                <p>2. App ID と App Secret を取得</p>
                <p>3. Bitable の権限を有効化（bitable:app, bitable:record）</p>
                <p>4. 対象のBASEテーブルのApp TokenとTable IDを取得</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>App ID</Label>
              <Input
                value={form.larkAppId}
                onChange={(e) => setForm({ ...form, larkAppId: e.target.value })}
                placeholder="cli_xxxxxxxxxx"
                type="password"
              />
            </div>
            <div>
              <Label>App Secret</Label>
              <Input
                value={form.larkAppSecret}
                onChange={(e) => setForm({ ...form, larkAppSecret: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxx"
                type="password"
              />
            </div>
          </div>

          <div>
            <Label>Bitable App Token</Label>
            <Input
              value={form.larkBitableAppToken}
              onChange={(e) => setForm({ ...form, larkBitableAppToken: e.target.value })}
              placeholder="bascnxxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground mt-1">
              BASEのURLから取得: https://xxx.larksuite.com/base/<strong>bascnxxxxxxxxxx</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">テーブルID設定</CardTitle>
          <CardDescription>
            各フォームに対応するLark BASEのテーブルIDを設定してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>顧客データ テーブルID</Label>
            <Input
              value={form.larkCustomerTableId}
              onChange={(e) => setForm({ ...form, larkCustomerTableId: e.target.value })}
              placeholder="tblxxxxxxxxxx"
            />
          </div>
          <div>
            <Label>カルテデータ テーブルID</Label>
            <Input
              value={form.larkKarteTableId}
              onChange={(e) => setForm({ ...form, larkKarteTableId: e.target.value })}
              placeholder="tblxxxxxxxxxx"
            />
          </div>
          <div>
            <Label>月間目標 テーブルID</Label>
            <Input
              value={form.larkMonthlyGoalTableId}
              onChange={(e) => setForm({ ...form, larkMonthlyGoalTableId: e.target.value })}
              placeholder="tblxxxxxxxxxx"
            />
          </div>
          <div>
            <Label>年間目標 テーブルID</Label>
            <Input
              value={form.larkYearlyGoalTableId}
              onChange={(e) => setForm({ ...form, larkYearlyGoalTableId: e.target.value })}
              placeholder="tblxxxxxxxxxx"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="px-8"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          設定を保存
        </Button>
      </div>
    </div>
  );
}
