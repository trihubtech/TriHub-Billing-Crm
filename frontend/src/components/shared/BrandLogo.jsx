export default function BrandLogo({
  tone = "light",
  size = "md",
  stacked = false,
  showText = true,
  label = "TriHub Technologies",
  subtitle = "",
  className = "",
  ...rest
}) {
  const classes = [
    "brand-logo",
    `brand-logo-${tone}`,
    `brand-logo-${size}`,
    stacked ? "brand-logo-stacked" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      <div className="brand-logo-mark">
        <img src="/company_logo.png" alt="TriHub Technologies" className="brand-logo-image" />
      </div>
      {showText && (
        <div className="brand-logo-copy">
          <span className="brand-logo-title">{label}</span>
          {subtitle ? <span className="brand-logo-subtitle">{subtitle}</span> : null}
        </div>
      )}
    </div>
  );
}
