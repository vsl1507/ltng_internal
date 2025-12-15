import ApiRouter from "../utils/api-router";
import dashboardController from "../controllers/dashboard.contoller";

const apiRouter = new ApiRouter();

// Get system statistics
apiRouter.addRoute({
  method: "get",
  path: "/stats",
  handler: (req, res) => dashboardController.getSystemStats(req, res),
  summary: "Get system statistics",
  description:
    "Retrieve overall system statistics including account counts by status",
  tags: ["System"],
  responses: {
    200: {
      description: "System statistics retrieved successfully",
      schema: "SuccessResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get system health
apiRouter.addRoute({
  method: "get",
  path: "/health",
  handler: (req, res) => dashboardController.getSystemHealth(req, res),
  summary: "Health check endpoint",
  description: "Check if the system is running properly",
  tags: ["System"],
  responses: {
    200: {
      description: "System is healthy",
      schema: "SuccessResponse",
    },
    500: {
      description: "System unhealthy",
      schema: "ErrorResponse",
    },
  },
});

// Get system info
apiRouter.addRoute({
  method: "get",
  path: "/info",
  handler: (req, res) => dashboardController.getSystemInfo(req, res),
  summary: "Get system information",
  description:
    "Retrieve system information including version, features, and configuration",
  tags: ["System"],
  responses: {
    200: {
      description: "System information retrieved",
      schema: "SuccessResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

export default apiRouter;
