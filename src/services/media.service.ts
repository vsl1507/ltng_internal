// services/media.service.ts
// Universal Media Service - Works with any source (Telegram, Website, RSS, etc.)

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import pool from "../config/mysql.config";

// ========== INTERFACES ==========

/**
 * Generic media download options
 */
export interface MediaDownloadOptions {
  articleId: number;
  sourceName: string;
  sourceType: "telegram" | "website" | "rss" | "api" | "other";
  maxRetries?: number;
  timeout?: number;
}

/**
 * Media download result
 */
export interface MediaDownloadResult {
  success: boolean;
  mediaId?: number;
  mediaPath?: string;
  mediaType?: string;
  mediaSize?: number;
  error?: string;
}

/**
 * Media info structure
 */
export interface MediaInfo {
  mediaId?: number;
  radarId: number;
  mediaType: "image" | "video" | "audio" | "document";
  mediaUrl?: string;
  mediaPath?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailPath?: string;
  createdAt?: Date;
}

/**
 * Media source adapter interface
 * Implement this for each source type
 */
export interface IMediaSourceAdapter {
  downloadMedia(source: any, options: MediaDownloadOptions): Promise<Buffer>;
  getMediaType(source: any): string;
  getMimeType(source: any): string;
}

// ========== MAIN SERVICE ==========

export class MediaService {
  private mediaDir: string;
  private baseUrl: string;

  constructor() {
    this.mediaDir = process.env.MEDIA_STORAGE_PATH || "./storage/media";
    this.baseUrl = process.env.MEDIA_BASE_URL || "http://localhost:3000/media";
    this.ensureMediaDirectory();
  }

  // ==================== PUBLIC API ====================

  /**
   * Universal media download from URL
   * Works for: Website images, API endpoints, external URLs
   */
  async downloadFromUrl(
    url: string,
    options: MediaDownloadOptions
  ): Promise<MediaDownloadResult> {
    try {
      console.log(`📥 Downloading: ${url.substring(0, 80)}...`);

      if (!this.isValidUrl(url)) {
        return this.createErrorResult("Invalid URL");
      }

      // Download media
      const buffer = await this.fetchFromUrl(url, options.timeout);
      const mimeType = await this.detectMimeType(buffer, url);
      const mediaType = this.getMediaTypeFromMime(mimeType);

      // Save to disk
      const saveResult = await this.saveMediaToDisk(
        buffer,
        mediaType,
        mimeType,
        options
      );

      // Save metadata to database
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: mediaType as any,
        mediaUrl: url,
        mediaPath: saveResult.relativePath,
        mimeType,
        fileSize: saveResult.fileSize,
      });

      console.log(
        `✅ Downloaded: ${saveResult.filename} (${this.formatBytes(
          saveResult.fileSize
        )})`
      );

      return {
        success: true,
        mediaId,
        mediaPath: saveResult.relativePath,
        mediaType,
        mediaSize: saveResult.fileSize,
      };
    } catch (error: any) {
      console.error(`❌ Download failed: ${error.message}`);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Download from Telegram message
   * Works for: Telegram photos, videos, documents
   */
  async downloadFromTelegram(
    message: any,
    options: MediaDownloadOptions
  ): Promise<MediaDownloadResult> {
    try {
      if (!message.media) {
        return this.createErrorResult("No media in message");
      }

      console.log(`📥 Downloading Telegram media...`);

      // Get Telegram client
      const { getTelegramClient } = require("../config/telegram.config");
      const client = getTelegramClient();

      // Extract media info
      const mediaType = this.getTelegramMediaType(message.media);
      const mimeType = this.getTelegramMimeType(message.media);

      // Generate filename
      const extension = this.getExtensionFromMime(mimeType) || "bin";
      const filename = this.generateFilename(
        options.articleId,
        options.sourceName,
        extension
      );

      // Determine storage path
      const subdir = this.getSubdirectory(mediaType);
      const relativePath = path.join(subdir, filename);
      const fullPath = path.join(this.mediaDir, relativePath);

      // Download using Telegram API
      await client.downloadMedia(message, {
        outputFile: fullPath,
      });

      // Get file size
      const stats = fs.statSync(fullPath);
      const fileSize = stats.size;

      // Save metadata
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: mediaType as any,
        mediaUrl: null,
        mediaPath: relativePath,
        mimeType,
        fileSize,
      });

      console.log(`✅ Downloaded: ${filename} (${this.formatBytes(fileSize)})`);

      return {
        success: true,
        mediaId,
        mediaPath: relativePath,
        mediaType,
        mediaSize: fileSize,
      };
    } catch (error: any) {
      console.error(`❌ Telegram download failed: ${error.message}`);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Download from custom adapter
   * Works for: Any custom source with an adapter
   */
  async downloadWithAdapter(
    source: any,
    adapter: IMediaSourceAdapter,
    options: MediaDownloadOptions
  ): Promise<MediaDownloadResult> {
    try {
      console.log(`📥 Downloading with custom adapter...`);

      // Use adapter to download
      const buffer = await adapter.downloadMedia(source, options);
      const mediaType = adapter.getMediaType(source);
      const mimeType = adapter.getMimeType(source);

      // Save to disk
      const saveResult = await this.saveMediaToDisk(
        buffer,
        mediaType,
        mimeType,
        options
      );

      // Save metadata
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: mediaType as any,
        mediaUrl: null,
        mediaPath: saveResult.relativePath,
        mimeType,
        fileSize: saveResult.fileSize,
      });

      console.log(
        `✅ Downloaded: ${saveResult.filename} (${this.formatBytes(
          saveResult.fileSize
        )})`
      );

      return {
        success: true,
        mediaId,
        mediaPath: saveResult.relativePath,
        mediaType,
        mediaSize: saveResult.fileSize,
      };
    } catch (error: any) {
      console.error(`❌ Adapter download failed: ${error.message}`);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Save media URL reference without downloading
   * Works for: Any source where you just want to store the URL
   */
  async saveUrlReference(
    url: string,
    options: MediaDownloadOptions,
    mediaType: string = "image"
  ): Promise<number> {
    try {
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: mediaType as any,
        mediaUrl: url,
        mediaPath: null,
        mimeType: null,
        fileSize: null,
      });

      console.log(`💾 Saved URL reference: ${url.substring(0, 80)}...`);
      return mediaId;
    } catch (error: any) {
      console.error(`❌ Failed to save URL reference: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all media for an article
   */
  async getMediaByArticle(articleId: number): Promise<MediaInfo[]> {
    const [rows]: any = await pool.query(
      `SELECT * FROM ltng_news_radar_media WHERE radar_id = ? ORDER BY created_at ASC`,
      [articleId]
    );

    return rows.map((row: any) => this.mapRowToMediaInfo(row));
  }

  /**
   * Get media by ID
   */
  async getMediaById(mediaId: number): Promise<MediaInfo | null> {
    const [rows]: any = await pool.query(
      `SELECT * FROM ltng_news_radar_media WHERE media_id = ?`,
      [mediaId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToMediaInfo(rows[0]);
  }

  /**
   * Delete media (file + database record)
   */
  async deleteMedia(mediaId: number): Promise<boolean> {
    try {
      const [media]: any = await pool.query(
        `SELECT media_path FROM ltng_news_radar_media WHERE media_id = ?`,
        [mediaId]
      );

      if (media.length === 0) return false;

      // Delete file if exists
      if (media[0].media_path) {
        const fullPath = path.join(this.mediaDir, media[0].media_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`🗑️  Deleted file: ${media[0].media_path}`);
        }
      }

      // Delete database record
      await pool.query(`DELETE FROM ltng_news_radar_media WHERE media_id = ?`, [
        mediaId,
      ]);

      return true;
    } catch (error: any) {
      console.error(`❌ Failed to delete media: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up old media
   */
  async cleanupOldMedia(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const [oldMedia]: any = await pool.query(
        `SELECT media_id FROM ltng_news_radar_media WHERE created_at < ?`,
        [cutoffDate]
      );

      let deletedCount = 0;

      for (const media of oldMedia) {
        const deleted = await this.deleteMedia(media.media_id);
        if (deleted) deletedCount++;
      }

      console.log(`🗑️  Cleaned up ${deletedCount} old media files`);
      return deletedCount;
    } catch (error: any) {
      console.error(`❌ Cleanup failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get full file path for media
   */
  getFullPath(mediaPath: string): string {
    return path.join(this.mediaDir, mediaPath);
  }

  /**
   * Get public URL for media
   */
  getPublicUrl(mediaPath: string): string {
    return `${this.baseUrl}/${mediaPath.replace(/\\/g, "/")}`;
  }

  /**
   * Check if media file exists
   */
  fileExists(mediaPath: string): boolean {
    const fullPath = this.getFullPath(mediaPath);
    return fs.existsSync(fullPath);
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Ensure media directory structure exists
   */
  private ensureMediaDirectory(): void {
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
      console.log(`📁 Created media directory: ${this.mediaDir}`);
    }

    const subdirs = ["images", "videos", "audio", "documents"];
    subdirs.forEach((subdir) => {
      const fullPath = path.join(this.mediaDir, subdir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  /**
   * Fetch media from URL
   */
  private async fetchFromUrl(
    url: string,
    timeout: number = 30000
  ): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    return Buffer.from(response.data);
  }

  /**
   * Detect MIME type from buffer and URL
   */
  private async detectMimeType(buffer: Buffer, url?: string): Promise<string> {
    // Try to detect from file signature (magic bytes)
    const signature = buffer.slice(0, 12).toString("hex");

    // Common file signatures
    if (signature.startsWith("ffd8ff")) return "image/jpeg";
    if (signature.startsWith("89504e47")) return "image/png";
    if (signature.startsWith("47494638")) return "image/gif";
    if (signature.startsWith("52494646") && signature.includes("57454250"))
      return "image/webp";
    if (signature.startsWith("000000")) return "video/mp4";

    // Fallback to URL extension
    if (url) {
      const ext = path.extname(url).toLowerCase().replace(".", "");
      const extMap: { [key: string]: string } = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        mp4: "video/mp4",
        webm: "video/webm",
        mp3: "audio/mpeg",
        ogg: "audio/ogg",
        wav: "audio/wav",
      };

      if (extMap[ext]) return extMap[ext];
    }

    return "application/octet-stream";
  }

  /**
   * Save media buffer to disk
   */
  private async saveMediaToDisk(
    buffer: Buffer,
    mediaType: string,
    mimeType: string,
    options: MediaDownloadOptions
  ): Promise<{
    fullPath: string;
    relativePath: string;
    filename: string;
    fileSize: number;
  }> {
    const extension = this.getExtensionFromMime(mimeType) || "bin";
    const filename = this.generateFilename(
      options.articleId,
      options.sourceName,
      extension
    );

    const subdir = this.getSubdirectory(mediaType);
    const relativePath = path.join(subdir, filename);
    const fullPath = path.join(this.mediaDir, relativePath);

    // Write file
    fs.writeFileSync(fullPath, buffer);

    // Get file size
    const stats = fs.statSync(fullPath);

    return {
      fullPath,
      relativePath,
      filename,
      fileSize: stats.size,
    };
  }

  /**
   * Save media metadata to database
   */
  private async saveMediaMetadata(data: {
    radarId: number;
    mediaType: "image" | "video" | "audio" | "document";
    mediaUrl: string | null;
    mediaPath: string | null;
    mimeType: string | null;
    fileSize: number | null;
    width?: number;
    height?: number;
    duration?: number;
  }): Promise<number> {
    const [result]: any = await pool.query(
      `INSERT INTO ltng_news_radar_media (
        radar_id,
        media_type,
        media_url,
        media_path,
        media_mime_type,
        media_size,
        media_width,
        media_height,
        media_duration,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.radarId,
        data.mediaType,
        data.mediaUrl,
        data.mediaPath,
        data.mimeType,
        data.fileSize,
        data.width || null,
        data.height || null,
        data.duration || null,
      ]
    );

    return result.insertId;
  }

  /**
   * Get media type from MIME type
   */
  private getMediaTypeFromMime(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "document";
  }

  /**
   * Get Telegram media type
   */
  private getTelegramMediaType(media: any): string {
    if (media.photo) return "image";
    if (media.document) {
      const mimeType = media.document.mimeType || "";
      if (mimeType.startsWith("video/")) return "video";
      if (mimeType.startsWith("audio/")) return "audio";
    }
    return "document";
  }

  /**
   * Get Telegram MIME type
   */
  private getTelegramMimeType(media: any): string {
    if (media.photo) return "image/jpeg";
    if (media.document) {
      return media.document.mimeType || "application/octet-stream";
    }
    return "application/octet-stream";
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMime(mimeType: string): string | null {
    const mimeMap: { [key: string]: string } = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "application/pdf": "pdf",
    };

    return mimeMap[mimeType.toLowerCase()] || null;
  }

  /**
   * Generate unique filename
   */
  private generateFilename(
    articleId: number,
    source: string,
    extension: string
  ): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");
    const sanitizedSource = source
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .substring(0, 20);

    return `${sanitizedSource}_${articleId}_${timestamp}_${random}.${extension}`;
  }

  /**
   * Get subdirectory for media type
   */
  private getSubdirectory(mediaType: string): string {
    const dirMap: { [key: string]: string } = {
      image: "images",
      video: "videos",
      audio: "audio",
      document: "documents",
    };

    return dirMap[mediaType] || "documents";
  }

  /**
   * Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Create error result
   */
  private createErrorResult(error: string): MediaDownloadResult {
    return {
      success: false,
      error,
    };
  }

  /**
   * Map database row to MediaInfo
   */
  private mapRowToMediaInfo(row: any): MediaInfo {
    return {
      mediaId: row.media_id,
      radarId: row.radar_id,
      mediaType: row.media_type,
      mediaUrl: row.media_url,
      mediaPath: row.media_path,
      mimeType: row.media_mime_type,
      fileSize: row.media_size,
      width: row.media_width,
      height: row.media_height,
      duration: row.media_duration,
      createdAt: row.created_at,
    };
  }
}

// Export singleton instance
export const mediaService = new MediaService();
