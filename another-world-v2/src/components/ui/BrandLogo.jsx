import logo from "../../assets/logo.png";
import useLightTheme from "../../hooks/useLightTheme";

export default function BrandLogo(props) {
  const isLight = useLightTheme();
  return (
    <img
      {...props}
      src={isLight ? "/images/another-world-logo-light.svg" : logo}
    />
  );
}
