// // src/controllers/User.controller.ts

// import TelegramBot from "node-telegram-bot-api";
// import { ApiError } from "../utils/ApiError";
// import { ApiResponse } from "../utils/ApiResponse";
// import prisma from "../db";

// export class UserController {
//   static async createAccount(
//     bot: TelegramBot,
//     chatId: number,
//     email: string,
//     password: string
//   ) {
//     try {
//       const existingUser = await prisma.user.findUnique({
//         where: { email },
//       });

//       if (existingUser) {
//         console.log("User already exists with this email");
//         throw new ApiError(400, "User already exists with this email");
//       }

//       // Check if there's an existing user with this chatId
//       const existingChatId = await prisma.user.findUnique({
//         where: { chatId: chatId.toString() },
//       });

//       if (existingChatId) {
//         // Instead of throwing an error, delete the existing user record
//         // This handles the case where user logged out but wants to create a new account
//         await prisma.user.delete({
//           where: { chatId: chatId.toString() },
//         });
//         console.log(`Deleted existing user record for chatId: ${chatId}`);
//       }

//       const user = await prisma.user.create({
//         data: {
//           email,
//           password,
//           chatId: chatId.toString(),
//           balance: 0, // Initialize with 0 balance
//         },
//       });

//       return new ApiResponse(201, "Account created successfully", user);
//     } catch (error: any) {
//       console.error("Create account error:", error.message);
//       if (error instanceof ApiError) {
//         throw error;
//       }
//       throw new ApiError(500, "Failed to create account");
//     }
//   }

//   static async login(
//     bot: TelegramBot,
//     chatId: number,
//     email: string,
//     password: string
//   ) {
//     try {
//       const user = await prisma.user.findUnique({
//         where: { email },
//       });

//       if (!user || user.password !== password) {
//         throw new ApiError(401, "Invalid email or password");
//       }

//       // Check if another user is using this chatId
//       const existingChatUser = await prisma.user.findUnique({
//         where: { chatId: chatId.toString() },
//       });

//       if (existingChatUser && existingChatUser.id !== user.id) {
//         // Delete the existing chat user record to allow login
//         await prisma.user.delete({
//           where: { chatId: chatId.toString() },
//         });
//         console.log(`Deleted existing chat user for login: ${chatId}`);
//       }

//       // Update user's chatId to current chatId
//       await prisma.user.update({
//         where: { id: user.id },
//         data: { chatId: chatId.toString() },
//       });

//       return new ApiResponse(200, "Login successful", user);
//     } catch (error: any) {
//       console.error("Login error:", error);
//       if (error instanceof ApiError) {
//         throw error;
//       }
//       throw new ApiError(500, "Login failed");
//     }
//   }

//   static async logout(chatId: string) {
//     try {
//       const user = await prisma.user.findUnique({
//         where: { chatId },
//       });

//       if (user) {
//         await prisma.user.update({
//           where: { chatId },
//           data: { chatId: "" },
//         });
//         console.log(`User logged out successfully: ${chatId}`);
//       }

//       return new ApiResponse(200, "Logged out successfully", null);
//     } catch (error: any) {
//       console.error("Logout error:", error);
//       throw new ApiError(500, "Logout failed");
//     }
//   }

//   // FIXED: Updated to properly handle Prisma relations and removed non-existent fields
//   static async getMyAccount(chatId: string) {
//     try {
//       const user = await prisma.user.findUnique({
//         where: { chatId },
//         include: {
//           purchases: {
//             include: {
//               match: true,
//             },
//             // Since Purchase model doesn't have createdAt, we'll order by id instead
//             orderBy: {
//               id: "desc",
//             },
//           },
//         },
//       });

//       if (!user) {
//         throw new ApiError(404, "User not found");
//       }

//       const matchHistory = user.purchases.map((purchase, index) => ({
//         serial: index + 1,
//         time: purchase.match.time,
//         gameName: purchase.match.gameName,
//         matchName: purchase.match.matchName,
//         buy: purchase.match.price,
//       }));

//       return new ApiResponse(200, "Account details", {
//         email: user.email,
//         balance: user.balance || 0,
//         matchHistory,
//       });
//     } catch (error: any) {
//       console.error("Get my account error:", error);
//       if (error instanceof ApiError) {
//         throw error;
//       }
//       throw new ApiError(500, "Failed to get account details");
//     }
//   }

//   // Helper method to check if user is logged in
//   static async isUserLoggedIn(chatId: string): Promise<boolean> {
//     try {
//       const user = await prisma.user.findUnique({
//         where: { chatId },
//       });
//       return !!user;
//     } catch (error) {
//       return false;
//     }
//   }

//   // Get user by chatId
//   static async getUserByChatId(chatId: string) {
//     try {
//       const user = await prisma.user.findUnique({
//         where: { chatId },
//         select: {
//           id: true,
//           email: true,
//           balance: true,
//           chatId: true,
//         },
//       });

//       if (!user) {
//         throw new ApiError(404, "User not found");
//       }

//       return new ApiResponse(200, "User found", user);
//     } catch (error: any) {
//       console.error("Get user by chatId error:", error);
//       if (error instanceof ApiError) {
//         throw error;
//       }
//       throw new ApiError(500, "Failed to get user");
//     }
//   }

//   // Update user balance (helper method)
//   static async updateBalance(
//     chatId: string,
//     amount: number,
//     operation: "add" | "subtract" | "set"
//   ) {
//     try {
//       const user = await prisma.user.findUnique({
//         where: { chatId },
//       });

//       if (!user) {
//         throw new ApiError(404, "User not found");
//       }

//       let newBalance: number;
//       switch (operation) {
//         case "add":
//           newBalance = (user.balance || 0) + amount;
//           break;
//         case "subtract":
//           newBalance = (user.balance || 0) - amount;
//           break;
//         case "set":
//           newBalance = amount;
//           break;
//         default:
//           throw new ApiError(400, "Invalid operation");
//       }

//       // Ensure balance doesn't go negative
//       if (newBalance < 0) {
//         throw new ApiError(400, "Insufficient balance");
//       }

//       const updatedUser = await prisma.user.update({
//         where: { chatId },
//         data: { balance: newBalance },
//         select: {
//           id: true,
//           email: true,
//           balance: true,
//         },
//       });

//       return new ApiResponse(200, "Balance updated successfully", updatedUser);
//     } catch (error: any) {
//       console.error("Update balance error:", error);
//       if (error instanceof ApiError) {
//         throw error;
//       }
//       throw new ApiError(500, "Failed to update balance");
//     }
//   }

//   // NEW: Purchase a match
//   static async purchaseMatch(chatId: string, matchId: number) {
//     try {
//       const user = await prisma.user.findUnique({
//         where: { chatId },
//       });

//       if (!user) {
//         throw new ApiError(404, "User not found");
//       }

//       const match = await prisma.match.findUnique({
//         where: { id: matchId },
//       });

//       if (!match) {
//         throw new ApiError(404, "Match not found");
//       }

//       // Check if user has sufficient balance
//       if (user.balance < match.price) {
//         throw new ApiError(400, "Insufficient balance");
//       }

//       // Check if user already purchased this match
//       const existingPurchase = await prisma.purchase.findUnique({
//         where: {
//           userId_matchId: {
//             userId: user.id,
//             matchId: matchId,
//           },
//         },
//       });

//       if (existingPurchase) {
//         throw new ApiError(400, "You have already purchased this match");
//       }

//       // Start transaction to ensure data consistency
//       const result = await prisma.$transaction(async (tx) => {
//         // Deduct balance
//         await tx.user.update({
//           where: { id: user.id },
//           data: { balance: user.balance - match.price },
//         });

//         // Create purchase record
//         const purchase = await tx.purchase.create({
//           data: {
//             userId: user.id,
//             matchId: matchId,
//           },
//         });

//         return purchase;
//       });

//       return new ApiResponse(200, "Match purchased successfully", {
//         match: {
//           name: match.matchName,
//           gameName: match.gameName,
//           price: match.price,
//           time: match.time,
//         },
//         remainingBalance: user.balance - match.price,
//       });
//     } catch (error: any) {
//       console.error("Purchase match error:", error);
//       if (error instanceof ApiError) {
//         throw error;
//       }
//       throw new ApiError(500, "Failed to purchase match");
//     }
//   }
// }
// src/controllers/User.controller.ts
import TelegramBot from "node-telegram-bot-api";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../db";
import { MatchHistoryMiddleware } from "../db/src";

export class UserController {
  static async createAccount(
    bot: TelegramBot,
    chatId: number,
    email: string,
    password: string
  ) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        console.log("User already exists with this email");
        throw new ApiError(400, "User already exists with this email");
      }

      // Use transaction to handle this safely
      const user = await prisma.$transaction(async (tx) => {
        // Clear any existing user with this chatId
        await tx.user.updateMany({
          where: { chatId: chatId.toString() },
          data: { chatId: null },
        });

        // Create new user
        return await tx.user.create({
          data: {
            email,
            password,
            chatId: chatId.toString(),
            balance: 0,
          },
        });
      });

      return new ApiResponse(201, "Account created successfully", user);
    } catch (error: any) {
      console.error("Create account error:", error.message);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to create account");
    }
  }

  // static async login(
  //   bot: TelegramBot,
  //   chatId: number,
  //   email: string,
  //   password: string
  // ) {
  //   try {
  //     const user = await prisma.user.findUnique({
  //       where: { email },
  //     });

  //     if (!user || user.password !== password) {
  //       throw new ApiError(401, "Invalid email or password");
  //     }

  //     // Check if another user is using this chatId
  //     const existingChatUser = await prisma.user.findUnique({
  //       where: { chatId: chatId.toString() },
  //     });

  //     if (existingChatUser && existingChatUser.id !== user.id) {
  //       // Delete the existing chat user record to allow login
  //       await prisma.user.delete({
  //         where: { chatId: chatId.toString() },
  //       });
  //       console.log(`Deleted existing chat user for login: ${chatId}`);
  //     }

  //     // Update user's chatId to current chatId
  //     await prisma.user.update({
  //       where: { id: user.id },
  //       data: { chatId: chatId.toString() },
  //     });

  //     return new ApiResponse(200, "Login successful", user);
  //   } catch (error: any) {
  //     console.error("Login error:", error);
  //     if (error instanceof ApiError) {
  //       throw error;
  //     }
  //     throw new ApiError(500, "Login failed");
  //   }
  // }

  // static async logout(chatId: string) {
  //   try {
  //     const user = await prisma.user.findUnique({
  //       where: { chatId },
  //     });

  //     if (user) {
  //       await prisma.user.update({
  //         where: { chatId },
  //         data: { chatId: "" },
  //       });
  //       console.log(`User logged out successfully: ${chatId}`);
  //     }

  //     return new ApiResponse(200, "Logged out successfully", null);
  //   } catch (error: any) {
  //     console.error("Logout error:", error);
  //     throw new ApiError(500, "Logout failed");
  //   }
  // }
  static async login(
    bot: TelegramBot,
    chatId: number,
    email: string,
    password: string
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || user.password !== password) {
        throw new ApiError(401, "Invalid email or password");
      }

      // Use transaction to handle concurrent operations safely
      await prisma.$transaction(async (tx) => {
        // First, clear any existing user with this chatId
        await tx.user.updateMany({
          where: {
            chatId: chatId.toString(),
            id: { not: user.id }, // Don't update the current user
          },
          data: { chatId: null },
        });

        // Then update the current user's chatId
        await tx.user.update({
          where: { id: user.id },
          data: { chatId: chatId.toString() },
        });
      });

      return new ApiResponse(200, "Login successful", user);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Login failed");
    }
  }
  static async logout(chatId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
      });

      if (user) {
        await prisma.user.update({
          where: { chatId },
          data: { chatId: null },
        });
        console.log(`User logged out successfully: ${chatId}`);
      }

      return new ApiResponse(200, "Logged out successfully", null);
    } catch (error: any) {
      console.error("Logout error:", error);
      throw new ApiError(500, "Logout failed");
    }
  }
  // static async getMyAccount(chatId: string) {
  //   try {
  //     const user = await prisma.user.findUnique({
  //       where: { chatId },
  //       include: {
  //         purchases: {
  //           include: {
  //             match: true,
  //           },
  //           orderBy: {
  //             id: "desc",
  //           },
  //         },
  //         matchEntries: {
  //           include: {
  //             match: true,
  //           },
  //           orderBy: {
  //             id: "desc",
  //           },
  //         },
  //       },
  //     });

  //     if (!user) {
  //       throw new ApiError(404, "User not found");
  //     }

  //     // Combine both purchases and match entries for history
  //     const allHistory = [
  //       ...user.purchases.map((purchase, index) => ({
  //         serial: index + 1,
  //         time: purchase.match.time,
  //         gameName: purchase.match.gameName,
  //         matchName: purchase.match.matchName,
  //         type: "Purchase",
  //         amount: purchase.match.price,
  //         createdAt: purchase.createdAt,
  //       })),
  //       ...user.matchEntries.map((entry) => ({
  //         serial: 0, // Will be updated after sorting
  //         time: entry.match.time,
  //         gameName: entry.match.gameName,
  //         matchName: entry.match.matchName,
  //         type: "Entry",
  //         amount: entry.amountPaid,
  //         createdAt: entry.createdAt,
  //       })),
  //     ];

  //     // Sort by creation time and update serial numbers
  //     allHistory.sort(
  //       (a, b) =>
  //         new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  //     );
  //     allHistory.forEach((item, index) => {
  //       item.serial = index + 1;
  //     });

  //     return new ApiResponse(200, "Account details", {
  //       email: user.email,
  //       balance: user.balance || 0,
  //       matchHistory: allHistory,
  //     });
  //   } catch (error: any) {
  //     console.error("Get my account error:", error);
  //     if (error instanceof ApiError) {
  //       throw error;
  //     }
  //     throw new ApiError(500, "Failed to get account details");
  //   }
  // }

  // Helper method to check if user is logged in
  static async getMyAccount(chatId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
        include: {
          matchHistory: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      // Get user statistics
      const stats = await MatchHistoryMiddleware.getUserStats(user.id);

      // Format match history
      const matchHistory = user.matchHistory.map((history, index) => ({
        serial: index + 1,
        time: history.matchTime,
        gameName: history.gameName,
        matchName: history.matchName,
        type: history.type,
        amount: history.amountPaid,
        prizeWon: history.prizeWon,
        killCount: history.killCount,
        position: history.position,
        status: history.status,
        matchDate: history.matchDate,
        completedAt: history.completedAt,
        createdAt: history.createdAt,
      }));

      return new ApiResponse(200, "Account details", {
        email: user.email,
        balance: user.balance || 0,
        statistics: stats,
        matchHistory: matchHistory,
      });
    } catch (error: any) {
      console.error("Get my account error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get account details");
    }
  }

  static async isUserLoggedIn(chatId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
      });
      return !!user;
    } catch (error) {
      return false;
    }
  }

  // Get user by chatId
  static async getUserByChatId(chatId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
        select: {
          id: true,
          email: true,
          balance: true,
          chatId: true,
        },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      return new ApiResponse(200, "User found", user);
    } catch (error: any) {
      console.error("Get user by chatId error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get user");
    }
  }

  // Update user balance (helper method)
  static async updateBalance(
    chatId: string,
    amount: number,
    operation: "add" | "subtract" | "set"
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      let newBalance: number;
      switch (operation) {
        case "add":
          newBalance = (user.balance || 0) + amount;
          break;
        case "subtract":
          newBalance = (user.balance || 0) - amount;
          break;
        case "set":
          newBalance = amount;
          break;
        default:
          throw new ApiError(400, "Invalid operation");
      }

      // Ensure balance doesn't go negative
      if (newBalance < 0) {
        throw new ApiError(400, "Insufficient balance");
      }

      const updatedUser = await prisma.user.update({
        where: { chatId },
        data: { balance: newBalance },
        select: {
          id: true,
          email: true,
          balance: true,
        },
      });

      return new ApiResponse(200, "Balance updated successfully", updatedUser);
    } catch (error: any) {
      console.error("Update balance error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to update balance");
    }
  }

  // DEPRECATED: Purchase a match (keeping for backward compatibility)
  static async purchaseMatch(chatId: string, matchId: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match) {
        throw new ApiError(404, "Match not found");
      }

      // Check if user has sufficient balance
      if (user.balance < match.price) {
        throw new ApiError(400, "Insufficient balance");
      }

      // Check if user already purchased this match
      const existingPurchase = await prisma.purchase.findUnique({
        where: {
          userId_matchId: {
            userId: user.id,
            matchId: matchId,
          },
        },
      });

      if (existingPurchase) {
        throw new ApiError(400, "You have already purchased this match");
      }

      // Start transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Deduct balance
        await tx.user.update({
          where: { id: user.id },
          data: { balance: user.balance - match.price },
        });

        // Create purchase record
        const purchase = await tx.purchase.create({
          data: {
            userId: user.id,
            matchId: matchId,
          },
        });

        return purchase;
      });

      return new ApiResponse(200, "Match purchased successfully", {
        match: {
          name: match.matchName,
          gameName: match.gameName,
          price: match.price,
          time: match.time,
        },
        remainingBalance: user.balance - match.price,
      });
    } catch (error: any) {
      console.error("Purchase match error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to purchase match");
    }
  }

  // NEW: Enter match functionality
  static async enterMatch(chatId: string, matchId: number, amountPaid: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          matchEntries: true,
        },
      });

      if (!match) {
        throw new ApiError(404, "Match not found");
      }

      // Check if seats are available
      if (match.matchEntries.length >= match.totalSeats) {
        throw new ApiError(400, "Match is full! No seats available.");
      }

      // Check if user has sufficient balance
      if (user.balance < amountPaid) {
        throw new ApiError(400, "Insufficient balance");
      }

      // Check if user already entered this match
      const existingEntry = await prisma.matchEntry.findUnique({
        where: {
          userId_matchId: {
            userId: user.id,
            matchId: matchId,
          },
        },
      });

      if (existingEntry) {
        throw new ApiError(400, "You have already entered this match");
      }

      // Start transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Deduct balance
        await tx.user.update({
          where: { id: user.id },
          data: { balance: user.balance - amountPaid },
        });

        // Create match entry record
        const entry = await tx.matchEntry.create({
          data: {
            userId: user.id,
            matchId: matchId,
            amountPaid: amountPaid,
          },
        });

        return entry;
      });

      const remainingSeats = match.totalSeats - match.matchEntries.length - 1;

      return new ApiResponse(200, "Successfully entered the match!", {
        match: {
          name: match.matchName,
          gameName: match.gameName,
          time: match.time,
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          perKillPoint: match.perKillPoint,
        },
        amountPaid,
        remainingBalance: user.balance - amountPaid,
        remainingSeats,
      });
    } catch (error: any) {
      console.error("Enter match error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to enter match");
    }
  }

  // NEW: Get match details for entry
  static async getMatchForEntry(matchId: number) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          matchEntries: true,
        },
      });

      if (!match) {
        throw new ApiError(404, "Match not found");
      }

      const availableSeats = match.totalSeats - match.matchEntries.length;

      return new ApiResponse(200, "Match details", {
        id: match.id,
        name: match.matchName,
        gameName: match.gameName,
        time: match.time,
        entryFees: match.entryFees,
        firstPrize: match.firstPrize,
        secondPrize: match.secondPrize,
        thirdPrize: match.thirdPrize,
        perKillPoint: match.perKillPoint,
        totalSeats: match.totalSeats,
        occupiedSeats: match.matchEntries.length,
        availableSeats,
        isFull: availableSeats <= 0,
      });
    } catch (error: any) {
      console.error("Get match for entry error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get match details");
    }
  }

  // NEW: Check if user can enter a specific match
  static async canEnterMatch(chatId: string, matchId: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          matchEntries: true,
        },
      });

      if (!match) {
        throw new ApiError(404, "Match not found");
      }

      // Check if match is full
      const isFull = match.matchEntries.length >= match.totalSeats;

      // Check if user already entered
      const alreadyEntered = await prisma.matchEntry.findUnique({
        where: {
          userId_matchId: {
            userId: user.id,
            matchId: matchId,
          },
        },
      });

      // Check if user has sufficient balance
      const hasSufficientBalance = user.balance >= match.entryFees;

      return new ApiResponse(200, "Match entry eligibility", {
        canEnter: !isFull && !alreadyEntered && hasSufficientBalance,
        reasons: {
          isFull,
          alreadyEntered: !!alreadyEntered,
          hasSufficientBalance,
        },
        match: {
          id: match.id,
          name: match.matchName,
          gameName: match.gameName,
          entryFees: match.entryFees,
          availableSeats: match.totalSeats - match.matchEntries.length,
        },
        userBalance: user.balance,
      });
    } catch (error: any) {
      console.error("Can enter match error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to check match entry eligibility");
    }
  }
  // Add these new functions to your UserController class

  // NEW: Get all users who joined a specific match (Admin function)
  static async getMatchParticipants(matchId: number) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          matchEntries: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  balance: true,
                  chatId: true,
                  createdAt: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!match) {
        throw new ApiError(404, "Match not found");
      }

      const participants = match.matchEntries.map((entry, index) => ({
        serial: index + 1,
        userId: entry.user.id,
        email: entry.user.email,
        chatId: entry.user.chatId,
        currentBalance: entry.user.balance,
        amountPaid: entry.amountPaid,
        entryTime: entry.createdAt,
        userRegisteredAt: entry.user.createdAt,
      }));

      return new ApiResponse(200, "Match participants retrieved successfully", {
        match: {
          id: match.id,
          name: match.matchName,
          gameName: match.gameName,
          matchName: match.matchName,

          time: match.time,
          totalSeats: match.totalSeats,
          occupiedSeats: match.matchEntries.length,
          availableSeats: match.totalSeats - match.matchEntries.length,
          entryFees: match.entryFees,
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          perKillPoint: match.perKillPoint,
        },
        participants,
        totalParticipants: participants.length,
      });
    } catch (error: any) {
      console.error("Get match participants error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get match participants");
    }
  }

  // NEW: Get all users with their account details in table format (Admin function)
  static async getAllUsersTable() {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          password: true,
          balance: true,
          chatId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc", // Latest users first
        },
      });

      const usersTable = users.map((user, index) => ({
        serial: index + 1,
        userId: user.id,
        email: user.email,
        password: user.password,
        accountBalance: user.balance || 0,
        chatId: user.chatId || "Not logged in",
        registrationDate: user.createdAt,
        status: user.chatId ? "Active" : "Inactive",
      }));

      return new ApiResponse(200, "All users retrieved successfully", {
        users: usersTable,
        totalUsers: usersTable.length,
        activeUsers: usersTable.filter((user) => user.status === "Active")
          .length,
        inactiveUsers: usersTable.filter((user) => user.status === "Inactive")
          .length,
        totalBalance: usersTable.reduce(
          (sum, user) => sum + user.accountBalance,
          0
        ),
      });
    } catch (error: any) {
      console.error("Get all users table error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get users table");
    }
  }

  // BONUS: Get user statistics (Admin function)
  static async getUserStatistics() {
    try {
      const [
        totalUsers,
        activeUsers,
        totalMatches,
        totalEntries,
        totalPurchases,
        totalBalance,
        recentUsers,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { chatId: { not: "" } } }),
        prisma.match.count(),
        prisma.matchEntry.count(),
        prisma.purchase.count(),
        prisma.user.aggregate({ _sum: { balance: true } }),
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            email: true,
            balance: true,
            createdAt: true,
          },
        }),
      ]);

      return new ApiResponse(200, "User statistics retrieved successfully", {
        statistics: {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          totalMatches,
          totalMatchEntries: totalEntries,
          totalPurchases,
          totalSystemBalance: totalBalance._sum.balance || 0,
          userEngagement: {
            averageEntriesPerUser:
              totalUsers > 0 ? (totalEntries / totalUsers).toFixed(2) : 0,
            averagePurchasesPerUser:
              totalUsers > 0 ? (totalPurchases / totalUsers).toFixed(2) : 0,
            averageBalancePerUser:
              totalUsers > 0
                ? ((totalBalance._sum.balance || 0) / totalUsers).toFixed(2)
                : 0,
          },
        },
        recentUsers: recentUsers.map((user, index) => ({
          serial: index + 1,
          email: user.email,
          balance: user.balance,
          registeredAt: user.createdAt,
        })),
      });
    } catch (error: any) {
      console.error("Get user statistics error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get user statistics");
    }
  }
}
