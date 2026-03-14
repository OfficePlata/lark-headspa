import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Salon settings - each salon (agency) has their own Lark API config and design theme
 */
export const salons = mysqlTable("salons", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Salon display name */
  salonName: varchar("salonName", { length: 255 }).notNull(),
  /** Unique slug for public form URL */
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  /** Selected design theme */
  themeId: varchar("themeId", { length: 50 }).notNull().default("calmer"),
  /** Lark App ID */
  larkAppId: varchar("larkAppId", { length: 255 }),
  /** Lark App Secret */
  larkAppSecret: varchar("larkAppSecret", { length: 255 }),
  /** Lark Bitable App Token */
  larkBitableAppToken: varchar("larkBitableAppToken", { length: 255 }),
  /** Lark Bitable Table ID for customer data */
  larkCustomerTableId: varchar("larkCustomerTableId", { length: 255 }),
  /** Lark Bitable Table ID for monthly goals */
  larkMonthlyGoalTableId: varchar("larkMonthlyGoalTableId", { length: 255 }),
  /** Lark Bitable Table ID for yearly goals */
  larkYearlyGoalTableId: varchar("larkYearlyGoalTableId", { length: 255 }),
  /** Lark Bitable Table ID for karte (treatment records) */
  larkKarteTableId: varchar("larkKarteTableId", { length: 255 }),
  /** Custom logo URL */
  logoUrl: text("logoUrl"),
  /** Whether the salon is active */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Salon = typeof salons.$inferSelect;
export type InsertSalon = typeof salons.$inferInsert;

/**
 * Form field configuration - defines which fields appear in each form type
 */
export const formFields = mysqlTable("formFields", {
  id: int("id").autoincrement().primaryKey(),
  salonId: int("salonId").notNull(),
  /** Form type: customer, monthly_goal, yearly_goal, karte */
  formType: varchar("formType", { length: 50 }).notNull(),
  /** Field name (maps to Lark Bitable field) */
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  /** Display label in Japanese */
  fieldLabel: varchar("fieldLabel", { length: 255 }).notNull(),
  /** Field type: text, number, date, select, textarea */
  fieldType: varchar("fieldType", { length: 50 }).notNull(),
  /** Options for select fields (JSON array) */
  options: json("options"),
  /** Placeholder text */
  placeholder: varchar("placeholder", { length: 255 }),
  /** Whether the field is required */
  isRequired: boolean("isRequired").default(true).notNull(),
  /** Display order */
  sortOrder: int("sortOrder").default(0).notNull(),
  /** Whether the field is active */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FormField = typeof formFields.$inferSelect;
export type InsertFormField = typeof formFields.$inferInsert;

/**
 * Form submission log - tracks all form submissions
 */
export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  salonId: int("salonId").notNull(),
  /** Form type: customer, monthly_goal, yearly_goal, karte */
  formType: varchar("formType", { length: 50 }).notNull(),
  /** Submitted data (JSON) */
  formData: json("formData").notNull(),
  /** Whether it was synced to Lark */
  larkSynced: boolean("larkSynced").default(false).notNull(),
  /** Lark record ID if synced */
  larkRecordId: varchar("larkRecordId", { length: 255 }),
  /** Error message if sync failed */
  syncError: text("syncError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;
