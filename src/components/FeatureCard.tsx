import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "@/lib/icons";
import { ArrowUpRight } from "@/lib/icons";

interface Props {
  to: "/tryon" | "/scanner" | "/posts";
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: boolean;
}

export function FeatureCard({ to, title, description, icon: Icon, accent }: Props) {
  return (
    <Link
      to={to}
      className={
        accent
          ? "group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-clay p-5 text-clay-foreground shadow-soft transition-transform active:scale-[0.99]"
          : "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-soft transition-transform active:scale-[0.99]"
      }
    >
      <div className="flex items-start justify-between">
        <div
          className={
            accent
              ? "grid h-11 w-11 place-items-center rounded-2xl bg-clay-foreground/15"
              : "grid h-11 w-11 place-items-center rounded-2xl bg-secondary"
          }
        >
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-5 w-5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div className="mt-8">
        <h3 className="font-display text-lg font-semibold leading-tight">{title}</h3>
        <p className="mt-1.5 text-sm opacity-80">{description}</p>
      </div>
    </Link>
  );
}
