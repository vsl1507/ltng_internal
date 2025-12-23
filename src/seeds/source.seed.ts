import pool from "../config/mysql.config";

export const seedSources = async () => {
  const sources = [
    {
      source_type_slug: "telegram-channel",
      source_name: "Channel News Test",
      source_identifier: "https://t.me/channel_news_test",
      source_country: "KH",
      source_config: {
        platform: "telegram",

        telegram: {
          type: "channel",
          username: "@channel_news_test",
          id: null,
        },

        fetch: {
          method: "bot",
          poll_interval_seconds: 60,
          fetch_limit: 50,
          include_forwards: false,
          include_replies: false,
        },

        content: {
          use_caption_if_media: true,
          strip_urls: false,
          strip_emojis: false,
          min_text_length: 50,
        },

        media: {
          include: true,
          download: false,
          allowed_types: ["photo", "video"],
          max_media_per_message: 5,
        },

        deduplication: {
          strategy: "message_id",
          hash_fields: ["text"],
        },

        language: "km",
        timezone: "Asia/Phnom_Penh",

        state: {
          last_message_id: null,
          last_fetched_at: null,
        },
      },
    },
    {
      source_type_slug: "telegram-channel",
      source_name: "Channel News Test",
      source_identifier: "https://t.me/group_news_test",
      source_country: "KH",
      source_config: {
        platform: "telegram",

        telegram: {
          type: "group",
          username: "@group_news_test",
          id: null,
        },

        fetch: {
          method: "bot",
          poll_interval_seconds: 60,
          fetch_limit: 50,
          include_forwards: false,
          include_replies: false,
        },

        content: {
          use_caption_if_media: true,
          strip_urls: false,
          strip_emojis: false,
          min_text_length: 50,
        },

        media: {
          include: true,
          download: false,
          allowed_types: ["photo", "video"],
          max_media_per_message: 5,
        },

        deduplication: {
          strategy: "message_id",
          hash_fields: ["text"],
        },

        language: "km",
        timezone: "Asia/Phnom_Penh",

        state: {
          last_message_id: null,
          last_fetched_at: null,
        },
      },
    },
  ];

  for (const s of sources) {
    await pool.execute(
      `
      INSERT INTO ltng_news_sources
      (
        source_type_id,
        source_name,
        source_identifier,
        source_config,
        source_country
      )
      VALUES
      (
        (SELECT source_type_id
         FROM ltng_news_source_types
         WHERE source_type_slug = ?),
        ?, ?, CAST(? AS JSON), ?
      )
      ON DUPLICATE KEY UPDATE
        source_name = VALUES(source_name),
        source_config = VALUES(source_config),
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        s.source_type_slug,
        s.source_name,
        s.source_identifier,
        JSON.stringify(s.source_config),
        s.source_country,
      ]
    );
  }

  console.log("✅ Telegram sources seeded");
};
