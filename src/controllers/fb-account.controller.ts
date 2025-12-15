import { Request, Response } from "express";
import fbAccountService from "../services/fb-account.service";
import { FBAccount, FBAccountFilters } from "../models/fb-account.model";
import ResponseHandler from "../utils/response-handler";

export class FBAccountController {
  // Get all accounts with filters and pagination
  async getAllAccounts(req: Request, res: Response): Promise<void> {
    try {
      const filters: FBAccountFilters = {
        search: req.query.search as string,
        status: req.query.status as string,
        friend_suggestion: req.query.friend_suggestion as string,
        creation_year: req.query.creation_year as string,
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await fbAccountService.getAllAccounts(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Accounts retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching accounts:", error);
      ResponseHandler.internalError(res, "Failed to fetch accounts");
    }
  }

  // Get account by ID
  async getAccountById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid account ID");
        return;
      }

      const account = await fbAccountService.getAccountById(id);

      if (!account) {
        ResponseHandler.notFound(res, "Account not found");
        return;
      }

      ResponseHandler.success(res, account, "Account retrieved successfully");
    } catch (error) {
      console.error("Error fetching account:", error);
      ResponseHandler.internalError(res, "Failed to fetch account");
    }
  }

  // Create new account
  async createAccount(req: Request, res: Response): Promise<void> {
    try {
      const accountData: FBAccount = req.body;

      // Validation
      const validationErrors = [];
      if (!accountData.acc_name) {
        validationErrors.push({
          field: "acc_name",
          message: "Account name is required",
        });
      }
      if (!accountData.acc_username) {
        validationErrors.push({
          field: "acc_username",
          message: "Username is required",
        });
      }
      if (!accountData.acc_password) {
        validationErrors.push({
          field: "acc_password",
          message: "Password is required",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Check if username already exists
      const existingAccount = await fbAccountService.getAccountByUsername(
        accountData.acc_username
      );
      if (existingAccount) {
        ResponseHandler.conflict(res, "Username already exists");
        return;
      }

      const newAccount = await fbAccountService.createAccount(accountData);
      ResponseHandler.created(res, newAccount, "Account created successfully");
    } catch (error) {
      console.error("Error creating account:", error);
      ResponseHandler.internalError(res, "Failed to create account");
    }
  }

  // Update account
  async updateAccount(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid account ID");
        return;
      }

      const accountData: Partial<FBAccount> = req.body;

      // Check if account exists
      const existingAccount = await fbAccountService.getAccountById(id);
      if (!existingAccount) {
        ResponseHandler.notFound(res, "Account not found");
        return;
      }

      const updated = await fbAccountService.updateAccount(id, accountData);

      if (!updated) {
        ResponseHandler.badRequest(res, "No changes made");
        return;
      }

      const updatedAccount = await fbAccountService.getAccountById(id);
      ResponseHandler.success(
        res,
        updatedAccount,
        "Account updated successfully"
      );
    } catch (error) {
      console.error("Error updating account:", error);
      ResponseHandler.internalError(res, "Failed to update account");
    }
  }

  // Delete account
  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid account ID");
        return;
      }

      const deleted = await fbAccountService.deleteAccount(id);

      if (!deleted) {
        ResponseHandler.notFound(res, "Account not found");
        return;
      }

      ResponseHandler.success(res, null, "Account deleted successfully");
    } catch (error) {
      console.error("Error deleting account:", error);
      ResponseHandler.internalError(res, "Failed to delete account");
    }
  }

  // Bulk update status
  async bulkUpdateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ids, status } = req.body;

      // Validation
      const validationErrors = [];
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        validationErrors.push({
          field: "ids",
          message: "Account IDs array is required",
        });
      }
      if (!status) {
        validationErrors.push({
          field: "status",
          message: "Status is required",
        });
      }
      if (
        status &&
        !["Active", "Checkpoint", "Locked", "Disabled"].includes(status)
      ) {
        validationErrors.push({
          field: "status",
          message: "Invalid status value",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      const affectedRows = await fbAccountService.bulkUpdateStatus(ids, status);

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} account(s) updated successfully`
      );
    } catch (error) {
      console.error("Error bulk updating accounts:", error);
      ResponseHandler.internalError(res, "Failed to update accounts");
    }
  }

  // Bulk delete
  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;

      // Validation
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "ids", message: "Account IDs array is required" },
        ]);
        return;
      }

      const affectedRows = await fbAccountService.bulkDelete(ids);

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} account(s) deleted successfully`
      );
    } catch (error) {
      console.error("Error bulk deleting accounts:", error);
      ResponseHandler.internalError(res, "Failed to delete accounts");
    }
  }
}

export default new FBAccountController();
