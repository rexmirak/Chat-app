const http = require("http");
const next = require("next");
require("dotenv").config({ path: ".env", override: true });
require("dotenv").config({ path: ".env.local", override: true });
require("dotenv").config({ path: ".env.development", override: true });
const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const getGeminiApiKey = () => {
  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GENAI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY;
  if (!raw) return null;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key || null;
};

let genAIClient = null;
const getGenAIClient = async () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  if (genAIClient) return genAIClient;
  const { GoogleGenAI } = await import("@google/genai");
  genAIClient = new GoogleGenAI({ apiKey });
  return genAIClient;
};

const extractGenAIText = (result) => {
  if (!result) return "";
  if (typeof result.text === "string") return result.text;
  if (typeof result.text === "function") return result.text();
  const candidateText = result?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    .filter(Boolean)
    .join("");
  if (candidateText) return candidateText;
  const responseText = result?.response?.text?.();
  return responseText || "";
};

const buildGeminiHistory = (historyMessages, promptText) => {
  const trimmedPrompt = promptText?.trim();
  const normalized = (historyMessages || []).filter((message) => {
    const text = (message?.content || "").trim();
    return text.length > 0;
  });

  if (trimmedPrompt && normalized.length > 0) {
    const last = normalized[normalized.length - 1];
    if (!last?.sender?.isAiBot && (last.content || "").trim() === trimmedPrompt) {
      normalized.pop();
    }
  }

  return normalized.map((message) => ({
    role: message?.sender?.isAiBot ? "model" : "user",
    parts: [{ text: message.content }],
  }));
};
const AI_EMAIL = "ai-bot@system.local";
const AI_USERNAME = "ai_bot";
const AI_NAME = "CH Assistant";
const AI_AVATAR = "/avatars/person.png";

async function getAiUser() {
  const existing = await prisma.user.findUnique({ where: { email: AI_EMAIL } });
  if (existing) {
    if (!existing.isAiBot || existing.displayName !== AI_NAME || existing.avatarUrl !== AI_AVATAR) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isAiBot: true, displayName: AI_NAME, avatarUrl: AI_AVATAR },
      });
    }
    return existing;
  }
  const passwordHash = await bcrypt.hash("ai-bot", 10);
  return prisma.user.create({
    data: {
      email: AI_EMAIL,
      username: AI_USERNAME,
      passwordHash,
      displayName: AI_NAME,
      isAiBot: true,
      avatarUrl: AI_AVATAR,
    },
  });
}

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const connectionsByUser = new Map();

  const broadcast = (payload) => {
    const message = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  };

  wss.on("connection", async (ws, req) => {
    const baseUrl = `http://${req.headers.host}`;
    const url = new URL(req.url, baseUrl);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const secret = process.env.JWT_SECRET || "";
    if (!secret) {
      ws.close(1011, "Server misconfigured");
      return;
    }

    try {
      const payload = jwt.verify(token, secret);
      const userId = typeof payload === "object" ? payload.sub : null;
      if (!userId) {
        ws.close(1008, "Unauthorized");
        return;
      }
      ws.userId = userId;
    } catch {
      ws.close(1008, "Unauthorized");
      return;
    }

    const current = connectionsByUser.get(ws.userId) || new Set();
    current.add(ws);
    connectionsByUser.set(ws.userId, current);

    let aiUser = null;
    try {
      aiUser = await getAiUser();
    } catch (error) {
      console.error("Failed to ensure AI user", error);
    }

    const onlineSnapshot = Array.from(connectionsByUser.keys()).map((userId) => ({
      userId,
      status: "ONLINE",
      lastSeenAt: null,
    }));

    if (aiUser && !connectionsByUser.has(aiUser.id)) {
      onlineSnapshot.push({ userId: aiUser.id, status: "ONLINE", lastSeenAt: null });
    }
    ws.send(
      JSON.stringify({
        event: "presence:snapshot",
        data: onlineSnapshot,
      })
    );

    broadcast({
      event: "user:status",
      data: { userId: ws.userId, status: "ONLINE", lastSeenAt: null },
    });

    ws.on("message", async (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (err) {
        console.error("Failed to parse WS message", err);
        return;
      }

      const { event, data: payload } = parsed;

      if (event === "chat:message") {
        const { chatId, type = "TEXT", content, attachments } = payload;

        try {
          // verify participation
          const participant = await prisma.chatParticipant.findUnique({
            where: {
              chatId_userId: {
                chatId,
                userId: ws.userId,
              },
            },
          });

          if (!participant) {
            ws.send(JSON.stringify({ event: "error", data: { message: "Not a member of this chat" } }));
            return;
          }

          // Create message in DB
          const message = await prisma.message.create({
            data: {
              chatId,
              senderId: ws.userId,
              type,
              content,
              attachments: {
                create: attachments?.map((a) => ({
                  type: a.type,
                  url: a.url,
                  filename: a.filename,
                  sizeBytes: a.sizeBytes,
                  mimeType: a.mimeType,
                  width: a.width,
                  height: a.height,
                  durationMs: a.durationMs,
                })) || [],
              },
            },
            include: {
              attachments: true,
              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                }
              }
            }
          });

          // Get all participants to broadcast to and decide notifications
          const participants = await prisma.chatParticipant.findMany({
            where: { chatId },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  notificationsOn: true,
                  isAiBot: true,
                },
              },
            },
          });

          const formattedMessage = {
            event: "chat:message",
            data: message,
          };

          const payloadStr = JSON.stringify(formattedMessage);

          for (const p of participants) {
            const userConnections = connectionsByUser.get(p.userId);
            if (userConnections) {
              for (const client of userConnections) {
                if (client.readyState === 1) {
                  client.send(payloadStr);
                }
              }
            }
          }

          const notificationTargets = participants.filter(
            (p) => p.userId !== ws.userId && p.user?.notificationsOn
          );

          if (notificationTargets.length > 0) {
            const senderName = message.sender?.displayName || "New message";
            const preview =
              message.content ||
              (message.attachments && message.attachments.length > 0
                ? "Sent an attachment"
                : "Sent a message");
            await prisma.notification.createMany({
              data: notificationTargets.map((p) => ({
                userId: p.userId,
                type: "MESSAGE",
                title: senderName,
                body: preview,
                metadata: JSON.stringify({ chatId, messageId: message.id }),
              })),
            });
          }

          // Update chat updated_at
          await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() }
          });

          const aiParticipant = participants.find((p) => p.user?.isAiBot);
          const shouldAutoAi =
            aiParticipant &&
            ws.userId !== aiParticipant.userId &&
            typeof content === "string" &&
            content.trim().length > 0 &&
            type === "TEXT";

          if (shouldAutoAi) {
            const apiKey = getGeminiApiKey();
            if (!apiKey) {
              ws.send(JSON.stringify({ event: "chat:ai:error", data: { message: "Missing Gemini API key" } }));
              return;
            }

            try {
              const aiUser = await getAiUser();

              const recentMessages = await prisma.message.findMany({
                where: { chatId },
                orderBy: { createdAt: "desc" },
                take: 12,
                include: {
                  sender: { select: { displayName: true, isAiBot: true } },
                },
              });

              const chronological = [...recentMessages].reverse();
              const history = buildGeminiHistory(chronological, content);

              const genAIClient = await getGenAIClient();
              if (!genAIClient) {
                ws.send(JSON.stringify({ event: "chat:ai:error", data: { message: "Missing Gemini API key" } }));
                return;
              }
              const chatSession = genAIClient.chats.create({
                model: "gemini-2.5-flash",
                history,
              });
              const result = await chatSession.sendMessage({ message: content });
              const responseText = extractGenAIText(result);
              if (!responseText.trim()) {
                throw new Error("Empty response from Gemini");
              }

              const aiMessage = await prisma.message.create({
                data: {
                  chatId,
                  senderId: aiUser.id,
                  type: "AI",
                  content: responseText,
                },
                include: {
                  attachments: true,
                  sender: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      avatarUrl: true,
                      isAiBot: true,
                    },
                  },
                },
              });

              const aiPayloadStr = JSON.stringify({ event: "chat:message", data: aiMessage });
              for (const p of participants) {
                const userConnections = connectionsByUser.get(p.userId);
                if (userConnections) {
                  for (const client of userConnections) {
                    if (client.readyState === 1) {
                      client.send(aiPayloadStr);
                    }
                  }
                }
              }

              await prisma.chat.update({
                where: { id: chatId },
                data: { updatedAt: new Date() },
              });
            } catch (error) {
              console.error("AI auto-response failed", error);
              ws.send(JSON.stringify({
                event: "chat:ai:error",
                data: { message: error?.message || "AI generation failed" }
              }));
            }
          }

        } catch (err) {
          console.error("Error handling chat:message", err);
          ws.send(JSON.stringify({ event: "error", data: { message: "Internal server error" } }));
        }
      } else if (event === "chat:ai") {
        const { chatId, prompt } = payload || {};
        if (!chatId || !prompt) {
          ws.send(JSON.stringify({ event: "chat:ai:error", data: { message: "Missing chatId or prompt" } }));
          return;
        }
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
          ws.send(JSON.stringify({ event: "chat:ai:error", data: { message: "Missing Gemini API key" } }));
          return;
        }
        try {
          const participant = await prisma.chatParticipant.findUnique({
            where: {
              chatId_userId: {
                chatId,
                userId: ws.userId,
              },
            },
          });

          if (!participant) {
            ws.send(JSON.stringify({ event: "chat:ai:error", data: { message: "Not a member of this chat" } }));
            return;
          }

          const aiUser = await getAiUser();

          const recentMessages = await prisma.message.findMany({
            where: { chatId },
            orderBy: { createdAt: "desc" },
            take: 12,
            include: {
              sender: { select: { displayName: true, isAiBot: true } },
            },
          });

          const chronological = [...recentMessages].reverse();
          const history = buildGeminiHistory(chronological, prompt);

          const genAIClient = await getGenAIClient();
          if (!genAIClient) {
            ws.send(JSON.stringify({ event: "chat:ai:error", data: { message: "Missing Gemini API key" } }));
            return;
          }
          const chatSession = genAIClient.chats.create({
            model: "gemini-2.5-flash",
            history,
          });
          const result = await chatSession.sendMessage({ message: prompt });
          const responseText = extractGenAIText(result);

          const aiMessage = await prisma.message.create({
            data: {
              chatId,
              senderId: aiUser.id,
              type: "AI",
              content: responseText,
            },
            include: {
              attachments: true,
              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isAiBot: true,
                },
              },
            },
          });

          const participants = await prisma.chatParticipant.findMany({
            where: { chatId },
            select: { userId: true },
          });

          const payloadStr = JSON.stringify({ event: "chat:message", data: aiMessage });

          for (const p of participants) {
            const userConnections = connectionsByUser.get(p.userId);
            if (userConnections) {
              for (const client of userConnections) {
                if (client.readyState === 1) {
                  client.send(payloadStr);
                }
              }
            }
          }

          await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });
        } catch (err) {
          console.error("Error handling chat:ai", err);
          ws.send(JSON.stringify({
            event: "chat:ai:error",
            data: { message: err?.message || "AI generation failed" }
          }));
        }
      } else if (event === "chat:typing") {
        const { chatId, isTyping } = payload;
        // Broadcast typing status to chat participants (excluding self)
        try {
          const participants = await prisma.chatParticipant.findMany({
            where: { chatId },
            select: { userId: true },
          });

          const typingPayload = JSON.stringify({
            event: "chat:typing",
            data: { chatId, userId: ws.userId, isTyping }
          });

          for (const p of participants) {
            // Don't echo back to sender for typing (optional, but usually cleaner)
            if (p.userId === ws.userId) continue;

            const userConnections = connectionsByUser.get(p.userId);
            if (userConnections) {
              for (const client of userConnections) {
                if (client.readyState === 1) {
                  client.send(typingPayload);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error broadcast typing", err);
        }
      }
    });

    ws.on("close", async () => {
      const set = connectionsByUser.get(ws.userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          connectionsByUser.delete(ws.userId);
          const lastSeenAt = new Date();
          try {
            await prisma.user.update({
              where: { id: ws.userId },
              data: { lastSeenAt },
            });
          } catch {
            // ignore DB errors in presence update
          }
          broadcast({
            event: "user:status",
            data: { userId: ws.userId, status: "OFFLINE", lastSeenAt: lastSeenAt.toISOString() },
          });
        }
      }
    });
  });
}

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => handle(req, res));
    setupWebSocket(server);

    server.listen(port, () => {
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
