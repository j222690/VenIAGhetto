import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

export function SectionTitle({ eyebrow, title, action }: Props) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="truncate font-display text-xl font-semibold text-foreground">
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
