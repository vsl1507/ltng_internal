// services/media.service.ts
import pool from "../config/mysql.config";
import { getTelegramClient } from "../config/telegram.config";
import * as fs from "fs";
import * as path from "path";

export enum MediaType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  AUDIO = "AUDIO",
  EMBED = "EMBED",
  OTHER = "OTHER",
}

export interface MediaInfo {
  mediaId?: number;
  mediaUrl: string;
  mediaType: MediaType;
  mediaCaption?: string;
  mediaAltText?: string;
  mediaCredit?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDuration?: number;
  mediaMimeType?: string;
  createdBy?: number;
}

export class MediaService {
  private readonly MEDIA_DIR: string;
  private readonly BASE_URL: string;

  constructor() {
    this.MEDIA_DIR = path.join(__dirname, "../../media");
    this.BASE_URL = process.env.MEDIA_BASE_URL || "http://localhost:3000/media";

    // Ensure media directory exists
    if (!fs.existsSync(this.MEDIA_DIR)) {
      fs.mkdirSync(this.MEDIA_DIR, { recursive: true });
    }
  }

  /**
   * Download media from Telegram message and save to database
   */
  async downloadMessageMedia(
    message: any,
    newsId: number,
    channelUsername: string,
    createdBy?: number
  ): Promise<number | null> {
    if (!message.media) return null;

    try {
      const media = message.media;

      // Skip web page previews
      if (media.className === "MessageMediaWebPage") {
        console.log("Skipping web page preview");
        return null;
      }

      const mediaInfo = this.extractMediaInfo(message);
      if (!mediaInfo) {
        console.log("Unsupported media type:", media.className);
        return null;
      }

      // Create channel-specific directory
      const channelDir = path.join(
        this.MEDIA_DIR,
        channelUsername.replace("@", "")
      );
      if (!fs.existsSync(channelDir)) {
        fs.mkdirSync(channelDir, { recursive: true });
      }

      // Generate filename
      const fileName = this.generateFileName(message, mediaInfo);
      const filePath = path.join(channelDir, fileName);
      const relativeFilePath = path.join(
        channelUsername.replace("@", ""),
        fileName
      );

      // Download the media
      console.log(`Downloading ${mediaInfo.mediaType}: ${fileName}...`);

      const client = getTelegramClient();
      const writeStream = fs.createWriteStream(filePath);

      for await (const chunk of client.iterDownload({
        file: message.media,
        requestSize: 512 * 1024, // 512KB chunks
      })) {
        writeStream.write(Buffer.from(chunk));
      }

      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", () => resolve());
        writeStream.on("error", reject);
      });

      console.log(`✓ Downloaded: ${fileName}`);

      // Save to database with full URL
      const mediaUrl = `${this.BASE_URL}/${relativeFilePath.replace(
        /\\/g,
        "/"
      )}`;
      mediaInfo.mediaUrl = mediaUrl;
      mediaInfo.createdBy = createdBy;

      const mediaId = await this.saveMedia(mediaInfo);

      // Link media to news
      await this.linkMediaToNews(mediaId, newsId);

      return mediaId;
    } catch (error) {
      console.error("Error downloading media:", error);
      return null;
    }
  }

  /**
   * Save media info without downloading (e.g., for external URLs)
   */
  async saveMediaInfo(
    message: any,
    newsId: number,
    createdBy?: number
  ): Promise<number | null> {
    if (!message.media) return null;

    try {
      const mediaInfo = this.extractMediaInfo(message);
      if (!mediaInfo) return null;

      // For media we don't download, create a placeholder URL or Telegram file ID
      mediaInfo.mediaUrl = `telegram://media/${message.id}`;
      mediaInfo.createdBy = createdBy;

      const mediaId = await this.saveMedia(mediaInfo);
      await this.linkMediaToNews(mediaId, newsId);

      return mediaId;
    } catch (error) {
      console.error("Error saving media info:", error);
      return null;
    }
  }

  /**
   * Save media to ltng_news_media table
   */
  async saveMedia(mediaInfo: MediaInfo): Promise<number> {
    const [result] = (await pool.query(
      `INSERT INTO ltng_news_media (
        media_url, 
        media_type, 
        media_caption, 
        media_alt_text,
        media_credit,
        media_width, 
        media_height, 
        media_duration,
        media_mime_type,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mediaInfo.mediaUrl,
        mediaInfo.mediaType,
        mediaInfo.mediaCaption || null,
        mediaInfo.mediaAltText || null,
        mediaInfo.mediaCredit || null,
        mediaInfo.mediaWidth || null,
        mediaInfo.mediaHeight || null,
        mediaInfo.mediaDuration || null,
        mediaInfo.mediaMimeType || null,
        mediaInfo.createdBy || null,
      ]
    )) as any;

    return result.insertId;
  }

  /**
   * Link media to news article (assuming you have a junction table)
   */
  async linkMediaToNews(mediaId: number, newsId: number): Promise<void> {
    // If you have a junction table like ltng_news_media_junction
    try {
      await pool.query(
        `INSERT INTO ltng_news_media_junction (news_id, media_id) 
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE news_id = news_id`,
        [newsId, mediaId]
      );
    } catch (error) {
      // If junction table doesn't exist, you might store media_id in news table
      // or handle differently
      console.log("Note: No junction table found, skipping link");
    }
  }

  /**
   * Get all media for a news article
   */
  async getMediaByNewsId(newsId: number): Promise<MediaInfo[]> {
    try {
      const [rows] = (await pool.query(
        `SELECT m.* 
         FROM ltng_news_media m
         JOIN ltng_news_media_junction j ON m.media_id = j.media_id
         WHERE j.news_id = ? AND m.is_deleted = FALSE
         ORDER BY m.created_at ASC`,
        [newsId]
      )) as any;

      return rows.map((row: any) => this.mapRowToMediaInfo(row));
    } catch (error) {
      console.error("Error fetching media:", error);
      return [];
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(mediaId: number): Promise<MediaInfo | null> {
    const [rows] = (await pool.query(
      `SELECT * FROM ltng_news_media WHERE media_id = ? AND is_deleted = FALSE`,
      [mediaId]
    )) as any;

    if (rows.length === 0) return null;

    return this.mapRowToMediaInfo(rows[0]);
  }

  /**
   * Update media
   */
  async updateMedia(
    mediaId: number,
    updates: Partial<MediaInfo>,
    updatedBy?: number
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.mediaCaption !== undefined) {
      fields.push("media_caption = ?");
      values.push(updates.mediaCaption);
    }
    if (updates.mediaAltText !== undefined) {
      fields.push("media_alt_text = ?");
      values.push(updates.mediaAltText);
    }
    if (updates.mediaCredit !== undefined) {
      fields.push("media_credit = ?");
      values.push(updates.mediaCredit);
    }
    if (updatedBy !== undefined) {
      fields.push("updated_by = ?");
      values.push(updatedBy);
    }

    if (fields.length === 0) return false;

    values.push(mediaId);

    await pool.query(
      `UPDATE ltng_news_media 
       SET ${fields.join(", ")}, updated_at = NOW() 
       WHERE media_id = ?`,
      values
    );

    return true;
  }

  /**
   * Soft delete media
   */
  async deleteMedia(mediaId: number, deletedBy?: number): Promise<boolean> {
    await pool.query(
      `UPDATE ltng_news_media 
       SET is_deleted = TRUE, updated_by = ?, updated_at = NOW() 
       WHERE media_id = ?`,
      [deletedBy || null, mediaId]
    );

    return true;
  }

  /**
   * Extract media information from Telegram message
   */
  private extractMediaInfo(message: any): MediaInfo | null {
    const media = message.media;

    if (!media) return null;

    const mediaInfo: MediaInfo = {
      mediaUrl: "", // Will be set later
      mediaType: MediaType.OTHER,
      mediaCaption: message.message || null,
    };

    // Handle photos
    if (media.photo) {
      mediaInfo.mediaType = MediaType.IMAGE;
      mediaInfo.mediaMimeType = "image/jpeg";

      // Get largest photo size
      const sizes = media.photo.sizes || [];
      const largestSize = sizes[sizes.length - 1];
      if (largestSize) {
        mediaInfo.mediaWidth = largestSize.w;
        mediaInfo.mediaHeight = largestSize.h;
      }
    }
    // Handle documents (videos, audio, files)
    else if (media.document) {
      const doc = media.document;
      mediaInfo.mediaMimeType = doc.mimeType || "application/octet-stream";

      // Check for video
      const videoAttr = doc.attributes?.find(
        (a: any) => a.className === "DocumentAttributeVideo"
      );
      if (videoAttr) {
        mediaInfo.mediaType = MediaType.VIDEO;
        mediaInfo.mediaWidth = videoAttr.w;
        mediaInfo.mediaHeight = videoAttr.h;
        mediaInfo.mediaDuration = videoAttr.duration;
      }
      // Check for audio
      else if (doc.mimeType?.startsWith("audio/")) {
        mediaInfo.mediaType = MediaType.AUDIO;
        const audioAttr = doc.attributes?.find(
          (a: any) => a.className === "DocumentAttributeAudio"
        );
        if (audioAttr) {
          mediaInfo.mediaDuration = audioAttr.duration;
        }
      }
      // Other document types
      else {
        mediaInfo.mediaType = MediaType.OTHER;
      }
    }
    // Handle other media types
    else {
      return null;
    }

    return mediaInfo;
  }

  /**
   * Generate filename for media
   */
  private generateFileName(message: any, mediaInfo: MediaInfo): string {
    const timestamp = Date.now();
    const messageId = message.id;

    let extension = "bin";

    // Determine extension from MIME type
    if (mediaInfo.mediaMimeType) {
      const mimeMap: { [key: string]: string } = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "video/quicktime": "mov",
        "video/x-matroska": "mkv",
        "audio/mpeg": "mp3",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
      };

      extension = mimeMap[mediaInfo.mediaMimeType] || extension;
    }

    // Check if document has a filename
    if (message.media?.document?.attributes) {
      const fileAttr = message.media.document.attributes.find(
        (a: any) => a.fileName
      );
      if (fileAttr?.fileName) {
        return fileAttr.fileName;
      }
    }

    return `${mediaInfo.mediaType.toLowerCase()}_${messageId}_${timestamp}.${extension}`;
  }

  /**
   * Map database row to MediaInfo
   */
  private mapRowToMediaInfo(row: any): MediaInfo {
    return {
      mediaId: row.media_id,
      mediaUrl: row.media_url,
      mediaType: row.media_type as MediaType,
      mediaCaption: row.media_caption,
      mediaAltText: row.media_alt_text,
      mediaCredit: row.media_credit,
      mediaWidth: row.media_width,
      mediaHeight: row.media_height,
      mediaDuration: row.media_duration,
      mediaMimeType: row.media_mime_type,
      createdBy: row.created_by,
    };
  }

  /**
   * Get media type from MIME type
   */
  getMediaTypeFromMime(mimeType: string): MediaType {
    if (mimeType.startsWith("image/")) return MediaType.IMAGE;
    if (mimeType.startsWith("video/")) return MediaType.VIDEO;
    if (mimeType.startsWith("audio/")) return MediaType.AUDIO;
    return MediaType.OTHER;
  }

  /**
   * Clean up old media files (optional utility)
   */
  async cleanupOldMedia(daysOld: number = 30): Promise<number> {
    const [rows] = (await pool.query(
      `SELECT media_id, media_url 
       FROM ltng_news_media 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       AND is_deleted = TRUE`,
      [daysOld]
    )) as any;

    let deletedCount = 0;

    for (const row of rows) {
      try {
        // Extract file path from URL
        const urlPath = row.media_url.replace(this.BASE_URL, "");
        const filePath = path.join(this.MEDIA_DIR, urlPath);

        // Delete file if it exists
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }

        // Delete database record
        await pool.query("DELETE FROM ltng_news_media WHERE media_id = ?", [
          row.media_id,
        ]);
      } catch (error) {
        console.error(`Failed to delete media ${row.media_id}:`, error);
      }
    }

    return deletedCount;
  }
}

export const mediaService = new MediaService();
