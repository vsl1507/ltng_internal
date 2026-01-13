import ApiRouter from "../utils/api-router";
import SourceController from "../controllers/source.controller";

const apiRouter = new ApiRouter();

/**
 *  Get all sources with filters and pagination
 */
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
      enum: ["source_id", "source_name", "source_identifier", "created_at"],
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
    200: {
      description: "List of sources with pagination",
      schema: "PaginatedResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

/**
 *  Get source by ID
 */
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
    200: {
      description: "Source details",
      schema: "SingleResponse",
    },
    404: {
      description: "Source type not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

/**
 *  Get source by identifer
 */
apiRouter.addRoute({
  method: "get",
  path: "/identifier/:identifier",
  handler: (req, res) => SourceController.getSourceByIdentifier(req, res),
  summary: "Get news source by identifier",
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
    500: { description: "Server error", schema: "ErrorResponse" },
  },
});

/**
 * Create a source
 */
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
      source_name: "KOh Santepheap Daily",
      source_identifier: "https://kohsantepheapdaily.com.kh/",
      source_is_active: true,
      source_is_trusted: true,
      source_country: "Cambodia",
      user_id: 1,
    },
  },
  responses: {
    201: { description: "Source created", schema: "SingleResponse" },
    400: { description: "Validation error", schema: "ErrorResponse" },
    409: { description: "Identifier already exists", schema: "ErrorResponse" },
  },
});

/**
 * Update a source by ID
 */
apiRouter.addRoute({
  method: "patch",
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
    500: { description: "Server error", schema: "ErrorResponse" },
  },
});

/**
 * Delete a source by ID
 */
apiRouter.addRoute({
  method: "delete",
  path: "/:id",
  handler: (req, res) => SourceController.deleteSource(req, res),
  summary: "Delete source",
  description: "Soft delete by default. Use ?soft=false for permanent deletion",
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
    500: { description: "Server error", schema: "ErrorResponse" },
  },
});

/**
 * Restore source by ID
 */
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
    500: { description: "Server error", schema: "ErrorResponse" },
    404: { description: "Source not found", schema: "ErrorResponse" },
  },
});

/**
 * Bulk update status source
 */
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
    400: { description: "Validation error", schema: "ErrorResponse" },
    500: { description: "Server error", schema: "ErrorResponse" },
  },
});

/**
 * Bulk delete source (Soft delete & Hard delete)
 */
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
    400: { description: "Validation error", schema: "ErrorResponse" },
    500: { description: "Server error", schema: "ErrorResponse" },
  },
});

export default apiRouter;
