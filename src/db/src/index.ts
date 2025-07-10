// middleware/matchHistoryMiddleware.ts

import { PrismaClient } from "../../../generated/prisma";

const prisma = new PrismaClient();

export class MatchHistoryMiddleware {
  /**
   * Middleware to create match history entry when user purchases a match
   */
  static async createPurchaseHistory(
    userId: bigint | number, // Support both number and bigint
    matchId: number,
    match: any
  ) {
    try {
      const historyEntry = await prisma.matchHistory.create({
        data: {
          userId: BigInt(userId), // Convert to BigInt
          originalMatchId: matchId,
          gameName: match.gameName,
          matchName: match.matchName,
          amountPaid: match.price,
          prizeWon: 0,
          killCount: 0,
          position: null,
          type: "Purchase",
          status: "participated",
          matchDate: match.date,
          completedAt: null,
          entryFees: match.entryFees,
          totalSeats: match.totalSeats,
          netPrizePool: match.netPrizePool,
          perKillPoint: match.perKillPoint,
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          matchTime: match.time,
        },
      });

      console.log(`Match history created for purchase: ${historyEntry.id}`);
      return historyEntry;
    } catch (error) {
      console.error("Error creating purchase history:", error);
      throw error;
    }
  }

  /**
   * Middleware to create match history entry when user enters a match
   */
  static async createEntryHistory(
    userId: bigint | number, // Support both number and bigint
    matchId: number,
    match: any,
    amountPaid: number
  ) {
    try {
      const historyEntry = await prisma.matchHistory.create({
        data: {
          userId: BigInt(userId), // Convert to BigInt
          originalMatchId: matchId,
          gameName: match.gameName,
          matchName: match.matchName,
          amountPaid: amountPaid,
          prizeWon: 0,
          killCount: 0,
          position: null,
          type: "Entry",
          status: "participated",
          matchDate: match.date,
          completedAt: null,
          entryFees: match.entryFees,
          totalSeats: match.totalSeats,
          netPrizePool: match.netPrizePool,
          perKillPoint: match.perKillPoint,
          firstPrize: match.firstPrize,
          secondPrize: match.secondPrize,
          thirdPrize: match.thirdPrize,
          matchTime: match.time,
        },
      });

      console.log(`Match history created for entry: ${historyEntry.id}`);
      return historyEntry;
    } catch (error) {
      console.error("Error creating entry history:", error);
      throw error;
    }
  }

  /**
   * Update match history when match is completed
   */
  static async updateMatchCompletion(
    userId: bigint | number, // Support both number and bigint
    matchId: number,
    prizeWon: number = 0,
    killCount: number = 0,
    position: number | null = null,
    status: string = "participated"
  ) {
    try {
      const updatedHistory = await prisma.matchHistory.updateMany({
        where: {
          userId: BigInt(userId), // Convert to BigInt
          originalMatchId: matchId,
        },
        data: {
          prizeWon: prizeWon,
          killCount: killCount,
          position: position,
          status: status,
          completedAt: new Date(),
        },
      });

      console.log(
        `Match history updated for completion: ${updatedHistory.count} records`
      );
      return updatedHistory;
    } catch (error) {
      console.error("Error updating match completion:", error);
      throw error;
    }
  }

  /**
   * Get user's match history with pagination
   */
  static async getUserMatchHistory(
    userId: bigint | number, // Support both number and bigint
    page: number = 1,
    limit: number = 50
  ) {
    try {
      const offset = (page - 1) * limit;

      const history = await prisma.matchHistory.findMany({
        where: { userId: BigInt(userId) }, // Convert to BigInt
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      });

      const total = await prisma.matchHistory.count({
        where: { userId: BigInt(userId) }, // Convert to BigInt
      });

      return {
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error getting user match history:", error);
      throw error;
    }
  }

  /**
   * Get user statistics from match history
   */
  static async getUserStats(userId: bigint | number) {
    // Support both number and bigint
    try {
      const stats = await prisma.matchHistory.aggregate({
        where: { userId: BigInt(userId) }, // Convert to BigInt
        _count: {
          id: true,
        },
        _sum: {
          amountPaid: true,
          prizeWon: true,
          killCount: true,
        },
      });

      const winCount = await prisma.matchHistory.count({
        where: {
          userId: BigInt(userId), // Convert to BigInt
          position: 1,
        },
      });

      const winRate =
        stats._count.id > 0 ? (winCount / stats._count.id) * 100 : 0;

      return {
        totalMatches: stats._count.id || 0,
        totalAmountSpent: stats._sum.amountPaid || 0,
        totalPrizeWon: stats._sum.prizeWon || 0,
        totalKills: stats._sum.killCount || 0,
        matchesWon: winCount,
        winRate: parseFloat(winRate.toFixed(2)),
        netProfit: (stats._sum.prizeWon || 0) - (stats._sum.amountPaid || 0),
      };
    } catch (error) {
      console.error("Error getting user stats:", error);
      throw error;
    }
  }
}
