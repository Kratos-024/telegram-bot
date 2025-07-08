// src/services/MatchNotificationService.ts
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
        await this.checkAndNotifyMatches();
      } catch (error) {
        console.error("Error in match notification cron:", error);
      }
    });

    console.log("Match notification cron job started - checking every minute");
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
  }

  /**
   * Calculate dynamic prizes based on actual players joined
   * @param match - The match object with original prize structure
   * @param actualPlayersJoined - Number of players actually joined
   * @returns Updated prize calculation
   */
  private calculateDynamicPrizes(
    match: any,
    actualPlayersJoined: number
  ): DynamicPrizeCalculation {
    const newPrizePool = actualPlayersJoined * match.entryFees;

    const platformSharePercentage = match.platformShare || 30;
    const platformShareAmount = (newPrizePool * platformSharePercentage) / 100;

    // Net prize pool after platform share
    const netPrizePool = newPrizePool - platformShareAmount;

    // Calculate the ratio of actual players to total seats
    const playerRatio = actualPlayersJoined / match.totalSeats;

    // Calculate dynamic prizes based on the ratio
    // If fewer players join, prizes are proportionally reduced
    const dynamicFirstPrize = Math.floor(match.firstPrize * playerRatio);
    const dynamicSecondPrize = Math.floor(match.secondPrize * playerRatio);
    const dynamicThirdPrize = Math.floor(match.thirdPrize * playerRatio);

    // Alternative calculation method - distribute based on percentage of net prize pool
    // Uncomment this section if you prefer percentage-based distribution
    /*
    const dynamicFirstPrize = Math.floor(netPrizePool * 0.50); // 50% to first place
    const dynamicSecondPrize = Math.floor(netPrizePool * 0.30); // 30% to second place
    const dynamicThirdPrize = Math.floor(netPrizePool * 0.20); // 20% to third place
    */

    return {
      prizePool: newPrizePool,
      firstPrize: dynamicFirstPrize,
      secondPrize: dynamicSecondPrize,
      thirdPrize: dynamicThirdPrize,
      platformShare: platformShareAmount,
      netPrizePool: netPrizePool,
    };
  }

  private async checkAndNotifyMatches() {
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

        console.log(`Match: ${match.matchName}`);
        console.log(
          `Total Seats: ${match.totalSeats}, Actual Players: ${actualPlayersJoined}`
        );
        console.log(
          `Original Prize Pool: ${match.totalSeats * match.entryFees}`
        );
        console.log(`Dynamic Prize Pool: ${dynamicPrizes.prizePool}`);
        console.log(`Dynamic First Prize: ${dynamicPrizes.firstPrize}`);
        console.log(`Dynamic Second Prize: ${dynamicPrizes.secondPrize}`);
        console.log(`Dynamic Third Prize: ${dynamicPrizes.thirdPrize}`);

        for (const purchase of match.purchases) {
          const user = purchase.user;
          console.log(`user ${user}`);

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
                console.log(`Notification sent to user ${user.email}`);
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
      };
      return dateObj.toLocaleString("en-IN", options);
    } catch (e) {
      return rawTime;
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

  /**
   * Helper method to get dynamic prize calculation for a specific match
   * Can be used for testing or other purposes
   */
  async getDynamicPrizeCalculation(
    matchId: number
  ): Promise<DynamicPrizeCalculation | null> {
    try {
      // You'll need to implement a method to get a specific match with purchases
      // This is just a placeholder - adjust according to your MatchController
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
