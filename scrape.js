// FINALBOT/bots/bot-result/scrape.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const bacaPrediksi = require('./bacaPrediksiExcel');
const cekJP = require('./cekJP');

// Fungsi untuk delay (penundaan)
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Fungsi untuk mengirim pesan log ke proses utama Electron (akan tampil di UI log)
const sendLog = (type, message) => {
    if (process.send) { // process.send tersedia jika dijalankan sebagai child_process oleh Electron
        process.send({ type: type, bot: 'result', message: `[RESULT] ${message}` });
    } else {
        // Fallback untuk debugging jika dijalankan langsung dari CLI (bukan dari Electron)
        console[type](`[RESULT] ${message}`);
    }
};

// Fungsi untuk mengirim QR code ke proses utama Electron (akan tampil di container QR UI)
const sendQr = (qr) => {
    if (process.send) {
        process.send({ type: 'qr', bot: 'result', data: qr });
    } else {
        const qrcode = require('qrcode-terminal');
        qrcode.generate(qr, { small: true });
        console.log('Scan QR ini (CLI fallback)');
    }
};

// Fungsi untuk mengirim status bot ke proses utama Electron (akan tampil di status UI)
const sendStatus = (status) => {
    if (process.send) {
        process.send({ type: 'status', bot: 'result', status: status });
    } else {
        console.log(`[RESULT] Status: ${status}`);
    }
};

// Variabel untuk menyimpan ID timer interval scraping, untuk kontrol penghentian
let scrapingIntervalId = null;
// Variabel global untuk instance browser Puppeteer
let browserInstance = null;
// Variabel global untuk instance halaman Puppeteer
let pageInstance = null;

// --- Ambil argumen dari baris perintah yang diberikan oleh Electron UI ---
const GROUP_NAME = process.argv[2];
const EXCEL_RESULT_FILE_PATH = process.argv[3];
const sessionPath = process.argv[4];

// =================================================================
// ### BAGIAN YANG DIPERBARUI: Ambil Argumen Tambahan ###
// =================================================================
// Argumen ke-5: Kalimat selebrasi (JSON string)
const CELEBRATION_MESSAGES = process.argv[5] ? JSON.parse(process.argv[5]) : [];
// Argumen ke-6: Format pesan JP (JSON string)
const JP_FORMATS = process.argv[6] ? JSON.parse(process.argv[6]) : {};
// =================================================================


// Validasi argumen: Pastikan nama grup dan jalur file Excel telah diberikan dari UI
if (!GROUP_NAME || !EXCEL_RESULT_FILE_PATH || !sessionPath) {
    sendLog('error', 'Nama grup WA, jalur file Excel result, atau sessionPath tidak diberikan sebagai argumen.');
    sendLog('error', 'Penggunaan: node scrape.js <nama_grup_wa> <jalur_file_excel_result> <session_path>');
    sendStatus('error'); // Perbarui status UI menjadi error
    process.exit(1); // Keluar dari proses dengan kode error
}

// Daftar pasaran yang dipantau (sesuai yang Anda berikan)
const monitoredPasaran = [
    "TOTO CAMBODIA LIVE", "BULLSEYE", "PCSO", "SYDNEY LOTTO", "HONGKONG LOTTO",
    "SINGAPORE", "MAGNUM4D", "TOTO MACAU SORE", "TOTO MACAU MALAM 1",
    "TOTO MACAU MALAM 2", "TOTO MACAU MALAM 3", "TOTO MACAU PAGI",
    "TOTO MACAU SIANG", "HUAHIN1630", "HUAHIN2100", "KING KONG4D SORE",
    "KING KONG4D MALAM", "CHELSEA19", "CHELSEA21", "CHELSEA11", "CHELSEA15",
    "POIPET19", "POIPET22", "POIPET12", "POIPET15", "TOTOMALI2030",
    "TOTOMALI2330", "TOTOMALI1530", "BRUNEI21", "BRUNEI14", "NEVADA", "HOKI DRAW", "OREGON 12"
];

// Fungsi format tanggal Indonesia
function indoDate() {
    const hari = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const bulan = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
    let d = new Date();
    let h = hari[d.getDay()];
    let t = String(d.getDate()).padStart(2, "0");
    let b = bulan[d.getMonth()];
    let y = String(d.getFullYear()).slice(-2);
    return `${h}, ${t} ${b} ${y}`;
}

// Fungsi untuk membandingkan hasil lama dan baru
function compareResults(prev, curr) {
    const changed = [];
    const prevMap = {};
    prev.forEach(p => {
        prevMap[p.Pasaran] = { Periode: p.Periode, Angka: p.Angka };
    });
    curr.forEach(c => {
        if (!monitoredPasaran.includes(c.Pasaran)) return; // Hanya pantau pasaran yang ada di daftar
        const p = prevMap[c.Pasaran];
        if (!p || p.Periode !== c.Periode || p.Angka !== c.Angka) {
            changed.push(c);
        }
    });
    return changed;
}

// WA BOT SETUP: Inisialisasi client WhatsApp-Web.js
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }), // Gunakan sessionPath yang diterima
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
        ]
    }
});
// Event ketika QR code siap (akan dikirim ke UI Electron)
client.on('qr', qr => {
    sendLog('log', '✅ Bot menerima data QR dari WhatsApp-Web.js. Silakan scan QR code di UI.');
    sendQr(qr);
});

// Event ketika bot siap digunakan
client.on('ready', async () => {
    sendLog('log', '✅ Bot WhatsApp RESULT aktif dan terhubung ke perangkat.');
    sendStatus('ready');
    sendLog('log', 'Menunggu 5 detik untuk sinkronisasi chat bot RESULT...');
    await delay(5000);
    startScraping();
});

// Event ketika bot terputus
client.on('disconnected', (reason) => {
    sendLog('log', `Bot RESULT terputus: ${reason}`);
    sendStatus('disconnected');
    if (scrapingIntervalId) {
        clearInterval(scrapingIntervalId);
        scrapingIntervalId = null;
        sendLog('log', 'Interval scraping dihentikan karena bot terputus.');
    }
});

// Event ketika autentikasi gagal
client.on('auth_failure', (msg) => {
    sendLog('error', `Autentikasi bot RESULT gagal: ${msg}`);
    sendStatus('auth_failure');
    if (scrapingIntervalId) {
        clearInterval(scrapingIntervalId);
        scrapingIntervalId = null;
        sendLog('log', 'Interval scraping dihentikan karena autentikasi gagal.');
    }
});

async function resetWhatsAppClientAndBrowser() {
    sendLog('log', 'Mencoba me-reset dan menginisialisasi ulang client WA dan browser Puppeteer...');
    sendStatus('restarting');

    if (scrapingIntervalId) {
        clearInterval(scrapingIntervalId);
        scrapingIntervalId = null;
        sendLog('log', 'Interval scraping dihentikan untuk reset.');
    }

    try {
        if (client && client.pupPage) {
            await client.destroy();
            sendLog('log', 'Client WhatsApp telah dihancurkan.');
        } else {
            sendLog('log', 'Client WhatsApp tidak aktif, tidak perlu dihancurkan.');
        }
    } catch (e) {
        sendLog('error', `Gagal menghancurkan client WA: ${e.message}`);
    }

    try {
        if (browserInstance) {
            await browserInstance.close();
            sendLog('log', 'Browser Puppeteer telah ditutup.');
        } else {
            sendLog('log', 'Browser Puppeteer tidak aktif, tidak perlu ditutup.');
        }
    } catch (e) {
        sendLog('error', `Gagal menutup browser Puppeteer: ${e.message}`);
    }

    browserInstance = null;
    pageInstance = null;

    try {
        await client.initialize();
        sendLog('log', 'Client WhatsApp berhasil diinisialisasi ulang. Menunggu ready...');
    } catch (e) {
        sendLog('error', `Gagal menginisialisasi ulang client WA: ${e.message}`);
        sendStatus('error');
    }
}


let prevResults = [];
const lastSentFile = 'lastSent.json';
let isFirstLoop = true;

if (fs.existsSync(lastSentFile)) {
    try {
        prevResults = JSON.parse(fs.readFileSync(lastSentFile, 'utf-8'));
        sendLog('log', 'Memuat hasil sebelumnya dari lastSent.json');
    } catch (e) {
        prevResults = [];
        sendLog('error', 'lastSent.json rusak atau tidak dapat dibaca, memulai dari kosong.');
    }
}

function normalizeName(str) {
    return str.toString().replace(/[^\w\s]/g, '').trim().toUpperCase();
}

async function startScraping() {
    if (!browserInstance || !pageInstance || pageInstance.isClosed()) {
        try {
            browserInstance = await puppeteer.launch({ headless: "new", args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
            ] });
            pageInstance = await browserInstance.newPage();
            sendLog('log', 'Browser Puppeteer berhasil diluncurkan untuk scraping.');
        } catch (e) {
            sendLog('error', `Gagal meluncurkan Puppeteer untuk scraping: ${e.message}`);
            sendStatus('error');
            client.destroy().then(() => sendLog('log', 'Bot RESULT dihentikan karena Puppeteer gagal diluncurkan.'));
            return;
        }
    }

    await scrapeAndSend();
    scrapingIntervalId = setInterval(async () => {
        await scrapeAndSend();
    }, 30000);
}

async function scrapeAndSend() {
    try {
        if (!pageInstance || pageInstance.isClosed()) {
            sendLog('warn', 'Halaman Puppeteer tidak valid atau tertutup, mencoba membuat ulang...');
            pageInstance = await browserInstance.newPage();
        }

        await pageInstance.goto('https://saldowdhebat.com/#/index?category=lottery', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await delay(10000);

        const results = await pageInstance.evaluate(() => {
            function extractNumbers(str) {
                if (!str) return [];
                return str.split(',').map(a => a.trim());
            }
            let items = Array.from(document.querySelectorAll('.game-item.lottery'));
            let data = [];
            items.forEach(item => {
                let pasaran = item.querySelector('h3')?.innerText?.trim() || '';
                let periode = item.querySelector('.lottery-countdown')?.innerText?.match(/PERIODE:\s*([0-9]+)/i)?.[1] || '';
                let angka = item.querySelector('.lottery-number')?.innerText?.trim() || '';
                let result = extractNumbers(angka);
                data.push({ Pasaran: pasaran, Periode: periode, ResultArray: result, Angka: result.join(', ') });
            });
            return data;
        });

        const monitoredResults = results.filter(r => monitoredPasaran.includes(r.Pasaran));
        const prediksiMap = bacaPrediksi(EXCEL_RESULT_FILE_PATH);

        if (isFirstLoop) {
            prevResults = monitoredResults;
            fs.writeFileSync(lastSentFile, JSON.stringify(prevResults, null, 2));
            isFirstLoop = false;
            sendLog('log', 'Inisialisasi data result, tidak kirim ke WA pada loop pertama.');
        } else {
            const changed = compareResults(prevResults, monitoredResults);

            if (changed.length > 0) {
                for (const c of changed) {
                    let message = `📢 RESULT - *${c.Pasaran.toUpperCase()}*\n📢 ${indoDate()}\n\n`;
                    if (c.ResultArray.length === 1) {
                        message += `🥇 HASIL : ${c.ResultArray[0]}\n`;
                    } else if (c.ResultArray.length === 3) {
                        message += `🥇 PRIZE 1 : ${c.ResultArray[0]}\n`;
                        message += `🥈 PRIZE 2 : ${c.ResultArray[1]}\n`;
                        message += `🥉 PRIZE 3 : ${c.ResultArray[2]}\n`;
                    }

                    const keyPasaran = normalizeName(c.Pasaran);
                    const prediksi = prediksiMap[keyPasaran];
                    let jpMsg = '';
                    if (prediksi && c.ResultArray[0]) {
                        // =================================================================
                        // ### BAGIAN YANG DIPERBAIKI: Kirim semua pengaturan ke cekJP ###
                        // =================================================================
                        jpMsg = cekJP(c.ResultArray[0], prediksi, CELEBRATION_MESSAGES, JP_FORMATS);
                        // =================================================================
                    }
                    if (jpMsg) message += `\n${jpMsg}`;

                    let chats = await client.getChats();
                    let groupMatches = chats.filter(chat => chat.isGroup && chat.name === GROUP_NAME);

                    if (groupMatches.length === 0) {
                        sendLog('error', `[WA] Grup "${GROUP_NAME}" untuk RESULT tidak ditemukan! Pastikan nama grup benar dan bot sudah join grup tersebut.`);
                        continue;
                    }
                    let group = groupMatches[0];

                    await client.sendMessage(group.id._serialized, message);
                    sendLog('log', `[WA] Pesan terkirim ke grup "${GROUP_NAME}": ${c.Pasaran} - ${c.ResultArray.join(', ')}`);
                    await delay(1000);
                }

                sendLog('log', `[${new Date().toLocaleTimeString()}] ${changed.length} PASARAN UPDATE & SUDAH DIKIRIM KE WA`);
                if (process.send) {
                    process.send({ type: 'table', bot: 'result', data: changed });
                } else {
                    console.table(changed);
                }

                prevResults = monitoredResults;
                fs.writeFileSync(lastSentFile, JSON.stringify(prevResults, null, 2));
            } else {
                sendLog('log', `[${new Date().toLocaleTimeString()}] Tidak ada update pasaran baru.`);
            }
            fs.writeFileSync('resultPasaran.json', JSON.stringify(monitoredResults, null, 2));
        }
    } catch (e) {
        sendLog('error', `❌ Error scraping/sending: ${e.message}`);

        if (e.message.includes('_serialized') || e.message.includes('Protocol error')) {
            sendLog('error', 'Terdeteksi error kritis di WhatsApp Web atau Puppeteer. Mencoba me-reset dan menginisialisasi ulang bot.');
            await resetWhatsAppClientAndBrowser();
        }
        else if (e.message.includes('Navigation timeout')) {
             sendLog('error', 'Navigasi ke halaman scraping timeout. Memulai ulang browser Puppeteer.');
             try {
                if (browserInstance) await browserInstance.close();
            } catch (closeErr) { sendLog('warn', `Gagal menutup browser lama setelah timeout: ${closeErr.message}`); }
            browserInstance = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            pageInstance = await browserInstance.newPage();
            sendLog('log', 'Browser Puppeteer berhasil dimulai ulang setelah timeout.');
        }
        else if (e.message.includes('browser has disconnected') || e.message.includes('target closed')) {
            sendLog('error', 'Browser Puppeteer terputus atau target ditutup, mencoba memulai ulang browser...');
            try {
                if (browserInstance) await browserInstance.close();
            } catch (closeErr) { sendLog('warn', `Gagal menutup browser lama: ${closeErr.message}`); }
            browserInstance = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            pageInstance = await browserInstance.newPage();
            sendLog('log', 'Browser Puppeteer berhasil dimulai ulang.');
        } else {
            sendLog('error', `Error tidak dikenal: ${e.message}`);
        }
    }
}
process.on('SIGINT', async () => {
    sendLog('log', 'Menerima sinyal SIGINT (perintah penghentian), mematikan bot result...');
    if (scrapingIntervalId) {
        clearInterval(scrapingIntervalId);
        scrapingIntervalId = null;
    }
    if (browserInstance) {
        await browserInstance.close();
        sendLog('log', 'Browser Puppeteer telah ditutup.');
    }
    await client.destroy();
    sendLog('log', 'Bot result telah dimatikan.');
    process.exit(0);
});

client.initialize().catch(err => {
    if (err.message.includes('Timeout')) {
        sendLog('error', 'Inisialisasi bot RESULT timeout. Pastikan koneksi internet stabil atau coba reset sesi.');
    } else {
        sendLog('error', `Gagal inisialisasi bot RESULT: ${err.message}`);
    }
    sendStatus('error');
    process.exit(1);
});