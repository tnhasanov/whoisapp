import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/brand";
import { LanguagePicker } from "@/components/auth/language-picker";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <BrandWordmark />
        <LanguagePicker />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
