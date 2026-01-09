import ApiRouter from "../utils/api-router";
import newsRadarAIController from "../controllers/news-radar-ai.controller";

const apiRouter = new ApiRouter();

//Get new ai radar
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => newsRadarAIController.getAllNewsRadarAI(req, res),
  summary: "Get all news radar generate by AI with filters and pagination",
  tags: ["News Radar AI"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by title, contents",
    },
    {
      name: "sort_by",
      type: "string",
      enum: [
        "radar_ai_story_number",
        "created_at",
        "udpated_at",
        "radar_ai_version",
      ],
      description: "Sort field",
    },
    {
      name: "sort_order",
      type: "string",
      enum: ["ASC", "DESC"],
      description: "Sort order",
      default: "DESC",
    },
    {
      name: "page",
      type: "integer",
      description: "Page number",
      default: 1,
    },
    {
      name: "limit",
      type: "integer",
      description: "Items per page",
      default: 50,
    },
  ],
  responses: {
    200: {
      description: "List of accounts with pagination",
      schema: "PaginatedResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

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
