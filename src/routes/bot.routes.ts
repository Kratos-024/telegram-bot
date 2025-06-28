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

          case "9lo":
            await this.showAllMatches(chatId);
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

          case "admin_give_match":
            userSessions.set(chatId, {
              state: "awaiting_user_email_for_match",
              data: {},
            });
            this.bot.sendMessage(chatId, "Enter user email to give match:");
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

          default:
            if (data?.startsWith("user_game_")) {
              const gameName = data.replace("user_game_", "");
              await this.showGameMatches(chatId, gameName);
            } else if (data?.startsWith("admin_game_")) {
              const gameName = data.replace("admin_game_", "");
              const session = userSessions.get(chatId);
              if (
                session &&
                session.state === "awaiting_game_selection_for_match"
              ) {
                session.data.selectedGame = gameName;
                session.state = "awaiting_match_id_to_give";
                this.bot.sendMessage(
                  chatId,
                  `Selected game: ${gameName}\nEnter match ID to give to user:`
                );
              }
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

          // NEW: Handle game name input
          case "awaiting_game_name":
            session.data.gameName = text;
            session.state = "awaiting_match_name";
            this.bot.sendMessage(chatId, "Enter match name:");
            break;

          // UPDATED: Handle match name input
          case "awaiting_match_name":
            session.data.matchName = text;
            session.state = "awaiting_match_price";
            this.bot.sendMessage(chatId, "Enter match price:");
            break;

          // NEW: Handle price input
          case "awaiting_match_price":
            const price = parseFloat(text!);
            if (isNaN(price)) {
              this.bot.sendMessage(
                chatId,
                "Please enter a valid price (number)"
              );
              return;
            }
            session.data.price = price;
            session.state = "awaiting_match_time";
            this.bot.sendMessage(
              chatId,
              "Enter match time (Format: 2025-06-28-12-45):"
            );
            break;

          case "awaiting_match_time":
            try {
              // Validate time format
              const timeRegex = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/;
              if (!timeRegex.test(text!)) {
                this.bot.sendMessage(
                  chatId,
                  "Invalid time format! Please use: YYYY-MM-DD-HH-MM (e.g., 2025-06-28-12-45)"
                );
                return;
              }

              await MatchController.addMatch(
                session.data.gameName,
                session.data.matchName,
                session.data.price,
                text!
              );
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, "Match added successfully!");
              this.showAdminMenu(chatId);
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to add match"
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

          case "awaiting_user_email_for_match":
            session.data.userEmail = text;
            session.state = "awaiting_game_selection_for_match";
            await this.showGameCategories(chatId, "admin_game");
            break;

          case "awaiting_match_id_to_give":
            try {
              const matchId = parseInt(text!);
              if (isNaN(matchId)) {
                this.bot.sendMessage(
                  chatId,
                  "Please enter a valid match ID (number)"
                );
                return;
              }

              const result = await MatchController.giveMatchToUser(
                session.data.userEmail,
                matchId,
                session.data.selectedGame
              );
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, result.message);
              this.showAdminMenu(chatId);
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                error.message || "Failed to give match to user"
              );
              userSessions.delete(chatId);
              this.showAdminMenu(chatId);
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
  }

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
        [{ text: "🎁 Give Match to User", callback_data: "admin_give_match" }],
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
      }

      if (Array.isArray(games)) {
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
            const escapedPrice = this.escapeMarkdownV2(match.buy.toString());

            message += `${match.serial}\\. ${escapedTime} \\- ${escapedName} \\(Rs\\.${escapedPrice}\\)\n`;
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

      let message = `📋 **All Matches**\n\n`;
      if (Array.isArray(matches)) {
        if (matches.length === 0) {
          message += "No matches found.";
        } else {
          matches.forEach((match: any) => {
            message += `**ID:** ${match.id} | **Serial:** ${match.serial}\n`;
            message += `**Game:** ${match.gameName}\n`;
            message += `**Name:** ${match.matchName}\n`;
            message += `💰 **Price:** Rs.${match.price}\n`;
            message += `⏰ **Time:** ${match.time}\n`;
            message += `📅 **Date:** ${match.date}\n\n`;
          });
        }
      }

      if (message.length > 4000) {
        const messageParts = this.splitMessage(message, 4000);
        for (const part of messageParts) {
          await this.bot.sendMessage(chatId, part, { parse_mode: "Markdown" });
        }
      } else {
        this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      }
    } catch (error) {
      this.bot.sendMessage(chatId, "Failed to load matches.");
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
        message += "No matches purchased yet.";
      } else {
        data.matchHistory.forEach((match: any) => {
          message += `${match.serial}. ${match.time} - ${match.gameName}: ${match.matchName} (Rs.${match.buy})\n`;
        });
      }

      this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error) {
      this.bot.sendMessage(chatId, "Failed to load account details.");
    }
  }

  private async showTodayMatches(chatId: number) {
    try {
      const result = await MatchController.getTodayMatches();
      const matches = result.data;

      let message = `🏆 **Today's Matches**\n\n`;
      if (Array.isArray(matches)) {
        if (matches.length === 0) {
          message += "No matches scheduled for today.";
        } else {
          matches.forEach((match: any) => {
            message += `${match.serial}. ${match.time} - ${match.gameName}: ${match.matchName} (Rs.${match.buy})\n`;
          });
        }
      }

      this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error) {
      this.bot.sendMessage(chatId, "Failed to load today's matches.");
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
