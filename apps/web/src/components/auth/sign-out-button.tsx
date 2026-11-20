"use client";

import { Button } from "@app/ui";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Signs out. `iconOnly` keeps "Sign out" as the accessible name and shows it as a tooltip. */
export function SignOutButton(props: { iconOnly?: boolean; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (props.iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={signOut}
        disabled={pending}
        title="Sign out"
        className={props.className}
      >
        <LogOut />
        <span className="sr-only">Sign out</span>
      </Button>
    );
  }

  return (
    <Button variant="secondary" onClick={signOut} disabled={pending} className={props.className}>
      <LogOut />
      Sign out
    </Button>
  );
}
