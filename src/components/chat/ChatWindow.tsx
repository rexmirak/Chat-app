"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/Avatar";

type Message = {
    id: string;
    senderId: string;
    content: string;
    type: "TEXT" | "AI";
    createdAt: string;
    sender?: {
        username: string;
        displayName: string;
    };
};

interface ChatWindowProps {
    chatId: string;
    currentUserId: string;
    chatTitle?: string;
    chatAvatar?: string;
    contactStatus?: string;
    contactIsAi?: boolean;
    refreshKey?: number;
    onInfoClick?: () => void;
}

export function ChatWindow({
    chatId,
    currentUserId,
    chatTitle,
    chatAvatar,
    contactStatus,
    contactIsAi,
    refreshKey,
    onInfoClick
}: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [aiPending, setAiPending] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const resolvedStatus = contactIsAi ? "ONLINE" : contactStatus;
    const statusLabel =
        resolvedStatus === "ONLINE" ? "Online" : resolvedStatus === "AWAY" ? "Away" : "Offline";
    const statusClass =
        resolvedStatus === "ONLINE"
            ? "bg-green-500"
            : resolvedStatus === "AWAY"
                ? "bg-yellow-400"
                : "bg-gray-400";

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!chatId) return;
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        let isActive = true;

        const loadMessages = async () => {
            setAiPending(false);
            setAiError(null);
            setMessages([]);
            try {
                const res = await fetch(`/api/chats/${chatId}/messages`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (!isActive) return;
                if (Array.isArray(data.messages)) {
                    setMessages(data.messages);
                } else {
                    setMessages([]);
                }
            } catch (err) {
                if (isActive) {
                    setMessages([]);
                }
                console.error("Failed to fetch messages", err);
            }
        };

        loadMessages();
        return () => {
            isActive = false;
        };
    }, [chatId, refreshKey]);

    useEffect(() => {
        if (!chatId) return;

        const token = localStorage.getItem("accessToken");
        if (!token) return;

        // Use native WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

        let ws: WebSocket;
        try {
            ws = new WebSocket(wsUrl);
            wsRef.current = ws;
        } catch (e) {
            console.error("WS Create failed", e);
            return;
        }

        ws.onopen = () => {
            console.log("Connected to WS");
            // Join presence or room if needed, but our server auto-joins based on persistent connection for now.
            // We need to implement proper "room join" if our server expects it, 
            // but current server.js broadcasts to participants found in DB.
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.event === "chat:ai:error") {
                    setAiPending(false);
                    setAiError(payload.data?.message || "AI request failed");
                    return;
                }
                if (payload.event === "chat:message") {
                    const msg = payload.data;
                    if (msg.chatId === chatId) {
                        setMessages((prev) => [...prev, msg]);
                        if (msg.type === "AI" || msg.sender?.isAiBot) {
                            setAiPending(false);
                            setAiError(null);
                        }
                    }
                }
            } catch (err) {
                console.error("WS message parse error", err);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from WS");
        };

        return () => {
            ws.close();
        };
    }, [chatId]);

    const sendMessage = () => {
        if (!inputText.trim() || !wsRef.current) return;
        if (wsRef.current.readyState !== WebSocket.OPEN) return;

        const payload = {
            event: "chat:message",
            data: {
                chatId,
                type: "TEXT",
                content: inputText
            }
        };

        wsRef.current.send(JSON.stringify(payload));

        // Optimistic update (optional, but good for UX)
        // For MVP relying on server echo is safer to prove round trip.
        setInputText("");
    };

    const sendAiPrompt = (prompt?: string) => {
        const text = (prompt ?? inputText).trim();
        if (!text || !wsRef.current) return;
        if (wsRef.current.readyState !== WebSocket.OPEN) {
            setAiError("AI is unavailable right now.");
            return;
        }
        setAiError(null);
        setAiPending(true);
        wsRef.current.send(JSON.stringify({
            event: "chat:ai",
            data: { chatId, prompt: text }
        }));
        setInputText("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    const handleSend = () => {
        const trimmed = inputText.trim();
        if (trimmed.startsWith("/ai")) {
            const prompt = trimmed.replace(/^\/ai\s*/i, "");
            sendAiPrompt(prompt);
            return;
        }
        sendMessage();
    };

    return (
        <main className="chat-window">
            <div className="chat-header">
                <div className="chat-head-left">
                    <Avatar name={chatTitle || "Chat"} src={chatAvatar} className="large" />
                    <div>
                        <div className="chat-head-name">{chatTitle || "Chat"}</div>
                        <div className="chat-head-status flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusClass}`}></span>
                            {statusLabel}
                        </div>
                    </div>
                </div>
                <div className="chat-head-actions">
                    <span className="icon-btn cursor-pointer" title="Search in chat">
                        <span className="material-symbols-outlined">search</span>
                    </span>
                    <span className="icon-btn cursor-pointer" title="Voice call">
                        <span className="material-symbols-outlined">call</span>
                    </span>
                    <span className="icon-btn cursor-pointer" title="Video call">
                    <span className="material-symbols-outlined">videocam</span>
                </span>
                    <span className="icon-btn cursor-pointer" onClick={() => onInfoClick?.()} title="Contact info">
                        <span className="material-symbols-outlined">more_horiz</span>
                    </span>
                </div>
            </div>

            <div className="chat-body">
                <div className="date-pill">Today</div>

                <AnimatePresence>
                    {aiPending && (
                        <motion.div
                            key="ai-pending"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bubble left ai-typing"
                        >
                            CH Assistant is thinking…
                        </motion.div>
                    )}
                    {aiError && (
                        <motion.div
                            key="ai-error"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bubble left ai-error"
                        >
                            {aiError}
                        </motion.div>
                    )}
                    {messages.map((msg) => {
                        const isMe = msg.senderId === currentUserId;
                        const messageKey = msg.id || `${msg.senderId}-${msg.createdAt}`;

                        return (
                            <motion.div
                                key={messageKey}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`bubble ${isMe ? 'right' : 'left'}`}
                        >
                                {msg.content}
                                <div className="time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chat-input-bar">
                <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type any message..."
                    className="chat-input"
                />
                <div className="chat-input-actions">
                    <button className="chat-input-icon" title="Ask AI" onClick={() => sendAiPrompt()}>
                        <span className="material-symbols-outlined">auto_awesome</span>
                    </button>
                    <button className="chat-input-icon" title="Voice message">
                        <span className="material-symbols-outlined">mic</span>
                    </button>
                    <button className="chat-input-icon" title="Emoji">
                        <span className="material-symbols-outlined">sentiment_satisfied</span>
                    </button>
                    <button className="chat-input-icon" title="Attach file">
                        <span className="material-symbols-outlined">attach_file</span>
                    </button>
                    <button onClick={handleSend} className="chat-send-btn" title="Send">
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </div>
            </div>
        </main>
    );
}
