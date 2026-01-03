# Media Downloader Pro - Chrome Extension

Sebuah extension Chrome untuk mendownload gambar, video, dan media lainnya dari website dengan mudah, **termasuk HLS/M3U8 streaming**.

## 🎯 Fitur Utama

- ✅ **Scraping Otomatis**: Mendeteksi semua gambar dan video di halaman
- 📥 **Download Langsung**: Download ke folder terpisah (Images/Videos)
- 🎨 **UI Modern**: Interface dark theme dengan tema WhatsApp Green
- ⚡ **Batch Download**: Download multiple file sekaligus
- 📊 **Statistik Real-time**: Menampilkan jumlah media yang ditemukan
- 🔄 **Network Monitoring**: Menangkap media dari AJAX/Fetch requests
- 🎬 **M3U8/HLS Streaming Support**: Download HLS streams dengan progress tracking
- 🔀 **Smart Segment Merging**: Otomatis gabungkan video segments menjadi single file

## 📦 Struktur File

```
Downloader/
├── manifest.json           # Konfigurasi extension
├── package.json            # NPM configuration
├── content-script.js       # Scraping logic
├── background.js           # Service worker + M3U8 handler
├── m3u8-handler.js         # M3U8 parser & segment handler
├── popup.html              # UI popup
├── popup.js                # Popup logic (with M3U8 progress)
├── popup.css               # Styling dengan tema custom
├── images/                 # Folder untuk icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

## 🎬 M3U8/HLS Streaming Support

Extension sekarang fully support **M3U8 HLS streaming** dengan fitur-fitur canggih:

### Cara Kerja:
1. Extension mendeteksi file M3U8 di halaman (`.m3u8` extension)
2. Click download pada M3U8 stream
3. Dialog progress akan muncul
4. Extension otomatis:
   - Fetch playlist M3U8 dari server
   - Parse semua video segments URL
   - Download setiap segment secara parallel (concurrency 10)
   - Real-time progress tracking
   - Gabungkan menjadi single TS (Transport Stream) file
   - Simpan ke folder `MediaDownloader/Videos/`

### Contoh:
```javascript
// M3U8 URL dari platform streaming
https://example.com/video/stream/playlist.m3u8

// Extension akan convert ke
MediaDownloader/Videos/playlist.ts
```

### Progress Tracking:
- ✅ Real-time progress bar dengan percentage
- ✅ Menampilkan jumlah segments downloaded vs total
- ✅ Cancel dialog kapan saja
- ✅ Auto close setelah download selesai

### Supported Formats:
- `.m3u8` - HLS playlist file
- `.ts` - Transport Stream segments (output format)
- `.m4s` - MPEG-4 segments
- `.vtt` - WebVTT subtitle segments

## 🚀 Cara Menggunakan

### Development Mode / Installation

1. **Open Chrome Extensions**:
   ```
   chrome://extensions
   ```

2. **Enable Developer Mode** (toggle di kanan atas)

3. **Load Unpacked**:
   - Click "Load unpacked"
   - Pilih folder `Downloader`

4. **Test**:
   - Buka halaman web dengan media
   - Klik icon extension
   - Gambar & video otomatis terdeteksi
   - Click icon download untuk mulai download
   - Untuk M3U8: lihat progress dialog saat download

### Permissions

Extension ini meminta permissions berikut:
- `activeTab` - Akses tab aktif untuk scraping
- `scripting` - Inject content script ke halaman
- `downloads` - Akses Chrome download API
- `storage` - Simpan setting dan history

## 🎨 Tema

Menggunakan custom dark theme dengan warna:
- **Primary**: `#25D366` (WhatsApp Green)
- **Background**: `#04070D` (Deep Black)
- **Surface**: `#0B0F14`
- **Text**: `#F2F4F6`
- **Accent**: Green gradient

## 📝 Fitur Detail

### Content Script (`content-script.js`)
- Scrape `<img>` tags
- Scrape `<video>` dan `<source>` tags
- Detect M3U8 dari `data-playlist` attribute
- Extract video poster/thumbnail
- Extract CSS `backgroundImage`
- Deduplicate URLs
- File extension validation

### Background Service Worker (`background.js`)
- Handle regular download requests
- **M3U8 Stream Download Handler**:
  - Fetch & parse M3U8 playlist
  - Extract segment URLs
  - Parallel segment downloading
  - Progress callback to popup
  - Blob merging & optimization
- Batch download support
- Auto-organize by media type (Images/Videos)
- Download history tracking

### M3U8 Handler (`m3u8-handler.js`)
- Parse M3U8 playlist format
- Handle absolute & relative segment URLs
- Support multiple segment extensions (.ts, .m4s, .vtt)
- URL validation & security

### Popup UI (`popup.html/js/css`)
- Tab-based navigation (Images/Videos)
- Real-time media count stats
- Individual & batch download
- **M3U8 Progress Dialog**:
  - Informative HLS explanation
  - Real-time progress bar
  - Segment counter
  - Auto-close on completion
- Notification system
- Responsive design
- Loading & empty states

## 🔧 Customization

Edit `popup.css` untuk mengubah tema:

```css
:root {
  --primary: #25d366;           /* Warna utama */
  --background: #04070d;        /* Background */
  --surface: #0b0f14;           /* Permukaan */
  --text: #f2f4f6;              /* Teks */
  --radius: 12px;               /* Border radius */
}
```

## 📥 Download Folder

Files akan disimpan di folder default download dengan struktur:
```
Downloads/
└── MediaDownloader/
    ├── Images/
    │   ├── image_1.jpg
    │   └── image_2.png
    └── Videos/
        ├── video_1.mp4
        ├── video_2.webm
        └── stream_playlist.ts        (M3U8 output)
```

## ⚠️ Limitasi & Notes

- Maksimal 1000+ files per download batch
- File size tergantung CORS headers
- Cross-domain resources mungkin blocked
- M3U8 download tergantung segment server response time
- Large streams mungkin memakan memory (large blob)

## 🐛 Troubleshooting

### Download tidak berfungsi?
- Cek apakah URL valid dan accessible
- Cek browser console untuk error logs
- Pastikan download permission sudah granted

### Media tidak terdeteksi?
- Click tombol "Scan Ulang"
- Refresh halaman dan buka extension lagi
- Beberapa site mungkin load content secara dynamic

### M3U8 download gagal?
- Pastikan semua segment server accessible
- Cek browser console untuk CORS errors
- Beberapa platform mungkin require authentication

### CORS Error?
- Server harus allow CORS dari extension
- Beberapa resource mungkin dilindungi

## 📦 Dependencies

- No external dependencies untuk core functionality
- Chrome Manifest V3 compatible
- Pure JavaScript (ES6+)
- Native Chrome APIs only

## 🚀 Performance

- Efficient DOM scraping dengan batch processing
- M3U8 parallel downloading (concurrency: 10)
- Blob optimization untuk large files
- Memory-efficient segment handling
- Auto-cleanup blob URLs setelah download

## 📄 License

RzkyNT's Extensions - 2026 - MIT

---

**Made with ❤️ by RzkyNT**

### Changelog

#### v1.0.0 (Current)
- ✅ Initial release dengan M3U8/HLS support
- ✅ CSS-based notification system
- ✅ Video poster/thumbnail detection
- ✅ Real-time M3U8 download progress
- ✅ Automatic segment merging
