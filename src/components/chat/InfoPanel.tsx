/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

type Attachment = {
    id: string;
    type: "IMAGE" | "VIDEO" | "AUDIO" | "DOC" | "OTHER";
    url: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    createdAt: string;
};

type Message = {
    id: string;
    type: "TEXT" | "MEDIA" | "DOC" | "LINK" | "SYSTEM" | "AI";
    content: string | null;
    createdAt: string;
    attachments: Attachment[];
};

type MediaItem = {
    id: string;
    url: string;
    type: "IMAGE" | "VIDEO";
    createdAt: string;
};

type LinkItem = {
    id: string;
    url: string;
    createdAt: string;
};

type DocItem = {
    id: string;
    url: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    createdAt: string;
};

interface InfoPanelProps {
    chatId: string;
    contactName: string;
    contactEmail?: string | null;
    contactAvatar?: string | null;
    onClose?: () => void;
}

type TabKey = "media" | "link" | "docs";

const linkRegex = /(https?:\/\/[^\s)]+)/gi;

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
};

const monthLabel = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "long" });

const groupByMonth = <T extends { createdAt: string }>(items: T[]) => {
    const map = new Map<string, T[]>();
    items.forEach((item) => {
        const label = monthLabel(item.createdAt);
        const list = map.get(label) || [];
        list.push(item);
        map.set(label, list);
    });
    return Array.from(map.entries()).map(([label, list]) => ({
        label,
        items: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }));
};

const getLinkHost = (url: string) => {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return url;
    }
};

const getLinkColor = (url: string) => {
    let hash = 0;
    for (let i = 0; i < url.length; i += 1) {
        hash = (hash << 5) - hash + url.charCodeAt(i);
        hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 42%)`;
};

const fileExtension = (filename: string, mimeType: string) => {
    const extFromName = filename?.split(".").pop();
    if (extFromName) return extFromName.toUpperCase();
    const extFromMime = mimeType?.split("/").pop();
    return extFromMime ? extFromMime.toUpperCase() : "FILE";
};

const filenameFromUrl = (url: string) => {
    try {
        const pathname = new URL(url).pathname;
        const name = pathname.split("/").pop();
        return name || "File";
    } catch {
        return "File";
    }
};

const fileBadgeClass = (ext: string) => {
    const upper = ext.toUpperCase();
    if (upper === "PDF") return "contact-doc-badge contact-doc-badge--pdf";
    if (upper === "FIG") return "contact-doc-badge contact-doc-badge--fig";
    if (upper === "AI") return "contact-doc-badge contact-doc-badge--ai";
    return "contact-doc-badge";
};

export function InfoPanel({ chatId, contactName, contactEmail, contactAvatar, onClose }: InfoPanelProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("media");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!chatId) return;
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        let isActive = true;
        const loadMessages = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/chats/${chatId}/messages`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!isActive) return;
                if (Array.isArray(data.messages)) {
                    setMessages(data.messages);
                } else {
                    setMessages([]);
                }
            } catch {
                if (isActive) {
                    setMessages([]);
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };
        loadMessages();
        return () => {
            isActive = false;
        };
    }, [chatId]);

    const { mediaItems, linkItems, docItems } = useMemo(() => {
        const media: MediaItem[] = [];
        const links: LinkItem[] = [];
        const docs: DocItem[] = [];

        messages.forEach((message) => {
            const createdAt = message.createdAt;
            if (message.content) {
                const found = message.content.match(linkRegex);
                if (found) {
                    found.forEach((raw) => {
                        const url = raw.replace(/[.,)]+$/, "");
                        links.push({
                            id: `${message.id}-${url}`,
                            url,
                            createdAt,
                        });
                    });
                }

                if (message.type === "MEDIA" && message.content.startsWith("http")) {
                    media.push({
                        id: message.id,
                        url: message.content,
                        type: "IMAGE",
                        createdAt,
                    });
                }

                if (message.type === "DOC" && message.content.startsWith("http")) {
                    docs.push({
                        id: message.id,
                        url: message.content,
                        filename: filenameFromUrl(message.content),
                        sizeBytes: 0,
                        mimeType: "",
                        createdAt,
                    });
                }
            }

            message.attachments?.forEach((attachment) => {
                const mime = attachment.mimeType || "";
                const isImage = attachment.type === "IMAGE" || mime.startsWith("image/");
                const isVideo = attachment.type === "VIDEO" || mime.startsWith("video/");
                const isDoc = attachment.type === "DOC" || (!isImage && !isVideo);

                if (isImage || isVideo) {
                    media.push({
                        id: attachment.id,
                        url: attachment.url,
                        type: isVideo ? "VIDEO" : "IMAGE",
                        createdAt: attachment.createdAt || createdAt,
                    });
                } else if (isDoc) {
                    docs.push({
                        id: attachment.id,
                        url: attachment.url,
                        filename: attachment.filename,
                        sizeBytes: attachment.sizeBytes,
                        mimeType: attachment.mimeType,
                        createdAt: attachment.createdAt || createdAt,
                    });
                }
            });
        });

        const uniqueLinks = Array.from(new Map(links.map((item) => [item.url, item])).values());

        return {
            mediaItems: media.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            linkItems: uniqueLinks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            docItems: docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        };
    }, [messages]);

    const groupedMedia = useMemo(() => groupByMonth(mediaItems), [mediaItems]);
    const groupedLinks = useMemo(() => groupByMonth(linkItems), [linkItems]);
    const groupedDocs = useMemo(() => groupByMonth(docItems), [docItems]);

    return (
        <aside className="panel-info">
            <div className="contact-header">
                <h3>Contact Info</h3>
                <button className="contact-close" type="button" onClick={onClose} aria-label="Close">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="contact-profile">
                <Avatar name={contactName} src={contactAvatar} className="contact-avatar" />
                <div className="contact-name">{contactName}</div>
                {contactEmail && <div className="contact-email">{contactEmail}</div>}
            </div>

            <div className="contact-actions">
                <button className="contact-action" type="button">
                    <span className="material-symbols-outlined">call</span>
                    Audio
                </button>
                <button className="contact-action" type="button">
                    <span className="material-symbols-outlined">videocam</span>
                    Video
                </button>
            </div>

            <div className="contact-tabs" role="tablist">
                <button
                    className={`contact-tab ${activeTab === "media" ? "active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "media"}
                    onClick={() => setActiveTab("media")}
                >
                    Media
                </button>
                <button
                    className={`contact-tab ${activeTab === "link" ? "active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "link"}
                    onClick={() => setActiveTab("link")}
                >
                    Link
                </button>
                <button
                    className={`contact-tab ${activeTab === "docs" ? "active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "docs"}
                    onClick={() => setActiveTab("docs")}
                >
                    Docs
                </button>
            </div>

            <div className="contact-body">
                {loading && <div className="contact-empty">Loading...</div>}

                {!loading && activeTab === "media" && (
                    <>
                        {groupedMedia.length === 0 && <div className="contact-empty">No media yet</div>}
                        {groupedMedia.map((group) => (
                            <div key={group.label} className="contact-section">
                                <div className="contact-section-label">{group.label}</div>
                                <div className="contact-media-grid">
                                    {group.items.map((item) => (
                                        <a
                                            key={item.id}
                                            href={item.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`contact-media-tile ${item.type === "VIDEO" ? "is-video" : ""}`}
                                        >
                                            {item.type === "IMAGE" ? (
                                                <img src={item.url} alt="Media" />
                                            ) : (
                                                <span className="material-symbols-outlined">play_circle</span>
                                            )}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {!loading && activeTab === "link" && (
                    <>
                        {groupedLinks.length === 0 && <div className="contact-empty">No links yet</div>}
                        {groupedLinks.map((group) => (
                            <div key={group.label} className="contact-section">
                                <div className="contact-section-label">{group.label}</div>
                                <div className="contact-link-list">
                                    {group.items.map((item) => (
                                        <a
                                            key={item.id}
                                            href={item.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="contact-link-card"
                                        >
                                            <div className="contact-link-icon" style={{ background: getLinkColor(item.url) }}>
                                                {getLinkHost(item.url).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="contact-link-meta">
                                                <div className="contact-link-url">{item.url}</div>
                                                <div className="contact-link-host">{getLinkHost(item.url)}</div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {!loading && activeTab === "docs" && (
                    <>
                        {groupedDocs.length === 0 && <div className="contact-empty">No documents yet</div>}
                        {groupedDocs.map((group) => (
                            <div key={group.label} className="contact-section">
                                <div className="contact-section-label">{group.label}</div>
                                <div className="contact-doc-list">
                                    {group.items.map((item) => {
                                        const ext = fileExtension(item.filename, item.mimeType);
                                        const sizeLabel = formatBytes(item.sizeBytes);
                                        return (
                                            <a
                                                key={item.id}
                                                href={item.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="contact-doc-item"
                                            >
                                                <div className={fileBadgeClass(ext)}>{ext}</div>
                                                <div className="contact-doc-meta">
                                                    <div className="contact-doc-name">{item.filename}</div>
                                                    <div className="contact-doc-sub">
                                                        {sizeLabel ? `${sizeLabel} • ` : ""}{ext.toLowerCase()}
                                                    </div>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </aside>
    );
}
