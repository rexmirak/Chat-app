const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const botEmail = "gemini@ai.bot";
    const botUsername = "gemini_ai";

    const existing = await prisma.user.findUnique({
        where: { email: botEmail },
    });

    if (!existing) {
        await prisma.user.create({
            data: {
                email: botEmail,
                username: botUsername,
                displayName: "Gemini AI",
                passwordHash: "disabled",
                isAiBot: true,
                avatarUrl: "/avatars/ai-bot.svg",
                bio: "I am a helpful AI assistant.",
            },
        });
        console.log("AI Bot user created.");
    } else {
        console.log("AI Bot user already exists.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
