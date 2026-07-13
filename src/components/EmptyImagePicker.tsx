import { ImagePlus } from "@/lib/icons";

interface Props {
  label: string;
  hint?: string;
  imageUrl?: string;
  onClick: () => void;
}

export function EmptyImagePicker({ label, hint, imageUrl, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border bg-secondary/60 text-center transition-colors hover:border-clay/60 hover:bg-secondary"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 px-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-background">
            <ImagePlus className="h-5 w-5 text-clay" />
          </div>
          <p className="font-medium text-foreground">{label}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      )}
    </button>
  );
}
