"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { getDb, apiKeys } from "@web-mcp-hub/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createApiKey(formData: FormData): Promise<{ key?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const label = formData.get("label") as string;
  if (!label || label.trim().length === 0) {
    return { error: "Label is required" };
  }

  const rawBytes = randomBytes(30);
  const randomPart = rawBytes.toString("base64url").slice(0, 40);
  const plaintext = `whub_${randomPart}`;
  const prefix = plaintext.slice(0, 17); // "whub_" + 12 chars
  const hash = await bcrypt.hash(plaintext, 10);

  const db = getDb();
  await db.insert(apiKeys).values({
    userId: session.user.id,
    keyHash: hash,
    keyPrefix: prefix,
    label: label.trim(),
  });

  revalidatePath("/settings");
  return { key: plaintext };
}

export async function deleteApiKey(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const keyId = formData.get("keyId") as string;
  if (!keyId) {
    return { error: "Key ID is required" };
  }

  const db = getDb();
  await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, session.user.id)));

  revalidatePath("/settings");
  return {};
}
