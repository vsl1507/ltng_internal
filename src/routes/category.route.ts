import ApiRouter from "../utils/api-router";
import categoryController from "../controllers/category.controller";

const apiRouter = new ApiRouter();

// Get all categories with filters and pagination
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => categoryController.getAllCategories(req, res),
  summary: "Get all categories with filters and pagination",
  tags: ["Categories"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by category name (English or Khmer)",
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
        "category_id",
        "category_name_en",
        "category_name_kh",
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
      description: "List of categories with pagination",
      schema: "PaginatedResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get category by ID
apiRouter.addRoute({
  method: "get",
  path: "/:id",
  handler: (req, res) => categoryController.getCategoryById(req, res),
  summary: "Get category by ID",
  tags: ["Categories"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Category ID",
    },
  ],
  responses: {
    200: {
      description: "Category details",
      schema: "SingleResponse",
    },
    404: {
      description: "Category not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Create new category
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => categoryController.createCategory(req, res),
  summary: "Create new category",
  tags: ["Categories"],
  requestBody: {
    required: true,
    schema: "Category",
    example: {
      category_name_en: "Technology",
      category_name_kh: "បច្ចេកវិទ្យា",
      category_description: "Technology and innovation news",
    },
  },
  responses: {
    201: {
      description: "Category created successfully",
      schema: "SingleResponse",
    },
    400: {
      description: "Validation error",
      schema: "ErrorResponse",
    },
    409: {
      description: "Category already exists",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Update category
apiRouter.addRoute({
  method: "put",
  path: "/:id",
  handler: (req, res) => categoryController.updateCategory(req, res),
  summary: "Update category",
  tags: ["Categories"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Category ID",
    },
  ],
  requestBody: {
    required: true,
    schema: "CategoryUpdate",
    example: {
      category_name_en: "Technology & Innovation",
      category_name_kh: "បច្ចេកវិទ្យា និង ការច្នៃប្រឌិត",
      category_description: "Updated description for technology category",
    },
  },
  responses: {
    200: {
      description: "Category updated successfully",
      schema: "SingleResponse",
    },
    404: {
      description: "Category not found",
      schema: "ErrorResponse",
    },
    400: {
      description: "No changes made or validation error",
      schema: "ErrorResponse",
    },
    409: {
      description: "Category name conflict",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Delete category
apiRouter.addRoute({
  method: "delete",
  path: "/:id",
  handler: (req, res) => categoryController.deleteCategory(req, res),
  summary: "Delete category",
  tags: ["Categories"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Category ID",
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
      description: "Category deleted successfully",
      schema: "SuccessResponse",
    },
    404: {
      description: "Category not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Restore deleted category
apiRouter.addRoute({
  method: "post",
  path: "/:id/restore",
  handler: (req, res) => categoryController.restoreCategory(req, res),
  summary: "Restore deleted category",
  tags: ["Categories"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Category ID",
    },
  ],
  responses: {
    200: {
      description: "Category restored successfully",
      schema: "SuccessResponse",
    },
    404: {
      description: "Category not found or already active",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Bulk delete categories
apiRouter.addRoute({
  method: "post",
  path: "/bulk/delete",
  handler: (req, res) => categoryController.bulkDelete(req, res),
  summary: "Bulk delete categories",
  tags: ["Categories"],
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
      description: "Categories deleted successfully",
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
  handler: (req, res) => categoryController.getStatistics(req, res),
  summary: "Get category statistics",
  tags: ["Categories"],
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

// Auto-categorize and tag an article
apiRouter.addRoute({
  method: "post",
  path: "/auto-categorize",
  handler: (req, res) => categoryController.autoCategorizeAndTag(req, res),
  summary:
    "Auto-categorize and tag an article using hybrid AI + keyword approach",
  tags: ["Categories"],
  requestBody: {
    required: true,
    schema: "AutoCategorizeRequest",
    example: {
      radar_id: 123,
      title: "New AI Technology Breakthrough in Healthcare",
      content:
        "Researchers have developed a groundbreaking AI system that can diagnose diseases with unprecedented accuracy...",
    },
  },
  responses: {
    200: {
      description: "Article categorized successfully",
      schema: "CategoryTagResponse",
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

// Get keywords for a category
apiRouter.addRoute({
  method: "get",
  path: "/keywords/:categoryId",
  handler: (req, res) => categoryController.getCategoryKeywords(req, res),
  summary: "Get all keywords for a specific category",
  tags: ["Categories"],
  pathParams: [
    {
      name: "categoryId",
      type: "integer",
      required: true,
      description: "Category ID",
    },
  ],
  responses: {
    200: {
      description: "Keywords retrieved successfully",
      schema: "KeywordsListResponse",
    },
    400: {
      description: "Invalid category ID",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Add a keyword to a category
apiRouter.addRoute({
  method: "post",
  path: "/keywords",
  handler: (req, res) => categoryController.addCategoryKeyword(req, res),
  summary: "Add a keyword to a category",
  tags: ["Categories"],
  requestBody: {
    required: true,
    schema: "AddKeywordRequest",
    example: {
      category_id: 5,
      keyword: "technology",
      language: "en",
      weight: 2.5,
      is_exact_match: false,
    },
  },
  responses: {
    201: {
      description: "Keyword added successfully",
      schema: "SingleResponse",
    },
    400: {
      description: "Validation error",
      schema: "ErrorResponse",
    },
    409: {
      description: "Keyword already exists",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Bulk add keywords to a category
apiRouter.addRoute({
  method: "post",
  path: "/keywords/bulk",
  handler: (req, res) => categoryController.bulkAddKeywords(req, res),
  summary: "Bulk add keywords to a category",
  tags: ["Categories"],
  requestBody: {
    required: true,
    schema: "BulkAddKeywordsRequest",
    example: {
      category_id: 5,
      keywords: [
        {
          keyword: "artificial intelligence",
          language: "en",
          weight: 3.0,
          isExactMatch: true,
        },
        {
          keyword: "machine learning",
          language: "en",
          weight: 2.5,
          isExactMatch: false,
        },
        {
          keyword: "បច្ចេកវិទ្យា",
          language: "kh",
          weight: 2.0,
        },
      ],
    },
  },
  responses: {
    200: {
      description: "Keywords added successfully",
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

// Delete a keyword
apiRouter.addRoute({
  method: "delete",
  path: "/keywords/:keywordId",
  handler: (req, res) => categoryController.deleteCategoryKeyword(req, res),
  summary: "Delete a keyword from a category",
  tags: ["Categories"],
  pathParams: [
    {
      name: "keywordId",
      type: "integer",
      required: true,
      description: "Keyword ID",
    },
  ],
  responses: {
    200: {
      description: "Keyword deleted successfully",
      schema: "SuccessResponse",
    },
    400: {
      description: "Invalid keyword ID",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Get configuration
apiRouter.addRoute({
  method: "get",
  path: "/config",
  handler: (req, res) => categoryController.getConfig(req, res),
  summary: "Get category classification configuration",
  tags: ["Categories"],
  responses: {
    200: {
      description: "Configuration retrieved successfully",
      schema: "ConfigResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Update configuration
apiRouter.addRoute({
  method: "put",
  path: "/config",
  handler: (req, res) => categoryController.updateConfig(req, res),
  summary: "Update category classification configuration",
  tags: ["Categories"],
  requestBody: {
    required: true,
    schema: "UpdateConfigRequest",
    example: {
      keywordThreshold: 3.0,
      useAIFallback: true,
      combineResults: true,
      autoLearnKeywords: true,
      autoLearnMinWeight: 1.5,
    },
  },
  responses: {
    200: {
      description: "Configuration updated successfully",
      schema: "ConfigResponse",
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

// Attach tags to radar
apiRouter.addRoute({
  method: "post",
  path: "/:radarId/tags",
  handler: (req, res) => categoryController.attachTagsToRadar(req, res),
  summary: "Attach tags to a radar article",
  tags: ["Categories"],
  pathParams: [
    {
      name: "radarId",
      type: "integer",
      required: true,
      description: "Radar ID",
    },
  ],
  requestBody: {
    required: true,
    schema: "AttachTagsRequest",
    example: {
      tag_ids: [1, 3, 5, 7],
    },
  },
  responses: {
    200: {
      description: "Tags attached successfully",
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
