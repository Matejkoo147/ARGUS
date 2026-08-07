import { useEffect, type ReactNode } from "react";

interface DetailSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: string;
  onBack: () => void;
  children: ReactNode;
  /** Extra class on the sheet panel (e.g. camera fullscreen) */
  className?: string;
}

/** Fullscreen drill-down for tablet / touch — back arrow returns to previous view. */
export function DetailSheet({
  open,
  title,
  subtitle,
  icon = "bi-info-circle",
  onBack,
  children,
  className = "",
}: DetailSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onBack]);

  if (!open) return null;

  return (
    <div className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-sheet-title">
      <header className="detail-sheet-bar">
        <button type="button" className="detail-sheet-back" onClick={onBack} title="Back" aria-label="Back">
          <i className="bi bi-arrow-left" />
          <span>Back</span>
        </button>
        <div className="detail-sheet-heading">
          <i className={`bi ${icon}`} aria-hidden />
          <div className="detail-sheet-titles">
            <h2 id="detail-sheet-title">{title}</h2>
            {subtitle && <p className="detail-sheet-sub">{subtitle}</p>}
          </div>
        </div>
      </header>
      <div className={`detail-sheet-body ${className}`.trim()}>{children}</div>
    </div>
  );
}
