import { Request, Response } from "express";
import { CategoryService } from "../services/category.service";
import ResponseHandler from "../utils/response-handler";

const categoryService = new CategoryService();

export class CategoryController {
  async getAllCategories(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        search: req.query.search as string,
        is_deleted: req.query.is_deleted === "true" ? true : false,
        sort_by: req.query.sort_by as string,
        sort_order: (req.query.sort_order as "ASC" | "DESC") || "DESC",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await categoryService.getAllCategories(filters);

      ResponseHandler.successWithPagination(
        res,
        result.data,
        result.pagination,
        "Categories retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching categories:", error);
      ResponseHandler.internalError(res, "Failed to fetch categories");
    }
  }

  // Get category by ID
  async getCategoryById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid category ID");
        return;
      }

      const category = await categoryService.getCategoryById(id);

      if (!category) {
        ResponseHandler.notFound(res, "Category not found");
        return;
      }

      ResponseHandler.success(res, category, "Category retrieved successfully");
    } catch (error) {
      console.error("Error fetching category:", error);
      ResponseHandler.internalError(res, "Failed to fetch category");
    }
  }

  // Create new category
  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category_name_en, category_name_kh, category_description } =
        req.body;

      // Validation
      const validationErrors = [];

      if (!category_name_en || category_name_en.trim() === "") {
        validationErrors.push({
          field: "category_name_en",
          message: "English category name is required",
        });
      }
      if (!category_name_kh || category_name_kh.trim() === "") {
        validationErrors.push({
          field: "category_name_kh",
          message: "Khmer category name is required",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Check if category already exists
      const existingCategory = await categoryService.findCategoryByName(
        category_name_en,
        category_name_kh
      );
      if (existingCategory) {
        ResponseHandler.conflict(res, "Category already exists");
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      const categoryId = await categoryService.createCategory(
        category_name_en,
        category_name_kh,
        userId,
        category_description
      );

      const newCategory = await categoryService.getCategoryById(categoryId);
      ResponseHandler.created(
        res,
        newCategory,
        "Category created successfully"
      );
    } catch (error) {
      console.error("Error creating category:", error);
      ResponseHandler.internalError(res, "Failed to create category");
    }
  }

  // Update category
  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid category ID");
        return;
      }

      const categoryData = req.body;

      // Check if category exists
      const existingCategory = await categoryService.getCategoryById(id);
      if (!existingCategory) {
        ResponseHandler.notFound(res, "Category not found");
        return;
      }

      // Check if name is being changed and if it conflicts
      if (
        categoryData.category_name_en &&
        categoryData.category_name_en !== existingCategory.category_name_en
      ) {
        const nameExists = await categoryService.findCategoryByName(
          categoryData.category_name_en,
          categoryData.category_name_kh
        );
        if (nameExists && nameExists.category_id !== id) {
          ResponseHandler.conflict(res, "Category name already exists");
          return;
        }
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      const updated = await categoryService.updateCategory(
        id,
        categoryData,
        userId
      );

      if (!updated) {
        ResponseHandler.badRequest(res, "No changes made");
        return;
      }

      const updatedCategory = await categoryService.getCategoryById(id);
      ResponseHandler.success(
        res,
        updatedCategory,
        "Category updated successfully"
      );
    } catch (error) {
      console.error("Error updating category:", error);
      ResponseHandler.internalError(res, "Failed to update category");
    }
  }

  // Delete category
  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const hard = req.query.hard === "true";

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid category ID");
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      let deleted: boolean;
      if (hard) {
        deleted = await categoryService.hardDeleteCategory(id);
      } else {
        deleted = await categoryService.deleteCategory(id, userId);
      }

      if (!deleted) {
        ResponseHandler.notFound(res, "Category not found");
        return;
      }

      ResponseHandler.success(res, null, "Category deleted successfully");
    } catch (error) {
      console.error("Error deleting category:", error);
      ResponseHandler.internalError(res, "Failed to delete category");
    }
  }

  // Restore deleted category
  async restoreCategory(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        ResponseHandler.badRequest(res, "Invalid category ID");
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      const restored = await categoryService.restoreCategory(id, userId);

      if (!restored) {
        ResponseHandler.notFound(res, "Category not found");
        return;
      }

      ResponseHandler.success(res, null, "Category restored successfully");
    } catch (error) {
      console.error("Error restoring category:", error);
      ResponseHandler.internalError(res, "Failed to restore category");
    }
  }

  // Bulk delete categories
  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const { ids, hard = false } = req.body;

      // Validation
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ResponseHandler.validationError(res, [
          { field: "ids", message: "Category IDs array is required" },
        ]);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      const affectedRows = await categoryService.bulkDeleteCategories(
        ids,
        hard,
        userId
      );

      ResponseHandler.success(
        res,
        { affected_rows: affectedRows },
        `${affectedRows} categor${
          affectedRows === 1 ? "y" : "ies"
        } deleted successfully`
      );
    } catch (error) {
      console.error("Error bulk deleting categories:", error);
      ResponseHandler.internalError(res, "Failed to delete categories");
    }
  }

  // Get category statistics
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await categoryService.getStatistics();

      ResponseHandler.success(res, stats, "Statistics retrieved successfully");
    } catch (error) {
      console.error("Error getting statistics:", error);
      ResponseHandler.internalError(res, "Failed to retrieve statistics");
    }
  }

  // Auto-categorize and tag an article
  async autoCategorizeAndTag(req: Request, res: Response): Promise<void> {
    try {
      const { radar_id, title, content } = req.body;

      // Validation
      const validationErrors = [];

      if (!radar_id) {
        validationErrors.push({
          field: "radar_id",
          message: "Radar ID is required",
        });
      }
      if (!title || title.trim() === "") {
        validationErrors.push({
          field: "title",
          message: "Title is required",
        });
      }
      if (!content || content.trim() === "") {
        validationErrors.push({
          field: "content",
          message: "Content is required",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      const result = await categoryService.autoCategorizeAndTag(
        radar_id,
        title,
        content,
        userId
      );

      ResponseHandler.success(
        res,
        result,
        "Article categorized and tagged successfully"
      );
    } catch (error) {
      console.error("Error auto-categorizing article:", error);
      ResponseHandler.internalError(res, "Failed to categorize article");
    }
  }

  // Get keywords for a category
  async getCategoryKeywords(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = parseInt(req.params.categoryId);

      if (isNaN(categoryId)) {
        ResponseHandler.badRequest(res, "Invalid category ID");
        return;
      }

      const keywords = await categoryService.getCategoryKeywords(categoryId);

      ResponseHandler.success(res, keywords, "Keywords retrieved successfully");
    } catch (error) {
      console.error("Error fetching keywords:", error);
      ResponseHandler.internalError(res, "Failed to fetch keywords");
    }
  }

  // Add a keyword to a category
  async addCategoryKeyword(req: Request, res: Response): Promise<void> {
    try {
      const {
        category_id,
        keyword,
        language,
        weight = 1.0,
        is_exact_match = false,
      } = req.body;

      // Validation
      const validationErrors = [];

      if (!category_id) {
        validationErrors.push({
          field: "category_id",
          message: "Category ID is required",
        });
      }
      if (!keyword || keyword.trim() === "") {
        validationErrors.push({
          field: "keyword",
          message: "Keyword is required",
        });
      }
      if (!language || !["en", "kh"].includes(language)) {
        validationErrors.push({
          field: "language",
          message: "Language must be 'en' or 'kh'",
        });
      }
      if (typeof weight !== "number" || weight <= 0) {
        validationErrors.push({
          field: "weight",
          message: "Weight must be a positive number",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      const keywordId = await categoryService.addCategoryKeyword(
        category_id,
        keyword,
        language,
        weight,
        is_exact_match,
        userId
      );

      ResponseHandler.created(
        res,
        { keyword_id: keywordId },
        "Keyword added successfully"
      );
    } catch (error: any) {
      console.error("Error adding keyword:", error);
      if (error.message?.includes("Duplicate")) {
        ResponseHandler.conflict(res, "Keyword already exists");
      } else {
        ResponseHandler.internalError(res, "Failed to add keyword");
      }
    }
  }

  // Bulk add keywords to a category
  async bulkAddKeywords(req: Request, res: Response): Promise<void> {
    try {
      const { category_id, keywords } = req.body;

      // Validation
      const validationErrors = [];

      if (!category_id) {
        validationErrors.push({
          field: "category_id",
          message: "Category ID is required",
        });
      }
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        validationErrors.push({
          field: "keywords",
          message: "Keywords array is required and must not be empty",
        });
      }

      // Validate each keyword
      if (keywords && Array.isArray(keywords)) {
        keywords.forEach((kw, index) => {
          if (!kw.keyword || kw.keyword.trim() === "") {
            validationErrors.push({
              field: `keywords[${index}].keyword`,
              message: "Keyword is required",
            });
          }
          if (!kw.language || !["en", "kh"].includes(kw.language)) {
            validationErrors.push({
              field: `keywords[${index}].language`,
              message: "Language must be 'en' or 'kh'",
            });
          }
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      // Get user ID from request
      const userId = (req as any).user?.user_id || null;

      await categoryService.bulkAddKeywords(category_id, keywords, userId);

      ResponseHandler.success(
        res,
        { added_count: keywords.length },
        `${keywords.length} keyword(s) added successfully`
      );
    } catch (error) {
      console.error("Error bulk adding keywords:", error);
      ResponseHandler.internalError(res, "Failed to add keywords");
    }
  }

  // Delete a keyword
  async deleteCategoryKeyword(req: Request, res: Response): Promise<void> {
    try {
      const keywordId = parseInt(req.params.keywordId);

      if (isNaN(keywordId)) {
        ResponseHandler.badRequest(res, "Invalid keyword ID");
        return;
      }

      await categoryService.deleteCategoryKeyword(keywordId);

      ResponseHandler.success(res, null, "Keyword deleted successfully");
    } catch (error) {
      console.error("Error deleting keyword:", error);
      ResponseHandler.internalError(res, "Failed to delete keyword");
    }
  }

  // Get configuration
  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = categoryService.getConfig();

      ResponseHandler.success(
        res,
        config,
        "Configuration retrieved successfully"
      );
    } catch (error) {
      console.error("Error getting configuration:", error);
      ResponseHandler.internalError(res, "Failed to get configuration");
    }
  }

  // Update configuration
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;

      // Validation
      const validationErrors = [];

      if (
        config.keywordThreshold !== undefined &&
        (typeof config.keywordThreshold !== "number" ||
          config.keywordThreshold < 0)
      ) {
        validationErrors.push({
          field: "keywordThreshold",
          message: "Keyword threshold must be a non-negative number",
        });
      }
      if (
        config.useAIFallback !== undefined &&
        typeof config.useAIFallback !== "boolean"
      ) {
        validationErrors.push({
          field: "useAIFallback",
          message: "Use AI fallback must be a boolean",
        });
      }
      if (
        config.combineResults !== undefined &&
        typeof config.combineResults !== "boolean"
      ) {
        validationErrors.push({
          field: "combineResults",
          message: "Combine results must be a boolean",
        });
      }
      if (
        config.autoLearnKeywords !== undefined &&
        typeof config.autoLearnKeywords !== "boolean"
      ) {
        validationErrors.push({
          field: "autoLearnKeywords",
          message: "Auto learn keywords must be a boolean",
        });
      }
      if (
        config.autoLearnMinWeight !== undefined &&
        (typeof config.autoLearnMinWeight !== "number" ||
          config.autoLearnMinWeight <= 0)
      ) {
        validationErrors.push({
          field: "autoLearnMinWeight",
          message: "Auto learn min weight must be a positive number",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      categoryService.setConfig(config);

      const updatedConfig = categoryService.getConfig();
      ResponseHandler.success(
        res,
        updatedConfig,
        "Configuration updated successfully"
      );
    } catch (error) {
      console.error("Error updating configuration:", error);
      ResponseHandler.internalError(res, "Failed to update configuration");
    }
  }

  // Attach tags to radar
  async attachTagsToRadar(req: Request, res: Response): Promise<void> {
    try {
      const radarId = parseInt(req.params.radarId);
      const { tag_ids } = req.body;

      // Validation
      const validationErrors = [];

      if (isNaN(radarId)) {
        ResponseHandler.badRequest(res, "Invalid radar ID");
        return;
      }

      if (!tag_ids || !Array.isArray(tag_ids) || tag_ids.length === 0) {
        validationErrors.push({
          field: "tag_ids",
          message: "Tag IDs array is required and must not be empty",
        });
      }

      if (validationErrors.length > 0) {
        ResponseHandler.validationError(res, validationErrors);
        return;
      }

      await categoryService.attachTagsToRadar(radarId, tag_ids);

      ResponseHandler.success(
        res,
        { attached_count: tag_ids.length },
        `${tag_ids.length} tag(s) attached successfully`
      );
    } catch (error) {
      console.error("Error attaching tags to radar:", error);
      ResponseHandler.internalError(res, "Failed to attach tags");
    }
  }
}

export default new CategoryController();
