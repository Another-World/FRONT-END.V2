import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(
        hash.replace("#", "")
      );

      if (element) {
        setTimeout(() => {
          element.scrollIntoView({
            behavior: "auto",
            block: "start",
          });
        }, 0);

        return;
      }
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [pathname, search, hash]);

  return null;
}