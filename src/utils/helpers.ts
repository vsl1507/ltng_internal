// src/utils/helpers.ts

export function normalizeChannelUsername(username: string): string {
  if (username.includes("t.me/")) {
    const match = username.match(/t\.me\/([^\/?\s]+)/);
    if (match) {
      username = match[1];
    }
  }

  if (!username.startsWith("@")) {
    username = "@" + username;
  }

  return username;
}

export function generateFileName(
  messageId: number,
  mediaType: string,
  mimeType?: string,
  originalName?: string
): string {
  if (originalName && originalName.trim() !== "") {
    return originalName;
  }

  const timestamp = Date.now();

  if (mediaType === "photo") {
    return `photo_${messageId}_${timestamp}.jpg`;
  }

  if (mimeType) {
    const ext = mimeType.split("/")[1] || "bin";
    return `file_${messageId}_${timestamp}.${ext}`;
  }

  return `media_${messageId}_${timestamp}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");
}
