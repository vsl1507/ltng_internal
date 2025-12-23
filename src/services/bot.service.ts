import bot from "../config/bot.config";

export class BotService {
  async sendMessage(chatId: string | number, text: string): Promise<number> {
    try {
      const message = await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
      });

      console.log(
        `✅ Message sent to ${chatId} (message_id: ${message.message_id})`
      );
      return message.message_id;
    } catch (error) {
      console.error(`❌ Error sending message to ${chatId}:`, error);
      throw error;
    }
  }

  async editMessage(
    chatId: string,
    messageId: number,
    text: string
  ): Promise<void> {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
      });

      console.log(`✅ Message ${messageId} edited in ${chatId}`);
    } catch (error) {
      console.error(`❌ Error editing message ${messageId}:`, error);
      throw error;
    }
  }

  async deleteMessage(chatId: string, messageId: number): Promise<void> {
    try {
      await bot.deleteMessage(chatId, messageId);

      console.log(`✅ Message ${messageId} deleted from ${chatId}`);
    } catch (error) {
      console.error(`❌ Error deleting message ${messageId}:`, error);
      throw error;
    }
  }
}
