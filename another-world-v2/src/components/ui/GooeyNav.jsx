import {
  useEffect,
  useId,
  useState,
} from "react";

import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

import { NavLink } from "react-router-dom";

const SPRING = {
  type: "spring",
  stiffness: 200,
  damping: 28,
  mass: 1,
};

const NECK_BREAK = 0.22;
const NECK_H = 100;

const FADE_IN = "transition-colors duration-[400ms]";
const FADE_OUT = "transition-colors duration-0";

const BAR = "bg-[#262626]";

const SIZES = {
  xs: {
    label:
      "gap-1 px-2 py-1.5 text-[11px] leading-4 [&_svg]:size-[11px]",
    radius: 8,
    separation: 14,
  },

  sm: {
    label:
      "gap-1.5 px-3.5 py-2 text-xs leading-4 [&_svg]:size-3",
    radius: 10,
    separation: 16,
  },

  md: {
    label:
      "gap-2 px-5 py-2.5 text-sm leading-5 [&_svg]:size-3.5",
    radius: 12,
    separation: 20,
  },

  lg: {
    label:
      "gap-2.5 px-6 py-3 text-base leading-6 [&_svg]:size-4",
    radius: 14,
    separation: 24,
  },
};

function neckPath(gap, span) {
  if (
    !Number.isFinite(gap) ||
    !Number.isFinite(span) ||
    gap <= 0 ||
    span <= 0
  ) {
    return "";
  }

  const waist =
    NECK_H * (1 - gap / (span * NECK_BREAK));

  if (waist <= 0) return "";

  const start = span - gap;
  const mid = start + gap / 2;

  return `
    M${start} 0
    Q${mid} ${NECK_H - waist} ${span} 0
    L${span} ${NECK_H}
    Q${mid} ${waist} ${start} ${NECK_H}
    Z
  `;
}

function Segment({
  gap,
  span,
  hasSeam,
  leftFill,
  rightFill,
  reduced,
  radii,
  className,
  style,
  children,
}) {
  const marginLeft = useSpring(gap, SPRING);

  const gradientId = `gooey-neck-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (reduced) {
      marginLeft.jump(gap);
    } else {
      marginLeft.set(gap);
    }
  }, [gap, marginLeft, reduced]);

  const path = useTransform(
    marginLeft,
    (currentGap) => neckPath(currentGap, span)
  );

  return (
    <motion.li
      className={`relative ${className || ""}`}
      style={{
        ...style,
        marginLeft,
      }}
      initial={false}
      animate={radii}
      transition={reduced ? { duration: 0 } : SPRING}
    >
      {hasSeam && (
        <svg
          aria-hidden="true"
          width={span}
          viewBox={`0 0 ${span} ${NECK_H}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute top-0 right-full h-full"
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              x2="1"
            >
              <stop
                offset="0"
                stopColor={leftFill}
              />

              <stop
                offset="1"
                stopColor={rightFill}
              />
            </linearGradient>
          </defs>

          <motion.path
            d={path}
            fill={`url(#${gradientId})`}
          />
        </svg>
      )}

      {children}
    </motion.li>
  );
}

function NavLabel({
  label,
  to,
  isActive,
  size,
  activeLabelColor,
  onSelect,
}) {
  return (
    <NavLink
      to={to}
      onClick={onSelect}
      aria-current={
        isActive ? "page" : undefined
      }
      className={`flex cursor-pointer items-center whitespace-nowrap font-medium ${SIZES[size].label} ${
        isActive ? FADE_IN : FADE_OUT
      } ${
        isActive
          ? "text-white"
          : "text-[#868593] hover:text-white"
      }`}
      style={
        isActive
          ? { color: activeLabelColor }
          : undefined
      }
    >
      {label}
    </NavLink>
  );
}

export default function GooeyNav({
  items,
  size = "md",
  activeColor = "#7C3AED",
  activeLabelColor = "#ffffff",
  separation,
  radius,
  className = "",
}) {
  const reduced = useReducedMotion() ?? false;

  const [active, setActive] = useState(0);

  const span =
    separation ?? SIZES[size].separation;

  const corner =
    radius ?? SIZES[size].radius;

  const handleSelect = (index) => {
    setActive(index);
  };

  const open = (seam) =>
    seam === 0 ||
    seam === items.length ||
    seam - 1 === active ||
    seam === active;

  const fill = (index) =>
    index === active
      ? activeColor
      : "#262626";

  return (
    <nav
      aria-label="Navegação principal"
      className={`inline-block ${className}`}
    >
      <ul className="flex items-center">
        {items.map((item, index) => {
          const isActive = index === active;

          return (
            <Segment
              key={`${index}-${item.label}`}
              gap={
                index === 0
                  ? 0
                  : open(index)
                  ? span
                  : -1
              }
              span={span}
              hasSeam={index > 0}
              leftFill={fill(index - 1)}
              rightFill={fill(index)}
              reduced={reduced}
              radii={{
                borderTopLeftRadius:
                  open(index) ? corner : 0,

                borderBottomLeftRadius:
                  open(index) ? corner : 0,

                borderTopRightRadius:
                  open(index + 1) ? corner : 0,

                borderBottomRightRadius:
                  open(index + 1) ? corner : 0,
              }}
              className={`${BAR} ${
                isActive
                  ? FADE_IN
                  : FADE_OUT
              }`}
              style={{
                backgroundColor: isActive
                  ? activeColor
                  : "#262626",
              }}
            >
              <NavLabel
                label={item.label}
                to={item.to}
                isActive={isActive}
                size={size}
                activeLabelColor={
                  activeLabelColor
                }
                onSelect={() =>
                  handleSelect(index)
                }
              />
            </Segment>
          );
        })}
      </ul>
    </nav>
  );
}