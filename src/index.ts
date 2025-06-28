import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { BotRoutes } from "./routes/bot.routes";
import { MatchNotificationService } from "./services/Match.service";

dotenv.config({ path: ".env" });

const token = process.env.BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: true });

const botRoutes = new BotRoutes(bot);

const matchNotificationService = new MatchNotificationService(bot);
matchNotificationService.startMatchNotificationCron();

console.log("Telegram bot is running...");
console.log("Match notification service started...");

process.on("SIGINT", () => {
  console.log("Shutting down bot...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down bot...");
  bot.stopPolling();
  process.exit(0);
});

export { bot, matchNotificationService };
