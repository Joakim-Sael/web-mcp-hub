import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/settings");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 px-6">
      <h1 className="text-2xl font-bold">Sign in to WebMCP Hub</h1>
      <p className="text-zinc-400 text-center max-w-md">
        Sign in to create API keys for the MCP server and manage your configurations.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("github");
        }}
      >
        <button
          type="submit"
          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-100 border border-zinc-700 font-medium"
        >
          Sign in with GitHub
        </button>
      </form>
    </div>
  );
}
