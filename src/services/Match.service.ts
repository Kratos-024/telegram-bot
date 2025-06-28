// src/services/MatchNotificationService.ts
import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import { MatchController } from "../controllers/Math.controller";

export class MatchNotificationService {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  // Start the cron job to check for matches every minute
  startMatchNotificationCron() {
    // Run every minute: '* * * * *'
    // Format: second minute hour day month dayOfWeek
    cron.schedule("* * * * *", async () => {
      try {
        await this.checkAndNotifyMatches();
      } catch (error) {
        console.error("Error in match notification cron:", error);
      }
    });

    console.log("Match notification cron job started - checking every minute");
  }

  // Check for matches and notify users
  private async checkAndNotifyMatches() {
    try {
      const matches = await MatchController.getMatchesForNotification();

      if (matches.length === 0) {
        return; // No matches to notify about
      }

      console.log(`Found ${matches.length} matches to notify about`);

      for (const match of matches) {
        // Notify all users who have purchased this match
        for (const purchase of match.purchases) {
          const user = purchase.user;

          if (user.chatId && user.chatId !== "") {
            try {
              const message =
                `🚨 **MATCH ALERT** 🚨\n\n` +
                `⏰ **Time:** ${match.time}\n` +
                `🎯 **Match:** ${match.name}\n` +
                `💰 **Price:** ${match.price}\n\n` +
                `Your match is starting now! Good luck! 🍀`;

              await this.bot.sendMessage(parseInt(user.chatId), message, {
                parse_mode: "Markdown",
              });

              console.log(
                `Notification sent to user ${user.email} for match ${match.name}`
              );
            } catch (error) {
              console.error(
                `Failed to send notification to user ${user.email}:`,
                error
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking matches for notification:", error);
    }
  }

  // Optional: Get current time in the required format for testing
  getCurrentTimeFormat(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}-${String(
      now.getHours()
    ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  }

  // Manual trigger for testing purposes
  async triggerNotificationCheck() {
    console.log("Manually triggering notification check...");
    await this.checkAndNotifyMatches();
  }
}
