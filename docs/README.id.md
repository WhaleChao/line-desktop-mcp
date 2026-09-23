![LINE Agent MCP v3.0.0](assets/line-agent-cover-v3.png)

# LINE Agent MCP

**Konteks LINE, termasuk gambar. Pembacaan lebih cepat, waktu tunggu lebih singkat.**

Pilih chat dan rentang tanggal. Biarkan asisten AI menata percakapan bersama gambar yang tersedia di cache lokal menjadi progres, konteks lampiran, dan langkah berikutnya. MCP menyediakan pratinjau untuk model yang mendukung gambar; status gambar asli, thumbnail, dan tidak tersedia tetap dinyatakan dengan jelas.

[繁體中文](../README.md) · [English](README.en.md) · [日本語](README.ja.md) · [ภาษาไทย](README.th.md) · [Bahasa Indonesia](README.id.md)

[Catatan rilis v3.2.0](releases/v3.2.0.id.md) · [Instalasi](quickstart-windows.md) · [Tingkatkan ke v3.2.0](MIGRATING.md#upgrading-to-v320) · [Kontrak teknis](windows-extensions.md)

**v3.2.0 — Pengiriman teks dan catatan lokal:** Identitas chat dan pengirim sendiri diperiksa dengan tepat, lalu pesan baru milik sendiri dicari dalam batas 30 detik. `RECORDED_LOCAL` bukan bukti diterima atau dibaca. Operasi yang belum pasti diperiksa secara baca-saja dengan `idempotencyKey` yang sama, tanpa pengiriman ulang otomatis. Perintah MCP bertanggal memakai pembaca lokal bersama; perintah lama tanpa tanggal tetap memakai riwayat UI. [Rincian](releases/v3.2.0.id.md)

**v3.1.0 — CLI lokal hanya-baca：** Menambahkan `line-cli` untuk daftar kemampuan, status lokal, pembacaan chat tertentu menurut tanggal, dan ekspor JSON/TXT/CSV. Setiap pemanggilan mengembalikan satu halaman dengan rentang maksimal 31 hari. CLI tidak mengoperasikan GUI atau mengirim pesan. [CLI](CLI.md) · [v3.1.0](releases/v3.1.0.id.md)


**v3.0.1 perbaikan database besar:** Snapshot streaming memperbaiki penolakan pembacaan DB di atas 256 MiB. Batas default DB adalah 2 GiB; pemeriksaan WAL dan kestabilan sumber tetap berlaku. Tidak perlu menghapus riwayat chat. [Catatan rilis](releases/v3.0.1.id.md) · [Upgrade](MIGRATING.md#upgrading-to-v301)

**LINE Agent MCP** adalah edisi komunitas Windows yang dikelola oleh [bensonmaxai](https://github.com/bensonmaxai/line-desktop-mcp), berdasarkan [proyek asli Geoffrey Wang](https://github.com/dtwang/line-desktop-mcp). Proyek ini menghubungkan klien MCP lokal ke LINE Desktop yang sudah masuk. Codex dapat digunakan sebagai klien sehari-hari, dan klien MCP lokal lain juga dapat terhubung. Proyek ini tidak berafiliasi dengan LINE.

Atur `LINE_MCP_EXTENSIONS=1` di Windows untuk menampilkan **26 tools aktif**. Lima alias lama tetap dapat dipanggil meski tersembunyi. Tanpa flag ini, **lima tools** bawaan tetap terdaftar. macOS juga mencantumkan lima nama itu, tetapi pembacaan, pengiriman, dan operasi file tidak tersedia pada rilis ini.

**Rilis keamanan v3.0.0 (12 September 2026):** Semua jalur GUI Windows untuk chat bernama, termasuk lima tools bawaan, memerlukan CUA dan local reader yang dikonfigurasi. Pemeriksaan metadata privat tidak membaca pesan atau media, hanya memastikan satu grup atau direct chat yang sudah ada, lalu memverifikasi header LINE baru dari chat yang diizinkan dan sudah dibuka oleh pengguna atau UI terpandu. `open_line_chat` hanya memverifikasi; ia tidak membuka hasil pencarian pertama secara otomatis. macOS mempertahankan lima descriptor, tetapi pembacaan chat, pengiriman, dan file ditolak dengan `LINE_CHAT_VERIFICATION_UNAVAILABLE`; tidak ada dukungan operasional macOS. [Langkah peningkatan](MIGRATING.md#upgrading-to-v300)

## Satu percakapan, satu alur kerja lengkap

![Baca, rangkum, setujui, kirim, periksa](assets/workflow-id.svg)

Minta asisten meninjau chat yang disebutkan dan melaporkan progres saat ini. Asisten membaca cakupan yang diizinkan, memakai sumber bisnis yang diizinkan secara terpisah bila diperlukan, lalu menampilkan draf yang tepat dalam percakapan dengan asisten. Setelah Anda mengonfirmasi penerima dan isi, asisten mengirim dan memeriksa hasilnya. Workbench terpisah tidak diperlukan.

| Tugas | Yang disediakan v3.0.0 |
| --- | --- |
| Menindaklanjuti pekerjaan | Riwayat lokal group/direct yang tepat, tanggal eksplisit, maksimal 31 hari, pagination, dan kesegaran snapshot |
| Memahami lampiran | Pratinjau gambar cache sesuai permintaan, blok PCM WAV kecil, serta ketersediaan media yang dinyatakan jelas |
| Membalas sumber yang tepat | Pemeriksaan teks lengkap/pengirim/waktu dan source token visual sekali pakai |
| Memeriksa polling | Membaca hanya panel yang sudah terbuka setelah diikat ke grup yang diizinkan |
| Menangani perubahan klien | Hash build LINE yang diverifikasi dan status proses terpisah; build yang tidak dikenal menolak pembacaan lokal |
| Mengurangi waktu tunggu | Pencarian kunci berbatas, penggunaan ulang locator sementara, dan lebih sedikit enumerasi UI yang berlebihan |

Draf teks biasa ditinjau di Codex. Agen melakukan pemeriksaan UI secara visual, tetapi mention nyata dan perubahan konten bersama tetap memerlukan alur kerja serta persetujuan khususnya. Rencana bukan bukti bahwa suatu tindakan telah terjadi.

## Instalasi dan peningkatan ke v3.2.0

Ambil repository yang sama pada tag v3.2.0 ke direktori terpisah:

```powershell
git clone --branch v3.2.0 --depth 1 https://github.com/bensonmaxai/line-desktop-mcp.git
cd line-desktop-mcp
npm ci --ignore-scripts
```

Untuk berpindah dari `line-desktop-mcp` versi sebelumnya, cadangkan dahulu konfigurasi klien MCP saat ini. Ambil v3.2.0 ke direktori source baru yang berdampingan dengan perintah di atas, lalu arahkan registration MCP yang ada ke direktori baru itu. Simpan checkout, launcher, dan konfigurasi sebelumnya untuk rollback. Akun LINE dan data chat tidak perlu dimigrasikan.

Gunakan Node.js 24 LTS atau lebih baru (teruji: 24.19.0) serta komponen runtime yang dikonfigurasi terpisah untuk tools yang dipakai. Pembacaan lokal memerlukan Windows x64, Python x64, `cryptography` dan Pillow, SQLite3MC DLL yang dipasangi pin, serta `LINE_MCP_PYTHON` / `LINE_MCP_SQLITE3MC_DLL` yang eksplisit. Kedua paket Python wajib untuk semua pembacaan lokal, termasuk mode metadata. Pada v3.1.0, jalur GUI Windows untuk chat bernama, termasuk lima tools bawaan, juga memerlukan lingkungan local reader ini dan `LINE_MCP_CUA_DRIVER`. Pengguna atau UI terpandu harus membuka chat yang diizinkan terlebih dahulu; `open_line_chat` tidak mencari secara otomatis. Nama tampilan mentah harus cocok tepat; bentuk NFC yang setara, spasi yang diringkas/dipotong, dan keluarga benturan jumlah anggota gagal secara tertutup. Tools UI memakai AutoHotkey v2 dan Windows OCR lokal bila diperlukan. Lihat [panduan instalasi](quickstart-windows.md).

Hubungkan ulang dan segarkan tool schema. Identitas MCP serta nama, urutan, dan skema input lima tools bawaan tetap dipertahankan. Namun, `stage_line_reply` memerlukan `source` lengkap dan `sourceToken` berumur singkat serta sekali pakai dari tools observasi/konfirmasi sumber. Token mengikat `chatRef` segar, jenis group/direct, dan piksel yang diamati. Jika guard sebelum atau sesudah GUI melihat drift, hasilnya menolak atau tidak pasti meski percobaan telah dilakukan. `get_line_status.localReader` melaporkan metadata build/proses secara terpisah, bukan kesiapan lengkap dependency/DLL. [Detail peningkatan dan pemulihan](MIGRATING.md#upgrading-to-v301)

LINE Agent MCP adalah nama tampilan untuk edisi komunitas Windows ini. v3.0.0 merupakan peningkatan mayor yang meneruskan repository dan rangkaian rilis `line-desktop-mcp`, karena prasyarat GUI Windows berubah dan alur operasional macOS dinonaktifkan. Ini bukan proyek GitHub baru atau nama MCP yang berbeda.

Rilis ini hanya berjalan melalui stdio lokal. Tidak ada server HTTP/REST atau layanan cloud berbayar, dan `.env` pada current working directory tidak dimuat otomatis; konfigurasi datang dari variabel lingkungan yang diberikan secara eksplisit oleh klien MCP.

Gunakan `line-desktop-mcp-3.2.0.tgz` dan `SHA256SUMS.txt` dari GitHub release v3.2.0. Proyek ini tidak dipublikasikan ke npm registry dan tidak menyediakan bundel MCPB. Paket lama `line-desktop-mcp@latest` tidak memasang rilis ini.

## Bukti dan batasan

![Perbandingan cold reader pada mesin yang sama](assets/performance.svg)

Inti cold reader **17.866 → 4.661 detik** dan pembacaan warm **0.732–0.803 detik** pada koneksi MCP persisten setelah pemeriksaan restart adalah bukti historis v2.0.0 untuk reader riwayat teks berbatas pada mesin yang sama. Angka itu belum mencakup overhead klien/model dan bukan jaminan kinerja universal.

Angka tersebut mengukur core Python untuk **riwayat teks** berbatas; angka ini tidak mencakup dekode pratinjau gambar maupun overhead model/GUI. Ini bukan latensi end-to-end dan bukan benchmark untuk named-chat GUI guards v3.0.0.

Dua pemeriksaan restart/baca LINE nyata berhasil pada v2.0.0, dan transport gambar nyata juga didekode secara independen. Itu adalah bukti terbatas dari versi sebelumnya. Guard GUI baru v3.0.0 hanya diperiksa dengan synthetic tests, native SQL, dan parsing AutoHotkey; tidak ada eksekusi end-to-end terhadap chat LINE nyata, pengiriman, atau GUI nyata.

- Bukti GUI langsung Windows LINE **26.4.2.3957, Traditional Chinese UI**, CUA Driver 0.23.2, berasal dari pengujian pembacaan riwayat v2.0.0. Bukti itu tidak mengesahkan guard v3.0.0 atau bahasa UI lain.
- Tanggal query dan perencanaan polling memakai **Asia/Taipei, UTC+08:00**.
- Pembacaan lokal memakai akses baca-saja berbatas ke memori proses LINE yang sedang masuk. Operasi berhenti saat akses ditolak atau build belum diverifikasi.
- Catatan cache lokal bukan arsip server lengkap. Pratinjau yang didukung adalah PNG/JPEG, frame pertama GIF/WebP, dan PCM WAV kecil. APNG hanya mengembalikan frame pertama dan source PNG/JPEG statis dipertahankan. Metadata JSON yang tidak valid dan terlalu dalam diabaikan, sementara baris lain tetap diproses. Media lain yang dikenali mengembalikan metadata. Ini tidak menyiratkan pemutaran atau transkripsi umum.
- Tidak ditemukannya gambar pada cache lokal tidak berarti pemrosesan AI berjalan offline. MCP hanya dapat meneruskan pratinjau cache yang tersedia kepada model yang mendukung gambar.
- Keberadaan teks tidak membuktikan pengiriman ke penerima atau status sudah dibaca. Token mention nyata memerlukan verifikasi visual; pengiriman yang tidak pasti tidak diulang otomatis. Penyalinan riwayat hanya mengembalikan format clipboard terdahulu yang tersedia saat urutan pemilik stabil. Penulis baru dipertahankan dan pembacaan ditolak; Clipboard History, listener, serta race perbandingan/pemulihan tetap menjadi batas.
- Dekode dan OCR berjalan secara lokal. Konten yang dikembalikan mengikuti kebijakan penanganan data klien AI yang dipilih.

Verifikasi sintetis akhir v3.0.0: Node tests **221 lulus**; Python tests **101 dari 102 lulus** dan 1 dilewati karena symlink filesystem Windows. Tidak ada chat atau pengiriman nyata yang dijalankan. Jalankan `npm test` dan `npm run test:python` dengan Python yang telah dikonfigurasi. [Kontrak tools dan verifikasi terperinci](windows-extensions.md)

[Pemilihan bahasa dan sumber resmi](LANGUAGES.md) · [Laporkan issue](https://github.com/bensonmaxai/line-desktop-mcp/issues) · [Lisensi MIT](../LICENSE.md) · [Catatan pihak ketiga](THIRD_PARTY.md)

Sampul adalah ilustrasi konsep yang dihasilkan AI. Grafik alur kerja/kinerja dibuat dengan kode, bukan tangkapan layar chat nyata atau aset LINE resmi.
