import { eq, and, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  salons,
  InsertSalon,
  Salon,
  formFields,
  InsertFormField,
  FormField,
  submissions,
  InsertSubmission,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Queries ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Salon Queries ============

export async function createSalon(data: InsertSalon): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(salons).values(data);
  return result[0].insertId;
}

export async function getSalonsByUserId(userId: number): Promise<Salon[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salons).where(eq(salons.userId, userId));
}

export async function getSalonBySlug(slug: string): Promise<Salon | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(salons).where(eq(salons.slug, slug)).limit(1);
  return result[0];
}

export async function getSalonById(id: number): Promise<Salon | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(salons).where(eq(salons.id, id)).limit(1);
  return result[0];
}

export async function updateSalon(
  id: number,
  data: Partial<Omit<InsertSalon, "id" | "createdAt">>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(salons).set(data).where(eq(salons.id, id));
}

// ============ Form Field Queries ============

export async function getFormFields(
  salonId: number,
  formType: string
): Promise<FormField[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(formFields)
    .where(
      and(
        eq(formFields.salonId, salonId),
        eq(formFields.formType, formType),
        eq(formFields.isActive, true)
      )
    )
    .orderBy(asc(formFields.sortOrder));
}

export async function upsertFormFields(
  salonId: number,
  formType: string,
  fields: Omit<InsertFormField, "id" | "salonId" | "formType" | "createdAt">[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Deactivate existing fields
  await db
    .update(formFields)
    .set({ isActive: false })
    .where(
      and(eq(formFields.salonId, salonId), eq(formFields.formType, formType))
    );

  // Insert new fields
  if (fields.length > 0) {
    const values = fields.map((f, i) => ({
      ...f,
      salonId,
      formType,
      sortOrder: f.sortOrder ?? i,
      isRequired: f.isRequired ?? true,
      isActive: true,
    }));
    await db.insert(formFields).values(values);
  }
}

// ============ Submission Queries ============

export async function createSubmission(data: InsertSubmission): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(submissions).values(data);
  return result[0].insertId;
}

export async function updateSubmissionSync(
  id: number,
  larkSynced: boolean,
  larkRecordId?: string,
  syncError?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(submissions)
    .set({ larkSynced, larkRecordId: larkRecordId ?? null, syncError: syncError ?? null })
    .where(eq(submissions.id, id));
}

export async function getSubmissions(
  salonId: number,
  formType?: string
): Promise<typeof submissions.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(submissions.salonId, salonId)];
  if (formType) {
    conditions.push(eq(submissions.formType, formType));
  }
  return db
    .select()
    .from(submissions)
    .where(and(...conditions))
    .orderBy(asc(submissions.createdAt));
}
