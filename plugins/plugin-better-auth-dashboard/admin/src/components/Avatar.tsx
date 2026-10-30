import { Avatar as DSAvatar } from "@strapi/design-system";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  return (
    <DSAvatar.Item
      src={src ?? undefined}
      alt=""
      delayMs={0}
      fallback={
        // Block + line-height 1 escapes the DS Typography wrapper's taller line box
        <span
          style={{
            display: "block",
            lineHeight: 1,
            fontSize: Math.round(size * 0.38),
          }}
        >
          {getInitials(name || "?")}
        </span>
      }
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}
