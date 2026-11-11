import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Animated detail sheet: bottom sheet on portrait, centered panel on landscape. Esc / backdrop closes. */
export function Modal({ open, onClose, children, label, accent }: { open: boolean; onClose: () => void; children: ReactNode; label: string; accent?: string }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-root" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={panel}
        style={accent ? ({ "--accent-c": accent } as React.CSSProperties) : undefined}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
