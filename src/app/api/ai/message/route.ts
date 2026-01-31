import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

type GenAITextResponse = {
  text?: string | (() => string);
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  response?: { text?: () => string };
};

type HistoryMessage = {
  content?: string | null;
  sender?: {
    isAiBot?: boolean;
  };
};

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

const extractGenAIText = (result?: GenAITextResponse | null) => {
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

const buildGeminiHistory = (historyMessages: HistoryMessage[], promptText?: string): Content[] => {
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

  return normalized.reduce<Content[]>((acc, message) => {
    const text = (message?.content || "").trim();
    if (!text) return acc;
    acc.push({
      role: message?.sender?.isAiBot ? "model" : "user",
      parts: [{ text }],
    });
    return acc;
  }, []);
};
const AI_EMAIL = "ai-bot@system.local";
const AI_USERNAME = "ai_bot";
const AI_NAME = "CH Assistant";
const AI_AVATAR = "/avatars/person.png";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { userId } = auth; // Fix: Access userId directly

  try {
    const { chatId, prompt } = await req.json();

    if (!chatId || !prompt) {
      return NextResponse.json({ error: "Missing chatId or prompt" }, { status: 400 });
    }
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Gemini API key" }, { status: 500 });
    }

    // Verify chat membership
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId: userId,
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Save user message (optional, usually handled by WS, but if sent via REST):
    // For now assuming the user message was sent via WS and this is just to trigger AI.
    // However, the plan says "AI response saved as message".
    // Let's assume this endpoint receives the prompt and generates the AI response.

    // Context building could be improved by fetching recent chat history
    const recentMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        content: true,
        sender: { select: { isAiBot: true, username: true } }
      }
    });

    const chronological = [...recentMessages].reverse();
    const history = buildGeminiHistory(chronological, prompt);
    const genAIClient = new GoogleGenAI({ apiKey });
    const chatSession = genAIClient.chats.create({
      model: "gemini-2.5-flash",
      history,
    });
    const result = await chatSession.sendMessage({ message: prompt });
    const responseText = extractGenAIText(result);
    if (!responseText.trim()) {
      return NextResponse.json({ error: "Empty response from Gemini" }, { status: 502 });
    }

    // 1. Find or create AI Bot User
    // For MVP we might just have one system AI user, or dynamic.
    // Let's assume a specific "AI Bot" user exists or we create one on the fly.
    let aiUser = await prisma.user.findUnique({ where: { email: AI_EMAIL } });
    if (!aiUser) {
      const passwordHash = await hashPassword("ai-bot");
      aiUser = await prisma.user.create({
        data: {
          email: AI_EMAIL,
          username: AI_USERNAME,
          passwordHash,
          displayName: AI_NAME,
          isAiBot: true,
          avatarUrl: AI_AVATAR
        }
      });
    }

    // 2. Add AI to chat if not present (optional, or just allow it to post)
    // We'll skip ChatParticipant check for the AI bot itself for simplicity,
    // or we can add it. Let's just create the message with senderId = aiUser.id

    const aiMessage = await prisma.message.create({
      data: {
        chatId,
        senderId: aiUser.id,
        type: "AI",
        content: responseText,
      },
      include: {
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

    // 3. Broadcast this message via WebSocket? 
    // Since this is a REST call, we might rely on the client to refetch or 
    // ideally the server should broadcast it. 
    // Accessing `broadcast` from `server.js` is hard here since it's a separate process/context in Next.js API routes vs custom server.
    // In a custom server setup with Next.js, they share the process if run via `node server.js`.
    // However, sharing the WSS instance is tricky. 
    // Workaround: The client polling or we can use an internal event emitter / Redis PubSub for scalable apps.
    // For this MVP, since we are running `node server.js`, we might not be able to easily invoke the websocket broadcast from this route 
    // UNLESS we move this logic into the WebSocket handler itself OR use a global emitter if they are in the same process (Next.js API routes run in the same process as the custom server).

    // Actually, `server.js` imports `next` and handles requests. The API routes run inside that Next app.
    // But passing the `wss` instance to the Next.js context is not standard.

    // Recommendation: The simpler approach for "Chat with AI" in an MVP 
    // is to handle the AI trigger over WebSocket as well, OR accept that the AI response 
    // is returned in this REST response and the client must manually push it to the UI 
    // (and maybe other clients won't see it immediately until reload/poll).

    // BETTER MVP APPROACH: Return the message in the response. The Client (who requested the AI)
    // received the message and displays it.
    // Real-time sync for *other* users in the group might be delayed, but for a 1:1 with AI or small group, it's acceptable for MVP.

    return NextResponse.json({ message: aiMessage });

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
