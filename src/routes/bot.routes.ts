// src/routes/Bot.routes.ts
import TelegramBot from "node-telegram-bot-api";
import { UserController } from "../controllers/User.controller";
import { WithdrawController } from "../controllers/Withdraw.controller";
import { MatchController } from "../controllers/Math.controller";

interface UserSession {
  state: string;
  data: any;
}

const userSessions: Map<number, UserSession> = new Map();

export class BotRoutes {
  private bot: TelegramBot;
  private adminChatId: string;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.adminChatId = process.env.ADMIN_CHAT_ID || "";
    this.setupRoutes();
  }

  setupRoutes() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      userSessions.delete(chatId);

      const keyboard = {
        inline_keyboard: [
          [{ text: "🆕 Create Account", callback_data: "create_account" }],
          [{ text: "🔐 Login", callback_data: "login" }],
          [{ text: "🛠️ Logout", callback_data: "logout" }],
          [{ text: "🛠️ Admin", callback_data: "admin" }],
        ],
      };

      this.bot.sendMessage(chatId, "Welcome to the Matchmaking Bot!", {
        reply_markup: keyboard,
      });
    });

    this.bot.on("callback_query", async (query) => {
      const chatId = query.message!.chat.id;
      const data = query.data;

      try {
        const userExist = userSessions.get(chatId);

        switch (data) {
          case "create_account":
            if (userExist) {
              this.bot.sendMessage(chatId, `Please logout first `);
            } else {
              userSessions.delete(chatId);
              userSessions.set(chatId, { state: "awaiting_email", data: {} });
              this.bot.sendMessage(chatId, `Please Enter your username`);
            }
            break;

          case "login":
            if (userExist) {
              this.bot.sendMessage(chatId, `Please logout first`);
            } else {
              userSessions.set(chatId, {
                state: "awaiting_login_email",
                data: {},
              });
              this.bot.sendMessage(chatId, "Please enter your email:");
            }
            break;

          case "admin":
            userSessions.set(chatId, {
              state: "awaiting_admin_id",
              data: {},
            });
            this.bot.sendMessage(chatId, "Please enter Admin ID:");
            break;

          case "my_account":
            await this.showMyAccount(chatId);
            break;

          case "logout":
            try {
              await UserController.logout(chatId.toString());
              userSessions.delete(chatId);
              this.bot.sendMessage(
                chatId,
                "You have been logged out successfully!"
              );
              this.showStartMenu(chatId);
            } catch (error) {
              console.error("Logout error:", error);
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, "Logged out successfully!");
              this.showStartMenu(chatId);
            }
            break;

          case "buy_token":
            this.bot.sendMessage(
              chatId,
              `Contact admin to buy tokens: @${
                process.env.ADMIN_USERNAME || "admin"
              }`
            );
            break;

          case "today_match":
            await this.showGameCategories(chatId, "user_game_selection");
            break;

          case "enter_match":
            userSessions.set(chatId, {
              state: "awaiting_match_id",
              data: {},
            });
            this.bot.sendMessage(chatId, "Enter match ID to join:");
            break;

          case "withdraw":
            await this.showWithdraw(chatId);
            break;

          case "admin_add_match":
            userSessions.set(chatId, {
              state: "awaiting_game_name",
              data: {},
            });
            this.bot.sendMessage(chatId, "Enter game name:");
            break;

          case "admin_show_matches":
            await this.showAllMatches(chatId);
            break;

          case "admin_delete_match":
            userSessions.set(chatId, {
              state: "awaiting_delete_match_name",
              data: {},
            });
            this.bot.sendMessage(chatId, "Enter the exact match ID to delete:");
            break;

          case "admin_user_balance":
            userSessions.set(chatId, {
              state: "awaiting_user_email_for_balance",
              data: {},
            });
            this.bot.sendMessage(
              chatId,
              "Enter user email to check/update balance:"
            );
            break;
          case "admin_delete_allMatch":
            await this.deleteAllMatches(chatId);
            break;
          default:
            if (data?.startsWith("user_game_")) {
              const gameName = data.replace("user_game_", "");
              await this.showGameMatches(chatId, gameName);
            }
            break;
        }
      } catch (error) {
        this.bot.sendMessage(chatId, "An error occurred. Please try again.");
      }
    });

    this.bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (text?.startsWith("/")) return;

      const session = userSessions.get(chatId);
      if (!session) return;

      try {
        switch (session.state) {
          case "awaiting_email":
            session.data.email = text;
            session.state = "awaiting_password";
            this.bot.sendMessage(chatId, "Please enter your password:");
            break;

          case "awaiting_password":
            try {
              const createResult = await UserController.createAccount(
                this.bot,
                chatId,
                session.data.email,
                text!
              );
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, createResult.message);
              this.showMainDashboard(chatId);
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to create account"
              );
              userSessions.delete(chatId);
            }
            break;

          case "awaiting_login_email":
            session.data.email = text;
            session.state = "awaiting_login_password";
            this.bot.sendMessage(chatId, "Please enter your password:");
            break;

          case "awaiting_login_password":
            try {
              const loginResult = await UserController.login(
                this.bot,
                chatId,
                session.data.email,
                text!
              );
              userSessions.delete(chatId);
              this.bot.sendMessage(
                chatId,
                `Login successful! ${loginResult.message}`
              );
              this.showMainDashboard(chatId);
            } catch (error: any) {
              this.bot.sendMessage(chatId, error.message || "Failed to login");
              userSessions.delete(chatId);
            }
            break;

          case "awaiting_admin_id":
            session.data.adminId = text;
            session.state = "awaiting_admin_password";
            this.bot.sendMessage(chatId, "Please enter Admin Password:");
            break;

          case "awaiting_admin_password":
            const adminId = process.env.ADMIN_ID;
            const adminPassword = process.env.ADMIN_PASSWORD;

            if (session.data.adminId === adminId && text === adminPassword) {
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, "Admin authentication successful!");
              this.showAdminMenu(chatId);
            } else {
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, "Wrong credentials! Access denied.");
              this.showStartMenu(chatId);
            }
            break;

          case "awaiting_game_name":
            session.data.gameName = text;
            session.state = "awaiting_match_name";
            this.bot.sendMessage(chatId, "Enter match name:");
            break;

          case "awaiting_match_name":
            session.data.matchName = text;
            session.state = "awaiting_totalPlayer";
            this.bot.sendMessage(chatId, "Enter total number of players:");
            break;

          case "awaiting_totalPlayer":
            const totalPlayers = parseInt(text!, 10);
            if (isNaN(totalPlayers)) {
              this.bot.sendMessage(
                chatId,
                "Please enter a valid number of players."
              );
              return;
            }
            session.data.totalPlayer = totalPlayers;
            session.state = "awaiting_per_kill_point";
            this.bot.sendMessage(chatId, "Enter per-kill reward amount:");
            break;

          case "awaiting_per_kill_point":
            const perKillPoint = parseFloat(text!);
            if (isNaN(perKillPoint)) {
              this.bot.sendMessage(
                chatId,
                "Please enter a valid per-kill reward (number)."
              );
              return;
            }
            session.data.perKillPoint = perKillPoint;
            session.state = "awaiting_platform_share";
            this.bot.sendMessage(
              chatId,
              "Enter platform share percentage (e.g., 0.3 for 30%):"
            );
            break;

          case "awaiting_platform_share":
            const platformShare = parseFloat(text!);
            if (isNaN(platformShare)) {
              this.bot.sendMessage(
                chatId,
                "Please enter a valid platform share (decimal number)."
              );
              return;
            }
            session.data.platformShare = platformShare;
            session.state = "awaiting_entry_fees";
            this.bot.sendMessage(chatId, "Enter entry fee amount per player:");
            break;

          case "awaiting_entry_fees":
            const entryFees = parseFloat(text!);
            if (isNaN(entryFees)) {
              this.bot.sendMessage(
                chatId,
                "Please enter a valid entry fee amount (number)."
              );
              return;
            }
            session.data.entryFees = entryFees;
            session.state = "awaiting_match_time";
            this.bot.sendMessage(
              chatId,
              "Enter match time (Format: YYYY-MM-DD-HH-mm):"
            );
            break;

          case "awaiting_match_time":
            try {
              const timeRegex = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/;
              if (!timeRegex.test(text!)) {
                this.bot.sendMessage(
                  chatId,
                  "Invalid time format! Please use: YYYY-MM-DD-HH-MM (e.g., 2025-06-28-12-45)"
                );
                return;
              }

              session.data.matchTime = text!;
              session.state = "awaiting_image_upload";
              this.bot.sendMessage(
                chatId,
                "✅ Match time saved.\nNow upload the match banner image:"
              );
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to process match time."
              );
              userSessions.delete(chatId);
              this.showAdminMenu(chatId);
            }
            break;

          case "awaiting_delete_match_name":
            try {
              const deleteResult = await MatchController.deleteMatch(+text!);
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, deleteResult.message);
              this.showAdminMenu(chatId);
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to delete match"
              );
              userSessions.delete(chatId);
              this.showAdminMenu(chatId);
            }
            break;

          case "awaiting_match_id":
            try {
              const matchId = parseInt(text!);
              if (isNaN(matchId)) {
                this.bot.sendMessage(
                  chatId,
                  "Please enter a valid match ID (number)"
                );
                return;
              }

              const matchDetails = await MatchController.getMatchForEntry(
                matchId,
                chatId
              );
              const match = matchDetails.data;

              if (match?.isFull) {
                this.bot.sendMessage(
                  chatId,
                  "❌ Match is full! No seats available."
                );
                userSessions.delete(chatId);
                this.showMainDashboard(chatId);
                return;
              }

              session.data.matchId = matchId;
              session.data.matchDetails = match;
              session.state = "awaiting_entry_amount";

              this.bot.sendMessage(
                chatId,
                `🎮 **${match?.name}** (${match?.gameName})\n` +
                  `⏰ Time: ${match?.time}\n` +
                  `💰 Entry Fees: Rs.${match?.entryFees}\n` +
                  `🏆 1st Prize: Rs.${match?.firstPrize}\n` +
                  `🥈 2nd Prize: Rs.${match?.secondPrize}\n` +
                  `🥉 3rd Prize: Rs.${match?.thirdPrize}\n` +
                  `💸 Prize Pool: Rs.${match?.prizePool}\n` +
                  `🎯 Per Kill: Rs.${match?.perKillPoint}\n` +
                  `💺 Available Seats: ${match?.availableSeats}/${match?.totalSeats}\n\n` +
                  `Enter amount to pay for entry:`,
                { parse_mode: "Markdown" }
              );
            } catch (error: any) {
              this.bot.sendMessage(chatId, error.message || "Match not found");
              userSessions.delete(chatId);
              this.showMainDashboard(chatId);
            }
            break;

          case "awaiting_entry_amount":
            try {
              const amount = parseFloat(text!);
              if (isNaN(amount) || amount <= 0) {
                this.bot.sendMessage(
                  chatId,
                  "Please enter a valid amount (positive number)"
                );
                return;
              }

              const result = await MatchController.enterMatch(
                chatId.toString(),
                session.data.matchId,
                amount
              );

              userSessions.delete(chatId);
              const matchData = result.data;

              this.bot.sendMessage(
                chatId,
                `✅ ${result.message}\n\n` +
                  `🎮 Match: ${matchData?.match.name}\n` +
                  `💰 Amount Paid: Rs.${matchData?.amountPaid}\n` +
                  `💳 Remaining Balance: Rs.${matchData?.remainingBalance}\n` +
                  `💺 Remaining Seats: ${matchData?.remainingSeats}`,
                { parse_mode: "Markdown" }
              );
              this.showMainDashboard(chatId);
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to enter match"
              );
              userSessions.delete(chatId);
              this.showMainDashboard(chatId);
            }
            break;

          case "awaiting_user_email_for_balance":
            try {
              const result = await MatchController.getUserBalance(text!);
              const userData = result.data || {
                email: "",
                totalMatches: "",
                balance: 0,
                createdAt: "",
              };

              session.data.userEmail = text;
              session.state = "awaiting_new_balance";

              this.bot.sendMessage(
                chatId,
                `👤 **User Details:**\n` +
                  `Email: ${userData.email}\n` +
                  `Current Balance: Rs.${userData.balance}\n` +
                  `Total Matches: ${userData.totalMatches}\n` +
                  `Account Created: ${new Date(
                    userData.createdAt
                  ).toDateString()}\n\n` +
                  `Enter new balance amount (or type 'cancel' to go back):`,
                { parse_mode: "Markdown" }
              );
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to get user balance"
              );
              userSessions.delete(chatId);
              this.showAdminMenu(chatId);
            }
            break;

          case "awaiting_new_balance":
            try {
              if (text?.toLowerCase() === "cancel") {
                userSessions.delete(chatId);
                this.showAdminMenu(chatId);
                return;
              }

              const newBalance = parseFloat(text!);
              if (isNaN(newBalance)) {
                this.bot.sendMessage(
                  chatId,
                  "Please enter a valid balance amount (number)"
                );
                return;
              }

              const result = await MatchController.updateUserBalance(
                session.data.userEmail,
                newBalance
              );
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, result.message);
              this.showAdminMenu(chatId);
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to update user balance"
              );
              userSessions.delete(chatId);
              this.showAdminMenu(chatId);
            }
            break;
        }
      } catch (error) {
        this.bot.sendMessage(chatId, "An error occurred. Please try again.");
        userSessions.delete(chatId);
      }
    });

    // MOVED PHOTO HANDLER OUTSIDE - This is the fix!
    this.bot.on("photo", async (msg) => {
      const chatId = msg.chat.id;
      const session = userSessions.get(chatId);

      if (session?.state === "awaiting_image_upload") {
        try {
          if (!msg.photo || msg.photo.length === 0) {
            this.bot.sendMessage(
              chatId,
              "❌ No image detected. Please try again."
            );
            return;
          }

          const fileId = msg.photo[msg.photo.length - 1].file_id;
          session.data.imageFileId = fileId;

          await MatchController.addMatch(
            session.data.gameName,
            session.data.matchName,
            session.data.perKillPoint,
            session.data.totalPlayer,
            session.data.platformShare,
            session.data.entryFees,
            session.data.matchTime,
            fileId
          );

          userSessions.delete(chatId);
          this.bot.sendMessage(
            chatId,
            "✅ Match added successfully with image!"
          );
          this.showAdminMenu(chatId);
        } catch (error: any) {
          this.bot.sendMessage(
            chatId,
            error.message || "❌ Failed to add match."
          );
          userSessions.delete(chatId);
          this.showAdminMenu(chatId);
        }
      }
    });
  }
  // Inside setupRoutes(), at the end
  // ✅ Add this at the end of setupRoutes:
  // const notificationService = new MatchNotificationService(this.bot);
  // notificationService.startMatchNotificationCron();
  private showStartMenu(chatId: number) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "🆕 Create Account", callback_data: "create_account" }],
        [{ text: "🔐 Login", callback_data: "login" }],
        [{ text: "🛠️ Admin", callback_data: "admin" }],
      ],
    };

    this.bot.sendMessage(chatId, "Welcome to the Matchmaking Bot!", {
      reply_markup: keyboard,
    });
  }

  private showMainDashboard(chatId: number) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "📄 My Account", callback_data: "my_account" }],
        [{ text: "🎯 Buy Token", callback_data: "buy_token" }],
        [{ text: "🏆 Today Match", callback_data: "today_match" }],
        [{ text: "🎮 Enter Match", callback_data: "enter_match" }],
        [{ text: "💸 Withdraw", callback_data: "withdraw" }],
        [{ text: "🔁 Logout", callback_data: "logout" }],
      ],
    };

    this.bot.sendMessage(chatId, "Main Dashboard", {
      reply_markup: keyboard,
    });
  }

  private showAdminMenu(chatId: number) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "➕ Add Match", callback_data: "admin_add_match" }],
        [{ text: "📋 Show Matches", callback_data: "admin_show_matches" }],
        [{ text: "🗑️ Delete Match", callback_data: "admin_delete_match" }],
        [
          {
            text: "🗑️ Delete all Match",
            callback_data: "admin_delete_allMatch",
          },
        ],

        [
          {
            text: "💰 Manage User Balance",
            callback_data: "admin_user_balance",
          },
        ],
        [{ text: "🔁 Logout", callback_data: "logout" }],
      ],
    };

    this.bot.sendMessage(chatId, "Admin Panel", {
      reply_markup: keyboard,
    });
  }

  private async showGameCategories(chatId: number, callbackPrefix: string) {
    try {
      const result = await MatchController.getGameCategories();
      const games = result.data;

      if (Array.isArray(games)) {
        if (games.length === 0) {
          this.bot.sendMessage(chatId, "No games available.");
          return;
        }

        const keyboard = {
          inline_keyboard: games.map((game: string) => [
            { text: `🎮 ${game}`, callback_data: `${callbackPrefix}_${game}` },
          ]),
        };
        this.bot.sendMessage(chatId, "Select a game:", {
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      this.bot.sendMessage(chatId, "Failed to load game categories.");
    }
  }

  private escapeMarkdownV2(text: string): string {
    return text.replace(/[_*[\]()~`>#+-=|{}.!\\]/g, "\\$&");
  }

  private async showGameMatches(chatId: number, gameName: string) {
    try {
      const result = await MatchController.getTodayMatchesByGame(gameName);
      const matches = result.data;

      let message = `🏆 *Today's Matches \\- ${this.escapeMarkdownV2(
        gameName
      )}*\n\n`;

      if (Array.isArray(matches)) {
        if (matches.length === 0) {
          message += "No matches scheduled for today in this game\\.";
        } else {
          matches.forEach((match: any) => {
            const escapedTime = this.escapeMarkdownV2(match.time);
            const escapedName = this.escapeMarkdownV2(match.name);
            const escapedEntryFees = this.escapeMarkdownV2(
              match.entryFees.toString()
            );

            message += `**ID:** ${match.id} \\| ${escapedTime} \\- ${escapedName}\n`;
            message += `💰 **Entry:** Rs\\.${escapedEntryFees} \\| 💺 **Seats:** ${match.availableSeats}/${match.totalSeats}\n`;
            message += `🏆 **1st:** Rs\\.${match.firstPrize} \\| 🥈 **2nd:** Rs\\.${match.secondPrize} \\| 🥉 **3rd:** Rs\\.${match.thirdPrize}\n`;
            message += `🎯 **Prize Pool:** Rs\\.${match.prizePool}\n\n`;
            message += `🎯 **Per Kill:** Rs\\.${match.perKillPoint}\n\n`;
          });
        }
      }

      this.bot.sendMessage(chatId, message, { parse_mode: "MarkdownV2" });
    } catch (error) {
      console.error("showGameMatches error:", error);
      this.bot.sendMessage(chatId, `Failed to load matches for ${gameName}.`);
    }
  }

  private async showAllMatches(chatId: number) {
    try {
      const result = await MatchController.getAllMatches();
      const matches = result.data;

      if (!Array.isArray(matches) || matches.length === 0) {
        await this.bot.sendMessage(
          chatId,
          "📋 **All Matches**\n\nNo matches found.",
          {
            parse_mode: "Markdown",
          }
        );
        return;
      }

      for (const match of matches) {
        const matchText =
          `**ID:** ${match.id} | **Serial:** ${match.serial}\n` +
          `**Game:** ${match.gameName}\n` +
          `**Name:** ${match.matchName}\n` +
          `💰 **Entry Fees:** Rs.${match.entryFees}\n` +
          `🏆 **1st Prize:** Rs.${match.firstPrize}\n` +
          `🥈 **2nd Prize:** Rs.${match.secondPrize}\n` +
          `🥉 **3rd Prize:** Rs.${match.thirdPrize}\n` +
          `💸 Prize Pool: Rs.${match?.prizePool}\n` +
          `🎯 **Per Kill:** Rs.${match.perKillPoint}\n` +
          `💺 **Seats:** ${match.occupiedSeats}/${match.totalSeats}\n` +
          `⏰ **Time:** ${match.time}\n` +
          `📅 **Date:** ${match.date}`;

        if (match.imageFileId) {
          await this.bot.sendPhoto(chatId, match.imageFileId, {
            caption: matchText,
            parse_mode: "Markdown",
          });
        } else {
          await this.bot.sendMessage(chatId, matchText, {
            parse_mode: "Markdown",
          });
        }
      }
    } catch (error) {
      this.bot.sendMessage(chatId, "❌ Failed to load matches.");
    }
  }
  private async deleteAllMatches(chatId: number) {
    try {
      const result = await MatchController.deleteAllMatch();

      await this.bot.sendMessage(chatId, result, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      this.bot.sendMessage(chatId, "❌ Failed to load matches.");
    }
  }
  private splitMessage(message: string, maxLength: number): string[] {
    const parts: string[] = [];
    const lines = message.split("\n");
    let currentPart = "";

    for (const line of lines) {
      if ((currentPart + line + "\n").length > maxLength) {
        if (currentPart) {
          parts.push(currentPart.trim());
          currentPart = "";
        }
      }
      currentPart += line + "\n";
    }

    if (currentPart) {
      parts.push(currentPart.trim());
    }

    return parts;
  }

  private async showMyAccount(chatId: number) {
    try {
      const result = await UserController.getMyAccount(chatId.toString());
      const data = result.data || {
        email: "",
        balance: 0,
        matchHistory: [],
      };

      let message = `📄 **My Account**\n`;
      message += `Email: ${data.email}\n`;
      message += `Balance: Rs.${data.balance}\n\n`;
      message += `**Match History:**\n`;

      if (data.matchHistory.length === 0) {
        message += "No matches entered yet.";
      } else {
        data.matchHistory.forEach((match: any) => {
          message += `${match.serial}. ${match.time} - ${match.gameName}: ${match.matchName} (Rs.${match.amount}) [${match.type}]\n`;
        });
      }

      this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error) {
      this.bot.sendMessage(chatId, "Failed to load account details.");
    }
  }

  private async showWithdraw(chatId: number) {
    try {
      const result = await WithdrawController.getWithdrawInfo(
        chatId.toString()
      );
      const data = result.data || {
        adminUsername: "",
        balance: 0,
      };

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: `Contact @${data.adminUsername}`,
              url: `https://t.me/${data.adminUsername}`,
            },
          ],
        ],
      };

      this.bot.sendMessage(
        chatId,
        `💸 **Withdraw**\n\nYour Balance: Rs.${data.balance}\n\nClick below to contact admin for withdrawal:`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      this.bot.sendMessage(chatId, "Failed to load withdraw information.");
    }
  }
}
