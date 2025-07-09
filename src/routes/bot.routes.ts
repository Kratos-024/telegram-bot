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
              this.bot.sendMessage(
                chatId,
                `Please Enter your username(Game (eg. BGMI userId))`
              );
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
              this.bot.sendMessage(chatId, "Please enter your UserId:");
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
          case "show_all_users":
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
            // Clear any existing session before starting new match creation
            userSessions.delete(chatId);
            userSessions.set(chatId, {
              state: "awaiting_game_name",
              data: {},
            });
            this.bot.sendMessage(chatId, "🎮 Enter game name:");
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
              "Enter user Userid to check/update balance:"
            );
            break;

          case "admin_delete_allMatch":
            await this.deleteAllMatches(chatId);
            break;

          // NEW: Show match participants - requires match ID input
          case "admin_match_participants":
            userSessions.set(chatId, {
              state: "awaiting_match_id_for_participants",
              data: {},
            });

            this.bot.sendMessage(
              chatId,
              "🎮 Enter match ID to view participants:"
            );

            break;

          // NEW: Show all users table
          case "admin_all_users":
            await this.showAllUsersTable(chatId);
            break;

          // NEW: Show user statistics
          case "admin_user_stats":
            await this.showUserStatistics(chatId);
            break;

          default:
            if (data?.startsWith("user_game_")) {
              const gameName = data.replace("user_game_", "");
              await this.showGameMatches(chatId, gameName);
            }
            break;
        }
      } catch (error) {
        console.error("Callback query error:", error);
        this.bot.sendMessage(chatId, "An error occurred. Please try again.");
        userSessions.delete(chatId);
      }
    });

    // Replace your entire message handler with this fixed version
    this.bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      // Skip if it's a command
      if (text?.startsWith("/")) return;

      // IMPORTANT: Skip if it's a photo message (let photo handler deal with it)
      if (msg.photo && msg.photo.length > 0) return;

      const session = userSessions.get(chatId);
      if (!session) return;

      try {
        switch (session.state) {
          case "awaiting_email":
            session.data.email = text;
            session.state = "awaiting_password";
            this.bot.sendMessage(chatId, "Please enter your password:");
            break;
          case "awaiting_match_id_for_participants":
            const matchId = parseInt(msg.text!, 10);
            if (isNaN(matchId)) {
              this.bot.sendMessage(
                chatId,
                "❌ Invalid match ID. Please enter a number."
              );
              return;
            }

            await this.handleMatchParticipantsCommand(chatId, `${matchId}`);
            userSessions.delete(chatId); // Optional: clear session
            break;

          case "awaiting_password":
            try {
              await UserController.createAccount(
                this.bot,
                chatId,
                session.data.email,
                text!
              );
              userSessions.delete(chatId);

              // Add terms and conditions message
              const termsMessage = `✅ Account created successfully!\n\n📋 **TERMS & CONDITIONS**\n\nBy joining and participating in our skill-based tournaments, you confirm that you are 18 years of age or older. All payments, entries, and actions made through our platform are done voluntarily and with your full consent. We are not liable for any unauthorized transactions made without your explicit consent. By using our service, you agree to follow all tournament rules and guidelines. Failure to do so may result in disqualification or suspension of your account. These terms may be updated at any time, so please review them regularly.`;

              this.bot.sendMessage(chatId, termsMessage, {
                parse_mode: "Markdown",
              });
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
            this.bot.sendMessage(chatId, "🔐 Please enter your password:");
            break;

          case "awaiting_login_password":
            try {
              await UserController.login(
                this.bot,
                chatId,
                session.data.email,
                text!
              );
              userSessions.delete(chatId);
              this.bot.sendMessage(
                chatId,
                `✅ Login successful! Welcome back, ${session.data.email}!`
              );
              this.showMainDashboard(chatId);
            } catch (error: any) {
              this.bot.sendMessage(
                chatId,
                `❌ ${error.message || "Failed to login"}`
              );
              userSessions.delete(chatId);
              this.showStartMenu(chatId);
            }
            break;

          // ADMIN LOGIN FLOW
          case "awaiting_admin_id":
            session.data.adminId = text;
            session.state = "awaiting_admin_password";
            this.bot.sendMessage(chatId, "🔐 Please enter Admin Password:");
            break;

          case "awaiting_admin_password":
            const adminId = process.env.ADMIN_ID;
            const adminPassword = process.env.ADMIN_PASSWORD;

            if (session.data.adminId === adminId && text === adminPassword) {
              userSessions.delete(chatId);
              this.bot.sendMessage(
                chatId,
                "✅ Admin authentication successful!"
              );
              this.showAdminMenu(chatId);
            } else {
              userSessions.delete(chatId);
              this.bot.sendMessage(
                chatId,
                "❌ Wrong credentials! Access denied."
              );
              this.showStartMenu(chatId);
            }
            break;

          // MATCH CREATION FLOW
          case "awaiting_game_name":
            session.data.gameName = text;
            session.state = "awaiting_match_name";
            this.bot.sendMessage(
              chatId,
              "🎮 Enter match name:\n💡 Examples: BGMI, COC, PUBG"
            );
            break;

          case "awaiting_match_name":
            session.data.matchName = text;
            session.state = "awaiting_totalPlayer";
            this.bot.sendMessage(
              chatId,
              "👥 Enter total number of players:\n💡 Examples: 10, 20, 50, 100"
            );
            break;

          case "awaiting_totalPlayer":
            const totalPlayers = parseInt(text!, 10);
            if (isNaN(totalPlayers) || totalPlayers < 1 || totalPlayers > 100) {
              this.bot.sendMessage(
                chatId,
                "❌ Please enter a valid number of players (1-100).\n💡 Examples: 10, 20, 50, 100"
              );
              return;
            }
            session.data.totalPlayer = totalPlayers;
            session.state = "awaiting_entry_fees";
            this.bot.sendMessage(
              chatId,
              "💰 Enter entry fee amount per player:\n💡 Examples:\n• 50 (Rs.50 per player)\n• 100 (Rs.100 per player)\n• 200 (Rs.200 per player)\n• 500 (Rs.500 per player)"
            );
            break;

          case "awaiting_entry_fees":
            const entryFees = parseFloat(text!);
            if (isNaN(entryFees) || entryFees < 1 || entryFees > 10000) {
              this.bot.sendMessage(
                chatId,
                "❌ Please enter a valid entry fee (1-10000).\n💡 Examples: 50, 100, 200, 500"
              );
              return;
            }
            session.data.entryFees = entryFees;
            session.state = "awaiting_per_kill_point";
            this.bot.sendMessage(
              chatId,
              "💀 Enter per-kill reward amount:\n💡 Examples:\n• 5 (Rs.5 per kill)\n• 10 (Rs.10 per kill)\n• 20 (Rs.20 per kill)"
            );
            break;

          case "awaiting_per_kill_point":
            const perKillPoint = parseFloat(text!);
            if (
              isNaN(perKillPoint) ||
              perKillPoint < 0 ||
              perKillPoint > 1000
            ) {
              this.bot.sendMessage(
                chatId,
                "❌ Please enter a valid per-kill reward (0-1000).\n💡 Examples: 5, 10, 15, 20"
              );
              return;
            }
            session.data.perKillPoint = perKillPoint;
            session.state = "awaiting_first_prize";
            this.bot.sendMessage(
              chatId,
              "🏆 *First Prize*\n\nEnter the first prize amount:\n💰 This should be the highest prize\n📊 Recommended: 40-60% of total prize pool",
              { parse_mode: "Markdown" }
            );
            break;

          case "awaiting_first_prize":
            const firstPrize = parseFloat(text!);
            if (isNaN(firstPrize) || firstPrize < 1 || firstPrize > 100000) {
              this.bot.sendMessage(
                chatId,
                "❌ Please enter a valid first prize amount (1-100000).\n💡 Examples: 1000, 2500, 5000, 10000"
              );
              return;
            }
            session.data.firstPrize = firstPrize;
            session.state = "awaiting_second_prize";
            this.bot.sendMessage(
              chatId,
              "🥈 *Second Prize*\n\nEnter the second prize amount:\n💰 Should be less than first prize\n📊 Recommended: 30-60% of first prize",
              { parse_mode: "Markdown" }
            );
            break;

          case "awaiting_second_prize":
            const secondPrize = parseFloat(text!);
            if (isNaN(secondPrize) || secondPrize < 1 || secondPrize > 100000) {
              this.bot.sendMessage(
                chatId,
                "❌ Please enter a valid second prize amount (1-100000).\n💡 Examples: 500, 1000, 1500, 2000"
              );
              return;
            }

            if (secondPrize >= session.data.firstPrize) {
              this.bot.sendMessage(
                chatId,
                `❌ Second prize (Rs.${secondPrize}) must be less than first prize (Rs.${session.data.firstPrize}).\n💡 Please enter a smaller amount.`
              );
              return;
            }

            session.data.secondPrize = secondPrize;
            session.state = "awaiting_third_prize";
            this.bot.sendMessage(
              chatId,
              "🥉 *Third Prize*\n\nEnter the third prize amount:\n💰 Should be less than second prize\n📊 Recommended: 10-30% of first prize",
              { parse_mode: "Markdown" }
            );
            break;

          case "awaiting_third_prize":
            const thirdPrize = parseFloat(text!);
            if (isNaN(thirdPrize) || thirdPrize < 1 || thirdPrize > 100000) {
              this.bot.sendMessage(
                chatId,
                "❌ Please enter a valid third prize amount (1-100000).\n💡 Examples: 250, 500, 750, 1000"
              );
              return;
            }

            if (thirdPrize >= session.data.secondPrize) {
              this.bot.sendMessage(
                chatId,
                `❌ Third prize (Rs.${thirdPrize}) must be less than second prize (Rs.${session.data.secondPrize}).\n💡 Please enter a smaller amount.`
              );
              return;
            }

            session.data.thirdPrize = thirdPrize;
            session.state = "awaiting_game_id";
            this.bot.sendMessage(
              chatId,
              "🎮 *Game ID*\n\nPlease enter the Game ID:\n🔤 Minimum 3 characters required",
              { parse_mode: "Markdown" }
            );
            break;

          case "awaiting_game_id":
            const gameId = text?.trim();
            if (!gameId || gameId.length < 3) {
              this.bot.sendMessage(
                chatId,
                "❌ Please enter a valid Game ID (minimum 3 characters)."
              );
              return;
            }

            session.data.gameId = gameId;
            session.state = "awaiting_match_password";
            this.bot.sendMessage(
              chatId,
              "🔐 *Match Password*\n\nEnter a secure match password:\n🔑 Minimum 4 characters required",
              { parse_mode: "Markdown" }
            );
            break;

          case "awaiting_match_password":
            const matchPassword = text?.trim();
            if (!matchPassword || matchPassword.length < 4) {
              this.bot.sendMessage(
                chatId,
                "❌ Password too short. Please enter at least 4 characters."
              );
              return;
            }

            session.data.matchPassword = matchPassword;
            session.state = "awaiting_custom_date";

            this.bot.sendMessage(chatId, "⏰ Now let's set the match time:", {
              parse_mode: "Markdown",
            });
            this.showSimpleTimeSelection(chatId);
            break;

          case "awaiting_custom_date":
            try {
              const dateRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
              const match = text!.match(dateRegex);

              if (!match) {
                this.bot.sendMessage(
                  chatId,
                  "❌ Invalid date format! Please use YYYY-MM-DD\n💡 Examples: 2025-07-15, 2025-12-31"
                );
                return;
              }

              const [, year, month, day] = match;
              const selectedDate = `${year}-${month.padStart(
                2,
                "0"
              )}-${day.padStart(2, "0")}`;

              const dateObj = new Date(selectedDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              if (isNaN(dateObj.getTime())) {
                this.bot.sendMessage(
                  chatId,
                  "❌ Invalid date! Please enter a valid date."
                );
                return;
              }

              if (dateObj < today) {
                this.bot.sendMessage(
                  chatId,
                  "❌ Date cannot be in the past! Please enter a future date."
                );
                return;
              }

              session.data.selectedDate = selectedDate;
              session.state = "awaiting_custom_time";
              this.bot.sendMessage(
                chatId,
                `📅 Date set to: ${selectedDate}\n\n⏰ Now enter time in format HH:MM (24-hour format):\n💡 Examples: 14:30, 09:15, 20:00`
              );
            } catch (error) {
              console.error("Date processing error:", error);
              this.bot.sendMessage(
                chatId,
                "❌ Error processing date. Please try again with format YYYY-MM-DD"
              );
            }
            break;

          case "awaiting_custom_time":
            try {
              const timeRegex = /^(\d{1,2}):(\d{2})$/;
              const match = text!.match(timeRegex);

              if (!match) {
                this.bot.sendMessage(
                  chatId,
                  "❌ Invalid time format! Please use HH:MM\n💡 Examples: 14:30, 09:15, 20:00"
                );
                return;
              }

              const [, hour, minute] = match;
              const hourNum = parseInt(hour);
              const minuteNum = parseInt(minute);

              if (
                hourNum < 0 ||
                hourNum > 23 ||
                minuteNum < 0 ||
                minuteNum > 59
              ) {
                this.bot.sendMessage(
                  chatId,
                  "❌ Invalid time! Hour must be 0-23, Minute must be 0-59\n💡 Examples: 14:30, 09:15, 20:00"
                );
                return;
              }

              const finalTime = `${session.data.selectedDate}-${hour.padStart(
                2,
                "0"
              )}-${minute}`;
              session.data.matchTime = finalTime;
              session.state = "awaiting_image_upload";

              this.bot.sendMessage(
                chatId,
                `✅ Match time set to: ${this.formatDisplayTime(
                  finalTime
                )}\n\n📸 Now upload the match banner image or send /skip to create match without image:`
              );
            } catch (error) {
              console.error("Time processing error:", error);
              this.bot.sendMessage(
                chatId,
                "❌ Error processing time. Please try again with format HH:MM"
              );
            }
            break;

          case "awaiting_image_upload":
            if (text?.toLowerCase() === "cancel") {
              userSessions.delete(chatId);
              this.bot.sendMessage(chatId, "❌ Match creation cancelled.");
              this.showAdminMenu(chatId);
            } else {
              this.bot.sendMessage(
                chatId,
                "📸 Please upload an image file for the match banner.\n" +
                  "💡 Send a photo, not text. Or type 'cancel' to abort."
              );
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
                matchId
              );
              const match = matchDetails.data;

              if (match?.matchStatus.isFull) {
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
                  `🏆 1st Prize: Rs.${match?.currentPrizes.firstPrize}\n` +
                  `🥈 2nd Prize: Rs.${match?.currentPrizes.secondPrize}\n` +
                  `🥉 3rd Prize: Rs.${match?.currentPrizes.thirdPrize}\n` +
                  `💸 Prize Pool: Rs.${match?.matchStatus.prizePool}\n` +
                  `🎯 Per Kill: Rs.${match?.currentPrizes.perKillPoint}\n` +
                  `💺 Available Seats: ${match?.matchStatus.availableSeats}/${match?.matchStatus.totalSeats}\n\n` +
                  `⚡ **Required Entry Amount: Rs.${match?.entryFees}**\n` +
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

              const requiredEntryFees = session.data.matchDetails?.entryFees;

              // Check if the entered amount matches the required entry fees
              if (amount !== requiredEntryFees) {
                this.bot.sendMessage(
                  chatId,
                  `❌ **Incorrect Amount!**\n\n` +
                    `💰 You entered: Rs.${amount}\n` +
                    `✅ Required amount: Rs.${requiredEntryFees}\n\n` +
                    `Please enter the exact entry fee amount: Rs.${requiredEntryFees}`,
                  { parse_mode: "Markdown" }
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
                  `💺 Remaining Seats: ${matchData?.playerInfo.remainingSeats}`,
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
                  `UserId: ${userData.email}\n` +
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

          default:
            console.log(
              `Unexpected state: ${session.state} for user: ${chatId}`
            );
            this.bot.sendMessage(
              chatId,
              `❌ Unexpected input for current state: ${session.state}\n` +
                "Please follow the instructions or type 'cancel' to start over."
            );
            break;
        }
      } catch (error) {
        console.error("Message handling error:", error);
        this.bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
        userSessions.delete(chatId);
      }
    });

    // Fixed issues in your Bot.routes.ts

    // 1. Enhanced photo handler with better error handling
    this.bot.on("photo", async (msg) => {
      const chatId = msg.chat.id;
      const session = userSessions.get(chatId);

      if (!session) {
        this.bot.sendMessage(
          chatId,
          "❌ No active session found. Please start the match creation process first by going to Admin → Add Match."
        );
        return;
      }

      // Check if we're expecting an image
      if (session.state !== "awaiting_image_upload") {
        this.bot.sendMessage(
          chatId,
          `❌ Image upload not expected at this time. Current state: ${session.state}. Please follow the correct flow.`
        );
        return;
      }

      try {
        // Validate image with better error messages
        if (!msg.photo || msg.photo.length === 0) {
          this.bot.sendMessage(
            chatId,
            "❌ No image detected. Please upload a valid image file (JPG, PNG, etc.)."
          );
          return;
        }

        // Get the highest resolution image
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;

        // Optional: Check file size if needed
        if (photo.file_size && photo.file_size > 10 * 1024 * 1024) {
          // 10MB limit
          this.bot.sendMessage(
            chatId,
            "❌ Image file is too large. Please upload an image smaller than 10MB."
          );
          return;
        }

        session.data.imageFileId = fileId;

        // Show processing message
        this.bot.sendMessage(
          chatId,
          "⏳ Processing image and creating match..."
        );

        // Validate all required data before proceeding
        const requiredFields = [
          "gameId",
          "matchPassword",
          "gameName",
          "matchName",
          "perKillPoint",
          "totalPlayer",
          "entryFees",
          "matchTime",
        ];

        const missingFields = requiredFields.filter(
          (field) => !session.data[field] && session.data[field] !== 0
        );

        if (missingFields.length > 0) {
          this.bot.sendMessage(
            chatId,
            `❌ Missing required data: ${missingFields.join(
              ", "
            )}. Please start the match creation process again.`
          );
          userSessions.delete(chatId);
          this.showAdminMenu(chatId);
          return;
        }

        // Log session data for debugging
        console.log("Session data before match creation:", session.data);

        // Create match with better error handling
        const matchResult = await MatchController.addMatch(
          session.data.gameName,
          session.data.matchName,
          session.data.totalPlayer,
          session.data.perKillPoint,
          session.data.entryFees,
          session.data.matchTime,
          session.data.firstPrize,
          session.data.secondPrize,
          session.data.thirdPrize,
          session.data.gameId,
          session.data.matchPassword,
          fileId
        );

        userSessions.delete(chatId);
        const matchData = matchResult.data;

        if (matchData) {
          this.bot.sendMessage(
            chatId,
            "✅ **Match Created Successfully!**\n\n" +
              `🎮 **${matchData.gameName}**\n` +
              `🏆 ${matchData.matchName}\n` +
              `⏰ ${matchData.time}\n` +
              `👥 Seats: ${matchData.totalSeats}\n` +
              `💰 Entry: Rs.${matchData.entryFees}\n` +
              `💀 Per Kill: Rs.${matchData.perKillPoint}\n\n` +
              `🎯 **Prize Preview:**\n` +
              `🥇 1st Prize: Rs.${matchData.firstPrize || "N/A"}\n` +
              `🥈 2nd Prize: Rs.${matchData.secondPrize || "N/A"}\n` +
              `🥉 3rd Prize: Rs.${matchData.thirdPrize || "N/A"}\n\n` +
              `📝 Match ID: ${matchData.id}\n` +
              `📝 Match ID: ${matchData.gameId}\n` +
              `🔑 Match ID: ${matchData.matchPassword}\n` +
              `💡 ${matchData.matchName || "Match ready for players!"}`,
            { parse_mode: "Markdown" }
          );
        } else {
          this.bot.sendMessage(chatId, "✅ Match created successfully!");
        }

        this.showAdminMenu(chatId);
      } catch (error: any) {
        console.error("Image upload error:", error);

        this.bot.sendMessage(
          chatId,
          `❌ Failed to create match: ${error.message || "Unknown error"}\n\n`
        );
      }
    });
  }

  private showSimpleTimeSelection(chatId: number) {
    const now = new Date();
    const timeSlots = this.generateTimeSlots(now);

    const keyboard = {
      inline_keyboard: [
        ...timeSlots.map((slot) => [
          { text: slot.display, callback_data: `quicktime_${slot.value}` },
        ]),
        [
          {
            text: "📅 Enter Custom Date & Time",
            callback_data: "custom_time",
          },
        ],
      ],
    };

    this.bot.sendMessage(chatId, "⏰ Select match time:", {
      reply_markup: keyboard,
    });
  }
  private generateTimeSlots(baseDate: Date) {
    const slots = [];
    const now = new Date(baseDate);

    // Generate next 24 hours with 2-hour intervals
    for (let i = 1; i <= 12; i++) {
      const slotTime = new Date(now);
      slotTime.setHours(now.getHours() + i * 2);

      const display = this.formatTimeSlot(slotTime);
      const value = this.formatToRequiredFormat(slotTime);

      slots.push({ display, value });
    }

    return slots;
  }

  private formatTimeSlot(date: Date): string {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow =
      date.toDateString() ===
      new Date(today.getTime() + 24 * 60 * 60 * 1000).toDateString();

    let prefix = "";
    if (isToday) prefix = "Today ";
    else if (isTomorrow) prefix = "Tomorrow ";
    else
      prefix =
        date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
        " ";

    return (
      prefix +
      date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  }

  private formatToRequiredFormat(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${year}-${month}-${day}-${hours}-${minutes}`;
  }

  private formatDisplayTime(timeString: string): string {
    const [year, month, day, hour, minute] = timeString.split("-");
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    return date.toLocaleString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
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
        [
          {
            text: "🎮 Match Participants",
            callback_data: "admin_match_participants",
          },
        ],

        [
          {
            text: "👥  Users Stats",
            callback_data: "admin_user_stats",
          },
        ],
        [{ text: "👥 All Users", callback_data: "admin_all_users" }],
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

      if (Array.isArray(matches)) {
        if (matches.length === 0) {
          const message = `🏆 *Today's Matches \\- ${this.escapeMarkdownV2(
            gameName
          )}*\n\nNo matches scheduled for today in this game\\.`;
          this.bot.sendMessage(chatId, message, { parse_mode: "MarkdownV2" });
          return;
        }

        // Send matches one by one with images if available
        for (const match of matches) {
          const escapedTime = this.escapeMarkdownV2(match.time);
          const escapedName = this.escapeMarkdownV2(match.name);
          const escapedEntryFees = this.escapeMarkdownV2(
            match.entryFees.toString()
          );
          const escapedFirstPrize = this.escapeMarkdownV2(
            match.firstPrize.toString()
          );
          const escapedSecondPrize = this.escapeMarkdownV2(
            match.secondPrize.toString()
          );
          const escapedThirdPrize = this.escapeMarkdownV2(
            match.thirdPrize.toString()
          );
          const escapedPrizePool = this.escapeMarkdownV2(
            match.prizePool.toString()
          );
          const escapedPerKillPoint = this.escapeMarkdownV2(
            match.perKillPoint.toString()
          );

          let message = `🏆 *Match Details \\- ${this.escapeMarkdownV2(
            gameName
          )}*\n\n`;
          message += `*ID:* ${match.id} \\| ${escapedTime} \\- ${escapedName}\n`;
          message += `💰 *Entry:* Rs\\.${escapedEntryFees} \\| 💺 *Seats:* ${match.availableSeats}/${match.totalSeats}\n`;
          message += `🏆 *1st:* Rs\\.${escapedFirstPrize} \\| 🥈 *2nd:* Rs\\.${escapedSecondPrize} \\| 🥉 *3rd:* Rs\\.${escapedThirdPrize}\n`;
          message += `🎯 *Prize Pool:* Rs\\.${escapedPrizePool}\n`;
          message += `🎯 *Per Kill:* Rs\\.${escapedPerKillPoint}\n`;
          message += `📊 *Status:* ${this.escapeMarkdownV2(
            match.matchInfo.status
          )}`;

          try {
            if (match.imageFileId) {
              await this.bot.sendPhoto(chatId, match.imageFileId, {
                caption: message,
                parse_mode: "MarkdownV2",
              });
            } else {
              // Send text message if no image
              await this.bot.sendMessage(chatId, message, {
                parse_mode: "MarkdownV2",
              });
            }
          } catch (error) {
            console.error(`Failed to send match ${match.id} to user:`, error);
            // Fallback to text message if image fails
            await this.bot.sendMessage(chatId, message, {
              parse_mode: "MarkdownV2",
            });
          }
        }
      }
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

      await this.bot.sendMessage(chatId, "Succesfully deleted", {
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
      message += `UserId: ${data.email}\n`;
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
  // Add these functions to your bot class

  private async showMatchParticipants(chatId: number, matchId: number) {
    try {
      const result = await UserController.getMatchParticipants(matchId);
      const data = result.data;

      if (!data || !data.participants || data.participants.length === 0) {
        await this.bot.sendMessage(
          chatId,
          `📋 **Match Participants**\n\nNo participants found for Match ID: ${matchId}`,
          {
            parse_mode: "Markdown",
          }
        );
        return;
      }

      let message = `🎮 **Match Details**\n`;
      message += `**ID:** ${data.match.id}\n`;
      message += `**Game:** ${data.match.gameName}\n`;
      message += `**Name:** ${data.match.matchName}\n`;
      message += `**Time:** ${data.match.time}\n`;
      message += `💰 **Entry Fees:** Rs.${data.match.entryFees}\n`;
      message += `🏆 **1st Prize:** Rs.${data.match.firstPrize}\n`;
      message += `🥈 **2nd Prize:** Rs.${data.match.secondPrize}\n`;
      message += `🥉 **3rd Prize:** Rs.${data.match.thirdPrize}\n`;
      message += `🎯 **Per Kill:** Rs.${data.match.perKillPoint}\n`;
      message += `💺 **Seats:** ${data.match.occupiedSeats}/${data.match.totalSeats}\n\n`;

      message += `👥 **Participants (${data.totalParticipants}):**\n`;
      message += `${"=".repeat(35)}\n`;

      data.participants.forEach((participant: any) => {
        message += `${participant.serial}. **${participant.email}**\n`;
        message += `   💳 Balance: Rs.${participant.currentBalance}\n`;
        message += `   💰 Paid: Rs.${participant.amountPaid}\n`;
        message += `   📱 Chat ID: ${participant.chatId}\n`;
        message += `   ⏰ Joined: ${new Date(
          participant.entryTime
        ).toLocaleString()}\n`;
        message += `   📅 Registered: ${new Date(
          participant.userRegisteredAt
        ).toLocaleDateString()}\n`;
        message += `${"-".repeat(25)}\n`;
      });

      // Split message if too long
      const parts = this.splitMessage(message, 4000);
      for (const part of parts) {
        await this.bot.sendMessage(chatId, part, {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      console.error("Show match participants error:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Failed to load match participants. Please check the match ID and try again.",
        {
          parse_mode: "Markdown",
        }
      );
    }
  }

  private async showAllUsersTable(chatId: number) {
    try {
      const result = await UserController.getAllUsersTable();
      const data = result.data;

      if (!data || !data.users || data.users.length === 0) {
        await this.bot.sendMessage(
          chatId,
          "📋 **All Users**\n\nNo users found in the system.",
          {
            parse_mode: "Markdown",
          }
        );
        return;
      }

      // Summary header
      let message = `📊 **User Management Dashboard**\n`;
      message += `${"=".repeat(35)}\n`;
      message += `👥 **Total Users:** ${data.totalUsers}\n`;
      message += `🟢 **Active Users:** ${data.activeUsers}\n`;
      message += `🔴 **Inactive Users:** ${data.inactiveUsers}\n`;
      message += `💰 **Total Balance:** Rs.${data.totalBalance}\n`;
      message += `${"=".repeat(35)}\n\n`;

      message += `📋 **User Details:**\n`;

      data.users.forEach((user: any) => {
        message += `${user.serial}. **${user.email}**\n`;
        message += `   🔑 Password: ${user.password}\n`;
        message += `   💳 Balance: Rs.${user.accountBalance}\n`;
        message += `   📱 Chat ID: ${user.chatId}\n`;
        message += `   📊 Status: ${user.status === "Active" ? "🟢" : "🔴"} ${
          user.status
        }\n`;
        message += `   📅 Registered: ${new Date(
          user.registrationDate
        ).toLocaleDateString()}\n`;
        message += `${"-".repeat(30)}\n`;
      });

      // Split message if too long
      const parts = this.splitMessage(message, 4000);
      for (const part of parts) {
        await this.bot.sendMessage(chatId, part, {
          parse_mode: "Markdown",
        });
      }
    } catch (error) {
      console.error("Show all users table error:", error);
      await this.bot.sendMessage(chatId, "❌ Failed to load users table.", {
        parse_mode: "Markdown",
      });
    }
  }

  private async showUserStatistics(chatId: number) {
    try {
      const result = await UserController.getUserStatistics();
      const data = result.data;

      if (!data || !data.statistics) {
        await this.bot.sendMessage(
          chatId,
          "📊 **User Statistics**\n\nNo statistics available.",
          {
            parse_mode: "Markdown",
          }
        );
        return;
      }

      const stats = data.statistics;
      let message = `📊 **System Statistics**\n`;
      message += `${"=".repeat(35)}\n`;

      // User Statistics
      message += `👥 **User Overview:**\n`;
      message += `   Total Users: ${stats.totalUsers}\n`;
      message += `   🟢 Active: ${stats.activeUsers}\n`;
      message += `   🔴 Inactive: ${stats.inactiveUsers}\n\n`;

      // System Statistics
      message += `🎮 **System Overview:**\n`;
      message += `   Total Matches: ${stats.totalMatches}\n`;
      message += `   Total Match Entries: ${stats.totalMatchEntries}\n`;
      message += `   Total Purchases: ${stats.totalPurchases}\n`;
      message += `   💰 Total System Balance: Rs.${stats.totalSystemBalance}\n\n`;

      // Engagement Statistics
      message += `📈 **User Engagement:**\n`;
      message += `   Avg Entries/User: ${stats.userEngagement.averageEntriesPerUser}\n`;
      message += `   Avg Purchases/User: ${stats.userEngagement.averagePurchasesPerUser}\n`;
      message += `   Avg Balance/User: Rs.${stats.userEngagement.averageBalancePerUser}\n\n`;

      // Recent Users
      if (data.recentUsers && data.recentUsers.length > 0) {
        message += `🆕 **Recent Users:**\n`;
        data.recentUsers.forEach((user: any) => {
          message += `${user.serial}. ${user.email} (Rs.${
            user.balance
          }) - ${new Date(user.registeredAt).toLocaleDateString()}\n`;
        });
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Show user statistics error:", error);
      await this.bot.sendMessage(chatId, "❌ Failed to load user statistics.", {
        parse_mode: "Markdown",
      });
    }
  }

  // Helper function to handle match participants command with ID input
  private async handleMatchParticipantsCommand(
    chatId: number,
    messageText: string
  ) {
    const parts = messageText.split(" ");

    if (!parts.length) {
      await this.bot.sendMessage(
        chatId,
        "❌ **Usage:** /match_participants <match_id>\n\nExample: /match_participants 123",
        {
          parse_mode: "Markdown",
        }
      );
      return;
    }

    const matchId = parseInt(parts[0]);

    if (isNaN(matchId)) {
      await this.bot.sendMessage(
        chatId,
        "❌ **Invalid Match ID**\n\nPlease provide a valid numeric match ID.\n\nExample: /match_participants 123",
        {
          parse_mode: "Markdown",
        }
      );
      return;
    }

    await this.showMatchParticipants(chatId, matchId);
  }
}
