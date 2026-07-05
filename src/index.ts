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

// Tambahkan Header CORS agar frontend bisa terkoneksi tanpa error
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Ubah "*" menjadi domain frontend-mu jika ingin lebih aman
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle preflight request CORS dari Browser
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    try {
      // ==========================
      // GET /api/profile
      // ==========================
      if (url.pathname === "/api/profile" && request.method === "GET") {
        const id = url.searchParams.get("userId") || "anonymous";
        let profile = await env.DB.prepare("SELECT * FROM user_profile WHERE id = ?").bind(id).first();

        if (!profile) {
          await env.DB.prepare(`
            INSERT INTO user_profile (id, user_name, ai_name, mode, affection_level, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            id,
            DEFAULT_PROFILE.user_name,
            DEFAULT_PROFILE.ai_name,
            DEFAULT_PROFILE.mode,
            DEFAULT_PROFILE.affection_level,
            Date.now()
          ).run();
          
          profile = { id, ...DEFAULT_PROFILE };
        }
        return Response.json(profile, { headers: corsHeaders });
      }

      // ==========================
      // POST /api/profile
      // ==========================
      if (url.pathname === "/api/profile" && request.method === "POST") {
        const body = (await request.json()) as any;
        const { userId, user_name, ai_name, mode } = body;
        const id = userId || "anonymous";

        await env.DB.prepare(`
          INSERT INTO user_profile (id, user_name, ai_name, mode, affection_level, updated_at) 
          VALUES (?, ?, ?, ?, 50, ?) 
          ON CONFLICT(id) DO UPDATE SET 
            user_name = excluded.user_name, 
            ai_name = excluded.ai_name, 
            mode = excluded.mode, 
            updated_at = excluded.updated_at
        `).bind(
          id,
          user_name || DEFAULT_PROFILE.user_name,
          ai_name || DEFAULT_PROFILE.ai_name,
          mode || DEFAULT_PROFILE.mode,
          Date.now()
        ).run();

        const profile = await env.DB.prepare("SELECT * FROM user_profile WHERE id=?").bind(id).first();
        return Response.json({ success: true, profile }, { headers: corsHeaders });
      }

      // ==========================
      // POST /api/chat
      // ==========================
      if (url.pathname === "/api/chat" && request.method === "POST") {
        const body = (await request.json()) as any;
        const { userId, message } = body;
        
        // Mencegah server putus/error jika message kosong
        if (!message) {
          return Response.json({ success: false, error: "Message is required" }, { status: 400, headers: corsHeaders });
        }

        const id = userId || "anonymous";

        let profile: any = await env.DB.prepare("SELECT * FROM user_profile WHERE id = ?").bind(id).first();

        if (!profile) {
          await env.DB.prepare(`
            INSERT INTO user_profile (id, user_name, ai_name, mode, affection_level, updated_at) 
            VALUES (?, ?, ?, ?, 50, ?)
          `).bind(
            id,
            DEFAULT_PROFILE.user_name,
            DEFAULT_PROFILE.ai_name,
            DEFAULT_PROFILE.mode,
            Date.now()
          ).run();
          profile = { id, ...DEFAULT_PROFILE };
        }

        const userName = profile.user_name || "Kamu";
        const aiName = profile.ai_name || "Sohib";
        const affectionLevel = profile.affection_level ?? 50;

        // Embedding User Message
        const embeddingReq = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [message] });
        const vectorQuery = await env.MEMORY.query(embeddingReq.data[0], { topK: 3, filter: { userId: id } });

        let longTermMemories = "";
        if (vectorQuery.matches && vectorQuery.matches.length) {
          longTermMemories = vectorQuery.matches
            .filter((m: any) => m.score > 0.68)
            .map((m: any) => m.metadata?.text)
            .filter(Boolean)
            .join("\n- ");
        }

        // Chat History
        const recentChats = await env.DB.prepare(
          `SELECT sender,message FROM chat_history WHERE user_id=? ORDER BY id DESC LIMIT 4`
        ).bind(id).all();

        const chatContext = recentChats.results
          ? recentChats.results
              .reverse()
              .map((c: any) => `${c.sender === "user" ? userName : aiName}: ${c.message}`)
              .join("\n")
          : "";

        // Relationship
        let relationshipDynamic = "";
        if (affectionLevel >= 75) {
          relationshipDynamic = `Kamu memiliki ikatan jiwa yang dalam dengan ${userName}. Tunjukkan perhatian, empati, rasa percaya dan kehangatan secara alami.`;
        } else if (affectionLevel >= 40) {
          relationshipDynamic = `Kamu adalah sahabat dekat yang suportif dan selalu siap membantu ${userName}.`;
        } else {
          relationshipDynamic = `Kamu adalah teman yang sopan, netral dan membantu ${userName}.`;
        }

        const memorySection = longTermMemories ? `MEMORI JANGKA PANJANG\n- ${longTermMemories}` : "";
        const historySection = chatContext ? `RIWAYAT CHAT\n${chatContext}` : "";

        const systemPrompt = `Kamu adalah ${aiName}. Tujuanmu menjadi teman bicara terbaik bagi ${userName}. 
DINAMIKA HUBUNGAN: ${relationshipDynamic} 
${memorySection} 
${historySection} 
ATURAN: - Gunakan bahasa Indonesia alami. - Jangan berlebihan memanggil sayang. - Jawaban maksimal dua paragraf. - Fokus menjawab isi pertanyaan user. - Gunakan memori jika memang relevan. - Jangan mengarang fakta baru.`;

        const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        // Amankan response jika model AI sedang sibuk
        const reply = aiResponse.response || "Maaf, pikiranku sedang penuh sekarang.";

        // Background Process
        ctx.waitUntil(
          (async () => {
            try {
              // Simpan histori chat
              await Promise.all([
                env.DB.prepare(`INSERT INTO chat_history (user_id,sender,message,timestamp) VALUES(?,?,?,?)`)
                  .bind(id, "user", message, Date.now()).run(),
                env.DB.prepare(`INSERT INTO chat_history (user_id,sender,message,timestamp) VALUES(?,?,?,?)`)
                  .bind(id, "ai", reply, Date.now()).run(),
              ]);

              // Affection
              let affectionGained = 0;
              const romanticTriggers = /kangen|rindu|sayang|cinta|nyaman|sedih|curhat|peluk|cium|makasih|terima kasih|berarti/i;
              
              if (romanticTriggers.test(message)) affectionGained = 2;
              else if (message.length > 60) affectionGained = 1;

              if (affectionGained > 0) {
                const newAffection = Math.min(100, affectionLevel + affectionGained);
                await env.DB.prepare(`UPDATE user_profile SET affection_level=?, updated_at=? WHERE id=?`)
                  .bind(newAffection, Date.now(), id).run();
              }

              // Long Term Memory Ekstraksi
              const extractPrompt = `Kamu adalah mesin ekstraksi fakta. Jawaban WAJIB salah satu:\nFAKTA: isi fakta\natau\nSKIP\n\nPesan: "${message}"`;
              const extraction = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
                messages: [{ role: "user", content: extractPrompt }],
                temperature: 0.1,
                max_tokens: 80,
              });

              const extText = extraction?.response?.trim() || "";
              if (extText.startsWith("FAKTA:")) {
                const memoryFact = extText.replace(/^FAKTA:\s*/i, "").trim();
                if (memoryFact.length > 5) {
                  const factEmbedding = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [memoryFact] });
                  await env.MEMORY.upsert([{
                    id: `mem_${id}_${Date.now()}`,
                    values: factEmbedding.data[0],
                    metadata: { userId: id, text: memoryFact, timestamp: Date.now() },
                  }]);
                }
              }
            } catch (bgError) {
              console.error("Background task failed:", bgError);
            }
          })()
        );

        let finalAffection = affectionLevel;
        if (romanticTriggers.test(message)) finalAffection += 2;
        else if (message.length > 60) finalAffection += 1;

        return Response.json({
          success: true,
          reply,
          affectionLevel: Math.min(100, finalAffection),
        }, { headers: corsHeaders });
      }

      // ==========================
      // Static Assets
      // ==========================
      if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
        return env.ASSETS.fetch(request);
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
      
    } catch (error: any) {
      // 2. Error handling: Agar frontend menerima pesan error JSON rapih bukan putus tiba-tiba
      console.error("Server Error:", error);
      return Response.json(
        { success: false, error: "Terjadi kesalahan internal pada server", details: error.message },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
