import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
}

export function Input({ icon, className = "", ...props }: InputProps) {
    return (
        <div className={`input-shell ${className}`}>
            {icon && <span className="input-icon">{icon}</span>}
            <input className="input-field" {...props} />
        </div>
    );
}
