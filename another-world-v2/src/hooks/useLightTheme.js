import { useSyncExternalStore } from "react";

function readTheme() {
  if (typeof document === "undefined") return false;
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "light";
  try {
    return window.localStorage.getItem("another-world-theme") === "light";
  } catch {
    return false;
  }
}

function subscribe(update) {
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  window.addEventListener("another-world-theme-change", update);
  return () => {
    observer.disconnect();
    window.removeEventListener("another-world-theme-change", update);
  };
}

export default function useLightTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => false);
}
