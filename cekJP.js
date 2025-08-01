/**
 * Memeriksa hasil JP berdasarkan prediksi dan menghasilkan pesan.
 * @param {string} result - String 4 digit hasil keluaran.
 * @param {object} prediksi - Objek prediksi yang berisi bbfs7d, bbfs5d, cb, d2, d4.
 * @param {string[]} ucapanJP - Array berisi kalimat selebrasi kustom dari pengguna.
 * @param {object} jpFormats - Objek berisi format string untuk setiap jenis JP.
 * @returns {string} - Pesan hasil pengecekan JP.
 */
function cekJP(result, prediksi, ucapanJP, jpFormats) {
  // Guard Clause: Pengecekan paling awal untuk memastikan data inti ada.
  // Jika result atau prediksi tidak ada, langsung hentikan fungsi.
  if (!result || !prediksi) {
    return '';
  }

  // Objek format default untuk fallback jika pengaturan tidak ada/rusak
  const defaultFormats = {
      bbfs4d_twin: "✅ JP POLTAR 432D {label}",
      bbfs4d: "✅ JP 432D {label}",
      bbfs3d_twin: "✅ JP POLTAR 32D {label}",
      bbfs3d: "✅ JP 32D {label}",
      bbfs2d: "✅ JP 2D {label}",
      cb: "✅ JP CB: {matches}",
      "2d_lurus": "✅ JP 2D LURUS",
      "2d_bb": "✅ JP 2D BB",
      d4_lurus: "✅ JP 432D LURUS 1LINE",
      d4_poltar_4d: "✅ JP POLTAR 432D 1LINE",
      d4_4d: "✅ JP 432D 1LINE",
      d4_poltar_3d: "✅ JP POLTAR 32D 1LINE",
      d4_3d: "✅ JP 32D 1LINE",
      d4_2d: "✅ JP 2D 1LINE"
  };

  // Gabungkan format default dengan yang diberikan pengguna dari UI
  const formats = { ...defaultFormats, ...jpFormats };

  const resArr = result.split('').map(Number);
  if (resArr.length !== 4) return '';
  const [as, kop, kepala, ekor] = resArr;
  
  // Pengaman tambahan: Pastikan data prediksi ada sebelum diolah, beri nilai default jika tidak ada.
  const bbfs7d = (prediksi.bbfs7d || '').split('').map(Number);
  const bbfs5d = (prediksi.bbfs5d || '').split('').map(Number);
  const cb = (prediksi.cb || []).map(Number);
  const d2 = prediksi.d2 || [];
  const d4 = prediksi.d4 || [];

  const resultStr = resArr.join('');
  const resultKE = `${kepala}${ekor}`;
  const resultKErev = `${ekor}${kepala}`;
  const twin = new Set(resArr).size < resArr.length;

  const semuaAda = (angka, arr) => angka.every(x => arr.includes(x));

  let hasil = [];
  let selebrasi = false;

  const cekBBFS = (bbfs, label) => {
    if (bbfs.length === 0) return; // Lewati jika BBFS kosong

    if (semuaAda([as, kop, kepala, ekor], bbfs)) {
      const formatString = twin ? formats.bbfs4d_twin : formats.bbfs4d;
      hasil.push(formatString.replace('{label}', label));
      selebrasi = true;
    } else if (semuaAda([kop, kepala, ekor], bbfs)) {
      const formatString = twin ? formats.bbfs3d_twin : formats.bbfs3d;
      hasil.push(formatString.replace('{label}', label));
      selebrasi = true;
    } else if (semuaAda([kepala, ekor], bbfs)) {
      hasil.push(formats.bbfs2d.replace('{label}', label));
    }
  };

  cekBBFS(bbfs7d, 'BBFS 7D');
  cekBBFS(bbfs5d, 'BBFS 5D');

  // JP dari CB (hanya menampilkan angka unik yang cocok)
  const cbMatch = [...new Set([as, kop, kepala, ekor].filter(x => cb.includes(x)))];
  if (cbMatch.length > 0) {
    hasil.push(formats.cb.replace('{matches}', cbMatch.join(', ')));
  }

  // JP dari 2D
  if (d2.includes(resultKE)) {
    hasil.push(formats['2d_lurus']);
  } else if (d2.includes(resultKErev)) {
    hasil.push(formats['2d_bb']);
  }

  // JP dari sniper (d4)
  for (let d of d4) {
    if (d === resultStr) {
      hasil.push(formats.d4_lurus);
      selebrasi = true;
      break; 
    }

    const dSet = new Set(d.split('').map(Number));
    if (d.length >= 4 && semuaAda([as, kop, kepala, ekor], [...dSet])) {
        const formatString = twin ? formats.d4_poltar_4d : formats.d4_4d;
        hasil.push(formatString);
        selebrasi = true;
        break;
    } else if (d.length >= 3 && semuaAda([kop, kepala, ekor], [...dSet])) {
        const formatString = twin ? formats.d4_poltar_3d : formats.d4_3d;
        hasil.push(formatString);
        selebrasi = true;
        break;
    } else if (d.length >= 2 && semuaAda([kepala, ekor], [...dSet])) {
        hasil.push(formats.d4_2d);
        break;
    }
  }

  // Output final
  let pesan = "";
  if (hasil.length > 0) {
    // Gabungkan hasil unik untuk menghindari pesan duplikat
    pesan += [...new Set(hasil)].join('\n');
    
    // Gunakan daftar selebrasi dari argumen, jika ada dan tidak kosong
    if (selebrasi && Array.isArray(ucapanJP) && ucapanJP.length > 0) {
      const ucapan = ucapanJP[Math.floor(Math.random() * ucapanJP.length)];
      pesan += `\n\n${ucapan}`;
    }
  }
  return pesan;
}

module.exports = cekJP;