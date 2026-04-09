import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

export function Modal({ open, onClose, title, description, children }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-card max-h-[90vh] w-full max-w-3xl overflow-auto p-6"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="section-title">Generated Output</div>
                <h3 className="mt-1 text-xl font-semibold text-ink">{title}</h3>
                {description ? <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p> : null}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
