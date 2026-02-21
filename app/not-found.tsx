import Link from "next/link";
import { PageTransition } from "@/components/page-transition";

export default function NotFound() {
  return (
    <PageTransition>
      <section className="surface-card mx-auto mt-24 max-w-xl p-8 text-center">
        <h1 className="text-4xl tracking-tight sm:text-5xl">Page not found</h1>
        <p className="mt-3 text-sm text-textSecondary sm:text-base">
          The route you requested does not exist in PM Persona Studio.
        </p>
        <Link href="/" className="primary-button mt-6 inline-flex items-center justify-center">
          Return home
        </Link>
      </section>
    </PageTransition>
  );
}
