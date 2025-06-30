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

      // Check if there's an existing user with this chatId
      const existingChatId = await prisma.user.findUnique({
        where: { chatId: chatId.toString() },
      });

      if (existingChatId) {
        // Instead of throwing an error, delete the existing user record
        // This handles the case where user logged out but wants to create a new account
        await prisma.user.delete({
          where: { chatId: chatId.toString() },
        });
        console.log(`Deleted existing user record for chatId: ${chatId}`);
      }

      const user = await prisma.user.create({
        data: {
          email,
          password,
          chatId: chatId.toString(),
          balance: 0, // Initialize with 0 balance
        },
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

      // Check if another user is using this chatId
      const existingChatUser = await prisma.user.findUnique({
        where: { chatId: chatId.toString() },
      });

      if (existingChatUser && existingChatUser.id !== user.id) {
        // Delete the existing chat user record to allow login
        await prisma.user.delete({
          where: { chatId: chatId.toString() },
        });
        console.log(`Deleted existing chat user for login: ${chatId}`);
      }

      // Update user's chatId to current chatId
      await prisma.user.update({
        where: { id: user.id },
        data: { chatId: chatId.toString() },
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
          data: { chatId: "" },
        });
        console.log(`User logged out successfully: ${chatId}`);
      }

      return new ApiResponse(200, "Logged out successfully", null);
    } catch (error: any) {
      console.error("Logout error:", error);
      throw new ApiError(500, "Logout failed");
    }
  }

  static async getMyAccount(chatId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
        include: {
          purchases: {
            include: {
              match: true,
            },
            orderBy: {
              id: "desc",
            },
          },
          matchEntries: {
            include: {
              match: true,
            },
            orderBy: {
              id: "desc",
            },
          },
        },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      // Combine both purchases and match entries for history
      const allHistory = [
        ...user.purchases.map((purchase, index) => ({
          serial: index + 1,
          time: purchase.match.time,
          gameName: purchase.match.gameName,
          matchName: purchase.match.matchName,
          type: "Purchase",
          amount: purchase.match.price,
          createdAt: purchase.createdAt,
        })),
        ...user.matchEntries.map((entry) => ({
          serial: 0, // Will be updated after sorting
          time: entry.match.time,
          gameName: entry.match.gameName,
          matchName: entry.match.matchName,
          type: "Entry",
          amount: entry.amountPaid,
          createdAt: entry.createdAt,
        })),
      ];

      // Sort by creation time and update serial numbers
      allHistory.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      allHistory.forEach((item, index) => {
        item.serial = index + 1;
      });

      return new ApiResponse(200, "Account details", {
        email: user.email,
        balance: user.balance || 0,
        matchHistory: allHistory,
      });
    } catch (error: any) {
      console.error("Get my account error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get account details");
    }
  }

  // Helper method to check if user is logged in
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
}
