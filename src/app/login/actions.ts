"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin") || "/admin";

  const user = await authenticate(email, password);
  if (!user) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  await createSession(user);
  await audit(user, "LOGIN", "User", user.id);
  redirect(next.startsWith("/") ? next : "/admin");
}

export async function logoutAction() {
  destroySession();
  redirect("/login");
}
