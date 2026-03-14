import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

interface ThemeSelectorProps {
  salonId: number;
  currentThemeId: string;
  onThemeChanged: () => void;
}

export default function ThemeSelector({
  salonId,
  currentThemeId,
  onThemeChanged,
}: ThemeSelectorProps) {
  const themesQuery = trpc.themes.list.useQuery();
  const updateMutation = trpc.salon.update.useMutation({
    onSuccess: () => {
      onThemeChanged();
      toast.success("デザインテーマを変更しました");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const themes = themesQuery.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">デザインテーマ選択</CardTitle>
        <CardDescription>
          サロンのフォームに適用するデザインテーマを選択してください。
          選択したテーマは全てのフォームに反映されます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {themes.map((theme) => {
            const isSelected = theme.id === currentThemeId;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  if (!isSelected) {
                    updateMutation.mutate({ id: salonId, themeId: theme.id });
                  }
                }}
                disabled={updateMutation.isPending}
                className={`relative text-left rounded-xl overflow-hidden border-2 transition-all hover:shadow-md ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {/* Theme preview */}
                <div
                  className="p-4 h-40"
                  style={{ background: theme.colors.background }}
                >
                  {/* Mini form preview */}
                  <div
                    className="rounded-lg p-3 h-full"
                    style={{
                      background: theme.colors.surface,
                      boxShadow: `0 2px 8px ${theme.colors.primary}15`,
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    {/* Header bar */}
                    <div
                      className="h-1 rounded-full mb-3 w-16"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
                      }}
                    />
                    {/* Title */}
                    <div
                      className="h-3 rounded w-24 mb-3"
                      style={{ background: theme.colors.text + "30" }}
                    />
                    {/* Input fields */}
                    <div className="space-y-2">
                      <div
                        className="h-6 rounded"
                        style={{
                          border: `1px solid ${theme.colors.inputBorder}`,
                          background: theme.colors.inputBg,
                        }}
                      />
                      <div
                        className="h-6 rounded"
                        style={{
                          border: `1px solid ${theme.colors.inputBorder}`,
                          background: theme.colors.inputBg,
                        }}
                      />
                    </div>
                    {/* Button */}
                    <div
                      className="h-5 rounded mt-3 w-16 mx-auto"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                      }}
                    />
                  </div>
                </div>

                {/* Theme info */}
                <div className="p-3 bg-card border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {theme.nameJa}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {theme.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                  {/* Color swatches */}
                  <div className="flex gap-1 mt-2">
                    {[
                      theme.colors.primary,
                      theme.colors.accent,
                      theme.colors.secondary,
                      theme.colors.background,
                    ].map((color, i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Loading overlay */}
                {updateMutation.isPending && !isSelected && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
