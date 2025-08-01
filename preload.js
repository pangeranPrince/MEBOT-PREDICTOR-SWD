// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Membuat objek API untuk diekspos dengan aman ke renderer process
const api = {
    // --- FUNGSI INVOKE (Mengirim dan Menunggu Hasil) ---
    loginAttempt: (credentials) => ipcRenderer.invoke('login-attempt', credentials),
    registerAttempt: (data) => ipcRenderer.invoke('register-attempt', data),
    getSavedCredentials: () => ipcRenderer.invoke('get-saved-credentials'),

    invoke: (channel, data) => {
        const validChannelsInvoke = [
            'open-file-dialog', 
            'get-me-settings', 
            'save-me-settings',
            'get-celebration-settings',
            'save-celebration-settings',
            // --- CHANNEL BARU UNTUK PENGATURAN JP ---
            'get-jp-settings',
            'save-jp-settings'
        ]; 
        if (validChannelsInvoke.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
        return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
    },

    // --- FUNGSI SEND (Mengirim Perintah Tanpa Menunggu Hasil) ---
    installUpdate: () => ipcRenderer.send('install-update'),

    send: (channel, data) => {
        const validChannels = ['start-bot-me', 'stop-bot-me', 'reset-bot-me'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    // --- PENERIMA EVENT DARI MAIN PROCESS ---
    receive: (channel, func) => {
        const validChannels = [
            'log-message',    // Untuk log umum (updater, dll)
            'update-ready',
            // Channel spesifik untuk bot ME
            'bot-me-log', 'bot-me-qr', 'bot-me-status'
        ];
        
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
};

// Menambahkan 'on' sebagai alias dari 'receive' untuk kompatibilitas
api.on = api.receive;

// Mengekspos objek API ke window di renderer process
contextBridge.exposeInMainWorld('api', api);