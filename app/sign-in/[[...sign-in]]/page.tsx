import { SignIn } from "@clerk/nextjs";
import { GraduationCap, Sparkles } from "lucide-react";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#e9efff_0%,#f5f7fb_48%)] px-4 py-10">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_auto]">
        <section className="hidden max-w-lg lg:block">
          <span className="mb-6 grid size-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <GraduationCap className="size-7" />
          </span>
          <p className="eyebrow">Lumina Study</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-.04em] text-navy">
            Seus materiais viram aprendizado de verdade.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Entre para continuar seus quizzes, revisões e conversas com a Lumina.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Sparkles className="size-4" /> Seu progresso fica salvo com segurança
          </div>
        </section>
        <SignIn fallbackRedirectUrl="/" />
      </div>
    </main>
  );
}
