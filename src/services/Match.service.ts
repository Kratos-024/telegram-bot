// src/services/MatchNotificationService.ts
import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import { MatchController } from "../controllers/Math.controller";

export class MatchNotificationService {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  startMatchNotificationCron() {
    cron.schedule("* * * * *", async () => {
      try {
        await this.checkAndNotifyMatches();
      } catch (error) {
        console.error("Error in match notification cron:", error);
      }
    });

    console.log("Match notification cron job started - checking every minute");
  }

  private async checkAndNotifyMatches() {
    try {
      const matches = await MatchController.getMatchesForNotification();

      if (matches.length === 0) {
        return; // No matches to notify about
      }

      console.log(`Found ${matches.length} matches to notify about`);

      console.log(`Found ${matches[0].purchases[0]}  atche to notify about`);
      console.log(
        `Found ${matches[0].purchases[0].user.chatId} match to notify about`
      );
      for (const match of matches) {
        for (const purchase of match.purchases) {
          const user = purchase.user;
          console.log(`user ${user}`);

          if (user.chatId && user.chatId !== "") {
            try {
              const message =
                `🚨 **MATCH ALERT** 🚨\n\n` +
                `🎮 **Game:** ${match.gameName}\n` +
                `⏰ **Time:** ${match.time}\n` +
                `🎯 **Match:** ${match.matchName}\n` +
                `💰 **Entry Fee:** Rs.${match.entryFees || match.price}\n` +
                `🏆 **1st Prize:** Rs.${match.firstPrize}\n` +
                `🥈 **2nd Prize:** Rs.${match.secondPrize}\n` +
                `🥉 **3rd Prize:** Rs.${match.thirdPrize}\n` +
                `🎯 **Per Kill:** Rs.${match.perKillPoint}\n\n` +
                `Your match is starting now! Good luck! 🍀`;

              if (match.imageFileId) {
                await this.bot.sendPhoto(
                  parseInt(user.chatId),
                  match.imageFileId,
                  {
                    caption: message,
                    parse_mode: "Markdown",
                  }
                );
                console.log(`Notification sent to user ${message}`);
              } else {
                // Send text message if no image
                await this.bot.sendMessage(parseInt(user.chatId), message, {
                  parse_mode: "Markdown",
                });
              }

              console.log(
                `Notification sent to user ${user.email} for match ${match.matchName} in game ${match.gameName}`
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

  getCurrentTimeFormat(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}-${String(
      now.getHours()
    ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  }

  async triggerNotificationCheck() {
    console.log("Manually triggering notification check...");
    await this.checkAndNotifyMatches();
  }

  async testNotificationForTime(timeString: string) {
    console.log(`Testing notification for time: ${timeString}`);
    try {
      const now = new Date();
      const currentTime = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(
        now.getHours()
      ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;

      console.log(`Current time format: ${currentTime}`);
      await this.checkAndNotifyMatches();
    } catch (error) {
      console.error("Error in test notification:", error);
    }
  }

  stopMatchNotificationCron() {
    console.log("Match notification cron job stopped");
  }
}
