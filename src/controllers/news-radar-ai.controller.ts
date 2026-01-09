import { Request, Response } from "express";
import ResponseHandler from "../utils/response-handler";
import { radarAIService } from "../services/radar-ai.service";
import { NewsRadarAIFilters } from "../models/news-radar-ai.model";

export class NewsRadarAIController {
  private radarAIService;

  constructor() {
    this.radarAIService = radarAIService;
  }

  //Get all news radar genreate by ai
  async getAllNewsRadarAI(req: Request, res: Response): Promise<void> {
    try {
      const filters: NewsRadarAIFilters = {
        search: req.query.search as string,
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await this.radarAIService.getAllNewsRadarAI(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "News radar generate by AI retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching accounts:", error);
      ResponseHandler.internalError(res, "Failed to fetch accounts");
    }
  }

  async createRadarAI(req: Request, res: Response): Promise<any> {
    try {
      const radarAIData: number = req.body.radar_id;

      const validationErrors = [];

      if (!radarAIData) {
        validationErrors.push({
          field: "radar_id",
          message: "radar_id is required",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      const newRadarAI = await this.radarAIService.runByArticleId(radarAIData);
      ResponseHandler.created(
        res,
        newRadarAI,
        "AI news radar created successfully"
      );
    } catch (error) {
      console.error("Error creating AI news radar:", error);
      ResponseHandler.internalError(res, "Failed to create AI news radar");
    }
  }
}

export default new NewsRadarAIController();
