// index.ts
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import express from "express";
import { MatchNotificationService } from "./services/Match.service";
import cornRouter from "./routes/corn.route";
import { BotRoutes } from "./routes/bot.routes";

dotenv.config({ path: ".env" });

const token = process.env.BOT_TOKEN!;
const isDev = process.env.NODE_ENV !== "production";
const forcePolling = process.env.FORCE_POLLING === "true";

// Global variables to hold services
let matchNotificationService: MatchNotificationService;
let server: any;

// Enhanced bot configuration with error handling
const bot = new TelegramBot(token, {
  polling:
    isDev || forcePolling
      ? {
          interval: 1000, // Check for updates every 1 second (less aggressive)
          autoStart: false, // Don't start automatically
          params: {
            timeout: 30, // Long polling timeout (increased)
          },
        }
      : false,
  // Simplified request configuration to avoid TypeScript issues
  request: {
    forever: true, // Keep-alive connections
    timeout: 60000, // 60 second timeout
  } as any, // Type assertion to avoid TypeScript conflicts
});

const app = express();
app.use(express.json());

// Initialize bot with proper error handling
const initializeBot = async () => {
  try {
    console.log("Initializing bot...");

    // Always clear webhook first
    await bot.deleteWebHook();
    console.log("Cleared existing webhook");

    if (!isDev && !forcePolling) {
      // Webhook mode for production
      const webhookPath = `/bot${token}`;
      const serverUrl =
        process.env.SERVER_URL || "https://telegram-bot-x997.onrender.com";
      const fullWebhookUrl = `${serverUrl}${webhookPath}`;

      console.log("Setting up webhook at:", fullWebhookUrl);
      await bot.setWebHook(fullWebhookUrl);
      console.log("Webhook set successfully");

      app.post(webhookPath, (req, res) => {
        console.log("Received webhook update");
        try {
          bot.processUpdate(req.body);
          res.sendStatus(200);
        } catch (error) {
          console.error("Error processing webhook:", error);
          res.sendStatus(500);
        }
      });
    } else {
      // Polling mode for development or when forced
      console.log("Setting up polling mode...");

      // Add error handlers before starting polling
      bot.on("polling_error", (error: any) => {
        console.error("Polling error:", {
          message: error.message,
          code: error.code,
          stack: error.stack,
        });

        // Try to restart polling after error
        setTimeout(async () => {
          try {
            console.log("Attempting to restart polling...");
            await bot.stopPolling();
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await bot.startPolling();
            console.log("Polling restarted successfully");
          } catch (restartError) {
            console.error("Failed to restart polling:", restartError);
          }
        }, 5000);
      });

      bot.on("webhook_error", (error) => {
        console.error("Webhook error:", error);
      });

      // Start polling with retry logic
      let retryCount = 0;
      const maxRetries = 3;

      const startPollingWithRetry = async () => {
        try {
          await bot.startPolling();
          console.log("Bot polling started successfully");
          retryCount = 0; // Reset retry count on success
        } catch (error) {
          console.error(
            `Polling start failed (attempt ${retryCount + 1}):`,
            error
          );
          retryCount++;

          if (retryCount < maxRetries) {
            console.log(`Retrying in ${retryCount * 2} seconds...`);
            setTimeout(startPollingWithRetry, retryCount * 2000);
          } else {
            console.error("Max polling retries reached, giving up");
            throw error;
          }
        }
      };

      await startPollingWithRetry();
    }

    // Test bot connection
    const me = await bot.getMe();
    console.log(`Bot initialized successfully: @${me.username} (ID: ${me.id})`);

    return true;
  } catch (error) {
    console.error("Failed to initialize bot:", error);

    // If webhook setup fails, fallback to polling
    if (!isDev && !forcePolling) {
      console.log("Webhook failed, falling back to polling...");
      try {
        await bot.deleteWebHook();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await bot.startPolling();
        console.log("Fallback polling started");
        return true;
      } catch (pollingError) {
        console.error("Polling fallback also failed:", pollingError);
        return false;
      }
    }

    return false;
  }
};

// Add global error handlers
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit immediately in production
  if (process.env.NODE_ENV === "production") {
    console.log("Continuing execution despite uncaught exception");
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit immediately in production
  if (process.env.NODE_ENV === "production") {
    console.log("Continuing execution despite unhandled rejection");
  }
});

// Initialize services after bot is ready
const initializeServices = async () => {
  try {
    console.log("Initializing services...");

    // Wait for bot to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    matchNotificationService = new MatchNotificationService(bot);
    matchNotificationService.startMatchNotificationCron();
    console.log("Match notification service started");

    new BotRoutes(bot);
    console.log("Bot routes initialized");

    return true;
  } catch (error) {
    console.error("Failed to initialize services:", error);
    return false;
  }
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    mode: isDev || forcePolling ? "polling" : "webhook",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Bot status endpoint with better error handling
app.get("/api/v1/bot/status", async (req, res) => {
  try {
    const me = await bot.getMe();
    const webhookInfo = await bot.getWebHookInfo();

    res.json({
      status: "active",
      botInfo: {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
      },
      mode: isDev || forcePolling ? "polling" : "webhook",
      webhookInfo: {
        url: webhookInfo.url,
        hasCustomCertificate: webhookInfo.has_custom_certificate,
        pendingUpdateCount: webhookInfo.pending_update_count,
        lastErrorDate: webhookInfo.last_error_date,
        lastErrorMessage: webhookInfo.last_error_message,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Bot status check failed:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get bot status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Send message endpoint
app.post("/api/v1/bot/send-message", async (req, res) => {
  try {
    const { chatId, message, options } = req.body;

    if (!chatId || !message) {
      res.status(400).json({
        error: "chatId and message are required",
      });
      return;
    }

    const result = await bot.sendMessage(chatId, message, options);
    res.json({
      success: true,
      messageId: result.message_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to send message:", error);
    res.status(500).json({
      error: "Failed to send message",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Corn router
app.use("/api/v1/getResponse", cornRouter);

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down bot...");

  try {
    // Stop services first
    if (matchNotificationService) {
      matchNotificationService.stopMatchNotificationCron();
      console.log("Match notification service stopped");
    }

    // Stop polling if active
    if (isDev || forcePolling) {
      try {
        await bot.stopPolling();
        console.log("Polling stopped");
      } catch (error) {
        console.error("Error stopping polling:", error);
      }
    }

    // Close express server
    if (server) {
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }

    // Force exit after 10 seconds
    setTimeout(() => {
      console.log("Force exit");
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// Start server
const port = process.env.PORT || 8000;
server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(
    `Bot running in ${isDev || forcePolling ? "polling" : "webhook"} mode`
  );
});

// Initialize everything with proper error handling
const startApplication = async () => {
  try {
    console.log("Starting application...");

    const botInitialized = await initializeBot();
    if (!botInitialized) {
      console.error("Failed to initialize bot, exiting...");
      process.exit(1);
    }

    const servicesInitialized = await initializeServices();
    if (!servicesInitialized) {
      console.error("Failed to initialize services, but continuing...");
    }

    console.log("Application started successfully!");
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
};

// Start the application
startApplication();

export { bot, matchNotificationService };
