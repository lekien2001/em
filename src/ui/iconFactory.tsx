import * as React from "react";
export type IconNode = [string, Record<string, string | number>][];
export type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
};

/** The approved SVG paths are local data, not another bundled icon runtime. */
export function createIcon(name: string, nodes: IconNode) {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
    {
      size = 24,
      color = "currentColor",
      strokeWidth = 2,
      absoluteStrokeWidth,
      className = "",
      children,
      ...props
    },
    ref,
  ) {
    const accessible = Object.keys(props).some(
      (key) => key.startsWith("aria-") || key === "role" || key === "title",
    );
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={
          absoluteStrokeWidth
            ? (Number(strokeWidth) * 24) / Number(size)
            : strokeWidth
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        className={["lucide", `lucide-${name}`, className]
          .filter(Boolean)
          .join(" ")}
        {...(!children && !accessible
          ? {
              "aria-hidden": true as const,
            }
          : {})}
        {...props}
      >
        {nodes.map(([tag, attributes]) => React.createElement(tag, attributes))}
        {children}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}
