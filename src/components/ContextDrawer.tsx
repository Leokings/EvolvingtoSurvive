import {useEffect, useId, useRef, type ReactNode} from "react";

export default function ContextDrawer({
  eyebrow,
  title,
  wide = false,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = globalThis.document.activeElement;
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && globalThis.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && globalThis.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    globalThis.addEventListener("keydown", handleKeyboard);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyboard);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="context-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={drawerRef} className={`context-drawer ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="context-drawer-header">
          <div><small>{eyebrow}</small><h2 id={titleId}>{title}</h2></div>
          <button type="button" autoFocus onClick={onClose} aria-label={`Close ${title}`}>CLOSE <span>×</span></button>
        </header>
        <div className="context-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
