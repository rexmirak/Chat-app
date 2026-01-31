"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState<"username" | "email" | "password">("username");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleUsernameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username.trim()) setStep("email");
    };

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) setStep("password");
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password, displayName: username }),
            });

            if (!res.ok) {
                throw new Error("Registration failed");
            }

            const data = await res.json();
            if (data.accessToken) {
                localStorage.setItem("accessToken", data.accessToken);
            }

            router.push("/");
        } catch {
            setError("Registration failed. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="auth-stage">
            <div className="auth-decor" aria-hidden="true">
                <span className="auth-orb orb-1" />
                <span className="auth-orb orb-2" />
                <span className="auth-orb orb-3" />
                <span className="auth-orb orb-4" />
                <div className="auth-icon icon-1">
                    <span className="material-symbols-outlined">auto_awesome</span>
                </div>
                <div className="auth-icon icon-2">
                    <span className="material-symbols-outlined">favorite</span>
                </div>
                <div className="auth-icon icon-3">
                    <span className="material-symbols-outlined">palette</span>
                </div>
                <div className="auth-icon icon-4">
                    <span className="material-symbols-outlined">stars</span>
                </div>
                <div className="auth-marquee">
                    <span>Create Profile</span>
                    <span>Bright Onboarding</span>
                    <span>Colorful Identity</span>
                    <span>Animated Welcome</span>
                    <span>Create Profile</span>
                    <span>Bright Onboarding</span>
                    <span>Colorful Identity</span>
                    <span>Animated Welcome</span>
                </div>
            </div>
            <div className="app-shell auth-shell" style={{
                width: "100%",
                maxWidth: "480px",
                minHeight: "520px",
                height: "auto",
                borderRadius: "30px",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.3)",
                display: "flex",
                flexDirection: "column",
                background: "var(--shell)",
                overflow: "hidden"
            }}>
                {/* Header */}
                <div style={{
                    padding: "24px 28px 16px",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px"
                }}>
                    <div className="logo-bubble auth-logo" style={{ width: "48px", height: "48px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>person_add</span>
                    </div>
                    <div>
                        <h1 className="auth-title">Create Account</h1>
                        <p className="auth-subtitle">Start your first conversation</p>
                        <div className="auth-banner">
                            <span className="material-symbols-outlined">palette</span>
                            <span className="auth-banner-text">Set up your chat profile and start connecting.</span>
                        </div>
                    </div>
                </div>

            {/* Chat Area */}
            <div style={{
                flex: 1,
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                background: "#f2f1ed",
                overflowY: "auto"
            }}>
                {/* Step 1: Username */}
                <div className="bubble left" style={{
                    animation: "fadeInUp 0.3s ease-out",
                    maxWidth: "85%"
                }}>
                    <span>Hey there! Choose a display name for your chats.</span>
                </div>

                <form onSubmit={handleUsernameSubmit} style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                    <div className="bubble right" style={{
                        background: "var(--green)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 16px",
                        animation: "fadeInUp 0.3s ease-out 0.1s both",
                        maxWidth: "100%",
                        overflow: "hidden"
                    }}>
                        <>
                            <input
                                autoFocus={step === "username"}
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Choose a chat handle..."
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                    color: "#fff",
                                    fontSize: "14px",
                                    width: "180px",
                                    fontFamily: "inherit"
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    background: "rgba(255,255,255,0.2)",
                                    border: "none",
                                    borderRadius: "50%",
                                    width: "32px",
                                    height: "32px",
                                    display: "grid",
                                    placeItems: "center",
                                    cursor: "pointer",
                                    transition: "background 0.2s",
                                    flexShrink: 0
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fff" }}>arrow_upward</span>
                            </button>
                        </>
                    </div>
                </form>

                {/* Step 2: Email */}
                {(step === "email" || step === "password") && (
                    <>
                        <div className="bubble left" style={{
                            animation: "fadeInUp 0.3s ease-out",
                            maxWidth: "85%"
                        }}>
                            <span>Nice to meet you, <strong>{username}</strong>! What&apos;s your email for chat updates?</span>
                        </div>

                        <form onSubmit={handleEmailSubmit} style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                            <div className="bubble right" style={{
                                background: "var(--green)",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "12px 16px",
                                animation: "fadeInUp 0.3s ease-out",
                                maxWidth: "100%",
                                overflow: "hidden"
                            }}>
                                <>
                                    <input
                                        autoFocus={step === "email"}
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            outline: "none",
                                            color: "#fff",
                                            fontSize: "14px",
                                            width: "180px",
                                            fontFamily: "inherit"
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        style={{
                                            background: "rgba(255,255,255,0.2)",
                                            border: "none",
                                            borderRadius: "50%",
                                            width: "32px",
                                            height: "32px",
                                            display: "grid",
                                            placeItems: "center",
                                            cursor: "pointer",
                                            transition: "background 0.2s",
                                            flexShrink: 0
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fff" }}>arrow_upward</span>
                                    </button>
                                </>
                            </div>
                        </form>
                    </>
                )}

                {/* Step 3: Password */}
                {step === "password" && (
                    <>
                        <div className="bubble left" style={{
                            animation: "fadeInUp 0.3s ease-out",
                            maxWidth: "85%"
                        }}>
                            <span>Almost done! Create a secure password for your chat account.</span>
                        </div>

                        <form onSubmit={handleRegister} style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                            <div className="bubble right" style={{
                                background: "var(--green)",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "12px 16px",
                                animation: "fadeInUp 0.3s ease-out"
                            }}>
                                <input
                                    autoFocus
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create password..."
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        outline: "none",
                                        color: "#fff",
                                        fontSize: "14px",
                                        width: "180px",
                                        fontFamily: "inherit"
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        background: "rgba(255,255,255,0.2)",
                                        border: "none",
                                        borderRadius: "50%",
                                        width: "32px",
                                        height: "32px",
                                        display: "grid",
                                        placeItems: "center",
                                        cursor: loading ? "wait" : "pointer",
                                        transition: "background 0.2s"
                                    }}
                                >
                                    {loading ? (
                                        <span style={{
                                            width: "16px",
                                            height: "16px",
                                            border: "2px solid rgba(255,255,255,0.3)",
                                            borderTopColor: "#fff",
                                            borderRadius: "50%",
                                            display: "block",
                                            animation: "spin 0.6s linear infinite"
                                        }} />
                                    ) : (
                                        <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#fff" }}>check</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {/* Error Message */}
                {error && (
                    <div className="bubble left" style={{
                        background: "#fee2e2",
                        color: "#dc2626",
                        animation: "fadeInUp 0.3s ease-out",
                        maxWidth: "85%",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--line)",
                textAlign: "center",
                fontSize: "13px",
                color: "var(--muted)",
                background: "#fff"
            }}>
                Already have an account?{" "}
                <a href="/login" style={{
                    color: "var(--green)",
                    fontWeight: 600,
                    textDecoration: "none"
                }}>Sign in</a>
            </div>
        </div>
        </div>
    );
}
