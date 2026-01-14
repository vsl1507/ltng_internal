import axios from "axios";
import * as crypto from "crypto";
import * as path from "path";
import pool from "../config/mysql.config";
import ImageKit from "imagekit";
import sharp from "sharp";
import {
  ImageKitUploadResult,
  IMediaSourceAdapter,
  MediaDownloadOptions,
  MediaDownloadResult,
  MediaInfo,
} from "../types/media.type";

export class MediaService {
  private imagekit: ImageKit | null = null;
  private imagekitEnabled: boolean;

  constructor() {
    this.imagekitEnabled = this.initializeImageKit();
  }

  /**
   * Initialize ImageKit with environment variables
   */
  private initializeImageKit(): boolean {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      console.warn(
        "⚠️ ImageKit credentials not found in environment variables"
      );
      console.warn("Media service will not function without ImageKit");
      return false;
    }

    try {
      this.imagekit = new ImageKit({
        publicKey,
        privateKey,
        urlEndpoint,
      });
      console.log("✅ ImageKit initialized successfully");
      return true;
    } catch (error: any) {
      console.error("❌ Failed to initialize ImageKit:", error.message);
      return false;
    }
  }

  /**
   * Upload file to ImageKit
   */
  private async uploadToImageKit(
    buffer: Buffer,
    filename: string,
    folder: string,
    mimeType: string
  ): Promise<ImageKitUploadResult | null> {
    if (!this.imagekitEnabled || !this.imagekit) {
      console.error("❌ ImageKit is not initialized");
      return null;
    }

    try {
      console.log(`☁️ Uploading to ImageKit: ${filename}`);

      const uploadResponse = await this.imagekit.upload({
        file: buffer,
        fileName: filename,
        folder: folder,
        useUniqueFileName: true,
        tags: ["news", "radar"],
      });

      console.log(`✅ ImageKit upload successful: ${uploadResponse.url}`);

      return {
        fileId: uploadResponse.fileId,
        url: uploadResponse.url,
        thumbnailUrl: uploadResponse.thumbnailUrl,
        width: uploadResponse.width,
        height: uploadResponse.height,
      };
    } catch (error: any) {
      console.error(`❌ ImageKit upload failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete file from ImageKit
   */
  private async deleteFromImageKit(fileId: string): Promise<boolean> {
    if (!this.imagekitEnabled || !this.imagekit || !fileId) {
      return false;
    }

    try {
      await this.imagekit.deleteFile(fileId);
      console.log(`🗑️ Deleted from ImageKit: ${fileId}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to delete from ImageKit: ${error.message}`);
      return false;
    }
  }

  /**
   * Universal media download from URL (MUST upload to ImageKit before storing in DB)
   * Only downloads WebP images and converts them to JPEG
   */
  async downloadFromUrl(
    url: string,
    options: MediaDownloadOptions
  ): Promise<MediaDownloadResult> {
    try {
      console.log(`📥 Checking: ${url.substring(0, 80)}...`);

      if (!this.isValidUrl(url)) {
        return this.createErrorResult("Invalid URL");
      }

      // Quick check: Skip if URL doesn't suggest WebP
      const urlLower = url.toLowerCase();
      if (!urlLower.includes(".webp") && !urlLower.includes("format=webp")) {
        console.log(`⏭️ Skipping non-WebP URL: ${url.substring(0, 80)}...`);
        return this.createErrorResult("Not a WebP image");
      }

      // Download media
      let buffer = await this.fetchFromUrl(url, options.timeout);
      let mimeType = await this.detectMimeType(buffer, url);
      let mediaType = this.getMediaTypeFromMime(mimeType);

      // Only process WebP images, skip others
      if (mimeType !== "image/webp") {
        console.log(`⏭️ Skipping non-WebP image: ${mimeType}`);
        return this.createErrorResult("Not a WebP image");
      }

      // Convert WebP to JPEG
      console.log(`🔄 Converting WebP to JPEG...`);
      buffer = await this.convertWebPToJPEG(buffer);
      mimeType = "image/jpeg";
      mediaType = "IMAGE";

      // Generate filename
      const extension = this.getExtensionFromMime(mimeType) || "bin";
      const filename = this.generateFilename(
        options.articleId,
        options.sourceName,
        extension
      );

      // CRITICAL: Check if ImageKit is properly initialized
      if (!this.imagekitEnabled || !this.imagekit) {
        console.error(`❌ ImageKit is not initialized - cannot proceed`);
        return this.createErrorResult("ImageKit service is not available");
      }

      // CRITICAL: Upload to ImageKit FIRST before saving to database
      const folder = `news-radar/${options.sourceType}/${this.getSubdirectory(
        mediaType
      )}`;

      console.log(`☁️ Uploading to ImageKit (required)...`);
      const imagekitResult = await this.uploadToImageKit(
        buffer,
        filename,
        folder,
        mimeType
      );

      // If ImageKit upload fails, DO NOT store in database
      if (!imagekitResult || !imagekitResult.url || !imagekitResult.fileId) {
        console.error(`❌ ImageKit upload failed - will NOT store in database`);
        return this.createErrorResult(
          "Failed to upload to ImageKit - media not saved"
        );
      }

      console.log(`✅ ImageKit upload successful: ${imagekitResult.url}`);

      // Only save to database AFTER successful ImageKit upload
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: mediaType as any,
        mediaUrl: url,
        mimeType,
        imagekitUrl: imagekitResult.url,
        imagekitFileId: imagekitResult.fileId,
        width: imagekitResult.width,
        height: imagekitResult.height,
      });

      console.log(
        `✅ Media saved to database: ID ${mediaId}, ${filename} (${this.formatBytes(
          buffer.length
        )})`
      );

      return {
        success: true,
        mediaId,
        mediaType,
        mediaSize: buffer.length,
        imagekitUrl: imagekitResult.url,
        imagekitFileId: imagekitResult.fileId,
      };
    } catch (error: any) {
      console.error(`❌ Download failed: ${error.message}`);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Download from Telegram message
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

      const shouldUploadToImageKit = options.uploadToImageKit !== false;

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

      // Download to buffer using custom writer
      const chunks: Buffer[] = [];
      await client.downloadMedia(message, {
        workers: 1,
        progressCallback: (progress: number) => {
          // Optional: track progress
        },
        outputFile: {
          write: (data: Buffer) => {
            chunks.push(data);
            return data.length;
          },
          close: () => {},
        },
      });

      let buffer: Buffer = Buffer.concat(chunks);

      if (!buffer || buffer.length === 0) {
        return this.createErrorResult("Failed to download media from Telegram");
      }

      let finalMimeType = mimeType;
      let finalMediaType = mediaType;

      // Convert WebP to JPEG if needed
      if (mimeType === "image/webp") {
        console.log(`🔄 Converting WebP to JPEG...`);
        buffer = await this.convertWebPToJPEG(buffer);
        finalMimeType = "image/jpeg";
        finalMediaType = "IMAGE";
      }

      const fileSize = buffer.length;

      // Upload to ImageKit
      let imagekitResult: ImageKitUploadResult | null = null;
      if (shouldUploadToImageKit) {
        const subdir = this.getSubdirectory(finalMediaType);
        const folder = `news-radar/${options.sourceType}/${subdir}`;
        imagekitResult = await this.uploadToImageKit(
          buffer,
          filename,
          folder,
          finalMimeType
        );

        if (!imagekitResult) {
          return this.createErrorResult("Failed to upload to ImageKit");
        }
      }

      // Save metadata
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: finalMediaType as any,
        mediaUrl: "",
        mimeType: finalMimeType,
        imagekitUrl: imagekitResult?.url || null,
        imagekitFileId: imagekitResult?.fileId || null,
        width: imagekitResult?.width,
        height: imagekitResult?.height,
      });

      console.log(`✅ Downloaded: ${filename} (${this.formatBytes(fileSize)})`);

      return {
        success: true,
        mediaId,
        mediaType: finalMediaType,
        mediaSize: fileSize,
        imagekitUrl: imagekitResult?.url,
        imagekitFileId: imagekitResult?.fileId,
      };
    } catch (error: any) {
      console.error(`❌ Telegram download failed: ${error.message}`);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Download from custom adapter
   */
  async downloadWithAdapter(
    source: any,
    adapter: IMediaSourceAdapter,
    options: MediaDownloadOptions
  ): Promise<MediaDownloadResult> {
    try {
      console.log(`📥 Downloading with custom adapter...`);

      const shouldUploadToImageKit = options.uploadToImageKit !== false;

      // Use adapter to download
      let buffer = await adapter.downloadMedia(source, options);
      let mediaType = adapter.getMediaType(source);
      let mimeType = adapter.getMimeType(source);

      // Convert WebP to JPEG if needed
      if (mimeType === "image/webp") {
        console.log(`🔄 Converting WebP to JPEG...`);
        buffer = await this.convertWebPToJPEG(buffer);
        mimeType = "image/jpeg";
        mediaType = "IMAGE";
      }

      // Generate filename
      const extension = this.getExtensionFromMime(mimeType) || "bin";
      const filename = this.generateFilename(
        options.articleId,
        options.sourceName,
        extension
      );

      // Upload to ImageKit
      let imagekitResult: ImageKitUploadResult | null = null;
      if (shouldUploadToImageKit) {
        const folder = `news-radar/${options.sourceType}/${this.getSubdirectory(
          mediaType
        )}`;
        imagekitResult = await this.uploadToImageKit(
          buffer,
          filename,
          folder,
          mimeType
        );

        if (!imagekitResult) {
          return this.createErrorResult("Failed to upload to ImageKit");
        }
      }

      // Save metadata
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: mediaType as any,
        mediaUrl: "",
        mimeType,
        imagekitUrl: imagekitResult?.url || null,
        imagekitFileId: imagekitResult?.fileId || null,
        width: imagekitResult?.width,
        height: imagekitResult?.height,
      });

      console.log(
        `✅ Downloaded: ${filename} (${this.formatBytes(buffer.length)})`
      );

      return {
        success: true,
        mediaId,
        mediaType,
        mediaSize: buffer.length,
        imagekitUrl: imagekitResult?.url,
        imagekitFileId: imagekitResult?.fileId,
      };
    } catch (error: any) {
      console.error(`❌ Adapter download failed: ${error.message}`);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Save media URL reference without downloading
   */
  async saveUrlReference(
    url: string,
    options: MediaDownloadOptions,
    mediaType: string = "IMAGE"
  ): Promise<number> {
    try {
      const mediaId = await this.saveMediaMetadata({
        radarId: options.articleId,
        mediaType: mediaType as any,
        mediaUrl: url,
        mimeType: null,
        imagekitUrl: null,
        imagekitFileId: null,
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
      `SELECT * FROM ltng_news_radar_media WHERE radar_id = ? AND is_deleted = 0 ORDER BY created_at ASC`,
      [articleId]
    );

    return rows.map((row: any) => this.mapRowToMediaInfo(row));
  }

  /**
   * Get media by ID
   */
  async getMediaById(mediaId: number): Promise<MediaInfo | null> {
    const [rows]: any = await pool.query(
      `SELECT * FROM ltng_news_media WHERE media_id = ?`,
      [mediaId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToMediaInfo(rows[0]);
  }

  /**
   * Delete media (database record + ImageKit)
   */
  async deleteMedia(mediaId: number): Promise<boolean> {
    try {
      const [media]: any = await pool.query(
        `SELECT imagekit_file_id FROM ltng_news_media WHERE media_id = ?`,
        [mediaId]
      );

      if (media.length === 0) return false;

      // Delete from ImageKit if exists
      if (media[0].imagekit_file_id) {
        await this.deleteFromImageKit(media[0].imagekit_file_id);
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
        `SELECT media_id FROM ltng_news_media WHERE created_at < ?`,
        [cutoffDate]
      );

      let deletedCount = 0;

      for (const media of oldMedia) {
        const deleted = await this.deleteMedia(media.media_id);
        if (deleted) deletedCount++;
      }

      console.log(`🗑️ Cleaned up ${deletedCount} old media files`);
      return deletedCount;
    } catch (error: any) {
      console.error(`❌ Cleanup failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get public URL for media (ImageKit or original URL)
   */
  getPublicUrl(mediaInfo: MediaInfo | string): string {
    if (typeof mediaInfo === "string") {
      return mediaInfo;
    }

    // Return ImageKit URL if available
    if (mediaInfo.imagekitUrl) {
      return mediaInfo.imagekitUrl;
    }

    // Fallback to original URL
    return mediaInfo.mediaUrl || "";
  }

  /**
   * Convert WebP image to JPEG
   */
  private async convertWebPToJPEG(buffer: Buffer): Promise<Buffer> {
    try {
      const result = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
      return Buffer.from(result);
    } catch (error: any) {
      console.error(`❌ WebP conversion failed: ${error.message}`);
      throw error;
    }
  }

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

  private async detectMimeType(buffer: Buffer, url?: string): Promise<string> {
    const signature = buffer.subarray(0, 12).toString("hex");

    console.log("signature: ", signature);

    if (signature.startsWith("ffd8ff")) return "image/jpeg";
    if (signature.startsWith("89504e47")) return "image/png";
    if (signature.startsWith("47494638")) return "image/gif";
    if (signature.startsWith("52494646") && signature.includes("57454250"))
      return "image/webp";
    if (signature.startsWith("000000")) return "video/mp4";

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

  private async saveMediaMetadata(data: {
    radarId: number;
    mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "EMBED" | "OTHER";
    mediaUrl: string;
    mimeType: string | null;
    imagekitUrl: string | null;
    imagekitFileId: string | null;
    width?: number;
    height?: number;
    duration?: number;
  }): Promise<number> {
    const [result]: any = await pool.query(
      `INSERT INTO ltng_news_media (
        media_radar_id,
        media_type,
        media_url,
        media_mime_type,
        media_width,
        media_height,
        media_duration,
        imagekit_url,
        imagekit_file_id,
        is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        data.radarId,
        data.mediaType,
        data.mediaUrl,
        data.mimeType,
        data.width || null,
        data.height || null,
        data.duration || null,
        data.imagekitUrl,
        data.imagekitFileId,
      ]
    );

    return result.insertId;
  }

  private getMediaTypeFromMime(
    mimeType: string
  ): "IMAGE" | "VIDEO" | "AUDIO" | "EMBED" | "OTHER" {
    if (mimeType.startsWith("image/")) return "IMAGE";
    if (mimeType.startsWith("video/")) return "VIDEO";
    if (mimeType.startsWith("audio/")) return "AUDIO";
    return "OTHER";
  }

  private getTelegramMediaType(
    media: any
  ): "IMAGE" | "VIDEO" | "AUDIO" | "EMBED" | "OTHER" {
    if (media.photo) return "IMAGE";
    if (media.document) {
      const mimeType = media.document.mimeType || "";
      if (mimeType.startsWith("video/")) return "VIDEO";
      if (mimeType.startsWith("audio/")) return "AUDIO";
    }
    return "OTHER";
  }

  private getTelegramMimeType(media: any): string {
    if (media.photo) return "image/jpeg";
    if (media.document) {
      return media.document.mimeType || "application/octet-stream";
    }
    return "application/octet-stream";
  }

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

  private getSubdirectory(mediaType: string): string {
    const dirMap: { [key: string]: string } = {
      IMAGE: "images",
      VIDEO: "videos",
      AUDIO: "audio",
      EMBED: "embeds",
      OTHER: "documents",
    };

    return dirMap[mediaType] || "documents";
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  private createErrorResult(error: string): MediaDownloadResult {
    return {
      success: false,
      error,
    };
  }

  private mapRowToMediaInfo(row: any): MediaInfo {
    return {
      mediaId: row.media_id,
      radarId: row.media_radar_id,
      mediaType: row.media_type,
      mediaUrl: row.media_url,
      mediaCaption: row.media_caption,
      mediaAltText: row.media_alt_text,
      mediaCredit: row.media_credit,
      mimeType: row.media_mime_type,
      width: row.media_width,
      height: row.media_height,
      duration: row.media_duration,
      imagekitUrl: row.imagekit_url,
      imagekitFileId: row.imagekit_file_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted === 1,
    };
  }
}

export default new MediaService();
