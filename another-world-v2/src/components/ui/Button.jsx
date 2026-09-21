export default function Button({
  children,
  variant = "outline",
  className = "",
  as: Component = "button",
  ...props
}) {
  const variants = {
    outline: "border border-purple bg-bg-card-inner text-purple",
    white: "bg-white text-bg-dark",
    solid: "bg-purple text-white",
  };

  return (
    <Component
      className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-wide transition hover:opacity-90 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}