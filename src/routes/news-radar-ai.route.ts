import ApiRouter from "../utils/api-router";
import newsRadarAIController from "../controllers/news-radar-ai.controller";

const apiRouter = new ApiRouter();

// Create new AI radar
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => newsRadarAIController.createRadarAI(req, res),
  summary: "Create new AI news radar",
  tags: ["News Radar AI"],
  requestBody: {
    required: true,
    schema: "NewsRadarAI",
    example: {
      radar_id: 1,
    },
  },
  responses: {
    201: {
      description: "AI news radar created successfully",
      schema: "SingleResponse",
    },
    400: {
      description: "Validation error",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

export default apiRouter;
