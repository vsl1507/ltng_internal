import { Request, Response } from "express";
import telegramPostService from "../services/telegram-post.service";
import {
  TelegramPost,
  TelegramPostFilters,
} from "../models/telegram-post.model";
import ResponseHandler from "../utils/response-handler";

export class TelegramPostController {
  // Get all posts
  async getAllPosts(req: Request, res: Response): Promise<void> {
    try {
      const filters: TelegramPostFilters = {
        radar_ai_id: req.query.radar_ai_id
          ? parseInt(req.query.radar_ai_id as string)
          : undefined,
        post_version: req.query.post_version
          ? parseInt(req.query.post_version as string)
          : undefined,
        has_message_id:
          req.query.has_message_id === "true"
            ? true
            : req.query.has_message_id === "false"
            ? false
            : undefined,
        is_major_update:
          req.query.is_major_update === "true"
            ? true
            : req.query.is_major_update === "false"
            ? false
            : undefined,
        is_deleted: req.query.is_deleted === "true",
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await telegramPostService.getAllPosts(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Telegram posts retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching telegram posts:", error);
      ResponseHandler.internalError(res, "Failed to fetch telegram posts");
    }
  }

  // Get unread messages (posts without message_id)
  async getUnreadMessages(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await telegramPostService.getUnreadMessages(page, limit);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Unread messages retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching unread messages:", error);
      ResponseHandler.internalError(res, "Failed to fetch unread messages");
    }
  }

  // Get post by ID
  async getPostById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid post ID");
        return;
      }

      const post = await telegramPostService.getPostById(id);

      if (!post) {
        ResponseHandler.notFound(res, "Post not found");
        return;
      }

      ResponseHandler.success(res, post, "Post retrieved successfully");
    } catch (error) {
      console.error("Error fetching post:", error);
      ResponseHandler.internalError(res, "Failed to fetch post");
    }
  }

  // Get posts by radar AI ID
  async getPostsByRadarAiId(req: Request, res: Response): Promise<void> {
    try {
      const radarAiId = parseInt(req.params.radarAiId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (isNaN(radarAiId)) {
        ResponseHandler.badRequest(res, "Invalid radar AI ID");
        return;
      }

      const result = await telegramPostService.getPostsByRadarAiId(
        radarAiId,
        page,
        limit
      );

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Posts retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching posts by radar AI:", error);
      ResponseHandler.internalError(res, "Failed to fetch posts");
    }
  }

  // Get posts by telegram ID
  async getPostsByTelegramId(req: Request, res: Response): Promise<void> {
    try {
      const telegramId = parseInt(req.params.telegramId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (isNaN(telegramId)) {
        ResponseHandler.badRequest(res, "Invalid telegram ID");
        return;
      }

      const result = await telegramPostService.getPostsByTelegramId(
        telegramId,
        page,
        limit
      );

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Posts retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching posts by telegram:", error);
      ResponseHandler.internalError(res, "Failed to fetch posts");
    }
  }

  // Create post
  async createPost(req: Request, res: Response): Promise<void> {
    try {
      const postData: TelegramPost = req.body;
      const userId = req.body.user_id;

      // Validation
      const validationErrors = [];

      if (!postData.radar_ai_id) {
        validationErrors.push({
          field: "radar_ai_id",
          message: "Radar AI ID is required",
        });
      }

      if (!postData.post_version) {
        validationErrors.push({
          field: "post_version",
          message: "Post version is required",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Verify radar AI exists
      const radarAiExists = await telegramPostService.verifyRadarAiExists(
        postData.radar_ai_id
      );
      if (!radarAiExists) {
        ResponseHandler.badRequest(res, "Radar AI does not exist");
        return;
      }

      const newPost = await telegramPostService.createPost(postData, userId);
      ResponseHandler.created(
        res,
        newPost,
        "Telegram post created successfully"
      );
    } catch (error) {
      console.error("Error creating post:", error);
      ResponseHandler.internalError(res, "Failed to create post");
    }
  }

  // Update message ID
  async updateMessageId(req: Request, res: Response): Promise<void> {
    try {
      const postId = parseInt(req.params.id);
      const { post_message_id, user_id } = req.body;

      if (isNaN(postId)) {
        ResponseHandler.badRequest(res, "Invalid post ID");
        return;
      }

      if (!post_message_id) {
        ResponseHandler.validationError(res, [
          { field: "post_message_id", message: "Message ID is required" },
        ]);
        return;
      }

      const updated = await telegramPostService.updateMessageId(
        postId,
        post_message_id,
        user_id
      );

      if (!updated) {
        ResponseHandler.notFound(res, "Post not found");
        return;
      }

      const updatedPost = await telegramPostService.getPostById(postId);
      ResponseHandler.success(
        res,
        updatedPost,
        "Message ID updated successfully"
      );
    } catch (error) {
      console.error("Error updating message ID:", error);
      ResponseHandler.internalError(res, "Failed to update message ID");
    }
  }

  // Bulk update message IDs
  async bulkUpdateMessageIds(req: Request, res: Response): Promise<void> {
    try {
      const { updates, user_id } = req.body;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "updates", message: "Updates array is required" },
        ]);
        return;
      }

      // Validate each update
      for (const update of updates) {
        if (!update.post_id || !update.post_message_id) {
          ResponseHandler.validationError(res, [
            {
              field: "updates",
              message: "Each update must have post_id and post_message_id",
            },
          ]);
          return;
        }
      }

      const affectedRows = await telegramPostService.bulkUpdateMessageIds(
        updates,
        user_id
      );

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} message ID(s) updated successfully`
      );
    } catch (error) {
      console.error("Error bulk updating message IDs:", error);
      ResponseHandler.internalError(res, "Failed to update message IDs");
    }
  }

  // Update post
  async updatePost(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid post ID");
        return;
      }

      const postData: Partial<TelegramPost> = req.body;
      const userId = req.body.user_id;

      // Check if post exists
      const existingPost = await telegramPostService.getPostById(id);
      if (!existingPost) {
        ResponseHandler.notFound(res, "Post not found");
        return;
      }

      const updated = await telegramPostService.updatePost(
        id,
        postData,
        userId
      );

      if (!updated) {
        ResponseHandler.badRequest(res, "No changes made");
        return;
      }

      const updatedPost = await telegramPostService.getPostById(id);
      ResponseHandler.success(res, updatedPost, "Post updated successfully");
    } catch (error) {
      console.error("Error updating post:", error);
      ResponseHandler.internalError(res, "Failed to update post");
    }
  }

  // Delete post
  async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const hard = req.query.hard === "true";
      const userId = req.body.user_id;

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid post ID");
        return;
      }

      let deleted: boolean;

      if (hard) {
        deleted = await telegramPostService.hardDeletePost(id);
      } else {
        deleted = await telegramPostService.softDeletePost(id, userId);
      }

      if (!deleted) {
        ResponseHandler.notFound(res, "Post not found");
        return;
      }

      ResponseHandler.success(
        res,
        null,
        hard ? "Post permanently deleted" : "Post deleted successfully"
      );
    } catch (error) {
      console.error("Error deleting post:", error);
      ResponseHandler.internalError(res, "Failed to delete post");
    }
  }

  // Get statistics
  // async getStats(req: Request, res: Response): Promise<void> {
  //   try {
  //     const stats = await telegramPostService.getStats();

  //     ResponseHandler.success(res, stats, "Statistics retrieved successfully");
  //   } catch (error) {
  //     console.error("Error fetching stats:", error);
  //     ResponseHandler.internalError(res, "Failed to fetch statistics");
  //   }
  // }
}

export default new TelegramPostController();
