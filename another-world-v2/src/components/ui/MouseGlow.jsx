import { useEffect, useState } from "react";

export default function MouseGlow() {
  const [position, setPosition] = useState({
    x: -500,
    y: -500,
  });

  const [theme, setTheme] = useState(
    () =>
      document.documentElement.getAttribute("data-theme") || "dark",
  );

  useEffect(() => {
    const handleMouseMove = (event) => {
      setPosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    function handleThemeChange(event) {
      if (
        event.detail === "light" ||
        event.detail === "dark"
      ) {
        setTheme(event.detail);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);

    window.addEventListener(
      "another-world-theme-change",
      handleThemeChange,
    );

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);

      window.removeEventListener(
        "another-world-theme-change",
        handleThemeChange,
      );
    };
  }, []);

  const isLight = theme === "light";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[9999] h-[380px] w-[380px] rounded-full"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",

        backgroundImage: `
          radial-gradient(
            circle,
            ${
              isLight
                ? "rgba(145,119,181,0.38)"
                : "rgba(168,85,247,0.14)"
            } 0%,

            ${
              isLight
                ? "rgba(145,119,181,0.25)"
                : "rgba(168,85,247,0.09)"
            } 22%,

            ${
              isLight
                ? "rgba(145,119,181,0.15)"
                : "rgba(168,85,247,0.05)"
            } 40%,

            ${
              isLight
                ? "rgba(145,119,181,0.07)"
                : "rgba(168,85,247,0.025)"
            } 55%,

            transparent 74%
          ),

          radial-gradient(
            circle,
            ${
              isLight
                ? "rgba(145,119,181,0.30)"
                : "rgba(124,58,237,0.28)"
            } 1.8px,
            transparent 1.8px
          )
        `,

        backgroundSize: "100% 100%, 18px 18px",

        filter: isLight
          ? "blur(3px)"
          : "blur(4px)",

        maskImage: `
          radial-gradient(
            circle,
            black 0%,
            black 30%,
            rgba(0,0,0,0.8) 48%,
            rgba(0,0,0,0.4) 63%,
            transparent 78%
          )
        `,

        WebkitMaskImage: `
          radial-gradient(
            circle,
            black 0%,
            black 30%,
            rgba(0,0,0,0.8) 48%,
            rgba(0,0,0,0.4) 63%,
            transparent 78%
          )
        `,
      }}
    />
  );
}