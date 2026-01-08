import ApiRouter from "../utils/api-router";
import SourceTypeController from "../controllers/source-type.controller";

const apiRouter = new ApiRouter();

// Get all source types with filters and pagination
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => SourceTypeController.getAllSourceTypes(req, res),
  summary: "Get all news source types",
  tags: ["News Source Types"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by name, slug, or description",
    },
    {
      name: "slug",
      type: "string",
      description: "Filter by slug",
    },
    {
      name: "is_deleted",
      type: "boolean",
      description: "Filter by deleted status",
      default: false,
    },
    {
      name: "sort_by",
      type: "string",
      enum: [
        "source_type_id",
        "source_type_name",
        "source_type_slug",
        "created_at",
        "updated_at",
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
      description: "List of source types with pagination",
      schema: "PaginatedResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get source type by ID
apiRouter.addRoute({
  method: "get",
  path: "/:id",
  handler: (req, res) => SourceTypeController.getSourceTypeById(req, res),
  summary: "Get source type by ID",
  tags: ["News Source Types"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Source type ID",
    },
  ],
  responses: {
    200: {
      description: "Source type details",
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

// Create new source type
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => SourceTypeController.createSourceType(req, res),
  summary: "Create new source type",
  tags: ["News Source Types"],
  requestBody: {
    required: true,
    schema: "NewsSourceType",
    example: {
      source_type_name: "Facebook Pages",
      source_type_slug: "facebook-pages",
      source_type_description: "News sources from Facebook pages",
      user_id: 1,
    },
  },
  responses: {
    201: {
      description: "Source type created successfully",
      schema: "SingleResponse",
    },
    400: {
      description: "Validation error",
      schema: "ErrorResponse",
    },
    409: {
      description: "Source type name or slug already exists",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Update source type
apiRouter.addRoute({
  method: "put",
  path: "/:id",
  handler: (req, res) => SourceTypeController.updateSourceType(req, res),
  summary: "Update source type",
  tags: ["News Source Types"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Source type ID",
    },
  ],
  requestBody: {
    required: true,
    schema: "NewsSourceTypeUpdate",
    example: {
      source_type_name: "Updated Name",
      source_type_description: "Updated description",
      user_id: 1,
    },
  },
  responses: {
    200: {
      description: "Source type updated successfully",
      schema: "SingleResponse",
    },
    404: {
      description: "Source type not found",
      schema: "ErrorResponse",
    },
    409: {
      description: "Name or slug already exists",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Delete source type
apiRouter.addRoute({
  method: "delete",
  path: "/:id",
  handler: (req, res) => SourceTypeController.deleteSourceType(req, res),
  summary: "Delete source type",
  description: "Soft delete by default. Use ?hard=true for permanent deletion",
  tags: ["News Source Types"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Source type ID",
    },
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
    200: {
      description: "Source type deleted successfully",
      schema: "SuccessResponse",
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

// Restore source type
apiRouter.addRoute({
  method: "post",
  path: "/:id/restore",
  handler: (req, res) => SourceTypeController.restoreSourceType(req, res),
  summary: "Restore soft deleted source type",
  tags: ["News Source Types"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Source type ID",
    },
  ],
  responses: {
    200: {
      description: "Source type restored successfully",
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

// Bulk delete source types
apiRouter.addRoute({
  method: "post",
  path: "/bulk/delete",
  handler: (req, res) => SourceTypeController.bulkDelete(req, res),
  summary: "Bulk delete source types",
  tags: ["News Source Types"],
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
    200: {
      description: "Source types deleted successfully",
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
