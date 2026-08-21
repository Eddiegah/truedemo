"use client";

import { motion } from "framer-motion";

// template.tsx re-mounts on every navigation (unlike layout.tsx, which
// persists) - exactly the hook needed for a per-route fade transition
// without re-mounting the header/session provider above it.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
