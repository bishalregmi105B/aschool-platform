import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

/**
 * Persona-style avatar: circular, image covers the frame, initials fallback
 * sits on `--w11-accent-light` with accent text (the softer sibling of the
 * solid 11.css `persona-avatar`). Falls back to literal tints outside the
 * `.win11` scope.
 */
export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover", sizeMap[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--w11-accent-light,rgba(0,103,192,0.12))] font-semibold text-[var(--w11-accent,#0067c0)]",
        sizeMap[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
