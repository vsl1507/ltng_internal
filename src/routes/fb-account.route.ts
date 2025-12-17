import ApiRouter from "../utils/api-router";
import fbAccountController from "../controllers/fb-account.controller";

const apiRouter = new ApiRouter();

// Get all accounts with filters and pagination
apiRouter.addRoute({
  method: "get",
  path: "/",
  handler: (req, res) => fbAccountController.getAllAccounts(req, res),
  summary: "Get all FB accounts with filters and pagination",
  tags: ["FB Accounts"],
  queryParams: [
    {
      name: "search",
      type: "string",
      description: "Search by username, FB UID, name, or notes",
    },
    {
      name: "acc_status",
      type: "string",
      enum: [
        "All",
        "ACTIVE",
        "CHECKPOINT",
        "LOCKED",
        "DISABLED",
        "APPEAL_CHECKPOINT",
        "ERROR_PASSWORD",
        "ERROR_2FA",
      ],
      description: "Filter by account status",
    },
    {
      name: "acc_friend_suggestion",
      type: "string",
      enum: ["All", "YES", "NO"],
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
      enum: [
        "acc_friend_count",
        "acc_date_update",
        "acc_date_created",
        "acc_username",
        "acc_name",
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

// Get account by ID
apiRouter.addRoute({
  method: "get",
  path: "/:id",
  handler: (req, res) => fbAccountController.getAccountById(req, res),
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
  handler: (req, res) => fbAccountController.createAccount(req, res),
  summary: "Create new account",
  tags: ["FB Accounts"],
  requestBody: {
    required: true,
    schema: "FBAccount",
    example: {
      acc_name: "John Doe",
      acc_username: "john.doe@example.com",
      acc_password: "securePassword123",
      acc_2fa: "JBSWY3DPEHPK3PXP",
      acc_cookie: '[{"name":"c_user","value":"100012345678901"}]',
      acc_uid: "100012345678901",
      acc_phone: "+1234567890",
      acc_email: "john.doe@example.com",
      acc_gender: "MALE",
      acc_friend_count: 4500,
      acc_friend_suggestion: "YES",
      acc_set_intro: "YES",
      acc_set_pic: "NO",
      acc_follower: "YES",
      acc_date_created: "2023-05-15",
      acc_device: "iPhone 13",
      acc_notes: "Primary account for marketing",
      acc_status: "ACTIVE",
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
  handler: (req, res) => fbAccountController.updateAccount(req, res),
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
      acc_name: "John Doe Updated",
      acc_password: "newPassword456",
      acc_status: "CHECKPOINT",
      acc_friend_count: 4550,
      acc_notes: "Hit checkpoint on Dec 10, recovered on Dec 11",
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
  handler: (req, res) => fbAccountController.deleteAccount(req, res),
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
  handler: (req, res) => fbAccountController.bulkUpdateStatus(req, res),
  summary: "Bulk update account status",
  tags: ["FB Accounts"],
  requestBody: {
    required: true,
    schema: "BulkUpdateRequest",
    example: {
      ids: [1, 2, 3, 5],
      acc_status: "ACTIVE",
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
  handler: (req, res) => fbAccountController.bulkDelete(req, res),
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
