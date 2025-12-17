import { Request, Response } from "express";
import newsSourceService from "../services/source.service";
import { NewsSource, NewsSourceFilters } from "../models/source.model";
import ResponseHandler from "../utils/response-handler";

export class SourceController {
  // Get all sources with filters and pagination
  async getAllSources(req: Request, res: Response): Promise<void> {
    try {
      const filters: NewsSourceFilters = {
        search: req.query.search as string,
        source_type_id: req.query.source_type_id
          ? parseInt(req.query.source_type_id as string)
          : undefined,
        source_is_active:
          req.query.source_is_active === "true"
            ? true
            : req.query.source_is_active === "false"
            ? false
            : undefined,
        source_is_trusted:
          req.query.source_is_trusted === "true"
            ? true
            : req.query.source_is_trusted === "false"
            ? false
            : undefined,
        source_country: req.query.source_country as string,
        is_deleted: req.query.is_deleted === "true",
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await newsSourceService.getAllSources(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Sources retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching sources:", error);
      ResponseHandler.internalError(res, "Failed to fetch sources");
    }
  }

  // Get source by ID
  async getSourceById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source ID");
        return;
      }

      const source = await newsSourceService.getSourceById(id);

      if (!source) {
        ResponseHandler.notFound(res, "Source not found");
        return;
      }

      ResponseHandler.success(res, source, "Source retrieved successfully");
    } catch (error) {
      console.error("Error fetching source:", error);
      ResponseHandler.internalError(res, "Failed to fetch source");
    }
  }

  // Get source by identifier
  async getSourceByIdentifier(req: Request, res: Response): Promise<void> {
    try {
      const { identifier } = req.params;

      const source = await newsSourceService.getSourceByIdentifier(identifier);

      if (!source) {
        ResponseHandler.notFound(res, "Source not found");
        return;
      }

      ResponseHandler.success(res, source, "Source retrieved successfully");
    } catch (error) {
      console.error("Error fetching source:", error);
      ResponseHandler.internalError(res, "Failed to fetch source");
    }
  }

  // Get sources by type
  async getSourcesByType(req: Request, res: Response): Promise<void> {
    try {
      const sourceTypeId = parseInt(req.params.typeId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (isNaN(sourceTypeId)) {
        ResponseHandler.badRequest(res, "Invalid source type ID");
        return;
      }

      const result = await newsSourceService.getSourcesByType(
        sourceTypeId,
        page,
        limit
      );

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Sources retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching sources by type:", error);
      ResponseHandler.internalError(res, "Failed to fetch sources");
    }
  }

  // Create new source
  async createSource(req: Request, res: Response): Promise<void> {
    try {
      const sourceData: NewsSource = req.body;
      const userId = req.body.user_id;

      // Validation
      const validationErrors = [];

      if (!sourceData.source_type_id) {
        validationErrors.push({
          field: "source_type_id",
          message: "Source type ID is required",
        });
      }
      if (!sourceData.source_name) {
        validationErrors.push({
          field: "source_name",
          message: "Source name is required",
        });
      }
      if (!sourceData.source_identifier) {
        validationErrors.push({
          field: "source_identifier",
          message: "Source identifier is required",
        });
      }

      // Validate country code format (2 characters)
      if (
        sourceData.source_country &&
        !/^[A-Z]{2}$/.test(sourceData.source_country)
      ) {
        validationErrors.push({
          field: "source_country",
          message:
            "Country code must be 2 uppercase letters (ISO 3166-1 alpha-2)",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Verify source type exists
      const typeExists = await newsSourceService.verifySourceTypeExists(
        sourceData.source_type_id
      );
      if (!typeExists) {
        ResponseHandler.badRequest(res, "Source type does not exist");
        return;
      }

      // Check if identifier already exists
      const identifierExists = await newsSourceService.checkIdentifierExists(
        sourceData.source_identifier
      );
      if (identifierExists) {
        ResponseHandler.conflict(res, "Source identifier already exists");
        return;
      }

      const newSource = await newsSourceService.createSource(
        sourceData,
        userId
      );
      ResponseHandler.created(res, newSource, "Source created successfully");
    } catch (error) {
      console.error("Error creating source:", error);
      ResponseHandler.internalError(res, "Failed to create source");
    }
  }

  // Update source
  async updateSource(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source ID");
        return;
      }

      const sourceData: Partial<NewsSource> = req.body;
      const userId = req.body.user_id;

      // Validate country code format if provided
      if (
        sourceData.source_country &&
        !/^[A-Z]{2}$/.test(sourceData.source_country)
      ) {
        ResponseHandler.validationError(res, [
          {
            field: "source_country",
            message:
              "Country code must be 2 uppercase letters (ISO 3166-1 alpha-2)",
          },
        ]);
        return;
      }

      // Check if source exists
      const existingSource = await newsSourceService.getSourceById(id);
      if (!existingSource) {
        ResponseHandler.notFound(res, "Source not found");
        return;
      }

      // Verify source type exists if being updated
      if (sourceData.source_type_id) {
        const typeExists = await newsSourceService.verifySourceTypeExists(
          sourceData.source_type_id
        );
        if (!typeExists) {
          ResponseHandler.badRequest(res, "Source type does not exist");
          return;
        }
      }

      // Check if new identifier already exists
      if (sourceData.source_identifier) {
        const identifierExists = await newsSourceService.checkIdentifierExists(
          sourceData.source_identifier,
          id
        );
        if (identifierExists) {
          ResponseHandler.conflict(res, "Source identifier already exists");
          return;
        }
      }

      const updated = await newsSourceService.updateSource(
        id,
        sourceData,
        userId
      );

      if (!updated) {
        ResponseHandler.badRequest(res, "No changes made");
        return;
      }

      const updatedSource = await newsSourceService.getSourceById(id);
      ResponseHandler.success(
        res,
        updatedSource,
        "Source updated successfully"
      );
    } catch (error) {
      console.error("Error updating source:", error);
      ResponseHandler.internalError(res, "Failed to update source");
    }
  }

  // Delete source
  async deleteSource(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const hard = req.query.hard === "true";
      const userId = req.body.user_id;

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source ID");
        return;
      }

      let deleted: boolean;

      if (hard) {
        deleted = await newsSourceService.hardDeleteSource(id);
      } else {
        deleted = await newsSourceService.softDeleteSource(id, userId);
      }

      if (!deleted) {
        ResponseHandler.notFound(res, "Source not found");
        return;
      }

      ResponseHandler.success(
        res,
        null,
        hard ? "Source permanently deleted" : "Source deleted successfully"
      );
    } catch (error) {
      console.error("Error deleting source:", error);
      ResponseHandler.internalError(res, "Failed to delete source");
    }
  }

  // Restore source
  async restoreSource(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = req.body.user_id;

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid source ID");
        return;
      }

      const restored = await newsSourceService.restoreSource(id, userId);

      if (!restored) {
        ResponseHandler.notFound(res, "Source not found");
        return;
      }

      const restoredSource = await newsSourceService.getSourceById(id);
      ResponseHandler.success(
        res,
        restoredSource,
        "Source restored successfully"
      );
    } catch (error) {
      console.error("Error restoring source:", error);
      ResponseHandler.internalError(res, "Failed to restore source");
    }
  }

  // Bulk update status
  async bulkUpdateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ids, source_is_active, source_is_trusted } = req.body;
      const userId = req.body.user_id;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "ids", message: "Source IDs array is required" },
        ]);
        return;
      }

      const affectedRows = await newsSourceService.bulkUpdateStatus(
        ids,
        source_is_active,
        source_is_trusted,
        userId
      );

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} source(s) updated successfully`
      );
    } catch (error) {
      console.error("Error bulk updating sources:", error);
      ResponseHandler.internalError(res, "Failed to update sources");
    }
  }

  // Bulk delete
  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids, soft = true } = req.body;
      const userId = req.body.user_id;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "ids", message: "Source IDs array is required" },
        ]);
        return;
      }

      let affectedRows: number;

      if (soft) {
        affectedRows = await newsSourceService.bulkSoftDelete(ids, userId);
      } else {
        affectedRows = await newsSourceService.bulkHardDelete(ids);
      }

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} source(s) deleted successfully`
      );
    } catch (error) {
      console.error("Error bulk deleting sources:", error);
      ResponseHandler.internalError(res, "Failed to delete sources");
    }
  }

  // Get active sources
  async getActiveSources(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await newsSourceService.getActiveSources(page, limit);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Active sources retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching active sources:", error);
      ResponseHandler.internalError(res, "Failed to fetch active sources");
    }
  }

  // Get trusted sources
  async getTrustedSources(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await newsSourceService.getTrustedSources(page, limit);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Trusted sources retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching trusted sources:", error);
      ResponseHandler.internalError(res, "Failed to fetch trusted sources");
    }
  }
}

export default new SourceController();
