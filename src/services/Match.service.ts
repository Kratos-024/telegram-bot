import cron from "node-cron";

import TelegramBot from "node-telegram-bot-api";
import { MatchController } from "../controllers/Math.controller";

interface DynamicPrizeCalculation {
  prizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  platformShare: number;
  netPrizePool: number;
}

export class MatchNotificationService {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  startMatchNotificationCron() {
    cron.schedule("* * * * *", async () => {
      try {
        this.getCurrentTimeFormatIST();
        const notificationTimeIST = this.getNotificationTimeIST();
        console.log(`Testing notification for time: ${notificationTimeIST}`);
        await this.checkAndNotifyMatches(notificationTimeIST);
      } catch (error) {
        console.error("Error in match notification cron:", error);
      }
    });

    console.log(
      "Match notification cron job started - checking every minute for matches starting in 10 minutes"
    );
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
  }

  private calculateDynamicPrizes(
    match: any,
    actualPlayersJoined: number
  ): DynamicPrizeCalculation {
    const newPrizePool = actualPlayersJoined * match.entryFees;
    const platformSharePercentage = match.platformShare || 30;
    const platformShareAmount = (newPrizePool * platformSharePercentage) / 100;
    const netPrizePool = newPrizePool - platformShareAmount;
    const playerRatio = actualPlayersJoined / match.totalSeats;

    const dynamicFirstPrize = Math.floor(match.firstPrize * playerRatio);
    const dynamicSecondPrize = Math.floor(match.secondPrize * playerRatio);
    const dynamicThirdPrize = Math.floor(match.thirdPrize * playerRatio);

    return {
      prizePool: newPrizePool,
      firstPrize: dynamicFirstPrize,
      secondPrize: dynamicSecondPrize,
      thirdPrize: dynamicThirdPrize,
      platformShare: platformShareAmount,
      netPrizePool: netPrizePool,
    };
  }

  private async checkAndNotifyMatches(targetTimeIST: string) {
    try {
      const matches = await MatchController.getMatchesForNotification(
        targetTimeIST
      );
      if (matches.length === 0) return;

      console.log(
        `Found ${matches.length} matches to notify for time: ${targetTimeIST}`
      );

      for (const match of matches) {
        const formattedTime = this.formatMatchTime(match.time);
        const actualPlayersJoined = match.purchases.length;
        const dynamicPrizes = this.calculateDynamicPrizes(
          match,
          actualPlayersJoined
        );

        for (const purchase of match.purchases) {
          const user = purchase.user;

          if (user.chatId && user.chatId !== "") {
            try {
              const message =
                `🚨 *MATCH REMINDER* 🚨\n\n` +
                `⏰ *Starting in 10 minutes!*\n\n` +
                `🎮 *Game:* ${this.escapeMarkdown(match.gameName)}\n` +
                `⏰ *Time:* ${this.escapeMarkdown(formattedTime)}\n` +
                `🎯 *Match:* ${this.escapeMarkdown(match.matchName)}\n` +
                `💰 *Entry Fee:* Rs.${match.entryFees}\n` +
                `👥 *Players Joined:* ${actualPlayersJoined}/${match.totalSeats}\n` +
                `💎 *Prize Pool:* Rs.${dynamicPrizes.prizePool}\n` +
                `🏆 *1st Prize:* Rs.${dynamicPrizes.firstPrize}\n` +
                `🥈 *2nd Prize:* Rs.${dynamicPrizes.secondPrize}\n` +
                `🥉 *3rd Prize:* Rs.${dynamicPrizes.thirdPrize}\n` +
                `🔑 Match Joining Info - MatchId: ${match.gameId} and Password: ${match?.matchPassword}\n` +
                `🎯 *Per Kill:* Rs.${match.perKillPoint}\n\n` +
                `Get ready! Your match starts in 10 minutes! 🍀`;

              if (match.imageFileId) {
                await this.bot.sendPhoto(
                  parseInt(user.chatId),
                  match.imageFileId,
                  {
                    caption: message,
                    parse_mode: "Markdown",
                  }
                );
              } else {
                await this.bot.sendMessage(parseInt(user.chatId), message, {
                  parse_mode: "Markdown",
                });
              }

              console.log(
                `10-minute notification sent to user ${user.email} for match ${match.matchName} in game ${match.gameName}`
              );
            } catch (error) {
              console.error(
                `Failed to send 10-minute notification to user ${user.email}:`,
                error
              );
            }
          }
        }
      }

      // ✅ Delete all notified matches after notifications
      for (const match of matches) {
        await MatchController.deleteMatch(match.id);
      }
    } catch (error) {
      console.error("Error checking matches for notification:", error);
    }
  }

  private formatMatchTime(rawTime: string): string {
    try {
      const [year, month, day, hour, minute] = rawTime.split("-");
      const dateObj = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
      const options: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      };
      return dateObj.toLocaleString("en-IN", options);
    } catch (e) {
      return rawTime;
    }
  }

  /**
   * Returns current time in format YYYY-MM-DD-HH-mm in IST
   */
  getCurrentTimeFormatIST(): string {
    const istNow = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const now = new Date(istNow);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}-${String(
      now.getHours()
    ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  }

  /**
   * Returns time 10 minutes from now in format YYYY-MM-DD-HH-mm in IST
   */
  private getNotificationTimeIST(): string {
    const istNow = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const now = new Date(istNow);

    // Add 10 minutes
    const notificationTime = new Date(now.getTime() + 10 * 60 * 1000);

    return `${notificationTime.getFullYear()}-${String(
      notificationTime.getMonth() + 1
    ).padStart(2, "0")}-${String(notificationTime.getDate()).padStart(
      2,
      "0"
    )}-${String(notificationTime.getHours()).padStart(2, "0")}-${String(
      notificationTime.getMinutes()
    ).padStart(2, "0")}`;
  }

  async triggerNotificationCheck() {
    const notificationTimeIST = this.getNotificationTimeIST();
    console.log(
      "Manually triggering notification check for matches starting at:",
      notificationTimeIST
    );
    await this.checkAndNotifyMatches(notificationTimeIST);
  }

  async testNotificationForTime(timeString: string) {
    console.log(`Testing notification for time: ${timeString}`);
    await this.checkAndNotifyMatches(timeString);
  }

  async getDynamicPrizeCalculation(
    matchId: number
  ): Promise<DynamicPrizeCalculation | null> {
    try {
      const match = await MatchController.getMatchById(matchId);
      if (!match) return null;

      const actualPlayersJoined = match.purchases.length;
      return this.calculateDynamicPrizes(match, actualPlayersJoined);
    } catch (error) {
      console.error("Error calculating dynamic prizes:", error);
      return null;
    }
  }

  stopMatchNotificationCron() {
    console.log("Match notification cron job stopped");
  }
}
