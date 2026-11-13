import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function Home() {
  const p = await getProfile();
  if (!p || !p.is_active) redirect("/login");
  redirect(p.role === "admin" ? "/admin" : "/pos");
}
