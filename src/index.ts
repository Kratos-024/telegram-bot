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

// Option 1: Force polling even in production (if webhooks don't work)
const forcePolling = process.env.FORCE_POLLING === "true";

const bot = new TelegramBot(token, {
  polling: isDev || forcePolling, // Use polling in dev OR if forced
});

const app = express();
app.use(express.json());

// Only set up webhooks if not using polling
if (!isDev && !forcePolling) {
  const webhookPath = `/bot${token}`;
  const fullWebhookUrl = `https://telegram-bot-vrs6.onrender.com${webhookPath}`;

  // Clear any existing webhook first
  bot
    .deleteWebHook()
    .then(() => {
      bot.setWebHook(fullWebhookUrl);
      console.log("Webhook set to:", fullWebhookUrl);
    })
    .catch(console.error);

  app.post(webhookPath, (req, res) => {
    console.log("Received webhook:", req.body);
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  // Clear webhook if using polling
  bot.deleteWebHook().catch(console.error);
  console.log("Bot polling started...");
}

const matchNotificationService = new MatchNotificationService(bot);
matchNotificationService.startMatchNotificationCron();
console.log("Match notification service started...");

new BotRoutes(bot);
console.log("Bot routes initialized...");

app.use("/api/v1/getResponse", cornRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    mode: isDev || forcePolling ? "polling" : "webhook",
    timestamp: new Date().toISOString(),
  });
});

// Bot status endpoint
app.get("/api/v1/bot/status", async (req, res) => {
  try {
    const me = await bot.getMe();
    const webhookInfo = await bot.getWebHookInfo();

    res.json({
      status: "active",
      botInfo: {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
      },
      mode: isDev || forcePolling ? "polling" : "webhook",
      webhookInfo: {
        url: webhookInfo.url,
        hasCustomCertificate: webhookInfo.has_custom_certificate,
        pendingUpdateCount: webhookInfo.pending_update_count,
        lastErrorDate: webhookInfo.last_error_date,
        lastErrorMessage: webhookInfo.last_error_message,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to get bot status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/v1/bot/send-message", async (req, res) => {
  try {
    const { chatId, message, options } = req.body;

    if (!chatId || !message) {
      res.status(400).json({
        error: "chatId and message are required",
      });
      return;
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

const shutdown = () => {
  console.log("Shutting down bot...");
  if (isDev || forcePolling) {
    bot.stopPolling();
  }
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(
    `Bot running in ${isDev || forcePolling ? "polling" : "webhook"} mode...`
  );
});

export { bot, matchNotificationService };
