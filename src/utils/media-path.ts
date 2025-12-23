import * as path from "path";
import * as fs from "fs";

export const MEDIA_DIR = path.join(__dirname, "../media");

export function ensureMediaDirExists() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

export function getChannelDir(channelUsername: string): string {
  return path.join(MEDIA_DIR, channelUsername.replace("@", ""));
}

export function ensureChannelDirExists(channelUsername: string) {
  const channelDir = getChannelDir(channelUsername);
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }
}
