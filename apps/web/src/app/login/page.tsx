import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <main className="min-h-screen bg-white px-4 py-12 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <Suspense
          fallback={
            <div className="flex w-full items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              Carregando acesso...
            </div>
          }
        >
          <LoginForm demoMode={demoMode} />
        </Suspense>
      </div>
    </main>
  );
}
