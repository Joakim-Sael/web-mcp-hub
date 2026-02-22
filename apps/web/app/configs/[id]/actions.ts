"use server";

import { auth } from "@/lib/auth";
import { upsertToolVote, getConfigById, deleteToolFromConfig } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function voteOnTool(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const configId = formData.get("configId") as string;
  const toolName = formData.get("toolName") as string;
  const vote = Number(formData.get("vote"));

  if (!configId) {
    return { error: "Config ID is required" };
  }
  if (!toolName) {
    return { error: "Tool name is required" };
  }
  if (vote !== 1 && vote !== -1) {
    return { error: "Vote must be 1 or -1" };
  }

  await upsertToolVote(session.user.id, configId, toolName, vote);

  const config = await getConfigById(configId);
  revalidatePath(`/configs/${configId}`);
  if (config) {
    revalidatePath(`/domains/${config.domain}`);
  }
  return {};
}

export async function deleteToolAction(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const configId = formData.get("configId") as string;
  const toolName = formData.get("toolName") as string;

  if (!configId) return { error: "Config ID is required" };
  if (!toolName) return { error: "Tool name is required" };

  const config = await getConfigById(configId);
  if (!config) return { error: "Config not found" };

  if (config.contributor !== session.user.name) {
    return { error: "Only the config owner can delete tools" };
  }

  await deleteToolFromConfig(configId, toolName);

  revalidatePath(`/configs/${configId}`);
  revalidatePath(`/domains/${config.domain}`);
  return {};
}
