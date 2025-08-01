// renderer.js

// --- Elemen Global & Layar ---
const loginScreen = document.getElementById('login-screen');
const registerScreen = document.getElementById('register-screen');
const mainAppScreen = document.getElementById('main-app');
const paymentModal = document.getElementById('payment-modal');
const allScreens = [loginScreen, registerScreen, mainAppScreen];

// --- Elemen Layar Login & Daftar (Diperbarui) ---
const loginUseridInput = document.getElementById('login-userid');
const loginPasswordInput = document.getElementById('login-password');
const toggleLoginPassword = document.getElementById('toggle-login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');
const linkToRegister = document.getElementById('link-to-register');

const registerUseridInput = document.getElementById('register-userid');
const registerPasswordInput = document.getElementById('register-password');
const toggleRegisterPassword = document.getElementById('toggle-register-password');
const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
const toggleRegisterConfirmPassword = document.getElementById('toggle-register-confirm-password');
const registerGmailInput = document.getElementById('register-gmail');
const registerWhatsappInput = document.getElementById('register-whatsapp');
const btnRegister = document.getElementById('btn-register');
const registerError = document.getElementById('register-error');
const linkToLoginFromRegister = document.getElementById('link-to-login-from-register');

// Elemen Modal Pembayaran
const paymentAmount = document.getElementById('payment-amount');
const btnClosePaymentModal = document.getElementById('btn-close-payment-modal');

// --- Elemen Modal Pengaturan Selebrasi ---
const settingsModal = document.getElementById('settings-modal');
const btnSettingsCelebration = document.getElementById('btn-settings-celebration'); // Tombol baru
const celebrationTextArea = document.getElementById('celebration-text');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');

// --- BAGIAN BARU: Elemen Modal Pengaturan JP ---
const jpSettingsModal = document.getElementById('jp-settings-modal');
const btnSettingsJp = document.getElementById('btn-settings-jp');
const btnSaveJpSettings = document.getElementById('btn-save-jp-settings');
const btnCancelJpSettings = document.getElementById('btn-cancel-jp-settings');
// Daftar semua ID input dari modal JP untuk kemudahan iterasi
const jpInputIds = [
    'jp-bbfs4d_twin', 'jp-bbfs4d', 'jp-bbfs3d_twin', 'jp-bbfs3d', 'jp-bbfs2d', 'jp-cb', 
    'jp-2d_lurus', 'jp-2d_bb', 'jp-d4_lurus', 'jp-d4_poltar_4d', 'jp-d4_4d', 
    'jp-d4_poltar_3d', 'jp-d4_3d', 'jp-d4_2d'
];

// --- Elemen Spesifik ME ---
const groupNamePrediksi = document.getElementById('groupNamePrediksi');
const excelPathPrediksi = document.getElementById('excelPathPrediksi');
const browseExcelPrediksi = document.getElementById('browseExcelPrediksi');
const startPrediksi = document.getElementById('startPrediksi');
const stopPrediksi = document.getElementById('stopPrediksi');
const resetPrediksi = document.getElementById('resetPrediksi');
const statusPrediksi = document.getElementById('statusPrediksi');
const qrPrediksi = document.getElementById('qrPrediksi');
const logPrediksi = document.getElementById('logPrediksi');

const groupNameResult = document.getElementById('groupNameResult');
const excelPathResult = document.getElementById('excelPathResult');
const browseExcelResult = document.getElementById('browseExcelResult');
const startResult = document.getElementById('startResult');
const stopResult = document.getElementById('stopResult');
const resetResult = document.getElementById('resetResult');
const statusResult = document.getElementById('statusResult');
const qrResult = document.getElementById('qrResult');
const logResult = document.getElementById('logResult');

// =================================================================
// --- FUNGSI UTAMA & MANAJEMEN UI
// =================================================================

const showScreen = (screenToShow) => {
    allScreens.forEach(screen => screen.classList.add('hidden'));
    screenToShow.classList.remove('hidden');
};

const addLog = (targetLogArea, message) => {
    const timestamp = `[${new Date().toLocaleTimeString('id-ID')}]`;
    const logMessage = `${timestamp} ${message}\n`;
    targetLogArea.value += logMessage;
    targetLogArea.scrollTop = targetLogArea.scrollHeight;
};

// Fungsi untuk toggle visibilitas password
const togglePasswordVisibility = (inputElement, iconElement) => {
    if (inputElement.type === 'password') {
        inputElement.type = 'text';
        iconElement.classList.remove('fa-eye');
        iconElement.classList.add('fa-eye-slash');
    } else {
        inputElement.type = 'password';
        iconElement.classList.remove('fa-eye-slash');
        iconElement.classList.add('fa-eye');
    }
};

// =================================================================
// --- INISIALISASI APLIKASI
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Muat kredensial yang tersimpan
        const credentials = await window.api.getSavedCredentials();
        if (credentials) {
            loginUseridInput.value = credentials.userid;
            loginPasswordInput.value = credentials.password;
            document.getElementById('remember-me').checked = true;
        }
        
        // Muat pengaturan ME
        const settings = await window.api.invoke('get-me-settings');
        if (settings.prediksiGroup) groupNamePrediksi.value = settings.prediksiGroup;
        if (settings.prediksiExcel) excelPathPrediksi.value = settings.prediksiExcel;
        if (settings.resultGroup) groupNameResult.value = settings.resultGroup;
        if (settings.resultExcel) excelPathResult.value = settings.resultExcel;

        // Muat pengaturan selebrasi
        const celebrationSettings = await window.api.invoke('get-celebration-settings');
        if (celebrationSettings && celebrationSettings.messages) {
            celebrationTextArea.value = celebrationSettings.messages.join('\n');
        }

    } catch (error) {
        addLog(logPrediksi, `❌ Gagal memuat data awal: ${error.message}`);
    }

    // Pasang event listener untuk ikon mata
    toggleLoginPassword.addEventListener('click', () => togglePasswordVisibility(loginPasswordInput, toggleLoginPassword));
    toggleRegisterPassword.addEventListener('click', () => togglePasswordVisibility(registerPasswordInput, toggleRegisterPassword));
    toggleRegisterConfirmPassword.addEventListener('click', () => togglePasswordVisibility(registerConfirmPasswordInput, toggleRegisterConfirmPassword));
});

// =================================================================
// --- LOGIKA LOGIN & PENDAFTARAN
// =================================================================

linkToRegister.addEventListener('click', (e) => { e.preventDefault(); showScreen(registerScreen); });
linkToLoginFromRegister.addEventListener('click', (e) => { e.preventDefault(); showScreen(loginScreen); });

// Event untuk tombol tutup pada modal pembayaran
btnClosePaymentModal.addEventListener('click', () => {
    paymentModal.classList.add('hidden');
    showScreen(loginScreen); // Kembali ke layar login
});

// =================================================================
// ### BAGIAN YANG DIPERBARUI: EVENT LISTENER UNTUK SEMUA MODAL ###
// =================================================================

// Modal Pengaturan Selebrasi
btnSettingsCelebration.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

btnCancelSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
    const messages = celebrationTextArea.value.split('\n').filter(line => line.trim() !== '');
    await window.api.invoke('save-celebration-settings', { messages });
    settingsModal.classList.add('hidden');
    addLog(logResult, '✅ Pengaturan kalimat selebrasi berhasil disimpan.');
});

// Modal Pengaturan Format JP (BARU)
btnSettingsJp.addEventListener('click', async () => {
    try {
        const settings = await window.api.invoke('get-jp-settings');
        // Loop melalui semua ID input dan isi nilainya
        jpInputIds.forEach(id => {
            const key = id.replace('jp-', '').replace(/-/g, '_'); // e.g., 'jp-bbfs4d_twin' -> 'bbfs4d_twin'
            const inputElement = document.getElementById(id);
            if (inputElement && settings[key] !== undefined) {
                inputElement.value = settings[key];
            }
        });
        jpSettingsModal.classList.remove('hidden');
    } catch (error) {
        addLog(logResult, `❌ Gagal memuat pengaturan JP: ${error.message}`);
    }
});

btnCancelJpSettings.addEventListener('click', () => {
    jpSettingsModal.classList.add('hidden');
});

btnSaveJpSettings.addEventListener('click', async () => {
    const newSettings = {};
    // Loop melalui semua ID input dan kumpulkan nilainya
    jpInputIds.forEach(id => {
        const key = id.replace('jp-', '').replace(/-/g, '_');
        const inputElement = document.getElementById(id);
        if (inputElement) {
            newSettings[key] = inputElement.value;
        }
    });

    await window.api.invoke('save-jp-settings', newSettings);
    jpSettingsModal.classList.add('hidden');
    addLog(logResult, '✅ Pengaturan format pesan JP berhasil disimpan.');
});
// =================================================================

// Event listener untuk tombol Login
btnLogin.addEventListener('click', async () => {
    const userid = loginUseridInput.value;
    const password = loginPasswordInput.value;

    if (!userid || !password) {
        loginError.textContent = 'UserID dan Password harus diisi.';
        loginError.classList.remove('hidden');
        return;
    }
    btnLogin.textContent = 'Mencoba Masuk...';
    btnLogin.disabled = true;
    loginError.classList.add('hidden');
    
    const result = await window.api.loginAttempt({
        userid, 
        password, 
        rememberMe: document.getElementById('remember-me').checked 
    });
    
    if (result.success) {
        showScreen(mainAppScreen);
        document.getElementById('marquee-container').classList.remove('hidden');
    } else {
        loginError.textContent = result.message;
        loginError.classList.remove('hidden');
    }
    btnLogin.textContent = 'Login';
    btnLogin.disabled = false;
});

// Event listener untuk tombol Register
btnRegister.addEventListener('click', async () => {
    const userid = registerUseridInput.value;
    const password = registerPasswordInput.value;
    const confirmPassword = registerConfirmPasswordInput.value;
    const gmail = registerGmailInput.value;
    const whatsapp = registerWhatsappInput.value;
    const durationElement = document.querySelector('input[name="duration"]:checked');

    if (!userid || !password || !confirmPassword || !gmail || !whatsapp || !durationElement) {
        registerError.textContent = 'Semua field wajib diisi.';
        registerError.classList.remove('hidden');
        return;
    }
    if (password !== confirmPassword) {
        registerError.textContent = 'Password dan Konfirmasi Password tidak cocok.';
        registerError.classList.remove('hidden');
        return;
    }

    btnRegister.textContent = 'Memproses...';
    btnRegister.disabled = true;
    registerError.classList.add('hidden');

    const result = await window.api.registerAttempt({
        userid,
        password,
        gmail,
        whatsapp,
        duration: durationElement.value,
    });

    if (result.success && result.paymentDetails) {
        paymentAmount.textContent = `Rp ${result.paymentDetails.amount.toLocaleString('id-ID')}`;
        registerScreen.classList.add('hidden');
        paymentModal.classList.remove('hidden');
    } else {
        registerError.textContent = result.message || 'Terjadi kesalahan saat pendaftaran.';
        registerError.classList.remove('hidden');
    }
    
    btnRegister.textContent = 'Daftar & Lanjut Pembayaran';
    btnRegister.disabled = false;
});


// =================================================================
// --- EVENT LISTENERS UNTUK MENU "ME"
// =================================================================

const saveMeSettings = async () => {
    const settings = {
        prediksiGroup: groupNamePrediksi.value,
        prediksiExcel: excelPathPrediksi.value,
        resultGroup: groupNameResult.value,
        resultExcel: excelPathResult.value,
    };
    await window.api.invoke('save-me-settings', settings);
};
groupNamePrediksi.addEventListener('change', saveMeSettings);
excelPathPrediksi.addEventListener('change', saveMeSettings);
groupNameResult.addEventListener('change', saveMeSettings);
excelPathResult.addEventListener('change', saveMeSettings);
browseExcelPrediksi.addEventListener('click', async () => {
    const result = await window.api.invoke('open-file-dialog', {});
    if (result && result.filePath) {
        excelPathPrediksi.value = result.filePath;
        saveMeSettings();
    }
});
browseExcelResult.addEventListener('click', async () => {
    const result = await window.api.invoke('open-file-dialog', {});
    if (result && result.filePath) {
        excelPathResult.value = result.filePath;
        saveMeSettings();
    }
});
startPrediksi.addEventListener('click', () => {
    qrPrediksi.classList.remove('hidden');
    qrPrediksi.innerHTML = '<p>Menunggu QR Code...</p>';
    window.api.send('start-bot-me', {
        botType: 'prediksi',
        groupName: groupNamePrediksi.value,
        excelPath: excelPathPrediksi.value
    });
});
stopPrediksi.addEventListener('click', () => {
    qrPrediksi.classList.add('hidden');
    qrPrediksi.innerHTML = '';
    window.api.send('stop-bot-me', 'prediksi');
});
resetPrediksi.addEventListener('click', () => {
    qrPrediksi.classList.add('hidden');
    qrPrediksi.innerHTML = '';
    window.api.send('reset-bot-me', 'prediksi');
});

// =================================================================
// ### BAGIAN YANG DIPERBAIKI: KIRIM DATA SELEBRASI ###
// =================================================================
startResult.addEventListener('click', () => {
    qrResult.classList.remove('hidden');
    qrResult.innerHTML = '<p>Menunggu QR Code...</p>';
    
    // Ambil daftar selebrasi dari textarea untuk dikirim ke bot
    const celebrationMessages = celebrationTextArea.value.split('\n').filter(line => line.trim() !== '');

    window.api.send('start-bot-me', {
        botType: 'result',
        groupName: groupNameResult.value,
        excelPath: excelPathResult.value,
        // Kirim data baru sebagai bagian dari payload
        celebrationMessages: celebrationMessages 
        // Pengaturan JP akan diambil oleh main.js secara otomatis saat bot dimulai
    });
});
// =================================================================

stopResult.addEventListener('click', () => {
    qrResult.classList.add('hidden');
    qrResult.innerHTML = '';
    window.api.send('stop-bot-me', 'result');
});
resetResult.addEventListener('click', () => {
    qrResult.classList.add('hidden');
    qrResult.innerHTML = '';
    window.api.send('reset-bot-me', 'result');
});

// =================================================================
// --- HANDLER EVENT DARI MAIN PROCESS
// =================================================================

window.api.on('log-message', (message) => addLog(logPrediksi, message));
window.api.on('update-ready', (version) => {
    const modal = document.getElementById('update-modal');
    document.getElementById('update-title').textContent = `Update MEBOT v${version}`;
    document.getElementById('update-message').textContent = `Versi ${version} telah siap. Mulai ulang aplikasi untuk menyelesaikan pembaruan.`;
    document.getElementById('btn-update-later').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-update-now').onclick = () => window.api.installUpdate();
    modal.classList.remove('hidden');
});
window.api.receive('bot-me-log', ({ bot, message }) => {
    const logArea = bot === 'prediksi' ? logPrediksi : logResult;
    addLog(logArea, `[${bot.toUpperCase()}] ${message}`);
});
window.api.receive('bot-me-qr', ({ bot, data }) => {
    const qrDiv = bot === 'prediksi' ? qrPrediksi : qrResult;
    if (data) {
        qrDiv.classList.remove('hidden');
        qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}" alt="Scan QR Code">`;
    }
});
window.api.receive('bot-me-status', ({ bot, status }) => {
    const statusDiv = bot === 'prediksi' ? statusPrediksi : statusResult;
    const qrDiv = bot === 'prediksi' ? qrPrediksi : qrResult;
    statusDiv.textContent = `Status: ${status}`;
    if (status === 'ready' || status === 'Stopped' || status === 'disconnected' || status.includes('error') || status === 'Session Reset') {
        qrDiv.classList.add('hidden');
        qrDiv.innerHTML = '';
    }
});