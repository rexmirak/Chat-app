import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "ghost" | "icon" | "danger";
    size?: "sm" | "md" | "icon";
    children: React.ReactNode;
}

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
    let baseClass = "inline-flex items-center justify-center gap-2 font-semibold transition-colors";

    if (variant === "primary") {
        baseClass += " bg-[var(--green)] text-white hover:bg-[var(--green-strong)] rounded-[10px]";
    } else if (variant === "ghost") {
        baseClass += " bg-white border border-[#e9e6df] text-[#6f6f6b] hover:bg-[#f7f6f2] rounded-[12px]";
    } else if (variant === "icon") {
        baseClass += " bg-white border border-[#edeae3] text-[#6f6f6b] hover:text-[#2a2a2a] rounded-[10px]";
    } else if (variant === "danger") {
        baseClass += " text-[#d75959] hover:bg-[#fff0f0] rounded-[10px]";
    }

    if (size === "sm") {
        baseClass += " text-xs px-3 py-2";
    } else if (size === "md") {
        baseClass += " text-sm px-4 py-2.5";
    } else if (size === "icon") {
        baseClass += " w-[34px] h-[34px] p-0";
    }

    return (
        <button className={`${baseClass} ${className}`} {...props}>
            {children}
        </button>
    );
}
