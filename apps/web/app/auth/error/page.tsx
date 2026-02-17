import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const messages: Record<string, string> = {
    Configuration: "The server is not configured for authentication. Contact the administrator.",
    AccessDenied: "Access was denied. You may not have permission to sign in.",
    Verification: "The verification link has expired or has already been used.",
  };

  const message = messages[error ?? ""] ?? "An unexpected authentication error occurred.";

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 px-6">
      <h1 className="text-2xl font-bold text-red-400">Authentication Error</h1>
      <p className="text-zinc-400 text-center max-w-md">{message}</p>
      <Link
        href="/auth/signin"
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-200 border border-zinc-700"
      >
        Try again
      </Link>
    </div>
  );
}
