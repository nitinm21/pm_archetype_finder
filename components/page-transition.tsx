"use client";

import { motion, useReducedMotion } from "framer-motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.main
      id="main-content"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0.14 : 0.46, ease: [0.2, 0.78, 0.2, 1] }}
      className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-10"
    >
      {children}
    </motion.main>
  );
}
