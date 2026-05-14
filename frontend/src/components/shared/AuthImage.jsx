import { useState, useEffect } from "react";

export default function AuthImage({
  src,
  fallbackIcon,
  alt = "Image",
  className = "",
  style = {},
  ...props
}) {
  const [imgSrc, setImgSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImgSrc(null);
      setError(true);
      return;
    }

    const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/api$/, "");

    // Full image URL
    const finalUrl =
      src.startsWith("http") || src.startsWith("data:")
        ? src
        : `${baseUrl}${src}`;

    setImgSrc(finalUrl);
    setError(false);
  }, [src]);

  if (error || !imgSrc) {
    if (fallbackIcon) {
      return (
        <div
          className={`d-flex align-items-center justify-content-center bg-secondary bg-opacity-10 text-secondary ${className}`}
          style={style}
          {...props}
        >
          <i className={fallbackIcon}></i>
        </div>
      );
    }

    return null;
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={style}
      onError={() => setError(true)}
      {...props}
    />
  );
}