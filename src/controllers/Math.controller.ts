import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../db";

export class MatchController {
  static async addMatch(name: string, price: number, time: string) {
    try {
      const match = await prisma.match.create({
        data: {
          name,
          price,
          time,
        },
      });

      return new ApiResponse(201, "Match added successfully", match);
    } catch (error) {
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
      });

      const matchTable = matches.map(
        (match: { time: any; name: any; price: any }, index: number) => ({
          serial: index + 1,
          time: match.time,
          name: match.name,
          buy: match.price,
        })
      );

      return new ApiResponse(200, "Today's matches", matchTable);
    } catch (error) {
      throw new ApiError(500, "Failed to get matches");
    }
  }

  static async getAllMatches() {
    try {
      const matches = await prisma.match.findMany({
        orderBy: {
          date: "desc",
        },
      });

      const matchTable = matches.map(
        (
          match: { id: any; time: any; name: any; price: any; date: any },
          index: number
        ) => ({
          id: match.id,
          serial: index + 1,
          time: match.time,
          name: match.name,
          price: match.price,
          date: match.date.toDateString(),
        })
      );

      return new ApiResponse(200, "All matches", matchTable);
    } catch (error) {
      throw new ApiError(500, "Failed to get all matches");
    }
  }

  static async deleteMatch(matchName: string) {
    try {
      // Find the match by exact name
      const matchToDelete = await prisma.match.findFirst({
        where: {
          name: {
            equals: matchName,
            mode: "insensitive", // Case insensitive search
          },
        },
      });

      if (!matchToDelete) {
        throw new ApiError(404, `Match with name "${matchName}" not found`);
      }

      // Check if there are any purchases associated with this match
      const purchaseCount = await prisma.purchase.count({
        where: {
          matchId: matchToDelete.id,
        },
      });

      if (purchaseCount > 0) {
        throw new ApiError(
          400,
          `Cannot delete match "${matchName}" as it has ${purchaseCount} associated purchases`
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
        `Match "${matchName}" deleted successfully`,
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
      });

      const history = purchases.map(
        (purchase: {
          id: any;
          match: { time: any; name: any; price: any };
        }) => ({
          serial: purchase.id,
          time: purchase.match.time,
          name: purchase.match.name,
          buy: purchase.match.price,
        })
      );

      return new ApiResponse(200, "Match history", history);
    } catch (error) {
      throw new ApiError(500, "Failed to get match history");
    }
  }

  // NEW: Give match to user by admin
  static async giveMatchToUser(userEmail: string, matchId: number) {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user) {
        throw new ApiError(404, `User with email "${userEmail}" not found`);
      }

      // Find match by ID
      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match) {
        throw new ApiError(404, `Match with ID "${matchId}" not found`);
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
        `Match "${match.name}" given to user "${userEmail}" successfully`,
        {
          user: { email: user.email, id: user.id },
          match: { name: match.name, time: match.time, price: match.price },
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

  // NEW: Get user balance by email
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

  // NEW: Update user balance by email
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

  // NEW: Get matches that need notification (current time matches)
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
