import { useIntl } from "react-intl";
import { getTranslation } from "../utils/getTranslation";

export const PluginIcon = ({
  size = 16,
  background = "transparent",
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0,
}) => {
  const { formatMessage } = useIntl();
  const transforms = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push("scaleX(-1)");
  if (flipVertical) transforms.push("scaleY(-1)");

  const viewBoxSize = 24 + padding * 2;
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      style={{
        opacity,
        transform: transforms.join(" ") || undefined,
        filter:
          shadow > 0
            ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))`
            : undefined,
        backgroundColor: background !== "transparent" ? background : undefined,
      }}
    >
      <title>
        {formatMessage({
          id: getTranslation("components.pluginIcon.title"),
          defaultMessage: "Better Auth Logo",
        })}
      </title>
      <path
        fill="currentColor"
        d="M0 3.39v17.22h5.783v-5.55h6.434V8.939H5.783V3.39Zm12.217 5.55h5.638v6.122h-5.638v5.548H24V3.391H12.217Z"
      />
    </svg>
  );
};
