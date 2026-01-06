import { Request, Response } from "express";
import ResponseHandler from "../utils/response-handler";
import { radarAIService } from "../services/radar-ai.service";

export class NewsRadarAIController {
  private radarAIService;

  constructor() {
    this.radarAIService = radarAIService;
  }
  async createRadarAI(req: Request, res: Response): Promise<any> {
    try {
      const radarAIData: number = req.body.radar_id;
      console.log("radarAIData", radarAIData);

      // Validation - Based on NOT NULL fields from database
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
