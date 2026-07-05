# 🤖 SOHIB•AI (Project Chimera)
**Your Futuristic Sci-Fi Virtual Companion & Life OS**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

---

## 🌐 Live Demo
Rasakan pengalaman interaksi AI masa depan langsung di browser Anda:
👉 **[https://sohibai.yohanis-subden1a3.workers.dev/](https://sohibai.yohanis-subden1a3.workers.dev/)**

*(Catatan: Aplikasi mendukung PWA. Untuk pengalaman terbaik, "Add to Home Screen" melalui menu browser di ponsel Anda.)*

---

## 📌 Deskripsi Proyek
**SohibAI** adalah asisten virtual berbasis kecerdasan buatan dengan antarmuka futuristik bergaya *Head-Up Display (HUD)*. Proyek ini didesain untuk melampaui chat biasa dengan menerapkan konsep **Life OS**—sebuah entitas digital yang mengenal preferensi, memori, dan kepribadian penggunanya melalui ekosistem *Edge Computing* Cloudflare.

## ✨ Fitur Unggulan
* **Neural Link Interface:** Antarmuka interaktif dengan *lip-sync* avatar dan visualisasi *audio waveform* untuk menciptakan kesan kehadiran AI yang nyata.
* **Long-Term Memory (RAG):** Menggunakan *Vector Database* untuk menyimpan dan memanggil kembali fakta-fakta spesifik tentang pengguna, menciptakan memori jangka panjang yang konsisten.
* **Adaptive Personas:** Dukungan dua kepribadian (*Mode Manis* dan *Mode Gagah*) yang mengubah nada bicara, *pitch* suara, dan tema visual secara *real-time*.
* **Privacy-First:** Sistem identitas berbasis anonim (tanpa database user yang rumit) yang tetap mampu menjaga privasi setiap pengguna dengan isolasi data berbasis `userId`.
* **Native-Like Experience:** Dioptimalkan sebagai PWA yang ringan, cepat, dan bekerja secara responsif di berbagai perangkat.

## 🏗️ Arsitektur Teknologi
SohibAI dibangun sepenuhnya di atas infrastruktur *serverless* Cloudflare untuk performa latensi rendah:

| Komponen | Layanan |
| :--- | :--- |
| **Frontend** | HTML5, Tailwind CSS, Web Speech API (PWA) |
| **Backend API** | Cloudflare Pages Functions (TypeScript) |
| **LLM Engine** | Meta Llama 3.3 70B (via Cloudflare Workers AI) |
| **Vector Engine** | Cloudflare Vectorize (Semantic Memory) |
| **Database** | Cloudflare D1 (SQL Relational Data) |

---

## 🚀 Instalasi & Pengembangan Lokal

1.  **Clone Repositori:**
    ```bash
    git clone [https://github.com/yourusername/sohibai.git](https://github.com/yourusername/sohibai.git)
    cd sohibai
    ```
2.  **Instal Dependensi:**
    ```bash
    npm install
    ```
3.  **Pengembangan:**
    Pastikan `wrangler` sudah terinstal, lalu jalankan:
    ```bash
    npx wrangler pages dev --proxy 3000
    ```

---

## 🤝 Kontribusi
Proyek ini dikembangkan sebagai upaya mengeksplorasi potensi *Generative AI* di *Edge Network*. Kontribusi dalam bentuk *issue* atau *pull request* sangat dihargai.

**Maintainer:** [Yohanis Sabar](https://github.com/yohanissabar)

---
*Built with passion for the future of human-AI interaction.*
