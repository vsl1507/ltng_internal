import CleanupController from "../controllers/schedule.controller";
import ApiRouter from "../utils/api-router";

const apiRouter = new ApiRouter();

// Manually trigger cleanup
apiRouter.addRoute({
  method: "post",
  path: "/trigger",
  handler: (req, res) => CleanupController.triggerCleanup(req, res),
  summary: "Manually trigger cleanup of old deleted records",
  tags: ["Cleanup"],
  responses: {
    200: {
      description: "Cleanup completed successfully",
      schema: "SingleResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get jobs status
apiRouter.addRoute({
  method: "get",
  path: "/status",
  handler: (req, res) => CleanupController.getJobsStatus(req, res),
  summary: "Get status of scheduled cleanup jobs",
  tags: ["Cleanup"],
  responses: {
    200: {
      description: "Jobs status",
      schema: "SingleResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Preview upcoming cleanup
apiRouter.addRoute({
  method: "get",
  path: "/preview",
  handler: (req, res) => CleanupController.getUpcomingCleanup(req, res),
  summary: "Preview records that will be deleted in next cleanup",
  tags: ["Cleanup"],
  responses: {
    200: {
      description: "Cleanup preview",
      schema: "SingleResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

export default apiRouter;
