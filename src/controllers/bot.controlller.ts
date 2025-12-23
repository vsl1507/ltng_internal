import bot from "../config/bot.config";
import telegramService from "../services/telegram.service";

export const registerTelegramStartHandler = () => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const chatTitle = msg.chat.title || "Private Chat";

    console.log(
      `📍 Chat Info: ID=${chatId}, Type=${chatType}, Title=${chatTitle}`
    );

    await bot.sendMessage(chatId, "✅ Telegram bot connected");
  });

  bot.on("channel_post", (msg) => {
    console.log("Channel ID:", msg.chat.id);
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "✅ Bot is running and monitoring for new posts!");
  });

  bot.onText(/\/getid/, (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const chatTitle = msg.chat.title || "Private Chat";

    bot.sendMessage(
      chatId,
      `📌 *Chat Information:*\n\n` +
        `ID: \`${chatId}\`\n` +
        `Type: ${chatType}\n` +
        `Name: ${chatTitle}\n\n` +
        `Copy this ID and use it in your database!`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("my_chat_member", async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const chatTitle = msg.chat.title || "Unknown";
    const chatUsername = msg.chat.username;
    const status = msg.new_chat_member.status;

    if (status === "administrator" || status === "member") {
      console.log(
        `✅ Bot added to: ${chatTitle} (ID: ${chatId}, Type: ${chatType})`
      );
      function mapTelegramType(type: string): "CHANNEL" | "GROUP" | "PRIVATE" {
        switch (type) {
          case "channel":
            return "CHANNEL";
          case "group":
          case "supergroup":
            return "GROUP";
          case "private":
            return "PRIVATE";
          default:
            return "GROUP";
        }
      }

      try {
        // Map Telegram chat type to your enum
        const mappedType = mapTelegramType(chatType);

        await telegramService.createTelegram({
          telegram_name: chatTitle,
          telegram_username: chatUsername,
          telegram_chat_id: chatId.toString(), // Convert to string
          telegram_type: mappedType,
        });
      } catch (error) {
        console.error("Failed to save channel to database:", error);
      }

      // Try to send welcome message
      bot
        .sendMessage(
          chatId,
          `✅ Bot successfully added!\n\n` +
            `📌 *Channel/Group ID:* \`${chatId}\`\n` +
            `📌 *Name:* ${chatTitle}\n\n` +
            `Use this ID in your database to auto-post messages here.`,
          { parse_mode: "Markdown" }
        )
        .catch((err) => {
          console.log(
            `⚠️ Added to ${chatTitle} but can't send message (needs admin permission)`
          );
        });
    }
  });

  bot.on("message", (msg) => {
    if (
      msg.chat.type === "group" ||
      msg.chat.type === "supergroup" ||
      msg.chat.type === "channel"
    ) {
      console.log(`📨 Message in: ${msg.chat.title} (ID: ${msg.chat.id})`);
    }
  });
};
