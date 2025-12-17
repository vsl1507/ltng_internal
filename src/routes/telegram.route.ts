import ApiRouter from "../utils/api-router";
import telegramController from "../controllers/telegram.controller";

const apiRouter = new ApiRouter();

// Get all telegrams with filters and pagination
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => telegramController.getAllTelegrams(req, res),
  summary: "Get all telegrams with filters and pagination",
  tags: ["Telegrams"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by name, username, chat ID, or description",
    },
    {
      name: "telegram_type",
      type: "string",
      enum: ["All", "CHANNEL", "GROUP", "PRIVATE"],
      description: "Filter by telegram type",
    },
    {
      name: "telegram_is_active",
      type: "boolean",
      description: "Filter by active status",
    },
    {
      name: "telegram_chat_id",
      type: "string",
      description: "Filter by specific chat ID",
    },
    {
      name: "telegram_username",
      type: "string",
      description: "Filter by username",
    },
    {
      name: "is_deleted",
      type: "boolean",
      description: "Include deleted records",
      default: false,
    },
    {
      name: "sort_by",
      type: "string",
      enum: [
        "telegram_id",
        "telegram_name",
        "telegram_username",
        "telegram_type",
        "telegram_is_active",
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
      description: "List of telegrams with pagination",
      schema: "PaginatedResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get telegram by ID
apiRouter.addRoute({
  method: "get",
  path: "/:id",
  handler: (req, res) => telegramController.getTelegramById(req, res),
  summary: "Get telegram by ID",
  tags: ["Telegrams"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Telegram ID",
    },
  ],
  responses: {
    200: {
      description: "Telegram details",
      schema: "SingleResponse",
    },
    404: {
      description: "Telegram not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get telegram by chat ID
apiRouter.addRoute({
  method: "get",
  path: "/chat/:chatId",
  handler: (req, res) => telegramController.getTelegramByChatId(req, res),
  summary: "Get telegram by chat ID",
  tags: ["Telegrams"],
  pathParams: [
    {
      name: "chatId",
      type: "string",
      required: true,
      description: "Telegram chat ID",
    },
  ],
  responses: {
    200: {
      description: "Telegram details",
      schema: "SingleResponse",
    },
    404: {
      description: "Telegram not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Create new telegram
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => telegramController.createTelegram(req, res),
  summary: "Create new telegram",
  tags: ["Telegrams"],
  requestBody: {
    required: true,
    schema: "Telegram",
    example: {
      telegram_name: "Tech News Channel",
      telegram_username: "technewsdaily",
      telegram_chat_id: "-1001234567890",
      telegram_type: "CHANNEL",
      telegram_is_active: true,
      telegram_description: "Daily updates on technology and innovation",
    },
  },
  responses: {
    201: {
      description: "Telegram created successfully",
      schema: "SingleResponse",
    },
    400: {
      description: "Validation error",
      schema: "ErrorResponse",
    },
    409: {
      description: "Chat ID already exists",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Update telegram
apiRouter.addRoute({
  method: "put",
  path: "/:id",
  handler: (req, res) => telegramController.updateTelegram(req, res),
  summary: "Update telegram",
  tags: ["Telegrams"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Telegram ID",
    },
  ],
  requestBody: {
    required: true,
    schema: "TelegramUpdate",
    example: {
      telegram_name: "Tech News Channel Updated",
      telegram_is_active: false,
      telegram_description: "Updated description for the channel",
    },
  },
  responses: {
    200: {
      description: "Telegram updated successfully",
      schema: "SingleResponse",
    },
    404: {
      description: "Telegram not found",
      schema: "ErrorResponse",
    },
    400: {
      description: "No changes made or validation error",
      schema: "ErrorResponse",
    },
    409: {
      description: "Chat ID conflict",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Delete telegram
apiRouter.addRoute({
  method: "delete",
  path: "/:id",
  handler: (req, res) => telegramController.deleteTelegram(req, res),
  summary: "Delete telegram",
  tags: ["Telegrams"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Telegram ID",
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
      description: "Telegram deleted successfully",
      schema: "SuccessResponse",
    },
    404: {
      description: "Telegram not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Restore deleted telegram
apiRouter.addRoute({
  method: "post",
  path: "/:id/restore",
  handler: (req, res) => telegramController.restoreTelegram(req, res),
  summary: "Restore deleted telegram",
  tags: ["Telegrams"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Telegram ID",
    },
  ],
  responses: {
    200: {
      description: "Telegram restored successfully",
      schema: "SuccessResponse",
    },
    404: {
      description: "Telegram not found or already active",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Bulk update status
apiRouter.addRoute({
  method: "post",
  path: "/bulk/update-status",
  handler: (req, res) => telegramController.bulkUpdateStatus(req, res),
  summary: "Bulk update telegram active status",
  tags: ["Telegrams"],
  requestBody: {
    required: true,
    schema: "BulkUpdateRequest",
    example: {
      ids: [1, 2, 3, 5],
      telegram_is_active: true,
    },
  },
  responses: {
    200: {
      description: "Telegrams updated successfully",
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
  handler: (req, res) => telegramController.bulkDelete(req, res),
  summary: "Bulk delete telegrams",
  tags: ["Telegrams"],
  requestBody: {
    required: true,
    schema: "BulkDeleteRequest",
    example: {
      ids: [1, 2, 3],
      soft: true,
    },
  },
  responses: {
    200: {
      description: "Telegrams deleted successfully",
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

// Get statistics
apiRouter.addRoute({
  method: "get",
  path: "/stats/overview",
  handler: (req, res) => telegramController.getStatistics(req, res),
  summary: "Get telegram statistics",
  tags: ["Telegrams"],
  responses: {
    200: {
      description: "Statistics overview",
      schema: "StatsResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

export default apiRouter;
