// backend-functions/functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// --- FUNGSI REGISTER (DIROMBAK SESUAI PERMINTAAN BARU) ---
exports.register = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { userid, password, gmail, whatsapp, duration } = req.body;
    if (!userid || !password || !gmail || !whatsapp || !duration) {
      return res.status(400).json({ error: "Semua field wajib diisi." });
    }

    try {
      // Menggunakan UserID sebagai ID dokumen
      const userRef = db.collection("users_predictor").doc(userid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        return res.status(409).json({ error: "UserID ini sudah terdaftar." });
      }

      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + parseInt(duration, 10));
      
      const uniqueAmount = Math.floor(100000 + Math.random() * 900000);

      // Menyimpan semua data baru
      await userRef.set({
        userid: userid, // Menyimpan juga sebagai field
        password: password,
        gmail: gmail,
        whatsapp: whatsapp,
        machineId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        chosenDuration: parseInt(duration, 10),
        status: "pending", // Status awal adalah 'pending'
        subscriptionEnd: admin.firestore.Timestamp.fromDate(expirationDate),
        uniqueAmount: uniqueAmount,
        lastLogin: null,
      });

      const licenseRef = db.collection("licenses_predictor").doc(userid);
      await licenseRef.set({
        userId: userid,
        expirationDate: admin.firestore.Timestamp.fromDate(expirationDate),
        status: "pending", // Status lisensi juga 'pending'
      });

      return res.status(201).json({ 
          success: true, 
          message: "Pendaftaran berhasil! Silakan lakukan pembayaran.",
          paymentDetails: { amount: uniqueAmount } 
      });
    } catch (error) {
      console.error("Error pendaftaran:", error);
      return res.status(500).json({ error: "Terjadi kesalahan pada server." });
    }
  });
});

// --- FUNGSI LOGIN (DIMODIFIKASI SESUAI PERMINTAAN BARU) ---
exports.login = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    // Login menggunakan UserID
    const { userid, password, machineId } = req.body;
    if (!userid || !password || !machineId) {
      return res.status(400).json({ error: "UserID, password, dan machineId diperlukan." });
    }

    try {
      // Mencari dokumen berdasarkan UserID
      const userRef = db.collection("users_predictor").doc(userid);
      const userDoc = await userRef.get();

      if (!userDoc.exists || userDoc.data().password !== password) {
        return res.status(401).json({ error: "UserID atau password salah." });
      }

      // Cek status approval
      if (userDoc.data().status !== "approved") {
        return res.status(403).json({ error: "Akun Anda belum diaktifkan. Harap hubungi admin." });
      }

      const licenseRef = db.collection("licenses_predictor").doc(userid);
      const licenseDoc = await licenseRef.get();
      if (!licenseDoc.exists || licenseDoc.data().status !== "active") {
        return res.status(403).json({ error: "Lisensi tidak ditemukan atau tidak aktif." });
      }
      if (licenseDoc.data().expirationDate.toDate() < new Date()) {
        return res.status(403).json({ error: "Lisensi Anda telah kedaluwarsa." });
      }

      const updateData = {
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      };

      const storedMachineId = userDoc.data().machineId;
      if (storedMachineId === null) {
        updateData.machineId = machineId;
        await userRef.update(updateData);
        return res.status(200).json({
          success: true,
          message: "Login berhasil, lisensi terkunci di perangkat ini.",
          license: {
            expires: licenseDoc.data().expirationDate.toDate().toISOString(),
          },
        });
      } else if (storedMachineId !== machineId) {
        return res.status(403).json({ error: "Lisensi ini sudah digunakan di perangkat lain." });
      }

      // Jika login berhasil (dan bukan login pertama), tetap update lastLogin
      await userRef.update(updateData);
      return res.status(200).json({
        success: true,
        message: "Login berhasil.",
        license: {
          expires: licenseDoc.data().expirationDate.toDate().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error login:", error);
      return res.status(500).json({ error: "Terjadi kesalahan pada server." });
    }
  });
});