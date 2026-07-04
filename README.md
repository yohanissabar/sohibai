# 🤖 SOHIB•AI (Project Chimera)
**Your Futuristic Sci-Fi Virtual Companion & Life OS**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

**SohibAI** adalah asisten virtual berbasis kecerdasan buatan dengan antarmuka futuristik bergaya *Head-Up Display (HUD)* ala film sci-fi. Dibangun sepenuhnya di atas ekosistem **Cloudflare (Workers, Pages, D1, Vectorize, dan Workers AI)**, SohibAI tidak hanya merespons obrolan, tetapi juga memiliki **Ingatan Jangka Panjang (Long-Term Memory / RAG)**, avatar interaktif seperti *video call*, dan kemampuan suara dua arah.

---

## ✨ Fitur Utama

* 🖥️ **Live HUD Video-Call Avatar:** Tampilan setengah layar atas memuat avatar virtual interaktif yang berkedip, berbicara (*lip-sync*), dan menampilkan visualisator gelombang suara (*audio waveform*) saat merespons.
* 🧠 **Long-Term Memory (RAG):** Secara otomatis mengekstrak fakta pribadi dari percakapan pengguna (seperti hobi, nama teman, kesukaan) menggunakan LLM, menyimpannya sebagai *vector embedding*, dan mengingatnya kembali pada obrolan mendatang.
* 🎭 **Dual Persona Mode:**
  * **💖 Mode Manis:** Suportif, hangat, penuh empati (suara perempuan).
  * **⚡ Mode Gagah:** Logis, tegas, memotivasi, dan protektif (suara laki-laki).
* 💬 **Modern WhatsApp-Style Chat:** Area obrolan independen di bagian bawah layar yang dapat di-scroll bebas tanpa mengganggu tampilan avatar video.
* 🎙️ **Voice Interaction:** Mendukung input suara (Speech-to-Text via Web Speech API) dan membacakan respons AI secara natural (Text-to-Speech) dengan filter otomatis terhadap karakter emoji.
* 📱 **Progressive Web App (PWA):** Siap diinstal ke *Home Screen* pada iOS maupun Android dengan tampilan *fullscreen* layaknya aplikasi *native*.

---

## 🛠️ Arsitektur & Teknologi

Proyek ini menggunakan arsitektur *serverless* terintegrasi di jaringan *edge* Cloudflare:

| Komponen | Teknologi / Layanan | Fungsi Utama |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Tailwind CSS, Web Speech API | UI/UX bergaya Sci-Fi HUD & PWA |
| **Backend API** | Cloudflare Pages Functions (TypeScript) | Menangani routing `/api/chat` & `/api/profile` |
| **LLM Engine** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Menghasilkan balasan chat & ekstraksi fakta |
| **Embedding** | `@cf/baai/bge-large-en-v1.5` (1024-dim) | Mengubah teks memori menjadi vektor |
| **Vector DB** | Cloudflare Vectorize (`MEMORY`) | Pencarian semantik ingatan masa lalu (RAG) |
| **Relational DB** | Cloudflare D1 (`DB`) | Menyimpan profil pengguna & riwayat chat |

---

## 🚀 Panduan Instalasi & Pengembangan (Local Setup)

### 1. Prasyarat
Pastikan Anda sudah menginstal:
* [Node.js](https://nodejs.org/) (v18 atau lebih baru)
* [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`
* Akun [Cloudflare](https://dash.cloudflare.com/) yang aktif.

### 2. Kloning Repositori
```bash
git clone [https://github.com/username-kamu/sohibai.git](https://github.com/username-kamu/sohibai.git)
cd sohibai
npm install

sample app.; https://sohib-ai.yohanis-subden1a3.workers.dev/
