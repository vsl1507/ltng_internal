//Run only once time to get session
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID || "");
const apiHash = process.env.TELEGRAM_API_HASH || "";
const stringSession = new StringSession("");

async function authenticate() {
  console.log("\n🔐 Telegram Authentication Setup\n");
  console.log("This script will generate a session string for your .env file");
  console.log("You only need to run this ONCE!\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  try {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => {
        const phone =
          process.env.TELEGRAM_PHONE ||
          (await question(
            "Enter your phone number (with country code, e.g., +855...): "
          ));
        return phone;
      },
      password: async () => {
        const pass = await question(
          "Enter your 2FA password (if you have one, otherwise press Enter): "
        );
        return pass;
      },
      phoneCode: async () => {
        const code = await question(
          "\n📱 Enter the code you received in Telegram: "
        );
        return code;
      },
      onError: (err: any) => {
        if (err.errorMessage === "FLOOD") {
          console.error(
            `\n❌ Rate limited! Wait ${err.seconds} seconds (${Math.ceil(
              err.seconds / 60
            )} minutes)\n`
          );
          process.exit(1);
        }
        console.error("Error:", err);
      },
    });

    console.log("\n✅ Authentication successful!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Copy this session string to your .env file:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("TELEGRAM_SESSION=" + client.session.save());
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("After adding this to your .env, you can run: npm run dev");
    console.log("You will NOT need to authenticate again!\n");

    await client.disconnect();
    rl.close();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Authentication failed:", error.message);

    if (error.code === 420 || error.errorMessage === "FLOOD") {
      console.log(
        `\nYou need to wait ${error.seconds} seconds before trying again.`
      );
      console.log(
        `That's approximately ${Math.ceil(error.seconds / 60)} minutes.\n`
      );
    }

    rl.close();
    process.exit(1);
  }
}

authenticate();
