/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useMemo, useState } from "react";

interface AvatarProps {
  name?: string;
  src?: string | null;
  className?: string;
}

const getInitials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function Avatar({ name, src, className = "" }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const showImage = Boolean(src) && !hasError;

  return (
    <div className={`avatar ${className} ${showImage ? "" : "avatar-initials"}`.trim()} aria-label={name}>
      {showImage ? (
        <img src={src || ""} alt={name || "Avatar"} onError={() => setHasError(true)} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
