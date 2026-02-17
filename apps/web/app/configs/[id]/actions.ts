"use server";

import { auth } from "@/lib/auth";
import { upsertToolVote } from "@/lib/db";
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
  revalidatePath(`/configs/${configId}`);
  return {};
}
