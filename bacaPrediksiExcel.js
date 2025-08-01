// bacaPrediksiExcel.js (di dalam FINALBOT/bots/bot-result/)

const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Fungsi sekarang menerima filePath sebagai argumen
function bacaPrediksi(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        // Log error ini harus dikirim ke parent process (Electron) jika memungkinkan
        if (process.send) {
            process.send({ type: 'log', bot: 'result', message: `❌ File Excel RESULT tidak ditemukan di: ${filePath}` });
        } else {
            console.log(`❌ File Excel RESULT tidak ditemukan di: ${filePath}`);
        }
        return {};
    }

    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const prediksiMap = {};
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue;

        const cleanName = row[0]
            .toString()
            .replace(/[^\w\s]/g, '')
            .trim()
            .toUpperCase();

        prediksiMap[cleanName] = {
            nama: row[0].toString().trim(),
            bbfs7d: (row[1] || '').toString().trim(),
            bbfs5d: (row[2] || '').toString().trim(),
            cb: (row[3] || '').toString().split(/[-–]/).map(x => x.trim()).filter(Boolean),
            d2: (row[4] || '').toString().split(/[-–]/).map(x => x.trim()).filter(Boolean),
            d4: (row[5] || '').toString().split(/[-–]/).map(x => x.trim()).filter(Boolean),
        };
    }

    return prediksiMap;
}

module.exports = bacaPrediksi;