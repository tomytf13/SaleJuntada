import { AnimatePresence, m } from "framer-motion";
import { quickTransition, springTransition } from "../motion/config";

export function AnimatedToast({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message ? (
        <m.div
          className="toast"
          role="status"
          initial={{ opacity: 0, y: 18, x: "-50%", scale: 0.96 }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
          exit={{ opacity: 0, y: 10, x: "-50%", scale: 0.98 }}
          transition={message ? springTransition : quickTransition}
        >
          {message}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
