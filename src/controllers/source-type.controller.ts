import { Request, Response } from "express";
import newsSourceTypeService from "../services/source-type.service";
import {
  NewsSourceType,
  NewsSourceTypeFilters,
} from "../models/source-type.model";
import ResponseHandler from "../utils/response-handler";

export class SourceTypeController {
  // Get all source types with filters and pagination
  async getAllSourceTypes(req: Request, res: Response): Promise<void> {
    try {
      const filters: NewsSourceTypeFilters = {
        search: req.query.search as string,
        is_deleted: req.query.is_deleted === "true",
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await newsSourceTypeService.getAllSourceTypes(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Source types retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching source types:", error);
      ResponseHandler.internalError(res, "Failed to fetch source types");
    }
  }

  // Get source type by ID
  async getSourceTypeById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source type ID");
        return;
      }

      const sourceType = await newsSourceTypeService.getSourceTypeById(id);

      if (!sourceType) {
        ResponseHandler.notFound(res, "Source type not found");
        return;
      }

      ResponseHandler.success(
        res,
        sourceType,
        "Source type retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching source type:", error);
      ResponseHandler.internalError(res, "Failed to fetch source type");
    }
  }

  // Get source type by slug
  async getSourceTypeBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      const sourceType = await newsSourceTypeService.getSourceTypeBySlug(slug);

      if (!sourceType) {
        ResponseHandler.notFound(res, "Source type not found");
        return;
      }

      ResponseHandler.success(
        res,
        sourceType,
        "Source type retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching source type:", error);
      ResponseHandler.internalError(res, "Failed to fetch source type");
    }
  }

  // Create new source type
  async createSourceType(req: Request, res: Response): Promise<void> {
    try {
      const sourceTypeData: NewsSourceType = req.body;
      const userId = req.body.user_id; // Assuming user_id comes from auth middleware

      // Validation
      const validationErrors = [];

      if (!sourceTypeData.source_type_name) {
        validationErrors.push({
          field: "source_type_name",
          message: "Source type name is required",
        });
      }
      if (!sourceTypeData.source_type_slug) {
        validationErrors.push({
          field: "source_type_slug",
          message: "Source type slug is required",
        });
      }

      // Validate slug format (lowercase, hyphens, no spaces)
      if (
        sourceTypeData.source_type_slug &&
        !/^[a-z0-9-]+$/.test(sourceTypeData.source_type_slug)
      ) {
        validationErrors.push({
          field: "source_type_slug",
          message:
            "Slug must contain only lowercase letters, numbers, and hyphens",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Check if name already exists
      const nameExists = await newsSourceTypeService.checkNameExists(
        sourceTypeData.source_type_name
      );
      if (nameExists) {
        ResponseHandler.conflict(res, "Source type name already exists");
        return;
      }

      // Check if slug already exists
      const slugExists = await newsSourceTypeService.checkSlugExists(
        sourceTypeData.source_type_slug
      );
      if (slugExists) {
        ResponseHandler.conflict(res, "Source type slug already exists");
        return;
      }

      const newSourceType = await newsSourceTypeService.createSourceType(
        sourceTypeData,
        userId
      );
      ResponseHandler.created(
        res,
        newSourceType,
        "Source type created successfully"
      );
    } catch (error) {
      console.error("Error creating source type:", error);
      ResponseHandler.internalError(res, "Failed to create source type");
    }
  }

  // Update source type
  async updateSourceType(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source type ID");
        return;
      }

      const sourceTypeData: Partial<NewsSourceType> = req.body;
      const userId = req.body.user_id; // Assuming user_id comes from auth middleware

      // Validate slug format if provided
      if (
        sourceTypeData.source_type_slug &&
        !/^[a-z0-9-]+$/.test(sourceTypeData.source_type_slug)
      ) {
        ResponseHandler.validationError(res, [
          {
            field: "source_type_slug",
            message:
              "Slug must contain only lowercase letters, numbers, and hyphens",
          },
        ]);
        return;
      }

      // Check if source type exists
      const existingSourceType = await newsSourceTypeService.getSourceTypeById(
        id
      );
      if (!existingSourceType) {
        ResponseHandler.notFound(res, "Source type not found");
        return;
      }

      // Check if new name already exists
      if (sourceTypeData.source_type_name) {
        const nameExists = await newsSourceTypeService.checkNameExists(
          sourceTypeData.source_type_name,
          id
        );
        if (nameExists) {
          ResponseHandler.conflict(res, "Source type name already exists");
          return;
        }
      }

      // Check if new slug already exists
      if (sourceTypeData.source_type_slug) {
        const slugExists = await newsSourceTypeService.checkSlugExists(
          sourceTypeData.source_type_slug,
          id
        );
        if (slugExists) {
          ResponseHandler.conflict(res, "Source type slug already exists");
          return;
        }
      }

      const updated = await newsSourceTypeService.updateSourceType(
        id,
        sourceTypeData,
        userId
      );

      if (!updated) {
        ResponseHandler.badRequest(res, "No changes made");
        return;
      }

      const updatedSourceType = await newsSourceTypeService.getSourceTypeById(
        id
      );
      ResponseHandler.success(
        res,
        updatedSourceType,
        "Source type updated successfully"
      );
    } catch (error) {
      console.error("Error updating source type:", error);
      ResponseHandler.internalError(res, "Failed to update source type");
    }
  }

  // Delete source type (soft delete by default)
  async deleteSourceType(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const hard = req.query.hard === "true";
      const userId = req.body.user_id;

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source type ID");
        return;
      }

      let deleted: boolean;

      if (hard) {
        deleted = await newsSourceTypeService.hardDeleteSourceType(id);
      } else {
        deleted = await newsSourceTypeService.softDeleteSourceType(id, userId);
      }

      if (!deleted) {
        ResponseHandler.notFound(res, "Source type not found");
        return;
      }

      ResponseHandler.success(
        res,
        null,
        hard
          ? "Source type permanently deleted"
          : "Source type deleted successfully"
      );
    } catch (error) {
      console.error("Error deleting source type:", error);
      ResponseHandler.internalError(res, "Failed to delete source type");
    }
  }

  // Restore soft deleted source type
  async restoreSourceType(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = req.body.user_id;

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source type ID");
        return;
      }

      const restored = await newsSourceTypeService.restoreSourceType(
        id,
        userId
      );

      if (!restored) {
        ResponseHandler.notFound(res, "Source type not found");
        return;
      }

      const restoredSourceType = await newsSourceTypeService.getSourceTypeById(
        id
      );
      ResponseHandler.success(
        res,
        restoredSourceType,
        "Source type restored successfully"
      );
    } catch (error) {
      console.error("Error restoring source type:", error);
      ResponseHandler.internalError(res, "Failed to restore source type");
    }
  }

  // Bulk delete source types
  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids, soft = true } = req.body;
      const userId = req.body.user_id;

      // Validation
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "ids", message: "Source type IDs array is required" },
        ]);
        return;
      }

      let affectedRows: number;

      if (soft) {
        affectedRows = await newsSourceTypeService.bulkSoftDelete(ids, userId);
      } else {
        affectedRows = await newsSourceTypeService.bulkHardDelete(ids);
      }

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} source type(s) deleted successfully`
      );
    } catch (error) {
      console.error("Error bulk deleting source types:", error);
      ResponseHandler.internalError(res, "Failed to delete source types");
    }
  }
}

export default new SourceTypeController();
