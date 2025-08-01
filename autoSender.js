// autoSender.js (di dalam FINALBOT/bots/bot-prediksi/)

const { Client, LocalAuth } = require('whatsapp-web.js');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs'); // Tambahkan ini untuk fs.existsSync

// Fungsi untuk mengirim pesan log ke proses utama Electron
// Di lingkungan Electron, process.send() akan tersedia jika dijalankan sebagai child_process
const sendLog = (type, message) => {
    if (process.send) {
        process.send({ type: type, bot: 'prediksi', message: `[PREDIKSI] ${message}` });
    } else {
        // Fallback jika tidak dijalankan oleh Electron (untuk debugging lokal)
        console[type](`[PREDIKSI] ${message}`);
    }
};

const sendQr = (qr) => {
    if (process.send) {
        process.send({ type: 'qr', bot: 'prediksi', data: qr });
    } else {
        // qrcode-terminal tidak akan digunakan di Electron UI, tapi bisa untuk debug CLI
        const qrcode = require('qrcode-terminal');
        qrcode.generate(qr, { small: true });
        console.log('Scan QR ini untuk bot PREDIKSI');
    }
};

const sendStatus = (status) => {
    if (process.send) {
        process.send({ type: 'status', bot: 'prediksi', status: status });
    }
};

// Ambil argumen dari baris perintah yang diberikan oleh Electron
// process.argv[0] = 'node'
// process.argv[1] = 'path/to/autoSender.js'
// process.argv[2] = nama_grup
// process.argv[3] = jalur_file_excel
// process.argv[4] = sessionPath (BARU: jalur sesi spesifik untuk bot ini)
const targetGroup = process.argv[2];
const excelFilePath = process.argv[3];
const sessionPath = process.argv[4]; // Ambil sessionPath dari argumen

if (!targetGroup || !excelFilePath || !sessionPath) {
    sendLog('error', 'Nama grup WA, jalur file Excel prediksi, atau sessionPath tidak diberikan sebagai argumen.');
    sendLog('error', 'Usage: node autoSender.js <nama_grup_wa> <jalur_file_excel> <session_path>');
    process.exit(1); // Keluar dengan error
}

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

client.on('qr', qr => {
    sendQr(qr);
});

client.on('ready', async () => {
    sendLog('log', '✅ Bot WhatsApp PREDIKSI aktif dan terhubung ke perangkat.');
    sendStatus('ready');

    const everydayExcluded = [
        // Contoh: [1, 12],
    ];
    const conditionalExclusions = [
        { days: [2, 5], range: [235, 246] }, // Selasa & Jumat
        { days: [1, 4, 5], range: [261, 272] }, // Senin, Kamis & Jumat
        { days: [0],      range: [339, 350] }  // Minggu
        // ... tambahkan rentang dan hari lain jika ada
    ];

    if (!fs.existsSync(excelFilePath)) {
        sendLog('error', `🚫 File Excel prediksi tidak ditemukan di: ${excelFilePath}`);
        sendStatus('error');
        // Tutup bot jika file penting tidak ada
        client.destroy().then(() => sendLog('log', 'Bot prediksi dihentikan karena file Excel tidak ditemukan.'));
        return;
    }

    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const excelTimeToDate = excelValue => {
        if (typeof excelValue !== 'number') return null;
        const totalSeconds = Math.round(excelValue * 24 * 60 * 60);
        const date = new Date();
        date.setHours(Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60, 0);
        return date;
    };

    const MAX_DATA_ROW = 610;
    const ROWS_PER_BLOCK = 12;
    const BLOCK_SEPARATOR_ROWS = 1;
    const BLOCK_CYCLE_LENGTH = ROWS_PER_BLOCK + BLOCK_SEPARATOR_ROWS;

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxSheetRow = range.e.r + 1;

    client.getChats().then(chats => {
        const groupChat = chats.find(c => c.isGroup && c.name === targetGroup);

        if (!groupChat) {
            sendLog('error', `🚫 Grup \"${targetGroup}\" tidak ditemukan! Pastikan nama grup benar dan bot sudah join grup tersebut.`);
            sendStatus('error');
            sendLog('error', `🚨 Penjadwalan pesan dibatalkan karena grup tidak ditemukan.`);
            client.destroy().then(() => sendLog('log', 'Bot prediksi dihentikan karena grup tidak ditemukan.'));
            return;
        }
        sendLog('log', `✅ Grup \"${targetGroup}\" berhasil ditemukan. Memulai penjadwalan pesan.`);

        // --- Fungsi untuk memanipulasi URL agar tidak menampilkan pratinjau ---
        const preventLinkPreview = (text) => {
            return text.replace(
                /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/[a-zA-Z0-9]+\.[^\s]{2,}|[a-zA-Z0-9]+\.[^\s]{2,})/ig,
                (match) => {
                    if (match.length > 5) {
                        let newLink = '';
                        for (let i = 0; i < match.length; i++) {
                            newLink += match[i];
                            if ((i + 1) % 3 === 0 && i < match.length - 1) {
                                newLink += '\u200B';
                            }
                        }
                        return newLink;
                    }
                    return match;
                }
            );
        };
        // --- AKHIR Fungsi preventLinkPreview ---

        for (let R_start_of_block_0_based = 0; ; R_start_of_block_0_based += BLOCK_CYCLE_LENGTH) {
            const blockStartRow_1_based = R_start_of_block_0_based + 1;
            const blockEndRow_1_based = blockStartRow_1_based + ROWS_PER_BLOCK - 1;

            if (blockStartRow_1_based > MAX_DATA_ROW) {
                sendLog('log', `--- Batas pemrosesan data (maks. ${MAX_DATA_ROW}) tercapai. Menghentikan penjadwalan blok.`);
                break;
            }
            if (blockEndRow_1_based > MAX_DATA_ROW) {
                sendLog('log', `⚠️ Blok dimulai dari ${blockStartRow_1_based} tidak memiliki 12 baris penuh dalam batas ${MAX_DATA_ROW}. Menghentikan penjadwalan.`);
                break;
            }
            if (blockStartRow_1_based > maxSheetRow) {
                sendLog('log', `--- Batas sheet Excel (${maxSheetRow}) tercapai. Menghentikan penjadwalan blok.`);
                break;
            }

            const waktuCell = sheet[xlsx.utils.encode_cell({ r: R_start_of_block_0_based, c: 7 })];
            const waktuRaw = waktuCell ? waktuCell.v : null;
            const targetTime = waktuRaw ? excelTimeToDate(waktuRaw) : null;

            let isiPesanFinalLines = [];
            const getCleanCellValue = (row_0_based, col_0_based) => {
                const cellAddress = xlsx.utils.encode_cell({ r: row_0_based, c: col_0_based });
                const cell = sheet[cellAddress];
                return (cell && cell.v !== undefined && cell.v !== null) ? String(cell.v).trim() : '';
            };
            
            for (let i = 0; i < ROWS_PER_BLOCK; i++) {
                const currentRow_0_based = R_start_of_block_0_based + i;
                const currentRowsColsAtoG = [];
                for (let C_idx = 0; C_idx <= 6; C_idx++) {
                    const cellValue = getCleanCellValue(currentRow_0_based, C_idx);
                    if (cellValue) {
                        currentRowsColsAtoG.push(cellValue);
                    }
                }
                if (currentRowsColsAtoG.length > 0) {
                    isiPesanFinalLines.push(currentRowsColsAtoG.join(' ')); 
                } else {
                    isiPesanFinalLines.push(''); 
                }
            }
            
            const rawIsiPesanFinal = isiPesanFinalLines.join('\n');
            const isiPesanFinal = preventLinkPreview(rawIsiPesanFinal);

            if (!targetTime || !isiPesanFinal.trim()) {
                sendLog('log', `⛔ Dilewati blok ${blockStartRow_1_based}-${blockEndRow_1_based} — waktu atau isi pesan gabungan kosong.`);
                continue;
            }

            const now      = new Date();
            const delayMs = targetTime - now;

            if (delayMs <= 0) {
                sendLog('log', `⚠️ Waktu untuk blok ${blockStartRow_1_based}-${blockEndRow_1_based} sudah lewat. Pesan tidak dijadwalkan.`);
                continue;
            }

            const waktuStr = targetTime.toTimeString().split(' ')[0];
            sendLog('log', `📌 Menjadwalkan BLOK ${blockStartRow_1_based}-${blockEndRow_1_based} ➜ Kirim jam ${waktuStr} WIB`);

            ((blockStart, blockEnd, messageContent, groupToSendMessage, sendTimeStr) => {
                setTimeout(() => {
                    const today = new Date().getDay();

                    const overlaps = (s1, e1, s2, e2) => Math.max(s1, s2) <= Math.min(e1, e2);

                    const skipEveryday = everydayExcluded.some(([s, e]) => overlaps(blockStart, blockEnd, s, e));
                    const skipConditional = conditionalExclusions.some(cond =>
                        cond.days.includes(today) && overlaps(blockStart, blockEnd, cond.range[0], cond.range[1])
                    );

                    if (skipEveryday || skipConditional) {
                        sendLog('log', `⛔ Blok ${blockStart}-${blockEnd} di-skip sesuai aturan pengecualian.`);
                        return;
                    }

                    groupToSendMessage.sendMessage(messageContent)
                        .then(() => sendLog('log', `✅ Terkirim ke ${targetGroup} dari blok ${blockStart}-${blockEnd} pada ${sendTimeStr} WIB`))
                        .catch(err => sendLog('error', `❌ Gagal mengirim pesan dari blok ${blockStart}-${blockEnd} ke ${targetGroup}: ${err.message}`));
                }, delayMs);
            })(blockStartRow_1_based, blockEndRow_1_based, isiPesanFinal, groupChat, waktuStr);
        }
    }).catch(err => {
        sendLog('error', "Fatal Error: Gagal mendapatkan daftar chat saat startup:", err);
        sendLog('error', "Pastikan bot terhubung ke WhatsApp Web dan tidak ada masalah sesi.");
        sendStatus('error');
        client.destroy(); // Coba hancurkan client jika ada error fatal
    });
});

client.on('disconnected', (reason) => {
    sendLog('log', `Bot PREDIKSI terputus: ${reason}`);
    sendStatus('disconnected');
});

client.on('auth_failure', (msg) => {
    sendLog('error', `Autentikasi bot PREDIKSI gagal: ${msg}`);
    sendStatus('auth_failure');
});

// Penanganan sinyal untuk graceful shutdown
process.on('SIGINT', async () => {
    sendLog('log', 'Menerima sinyal SIGINT, mematikan bot prediksi...');
    await client.destroy();
    sendLog('log', 'Bot prediksi telah dimatikan.');
    process.exit(0);
});

client.initialize().catch(err => {
    if (err.message.includes('Timeout')) {
        sendLog('error', 'Inisialisasi bot PREDIKSI timeout. Pastikan koneksi internet stabil atau coba reset sesi.');
    } else {
        sendLog('error', `Gagal inisialisasi bot PREDIKSI: ${err.message}`);
    }
    sendStatus('error');
    process.exit(1);
});
