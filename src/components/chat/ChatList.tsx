"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";

const DEFAULT_MENU_SIZE = { width: 228, height: 340 };

export type ChatPreview = {
    id: string;
    isGroup: boolean;
    title?: string;
    avatarUrl?: string;
    updatedAt: string;
    unreadCount?: number;
    lastMessage?: {
        id?: string;
        content: string | null;
        type: string;
        createdAt: string;
    } | null;
    me?: {
        isArchived?: boolean;
        isMuted?: boolean;
        unreadMark?: boolean;
        lastReadAt?: string | null;
        clearedAt?: string | null;
    };
    participants: Array<{
        user: {
            id: string;
            displayName: string;
            username?: string;
            email?: string | null;
            avatarUrl?: string | null;
            isAiBot: boolean;
        }
    }>
};

interface ChatListProps {
    chats?: ChatPreview[];
    activeChatId?: string;
    currentUserId?: string;
    onSelectChat?: (id: string, chat: ChatPreview) => void;
    onNewMessage?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    showArchived?: boolean;
    onToggleArchived?: () => void;
    onMarkUnread?: (chatId: string, unread: boolean) => void;
    onDeleteChat?: (chatId: string) => void;
    onArchiveChat?: (chatId: string) => void;
    onUnarchiveChat?: (chatId: string) => void;
    onClearChat?: (chatId: string) => void;
    onContactInfo?: (chatId: string) => void;
    onMuteChat?: (chatId: string) => void;
    onExportChat?: (chatId: string) => void;
}

export function ChatList({
    chats = [],
    activeChatId,
    currentUserId,
    onSelectChat,
    onNewMessage,
    searchValue,
    onSearchChange,
    showArchived,
    onToggleArchived,
    onMarkUnread,
    onDeleteChat,
    onArchiveChat,
    onUnarchiveChat,
    onClearChat,
    onContactInfo,
    onMuteChat,
    onExportChat
}: ChatListProps) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{
        left: number;
        right: number;
        top: number;
        bottom: number;
        width: number;
        height: number;
    } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const isMounted = typeof document !== "undefined";

    const truncatePreview = (text: string, max = 12) => {
        if (text.length <= max) return text;
        return text.slice(0, max);
    };

    const getDisplayInfo = (chat: ChatPreview) => {
        let name = chat.title || "Chat";
        let avatar = chat.avatarUrl || "/avatars/person.png";

        if (!chat.isGroup && chat.participants.length > 0) {
            const other = chat.participants.find((p) => p.user.id !== currentUserId)?.user || chat.participants[0]?.user;
            if (other) {
                name = other.displayName || other.id;
                avatar = "/avatars/person.png";
            }
        }

        return { name, avatar };
    };

    // Calculate menu position so left corner is at the three-dots button
    // and responsive to screen edges
    const handleMenuClick = useCallback((e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        const button = e.currentTarget as HTMLElement;
        const rect = button.getBoundingClientRect();

        const anchor = {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
        setMenuAnchor(anchor);

        const padding = 12;
        const menuWidth = DEFAULT_MENU_SIZE.width;
        const menuHeight = DEFAULT_MENU_SIZE.height;

        // Position: left corner at the button's left edge
        let x = rect.left;
        let y = rect.bottom + 6; // 6px gap below button

        // Responsive: if menu would overflow right edge, align to right
        if (x + menuWidth > window.innerWidth - padding) {
            x = window.innerWidth - menuWidth - padding;
        }

        // Responsive: if menu would overflow left edge
        if (x < padding) {
            x = padding;
        }

        // Responsive: if menu would overflow bottom, show above
        if (y + menuHeight > window.innerHeight - padding) {
            y = rect.top - menuHeight - 6;
        }

        // Ensure y doesn't go negative
        if (y < padding) {
            y = padding;
        }

        setMenuPosition({ x, y });
        setOpenMenuId(openMenuId === chatId ? null : chatId);
    }, [openMenuId]);

    const recalcMenuPosition = useCallback(() => {
        if (!openMenuId || !menuAnchor) return;
        const menuRect = menuRef.current?.getBoundingClientRect();
        const menuSize = menuRect
            ? { width: menuRect.width, height: menuRect.height }
            : DEFAULT_MENU_SIZE;
        const padding = 12;
        let x = menuAnchor.left;
        let y = menuAnchor.bottom + 6;

        if (x + menuSize.width > window.innerWidth - padding) {
            x = window.innerWidth - menuSize.width - padding;
        }
        if (x < padding) {
            x = padding;
        }
        if (y + menuSize.height > window.innerHeight - padding) {
            y = menuAnchor.top - menuSize.height - 6;
        }
        if (y < padding) {
            y = padding;
        }

        setMenuPosition({ x, y });
    }, [openMenuId, menuAnchor]);

    // Close menu when clicking outside or on resize
    useEffect(() => {
        const handleResize = () => setOpenMenuId(null);
        const handleScroll = () => setOpenMenuId(null);
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    useEffect(() => {
        if (!openMenuId) return;
        const raf = window.requestAnimationFrame(() => recalcMenuPosition());
        return () => window.cancelAnimationFrame(raf);
    }, [openMenuId, menuAnchor, recalcMenuPosition]);

    useEffect(() => {
        if (!openMenuId) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpenMenuId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [openMenuId]);

    const handleMenuAction = async (e: React.MouseEvent, action: string, chatId: string) => {
        e.stopPropagation();
        setOpenMenuId(null);

        const token = localStorage.getItem('accessToken');
        if (!token) {
            return;
        }
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        try {
            switch (action) {
                case 'mark_unread':
                    {
                        const res = await fetch(`/api/chats/${chatId}/mark-unread`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ unread: true })
                    });
                        if (res.ok) {
                            onMarkUnread?.(chatId, true);
                        }
                    }
                    break;
                case 'archive':
                    {
                        const res = await fetch(`/api/chats/${chatId}/archive`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ archived: true })
                    });
                        if (res.ok) {
                            onArchiveChat?.(chatId);
                        }
                    }
                    break;
                case 'unarchive':
                    {
                        const res = await fetch(`/api/chats/${chatId}/archive`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ archived: false })
                    });
                        if (res.ok) {
                            onUnarchiveChat?.(chatId);
                        }
                    }
                    break;
                case 'mute':
                    {
                        const res = await fetch(`/api/chats/${chatId}/mute`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ muted: true })
                    });
                        if (res.ok) {
                            onMuteChat?.(chatId);
                        }
                    }
                    break;
                case 'contact_info':
                    onContactInfo?.(chatId);
                    break;
                case 'export':
                    onExportChat?.(chatId);
                    break;
                case 'clear':
                    {
                        const res = await fetch(`/api/chats/${chatId}/clear`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({})
                    });
                        if (res.ok) {
                            onClearChat?.(chatId);
                        }
                    }
                    break;
                case 'delete':
                    {
                        const res = await fetch(`/api/chats/${chatId}`, {
                        method: 'DELETE',
                        headers
                    });
                        if (res.ok) {
                            onDeleteChat?.(chatId);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Menu action failed:', error);
        }
    };

    return (
        <section className="panel-left">
            <div className="chatlist-card">
                <div className="panel-header">
                    <h2>All Message</h2>
                    <button className="btn-primary" type="button" onClick={(e) => onNewMessage?.(e)}>
                        <span className="material-symbols-outlined">edit</span>
                        New Message
                    </button>
                </div>

                <div className="search-row">
                    <div className="search-input">
                        <span className="material-symbols-outlined">search</span>
                        <input
                            placeholder="Search in message"
                            aria-label="Search messages"
                            value={searchValue || ""}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                        />
                    </div>
                    <button
                        className={`icon-btn square ${showArchived ? "is-active" : ""}`}
                        type="button"
                        aria-label="Filter messages"
                        onClick={onToggleArchived}
                    >
                        <span className="material-symbols-outlined">filter_alt</span>
                    </button>
                </div>

                <div className="chat-list overflow-y-auto">
                    {chats.length === 0 ? (
                        <div className="p-4 text-center text-[#a6a4a0] text-sm">No chats yet</div>
                    ) : (
                        chats.map(chat => {
                            const { name, avatar } = getDisplayInfo(chat);
                            const isActive = chat.id === activeChatId;
                            const timeStr = new Date(chat.lastMessage?.createdAt || chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const isMenuOpen = openMenuId === chat.id;
                            const hasUnread = (chat.unreadCount || 0) > 0 || Boolean(chat.me?.unreadMark);
                            const isArchived = Boolean(chat.me?.isArchived);
                            const clearedAt = chat.me?.clearedAt ? new Date(chat.me.clearedAt) : null;
                            const lastMessageAt = chat.lastMessage?.createdAt ? new Date(chat.lastMessage.createdAt) : null;
                            const isCleared = Boolean(clearedAt && lastMessageAt && lastMessageAt <= clearedAt);
                            const rawPreview = chat.lastMessage?.content || (isCleared ? "" : "No messages");
                            const previewText = rawPreview ? truncatePreview(rawPreview, 12) : "";
                            const showPreview = previewText.length > 0;

                            return (
                                <motion.div
                                key={chat.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                transition={{ duration: 0.2 }}
                                    className={`chat-row ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''} ${isArchived ? 'has-archive' : ''} cursor-pointer`}
                                    onClick={() => onSelectChat?.(chat.id, chat)}
                                >
                                    {hasUnread && (
                                        <div className="chat-unread-pill">
                                            <span className="material-symbols-outlined">chat_bubble</span>
                                            Unread
                                        </div>
                                    )}
                                    <div className={`chat-item ${isActive ? 'active' : ''} cursor-pointer relative group`}>
                                        <Avatar name={name} src={avatar} />
                                        <div className="chat-meta flex-1 min-w-0">
                                            <div className="chat-top">
                                                <span className="chat-name truncate">{name}</span>
                                                <span className="chat-time">{timeStr}</span>
                                            </div>
                                            <div className="chat-preview-row">
                                                <span className="chat-preview line-clamp-1">{showPreview ? previewText : ""}</span>
                                                {!hasUnread && showPreview && (
                                                    <span className="material-symbols-outlined chat-read">done_all</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Three dots menu button */}
                                        <button
                                            className={`chat-menu-btn ${isMenuOpen ? 'is-open' : ''}`}
                                            onClick={(e) => handleMenuClick(e, chat.id)}
                                            aria-label="Chat options"
                                            aria-haspopup="menu"
                                            aria-expanded={isMenuOpen}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                    </div>
                                    {isArchived && (
                                        <div className="chat-archive-label">
                                            <span className="material-symbols-outlined">archive</span>
                                            Archive
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Context Menu Portal - rendered at document.body to escape overflow:hidden */}
            {isMounted && ReactDOM.createPortal(
                <>
                    {/* Click outside overlay */}
                    {openMenuId && (
                        <div
                            className="chat-context-overlay"
                            onClick={() => setOpenMenuId(null)}
                        />
                    )}

                    {/* Context Menu */}
                    <AnimatePresence>
                        {openMenuId && menuPosition && (
                            <motion.div
                                ref={menuRef}
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.12, ease: "easeOut" }}
                                className="chat-context-menu"
                                style={{
                                    left: menuPosition.x,
                                    top: menuPosition.y,
                                    width: DEFAULT_MENU_SIZE.width
                                }}
                                onClick={(e) => e.stopPropagation()}
                                role="menu"
                            >
                                {/* Mark as unread */}
                                <button
                                    className="chat-context-item"
                                    onClick={(e) => handleMenuAction(e, 'mark_unread', openMenuId)}
                                    role="menuitem"
                                >
                                    <span className="material-symbols-outlined chat-context-icon">chat_bubble</span>
                                    <span className="chat-context-label">Mark as unread</span>
                                </button>

                                {/* Archive / Unarchive */}
                                {chats.find((chat) => chat.id === openMenuId)?.me?.isArchived ? (
                                    <button
                                        className="chat-context-item"
                                        onClick={(e) => handleMenuAction(e, 'unarchive', openMenuId)}
                                        role="menuitem"
                                    >
                                        <span className="material-symbols-outlined chat-context-icon">unarchive</span>
                                        <span className="chat-context-label">Unarchive</span>
                                    </button>
                                ) : (
                                    <button
                                        className="chat-context-item"
                                        onClick={(e) => handleMenuAction(e, 'archive', openMenuId)}
                                        role="menuitem"
                                    >
                                        <span className="material-symbols-outlined chat-context-icon">archive</span>
                                        <span className="chat-context-label">Archive</span>
                                    </button>
                                )}

                                {/* Mute - with chevron for sub-menu */}
                                <button
                                    className="chat-context-item chat-context-item--submenu"
                                    onClick={(e) => handleMenuAction(e, 'mute', openMenuId)}
                                    role="menuitem"
                                >
                                    <span className="chat-context-start">
                                        <span className="material-symbols-outlined chat-context-icon">volume_off</span>
                                        <span className="chat-context-label">Mute</span>
                                    </span>
                                    <span className="material-symbols-outlined chat-context-chevron">chevron_right</span>
                                </button>

                                {/* Contact info */}
                                <button
                                    className="chat-context-item"
                                    onClick={(e) => handleMenuAction(e, 'contact_info', openMenuId)}
                                    role="menuitem"
                                >
                                    <span className="material-symbols-outlined chat-context-icon">account_circle</span>
                                    <span className="chat-context-label">Contact info</span>
                                </button>

                                {/* Export chat */}
                                <button
                                    className="chat-context-item"
                                    onClick={(e) => handleMenuAction(e, 'export', openMenuId)}
                                    role="menuitem"
                                >
                                    <span className="material-symbols-outlined chat-context-icon">upload</span>
                                    <span className="chat-context-label">Export chat</span>
                                </button>

                                {/* Clear chat */}
                                <button
                                    className="chat-context-item"
                                    onClick={(e) => handleMenuAction(e, 'clear', openMenuId)}
                                    role="menuitem"
                                >
                                    <span className="material-symbols-outlined chat-context-icon">close</span>
                                    <span className="chat-context-label">Clear chat</span>
                                </button>

                                {/* Delete chat - red styling */}
                                <button
                                    className="chat-context-item chat-context-item--danger"
                                    onClick={(e) => handleMenuAction(e, 'delete', openMenuId)}
                                    role="menuitem"
                                >
                                    <span className="material-symbols-outlined chat-context-icon">delete</span>
                                    <span className="chat-context-label">Delete chat</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>,
                document.body
            )}
        </section>
    );
}
