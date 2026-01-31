"use client";

import "@/app/globals.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            minHeight: "100vh",
            width: "100%",
            padding: 0,
            margin: 0,
            position: "relative",
            overflow: "hidden"
        }}>
            {children}
        </div>
    );
}
