import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface SubmissionListProps {
  salonId: number;
}

const FORM_TYPE_LABELS: Record<string, string> = {
  customer: "新規顧客情報",
  karte: "カルテデータ",
  monthly_goal: "月間目標",
  yearly_goal: "年間目標",
};

export default function SubmissionList({ salonId }: SubmissionListProps) {
  const [formTypeFilter, setFormTypeFilter] = useState<string>("all");

  const submissionsQuery = trpc.salon.submissions.useQuery({
    salonId,
    formType: formTypeFilter === "all" ? undefined : formTypeFilter,
  });

  const submissions = submissionsQuery.data || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">送信履歴</CardTitle>
            <CardDescription>
              フォームから送信されたデータの一覧です
            </CardDescription>
          </div>
          <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="フォーム種別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="customer">新規顧客情報</SelectItem>
              <SelectItem value="karte">カルテデータ</SelectItem>
              <SelectItem value="monthly_goal">月間目標</SelectItem>
              <SelectItem value="yearly_goal">年間目標</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {submissionsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              まだ送信データがありません
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub: any) => (
              <div
                key={sub.id}
                className="p-4 rounded-lg border border-border bg-muted/20"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {FORM_TYPE_LABELS[sub.formType] || sub.formType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(sub.createdAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {sub.larkSynced ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-600">Lark同期済</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-amber-600">未同期</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(
                    (typeof sub.formData === "string"
                      ? JSON.parse(sub.formData)
                      : sub.formData) || {}
                  ).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="text-muted-foreground">{key}: </span>
                      <span className="text-foreground font-medium">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
                {sub.syncError && (
                  <p className="text-xs text-destructive mt-2">
                    エラー: {sub.syncError}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
