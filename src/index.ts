// index.ts
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import express from "express";
import { MatchNotificationService } from "./services/Match.service";
import cornRouter from "./routes/corn.route";
import { BotRoutes } from "./routes/bot.routes";

dotenv.config({ path: ".env" });

const token = process.env.BOT_TOKEN!;
const isDev = process.env.NODE_ENV !== "production";
const serverUrl = process.env.SERVER_URL || "";

const bot = new TelegramBot(token, {
  polling: isDev,
});

const app = express();
app.use(express.json());

if (!isDev) {
  const webhookPath = `/bot${token}`;
  const fullWebhookUrl = `${serverUrl}${webhookPath}`;

  bot.setWebHook(fullWebhookUrl);
  console.log("Webhook set to:", fullWebhookUrl);

  app.post(webhookPath, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  console.log("Bot polling started in development mode...");
}

const matchNotificationService = new MatchNotificationService(bot);
matchNotificationService.startMatchNotificationCron();
console.log("Match notification service started...");

new BotRoutes(bot);
console.log("Bot routes initialized...");

app.use("/api/v1/getResponse", cornRouter);

// // --- Optional: Add some basic API endpoints for bot management
// app.get("/api/v1/bot/status", async (req, res) => {
//   try {
//     const me = await bot.getMe();
//     res.json({
//       status: "active",
//       botInfo: {
//         id: me.id,
//         username: me.username,
//         firstName: me.first_name,
//       },
//       mode: isDev ? "polling" : "webhook",
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       message: "Failed to get bot status",
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// });

app.post("/api/v1/bot/send-message", async (req, res) => {
  try {
    const { chatId, message, options } = req.body;

    if (!chatId || !message) {
      res.status(400).json({
        error: "chatId and message are required",
      });
    }

    const result = await bot.sendMessage(chatId, message, options);
    res.json({
      success: true,
      messageId: result.message_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to send message",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

process.once("SIGINT", () => {
  console.log("Shutting down bot...");
  bot.stopPolling();
  process.exit(0);
});

process.once("SIGTERM", () => {
  console.log("Shutting down bot...");
  bot.stopPolling();
  process.exit(0);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  if (!isDev) {
    console.log("Bot running in webhook mode...");
  } else {
    console.log("Bot running in polling mode...");
  }
});

export { bot, matchNotificationService };
