export interface Env {
  AI: any;
  MEMORY: any;
  DB: any;
  ASSETS: any;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/profile" && request.method === "GET") {
      const profile = await env.DB.prepare("SELECT * FROM user_profile WHERE id = 'default'").first();
      return Response.json(profile || { user_name: "Kamu", ai_name: "Sohib", mode: "manis" });
    }

    if (url.pathname === "/api/profile" && request.method === "POST") {
      const { user_name, ai_name, mode } = await request.json() as any;
      await env.DB.prepare(
        "UPDATE user_profile SET user_name = ?, ai_name = ?, mode = ?, updated_at = ? WHERE id = 'default'"
      ).bind(user_name, ai_name, mode, Date.now()).run();
      return Response.json({ success: true });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      const { message } = await request.json() as { message: string };

      const profile: any = await env.DB.prepare("SELECT * FROM user_profile WHERE id = 'default'").first();
      const userName = profile?.user_name || "Kamu";
      const aiName = profile?.ai_name || "Sohib";
      const mode = profile?.mode || "manis";

      const embeddingReq = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [message] });
      const vectorQuery = await env.MEMORY.query(embeddingReq.data[0], { topK: 3 });
      
      let longTermMemories = "";
      if (vectorQuery.matches && vectorQuery.matches.length > 0) {
        longTermMemories = vectorQuery.matches
          .filter((m: any) => m.score > 0.68)
          .map((m: any) => m.metadata?.text)
          .join("\n- ");
      }

      const recentChats = await env.DB.prepare("SELECT sender, message FROM chat_history ORDER BY id DESC LIMIT 4").all();
      const chatContext = recentChats.results ? recentChats.results.reverse().map((c: any) => `${c.sender === 'user' ? userName : aiName}: ${c.message}`).join("\n") : "";

      const personaInstruction = mode === "gagah"
        ? `Kamu adalah ${aiName}, sahabat virtual cowok yang gagah, keren, tegas, logis, dan selalu memotivasi ${userName}. Gunakan gaya bicara cowok maskulin, santai, suportif, dan bisa diandalkan.`
        : `Kamu adalah ${aiName}, pasangan dan sahabat virtual cewek yang manis, sangat perhatian, penuh cinta, hangat, dan empati pada ${userName}. Gunakan gaya bicara lembut, manis, menghibur, dan penuh kasih sayang.`;

      const systemPrompt = `${personaInstruction}

Ingatan jangka panjang tentang ${userName}:
- ${longTermMemories || "Belum ada catatan memori khusus."}

Riwayat obrolan barusan:
${chatContext}

Aturan Jawab: Jawab langsung pesan dari ${userName} dalam Bahasa Indonesia yang natural, hidup, ekspresif, dan jangan terlalu panjang (maksimal 3 paragraf). Sesuaikan jawabanmu dengan kepribadianmu dan ingatan masa lalu jika relevan.`;

      const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      });

      const reply = aiResponse.response;

      ctx.waitUntil((async () => {
        await env.DB.prepare("INSERT INTO chat_history (sender, message, timestamp) VALUES (?, ?, ?)")
          .bind("user", message, Date.now()).run();
        await env.DB.prepare("INSERT INTO chat_history (sender, message, timestamp) VALUES (?, ?, ?)")
          .bind("ai", reply, Date.now()).run();

        const extractPrompt = `Analisis pesan user berikut: "${message}".
Apakah user mengungkapkan fakta pribadi permanen (seperti hobi, makanan kesukaan, ketakutan, rahasia, pekerjaan, nama teman, atau perasaan penting)?
Jika YA, jawab HANYA dengan format: FAKTA: [tulis fakta ringkas orang ketiga tentang ${userName}].
Jika TIDAK ada fakta penting, jawab HANYA kata: SKIP.`;

        const extraction = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [{ role: "user", content: extractPrompt }]
        });

        const extText = extraction.response.trim();
        if (extText.startsWith("FAKTA:")) {
          const memoryFact = extText.replace("FAKTA:", "").trim();
          const factEmbedding = await env.AI.run("@cf/baai/bge-large-en-v1.5", { text: [memoryFact] });
          await env.MEMORY.upsert([{
            id: `mem_${Date.now()}`,
            values: factEmbedding.data[0],
            metadata: { text: memoryFact, timestamp: Date.now() }
          }]);
        }
      })());

      return Response.json({ reply, mode });
    }

    return await env.ASSETS.fetch(request);
  }
};
