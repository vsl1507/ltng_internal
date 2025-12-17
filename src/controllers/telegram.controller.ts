import { Request, Response } from "express";
import telegramService from "../services/telegram.service";
import { Telegram, TelegramFilters } from "../models/telegram.model";
import ResponseHandler from "../utils/response-handler";

export class TelegramController {
  // Get all telegrams with filters and pagination
  async getAllTelegrams(req: Request, res: Response): Promise<void> {
    try {
      const filters: TelegramFilters = {
        search: req.query.search as string,
        telegram_type: req.query.telegram_type as any,
        telegram_is_active:
          req.query.telegram_is_active === "true"
            ? true
            : req.query.telegram_is_active === "false"
            ? false
            : undefined,
        telegram_chat_id: req.query.telegram_chat_id as string,
        telegram_username: req.query.telegram_username as string,
        is_deleted: req.query.is_deleted === "true" ? true : false,
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await telegramService.getAllTelegrams(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Telegrams retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching telegrams:", error);
      ResponseHandler.internalError(res, "Failed to fetch telegrams");
    }
  }

  // Get telegram by ID
  async getTelegramById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid telegram ID");
        return;
      }

      const telegram = await telegramService.getTelegramById(id);

      if (!telegram) {
        ResponseHandler.notFound(res, "Telegram not found");
        return;
      }

      ResponseHandler.success(res, telegram, "Telegram retrieved successfully");
    } catch (error) {
      console.error("Error fetching telegram:", error);
      ResponseHandler.internalError(res, "Failed to fetch telegram");
    }
  }

  // Get telegram by chat ID
  async getTelegramByChatId(req: Request, res: Response): Promise<void> {
    try {
      const chatId = req.params.chatId;

      if (!chatId) {
        ResponseHandler.badRequest(res, "Chat ID is required");
        return;
      }

      const telegram = await telegramService.getTelegramByChatId(chatId);

      if (!telegram) {
        ResponseHandler.notFound(res, "Telegram not found");
        return;
      }

      ResponseHandler.success(res, telegram, "Telegram retrieved successfully");
    } catch (error) {
      console.error("Error fetching telegram by chat ID:", error);
      ResponseHandler.internalError(res, "Failed to fetch telegram");
    }
  }

  // Create new telegram
  async createTelegram(req: Request, res: Response): Promise<void> {
    try {
      const telegramData: Telegram = req.body;

      // Validation - Based on NOT NULL fields from database
      const validationErrors = [];

      if (!telegramData.telegram_name) {
        validationErrors.push({
          field: "telegram_name",
          message: "Telegram name is required",
        });
      }
      if (!telegramData.telegram_chat_id) {
        validationErrors.push({
          field: "telegram_chat_id",
          message: "Chat ID is required",
        });
      }
      if (!telegramData.telegram_type) {
        validationErrors.push({
          field: "telegram_type",
          message: "Telegram type is required",
        });
      }

      // Validate enum values
      if (
        telegramData.telegram_type &&
        !["CHANNEL", "GROUP", "PRIVATE"].includes(telegramData.telegram_type)
      ) {
        validationErrors.push({
          field: "telegram_type",
          message: "Telegram type must be CHANNEL, GROUP, or PRIVATE",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Check if chat ID already exists
      const existingTelegram = await telegramService.getTelegramByChatId(
        telegramData.telegram_chat_id
      );
      if (existingTelegram) {
        ResponseHandler.conflict(res, "Chat ID already exists");
        return;
      }

      // Get user ID from request (assuming authentication middleware sets it)
      const userId = (req as any).user?.user_id;
      if (userId) {
        telegramData.created_by = userId;
        telegramData.updated_by = userId;
      }

      const newTelegram = await telegramService.createTelegram(telegramData);
      ResponseHandler.created(
        res,
        newTelegram,
        "Telegram created successfully"
      );
    } catch (error) {
      console.error("Error creating telegram:", error);
      ResponseHandler.internalError(res, "Failed to create telegram");
    }
  }

  // Update telegram
  async updateTelegram(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid telegram ID");
        return;
      }

      const telegramData: Partial<Telegram> = req.body;

      // Check if telegram exists
      const existingTelegram = await telegramService.getTelegramById(id);
      if (!existingTelegram) {
        ResponseHandler.notFound(res, "Telegram not found");
        return;
      }

      // Validate telegram type if provided
      if (
        telegramData.telegram_type &&
        !["CHANNEL", "GROUP", "PRIVATE"].includes(telegramData.telegram_type)
      ) {
        ResponseHandler.badRequest(
          res,
          "Telegram type must be CHANNEL, GROUP, or PRIVATE"
        );
        return;
      }

      // Check if chat ID is being changed and if it conflicts
      if (
        telegramData.telegram_chat_id &&
        telegramData.telegram_chat_id !== existingTelegram.telegram_chat_id
      ) {
        const chatIdExists = await telegramService.getTelegramByChatId(
          telegramData.telegram_chat_id
        );
        if (chatIdExists) {
          ResponseHandler.conflict(res, "Chat ID already exists");
          return;
        }
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;
      if (userId) {
        telegramData.updated_by = userId;
      }

      const updated = await telegramService.updateTelegram(id, telegramData);

      if (!updated) {
        ResponseHandler.badRequest(res, "No changes made");
        return;
      }

      const updatedTelegram = await telegramService.getTelegramById(id);
      ResponseHandler.success(
        res,
        updatedTelegram,
        "Telegram updated successfully"
      );
    } catch (error) {
      console.error("Error updating telegram:", error);
      ResponseHandler.internalError(res, "Failed to update telegram");
    }
  }

  // Delete telegram
  async deleteTelegram(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const hard = req.query.hard === "true";

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid telegram ID");
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      let deleted: boolean;
      if (hard) {
        deleted = await telegramService.hardDeleteTelegram(id);
      } else {
        deleted = await telegramService.deleteTelegram(id, userId);
      }

      if (!deleted) {
        ResponseHandler.notFound(res, "Telegram not found");
        return;
      }

      ResponseHandler.success(res, null, "Telegram deleted successfully");
    } catch (error) {
      console.error("Error deleting telegram:", error);
      ResponseHandler.internalError(res, "Failed to delete telegram");
    }
  }

  // Bulk update status
  async bulkUpdateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ids, telegram_is_active } = req.body;

      // Validation
      const validationErrors = [];
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        validationErrors.push({
          field: "ids",
          message: "Telegram IDs array is required",
        });
      }
      if (typeof telegram_is_active !== "boolean") {
        validationErrors.push({
          field: "telegram_is_active",
          message: "Active status is required",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const affectedRows = await telegramService.bulkUpdateStatus(
        ids,
        telegram_is_active,
        userId
      );

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} telegram(s) updated successfully`
      );
    } catch (error) {
      console.error("Error bulk updating telegrams:", error);
      ResponseHandler.internalError(res, "Failed to update telegrams");
    }
  }

  // Bulk delete
  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids, soft = true } = req.body;

      // Validation
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "ids", message: "Telegram IDs array is required" },
        ]);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const affectedRows = await telegramService.bulkDelete(ids, soft, userId);

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} telegram(s) deleted successfully`
      );
    } catch (error) {
      console.error("Error bulk deleting telegrams:", error);
      ResponseHandler.internalError(res, "Failed to delete telegrams");
    }
  }

  // Restore deleted telegram
  async restoreTelegram(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid telegram ID");
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const restored = await telegramService.restoreTelegram(id, userId);

      if (!restored) {
        ResponseHandler.notFound(res, "Telegram not found");
        return;
      }

      ResponseHandler.success(res, null, "Telegram restored successfully");
    } catch (error) {
      console.error("Error restoring telegram:", error);
      ResponseHandler.internalError(res, "Failed to restore telegram");
    }
  }

  // Get statistics
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await telegramService.getStatistics();

      ResponseHandler.success(res, stats, "Statistics retrieved successfully");
    } catch (error) {
      console.error("Error getting statistics:", error);
      ResponseHandler.internalError(res, "Failed to retrieve statistics");
    }
  }
}

export default new TelegramController();
