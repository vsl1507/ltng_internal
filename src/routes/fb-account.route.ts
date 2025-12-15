import ApiRouter from "../utils/api-router";
import FBAccountController from "../controllers/fb-account.controller";

const apiRouter = new ApiRouter();

// Get all accounts with filters and pagination
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => FBAccountController.getAllAccounts(req, res),
  summary: "Get all FB accounts with filters and pagination",
  tags: ["FB Accounts"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by username, FB UID, or notes",
    },
    {
      name: "status",
      type: "string",
      enum: ["All", "Active", "Checkpoint", "Locked", "Disabled"],
      description: "Filter by account status",
    },
    {
      name: "friend_suggestion",
      type: "string",
      enum: ["All", "Yes", "No"],
      description: "Filter by friend suggestion",
    },
    {
      name: "creation_year",
      type: "string",
      enum: ["All", "< 2024", "2023-2024", "> 2024"],
      description: "Filter by account creation year",
    },
    {
      name: "sort_by",
      type: "string",
      enum: ["friend_count", "last_update", "created_at", "username"],
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

// Get account by ID
apiRouter.addRoute({
  method: "get",
  path: "/:id",
  handler: (req, res) => FBAccountController.getAccountById(req, res),
  summary: "Get account by ID",
  tags: ["FB Accounts"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Account ID",
    },
  ],
  responses: {
    200: {
      description: "Account details",
      schema: "SingleResponse",
    },
    404: {
      description: "Account not found",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Create new account
apiRouter.addRoute({
  method: "post",
  path: "/",
  handler: (req, res) => FBAccountController.createAccount(req, res),
  summary: "Create new account",
  tags: ["FB Accounts"],
  requestBody: {
    required: true,
    schema: "FBAccount",
    example: {
      username: "john.doe@example.com",
      fb_uid: "100012345678901",
      password: "securePassword123",
      twofa_secret: "JBSWY3DPEHPK3PXP",
      cookies: '[{"name":"c_user","value":"100012345678901"}]',
      status: "Active",
      friend_count: 4500,
      friend_suggestion: true,
      account_created_date: "2023-05-15",
      notes: "Primary account for marketing",
    },
  },
  responses: {
    201: {
      description: "Account created successfully",
      schema: "SingleResponse",
    },
    400: {
      description: "Validation error",
      schema: "ErrorResponse",
    },
    409: {
      description: "Username already exists",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Update account
apiRouter.addRoute({
  method: "put",
  path: "/:id",
  handler: (req, res) => FBAccountController.updateAccount(req, res),
  summary: "Update account",
  tags: ["FB Accounts"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Account ID",
    },
  ],
  requestBody: {
    required: true,
    schema: "FBAccountUpdate",
    example: {
      password: "newPassword456",
      status: "Checkpoint",
      friend_count: 4550,
      notes: "Hit checkpoint on Dec 10, recovered on Dec 11",
    },
  },
  responses: {
    200: {
      description: "Account updated successfully",
      schema: "SingleResponse",
    },
    404: {
      description: "Account not found",
      schema: "ErrorResponse",
    },
    400: {
      description: "No changes made",
      schema: "ErrorResponse",
    },
    500: {
      description: "Server error",
      schema: "ErrorResponse",
    },
  },
});

// Delete account
apiRouter.addRoute({
  method: "delete",
  path: "/:id",
  handler: (req, res) => FBAccountController.deleteAccount(req, res),
  summary: "Delete account",
  tags: ["FB Accounts"],
  pathParams: [
    {
      name: "id",
      type: "integer",
      required: true,
      description: "Account ID",
    },
  ],
  responses: {
    200: {
      description: "Account deleted successfully",
      schema: "SuccessResponse",
    },
    404: {
      description: "Account not found",
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
  handler: (req, res) => FBAccountController.bulkUpdateStatus(req, res),
  summary: "Bulk update account status",
  tags: ["FB Accounts"],
  requestBody: {
    required: true,
    schema: "BulkUpdateRequest",
    example: {
      ids: [1, 2, 3, 5],
      status: "Active",
    },
  },
  responses: {
    200: {
      description: "Accounts updated successfully",
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
  handler: (req, res) => FBAccountController.bulkDelete(req, res),
  summary: "Bulk delete accounts",
  tags: ["FB Accounts"],
  requestBody: {
    required: true,
    schema: "BulkDeleteRequest",
    example: {
      ids: [1, 2, 3],
    },
  },
  responses: {
    200: {
      description: "Accounts deleted successfully",
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
