import TelegramBot from "node-telegram-bot-api";

const BOT_TOKEN = process.env.TLG_BOT_TOKEN;

const bot = new TelegramBot(BOT_TOKEN!, { polling: true });

export default bot;
