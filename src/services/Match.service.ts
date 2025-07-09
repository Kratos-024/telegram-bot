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
        const currentTimeIST = this.getCurrentTimeFormatIST();
        await this.checkAndNotifyMatches(currentTimeIST);
      } catch (error) {
        console.error("Error in match notification cron:", error);
      }
    });

    console.log("Match notification cron job started - checking every minute");
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

  private async checkAndNotifyMatches(currentTimeIST: string) {
    try {
      const matches = await MatchController.getMatchesForNotification();

      if (matches.length === 0) return;

      console.log(`Found ${matches.length} matches to notify about`);

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
                `🚨 *MATCH ALERT* 🚨\n\n` +
                `🎮 *Game:* ${this.escapeMarkdown(match.gameName)}\n` +
                `⏰ *Time:* ${this.escapeMarkdown(formattedTime)}\n` +
                `🎯 *Match:* ${this.escapeMarkdown(match.matchName)}\n` +
                `💰 *Entry Fee:* Rs.${match.entryFees}\n` +
                `👥 *Players Joined:* ${actualPlayersJoined}/${match.totalSeats}\n` +
                `💎 *Prize Pool:* Rs.${dynamicPrizes.prizePool}\n` +
                `🏆 *1st Prize:* Rs.${dynamicPrizes.firstPrize}\n` +
                `🥈 *2nd Prize:* Rs.${dynamicPrizes.secondPrize}\n` +
                `🥉 *3rd Prize:* Rs.${dynamicPrizes.thirdPrize}\n` +
                `🎯 *Per Kill:* Rs.${match.perKillPoint}\n\n` +
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
              } else {
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

  async triggerNotificationCheck() {
    const currentTimeIST = this.getCurrentTimeFormatIST();
    console.log("Manually triggering notification check for:", currentTimeIST);
    await this.checkAndNotifyMatches(currentTimeIST);
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
