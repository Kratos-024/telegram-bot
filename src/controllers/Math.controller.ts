import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../db";

export class MatchController {
  static async addMatch(
    gameName: string,
    matchName: string,
    perKillPoint: number,
    firstPrize: number,
    secondPrize: number,
    thirdPrize: number,
    entryFees: number,
    time: string,
    totalSeats: number = 100
  ) {
    try {
      const [year, month, day, hour, minute] = time.split("-").map(Number);
      const matchDate = new Date(year, month - 1, day, hour, minute);

      const match = await prisma.match.create({
        data: {
          gameName,
          matchName,
          price: entryFees, // Keep price as entryFees for compatibility
          perKillPoint,
          firstPrize,
          secondPrize,
          thirdPrize,
          entryFees,
          totalSeats,
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

      const matchTable = matches.map((match, index) => ({
        id: match.id,
        serial: index + 1,
        time: match.time,
        gameName: match.gameName,
        name: match.matchName,
        entryFees: match.entryFees,
        perKillPoint: match.perKillPoint,
        firstPrize: match.firstPrize,
        secondPrize: match.secondPrize,
        thirdPrize: match.thirdPrize,
        totalSeats: match.totalSeats,
        occupiedSeats: match.matchEntries.length,
        availableSeats: match.totalSeats - match.matchEntries.length,
      }));

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

      const matchTable = matches.map((match, index) => ({
        id: match.id,
        serial: index + 1,
        time: match.time,
        name: match.matchName,
        entryFees: match.entryFees,
        perKillPoint: match.perKillPoint,
        firstPrize: match.firstPrize,
        secondPrize: match.secondPrize,
        thirdPrize: match.thirdPrize,
        totalSeats: match.totalSeats,
        occupiedSeats: match.matchEntries.length,
        availableSeats: match.totalSeats - match.matchEntries.length,
      }));

      return new ApiResponse(
        200,
        `Today's matches for ${cleanedGameName}`,
        matchTable
      );
    } catch (error) {
      console.error("Get today's matches by game error:", error);
      throw new ApiError(500, `Failed to get matches for ${gameName}`);
    }
  }

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
        serial: index + 1,
        gameName: match.gameName,
        matchName: match.matchName,
        entryFees: match.entryFees,
        perKillPoint: match.perKillPoint,
        firstPrize: match.firstPrize,
        secondPrize: match.secondPrize,
        thirdPrize: match.thirdPrize,
        totalSeats: match.totalSeats,
        occupiedSeats: match.matchEntries.length,
        time: match.time,
        date: match.date.toDateString(),
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
}
