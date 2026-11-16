import { Logo, Ornament } from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata = { title: "تسجيل الدخول — جواهر النخيل" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div
          className="absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: "url(/logo-light.png)",
            backgroundSize: "220px",
            backgroundRepeat: "repeat",
            transform: "rotate(-8deg) scale(1.3)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col items-center text-paper">
          <Logo variant="light" size={260} />
          <Ornament tone="light" className="mt-10 w-72" />
          <p className="mt-4 font-display text-2xl text-paper/80">لتغليف وتشكيل التمور</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Logo size={130} />
          </div>
          <h1 className="font-display text-4xl text-ink">أهلاً بك</h1>
          <p className="mt-2 text-ink-mute">سجّل الدخول للوصول إلى نقطة البيع ولوحة الإدارة</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
