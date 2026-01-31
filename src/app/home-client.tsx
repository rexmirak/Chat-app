/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatList, ChatPreview } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InfoPanel } from "@/components/chat/InfoPanel";
import { Avatar } from "@/components/ui/Avatar";
import { jwtDecode } from "jwt-decode";

type User = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isAiBot: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  isRead: boolean;
  chatId?: string;
  source?: "server" | "local";
};

type JwtPayload = {
  sub: string;
};

type NotificationPayload = {
  id: string;
  title?: string;
  body?: string | null;
  createdAt: string;
  isRead?: boolean;
  metadata?: string | null;
};

type WsPresence = {
  userId: string;
  status?: string;
  lastSeenAt?: string | null;
};

type WsChatMessage = {
  id?: string;
  chatId: string;
  senderId: string;
  content?: string;
  createdAt: string;
  type?: string;
  sender?: {
    displayName?: string;
    isAiBot?: boolean;
  };
};

// ... imports ...
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [presenceByUser, setPresenceByUser] = useState<Record<string, { status: string; lastSeenAt?: string | null }>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const newMessageRef = useRef<HTMLDivElement | null>(null);
  const activeChatIdRef = useRef<string | undefined>(undefined);
  const chatSearchRef = useRef("");
  const showArchivedRef = useRef(false);
  const currentUserIdRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
  // ... existing state ...

  // Responsive State
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "info">("list");

  // UI State for overlays (Profile, Context, etc.)
  const [uiState, setUiState] = useState<"base" | "profile" | "context" | "info" | "new-message">("base");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close overlays when clicking outside (simple version: click anywhere on shell resets to base if not ignored)
  // For now, let's rely on explicit toggles or close buttons.

  // When a chat is selected
  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    if (isMobile) {
      setMobileView("chat");
    }
    markChatRead(id);
    router.replace(`/?chatId=${id}`, { scroll: false });
  };

  const markChatRead = async (chatId: string) => {
    try {
      const res = await fetchWithAuth(`/api/chats/${chatId}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        updateChat(chatId, (chat) => ({
          ...chat,
          unreadCount: 0,
          me: { ...(chat.me || {}), unreadMark: false }
        }));
      }
    } catch (error) {
      console.error("Failed to mark chat read", error);
    }
  };

  const handleBackToList = () => {
    setActiveChatId(undefined);
    setMobileView("list");
    router.replace("/", { scroll: false });
  };

  // ... rest of logic ...

  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [newChatQuery, setNewChatQuery] = useState("");
  const [newMessageAnchor, setNewMessageAnchor] = useState<{ x: number; y: number } | null>(null);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const chatIdsRef = useRef<Set<string>>(new Set());
  const chatListSignatureRef = useRef<string>("");

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    chatSearchRef.current = chatSearch;
  }, [chatSearch]);

  useEffect(() => {
    showArchivedRef.current = showArchived;
  }, [showArchived]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      setCurrentUserId(decoded.sub);
      setAccessToken(token);
      currentUserIdRef.current = decoded.sub;
    } catch {
      localStorage.removeItem("accessToken");
      router.push("/login");
      return;
    }

    setLoading(false);
  }, [router]);

  const refreshAccessToken = async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const refreshPromise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.accessToken) return null;
        localStorage.setItem("accessToken", data.accessToken);
        setAccessToken(data.accessToken);
        return data.accessToken as string;
      } catch {
        return null;
      }
    })();
    refreshInFlightRef.current = refreshPromise;
    const token = await refreshPromise;
    refreshInFlightRef.current = null;
    if (!token) {
      localStorage.removeItem("accessToken");
      router.push("/login");
    }
    return token;
  };

  const fetchWithAuth = async (input: RequestInfo, init: RequestInit = {}) => {
    const token = accessToken || localStorage.getItem("accessToken");
    if (!token) {
      return new Response(null, { status: 401 });
    }
    const headers: HeadersInit = {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`
    };
    const res = await fetch(input, { ...init, headers });
    if (res.status !== 401) return res;
    const refreshed = await refreshAccessToken();
    if (!refreshed) return res;
    const retryHeaders: HeadersInit = {
      ...(init.headers || {}),
      Authorization: `Bearer ${refreshed}`
    };
    return fetch(input, { ...init, headers: retryHeaders });
  };

  useEffect(() => {
    if (!accessToken) return;
    const chatIdParam = searchParams.get("chatId");
    if (!chatIdParam || activeChatId) return;
    if (chats.some((chat) => chat.id === chatIdParam)) {
      setActiveChatId(chatIdParam);
      if (isMobile) {
        setMobileView("chat");
      }
    }
  }, [accessToken, searchParams, chats, activeChatId, isMobile]);

  const fetchChats = async (
    options: { q?: string; archived?: boolean; detectNew?: boolean } = {}
  ) => {
    try {
      const params = new URLSearchParams();
      if (options.q) params.set("q", options.q);
      if (typeof options.archived === "boolean") {
        params.set("archived", String(options.archived));
      }
      const url = params.toString() ? `/api/chats?${params.toString()}` : "/api/chats";
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        const shouldTrack = !options.q && !options.archived;
        const nextIds = new Set<string>(data.chats.map((chat: ChatPreview) => chat.id));
        const prevIds = chatIdsRef.current;
        if (options.detectNew && shouldTrack && prevIds.size > 0) {
          const newChats = data.chats.filter((chat: ChatPreview) => !prevIds.has(chat.id));
          if (newChats.length > 0) {
            newChats.forEach((chat: ChatPreview) => {
              const other = chat.participants.find((p) => p.user.id !== currentUserIdRef.current)?.user;
              const title = chat.title || other?.displayName || "New chat";
              mergeNotifications([
                {
                  id: `local-chat-${chat.id}`,
                  title: "New chat",
                  body: `You have a new chat with ${title}.`,
                  createdAt: new Date().toISOString(),
                  isRead: false,
                  chatId: chat.id,
                  source: "local"
                }
              ]);
            });
          }
        }
        if (shouldTrack) {
          chatIdsRef.current = nextIds;
        }
        const signature = data.chats
          .map((chat: ChatPreview) => [
            chat.id,
            chat.updatedAt,
            chat.unreadCount ?? 0,
            chat.me?.unreadMark ? 1 : 0,
            chat.me?.isArchived ? 1 : 0,
            chat.lastMessage?.id || "",
            chat.lastMessage?.createdAt || "",
          ].join("|"))
          .join(";");

        if (signature !== chatListSignatureRef.current) {
          chatListSignatureRef.current = signature;
          setChats(data.chats);
        }
      }
    } catch (error) {
      console.error("Failed to fetch chats", error);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    const handle = window.setTimeout(() => {
      fetchChats({ q: chatSearch.trim(), archived: showArchived });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [accessToken, chatSearch, showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!accessToken) return;
    if (chatSearch.trim() || showArchived) return;
    const interval = window.setInterval(() => {
      fetchChats({ archived: false, detectNew: true });
    }, 12000);
    return () => window.clearInterval(interval);
  }, [accessToken, chatSearch, showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!accessToken) return;
    fetchNotifications();
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async (query?: string) => {
    try {
      const url = query
        ? `/api/users?q=${encodeURIComponent(query)}`
        : "/api/users";

      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const mergeNotifications = (incoming: NotificationItem[]) => {
    setNotifications((prev) => {
      const map = new Map<string, NotificationItem>();
      incoming.forEach((item) => map.set(item.id, item));
      prev.forEach((item) => {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      });
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetchWithAuth("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const items: NotificationPayload[] = Array.isArray(data.notifications)
          ? (data.notifications as NotificationPayload[])
          : [];
        const normalized: NotificationItem[] = items.map((item) => {
          let chatId: string | undefined;
          if (typeof item.metadata === "string") {
            try {
              const parsed = JSON.parse(item.metadata);
              chatId = parsed?.chatId;
            } catch {
              chatId = undefined;
            }
          }
          return {
            id: item.id,
            title: item.title || "Notification",
            body: item.body,
            createdAt: item.createdAt,
            isRead: Boolean(item.isRead),
            chatId,
            source: "server"
          };
        });
        mergeNotifications(normalized);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  };

  const markNotificationsRead = async () => {
    try {
      await fetchWithAuth("/api/notifications/mark-read", { method: "POST" });
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      console.error("Failed to mark notifications read", error);
    }
  };

  const handleCreateChat = async (participantId: string) => {
    try {
      const res = await fetchWithAuth("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId })
      });

      if (res.ok) {
        const data = await res.json();
        await fetchChats({ q: chatSearch.trim(), archived: showArchived }); // Refresh list
        setActiveChatId(data.chatId);
        setUiState('base'); // Close modal
      }
    } catch (error) {
      console.error("Failed to create chat", error);
    }
  };



  // Modified handleOpenNewChat to use uiState
  const handleOpenNewChat = () => {
    setUiState("new-message");
    setNewChatQuery("");
    fetchUsers();
  };

  // Debounce search could be better, but simple onChange for now
  const handleSearchUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewChatQuery(value);
    fetchUsers(value);
  }

  const handleOpenNewChatFromButton = (event?: React.MouseEvent<HTMLButtonElement>) => {
    handleOpenNewChat();
    if (!event) {
      setNewMessageAnchor(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const dropdownWidth = 240;
    const dropdownHeight = 320;
    const padding = 12;
    let x = rect.left;
    let y = rect.bottom + 8;
    if (x + dropdownWidth > window.innerWidth - padding) {
      x = window.innerWidth - dropdownWidth - padding;
    }
    if (x < padding) {
      x = padding;
    }
    if (y + dropdownHeight > window.innerHeight - padding) {
      y = rect.top - dropdownHeight - 8;
    }
    if (y < padding) {
      y = padding;
    }
    setNewMessageAnchor({ x, y });
  };

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notificationsOpen]);

  useEffect(() => {
    if (uiState !== "profile" && uiState !== "new-message") return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (uiState === "profile" && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setUiState("base");
      }
      if (uiState === "new-message" && newMessageRef.current && !newMessageRef.current.contains(target)) {
        setUiState("base");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [uiState]);

  const handleToggleNotifications = () => {
    setUiState("base");
    setNotificationsOpen((prev) => !prev);
    if (accessToken && !notificationsOpen) {
      fetchNotifications();
      markNotificationsRead();
    }
  };

  const updateChat = (chatId: string, updater: (chat: ChatPreview) => ChatPreview) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? updater(chat) : chat)));
  };

  const removeChatFromList = (chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(undefined);
      setUiState("base");
      if (isMobile) {
        setMobileView("list");
      }
    }
  };

  const handleMarkUnread = (chatId: string, unread: boolean) => {
    updateChat(chatId, (chat) => ({
      ...chat,
      unreadCount: unread ? Math.max(chat.unreadCount || 0, 1) : 0,
      me: { ...(chat.me || {}), unreadMark: unread }
    }));
  };

  const handleArchiveChat = (chatId: string) => {
    updateChat(chatId, (chat) => ({
      ...chat,
      me: { ...(chat.me || {}), isArchived: true }
    }));
    if (showArchived && accessToken) {
      fetchChats({ q: chatSearch.trim(), archived: true });
    }
  };

  const handleUnarchiveChat = (chatId: string) => {
    updateChat(chatId, (chat) => ({
      ...chat,
      me: { ...(chat.me || {}), isArchived: false }
    }));
    if (showArchived) {
      removeChatFromList(chatId);
    }
  };

  const handleDeleteChat = (chatId: string) => {
    removeChatFromList(chatId);
  };

  const handleClearChat = (chatId: string) => {
    updateChat(chatId, (chat) => ({
      ...chat,
      lastMessage: null,
      unreadCount: 0
    }));
    if (activeChatIdRef.current === chatId) {
      setChatRefreshKey((prev) => prev + 1);
    }
  };

  const handleMuteChat = (chatId: string) => {
    updateChat(chatId, (chat) => ({
      ...chat,
      me: { ...(chat.me || {}), isMuted: true }
    }));
  };

  const handleContactInfo = (chatId: string) => {
    setActiveChatId(chatId);
    setUiState("info");
    if (isMobile) {
      setMobileView("info");
    }
  };

  const handleExportChat = async (chatId: string) => {
    try {
      const res = await fetchWithAuth(`/api/chats/${chatId}/messages`);

      if (!res.ok) {
        console.error("Failed to export chat", await res.text());
        return;
      }

      const data = await res.json();
      const messages = data.messages || [];
      const blob = new Blob([JSON.stringify(messages, null, 2)], {
        type: "application/json"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chat-${chatId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export chat", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Failed to logout", error);
    } finally {
      localStorage.removeItem("accessToken");
      router.push("/login");
    }
  };

  const playNotificationSound = () => {
    try {
      const AudioContextCtor =
        window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = context;
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }

      const playTone = (startTime: number, frequency: number) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.22);
      };

      const now = context.currentTime;
      playTone(now, 880);
      playTone(now + 0.26, 660);
    } catch (error) {
      console.error("Notification sound failed", error);
    }
  };

  useEffect(() => {
    if (!accessToken) return;

    let attempts = 0;
    let shouldReconnect = true;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${accessToken}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempts = 0;
      };

      ws.onmessage = (event) => {
        let payload: { event?: string; data?: unknown };
        try {
          payload = JSON.parse(event.data) as { event?: string; data?: unknown };
        } catch (err) {
          console.error("WS message parse error", err);
          return;
        }

        if (payload.event === "user:status") {
          const { userId, status, lastSeenAt } = (payload.data || {}) as {
            userId?: string;
            status?: string;
            lastSeenAt?: string | null;
          };
          if (!userId) return;
          setPresenceByUser((prev) => ({
            ...prev,
            [userId]: { status: status || "ONLINE", lastSeenAt }
          }));
          return;
        }

        if (payload.event === "presence:snapshot") {
          const list = Array.isArray(payload.data) ? (payload.data as WsPresence[]) : [];
          setPresenceByUser((prev) => {
            const next = { ...prev };
            list.forEach((entry) => {
              if (entry?.userId) {
                next[entry.userId] = { status: entry.status || "ONLINE", lastSeenAt: entry.lastSeenAt ?? null };
              }
            });
            return next;
          });
          return;
        }

        if (payload.event === "chat:message") {
            const message = payload.data as WsChatMessage | undefined;
            if (!message?.chatId) return;

          setChats((prev) => {
            const chatIndex = prev.findIndex((chat) => chat.id === message.chatId);
            if (chatIndex === -1) {
              if (accessToken) {
                fetchChats({ archived: showArchivedRef.current, detectNew: true });
              }
              return prev;
            }

            const currentChat = prev[chatIndex];
            const isFromSelf = message.senderId === currentUserIdRef.current;
            const isActive = activeChatIdRef.current === message.chatId;

            const nextChat = {
              ...currentChat,
              lastMessage: {
                id: message.id,
                content: message.content ?? null,
                type: message.type || "TEXT",
                createdAt: message.createdAt,
              },
              updatedAt: message.createdAt,
              unreadCount: isFromSelf || isActive ? 0 : (currentChat.unreadCount || 0) + 1
            };

            const next = [...prev];
            next.splice(chatIndex, 1);
            if (!chatSearchRef.current.trim()) {
              next.unshift(nextChat);
            } else {
              next.splice(chatIndex, 0, nextChat);
            }

            if (!isFromSelf && !isActive && !currentChat.me?.isMuted) {
              playNotificationSound();
              const notificationId = message.id ? `local-${message.id}` : `local-${Date.now()}`;
              const title =
                currentChat.title ||
                currentChat.participants?.find((p) => p.user.id !== currentUserIdRef.current)?.user?.displayName ||
                "New message";
              const createdAt = message.createdAt || new Date().toISOString();
              const body = message.content || "You received a new message.";
              mergeNotifications([
                {
                  id: notificationId,
                  title,
                  body,
                  createdAt,
                  isRead: false,
                  chatId: message.chatId,
                  source: "local"
                }
              ]);
            }

            if (!isFromSelf && isActive) {
              markChatRead(message.chatId);
            }

            return next;
          });
        }
      };

      ws.onclose = () => {
        if (!shouldReconnect) return;
        attempts += 1;
        const timeout = Math.min(10000, 500 * Math.pow(2, attempts));
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(connect, timeout);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ...

  const activeChat = chats.find(c => c.id === activeChatId);
  const contactMap = useMemo(() => {
    const map = new Map<string, User>();
    chats.forEach((chat) => {
      chat.participants.forEach((participant) => {
        if (participant.user.id !== currentUserId) {
          map.set(participant.user.id, {
            id: participant.user.id,
            username: participant.user.username || participant.user.id,
            displayName: participant.user.displayName,
            avatarUrl: "/avatars/person.png",
            isAiBot: participant.user.isAiBot,
          });
        }
      });
    });
    return map;
  }, [chats, currentUserId]);
  const existingContacts = useMemo(() => Array.from(contactMap.values()), [contactMap]);
  const newChatQueryLower = newChatQuery.trim().toLowerCase();
  const matchesQuery = (user: User) => {
    if (!newChatQueryLower) return true;
    return (
      user.displayName.toLowerCase().includes(newChatQueryLower) ||
      user.username.toLowerCase().includes(newChatQueryLower)
    );
  };
  const filteredContacts = existingContacts.filter(matchesQuery);
  const discoverUsers = users.filter((user) => !contactMap.has(user.id) && matchesQuery(user));
  const hasUnreadNotifications =
    notifications.some((item) => !item.isRead) ||
    chats.some((chat) => (chat.unreadCount || 0) > 0 || Boolean(chat.me?.unreadMark));

  const getContactInfo = () => {
    if (!activeChat) return { id: undefined, name: "Contact", email: undefined, avatar: undefined };
    if (!activeChat.isGroup && activeChat.participants.length > 0) {
      const other = activeChat.participants.find(p => p.user.id !== currentUserId)?.user;
      const target = other || activeChat.participants[0]?.user;
      if (target) {
        const email = target.email || (target.username ? `@${target.username}` : undefined);
        return {
          id: target.id,
          name: target.displayName || "Contact",
          email,
          avatar: "/avatars/person.png"
        };
      }
    }
    return {
      id: undefined,
      name: activeChat.title || "Group chat",
      email: undefined,
      avatar: activeChat.avatarUrl || "/avatars/person.png"
    };
  };

  // Helper to get chat title/avatar for the window
  const getActiveChatDetails = () => {
    if (!activeChat) return {};
    let title = activeChat.title || "Chat";
    let avatar = activeChat.avatarUrl || "/avatars/person.png";

    if (!activeChat.isGroup && activeChat.participants.length > 0) {
      const other = activeChat.participants.find(p => p.user.id !== currentUserId)?.user;
      const target = other || activeChat.participants[0].user;

      if (target) {
        title = target.displayName;
        avatar = "/avatars/person.png";
      }
    }
    return { title, avatar };
  };

  const { title: chatTitle, avatar: chatAvatar } = getActiveChatDetails();
  const { id: contactId, name: contactName, email: contactEmail, avatar: contactAvatar } = getContactInfo();
  const contactIsAi =
    !!activeChat &&
    !activeChat.isGroup &&
    activeChat.participants.some((p) => p.user.id !== currentUserId && p.user.isAiBot);
  const contactStatus = contactIsAi ? "ONLINE" : contactId ? presenceByUser[contactId]?.status : undefined;

  if (loading) return null;

  return (
    <div className="canvas">
      <div
        className="app-shell"
        data-state={uiState}
      >

        {/* Sidebar - Handles its own responsive visibility */}
        <Sidebar />

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-icon material-symbols-outlined">chat_bubble</span>
            <span className="topbar-title">Message</span>
          </div>

          <div className="topbar-search">
            <span className="material-symbols-outlined">search</span>
            <input placeholder="Search" aria-label="Search" />
            <span className="shortcut">⌘ K</span>
          </div>

          <div className="topbar-actions">
            {/* Notification Icon */}
            <div className="notifications-wrap" ref={notificationsRef}>
              <button
                className={`icon-btn notification-btn ${notificationsOpen ? "is-active" : ""} ${hasUnreadNotifications ? "has-unread" : ""}`}
                title="Notifications"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleNotifications();
                }}
                aria-haspopup="menu"
                aria-expanded={notificationsOpen}
              >
                <span className="material-symbols-outlined">notifications</span>
                {hasUnreadNotifications && <span className="notification-dot" />}
              </button>
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    className="notifications-menu"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    role="menu"
                  >
                    <div className="notifications-header">
                      <span>Notifications</span>
                      {hasUnreadNotifications && <span className="notifications-pill">New</span>}
                    </div>
                    <div className="notifications-list">
                      {notifications.length === 0 && (
                        <div className="notifications-empty">No new notifications yet.</div>
                      )}
                      {notifications.map((item) => {
                        const time = new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                        return (
                          <button
                            key={item.id}
                            className={`notifications-item ${item.isRead ? "" : "is-unread"}`}
                            onClick={() => {
                              if (item.chatId) {
                                handleSelectChat(item.chatId);
                              }
                              setNotificationsOpen(false);
                            }}
                            role="menuitem"
                          >
                            <div className="notifications-item-head">
                              <span className="notifications-item-title">{item.title}</span>
                              <span className="notifications-item-time">{time}</span>
                            </div>
                            {item.body && <div className="notifications-item-body">{item.body}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Settings Icon */}
            <button className="icon-btn" title="Settings">
              <span className="material-symbols-outlined">settings</span>
            </button>

            {/* Info Toggle for Tablet/Desktop if needed, or Mobile */}
            {isMobile && (
              <button className="icon-btn" onClick={() => setUiState(uiState === 'info' ? 'base' : 'info')}>
                <span className="material-symbols-outlined">info</span>
              </button>
            )}

            <div className="topbar-user">
              <button
                className={`avatar-button ${uiState === 'profile' ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setUiState(uiState === 'profile' ? 'base' : 'profile');
                }}
              >
                <Avatar name="You" src="/avatars/person.png" className="small" />
              </button>
              <button
                className="topbar-caret"
                onClick={(e) => {
                  e.stopPropagation();
                  setUiState(uiState === 'profile' ? 'base' : 'profile');
                }}
                aria-label="Profile menu"
              >
                <span className="material-symbols-outlined">expand_more</span>
              </button>
            </div>
          </div>
        </header>

        {/* Messaging Area */}
        {(!isMobile || (mobileView === "list" && uiState !== 'info')) && (
          <ChatList
            chats={chats}
            activeChatId={activeChatId}
            currentUserId={currentUserId}
            onSelectChat={handleSelectChat}
            onNewMessage={handleOpenNewChatFromButton}
            searchValue={chatSearch}
            onSearchChange={setChatSearch}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived((prev) => !prev)}
            onMarkUnread={handleMarkUnread}
            onArchiveChat={handleArchiveChat}
            onUnarchiveChat={handleUnarchiveChat}
            onDeleteChat={handleDeleteChat}
            onClearChat={handleClearChat}
            onMuteChat={handleMuteChat}
            onContactInfo={handleContactInfo}
            onExportChat={handleExportChat}
          />
        )}

        {(!isMobile || mobileView === "chat") && (
          activeChatId ? (
            <div className="panel-main">
              {isMobile && (
                <button onClick={handleBackToList} className="absolute top-4 left-4 z-20 p-2 bg-white rounded-full shadow-md text-gray-600">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
              )}
              {/* Add Info Button on Chat Header for mobile? */}

              <ChatWindow
                key={activeChatId}
                chatId={activeChatId}
                currentUserId={currentUserId}
                chatTitle={chatTitle}
                chatAvatar={chatAvatar}
                contactStatus={contactStatus}
                contactIsAi={contactIsAi}
                refreshKey={chatRefreshKey}
                onInfoClick={() => {
                  setUiState('info');
                  if (isMobile) {
                    setMobileView('info');
                  }
                }}
              />
            </div>
          ) : (
            !isMobile && (
              <main className="panel-main">
                <div className="chat-empty">
                  <div className="chat-empty-orb orb-a" />
                  <div className="chat-empty-orb orb-b" />
                  <div className="chat-empty-card">
                    <div className="chat-empty-icon">
                      <span className="material-symbols-outlined">chat_bubble</span>
                    </div>
                    <div className="chat-empty-content">
                      <div className="chat-empty-tag">Welcome</div>
                      <h2>Start a new conversation</h2>
                      <p>Your inbox is clear. Create a new chat to send a message, share files, or start a call.</p>
                    </div>
                    <button className="chat-empty-btn" onClick={handleOpenNewChatFromButton}>
                      <span className="material-symbols-outlined">add_comment</span>
                      Start New Chat
                    </button>
                  </div>
                </div>
              </main>
            )
          )
        )}

        {/* Info Panel - Only shows when a chat is active and user clicks to view info */}
        {activeChatId && uiState === 'info' && (
          <>
            <div
              className="info-overlay"
              onClick={() => {
                setUiState('base');
                if (isMobile) {
                  setMobileView('chat');
                }
              }}
            />
            <InfoPanel
              chatId={activeChatId}
              contactName={contactName}
              contactEmail={contactEmail}
              contactAvatar={contactAvatar}
              onClose={() => {
                setUiState('base');
                if (isMobile) {
                  setMobileView('chat');
                }
              }}
            />
          </>
        )}

        {/* Profile Menu Overlay */}
        {uiState === 'profile' && (
          <div className="profile-menu" ref={profileMenuRef}>
            <div
              className="menu-item cursor-pointer hover:bg-gray-50 rounded-lg text-red-500"
              onClick={handleLogout}
            >
              <span className="material-symbols-outlined">logout</span>
              Log out
            </div>
          </div>
        )}

        {/* New Chat Modal - Dropdown from button */}
        {uiState === 'new-message' && (
          <div
            className="new-message-popup z-50 shadow-2xl"
            ref={newMessageRef}
            style={
              newMessageAnchor
                ? {
                    position: "fixed",
                    left: newMessageAnchor.x,
                    top: newMessageAnchor.y,
                    transform: "none"
                  }
                : {
                    position: "fixed",
                    left: "50%",
                    top: "20%",
                    transform: "translate(-50%, 0)"
                  }
            }
          >
            {/* Note: User asked to remove backdrop. We rely on click-outside or close btn */}
            <div className="popup-title">
              <button
                className="popup-close"
                onClick={() => setUiState('base')}
                aria-label="Close new message"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <span>New Message</span>
            </div>

            <div className="search-input small mb-2 border hover:border-emerald-500 transition-colors">
              <span className="material-symbols-outlined text-gray-400">search</span>
              <input
                placeholder="Search people..."
                autoFocus
                value={newChatQuery}
                onChange={handleSearchUsers}
              />
            </div>

            {filteredContacts.length > 0 && (
              <>
                <div className="popup-section-label">Recent contacts</div>
                <div className="popup-list">
                  {filteredContacts.map(user => (
                    <div key={user.id} className="popup-item cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleCreateChat(user.id)}>
                      <span className="popup-avatar">
                        <img src="/avatars/person.png" alt={user.displayName} />
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold">{user.displayName}</span>
                        <span className="text-[10px] text-gray-400">@{user.username}</span>
                      </div>
                      {user.isAiBot && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-auto">BOT</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="popup-section-label">Discover people</div>
            <div className="popup-list max-h-60 overflow-y-auto">
              {discoverUsers.length === 0 && (
                <div className="text-xs text-center text-gray-400 py-4">No users found</div>
              )}
              {discoverUsers.map(user => (
                <div key={user.id} className="popup-item cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleCreateChat(user.id)}>
                  <span className="popup-avatar">
                    <img src="/avatars/person.png" alt={user.displayName} />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold">{user.displayName}</span>
                    <span className="text-[10px] text-gray-400">@{user.username}</span>
                  </div>
                  {user.isAiBot && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-auto">BOT</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="screen-warning">
        <div className="screen-warning-content">
          <h2>Desktop only</h2>
          <p>This MVP is optimized for larger screens. Please use a tablet or desktop view.</p>
        </div>
      </div>
    </div>
  );
}
