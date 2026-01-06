import { Request, Response } from "express";
import newsRadarService from "../services/news-radar.service";
import { NewsRadar, NewsRadarFilters } from "../models/news-radar.model";
import ResponseHandler from "../utils/response-handler";

export class NewsRadarController {
  // Get all radars with filters and pagination
  async getAllRadars(req: Request, res: Response): Promise<void> {
    try {
      const filters: NewsRadarFilters = {
        search: req.query.search as string,
        radar_category_id: req.query.radar_category_id
          ? parseInt(req.query.radar_category_id as string)
          : undefined,
        radar_source_id: req.query.radar_source_id
          ? parseInt(req.query.radar_source_id as string)
          : undefined,
        radar_processing_status: req.query.radar_processing_status as string,
        radar_is_breaking:
          req.query.radar_is_breaking === "true"
            ? true
            : req.query.radar_is_breaking === "false"
            ? false
            : undefined,
        radar_is_duplicated:
          req.query.radar_is_duplicated === "true"
            ? true
            : req.query.radar_is_duplicated === "false"
            ? false
            : undefined,
        radar_story_number: req.query.radar_story_number
          ? parseInt(req.query.radar_story_number as string)
          : undefined,
        is_deleted: req.query.is_deleted === "true" ? true : false,
        published_year: req.query.published_year as string,
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await newsRadarService.getAllRadars(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "News radars retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching news radars:", error);
      ResponseHandler.internalError(res, "Failed to fetch news radars");
    }
  }

  // Get radar by ID
  async getRadarById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid radar ID");
        return;
      }

      const radar = await newsRadarService.getRadarById(id);

      if (!radar) {
        ResponseHandler.notFound(res, "News radar not found");
        return;
      }

      ResponseHandler.success(res, radar, "News radar retrieved successfully");
    } catch (error) {
      console.error("Error fetching news radar:", error);
      ResponseHandler.internalError(res, "Failed to fetch news radar");
    }
  }

  // Get radars by story number
  async getRadarsByStoryNumber(req: Request, res: Response): Promise<void> {
    try {
      const storyNumber = parseInt(req.params.storyNumber);

      if (isNaN(storyNumber)) {
        ResponseHandler.badRequest(res, "Invalid story number");
        return;
      }

      const radars = await newsRadarService.getRadarsByStoryNumber(storyNumber);

      ResponseHandler.success(
        res,
        radars,
        "News radars retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching news radars by story number:", error);
      ResponseHandler.internalError(res, "Failed to fetch news radars");
    }
  }

  // Get child radars (related articles)
  async getChildRadars(req: Request, res: Response): Promise<void> {
    try {
      const parentId = parseInt(req.params.parentId);

      if (isNaN(parentId)) {
        ResponseHandler.badRequest(res, "Invalid parent radar ID");
        return;
      }

      const radars = await newsRadarService.getChildRadars(parentId);

      ResponseHandler.success(
        res,
        radars,
        "Child radars retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching child radars:", error);
      ResponseHandler.internalError(res, "Failed to fetch child radars");
    }
  }

  // Create new radar
  async createRadar(req: Request, res: Response): Promise<void> {
    try {
      const radarData: NewsRadar = req.body;

      // Validation - Based on NOT NULL fields from database
      const validationErrors = [];

      if (!radarData.radar_category_id) {
        validationErrors.push({
          field: "radar_category_id",
          message: "Category ID is required",
        });
      }
      if (!radarData.radar_source_id) {
        validationErrors.push({
          field: "radar_source_id",
          message: "Source ID is required",
        });
      }
      if (!radarData.radar_title) {
        validationErrors.push({
          field: "radar_title",
          message: "Title is required",
        });
      }
      if (!radarData.radar_content) {
        validationErrors.push({
          field: "radar_content",
          message: "Content is required",
        });
      }
      if (!radarData.radar_url) {
        validationErrors.push({
          field: "radar_url",
          message: "URL is required",
        });
      }

      // Validate processing status enum if provided
      if (
        radarData.radar_processing_status &&
        !["NEW", "PROCESSING", "COMPLETED", "FAILED"].includes(
          radarData.radar_processing_status
        )
      ) {
        validationErrors.push({
          field: "radar_processing_status",
          message:
            "Processing status must be NEW, PROCESSING, COMPLETED, or FAILED",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Get user ID from request (assuming authentication middleware sets it)
      const userId = (req as any).user?.user_id;

      const newRadar = await newsRadarService.createRadar(radarData, userId);
      ResponseHandler.created(res, newRadar, "News radar created successfully");
    } catch (error) {
      console.error("Error creating news radar:", error);
      ResponseHandler.internalError(res, "Failed to create news radar");
    }
  }

  // Update radar
  async updateRadar(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid radar ID");
        return;
      }

      const radarData: Partial<NewsRadar> = req.body;

      // Check if radar exists
      const existingRadar = await newsRadarService.getRadarById(id);
      if (!existingRadar) {
        ResponseHandler.notFound(res, "News radar not found");
        return;
      }

      // Validate processing status if provided
      if (
        radarData.radar_processing_status &&
        !["NEW", "PROCESSING", "COMPLETED", "FAILED"].includes(
          radarData.radar_processing_status
        )
      ) {
        ResponseHandler.badRequest(
          res,
          "Processing status must be NEW, PROCESSING, COMPLETED, or FAILED"
        );
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const updated = await newsRadarService.updateRadar(id, radarData, userId);

      if (!updated) {
        ResponseHandler.badRequest(res, "No changes made");
        return;
      }

      const updatedRadar = await newsRadarService.getRadarById(id);
      ResponseHandler.success(
        res,
        updatedRadar,
        "News radar updated successfully"
      );
    } catch (error) {
      console.error("Error updating news radar:", error);
      ResponseHandler.internalError(res, "Failed to update news radar");
    }
  }

  // Delete radar
  async deleteRadar(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const hard = req.query.hard === "true";

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid radar ID");
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      let deleted: boolean;
      if (hard) {
        deleted = await newsRadarService.hardDeleteRadar(id);
      } else {
        deleted = await newsRadarService.deleteRadar(id, userId);
      }

      if (!deleted) {
        ResponseHandler.notFound(res, "News radar not found");
        return;
      }

      ResponseHandler.success(res, null, "News radar deleted successfully");
    } catch (error) {
      console.error("Error deleting news radar:", error);
      ResponseHandler.internalError(res, "Failed to delete news radar");
    }
  }

  // Restore deleted radar
  async restoreRadar(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid radar ID");
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const restored = await newsRadarService.restoreRadar(id, userId);

      if (!restored) {
        ResponseHandler.notFound(res, "News radar not found");
        return;
      }

      ResponseHandler.success(res, null, "News radar restored successfully");
    } catch (error) {
      console.error("Error restoring news radar:", error);
      ResponseHandler.internalError(res, "Failed to restore news radar");
    }
  }

  // Bulk update processing status
  async bulkUpdateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ids, radar_processing_status } = req.body;

      // Validation
      const validationErrors = [];
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        validationErrors.push({
          field: "ids",
          message: "Radar IDs array is required",
        });
      }
      if (!radar_processing_status) {
        validationErrors.push({
          field: "radar_processing_status",
          message: "Processing status is required",
        });
      }
      if (
        radar_processing_status &&
        !["NEW", "PROCESSING", "COMPLETED", "FAILED"].includes(
          radar_processing_status
        )
      ) {
        validationErrors.push({
          field: "radar_processing_status",
          message:
            "Processing status must be NEW, PROCESSING, COMPLETED, or FAILED",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const affectedRows = await newsRadarService.bulkUpdateStatus(
        ids,
        radar_processing_status,
        userId
      );

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} news radar(s) updated successfully`
      );
    } catch (error) {
      console.error("Error bulk updating news radars:", error);
      ResponseHandler.internalError(res, "Failed to update news radars");
    }
  }

  // Bulk update breaking news flag
  async bulkUpdateBreaking(req: Request, res: Response): Promise<void> {
    try {
      const { ids, radar_is_breaking } = req.body;

      // Validation
      const validationErrors = [];
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        validationErrors.push({
          field: "ids",
          message: "Radar IDs array is required",
        });
      }
      if (typeof radar_is_breaking !== "boolean") {
        validationErrors.push({
          field: "radar_is_breaking",
          message: "Breaking news flag is required",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const affectedRows = await newsRadarService.bulkUpdateBreaking(
        ids,
        radar_is_breaking,
        userId
      );

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} news radar(s) updated successfully`
      );
    } catch (error) {
      console.error("Error bulk updating breaking news flag:", error);
      ResponseHandler.internalError(res, "Failed to update news radars");
    }
  }

  // Bulk delete
  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids, hard = false } = req.body;

      // Validation
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "ids", message: "Radar IDs array is required" },
        ]);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id;

      const affectedRows = await newsRadarService.bulkDelete(ids, hard, userId);

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} news radar(s) deleted successfully`
      );
    } catch (error) {
      console.error("Error bulk deleting news radars:", error);
      ResponseHandler.internalError(res, "Failed to delete news radars");
    }
  }
}

export default new NewsRadarController();
