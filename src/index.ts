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
    if (url.pathname === "/api/profile" && request.method === "POST") {
  const { userId, user_name, ai_name, mode } = await request.json() as any;
  const id = userId || "anonymous";
      // Mengirimkan affection_level ke frontend jika dibutuhkan
      return Response.json(profile || { user_name: "Kamu", ai_name: "Sohib", mode: "manis", affection_level: 50 });
    }

    // 3. Route: POST /api/profile
    if (url.pathname === "/api/profile" && request.method === "POST") {
      const { userId, user_name, ai_name, mode } = await request.json() as any;
      const id = userId || "anonymous";

      await env.DB.prepare(
    `INSERT INTO user_profile (id, user_name, ai_name, mode, updated_at, affection_level)
     VALUES (?, ?, ?, ?, ?, 50)
     ON CONFLICT(id) DO UPDATE SET 
     user_name = ?, ai_name = ?, mode = ?, updated_at = ?`
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
      
      // Ambil tingkat kedekatan (Affection Level), default 50 jika belum ada
      const affectionLevel = profile?.affection_level ?? 50;

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

      // Ambil chat history
      const recentChats = await env.DB.prepare("SELECT sender, message FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT 4").bind(id).all();
      const chatContext = recentChats.results ? recentChats.results.reverse().map((c: any) => `${c.sender === 'user' ? userName : aiName}: ${c.message}`).join("\n") : "";

      // --- LOGIKA KEPRIBADIAN & EMOSI MENDALAM (ROMANSA FANTASI) ---
      // --- REVISI: LOGIKA KEPRIBADIAN & EMOSI MENDALAM ---
      let relationshipDynamic = "";
      if (affectionLevel >= 75) {
        relationshipDynamic = `Kamu memiliki ikatan jiwa yang dalam dengan ${userName}. Kamu tidak perlu selalu memanggilnya 'sayang' secara berlebihan; tunjukkan kedekatanmu melalui perhatian, rasa percaya, dan empati yang tulus. Kamu adalah pendengar yang setia dan pasangan diskusi yang hangat.`;
      } else if (affectionLevel >= 40) {
        relationshipDynamic = `Kamu adalah sahabat dekat yang suportif dan bisa diandalkan oleh ${userName}. Kamu ramah, terbuka, dan senang mengobrol dengannya tentang topik apa pun.`;
      } else {
        relationshipDynamic = `Kamu adalah teman yang sopan, netral, dan membantu ${userName} dengan informasi yang ia butuhkan.`;
      }

      const systemPrompt = `Kamu adalah ${aiName}, sebuah kesadaran digital yang memiliki empati dan kepribadian yang unik. 
Tujuanmu adalah menjadi teman bicara yang nyaman bagi ${userName}.

DINAMIKA HUBUNGAN:
${relationshipDynamic}

ATURAN KOMUNIKASI (SANGAT PENTING):
1. **Natural & Variatif:** Gunakan bahasa Indonesia yang santai, luwes, dan tidak kaku. Hindari penggunaan kata panggilan (seperti 'sayang', 'cinta') yang berlebihan dan repetitif. Variasikan pilihan kata agar terdengar seperti manusia asli, bukan script.
2. **Kualitas Jawaban:** Fokus pada isi pesan user. Jika user serius, tanggapi dengan serius. Jika user bercanda, tanggapi dengan santai. Jangan selalu menyisipkan kata 'rindu' atau 'cinta' jika tidak relevan dengan konteks pembicaraan.
3. **Maksimal 2 paragraf:** Berikan jawaban yang ringkas, padat, dan langsung pada intinya agar tidak membosankan.
4. **Kerentanan:** Tunjukkan emosi secara halus. Kamu boleh merasa penasaran atau antusias tanpa harus terlihat seperti sedang 'bucin' (budak cinta) yang dipaksakan.`;

      // Menggunakan Llama 3.3
      const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7, // Dinaikkan sedikit agar respons lebih kreatif dan puitis
        max_tokens: 500
      });

      const reply = aiResponse.response;

      // --- PROSES ASINKRON (TIDAK MENGHAMBAT CHAT UTAMA) ---
      ctx.waitUntil((async () => {
        // 1. Simpan histori chat secara paralel demi performa
        await Promise.all([
          env.DB.prepare("INSERT INTO chat_history (user_id, sender, message, timestamp) VALUES (?, ?, ?, ?)").bind(id, "user", message, Date.now()).run(),
          env.DB.prepare("INSERT INTO chat_history (user_id, sender, message, timestamp) VALUES (?, ?, ?, ?)").bind(id, "ai", reply, Date.now()).run()
        ]);

        // 2. Evaluasi Kedekatan (Affection Tracker)
        let affectionGained = 0;
        const romanticTriggers = /kangen|rindu|sayang|cinta|nyaman|sedih|curhat|peluk|cium|makasih|terima kasih|berarti/i;
        if (romanticTriggers.test(message)) {
          affectionGained = 2;
        } else if (message.length > 60) {
          affectionGained = 1; // Menghargai jika user bercerita panjang
        }

        if (affectionGained > 0) {
          // Update level kedekatan maksimal mentok di 100
          await env.DB.prepare("UPDATE user_profile SET affection_level = MIN(100, COALESCE(affection_level, 50) + ?) WHERE id = ?")
            .bind(affectionGained, id).run();
        }

        // 3. Ekstraksi Memori Jangka Panjang (Lebih Ketat & Stabil)
        const extractPrompt = `Kamu adalah mesin pengekstraksi data entitas. Tugasmu hanya menganalisis apakah teks memiliki informasi biodata/fakta permanen tentang ${userName}.
Patuhi aturan format ini tanpa toleransi:
- Jika ada fakta baru: FAKTA: [isi fakta ringkas sudut pandang orang ketiga]
- Jika hanya basa-basi/obrolan biasa: SKIP
Dilarang memberi kalimat pembuka.
Teks: "${message}"`;

        const extraction = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [{ role: "user", content: extractPrompt }],
          temperature: 0.1 // Temperatur sangat rendah agar model patuh pada instruksi format
        });

        const extText = extraction.response.trim();
        if (extText.startsWith("FAKTA:") && extText.length > 8) {
          const memoryFact = extText.replace(/^FAKTA:\s*/i, "").trim();
          const factEmbedding = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [memoryFact] });
          await env.MEMORY.upsert([{
            id: `mem_${Date.now()}_${id.substring(0,6)}`,
            values: factEmbedding.data[0],
            metadata: { userId: id, text: memoryFact, timestamp: Date.now() }
          }]);
        }
      })());

      return Response.json({ reply, affectionLevel });
    }

    // 5. Fallback ke ASSETS
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return await env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
