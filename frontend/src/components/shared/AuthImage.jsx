import { useState, useEffect } from "react";

export default function AuthImage({ src, fallbackIcon, alt = "Image", className = "", style = {}, ...props }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImgSrc(null);
      setError(true);
      return;
    }

    
    if (src.startsWith("http") || src.startsWith("data:")) {
      setImgSrc(src);
      setError(false);
      return;
    }

    const token = localStorage.getItem("trihub_token");
    const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/api$/, "");
    const fetchUrl = src.startsWith("http") ? src : `${baseUrl}${src}`;

    fetch(fetchUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load image");
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setImgSrc(objectUrl);
        setError(false);
      })
      .catch(() => {
        setImgSrc(null);
        setError(true);
      });

    
    return () => {
      if (imgSrc && imgSrc.startsWith("blob:")) {
        URL.revokeObjectURL(imgSrc);
      }
    };
    
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

  return <img src={imgSrc} alt={alt} className={className} style={style} {...props} />;
}
