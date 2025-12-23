import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export const telegramConfig = {
  apiId: parseInt(process.env.TLG_API_ID || ""),
  apiHash: process.env.TLG_API_HASH || "",
  stringSession: new StringSession(process.env.TLG_SESSION || ""),
  phone: process.env.TLG_PHONE || "",
  password: process.env.TLG_PASSWORD || "",
};

let client: TelegramClient;

export async function initTelegram() {
  client = new TelegramClient(
    telegramConfig.stringSession,
    telegramConfig.apiId,
    telegramConfig.apiHash,
    {
      connectionRetries: 5,
    }
  );

  try {
    await client.start({
      phoneNumber: async () => telegramConfig.phone,
      password: async () => telegramConfig.password,
      phoneCode: async () => {
        const readline = require("readline").createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        return new Promise((resolve) => {
          readline.question(
            "Enter the code from Telegram: ",
            (code: string) => {
              readline.close();
              resolve(code);
            }
          );
        });
      },
      onError: (err) => console.error(err),
    });

    console.log("\n✅ Telegram client initialized successfully!");
  } catch (error: any) {
    if (error.errorMessage === "FLOOD") {
      console.error(
        `\n❌ Too many login attempts. Wait ${
          error.seconds
        } seconds (${Math.ceil(
          error.seconds / 60
        )} minutes) before trying again.\n`
      );
    }
    throw error;
  }
}

export function getTelegramClient(): TelegramClient {
  if (!client) {
    throw new Error("Telegram client not initialized");
  }
  return client;
}
