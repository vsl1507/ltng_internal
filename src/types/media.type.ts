export interface MediaDownloadOptions {
  articleId: number;
  sourceName: string;
  sourceType: "telegram" | "website" | "rss" | "api" | "other";
  storyNumber?: number;
  maxRetries?: number;
  timeout?: number;
  uploadToImageKit?: boolean;
}

export interface MediaDownloadResult {
  success: boolean;
  mediaId?: number;
  mediaType?: string;
  mediaSize?: number;
  imagekitUrl?: string;
  imagekitFileId?: string;
  error?: string;
}

export interface MediaInfo {
  mediaId?: number;
  radarId: number;
  mediaType: "IMAGE" | "VIDEO" | "AUDIO" | "EMBED" | "OTHER";
  mediaUrl?: string;
  mediaCaption?: string;
  mediaAltText?: string;
  mediaCredit?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  imagekitUrl?: string;
  imagekitFileId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
}

export interface IMediaSourceAdapter {
  downloadMedia(source: any, options: MediaDownloadOptions): Promise<Buffer>;
  getMediaType(source: any): string;
  getMimeType(source: any): string;
}

export interface ImageKitUploadResult {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}
