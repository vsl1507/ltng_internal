import swaggerJsdoc from "swagger-jsdoc";

const baseOptions = {
  openapi: "3.0.0",
  info: {
    title: "LTNG Internal API",
    version: "1.0.0",
    description: "API documentation for LTNG Internal System",
    contact: {
      name: "API Support",
      email: "visal.ou1507@gmail.com",
    },
  },
  servers: [
    {
      url: `http://${process.env.DB_HOST}:${process.env.PORT}`,
      description: "Development server",
    },
    {
      url: `http://localhost:${process.env.PORT}`,
      description: "Local server",
    },
  ],

  components: {
    schemas: {
      FBAccount: {
        type: "object",
        required: ["acc_name", "acc_username", "acc_password", "status"],
        properties: {
          acc_id: {
            type: "integer",
            description: "Auto-generated ID",
            example: 1,
          },
          acc_name: {
            type: "string",
            description: "Account name",
            example: "John Doe",
          },
          acc_username: {
            type: "string",
            description: "Username or email",
            example: "john.doe@example.com",
          },
          acc_password: {
            type: "string",
            description: "Account password",
            example: "securePassword123",
          },
          acc_2fa: {
            type: "string",
            description: "2FA secret key",
            example: "JBSWY3DPEHPK3PXP",
          },
          acc_cookie: {
            type: "string",
            description: "Cookies data in JSON format",
            example: '[{"name":"c_user","value":"100012345678901"}]',
          },
          acc_uid: {
            type: "string",
            description: "Facebook User ID",
            example: "100012345678901",
          },
          acc_phone: {
            type: "string",
            description: "Phone number",
            example: "+1234567890",
          },
          acc_email: {
            type: "string",
            description: "Email address",
            example: "john.doe@example.com",
          },
          acc_gender: {
            type: "string",
            enum: ["Male", "Female", "Other"],
            description: "Gender",
            example: "Male",
          },
          acc_friend_count: {
            type: "integer",
            description: "Number of friends",
            example: 4500,
          },
          acc_friend_suggestion: {
            type: "boolean",
            description: "Friend suggestion enabled",
            example: true,
          },
          acc_set_intro: {
            type: "boolean",
            description: "Intro set",
            example: true,
          },
          acc_set_pic: {
            type: "boolean",
            description: "Profile picture set",
            example: true,
          },
          acc_follower: {
            type: "boolean",
            description: "Has followers enabled",
            example: true,
          },
          acc_date_created: {
            type: "string",
            format: "date",
            description: "Account creation date",
            example: "2023-05-15",
          },
          acc_date_update: {
            type: "string",
            format: "date-time",
            description: "Last update timestamp",
          },
          acc_device: {
            type: "string",
            description: "Device information",
            example: "iPhone 13",
          },
          acc_notes: {
            type: "string",
            description: "Additional notes",
            example: "Primary account for marketing",
          },
          acc_status: {
            type: "string",
            enum: [
              "ACTIVE",
              "CHECKPOINT",
              "LOCKED",
              "DISABLED",
              "APPEAL_CHECKPOINT",
              "ERROR_PASSWORD",
              "ERROR_2FA",
            ],
            description: "Account status",
            example: "ACTIVE",
          },
        },
      },
      FBAccountUpdate: {
        type: "object",
        properties: {
          acc_name: { type: "string", example: "John Doe Updated" },
          acc_password: { type: "string", example: "newPassword123" },
          acc_2fa: { type: "string", example: "JBSWY3DPEHPK3PXP" },
          acc_cookie: {
            type: "string",
            example: '[{"name":"c_user","value":"100012345678901"}]',
          },
          acc_uid: { type: "string", example: "100012345678901" },
          acc_phone: { type: "string", example: "+1234567890" },
          acc_email: { type: "string", example: "john.doe@example.com" },
          acc_gender: {
            type: "string",
            enum: ["Male", "Female", "Other"],
            example: "Male",
          },
          acc_friend_count: { type: "integer", example: 4500 },
          acc_friend_suggestion: { type: "boolean", example: true },
          acc_set_intro: { type: "boolean", example: true },
          acc_set_pic: { type: "boolean", example: true },
          acc_follower: { type: "boolean", example: true },
          acc_date_created: {
            type: "string",
            format: "date",
            example: "2023-05-15",
          },
          acc_device: { type: "string", example: "iPhone 13" },
          acc_notes: { type: "string", example: "Updated notes" },
          acc_status: {
            type: "string",
            enum: [
              "ACTIVE",
              "CHECKPOINT",
              "LOCKED",
              "DISABLED",
              "APPEAL_CHECKPOINT",
              "ERROR_PASSWORD",
              "ERROR_2FA",
            ],
            example: "ACTIVE",
          },
        },
      },
      PaginatedResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Accounts retrieved successfully",
          },
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/FBAccount",
            },
          },
          pagination: {
            type: "object",
            properties: {
              total: {
                type: "integer",
                example: 2300,
              },
              page: {
                type: "integer",
                example: 1,
              },
              limit: {
                type: "integer",
                example: 50,
              },
              total_pages: {
                type: "integer",
                example: 46,
              },
            },
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-12-14T10:30:00.000Z",
          },
        },
      },
      SingleResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Account retrieved successfully",
          },
          data: {
            $ref: "#/components/schemas/FBAccount",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-12-14T10:30:00.000Z",
          },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Operation completed successfully",
          },
          data: {
            type: "object",
            nullable: true,
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-12-14T10:30:00.000Z",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "string",
            example: "Error message",
          },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: {
                  type: "string",
                  example: "username",
                },
                message: {
                  type: "string",
                  example: "Username is required",
                },
              },
            },
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2024-12-14T10:30:00.000Z",
          },
        },
      },
      BulkUpdateRequest: {
        type: "object",
        required: ["ids", "acc_status"],
        properties: {
          ids: {
            type: "array",
            items: {
              type: "integer",
            },
            example: [1, 2, 3, 5],
          },
          acc_status: {
            type: "string",
            enum: [
              "ACTIVE",
              "CHECKPOINT",
              "LOCKED",
              "DISABLED",
              "APPEAL_CHECKPOINT",
              "ERROR_PASSWORD",
              "ERROR_2FA",
            ],
            example: "ACTIVE",
          },
        },
      },
      BulkDeleteRequest: {
        type: "object",
        required: ["ids"],
        properties: {
          ids: {
            type: "array",
            items: {
              type: "integer",
            },
            example: [1, 2, 3],
          },
        },
      },
      BulkResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "3 account(s) updated successfully",
          },
          affected_rows: {
            type: "integer",
            example: 3,
          },
        },
      },
    },
  },
};

export const generateSwaggerSpec = (dynamicPaths: any = {}) => {
  return {
    ...baseOptions,
    paths: dynamicPaths,
  };
};

export default baseOptions;
