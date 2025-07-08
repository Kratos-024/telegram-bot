import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../db";

// Additional helper function to validate platform settings
export function validatePlatformSettings(
  entryFee: number,
  platformPercent: number,
  minPrizePool: number = 0
): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (platformPercent >= 1.0) {
    errors.push("Platform percentage cannot be 100% or more");
  } else if (platformPercent >= 0.8) {
    warnings.push(
      "Platform percentage is very high (80%+), leaving minimal prize pool"
    );
  }

  if (entryFee <= 0) {
    errors.push("Entry fee must be greater than 0");
  }

  const netAfterPlatform = entryFee * (1 - platformPercent);
  if (netAfterPlatform < minPrizePool) {
    warnings.push(
      `Net amount after platform fees (${netAfterPlatform}) is below minimum prize pool (${minPrizePool})`
    );
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

// Example usage and testing
// export function testPrizeCalculation() {
//   console.log("=== Testing Prize Pool Calculation ===");

//   // Test case 1: Your problematic scenario
//   console.log("\n1. Testing problematic scenario (100% platform fee):");
//   try {
//     const result = calculateDynamicPrizePool({
//       entryFee: 100,
//       numberOfPlayers: 1,
//       maxPlayers: 10,
//       platformPercent: 1.0, // 100%
//       perKillPoint: 0.2,
//     });
//     console.log("Result:", result);
//   } catch (error: any) {
//     console.log("Error (expected):", error.message);
//   }

//   // Test case 2: Reasonable scenario
//   console.log("\n2. Testing reasonable scenario (30% platform fee):");
//   try {
//     const result = calculateDynamicPrizePool({
//       entryFee: 100,
//       numberOfPlayers: 1,
//       maxPlayers: 10,
//       platformPercent: 0.3, // 30%
//       perKillPoint: 0.2,
//     });
//     console.log("Result:", result);
//   } catch (error: any) {
//     console.log("Error:", error.message);
//   }

//   // Test case 3: Validation function
//   console.log("\n3. Testing validation function:");
//   const validation = validatePlatformSettings(100, 1.0, 10);
//   console.log("Validation result:", validation);
// }
export class MatchController {
  static async addMatch(
    gameName: string,
    matchName: string,
    totalPlayer: number,
    perKillPoint: number,
    entryFees: number,
    time: string,
    firstPrize: number,
    secondPrize: number,
    thirdPrize: number,
    imageFileId: string
  ) {
    try {
      const [year, month, day, hour, minute] = time.split("-").map(Number);
      const matchDate = new Date(year, month - 1, day, hour, minute);

      const match = await prisma.match.create({
        data: {
          imageFileId: imageFileId,
          gameName,
          matchName,
          netPrizePool: firstPrize + secondPrize + thirdPrize,
          price: entryFees,
          perKillPoint: perKillPoint,
          firstPrize: firstPrize,
          secondPrize: secondPrize,
          thirdPrize: thirdPrize,
          entryFees,
          totalSeats: totalPlayer,
          time,
          date: matchDate,
        },
      });

      return new ApiResponse(201, "Match added successfully", match);
    } catch (error) {
      console.error("Add match error:", error);
      throw new ApiError(500, "Failed to add match");
    }
  }

  // Remove all calculateDynamicPrizePool calls and prize updating logic
  // Keep the match as-is without updating prizes
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

      if (match.matchEntries.length >= match.totalSeats) {
        throw new ApiError(400, "Match is full! No seats available.");
      }

      if (user.balance < amountPaid) {
        throw new ApiError(400, "Insufficient balance");
      }

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

      const currentPlayersBeforeJoin = match.matchEntries.length;

      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { balance: user.balance - amountPaid },
        });

        const entry = await tx.matchEntry.create({
          data: {
            userId: user.id,
            matchId: matchId,
            amountPaid: amountPaid,
          },
        });

        await tx.purchase.create({
          data: {
            userId: user.id,
            matchId: match.id,
          },
        });

        return entry;
      });

      const newPlayerCount = currentPlayersBeforeJoin + 1;
      const remainingSeats = match.totalSeats - newPlayerCount;

      return new ApiResponse(200, "Successfully entered the match!", {
        match: {
          name: match.matchName,
          gameName: match.gameName,
          time: match.time,
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          perKillPoint: match.perKillPoint,
          netPrizePool: match.netPrizePool,
        },
        playerInfo: {
          currentPlayers: newPlayerCount,
          maxPlayers: match.totalSeats,
          remainingSeats,
          playerNumber: newPlayerCount,
        },
        amountPaid,
        remainingBalance: user.balance - amountPaid,
      });
    } catch (error: any) {
      console.error("Enter match error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to enter match");
    }
  }

  static async getTodayMatches() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const matches = await prisma.match.findMany({
        where: {
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          matchEntries: true,
        },
        orderBy: [{ gameName: "asc" }, { time: "asc" }],
      });

      const matchTable = matches.map((match, index) => {
        const currentPlayers = match.matchEntries.length;

        return {
          id: match.id,
          imageFileId: match.imageFileId,
          serial: index + 1,
          time: match.time,
          gameName: match.gameName,
          name: match.matchName,
          prizePool: match.netPrizePool,
          entryFees: match.entryFees,
          perKillPoint: match.perKillPoint,
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          totalSeats: match.totalSeats,
          occupiedSeats: currentPlayers,
          availableSeats: match.totalSeats - currentPlayers,
          matchStatus: {
            fillPercentage: (currentPlayers / match.totalSeats) * 100,
            status:
              currentPlayers === 0
                ? "🆕 New Match"
                : currentPlayers === match.totalSeats
                ? "🔥 Full"
                : currentPlayers >= match.totalSeats * 0.8
                ? "⚡ Almost Full"
                : "📈 Available",
          },
        };
      });

      return new ApiResponse(200, "Today's matches", matchTable);
    } catch (error) {
      console.error("Get today's matches error:", error);
      throw new ApiError(500, "Failed to get matches");
    }
  }

  static async getTodayMatchesByGame(gameName: string) {
    try {
      const cleanedGameName = gameName.replace(/^selection_/, "").trim();

      const today = new Date();
      const utcToday = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
      );
      const utcTomorrow = new Date(utcToday);
      utcTomorrow.setUTCDate(utcTomorrow.getUTCDate() + 1);

      const matches = await prisma.match.findMany({
        where: {
          gameName: {
            equals: cleanedGameName,
            mode: "insensitive",
          },
          date: {
            gte: utcToday,
            lt: utcTomorrow,
          },
        },
        include: {
          matchEntries: true,
        },
        orderBy: {
          time: "asc",
        },
      });

      const matchTable = matches.map((match, index) => {
        const currentPlayers = match.matchEntries.length;

        return {
          id: match.id,
          serial: index + 1,
          time: match.time,
          gameName: match.gameName,
          prizePool: match.netPrizePool,
          name: match.matchName,
          entryFees: match.entryFees,
          perKillPoint: match.perKillPoint,
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          totalSeats: match.totalSeats,
          occupiedSeats: currentPlayers,
          availableSeats: match.totalSeats - currentPlayers,
          matchInfo: {
            currentFillPercentage: (currentPlayers / match.totalSeats) * 100,
            status:
              currentPlayers === 0
                ? "🆕 Just Created"
                : currentPlayers === match.totalSeats
                ? "🔥 Full Match"
                : currentPlayers >= match.totalSeats * 0.75
                ? "⚡ Almost Full"
                : "📈 Available",
          },
        };
      });

      return new ApiResponse(
        200,
        `Today's ${cleanedGameName} matches`,
        matchTable
      );
    } catch (error) {
      console.error("Get today's matches by game error:", error);
      throw new ApiError(500, `Failed to get matches for ${gameName}`);
    }
  }

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

      const currentPlayers = match.matchEntries.length;
      const availableSeats = match.totalSeats - currentPlayers;
      const canGrow = availableSeats > 0;

      return new ApiResponse(200, "Match details", {
        id: match.id,
        name: match.matchName,
        gameName: match.gameName,
        time: match.time,
        entryFees: match.entryFees,
        currentPrizes: {
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          perKillPoint: match.perKillPoint,
        },
        matchStatus: {
          totalSeats: match.totalSeats,
          occupiedSeats: currentPlayers,
          availableSeats,
          fillPercentage: (currentPlayers / match.totalSeats) * 100,
          isFull: availableSeats <= 0,
          canJoin: canGrow,
          prizePool: match.netPrizePool,
        },
      });
    } catch (error: any) {
      console.error("Get match for entry error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get match details");
    }
  }

  // Keep all other existing methods the same...
  static async getGameCategories() {
    try {
      const games = await prisma.match.findMany({
        select: {
          gameName: true,
        },
        distinct: ["gameName"],
      });

      const gameNames = games.map((game) => game.gameName);

      return new ApiResponse(200, "Game categories", gameNames);
    } catch (error) {
      console.error("Get game categories error:", error);
      throw new ApiError(500, "Failed to get game categories");
    }
  }

  static async getAllMatches() {
    try {
      const matches = await prisma.match.findMany({
        include: {
          matchEntries: true,
        },
        orderBy: {
          date: "desc",
        },
      });

      const matchTable = matches.map((match, index) => ({
        id: match.id,
        imageFileId: match.imageFileId,
        serial: index + 1,
        gameName: match.gameName,
        matchName: match.matchName,
        entryFees: match.entryFees,
        perKillPoint: match.perKillPoint,
        firstPrize: match.firstPrize,
        secondPrize: match.secondPrize,
        thirdPrize: match.thirdPrize,
        prizePool: match.netPrizePool,
        totalSeats: match.totalSeats,
        occupiedSeats: match.matchEntries.length,
        time: match.time,
        date: match.date.toDateString(),
        dynamicStatus: {
          fillPercentage: (match.matchEntries.length / match.totalSeats) * 100,
          status:
            match.matchEntries.length === match.totalSeats
              ? "Completed"
              : "Active",
        },
      }));

      return new ApiResponse(200, "All matches", matchTable);
    } catch (error) {
      console.error("Get all matches error:", error);
      throw new ApiError(500, "Failed to get all matches");
    }
  }

  static async deleteMatch(matchId: number) {
    try {
      const matchToDelete = await prisma.match.findFirst({
        where: {
          id: {
            equals: matchId,
          },
        },
        include: {
          matchEntries: true,
          purchases: true,
        },
      });

      if (!matchToDelete) {
        throw new ApiError(404, `Match with ID "${matchId}" not found`);
      }

      const totalEntries =
        matchToDelete.matchEntries.length + matchToDelete.purchases.length;

      if (totalEntries > 0) {
        throw new ApiError(
          400,
          `Cannot delete match "${matchToDelete?.matchName}" as it has ${totalEntries} associated entries/purchases`
        );
      }

      await prisma.match.delete({
        where: {
          id: matchToDelete.id,
        },
      });

      return new ApiResponse(
        200,
        `Match "${matchToDelete?.matchName}" deleted successfully`,
        null
      );
    } catch (error: any) {
      console.error("Delete match error:", error.message);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to delete match");
    }
  }

  static async getMatchHistory(userId: number) {
    try {
      const purchases = await prisma.purchase.findMany({
        where: { userId },
        include: { match: true },
        orderBy: { createdAt: "desc" },
      });

      const entries = await prisma.matchEntry.findMany({
        where: { userId },
        include: { match: true },
        orderBy: { createdAt: "desc" },
      });

      const history = [
        ...purchases.map((purchase, index) => ({
          serial: index + 1,
          time: purchase.match.time,
          gameName: purchase.match.gameName,
          matchName: purchase.match.matchName,
          type: "Purchase",
          amount: purchase.match.price,
        })),
        ...entries.map((entry, index) => ({
          serial: purchases.length + index + 1,
          time: entry.match.time,
          gameName: entry.match.gameName,
          matchName: entry.match.matchName,
          type: "Entry",
          amount: entry.amountPaid,
        })),
      ];

      // Sort by creation time (newest first)
      history.sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      return new ApiResponse(200, "Match history", history);
    } catch (error) {
      console.error("Get match history error:", error);
      throw new ApiError(500, "Failed to get match history");
    }
  }

  static async getUserBalance(userEmail: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: {
          id: true,
          email: true,
          balance: true,
          createdAt: true,
          purchases: {
            include: {
              match: true,
            },
          },
          matchEntries: {
            include: {
              match: true,
            },
          },
        },
      });

      if (!user) {
        throw new ApiError(404, `User with email "${userEmail}" not found`);
      }

      const totalMatches = user.purchases.length + user.matchEntries.length;

      return new ApiResponse(200, "User balance retrieved successfully", {
        id: user.id,
        email: user.email,
        balance: user.balance,
        createdAt: user.createdAt,
        totalMatches,
      });
    } catch (error: any) {
      console.error("Get user balance error:", error.message);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to get user balance");
    }
  }

  static async updateUserBalance(userEmail: string, newBalance: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user) {
        throw new ApiError(404, `User with email "${userEmail}" not found`);
      }

      const updatedUser = await prisma.user.update({
        where: { email: userEmail },
        data: { balance: newBalance },
        select: {
          id: true,
          email: true,
          balance: true,
        },
      });

      return new ApiResponse(
        200,
        `User balance updated successfully from Rs.${user.balance} to Rs.${newBalance}`,
        updatedUser
      );
    } catch (error: any) {
      console.error("Update user balance error:", error.message);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to update user balance");
    }
  }

  static async getMatchesForNotification() {
    try {
      const now = new Date();
      const currentTime = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(
        now.getHours()
      ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;

      const matches = await prisma.match.findMany({
        where: {
          time: currentTime,
        },
        include: {
          purchases: {
            include: {
              user: true,
            },
          },
          matchEntries: {
            include: {
              user: true,
            },
          },
        },
      });

      return matches;
    } catch (error) {
      console.error("Get matches for notification error:", error);
      throw new ApiError(500, "Failed to get matches for notification");
    }
  }

  static async deleteAllMatch() {
    try {
      // Delete all related records first due to foreign key constraints
      await prisma.matchEntry.deleteMany({});
      await prisma.purchase.deleteMany({});
      await prisma.match.deleteMany({});

      return new ApiResponse(200, "Deleted all matches successfully", null);
    } catch (error: any) {
      console.error("Delete all matches error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to delete all matches");
    }
  }
  static async getMatchById(matchId: number) {
    try {
      const match = await prisma.match.findUnique({
        where: {
          id: matchId,
        },
        include: {
          purchases: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  chatId: true,
                  balance: true,
                  createdAt: true,
                  // Exclude password for security
                },
              },
            },
          },
          matchEntries: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  chatId: true,
                  balance: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!match) {
        console.log(`Match with ID ${matchId} not found`);
        return null;
      }

      console.log(
        `Retrieved match: ${match.matchName} with ${match.purchases.length} purchases`
      );
      return match;
    } catch (error) {
      console.error("Error fetching match by ID:", error);
      throw new Error(`Failed to fetch match with ID ${matchId}`);
    }
  }
}
