import { Response } from "express";

export interface StandardResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: ValidationError[];
  pagination?: PaginationInfo;
  meta?: any;
  timestamp: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ResponseHandler {
  /**
   * Success response with data
   */
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200,
    meta?: any
  ): void {
    const response: StandardResponse<T> = {
      success: true,
      message: message || "Operation successful",
      data,
      timestamp: new Date().toISOString(),
    };

    if (meta) {
      response.meta = meta;
    }

    res.status(statusCode).json(response);
  }

  /**
   * Success response with pagination
   */
  static successWithPagination<T>(
    res: Response,
    data: T[],
    pagination: PaginationInfo,
    message?: string,
    statusCode: number = 200
  ): void {
    const response: StandardResponse<T[]> = {
      success: true,
      message: message || "Operation successful",
      data,
      pagination,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }

  /**
   * Created response (201)
   */
  static created<T>(res: Response, data: T, message?: string): void {
    this.success(res, data, message || "Resource created successfully", 201);
  }

  /**
   * No content response (204)
   */
  static noContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Error response
   */
  static error(
    res: Response,
    error: string,
    statusCode: number = 500,
    errors?: ValidationError[]
  ): void {
    const response: StandardResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };

    if (errors && errors.length > 0) {
      response.errors = errors;
    }

    res.status(statusCode).json(response);
  }

  /**
   * Bad Request (400)
   */
  static badRequest(
    res: Response,
    error: string,
    errors?: ValidationError[]
  ): void {
    this.error(res, error, 400, errors);
  }

  /**
   * Unauthorized (401)
   */
  static unauthorized(
    res: Response,
    error: string = "Unauthorized access"
  ): void {
    this.error(res, error, 401);
  }

  /**
   * Forbidden (403)
   */
  static forbidden(res: Response, error: string = "Forbidden access"): void {
    this.error(res, error, 403);
  }

  /**
   * Not Found (404)
   */
  static notFound(res: Response, error: string = "Resource not found"): void {
    this.error(res, error, 404);
  }

  /**
   * Conflict (409)
   */
  static conflict(res: Response, error: string = "Resource conflict"): void {
    this.error(res, error, 409);
  }

  /**
   * Validation Error (422)
   */
  static validationError(
    res: Response,
    errors: ValidationError[],
    message: string = "Validation failed"
  ): void {
    this.error(res, message, 422, errors);
  }

  /**
   * Internal Server Error (500)
   */
  static internalError(
    res: Response,
    error: string = "Internal server error"
  ): void {
    this.error(res, error, 500);
  }

  /**
   * Service Unavailable (503)
   */
  static serviceUnavailable(
    res: Response,
    error: string = "Service temporarily unavailable"
  ): void {
    this.error(res, error, 503);
  }
}

export default ResponseHandler;
