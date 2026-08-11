import type { Transition, Variants } from "framer-motion";

export const quickTransition = {
  duration: 0.16,
  ease: [0.22, 1, 0.36, 1],
} satisfies Transition;

export const standardTransition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
} satisfies Transition;

export const springTransition = {
  type: "spring",
  stiffness: 390,
  damping: 32,
  mass: 0.82,
} satisfies Transition;

export const sheetVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(5px)" },
  visible: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(3px)" },
};

export const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: standardTransition },
  exit: { opacity: 0, y: -6, transition: quickTransition },
};
