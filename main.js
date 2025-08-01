// main.js - VERSI FINAL YANG SUDAH DIPERBAIKI
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { machineIdSync } = require('node-machine-id');
const keytar = require('keytar');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let botPrediksi = null;
let botResult = null;

const SERVICE_NAME = 'MEBOT';
const ACCOUNT_NAME = 'userCredentials';

function sendLogToRenderer(channel, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const cleanMessage = message.toString().trim();
        if (cleanMessage) {
            mainWindow.webContents.send(channel, cleanMessage);
        }
    }
}

autoUpdater.on('update-available', (info) => sendLogToRenderer('log-message', `[Updater] Pembaruan tersedia: v${info.version}`));
autoUpdater.on('update-not-available', () => sendLogToRenderer('log-message', '[Updater] Versi terbaru sudah terpasang.'));
autoUpdater.on('error', (err) => sendLogToRenderer('log-message', `[Updater] Error: ${err.message}`));
autoUpdater.on('download-progress', (p) => sendLogToRenderer('log-message', `[Updater] Mengunduh: ${p.percent.toFixed(2)}%`));
autoUpdater.on('update-downloaded', (info) => {
    sendLogToRenderer('log-message', `[Updater] v${info.version} siap diinstal.`);
    if (mainWindow) {
        mainWindow.webContents.send('update-ready', info.version);
    }
});

const API_BASE_URL = 'https://us-central1-predictor-4c1fd.cloudfunctions.net';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100, height: 800, minWidth: 1000, minHeight: 700,
        icon: path.join(__dirname, 'logo.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    mainWindow.loadFile('index.html');
    mainWindow.setMenu(null);
    // mainWindow.webContents.openDevTools(); 
}

app.whenReady().then(() => {
    createWindow();
    autoUpdater.checkForUpdates();
    setInterval(() => autoUpdater.checkForUpdates(), 3600000);
});

app.on('window-all-closed', () => {
    if (botPrediksi) botPrediksi.kill('SIGINT');
    if (botResult) botResult.kill('SIGINT');
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('install-update', () => autoUpdater.quitAndInstall());

ipcMain.handle('login-attempt', async (event, { userid, password, rememberMe }) => {
    try {
        const id = machineIdSync();
        const response = await axios.post(`${API_BASE_URL}/login`, { userid, password, machineId: id });
        if (rememberMe) {
            await keytar.setPassword(SERVICE_NAME, 'userIdentifier', userid);
            await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, password);
        } else {
            await keytar.deletePassword(SERVICE_NAME, 'userIdentifier');
            await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
        }
        return { success: true, ...response.data };
    } catch (error) {
        return { success: false, message: error.response?.data?.error || 'Server tidak merespon.' };
    }
});

ipcMain.handle('get-saved-credentials', async () => {
    const userid = await keytar.getPassword(SERVICE_NAME, 'userIdentifier');
    const password = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return (userid && password) ? { userid, password } : null;
});

ipcMain.handle('register-attempt', async (event, { userid, password, gmail, whatsapp, duration }) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/register`, {
            userid, password, gmail, whatsapp, duration
        });
        if (response.data && (response.status === 200 || response.data.success)) {
            const priceMap = { '1': 160000, '3': 350000, '12': 687500 };
            const baseAmount = priceMap[duration];
            if (!baseAmount) return { success: false, message: 'Durasi paket yang dipilih tidak valid.' };
            const uniqueCode = Math.floor(Math.random() * 900) + 100;
            const finalAmount = baseAmount + uniqueCode;
            return { success: true, message: 'Pendaftaran berhasil.', paymentDetails: { amount: finalAmount, baseAmount: baseAmount, uniqueCode: uniqueCode } };
        } else {
            return { success: false, message: response.data.message || 'Gagal mendaftar di server.' };
        }
    } catch (error) {
        return { success: false, message: error.response?.data?.error || 'Gagal terhubung ke server pendaftaran.' };
    }
});

ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }] });
    return { filePath: canceled ? null : filePaths[0] };
});

// --- "ME" BOT HANDLERS ---
function startMeBot({ botType, groupName, excelPath, celebrationMessages }) {
    if ((botType === 'prediksi' && botPrediksi) || (botType === 'result' && botResult)) {
        if (mainWindow) mainWindow.webContents.send(`bot-me-log`, { bot: botType, message: `Bot sudah berjalan.` });
        return;
    }
    const scriptPath = botType === 'prediksi' ? path.join(__dirname, 'autoSender.js') : path.join(__dirname, 'scrape.js');
    if (!fs.existsSync(scriptPath)) {
        if (mainWindow) mainWindow.webContents.send(`bot-me-log`, { bot: botType, message: `ERROR: File skrip ${scriptPath} tidak ditemukan.` });
        return;
    }
    const userDataPath = app.getPath('userData');
    const sessionPath = path.join(userDataPath, `me-${botType}-session`);
    const args = [scriptPath, groupName, excelPath, sessionPath];

    if (botType === 'result') {
        args.push(JSON.stringify(celebrationMessages || []));
        // ## INI ADALAH PERBAIKAN ##
        // Memanggil fungsi internal 'loadJpSettings()' dengan benar.
        const jpSettings = loadJpSettings();
        args.push(JSON.stringify(jpSettings));
    }

    if (mainWindow) mainWindow.webContents.send(`bot-me-log`, { bot: botType, message: `Memulai bot...` });

    const proc = spawn(process.execPath, args, {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    if (botType === 'prediksi') botPrediksi = proc;
    else botResult = proc;

    proc.on('message', msg => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (msg.type === 'log') mainWindow.webContents.send(`bot-me-log`, { bot: botType, message: msg.message });
            else if (msg.type === 'qr') mainWindow.webContents.send(`bot-me-qr`, { bot: botType, data: msg.data });
            else if (msg.type === 'status') mainWindow.webContents.send(`bot-me-status`, { bot: botType, status: msg.status });
        }
    });

    proc.stdout.on('data', data => sendLogToRenderer(`bot-me-log`, { bot: botType, message: `[STDOUT] ${data}` }));
    proc.stderr.on('data', data => sendLogToRenderer(`bot-me-log`, { bot: botType, message: `[STDERR] ${data}` }));

    proc.on('exit', (code) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`bot-me-log`, { bot: botType, message: `Proses bot berhenti dengan kode: ${code}.` });
            mainWindow.webContents.send('bot-me-status', { bot: botType, status: 'Stopped' });
        }
        if (botType === 'prediksi') botPrediksi = null; else botResult = null;
    });
}

function stopMeBot(botType) {
    const botProcess = botType === 'prediksi' ? botPrediksi : botResult;
    if (botProcess) botProcess.kill('SIGINT');
    else if (mainWindow) mainWindow.webContents.send(`bot-me-log`, { bot: botType, message: `Bot tidak sedang berjalan.` });
}

function resetMeBotSession(botType) {
    stopMeBot(botType);
    const sessionDir = path.join(app.getPath('userData'), `me-${botType}-session`);
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        if (mainWindow) {
            mainWindow.webContents.send('bot-me-log', { bot: botType, message: `Sesi berhasil direset.` });
            mainWindow.webContents.send('bot-me-status', { bot: botType, status: 'Session Reset' });
        }
    } else if (mainWindow) {
        mainWindow.webContents.send('bot-me-log', { bot: botType, message: `Tidak ada sesi yang perlu direset.` });
    }
}

ipcMain.on('start-bot-me', (event, data) => startMeBot(data));
ipcMain.on('stop-bot-me', (event, botType) => stopMeBot(botType));
ipcMain.on('reset-bot-me', (event, botType) => resetMeBotSession(botType));

const getMeSettingsPath = () => path.join(app.getPath('userData'), 'meSettings.json');
ipcMain.handle('save-me-settings', (event, data) => { fs.writeFileSync(getMeSettingsPath(), JSON.stringify(data, null, 2)); return { success: true }; });
ipcMain.handle('get-me-settings', () => { const filePath = getMeSettingsPath(); return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : {}; });

const getCelebrationSettingsPath = () => path.join(app.getPath('userData'), 'celebrationSettings.json');
ipcMain.handle('save-celebration-settings', (event, data) => { try { fs.writeFileSync(getCelebrationSettingsPath(), JSON.stringify(data, null, 2)); return { success: true }; } catch (error) { return { success: false, message: error.message }; } });
ipcMain.handle('get-celebration-settings', () => { const filePath = getCelebrationSettingsPath(); if (fs.existsSync(filePath)) { try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (error) { return {}; } } return {}; });

const getJpSettingsPath = () => path.join(app.getPath('userData'), 'jpSettings.json');

// ## INI ADALAH PERBAIKAN ##
// Logika dipindahkan ke fungsi ini.
function loadJpSettings() {
    const defaultFormats = {
        bbfs4d_twin: "✅ JP POLTAR 432D {label}", bbfs4d: "✅ JP 432D {label}",
        bbfs3d_twin: "✅ JP POLTAR 32D {label}", bbfs3d: "✅ JP 32D {label}",
        bbfs2d: "✅ JP 2D {label}", cb: "✅ JP CB: {matches}",
        "2d_lurus": "✅ JP 2D LURUS", "2d_bb": "✅ JP 2D BB",
        d4_lurus: "✅ JP 432D LURUS 1LINE", d4_poltar_4d: "✅ JP POLTAR 432D 1LINE",
        d4_4d: "✅ JP 432D 1LINE", d4_poltar_3d: "✅ JP POLTAR 32D 1LINE",
        d4_3d: "✅ JP 32D 1LINE", d4_2d: "✅ JP 2D 1LINE"
    };
    const filePath = getJpSettingsPath();
    if (fs.existsSync(filePath)) {
        try {
            const savedFormats = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return { ...defaultFormats, ...savedFormats };
        } catch (error) { return defaultFormats; }
    }
    return defaultFormats;
}

ipcMain.handle('save-jp-settings', (event, data) => {
    try {
        fs.writeFileSync(getJpSettingsPath(), JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// Handler IPC sekarang hanya memanggil fungsi internal yang aman.
ipcMain.handle('get-jp-settings', () => {
    return loadJpSettings();
});