"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";

export function SignInButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="text-sm px-3 py-1.5 text-zinc-500">
        Loading...
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {session.user.image && (
          <Image src={session.user.image} alt="" width={28} height={28} className="rounded-full" />
        )}
        <span className="text-sm text-zinc-300">{session.user.name}</span>
        <a href="/settings" className="text-sm text-zinc-400 hover:text-zinc-200">
          Settings
        </a>
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("github")}
      className="text-sm px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-200 border border-zinc-700"
    >
      Sign in with GitHub
    </button>
  );
}
