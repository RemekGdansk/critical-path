// A modal yes/no question on the native <dialog> element. Hand-built here, not
// added with shadcn: Radix Dialog (shadcn's `dialog` and `alert-dialog`) locks
// scrolling by inserting a <style> element at runtime, which the hash-only
// `style-src` of the CSP blocks. The native element gets modality, the focus
// trap and Escape from the browser and injects nothing.
import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  /** Renders nothing while false; while true the dialog is mounted and shown as a modal. */
  open: boolean;
  title: string;
  description: string;
  /** The destructive choice, e.g. "Discard and import". */
  confirmLabel: string;
  onConfirm: () => void;
  /** Cancel, Escape, or the browser closing the dialog on its own. */
  onCancel: () => void;
}

/**
 * Asks before a destructive action. Mounted only while open, so its owner holds
 * the one source of truth; Cancel is focused on open. The owner moves focus
 * after either choice: the dialog is unmounted, not closed, so the browser
 * restores nothing.
 */
export function ConfirmDialog({ open, ...props }: ConfirmDialogProps) {
  if (!open) return null;
  return <OpenConfirmDialog {...props} />;
}

function OpenConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded, so a second mount effect (StrictMode) does not show it twice.
    if (dialog !== null && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Escape: kept open, so React stays the one that removes it.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      // Nothing here calls close(), so a close is the browser's own (Chromium may force one on a repeated Escape).
      onClose={onCancel}
      // m-auto restores the centring that Tailwind's preflight (margin: 0) takes from a modal dialog.
      className="bg-card text-card-foreground backdrop:bg-overlay m-auto w-full max-w-md rounded-lg border p-6 shadow-lg"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <p id={descriptionId} className="text-muted-foreground mt-2 text-sm">
        {description}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button ref={cancelRef} type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
