"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      onClick={(e) => {
        // Clic en el backdrop (fuera del contenido) cierra el modal.
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "w-full max-w-2xl rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40",
        className
      )}
    >
      {(title || description) && (
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}
      <div className="max-h-[80vh] overflow-y-auto px-6 py-6">{children}</div>
    </dialog>
  );
}