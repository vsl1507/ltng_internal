import ApiRouter from "../utils/api-router";
import SourceController from "../controllers/source.controller";

const apiRouter = new ApiRouter();

// Get all sources
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => SourceController.getAllSources(req, res),
  summary: "Get all news sources",
  tags: ["News Sources"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by name or identifier",
    },
    {
      name: "source_type_id",
      type: "integer",
      description: "Filter by source type ID",
    },
    {
      name: "source_is_active",
      type: "boolean",
      description: "Filter by active status",
    },
    {
      name: "source_is_trusted",
      type: "boolean",
      description: "Filter by trusted status",
    },
    {
      name: "source_country",
      type: "string",
      description: "Filter by country code (e.g., US, KH)",
    },
    {
      name: "is_deleted",
      type: "boolean",
      description: "Show deleted records",
      default: false,
    },
    {
      name: "sort_by",
      type: "string",
      enum: ["source_id", "source_name", "source_identifier", "create_at"],
      description: "Sort field",
    },
    {
      name: "sort_order",
      type: "string",
      enum: ["ASC", "DESC"],
      description: "Sort order",
      default: "DESC",
    },
    { name: "page", type: "integer", description: "Page number", default: 1 },
    {
      name: "limit",
      type: "integer",
      description: "Items per page",
      default: 50,
    },
  ],
  responses: {
    200: { description: "List of sources", schema: "PaginatedResponse" },
  },
});

// Get source by ID
apiRouter.addRoute({
  method: "get",
  path: "/:id",
  handler: (req, res) => SourceController.getSourceById(req, res),
  summary: "Get source by ID",
  tags: ["News Sources"],
  pathParams: [
    { name: "id", type: "integer", required: true, description: "Source ID" },
  ],
  responses: {
    200: { description: "Source details", schema: "SingleResponse" },
    404: { description: "Source not found", schema: "ErrorResponse" },
  },
});

// Get source by identifier
apiRouter.addRoute({
  method: "get",
  path: "/identifier/:identifier",
  handler: (req, res) => SourceController.getSourceByIdentifier(req, res),
  summary: "Get source by identifier",
  tags: ["News Sources"],
  pathParams: [
    {
      name: "identifier",
      type: "string",
      required: true,
      description: "Source identifier",
    },
  ],
  responses: {
    200: { description: "Source details", schema: "SingleResponse" },
    404: { description: "Source not found", schema: "ErrorResponse" },
  },
});

// Get sources by type
apiRouter.addRoute({
  method: "get",
  path: "/type/:typeId",
  handler: (req, res) => SourceController.getSourcesByType(req, res),
  summary: "Get sources by type",
  tags: ["News Sources"],
  pathParams: [
    {
      name: "typeId",
      type: "integer",
      required: true,
      description: "Source type ID",
    },
  ],
  queryParams: [
    { name: "page", type: "integer", default: 1 },
    { name: "limit", type: "integer", default: 50 },
  ],
  responses: {
    200: { description: "Sources list", schema: "PaginatedResponse" },
  },
});

// Get active sources
apiRouter.addRoute({
  method: "get",
  path: "/active/list",
  handler: (req, res) => SourceController.getActiveSources(req, res),
  summary: "Get all active sources",
  tags: ["News Sources"],
  queryParams: [
    { name: "page", type: "integer", default: 1 },
    { name: "limit", type: "integer", default: 50 },
  ],
  responses: {
    200: { description: "Active sources", schema: "PaginatedResponse" },
  },
});

// Get trusted sources
apiRouter.addRoute({
  method: "get",
  path: "/trusted/list",
  handler: (req, res) => SourceController.getTrustedSources(req, res),
  summary: "Get all trusted sources",
  tags: ["News Sources"],
  queryParams: [
    { name: "page", type: "integer", default: 1 },
    { name: "limit", type: "integer", default: 50 },
  ],
  responses: {
    200: { description: "Trusted sources", schema: "PaginatedResponse" },
  },
});

// Create new source
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => SourceController.createSource(req, res),
  summary: "Create new source",
  tags: ["News Sources"],
  requestBody: {
    required: true,
    schema: "NewsSource",
    example: {
      source_type_id: 1,
      source_name: "CNN Breaking News",
      source_identifier: "cnn_breaking",
      source_config: {
        api_key: "xxx",
        refresh_interval: 300,
      },
      source_is_active: true,
      source_is_trusted: true,
      source_country: "US",
      user_id: 1,
    },
  },
  responses: {
    201: { description: "Source created", schema: "SingleResponse" },
    400: { description: "Validation error", schema: "ErrorResponse" },
    409: { description: "Identifier already exists", schema: "ErrorResponse" },
  },
});

// Update source
apiRouter.addRoute({
  method: "put",
  path: "/:id",
  handler: (req, res) => SourceController.updateSource(req, res),
  summary: "Update source",
  tags: ["News Sources"],
  pathParams: [
    { name: "id", type: "integer", required: true, description: "Source ID" },
  ],
  requestBody: {
    required: true,
    schema: "NewsSourceUpdate",
    example: {
      source_name: "Updated Name",
      source_is_active: false,
      user_id: 1,
    },
  },
  responses: {
    200: { description: "Source updated", schema: "SingleResponse" },
    404: { description: "Source not found", schema: "ErrorResponse" },
  },
});

// Delete source
apiRouter.addRoute({
  method: "delete",
  path: "/:id",
  handler: (req, res) => SourceController.deleteSource(req, res),
  summary: "Delete source",
  description: "Soft delete by default. Use ?hard=true for permanent deletion",
  tags: ["News Sources"],
  pathParams: [
    { name: "id", type: "integer", required: true, description: "Source ID" },
  ],
  queryParams: [
    {
      name: "hard",
      type: "boolean",
      description: "Permanent deletion",
      default: false,
    },
  ],
  responses: {
    200: { description: "Source deleted", schema: "SuccessResponse" },
    404: { description: "Source not found", schema: "ErrorResponse" },
  },
});

// Restore source
apiRouter.addRoute({
  method: "post",
  path: "/:id/restore",
  handler: (req, res) => SourceController.restoreSource(req, res),
  summary: "Restore deleted source",
  tags: ["News Sources"],
  pathParams: [
    { name: "id", type: "integer", required: true, description: "Source ID" },
  ],
  responses: {
    200: { description: "Source restored", schema: "SingleResponse" },
    404: { description: "Source not found", schema: "ErrorResponse" },
  },
});

// Bulk update status
apiRouter.addRoute({
  method: "post",
  path: "/bulk/update-status",
  handler: (req, res) => SourceController.bulkUpdateStatus(req, res),
  summary: "Bulk update source status",
  tags: ["News Sources"],
  requestBody: {
    required: true,
    schema: "BulkUpdateRequest",
    example: {
      ids: [1, 2, 3],
      source_is_active: true,
      source_is_trusted: true,
      user_id: 1,
    },
  },
  responses: {
    200: { description: "Sources updated", schema: "BulkResponse" },
  },
});

// Bulk delete
apiRouter.addRoute({
  method: "post",
  path: "/bulk/delete",
  handler: (req, res) => SourceController.bulkDelete(req, res),
  summary: "Bulk delete sources",
  tags: ["News Sources"],
  requestBody: {
    required: true,
    schema: "BulkDeleteRequest",
    example: {
      ids: [1, 2, 3],
      soft: true,
      user_id: 1,
    },
  },
  responses: {
    200: { description: "Sources deleted", schema: "BulkResponse" },
  },
});

export default apiRouter;
