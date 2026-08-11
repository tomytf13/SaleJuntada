import type { PropsWithChildren } from "react";
import {
  domAnimation,
  LazyMotion,
  MotionConfig,
} from "framer-motion";

export function MotionProvider({ children }: PropsWithChildren) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
