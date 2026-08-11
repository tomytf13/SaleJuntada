import { Dialog, DialogTitle } from "@headlessui/react";
import type { FormEventHandler, PropsWithChildren } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  quickTransition,
  sheetVariants,
  springTransition,
} from "../motion/config";

type DialogBaseProps = PropsWithChildren<{
  open: boolean;
  onClose(): void;
  panelClassName: string;
  label: string;
}>;

type AnimatedDialogProps = DialogBaseProps &
  (
    | { as: "form"; onSubmit: FormEventHandler<HTMLFormElement> }
    | { as?: "section"; onSubmit?: never }
  );

export function AnimatedDialog({
  open,
  onClose,
  panelClassName,
  label,
  children,
  as = "section",
  onSubmit,
}: AnimatedDialogProps) {
  return (
    <AnimatePresence>
      {open ? (
        <Dialog
          static
          open={open}
          onClose={onClose}
          className="modal-root"
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <m.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={quickTransition}
            onMouseDown={onClose}
            aria-hidden="true"
          />
          <div className="modal-positioner">
            {as === "form" ? (
              <m.form
                className={panelClassName}
                variants={sheetVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={springTransition}
                onSubmit={onSubmit}
              >
                {children}
              </m.form>
            ) : (
              <m.section
                className={panelClassName}
                variants={sheetVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={springTransition}
              >
                {children}
              </m.section>
            )}
          </div>
        </Dialog>
      ) : null}
    </AnimatePresence>
  );
}
