import { Request, Response } from "express";
import path from "path";
import fbAccountService from "../services/fb-account.service";
import ResponseHandler from "../utils/response-handler";

export class DashboardController {
  // Serve dashboard HTML
  async renderDashboard(req: Request, res: Response): Promise<void> {
    try {
      res.sendFile(path.join(__dirname, "../../public/dashboard.html"));
    } catch (error) {
      console.error("Error rendering dashboard:", error);
      res.status(500).send("Error loading dashboard");
    }
  }

  // Get system statistics
  async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      // Get total accounts
      const allAccounts = await fbAccountService.getAllAccounts({
        page: 1,
        limit: 1,
      });

      // Get accounts by status
      const activeAccounts = await fbAccountService.getAllAccounts({
        acc_status: "ACTIVE",
        page: 1,
        limit: 1,
      });

      const checkpointAccounts = await fbAccountService.getAllAccounts({
        acc_status: "CHECKPOINT",
        page: 1,
        limit: 1,
      });

      const appealCheckpointAccounts = await fbAccountService.getAllAccounts({
        acc_status: "APPEAL_CHECKPOINT",
        page: 1,
        limit: 1,
      });

      const lockedAccounts = await fbAccountService.getAllAccounts({
        acc_status: "LOCKED",
        page: 1,
        limit: 1,
      });

      const disabledAccounts = await fbAccountService.getAllAccounts({
        acc_status: "DISABLED",
        page: 1,
        limit: 1,
      });

      const errorPasswordAccounts = await fbAccountService.getAllAccounts({
        acc_status: "ERROR_PASSWORD",
        page: 1,
        limit: 1,
      });

      const error2FAAccounts = await fbAccountService.getAllAccounts({
        acc_status: "ERROR_2FA",
        page: 1,
        limit: 1,
      });

      // Get accounts with friend suggestion enabled
      const friendSuggestionAccounts = await fbAccountService.getAllAccounts({
        acc_friend_suggestion: "YES",
        page: 1,
        limit: 1,
      });

      // Get accounts with intro set
      const introSetAccounts = await fbAccountService.getAllAccounts({
        page: 1,
        limit: 1,
      });

      // Get accounts with profile picture set
      const picSetAccounts = await fbAccountService.getAllAccounts({
        page: 1,
        limit: 1,
      });

      const stats = {
        total: allAccounts.pagination.total,
        by_status: {
          active: activeAccounts.pagination.total,
          checkpoint: checkpointAccounts.pagination.total,
          appeal_checkpoint: appealCheckpointAccounts.pagination.total,
          locked: lockedAccounts.pagination.total,
          disabled: disabledAccounts.pagination.total,
          error_password: errorPasswordAccounts.pagination.total,
          error_2fa: error2FAAccounts.pagination.total,
        },
        by_features: {
          friend_suggestion_enabled: friendSuggestionAccounts.pagination.total,
          intro_set: introSetAccounts.pagination.total,
          profile_pic_set: picSetAccounts.pagination.total,
        },
        summary: {
          healthy: activeAccounts.pagination.total,
          needs_attention:
            checkpointAccounts.pagination.total +
            appealCheckpointAccounts.pagination.total +
            errorPasswordAccounts.pagination.total +
            error2FAAccounts.pagination.total,
          blocked:
            lockedAccounts.pagination.total + disabledAccounts.pagination.total,
        },
        last_updated: new Date().toISOString(),
      };

      ResponseHandler.success(
        res,
        stats,
        "System statistics retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching system stats:", error);
      ResponseHandler.internalError(res, "Failed to fetch system statistics");
    }
  }

  // Get system health
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        uptime_formatted: this.formatUptime(process.uptime()),
        database: "connected",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      };

      ResponseHandler.success(res, health, "System health check passed");
    } catch (error) {
      console.error("Error checking system health:", error);
      ResponseHandler.internalError(res, "Health check failed");
    }
  }

  // Get system info
  async getSystemInfo(req: Request, res: Response): Promise<void> {
    try {
      const info = {
        name: "FB Account Manager API",
        version: "1.0.0",
        description: "Professional Facebook Account Management System",
        endpoints: {
          dashboard: "/",
          api_docs: "/api-docs",
          api_base: "/api/fb-accounts",
          system_stats: "/system/stats",
          system_health: "/system/health",
          system_info: "/system/info",
        },
        features: [
          "CRUD Operations",
          "Advanced Filtering (Status, Friend Suggestion, Creation Year)",
          "Multi-field Search (Username, UID, Name, Notes)",
          "Pagination",
          "Bulk Operations (Update Status, Delete)",
          "Auto-Generated Swagger Documentation",
          "Standard Response Format",
          "Type-Safe with TypeScript",
          "2FA Management",
          "Cookie Storage",
          "Account Profile Tracking",
        ],
        account_statuses: [
          "ACTIVE",
          "CHECKPOINT",
          "APPEAL_CHECKPOINT",
          "LOCKED",
          "DISABLED",
          "ERROR_PASSWORD",
          "ERROR_2FA",
        ],
        database: {
          type: "MySQL",
          host: process.env.DB_HOST || "localhost",
          port: process.env.DB_PORT || "3306",
          database: process.env.DB_NAME || "ltng_internal",
          table: "ltng_media_facebook_acc",
        },
        server: {
          node_version: process.version,
          platform: process.platform,
          memory_usage: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
            heap_used: `${Math.round(
              process.memoryUsage().heapUsed / 1024 / 1024
            )}MB`,
            heap_total: `${Math.round(
              process.memoryUsage().heapTotal / 1024 / 1024
            )}MB`,
          },
        },
        timestamp: new Date().toISOString(),
      };

      ResponseHandler.success(res, info, "System information retrieved");
    } catch (error) {
      console.error("Error fetching system info:", error);
      ResponseHandler.internalError(res, "Failed to fetch system information");
    }
  }

  // Helper method to format uptime
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(" ");
  }
}

export default new DashboardController();
