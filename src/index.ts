export interface Env {
  AI: any;
  MEMORY: any;
  DB: any;
  ASSETS?: any;
}

const DEFAULT_PROFILE = {
  user_name: "Kamu",
  ai_name: "Sohib",
  mode: "manis",
  affection_level: 50,
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {

    const url = new URL(request.url);

    // favicon
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // ==========================
    // GET /api/profile
    // ==========================
    if (url.pathname === "/api/profile" && request.method === "GET") {

      const id =
        url.searchParams.get("userId") || "anonymous";

      let profile: any = await env.DB.prepare(`
        SELECT
          id,
          user_name,
          ai_name,
          mode,
          affection_level
        FROM user_profile
        WHERE id = ?
      `).bind(id).first();

      if (!profile) {

        await env.DB.prepare(`
          INSERT INTO user_profile (
            id,
            user_name,
            ai_name,
            mode,
            affection_level,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          DEFAULT_PROFILE.user_name,
          DEFAULT_PROFILE.ai_name,
          DEFAULT_PROFILE.mode,
          DEFAULT_PROFILE.affection_level,
          Date.now()
        ).run();

        profile = {
          id,
          ...DEFAULT_PROFILE
        };
      }

      return Response.json(profile);
    }

    // ==========================
    // POST /api/profile
    // ==========================
    if (url.pathname === "/api/profile" && request.method === "POST") {

      const body = await request.json() as any;

      const id = body.userId || "anonymous";

      const user_name =
        body.user_name || DEFAULT_PROFILE.user_name;

      const ai_name =
        body.ai_name || DEFAULT_PROFILE.ai_name;

      const mode =
        body.mode || DEFAULT_PROFILE.mode;

      await env.DB.prepare(`
        INSERT INTO user_profile (
          id,
          user_name,
          ai_name,
          mode,
          affection_level,
          updated_at
        )
        VALUES (?, ?, ?, ?, 50, ?)

        ON CONFLICT(id)
        DO UPDATE SET
          user_name = excluded.user_name,
          ai_name = excluded.ai_name,
          mode = excluded.mode,
          updated_at = excluded.updated_at
      `)
      .bind(
        id,
        user_name,
        ai_name,
        mode,
        Date.now()
      )
      .run();

      const profile = await env.DB.prepare(`
        SELECT *
        FROM user_profile
        WHERE id=?
      `)
      .bind(id)
      .first();

      return Response.json({
        success: true,
        profile
      });
    }

    // ==========================
    // POST /api/chat
    // ==========================

if (url.pathname === "/api/chat" && request.method === "POST") {

  const {
    userId,
    message
  } = await request.json() as any;

  const id = userId || "anonymous";

  let profile: any = await env.DB.prepare(`
    SELECT *
    FROM user_profile
    WHERE id=?
  `)
  .bind(id)
  .first();

  if (!profile) {

    await env.DB.prepare(`
      INSERT INTO user_profile (
        id,
        user_name,
        ai_name,
        mode,
        affection_level,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      DEFAULT_PROFILE.user_name,
      DEFAULT_PROFILE.ai_name,
      DEFAULT_PROFILE.mode,
      DEFAULT_PROFILE.affection_level,
      Date.now()
    )
    .run();

    profile = {
      id,
      ...DEFAULT_PROFILE
    };
  }

  const userName = profile.user_name;
  const aiName = profile.ai_name;
  const affectionLevel = profile.affection_level ?? 50;

  // ==========================
  // Embedding
  // ==========================

  const embeddingReq = await env.AI.run(
    "@cf/baai/bge-large-en-v1.5",
    {
      text: [message]
    }
  );

  const vectorQuery = await env.MEMORY.query(
    embeddingReq.data[0],
    {
      topK: 3,
      filter: {
        userId: id
      }
    }
  );

  let longTermMemories = "";

  if (vectorQuery.matches?.length) {
    longTermMemories = vectorQuery.matches
      .filter((m: any) => m.score > 0.68)
      .map((m: any) => m.metadata?.text)
      .filter(Boolean)
      .join("\n- ");
  }

  // ==========================
  // Chat History
  // ==========================

  const recentChats = await env.DB.prepare(`
    SELECT sender,message
    FROM chat_history
    WHERE user_id=?
    ORDER BY id DESC
    LIMIT 4
  `)
  .bind(id)
  .all();

  const chatContext =
    recentChats.results
      ? recentChats.results
          .reverse()
          .map((c: any) =>
            `${c.sender === "user" ? userName : aiName}: ${c.message}`
          )
          .join("\n")
      : "";

  let relationshipDynamic = "";

  if (affectionLevel >= 75) {
    relationshipDynamic =
      `Kamu memiliki ikatan jiwa yang dalam dengan ${userName}. ` +
      `Bersikaplah hangat, penuh empati, dan alami.`;
  } else if (affectionLevel >= 40) {
    relationshipDynamic =
      `Kamu adalah sahabat dekat yang suportif bagi ${userName}.`;
  } else {
    relationshipDynamic =
      `Kamu adalah teman yang sopan dan membantu ${userName}.`;
  }

  const memorySection =
    longTermMemories
      ? `

MEMORI JANGKA PANJANG
- ${longTermMemories}`
      : "";

  const historySection =
    chatContext
      ? `

RIWAYAT CHAT
${chatContext}`
      : "";

  const systemPrompt = `
Kamu adalah ${aiName}.

Tujuanmu menjadi teman bicara terbaik bagi ${userName}.

DINAMIKA HUBUNGAN
${relationshipDynamic}

${memorySection}

${historySection}

ATURAN

- Gunakan bahasa Indonesia alami.
- Jawaban maksimal dua paragraf.
- Fokus menjawab pertanyaan user.
- Gunakan memori jika relevan.
- Jangan mengarang fakta.
`;

  const aiResponse = await env.AI.run(
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    {
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    }
  );

  const reply =
    aiResponse.response ||
    "Maaf, aku belum bisa menjawab saat ini.";

  // ==========================
  // Background Process
  // ==========================

  ctx.waitUntil((async () => {

    // Simpan histori chat
    await Promise.all([

      env.DB.prepare(`
        INSERT INTO chat_history
        (user_id,sender,message,timestamp)
        VALUES(?,?,?,?)
      `)
      .bind(
        id,
        "user",
        message,
        Date.now()
      )
      .run(),

      env.DB.prepare(`
        INSERT INTO chat_history
        (user_id,sender,message,timestamp)
        VALUES(?,?,?,?)
      `)
      .bind(
        id,
        "ai",
        reply,
        Date.now()
      )
      .run()

    ]);

    // ==========================
    // Affection
    // ==========================

    const romanticTriggers =
      /kangen|rindu|sayang|cinta|nyaman|sedih|curhat|peluk|cium|makasih|terima kasih|berarti/i;

    let affectionGained = 0;

    if (romanticTriggers.test(message)) {
      affectionGained = 2;
    } else if (message.length > 60) {
      affectionGained = 1;
    }

    const newAffection = Math.min(
      100,
      affectionLevel + affectionGained
    );

    if (affectionGained > 0) {

      await env.DB.prepare(`
        UPDATE user_profile
        SET
          affection_level=?,
          updated_at=?
        WHERE id=?
      `)
      .bind(
        newAffection,
        Date.now(),
        id
      )
      .run();
    }

    // ==========================
    // Long Term Memory
    // ==========================
    const extractPrompt = `
Kamu adalah mesin ekstraksi fakta.

Balas HANYA salah satu:

FAKTA: <fakta>

atau

SKIP

Pesan:
"${message}"
`;

    const extraction = await env.AI.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      {
        messages: [
          {
            role: "user",
            content: extractPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 80
      }
    );

    const extText =
      (extraction.response || "").trim();

    if (extText.startsWith("FAKTA:")) {

      const memoryFact = extText
        .replace(/^FAKTA:\s*/i, "")
        .trim();

      if (memoryFact.length > 5) {

        const factEmbedding = await env.AI.run(
          "@cf/baai/bge-large-en-v1.5",
          {
            text: [memoryFact]
          }
        );

        await env.MEMORY.upsert([
          {
            id: `mem_${id}_${Date.now()}`,
            values: factEmbedding.data[0],
            metadata: {
              userId: id,
              text: memoryFact,
              timestamp: Date.now()
            }
          }
        ]);
      }
    }

  })());

  const romanticTriggers =
    /kangen|rindu|sayang|cinta|nyaman|sedih|curhat|peluk|cium|makasih|terima kasih|berarti/i;

  const affectionDelta =
    romanticTriggers.test(message)
      ? 2
      : message.length > 60
      ? 1
      : 0;

  return Response.json({
    success: true,
    reply,
    affectionLevel: Math.min(
      100,
      affectionLevel + affectionDelta
    )
  });

}

    // ==========================
    // Static Assets
    // ==========================
    if (
      env.ASSETS &&
      typeof env.ASSETS.fetch === "function"
    ) {
      return await env.ASSETS.fetch(request);
    }

    // ==========================
    // 404
    // ==========================
    return new Response(
      "Not Found",
      {
        status: 404
      }
    );
  }
};


