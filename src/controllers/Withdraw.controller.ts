// src/controllers/Withdraw.controller.ts
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../db";

export class WithdrawController {
  static async getWithdrawInfo(chatId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { chatId },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      return new ApiResponse(200, "Withdraw info", {
        balance: user.balance,
        adminUsername: process.env.ADMIN_USERNAME || "admin",
      });
    } catch (error) {
      throw new ApiError(500, "Failed to get withdraw info");
    }
  }
}
