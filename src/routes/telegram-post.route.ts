import ApiRouter from "../utils/api-router";
import newsPostController from "../controllers/telegram-post.contoller";

const apiRouter = new ApiRouter();

// // Get all posts
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => newsPostController.getAllPosts(req, res),
  summary: "Get all news posts",
  tags: ["News Posts"],
  queryParams: [
    { name: "search", type: "string", description: "Search in post content" },
    {
      name: "radar_ai_id",
      type: "integer",
      description: "Filter by radar AI ID",
    },
    { name: "story_id", type: "integer", description: "Filter by story ID" },
    {
      name: "post_version",
      type: "integer",
      description: "Filter by version number",
    },
    {
      name: "is_major_update",
      type: "boolean",
      description: "Filter by major update flag",
    },
    {
      name: "is_deleted",
      type: "boolean",
      description: "Show deleted records",
      default: false,
    },
    {
      name: "date_from",
      type: "string",
      description: "Filter from date (YYYY-MM-DD)",
    },
    {
      name: "date_to",
      type: "string",
      description: "Filter to date (YYYY-MM-DD)",
    },
    {
      name: "sort_by",
      type: "string",
      enum: [
        "post_id",
        "radar_ai_id",
        "story_id",
        "post_version",
        "created_at",
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
    { name: "page", type: "integer", description: "Page number", default: 1 },
    {
      name: "limit",
      type: "integer",
      description: "Items per page",
      default: 50,
    },
  ],
  responses: {
    200: { description: "List of posts", schema: "PaginatedResponse" },
  },
});

// // Get major updates only
// apiRouter.addRoute({
//   method: "get",
//   path: "/major-updates",
//   handler: (req, res) => newsPostController.getMajorUpdates(req, res),
//   summary: "Get major updates only",
//   tags: ["News Posts"],
//   queryParams: [
//     { name: "page", type: "integer", default: 1 },
//     { name: "limit", type: "integer", default: 50 },
//   ],
//   responses: {
//     200: { description: "Major updates", schema: "PaginatedResponse" },
//   },
// });

// // Get post by ID
// apiRouter.addRoute({
//   method: "get",
//   path: "/:id",
//   handler: (req, res) => newsPostController.getPostById(req, res),
//   summary: "Get post by ID",
//   tags: ["News Posts"],
//   pathParams: [
//     { name: "id", type: "integer", required: true, description: "Post ID" },
//   ],
//   responses: {
//     200: { description: "Post details", schema: "SingleResponse" },
//     404: { description: "Post not found", schema: "ErrorResponse" },
//   },
// });

// // Get posts by radar AI ID
// apiRouter.addRoute({
//   method: "get",
//   path: "/radar/:radarAiId",
//   handler: (req, res) => newsPostController.getPostsByRadarAiId(req, res),
//   summary: "Get all posts by radar AI ID",
//   tags: ["News Posts"],
//   pathParams: [
//     {
//       name: "radarAiId",
//       type: "integer",
//       required: true,
//       description: "Radar AI ID",
//     },
//   ],
//   queryParams: [
//     { name: "page", type: "integer", default: 1 },
//     { name: "limit", type: "integer", default: 50 },
//   ],
//   responses: {
//     200: { description: "Posts list", schema: "PaginatedResponse" },
//   },
// });

// // Get posts by story ID
// apiRouter.addRoute({
//   method: "get",
//   path: "/story/:storyId",
//   handler: (req, res) => newsPostController.getPostsByStoryId(req, res),
//   summary: "Get all posts by story ID",
//   tags: ["News Posts"],
//   pathParams: [
//     {
//       name: "storyId",
//       type: "integer",
//       required: true,
//       description: "Story ID",
//     },
//   ],
//   queryParams: [
//     { name: "page", type: "integer", default: 1 },
//     { name: "limit", type: "integer", default: 50 },
//   ],
//   responses: {
//     200: { description: "Posts list", schema: "PaginatedResponse" },
//   },
// });

// // Get specific version
// apiRouter.addRoute({
//   method: "get",
//   path: "/radar/:radarAiId/version/:version",
//   handler: (req, res) => newsPostController.getPostVersion(req, res),
//   summary: "Get specific version of a post",
//   tags: ["News Posts"],
//   pathParams: [
//     {
//       name: "radarAiId",
//       type: "integer",
//       required: true,
//       description: "Radar AI ID",
//     },
//     {
//       name: "version",
//       type: "integer",
//       required: true,
//       description: "Version number",
//     },
//   ],
//   responses: {
//     200: { description: "Post version", schema: "SingleResponse" },
//     404: { description: "Version not found", schema: "ErrorResponse" },
//   },
// });

// // Get all versions info
// apiRouter.addRoute({
//   method: "get",
//   path: "/radar/:radarAiId/versions",
//   handler: (req, res) => newsPostController.getAllVersions(req, res),
//   summary: "Get all version numbers for a radar AI",
//   tags: ["News Posts"],
//   pathParams: [
//     {
//       name: "radarAiId",
//       type: "integer",
//       required: true,
//       description: "Radar AI ID",
//     },
//   ],
//   responses: {
//     200: { description: "Version information", schema: "SingleResponse" },
//   },
// });

// Create new post
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => newsPostController.createPost(req, res),
  summary: "Create new post",
  tags: ["News Posts"],
  requestBody: {
    required: true,
    schema: "NewsPost",
    example: {
      radar_ai_id: 1,
      story_id: 100,
      post_version: 1,
      is_major_update: false,
      post_content: "Breaking news content here...",
      post_media: [
        {
          type: "image",
          url: "https://example.com/image.jpg",
          caption: "Photo",
        },
        { type: "video", url: "https://example.com/video.mp4", duration: 120 },
      ],
      user_id: 1,
    },
  },
  responses: {
    201: { description: "Post created", schema: "SingleResponse" },
    400: { description: "Validation error", schema: "ErrorResponse" },
    409: { description: "Version already exists", schema: "ErrorResponse" },
  },
});

// Update post
apiRouter.addRoute({
  method: "put",
  path: "/:id",
  handler: (req, res) => newsPostController.updatePost(req, res),
  summary: "Update post",
  tags: ["News Posts"],
  pathParams: [
    { name: "id", type: "integer", required: true, description: "Post ID" },
  ],
  requestBody: {
    required: true,
    schema: "NewsPostUpdate",
    example: {
      post_content: "Updated content",
      is_major_update: true,
      user_id: 1,
    },
  },
  responses: {
    200: { description: "Post updated", schema: "SingleResponse" },
    404: { description: "Post not found", schema: "ErrorResponse" },
  },
});

// // Delete post
// apiRouter.addRoute({
//   method: "delete",
//   path: "/:id",
//   handler: (req, res) => newsPostController.deletePost(req, res),
//   summary: "Delete post",
//   description: "Soft delete by default. Use ?hard=true for permanent deletion",
//   tags: ["News Posts"],
//   pathParams: [
//     { name: "id", type: "integer", required: true, description: "Post ID" },
//   ],
//   queryParams: [
//     {
//       name: "hard",
//       type: "boolean",
//       description: "Permanent deletion",
//       default: false,
//     },
//   ],
//   responses: {
//     200: { description: "Post deleted", schema: "SuccessResponse" },
//     404: { description: "Post not found", schema: "ErrorResponse" },
//   },
// });

// // Restore post
// apiRouter.addRoute({
//   method: "post",
//   path: "/:id/restore",
//   handler: (req, res) => newsPostController.restorePost(req, res),
//   summary: "Restore deleted post",
//   tags: ["News Posts"],
//   pathParams: [
//     { name: "id", type: "integer", required: true, description: "Post ID" },
//   ],
//   responses: {
//     200: { description: "Post restored", schema: "SingleResponse" },
//     404: { description: "Post not found", schema: "ErrorResponse" },
//   },
// });

// // Bulk delete
// apiRouter.addRoute({
//   method: "post",
//   path: "/bulk/delete",
//   handler: (req, res) => newsPostController.bulkDelete(req, res),
//   summary: "Bulk delete posts",
//   tags: ["News Posts"],
//   requestBody: {
//     required: true,
//     schema: "BulkDeleteRequest",
//     example: {
//       ids: [1, 2, 3],
//       soft: true,
//       user_id: 1,
//     },
//   },
//   responses: {
//     200: { description: "Posts deleted", schema: "BulkResponse" },
//   },
// });

export default apiRouter;
