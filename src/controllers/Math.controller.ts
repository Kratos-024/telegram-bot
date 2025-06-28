import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../db";

export class MatchController {
  static async addMatch(
    gameName: string,
    matchName: string,
    price: number,
    time: string
  ) {
    try {
      const [year, month, day, hour, minute] = time.split("-").map(Number);
      const matchDate = new Date(year, month - 1, day, hour, minute);

      const match = await prisma.match.create({
        data: {
          gameName,
          matchName,
          price,
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

  // FIXED: Updated to return matches grouped by game
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
        orderBy: [{ gameName: "asc" }, { time: "asc" }],
      });

      const matchTable = matches.map((match, index) => ({
        id: match.id,
        serial: index + 1,
        time: match.time,
        gameName: match.gameName,
        name: match.matchName,
        buy: match.price,
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

      console.log("UTC Today:", utcToday.toISOString());
      console.log("UTC Tomorrow:", utcTomorrow.toISOString());

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
        orderBy: {
          time: "asc",
        },
      });

      const matchTable = matches.map((match, index) => ({
        id: match.id,
        serial: index + 1,
        time: match.time,
        name: match.matchName,
        buy: match.price,
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

  // FIXED: Updated to match new schema with gameName and matchName
  static async getAllMatches() {
    try {
      const matches = await prisma.match.findMany({
        orderBy: {
          date: "desc",
        },
      });

      const matchTable = matches.map((match, index) => ({
        id: match.id,
        serial: index + 1,
        gameName: match.gameName,
        matchName: match.matchName,
        price: match.price,
        time: match.time,
        date: match.date.toDateString(),
      }));

      return new ApiResponse(200, "All matches", matchTable);
    } catch (error) {
      console.error("Get all matches error:", error);
      throw new ApiError(500, "Failed to get all matches");
    }
  }

  // FIXED: Updated to use matchName instead of name
  static async deleteMatch(matchId: number) {
    try {
      console.log(
        "dflkjflskfdflkjflskfdflkjflskfdflkjflskfdflkjflskf",
        matchId
      );
      const matchToDelete = await prisma.match.findFirst({
        where: {
          id: {
            equals: matchId,
          },
        },
      });

      if (!matchToDelete) {
        throw new ApiError(404, `Match with name "${matchToDelete}" not found`);
      }

      const purchaseCount = await prisma.purchase.count({
        where: {
          matchId: matchToDelete.id,
        },
      });

      if (purchaseCount > 0) {
        throw new ApiError(
          400,
          `Cannot delete match "${matchToDelete?.matchName}" as it has ${purchaseCount} associated purchases`
        );
      }

      // Delete the match
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

  // FIXED: Updated to use matchName and gameName
  static async getMatchHistory(userId: number) {
    try {
      const purchases = await prisma.purchase.findMany({
        where: { userId },
        include: { match: true },
        orderBy: { createdAt: "desc" },
      });

      const history = purchases.map((purchase, index) => ({
        serial: index + 1,
        time: purchase.match.time,
        gameName: purchase.match.gameName,
        matchName: purchase.match.matchName,
        buy: purchase.match.price,
      }));

      return new ApiResponse(200, "Match history", history);
    } catch (error) {
      console.error("Get match history error:", error);
      throw new ApiError(500, "Failed to get match history");
    }
  }

  // FIXED: Updated to include gameName parameter as used in BotRoutes
  static async giveMatchToUser(
    userEmail: string,
    matchId: number,
    gameName: string
  ) {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user) {
        throw new ApiError(404, `User with email "${userEmail}" not found`);
      }

      // Find match by ID and optionally verify game name
      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          gameName: {
            equals: gameName,
            mode: "insensitive",
          },
        },
      });

      if (!match) {
        throw new ApiError(
          404,
          `Match with ID "${matchId}" not found in game "${gameName}"`
        );
      }

      // Check if user already has this match
      const existingPurchase = await prisma.purchase.findUnique({
        where: {
          userId_matchId: {
            userId: user.id,
            matchId: matchId,
          },
        },
      });

      if (existingPurchase) {
        throw new ApiError(400, `User already has this match`);
      }

      // Create purchase record
      await prisma.purchase.create({
        data: {
          userId: user.id,
          matchId: matchId,
        },
      });

      return new ApiResponse(
        200,
        `Match "${match.matchName}" from game "${match.gameName}" given to user "${userEmail}" successfully`,
        {
          user: { email: user.email, id: user.id },
          match: {
            name: match.matchName,
            gameName: match.gameName,
            time: match.time,
            price: match.price,
          },
        }
      );
    } catch (error: any) {
      console.error("Give match to user error:", error.message);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to give match to user");
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
        },
      });

      if (!user) {
        throw new ApiError(404, `User with email "${userEmail}" not found`);
      }

      return new ApiResponse(200, "User balance retrieved successfully", {
        id: user.id,
        email: user.email,
        balance: user.balance,
        createdAt: user.createdAt,
        totalMatches: user.purchases.length,
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

  // FIXED: Updated to use matchName
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
        },
      });

      return matches;
    } catch (error) {
      console.error("Get matches for notification error:", error);
      throw new ApiError(500, "Failed to get matches for notification");
    }
  }
}
