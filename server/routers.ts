import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createSalon,
  getSalonsByUserId,
  getSalonBySlug,
  getSalonById,
  updateSalon,
  getFormFields,
  upsertFormFields,
  createSubmission,
  updateSubmissionSync,
  getSubmissions,
} from "./db";
import {
  createBitableRecord,
  mapFormDataToLarkFields,
} from "./lark";
import { notifyOwner } from "./_core/notification";
import {
  THEME_LIST,
  getTheme,
  DEFAULT_FORM_CONFIGS,
  FORM_TYPES,
} from "../shared/themes";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ Theme Routes (Public) ============
  themes: router({
    list: publicProcedure.query(() => {
      return THEME_LIST.map((t) => ({
        id: t.id,
        name: t.name,
        nameJa: t.nameJa,
        description: t.description,
        colors: t.colors,
        fonts: t.fonts,
        borderRadius: t.borderRadius,
      }));
    }),
    get: publicProcedure
      .input(z.object({ themeId: z.string() }))
      .query(({ input }) => {
        return getTheme(input.themeId);
      }),
  }),

  // ============ Salon Management (Protected) ============
  salon: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getSalonsByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          salonName: z.string().min(1),
          slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
          themeId: z.string().default("calmer"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getSalonBySlug(input.slug);
        if (existing) {
          throw new Error("このスラッグは既に使用されています");
        }
        const id = await createSalon({
          userId: ctx.user.id,
          salonName: input.salonName,
          slug: input.slug,
          themeId: input.themeId,
        });

        // Create default form fields for all form types
        for (const formType of FORM_TYPES) {
          const config = DEFAULT_FORM_CONFIGS[formType];
          await upsertFormFields(
            id,
            formType,
            config.fields.map((f, i) => ({
              fieldName: f.fieldName,
              fieldLabel: f.fieldLabel,
              fieldType: f.fieldType,
              options: ('options' in f ? f.options : null) as unknown,
              placeholder: f.placeholder || null,
              isRequired: f.isRequired ?? true,
              sortOrder: i,
              isActive: true,
            }))
          );
        }

        return { id };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const salon = await getSalonById(input.id);
        if (!salon || salon.userId !== ctx.user.id) {
          throw new Error("サロンが見つかりません");
        }
        return salon;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          salonName: z.string().optional(),
          themeId: z.string().optional(),
          larkAppId: z.string().optional(),
          larkAppSecret: z.string().optional(),
          larkBitableAppToken: z.string().optional(),
          larkCustomerTableId: z.string().optional(),
          larkMonthlyGoalTableId: z.string().optional(),
          larkYearlyGoalTableId: z.string().optional(),
          larkKarteTableId: z.string().optional(),
          logoUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const salon = await getSalonById(input.id);
        if (!salon || salon.userId !== ctx.user.id) {
          throw new Error("サロンが見つかりません");
        }
        const { id, ...data } = input;
        // Remove undefined values
        const cleanData = Object.fromEntries(
          Object.entries(data).filter(([_, v]) => v !== undefined)
        );
        await updateSalon(id, cleanData);
        return { success: true };
      }),

    submissions: protectedProcedure
      .input(
        z.object({
          salonId: z.number(),
          formType: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const salon = await getSalonById(input.salonId);
        if (!salon || salon.userId !== ctx.user.id) {
          throw new Error("サロンが見つかりません");
        }
        return getSubmissions(input.salonId, input.formType);
      }),
  }),

  // ============ Public Form Routes ============
  form: router({
    /** Get salon info and form config by slug (public) */
    getBySlug: publicProcedure
      .input(
        z.object({
          slug: z.string(),
          formType: z.string(),
        })
      )
      .query(async ({ input }) => {
        const salon = await getSalonBySlug(input.slug);
        if (!salon || !salon.isActive) {
          return null;
        }
        const fields = await getFormFields(salon.id, input.formType);
        const theme = getTheme(salon.themeId);
        const formConfig =
          DEFAULT_FORM_CONFIGS[input.formType as keyof typeof DEFAULT_FORM_CONFIGS];

        return {
          salon: {
            id: salon.id,
            salonName: salon.salonName,
            slug: salon.slug,
            logoUrl: salon.logoUrl,
          },
          theme,
          formTitle: formConfig?.title || "入力フォーム",
          fields:
            fields.length > 0
              ? fields
              : (formConfig?.fields || []).map((f, i) => ({
                  id: i,
                  salonId: salon.id,
                  formType: input.formType,
                  fieldName: f.fieldName,
                  fieldLabel: f.fieldLabel,
                  fieldType: f.fieldType,
                  options: ('options' in f ? f.options : null) as unknown,
                  placeholder: f.placeholder || null,
                  isRequired: f.isRequired ?? true,
                  sortOrder: i,
                  isActive: true,
                  createdAt: new Date(),
                })),
        };
      }),

    /** Submit form data (public) */
    submit: publicProcedure
      .input(
        z.object({
          slug: z.string(),
          formType: z.string(),
          formData: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(async ({ input }) => {
        const salon = await getSalonBySlug(input.slug);
        if (!salon || !salon.isActive) {
          throw new Error("サロンが見つかりません");
        }

        // Save submission to database
        const submissionId = await createSubmission({
          salonId: salon.id,
          formType: input.formType,
          formData: input.formData,
          larkSynced: false,
        });

        // Try to sync to Lark Bitable
        let larkSynced = false;
        let larkRecordId: string | undefined;
        let syncError: string | undefined;

        const tableIdMap: Record<string, string | null> = {
          customer: salon.larkCustomerTableId,
          monthly_goal: salon.larkMonthlyGoalTableId,
          yearly_goal: salon.larkYearlyGoalTableId,
          karte: salon.larkKarteTableId,
        };

        const tableId = tableIdMap[input.formType];

        if (
          salon.larkAppId &&
          salon.larkAppSecret &&
          salon.larkBitableAppToken &&
          tableId
        ) {
          try {
            const larkFields = mapFormDataToLarkFields(
              input.formData as Record<string, unknown>
            );
            const result = await createBitableRecord(
              salon.larkAppId,
              salon.larkAppSecret,
              salon.larkBitableAppToken,
              tableId,
              larkFields
            );
            larkSynced = true;
            larkRecordId = result.recordId;
          } catch (err: any) {
            syncError = err.message || "Lark sync failed";
            console.error("[Lark Sync Error]", syncError);
          }
        } else {
          syncError = "Lark API credentials not configured";
        }

        // Update submission with sync status
        await updateSubmissionSync(
          submissionId,
          larkSynced,
          larkRecordId,
          syncError
        );

        // Notify owner
        try {
      const formConfig2 =
          DEFAULT_FORM_CONFIGS[
              input.formType as keyof typeof DEFAULT_FORM_CONFIGS
            ];
          await notifyOwner({
            title: `新しいフォーム送信: ${salon.salonName} - ${formConfig2?.title || input.formType}`,
            content: `サロン「${salon.salonName}」から${formConfig2?.title || input.formType}が送信されました。\nLark同期: ${larkSynced ? "成功" : "未同期"}\n${syncError ? `エラー: ${syncError}` : ""}`,
          });
        } catch (e) {
          console.error("[Notification Error]", e);
        }

        return {
          success: true,
          submissionId,
          larkSynced,
          syncError: syncError || null,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
