export interface Env {
  AI: any;
  MEMORY: any;
  DB: any;
  ASSETS?: any;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Penanganan Favicon agar tidak memicu error
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // 2. Route: GET /api/profile
    if (url.pathname === "/api/profile" && request.method === "GET") {
      const userId = url.searchParams.get("userId") || "anonymous";
      const profile = await env.DB.prepare("SELECT * FROM user_profile WHERE id = ?").bind(userId).first();
      return Response.json(profile || { user_name: "Kamu", ai_name: "Sohib", mode: "manis" });
    }

    // 3. Route: POST /api/profile
    if (url.pathname === "/api/profile" && request.method === "POST") {
      const { userId, user_name, ai_name, mode } = await request.json() as any;
      const id = userId || "anonymous";
      
      // Menggunakan UPSERT agar jika user baru, data di-insert. Jika lama, di-update.
      // *Pastikan kolom 'id' di tabel user_profile sudah diatur sebagai PRIMARY KEY atau UNIQUE constraint
      await env.DB.prepare(
        `INSERT INTO user_profile (id, user_name, ai_name, mode, updated_at) 
         VALUES (?, ?, ?, ?, ?) 
         ON CONFLICT(id) DO UPDATE SET user_name = ?, ai_name = ?, mode = ?, updated_at = ?`
      ).bind(id, user_name, ai_name, mode, Date.now(), user_name, ai_name, mode, Date.now()).run();
      
      return Response.json({ success: true });
    }

    // 4. Route: POST /api/chat
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const { userId, message } = await request.json() as any;
      const id = userId || "anonymous";

      const profile: any = await env.DB.prepare("SELECT * FROM user_profile WHERE id = ?").bind(id).first();
      const userName = profile?.user_name || "Kamu";
      const aiName = profile?.ai_name || "Sohib";
      const mode = profile?.mode || "manis";

      // Menggunakan bge-large-en-v1.5 untuk embedding memori
      const embeddingReq = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [message] });
      
      // Filter vector memory berdasarkan userId
      const vectorQuery = await env.MEMORY.query(embeddingReq.data[0], { 
        topK: 3,
        filter: { userId: id } 
      });

      let longTermMemories = "";
      if (vectorQuery.matches && vectorQuery.matches.length > 0) {
        longTermMemories = vectorQuery.matches
          .filter((m: any) => m.score > 0.68)
          .map((m: any) => m.metadata?.text)
          .join("\n- ");
      }

      // Ambil chat history HANYA untuk user ini
      const recentChats = await env.DB.prepare("SELECT sender, message FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT 4").bind(id).all();
      const chatContext = recentChats.results ? recentChats.results.reverse().map((c: any) => `${c.sender === 'user' ? userName : aiName}: ${c.message}`).join("\n") : "";

      // INSTRUKSI KEPRIBADIAN BARU (NORMAL, RAMAH, DAN BEBAS CRINGE)
      const personaInstruction = mode === "gagah"
        ? `Kamu adalah ${aiName}, sahabat dekat cowok yang santai, logis, suportif, dan bisa diandalkan bagi ${userName}. Gunakan gaya bicara maskulin yang santai bak teman nongkrong yang akrab.`
        : `Kamu adalah ${aiName}, sahabat dekat cewek yang ramah, hangat, pengertian, dan suportif bagi ${userName}. Gunakan gaya bicara yang santai, akrab, dan empati bak bestie/teman dekat yang seru.`;

      const systemPrompt = `${personaInstruction}

Ingatan jangka panjang tentang ${userName}:
- ${longTermMemories || "Belum ada catatan memori khusus."}

Riwayat obrolan barusan:
${chatContext}

ATURAN WAJIB (SANGAT PENTING):
1. Posisi kamu adalah SAHABAT/TEMAN DEKAT NORMAL, BUKAN PACAR ATAU PASANGAN.
2. DILARANG KERAS menggunakan panggilan romantis/mesra seperti "sayang", "cinta", "beb", "my love", atau sejenisnya.
3. Panggil pengguna langsung dengan namanya ("${userName}") atau kata ganti santai seperti "kamu".
4. Jawab langsung pesan dari ${userName} dalam Bahasa Indonesia yang natural, hidup, ekspresif, namun tetap ringkas (maksimal 3 paragraf pendek).`;

      // Menggunakan Llama 3.3 dengan temperatur 0.6 agar lebih rasional & stabil
      const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.6,
        max_tokens: 500
      });

      const reply = aiResponse.response;

      ctx.waitUntil((async () => {
        // Simpan histori chat dengan menyertakan user_id
        await env.DB.prepare("INSERT INTO chat_history (user_id, sender, message, timestamp) VALUES (?, ?, ?, ?)")
          .bind(id, "user", message, Date.now()).run();
        await env.DB.prepare("INSERT INTO chat_history (user_id, sender, message, timestamp) VALUES (?, ?, ?, ?)")
          .bind(id, "ai", reply, Date.now()).run();

        const extractPrompt = `Analisis pesan user berikut: "${message}".
Apakah user mengungkapkan fakta pribadi permanen (seperti hobi, makanan kesukaan, ketakutan, rahasia, pekerjaan, nama teman, atau perasaan penting)?
Jika YA, jawab HANYA dengan format: FAKTA: [tulis fakta ringkas orang ketiga tentang ${userName}].
Jika TIDAK ada fakta penting, jawab HANYA kata: SKIP.`;

        const extraction = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [{ role: "user", content: extractPrompt }]
        });

        const extText = extraction.response.trim();
        if (extText.startsWith("FAKTA:")) {
          const memoryFact = extText.replace("FAKTA:", "").trim();
          const factEmbedding = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [memoryFact] });
          await env.MEMORY.upsert([{
            id: `mem_${Date.now()}_${id.substring(0,6)}`, // Id unik gabungan timestamp & id user
            values: factEmbedding.data[0],
            // Sisipkan userId di metadata agar bisa difilter per user saat query vector
            metadata: { userId: id, text: memoryFact, timestamp: Date.now() }
          }]);
        }
      })());

      return Response.json({ reply, mode });
    }

    // 5. Fallback ke ASSETS dengan pengecekan aman
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return await env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
