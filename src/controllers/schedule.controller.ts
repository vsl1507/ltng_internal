import { Request, Response } from "express";
import ResponseHandler from "../utils/response-handler";
import schedulerService from "../services/shecdule.service";

export class CleanupController {
  private scheduleService;

  constructor() {
    this.scheduleService = schedulerService;
  }

  // Manually trigger cleanup
  async triggerCleanup(req: Request, res: Response): Promise<void> {
    try {
      console.log("Manual cleanup triggered by user");

      const result = await this.scheduleService.runManualCleanup();

      ResponseHandler.success(
        res,
        result,
        `Cleanup completed: ${result.radarCount} news radar and ${result.telegramCount} telegram records deleted`
      );
    } catch (error) {
      console.error("Error triggering manual cleanup:", error);
      ResponseHandler.internalError(res, "Failed to run cleanup");
    }
  }

  // Get cleanup job status
  async getJobsStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = schedulerService.getJobsStatus();

      ResponseHandler.success(
        res,
        { jobs: status },
        "Jobs status retrieved successfully"
      );
    } catch (error) {
      console.error("Error getting jobs status:", error);
      ResponseHandler.internalError(res, "Failed to get jobs status");
    }
  }

  // Get records that will be deleted in next cleanup
  async getUpcomingCleanup(req: Request, res: Response): Promise<void> {
    try {
      // This would show what records are eligible for cleanup
      // You can implement the actual query logic here

      ResponseHandler.success(
        res,
        { message: "Preview upcoming cleanup" },
        "Preview generated successfully"
      );
    } catch (error) {
      console.error("Error getting upcoming cleanup:", error);
      ResponseHandler.internalError(res, "Failed to get cleanup preview");
    }
  }
}

export default new CleanupController();
