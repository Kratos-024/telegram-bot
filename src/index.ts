import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import express from "express";
import { BotRoutes } from "./routes/bot.routes";
import { MatchNotificationService } from "./services/Match.service";
import cornRouter from "./routes/corn.route";

dotenv.config({ path: ".env" });

const token = process.env.BOT_TOKEN!;
const isDev = process.env.NODE_ENV !== "production";

const bot = new TelegramBot(token, {
  polling: isDev,
});

if (isDev) {
  console.log("Bot polling started in development mode...");
}

new BotRoutes(bot);
const matchNotificationService = new MatchNotificationService(bot);
matchNotificationService.startMatchNotificationCron();

console.log("Match notification service started...");

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

const app = express();
app.use("/api/v1/getResponse", cornRouter);

if (!isDev) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export { bot, matchNotificationService };
