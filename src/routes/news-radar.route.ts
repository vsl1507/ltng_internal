import ApiRouter from "../utils/api-router";
import newsRadarController from "../controllers/news-radar.controller";

const apiRouter = new ApiRouter();

// Get all radars with filters and pagination
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => newsRadarController.getAllRadars(req, res),
  summary: "Get all news radars with filters and pagination",
  tags: ["News Radar"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by title, content, or URL",
    },
    {
      name: "radar_category_id",
      type: "integer",
      description: "Filter by category ID",
    },
    {
      name: "radar_source_id",
      type: "integer",
      description: "Filter by source ID",
    },
    {
      name: "radar_processing_status",
      type: "string",
      enum: ["All", "NEW", "PROCESSING", "COMPLETED", "FAILED"],
      description: "Filter by processing status",
    },
    {
      name: "radar_is_breaking",
      type: "boolean",
      description: "Filter by breaking news flag",
    },
    {
      name: "radar_is_duplicated",
      type: "boolean",
      description: "Filter by duplicated flag",
    },
    {
      name: "radar_story_number",
      type: "integer",
      description: "Filter by story number",
    },
    {
      name: "is_deleted",
      type: "boolean",
      description: "Include deleted records",
      default: false,
    },
    {
      name: "published_year",
      type: "string",
      enum: ["All", "< 2024", "2023-2024", "> 2024"],
      description: "Filter by published year",
    },
    {
      name: "sort_by",
      type: "string",
      enum: [
        "radar_id",
        "radar_published_at",
        "radar_scraped_at",
        "radar_story_number",
        "radar_processing_status",
        "created_at",
        "updated_at",
      ],
      description: "Sort field",
      default: "updated_at",
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
      description: "List of news radars with pagination",
      schema: "PaginatedResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get radar by ID
apiRouter.addRoute({
  method: "get",
  path: "/:id",
  handler: (req, res) => newsRadarController.getRadarById(req, res),
  summary: "Get news radar by ID",
  tags: ["News Radar"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "News radar ID",
    },
  ],
  responses: {
    200: {
      description: "News radar details",
      schema: "SingleResponse",
    },
    404: {
      description: "News radar not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get radars by story number
apiRouter.addRoute({
  method: "get",
  path: "/story/:storyNumber",
  handler: (req, res) => newsRadarController.getRadarsByStoryNumber(req, res),
  summary: "Get news radars by story number",
  tags: ["News Radar"],
  pathParams: [
    {
      name: "storyNumber",
      type: "integer",
      required: true,
      description: "Story number",
    },
  ],
  responses: {
    200: {
      description: "List of news radars with the same story number",
      schema: "ArrayResponse",
    },
    400: {
      description: "Invalid story number",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get child radars (related articles)
apiRouter.addRoute({
  method: "get",
  path: "/:parentId/children",
  handler: (req, res) => newsRadarController.getChildRadars(req, res),
  summary: "Get child radars (related articles)",
  tags: ["News Radar"],
  pathParams: [
    {
      name: "parentId",
      type: "integer",
      required: true,
      description: "Parent radar ID",
    },
  ],
  responses: {
    200: {
      description: "List of child radars",
      schema: "ArrayResponse",
    },
    400: {
      description: "Invalid parent radar ID",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Create new radar
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => newsRadarController.createRadar(req, res),
  summary: "Create new news radar",
  tags: ["News Radar"],
  requestBody: {
    required: true,
    schema: "NewsRadar",
    example: {
      radar_category_id: 1,
      radar_source_id: 5,
      radar_title: "Breaking: Major Tech Announcement",
      radar_content: "Full article content goes here...",
      radar_url: "https://example.com/article/tech-announcement",
      radar_published_at: "2024-01-15T10:30:00Z",
      radar_is_breaking: true,
      radar_processing_status: "NEW",
    },
  },
  responses: {
    201: {
      description: "News radar created successfully",
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

// Update radar
apiRouter.addRoute({
  method: "put",
  path: "/:id",
  handler: (req, res) => newsRadarController.updateRadar(req, res),
  summary: "Update news radar",
  tags: ["News Radar"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "News radar ID",
    },
  ],
  requestBody: {
    required: true,
    schema: "NewsRadarUpdate",
    example: {
      radar_title: "Updated: Major Tech Announcement",
      radar_processing_status: "COMPLETED",
      radar_is_breaking: false,
      radar_story_number: 12345,
    },
  },
  responses: {
    200: {
      description: "News radar updated successfully",
      schema: "SingleResponse",
    },
    404: {
      description: "News radar not found",
      schema: "ErrorResponse",
    },
    400: {
      description: "No changes made or validation error",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Delete radar
apiRouter.addRoute({
  method: "delete",
  path: "/:id",
  handler: (req, res) => newsRadarController.deleteRadar(req, res),
  summary: "Delete news radar",
  tags: ["News Radar"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "News radar ID",
    },
  ],
  queryParams: [
    {
      name: "hard",
      type: "boolean",
      description: "Perform hard delete (permanent)",
      default: false,
    },
  ],
  responses: {
    200: {
      description: "News radar deleted successfully",
      schema: "SuccessResponse",
    },
    404: {
      description: "News radar not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Restore deleted radar
apiRouter.addRoute({
  method: "post",
  path: "/:id/restore",
  handler: (req, res) => newsRadarController.restoreRadar(req, res),
  summary: "Restore deleted news radar",
  tags: ["News Radar"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "News radar ID",
    },
  ],
  responses: {
    200: {
      description: "News radar restored successfully",
      schema: "SuccessResponse",
    },
    404: {
      description: "News radar not found or already active",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Bulk update processing status
apiRouter.addRoute({
  method: "post",
  path: "/bulk/update-status",
  handler: (req, res) => newsRadarController.bulkUpdateStatus(req, res),
  summary: "Bulk update news radar processing status",
  tags: ["News Radar"],
  requestBody: {
    required: true,
    schema: "BulkUpdateStatusRequest",
    example: {
      ids: [1, 2, 3, 5],
      radar_processing_status: "COMPLETED",
    },
  },
  responses: {
    200: {
      description: "News radars updated successfully",
      schema: "BulkResponse",
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

// Bulk update breaking news flag
apiRouter.addRoute({
  method: "post",
  path: "/bulk/update-breaking",
  handler: (req, res) => newsRadarController.bulkUpdateBreaking(req, res),
  summary: "Bulk update news radar breaking news flag",
  tags: ["News Radar"],
  requestBody: {
    required: true,
    schema: "BulkUpdateBreakingRequest",
    example: {
      ids: [1, 2, 3],
      radar_is_breaking: true,
    },
  },
  responses: {
    200: {
      description: "News radars updated successfully",
      schema: "BulkResponse",
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

// Bulk delete
apiRouter.addRoute({
  method: "post",
  path: "/bulk/delete",
  handler: (req, res) => newsRadarController.bulkDelete(req, res),
  summary: "Bulk delete news radars",
  tags: ["News Radar"],
  requestBody: {
    required: true,
    schema: "BulkDeleteRequest",
    example: {
      ids: [1, 2, 3],
      hard: false,
    },
  },
  responses: {
    200: {
      description: "News radars deleted successfully",
      schema: "BulkResponse",
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
