import { useEffect, useRef, useState } from "react";
import useLightTheme from "../../hooks/useLightTheme";
import styles from "./Home.module.css";

function SpaceVideo() {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    let active = true;
    const updatePlayback = () => {
      if (reducedMotion || failed || document.hidden) {
        video.pause();
      } else {
        video.play().catch((error) => {
          if (active && error.name !== "AbortError") setFailed(true);
        });
      }
    };
    updatePlayback();
    document.addEventListener("visibilitychange", updatePlayback);
    return () => {
      active = false;
      video.pause();
      document.removeEventListener("visibilitychange", updatePlayback);
    };
  }, [reducedMotion, failed]);

  return (
    <>
      <div className={styles.heroVideoLayer} aria-hidden="true">
        <video
          ref={videoRef}
          data-light-video
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/home-space-light-poster.webp"
          src={reducedMotion || failed ? undefined : "/media/home-liquid.mp4"}
          onError={() => setFailed(true)}
        />
        <div className={styles.videoShade} />
      </div>
    </>
  );
}

export default function LightHeroVideo() {
  const isLight = useLightTheme();
  return isLight ? <SpaceVideo /> : null;
}
