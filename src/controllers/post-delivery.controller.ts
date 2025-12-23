// import { Request, Response } from "express";
// import postDeliveryService from "../services/post-delivery.service";
// import { NewsPostDeliveryFilters } from "../models/post-delivery.model";
// import ResponseHandler from "../utils/response-handler";

// export class PostDeliveryController {
//   // Get all deliveries with filters and pagination
//   async getAllDeliveries(req: Request, res: Response): Promise<void> {
//     try {
//       const filters: NewsPostDeliveryFilters = {
//         post_id: req.query.post_id
//           ? parseInt(req.query.post_id as string)
//           : undefined,
//         telegram_id: req.query.telegram_id
//           ? parseInt(req.query.telegram_id as string)
//           : undefined,
//         delivery_status: req.query.delivery_status as any,
//         telegram_message_id: req.query.telegram_message_id
//           ? parseInt(req.query.telegram_message_id as string)
//           : undefined,
//         retry_count_min: req.query.retry_count_min
//           ? parseInt(req.query.retry_count_min as string)
//           : undefined,
//         retry_count_max: req.query.retry_count_max
//           ? parseInt(req.query.retry_count_max as string)
//           : undefined,
//         is_deleted: req.query.is_deleted === "true" ? true : false,
//         sort_by: req.query.sort_by as string,
//         sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
//         page: parseInt(req.query.page as string) || 1,
//         limit: parseInt(req.query.limit as string) || 50,
//       };

//       const result = await postDeliveryService.getAllDeliveries(filters);

//       ResponseHandler.successWithPagination(
//         res,
//         result.data,
//         result.pagination,
//         "Deliveries retrieved successfully"
//       );
//     } catch (error) {
//       console.error("Error fetching deliveries:", error);
//       ResponseHandler.internalError(res, "Failed to fetch deliveries");
//     }
//   }

//   // Get delivery by ID
//   async getDeliveryById(req: Request, res: Response): Promise<void> {
//     try {
//       const id = parseInt(req.params.id);

//       if (isNaN(id)) {
//         ResponseHandler.badRequest(res, "Invalid delivery ID");
//         return;
//       }

//       const delivery = await postDeliveryService.getDeliveryById(id);

//       if (!delivery) {
//         ResponseHandler.notFound(res, "Delivery not found");
//         return;
//       }

//       ResponseHandler.success(res, delivery, "Delivery retrieved successfully");
//     } catch (error) {
//       console.error("Error fetching delivery:", error);
//       ResponseHandler.internalError(res, "Failed to fetch delivery");
//     }
//   }

//   // Get deliveries by post ID
//   async getDeliveriesByPostId(req: Request, res: Response): Promise<void> {
//     try {
//       const postId = parseInt(req.params.postId);

//       if (isNaN(postId)) {
//         ResponseHandler.badRequest(res, "Invalid post ID");
//         return;
//       }

//       const deliveries = await postDeliveryService.getDeliveriesByPostId(
//         postId
//       );

//       ResponseHandler.success(
//         res,
//         deliveries,
//         "Deliveries retrieved successfully"
//       );
//     } catch (error) {
//       console.error("Error fetching deliveries by post:", error);
//       ResponseHandler.internalError(res, "Failed to fetch deliveries");
//     }
//   }

//   // Get deliveries by telegram ID
//   async getDeliveriesByTelegramId(req: Request, res: Response): Promise<void> {
//     try {
//       const telegramId = parseInt(req.params.telegramId);

//       if (isNaN(telegramId)) {
//         ResponseHandler.badRequest(res, "Invalid telegram ID");
//         return;
//       }

//       const deliveries = await postDeliveryService.getDeliveriesByTelegramId(
//         telegramId
//       );

//       ResponseHandler.success(
//         res,
//         deliveries,
//         "Deliveries retrieved successfully"
//       );
//     } catch (error) {
//       console.error("Error fetching deliveries by telegram:", error);
//       ResponseHandler.internalError(res, "Failed to fetch deliveries");
//     }
//   }

//   // Create new delivery
//   async createDelivery(req: Request, res: Response): Promise<void> {
//     try {
//       const deliveryData: PostDelivery = req.body;

//       // Validation
//       const validationErrors = [];

//       if (!deliveryData.post_id) {
//         validationErrors.push({
//           field: "post_id",
//           message: "Post ID is required",
//         });
//       }
//       if (!deliveryData.telegram_id) {
//         validationErrors.push({
//           field: "telegram_id",
//           message: "Telegram ID is required",
//         });
//       }

//       // Validate delivery status if provided
//       if (
//         deliveryData.delivery_status &&
//         !["PENDING", "SENT", "EDITED", "DELETED", "FAILED"].includes(
//           deliveryData.delivery_status
//         )
//       ) {
//         validationErrors.push({
//           field: "delivery_status",
//           message: "Invalid delivery status",
//         });
//       }

//       if (validationErrors.length > 0) {
//         ResponseHandler.validationError(res, validationErrors);
//         return;
//       }

//       // Check if delivery already exists for this post and telegram
//       const existingDelivery =
//         await postDeliveryService.getDeliveryByPostAndTelegram(
//           deliveryData.post_id,
//           deliveryData.telegram_id
//         );
//       if (existingDelivery) {
//         ResponseHandler.conflict(
//           res,
//           "Delivery already exists for this post and telegram"
//         );
//         return;
//       }

//       // Get user ID from request
//       const userId = (req as any).user?.user_id;
//       if (userId) {
//         deliveryData.created_by = userId;
//         deliveryData.updated_by = userId;
//       }

//       const newDelivery = await postDeliveryService.createDelivery(
//         deliveryData
//       );
//       ResponseHandler.created(
//         res,
//         newDelivery,
//         "Delivery created successfully"
//       );
//     } catch (error) {
//       console.error("Error creating delivery:", error);
//       ResponseHandler.internalError(res, "Failed to create delivery");
//     }
//   }

//   // Update delivery
//   async updateDelivery(req: Request, res: Response): Promise<void> {
//     try {
//       const id = parseInt(req.params.id);

//       if (isNaN(id)) {
//         ResponseHandler.badRequest(res, "Invalid delivery ID");
//         return;
//       }

//       const deliveryData: Partial<PostDelivery> = req.body;

//       // Check if delivery exists
//       const existingDelivery = await postDeliveryService.getDeliveryById(id);
//       if (!existingDelivery) {
//         ResponseHandler.notFound(res, "Delivery not found");
//         return;
//       }

//       // Validate delivery status if provided
//       if (
//         deliveryData.delivery_status &&
//         !["PENDING", "SENT", "EDITED", "DELETED", "FAILED"].includes(
//           deliveryData.delivery_status
//         )
//       ) {
//         ResponseHandler.badRequest(res, "Invalid delivery status");
//         return;
//       }

//       // Get user ID from request
//       const userId = (req as any).user?.user_id;
//       if (userId) {
//         deliveryData.updated_by = userId;
//       }

//       const updated = await postDeliveryService.updateDelivery(
//         id,
//         deliveryData
//       );

//       if (!updated) {
//         ResponseHandler.badRequest(res, "No changes made");
//         return;
//       }

//       const updatedDelivery = await postDeliveryService.getDeliveryById(id);
//       ResponseHandler.success(
//         res,
//         updatedDelivery,
//         "Delivery updated successfully"
//       );
//     } catch (error) {
//       console.error("Error updating delivery:", error);
//       ResponseHandler.internalError(res, "Failed to update delivery");
//     }
//   }

//   // Update delivery status
//   async updateDeliveryStatus(req: Request, res: Response): Promise<void> {
//     try {
//       const id = parseInt(req.params.id);
//       const { delivery_status, telegram_message_id, last_error } = req.body;

//       if (isNaN(id)) {
//         ResponseHandler.badRequest(res, "Invalid delivery ID");
//         return;
//       }

//       if (!delivery_status) {
//         ResponseHandler.badRequest(res, "Delivery status is required");
//         return;
//       }

//       // Validate delivery status
//       if (
//         !["PENDING", "SENT", "EDITED", "DELETED", "FAILED"].includes(
//           delivery_status
//         )
//       ) {
//         ResponseHandler.badRequest(res, "Invalid delivery status");
//         return;
//       }

//       // Get user ID from request
//       const userId = (req as any).user?.user_id;

//       const updated = await postDeliveryService.updateDeliveryStatus(
//         id,
//         delivery_status,
//         telegram_message_id,
//         last_error,
//         userId
//       );

//       if (!updated) {
//         ResponseHandler.notFound(res, "Delivery not found");
//         return;
//       }

//       ResponseHandler.success(
//         res,
//         null,
//         "Delivery status updated successfully"
//       );
//     } catch (error) {
//       console.error("Error updating delivery status:", error);
//       ResponseHandler.internalError(res, "Failed to update delivery status");
//     }
//   }

//   // Delete delivery
//   async deleteDelivery(req: Request, res: Response): Promise<void> {
//     try {
//       const id = parseInt(req.params.id);
//       const hard = req.query.hard === "true";

//       if (isNaN(id)) {
//         ResponseHandler.badRequest(res, "Invalid delivery ID");
//         return;
//       }

//       // Get user ID from request
//       const userId = (req as any).user?.user_id;

//       let deleted: boolean;
//       if (hard) {
//         deleted = await postDeliveryService.hardDeleteDelivery(id);
//       } else {
//         deleted = await postDeliveryService.deleteDelivery(id, userId);
//       }

//       if (!deleted) {
//         ResponseHandler.notFound(res, "Delivery not found");
//         return;
//       }

//       ResponseHandler.success(res, null, "Delivery deleted successfully");
//     } catch (error) {
//       console.error("Error deleting delivery:", error);
//       ResponseHandler.internalError(res, "Failed to delete delivery");
//     }
//   }

//   // Restore deleted delivery
//   async restoreDelivery(req: Request, res: Response): Promise<void> {
//     try {
//       const id = parseInt(req.params.id);

//       if (isNaN(id)) {
//         ResponseHandler.badRequest(res, "Invalid delivery ID");
//         return;
//       }

//       // Get user ID from request
//       const userId = (req as any).user?.user_id;

//       const restored = await postDeliveryService.restoreDelivery(id, userId);

//       if (!restored) {
//         ResponseHandler.notFound(res, "Delivery not found");
//         return;
//       }

//       ResponseHandler.success(res, null, "Delivery restored successfully");
//     } catch (error) {
//       console.error("Error restoring delivery:", error);
//       ResponseHandler.internalError(res, "Failed to restore delivery");
//     }
//   }

//   // Bulk update status
//   async bulkUpdateStatus(req: Request, res: Response): Promise<void> {
//     try {
//       const { ids, delivery_status } = req.body;

//       // Validation
//       const validationErrors = [];
//       if (!ids || !Array.isArray(ids) || ids.length === 0) {
//         validationErrors.push({
//           field: "ids",
//           message: "Delivery IDs array is required",
//         });
//       }
//       if (!delivery_status) {
//         validationErrors.push({
//           field: "delivery_status",
//           message: "Delivery status is required",
//         });
//       }

//       // Validate delivery status
//       if (
//         delivery_status &&
//         !["PENDING", "SENT", "EDITED", "DELETED", "FAILED"].includes(
//           delivery_status
//         )
//       ) {
//         validationErrors.push({
//           field: "delivery_status",
//           message: "Invalid delivery status",
//         });
//       }

//       if (validationErrors.length > 0) {
//         ResponseHandler.validationError(res, validationErrors);
//         return;
//       }

//       // Get user ID from request
//       const userId = (req as any).user?.user_id;

//       const affectedRows = await postDeliveryService.bulkUpdateStatus(
//         ids,
//         delivery_status,
//         userId
//       );

//       ResponseHandler.success(
//         res,
//         { affected_rows: affectedRows },
//         `${affectedRows} delivery(ies) updated successfully`
//       );
//     } catch (error) {
//       console.error("Error bulk updating deliveries:", error);
//       ResponseHandler.internalError(res, "Failed to update deliveries");
//     }
//   }

//   // Bulk delete
//   async bulkDelete(req: Request, res: Response): Promise<void> {
//     try {
//       const { ids, soft = true } = req.body;

//       // Validation
//       if (!ids || !Array.isArray(ids) || ids.length === 0) {
//         ResponseHandler.validationError(res, [
//           { field: "ids", message: "Delivery IDs array is required" },
//         ]);
//         return;
//       }

//       // Get user ID from request
//       const userId = (req as any).user?.user_id;

//       const affectedRows = await postDeliveryService.bulkDelete(
//         ids,
//         soft,
//         userId
//       );

//       ResponseHandler.success(
//         res,
//         { affected_rows: affectedRows },
//         `${affectedRows} delivery(ies) deleted successfully`
//       );
//     } catch (error) {
//       console.error("Error bulk deleting deliveries:", error);
//       ResponseHandler.internalError(res, "Failed to delete deliveries");
//     }
//   }
// }

// export default new PostDeliveryController();
