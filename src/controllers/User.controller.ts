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
          },
        },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }
      //@ts-ignore
      const matchHistory = user.purchases.map((purchase) => ({
        serial: purchase.id,
        time: purchase.match.time,
        name: purchase.match.name,
        buy: purchase.match.price,
      }));

      return new ApiResponse(200, "Account details", {
        email: user.email,
        balance: user.balance,
        matchHistory,
      });
    } catch (error) {
      throw new ApiError(500, "Failed to get account details");
    }
  }
}
