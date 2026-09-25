import { useEffect, useState } from "react";

export default function MouseGlow() {
  const [position, setPosition] = useState({
    x: -500,
    y: -500,
  });

  useEffect(() => {
    const handleMouseMove = (event) => {
      setPosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed z-[9999] h-[380px] w-[380px] rounded-full"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",

        backgroundImage: `
          radial-gradient(
            circle,
            rgba(168, 85, 247, 0.14) 0%,
            rgba(168, 85, 247, 0.09) 22%,
            rgba(168, 85, 247, 0.05) 40%,
            rgba(168, 85, 247, 0.025) 55%,
            transparent 74%
          ),
          radial-gradient(
            circle,
            rgba(192, 132, 252, 0.28) 1.8px,
            transparent 1.8px
          )
        `,

        backgroundSize: "100% 100%, 18px 18px",

        filter: "blur(4px)",

        maskImage: `
          radial-gradient(
            circle,
            black 0%,
            black 28%,
            rgba(0,0,0,0.7) 48%,
            rgba(0,0,0,0.3) 62%,
            transparent 76%
          )
        `,

        WebkitMaskImage: `
          radial-gradient(
            circle,
            black 0%,
            black 28%,
            rgba(0,0,0,0.7) 48%,
            rgba(0,0,0,0.3) 62%,
            transparent 76%
          )
        `,
      }}
    />
  );
}