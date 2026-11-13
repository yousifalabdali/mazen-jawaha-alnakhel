import { requireAdmin } from "@/lib/auth";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <AdminNav name={profile.full_name} />
      <main className="min-w-0 px-5 py-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
