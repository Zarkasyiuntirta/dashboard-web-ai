import { db, doc, setDoc, getDoc } from './firebase-config.js';

export let studentDataset = [];
export let loginContext = { role: 'admin', nim: null, nik: null, studentName: null };
let currentSubTab = 'subAttendance';
let pertemuanKe = 1; // Menyimpan status pertemuan ke- secara manual (1, 2, dst)
let tugasKe = 1; // Menyimpan status tugas ke- secara manual (1, 2, dst)
let chartExamsObj, chartProactiveObj, chartTugasObj, chartAttendanceObj, chartLeaderboardObj;

const avatarsMock = [
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
];

// === Subject (Mapel) management ===
export let subjectList = [
    "Pendidikan Agama dan Budi Pekerti",
    "Pendidikan Pancasila",
    "Bahasa Indonesia",
    "Matematika",
    "Ilmu Pengetahuan Alam dan Sosial (IPAS)",
    "Seni dan Budaya",
    "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)",
    "Bahasa Inggris",
    "Muatan Lokal"
];
let subjectData = {}; // placeholder for per-subject datasets if needed later

function getCurrentSubject() {
    const sel = document.getElementById('filterSubjectList');
    return sel ? sel.value : subjectList[0];
}

function ensureSubjectDataset(subject) {
    if (!subject) subject = getCurrentSubject();
    if (!subjectData[subject]) {
        // clone global studentDataset shallowly untuk per-subject editing
        subjectData[subject] = studentDataset.map(s => ({
            nim: s.nim,
            name: s.name,
            avatar: s.avatar, // PENTING: copy avatar dari global dataset
            attendance: { ...s.attendance },
            proactive: { ...s.proactive },
            tasks: { ...s.tasks },
            exams: { ...s.exams },
            finalScore: s.finalScore
        }));
    } else {
        // Sinkronkan avatar dari global dataset jika ada perubahan
        subjectData[subject].forEach((subStudent, idx) => {
            if (studentDataset[idx]) {
                subStudent.avatar = studentDataset[idx].avatar;
            }
        });
    }
    return subjectData[subject];
}

function generateInitialBackupDataset() {
    let temp = [];
    for(let i=1; i<=30; i++) {
        let rName = "murid" + i;
        
        // Inisialisasi awal data kehadiran secara acak & seimbang
        let attendanceTotal = Math.floor(Math.random() * 4) + 16;
        let sick = Math.floor(Math.random() * 2);
        let permit = Math.floor(Math.random() * 2);
        let absent = Math.floor(Math.random() * 2);
        let meetings = attendanceTotal + sick + permit + absent;
        let attendanceVal = (attendanceTotal / meetings) * 100;

        let ask = Math.floor(Math.random()*15);
        let answer = Math.floor(Math.random()*15);
        let add = Math.floor(Math.random()*15);
        let proTotal = ask + answer + add;
        let proVal = (proTotal > attendanceTotal) ? 100 : (proTotal === attendanceTotal ? 70 : 50);

        let done = Math.floor(Math.random()*6) + 15;
        let totalTasks = 20;
        let taskVal = (done / totalTasks) * 100;

        let uts1 = Math.floor(Math.random()*40) + 60;
        let uas1 = Math.floor(Math.random()*40) + 60;
        let uts2 = Math.floor(Math.random()*40) + 60;
        let uas2 = Math.floor(Math.random()*40) + 60;
        let examAvg = (uts1 + uas1 + uts2 + uas2) / 4;

        let b_att = attendanceVal * 0.10;
        let b_pro = proVal * 0.20;
        let b_tsk = taskVal * 0.30;
        let b_exm = examAvg * 0.40;
        let finalScore = b_att + b_pro + b_tsk + b_exm;

        temp.push({
            nik: 6000 + i, // default NIK = NIM for existing data
            nim: 6000 + i, name: rName, avatar: avatarsMock[Math.floor(Math.random() * avatarsMock.length)],
            attendance: { 
                present: attendanceTotal, 
                sick: sick, 
                permit: permit, 
                absent: absent, 
                meetings: meetings, 
                status: 'Hadir', 
                score: attendanceVal, 
                weight: b_att 
            },
            proactive: { ask: ask, answer: answer, add: add, total: proTotal, score: proVal, weight: b_pro },
            tasks: { done: done, total: totalTasks, score: taskVal, weight: b_tsk },
            exams: { uts1: uts1, uas1: uas1, uts2: uts2, uas2: uas2, avg: examAvg, weight: b_exm },
            finalScore: parseFloat(finalScore.toFixed(2))
        });
    }
    return temp;
}

// === FIRESTORE CONNECTION STATUS INDICATOR ===
export let firestoreConnected = false;

export function updateFirestoreStatusIndicator() {
    // Firestore status indicator is hidden from UI
    const indicator = document.getElementById('firestoreStatus');
    if (!indicator) return;
    indicator.classList.add('hidden');
}

export async function loadDataFromFirestore() {
    try {
        const docRef = doc(db, "academic_core", "kelas6SD");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            studentDataset = data.students || generateInitialBackupDataset();
            subjectList = data.subjectList || subjectList;
            subjectData = data.subjectData || {};
            
            // PENTING: Pastikan avatar di setiap student juga ter-copy ke subjectData
            subjectList.forEach(subject => {
                ensureSubjectDataset(subject);
                if (subjectData[subject]) {
                    subjectData[subject].forEach((subjectStudent, idx) => {
                        const mainStudent = studentDataset[idx];
                        if (mainStudent && mainStudent.avatar) {
                            subjectStudent.avatar = mainStudent.avatar;
                        }
                    });
                }
            });
            
            firestoreConnected = true;
            updateFirestoreStatusIndicator();
            console.log("✅ Firestore: Data berhasil dimuat dari cloud.");
        } else {
            // Dokumen belum ada, buat baru dengan data default
            studentDataset = generateInitialBackupDataset();
            await setDoc(docRef, { students: studentDataset, subjectList: subjectList, subjectData: subjectData });
            firestoreConnected = true;
            updateFirestoreStatusIndicator();
            console.log("✅ Firestore: Dokumen baru berhasil dibuat.");
        }
    } catch (e) {
        firestoreConnected = false;
        updateFirestoreStatusIndicator();
        
        // JANGAN fallback ke data random! Biarkan data yang sudah ada di memory tetap dipakai.
        // Hanya jika studentDataset masih kosong, baru generate data default.
        if (studentDataset.length === 0) {
            console.warn("⚠️ Firestore gagal diakses dan tidak ada data lokal. Menggunakan data default sementara.", e);
            studentDataset = generateInitialBackupDataset();
        } else {
            console.warn("⚠️ Firestore gagal diakses, tetapi data lokal masih tersedia. Data tidak akan ditimpa.", e);
        }
        
        // Tampilkan pesan error yang informatif
        const errorMsg = getFirestoreErrorMessage(e);
        console.error("❌ Firestore Error Detail:", errorMsg);
        
        // Tampilkan notifikasi ke user
        showFirestoreNotification(errorMsg, 'error');
    }
}

function getFirestoreErrorMessage(error) {
    const code = error.code || '';
    const message = error.message || '';
    
    if (code === 'permission-denied' || message.includes('permission')) {
        return '🚫 Firestore Security Rules memblokir akses. Periksa pengaturan security rules di console Firebase.';
    }
    if (code === 'unavailable' || message.includes('unavailable')) {
        return '🌐 Firestore tidak dapat dijangkau. Periksa koneksi internet Anda.';
    }
    if (code === 'not-found') {
        return '📄 Dokumen tidak ditemukan di Firestore.';
    }
    if (code === 'deadline-exceeded') {
        return '⏱️ Koneksi ke Firestore timeout. Coba refresh halaman.';
    }
    if (code === 'resource-exhausted') {
        return '📦 Kuota Firestore habis. Upgrade paket atau tunggu reset kuota.';
    }
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        return '🌐 Gagal terhubung ke Firestore. Periksa koneksi internet Anda.';
    }
    return `❌ Error Firestore: ${message.substring(0, 200)}`;
}

function showFirestoreNotification(message, type = 'error') {
    // Cari atau buat elemen notifikasi
    let notif = document.getElementById('firestoreNotification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'firestoreNotification';
        notif.className = 'fixed top-4 right-4 z-50 max-w-md transition-all duration-500 transform translate-x-0';
        document.body.appendChild(notif);
    }
    
    const bgColor = type === 'error' ? 'bg-red-900/90 border-red-500/50' : 'bg-emerald-900/90 border-emerald-500/50';
    const icon = type === 'error' ? '🔴' : '🟢';
    
    notif.innerHTML = `
        <div class="${bgColor} border rounded-xl p-4 shadow-2xl backdrop-blur-sm">
            <div class="flex items-start gap-3">
                <span class="text-lg">${icon}</span>
                <div class="flex-1">
                    <p class="text-sm text-slate-100 font-semibold">${type === 'error' ? 'Firestore Error' : 'Firestore Sukses'}</p>
                    <p class="text-xs text-slate-300 mt-1">${message}</p>
                </div>
                <button onclick="this.closest('#firestoreNotification').remove()" class="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
            </div>
        </div>
    `;
    
    // Auto-hide setelah 8 detik
    setTimeout(() => {
        if (notif && notif.parentNode) {
            notif.style.opacity = '0';
            notif.style.transform = 'translateX(100%)';
            setTimeout(() => notif.remove(), 500);
        }
    }, 8000);
}

async function syncToFirestoreCloud(retryCount = 3) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            const docRef = doc(db, "academic_core", "kelas6SD");
            await setDoc(docRef, { 
                students: studentDataset, 
                subjectList: subjectList, 
                subjectData: subjectData 
            });
            
            firestoreConnected = true;
            updateFirestoreStatusIndicator();
            
            // Notifikasi sukses (hanya tampilkan di percobaan terakhir)
            if (attempt === 1) {
                showFirestoreNotification('✅ Data berhasil disimpan ke Google Firestore Cloud!', 'success');
            }
            console.log(`✅ Firestore Sync: Data berhasil disimpan (percobaan ke-${attempt})`);
            return true;
        } catch (e) {
            console.warn(`⚠️ Firestore Sync: Percobaan ke-${attempt} gagal.`, e.message);
            
            if (attempt < retryCount) {
                // Tunggu sebentar sebelum retry (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // Semua percobaan gagal
                firestoreConnected = false;
                updateFirestoreStatusIndicator();
                
                const errorMsg = getFirestoreErrorMessage(e);
                showFirestoreNotification(`🚨 Gagal sinkronisasi data ke Firestore setelah ${retryCount} percobaan.\n${errorMsg}`, 'error');
                console.error("❌ Firestore Sync: Semua percobaan gagal.", e);
                return false;
            }
        }
    }
}

export function initDashboardEngine() {
    populateStudentDropdowns();
    populateSubjectSelectors();
    syncSelectedStudentProfile();
    // Chat AI panel (rule-based) bisa dipakai setelah login
    ensureChatAIInit();
}

function populateStudentDropdowns() {
    const dropdown = document.getElementById('filterStudent');
    const currentSelection = dropdown.value;
    dropdown.innerHTML = "";
    
    studentDataset.forEach(student => {
        let opt = document.createElement('option');
        opt.value = student.nim; 
        opt.innerText = `${student.nim} - ${student.name}`;
        dropdown.appendChild(opt);
    });

    if (currentSelection && studentDataset.some(s => s.nim == currentSelection)) {
        dropdown.value = currentSelection;
    }
}

function syncSelectedStudentProfile() {
    const dropdown = document.getElementById('filterStudent');
    if (!dropdown.value) return;
    
    const targetNim = parseInt(dropdown.value);
    const currentSubject = getCurrentSubject();
    const dataset = ensureSubjectDataset(currentSubject);
    
    // Cari student dari global dataset dahulu untuk avatar terbaru
    let student = studentDataset.find(s => s.nim === targetNim);
    if(!student) {
        student = dataset.find(s => s.nim === targetNim);
    }
    if(!student) return;

    document.getElementById('profileName').innerText = student.name;
    document.getElementById('profileNim').innerText = student.nim;
    document.getElementById('profileAvatar').src = student.avatar;
    document.getElementById('profileTotalScore').innerText = (student.finalScore || 0).toFixed(2);

    let sorted = [...dataset].sort((a,b) => b.finalScore - a.finalScore);
    let rank = sorted.findIndex(s => s.nim === student.nim) + 1;
    document.getElementById('profileRank').innerText = "#" + (rank > 0 ? rank : '-');

    const summaryMetrics = calculateSummaryMetrics();
    const overall = summaryMetrics.find(s => s.nim === student.nim);
    document.getElementById('profileOverallRank').innerText = overall ? `#${overall.rank}` : '-';
    document.getElementById('profileOverallScore').innerText = overall ? overall.averageScore.toFixed(2) : '0.00';

    renderDashboardCharts(student);
}

function renderDashboardCharts(student = null) {
    const currentSubject = getCurrentSubject();
    const dataset = ensureSubjectDataset(currentSubject);
    if(!student) {
        const targetNim = parseInt(document.getElementById('filterStudent').value);
        student = dataset.find(s => s.nim === targetNim) || studentDataset.find(s => s.nim === targetNim);
    }
    if(!student) return;

    const examCtx = document.getElementById('chartExams').getContext('2d');
    if(chartExamsObj) chartExamsObj.destroy();
    chartExamsObj = new Chart(examCtx, {
        type: 'bar',
        data: {
            labels: ['UTS 1', 'UAS 1', 'UTS 2', 'UAS 2', 'Rata-Rata Core'],
            datasets: [{
                data: [student.exams.uts1, student.exams.uas1, student.exams.uts2, student.exams.uas2, student.exams.avg],
                backgroundColor: ['rgba(0, 240, 255, 0.4)', 'rgba(157, 78, 221, 0.4)', 'rgba(255, 0, 127, 0.4)', 'rgba(0, 114, 255, 0.4)', 'rgba(16, 185, 129, 0.5)'],
                borderColor: ['#00f0ff', '#9d4edd', '#ff007f', '#0072ff', '#10b981'],
                borderWidth: 2, borderRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    document.getElementById('valTotalProactive').innerText = student.proactive.total;
    const proCtx = document.getElementById('chartProactive').getContext('2d');
    if(chartProactiveObj) chartProactiveObj.destroy();
    chartProactiveObj = new Chart(proCtx, {
        type: 'pie',
        data: { labels: ['Bertanya', 'Menjawab', 'Menambahkan'], datasets: [{ data: [student.proactive.ask, student.proactive.answer, student.proactive.add], backgroundColor: ['#00f0ff', '#9d4edd', '#ff007f'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    let uncompletedTasks = student.tasks.total - student.tasks.done;
    document.getElementById('valTotalTugas').innerText = student.tasks.score.toFixed(0) + "%";
    const taskCtx = document.getElementById('chartTugas').getContext('2d');
    if(chartTugasObj) chartTugasObj.destroy();
    chartTugasObj = new Chart(taskCtx, {
        type: 'doughnut',
        data: { labels: ['Selesai', 'Tidak Selesai'], datasets: [{ data: [student.tasks.done, uncompletedTasks], backgroundColor: ['#10b981', '#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const attCtx = document.getElementById('chartAttendance').getContext('2d');
    if(chartAttendanceObj) chartAttendanceObj.destroy();
    chartAttendanceObj = new Chart(attCtx, {
        type: 'bar',
        data: { labels: dataset.map(s => s.name.split(' ')[0]), datasets: [{ data: dataset.map(s => s.attendance.score), backgroundColor: 'rgba(16, 185, 129, 0.4)', borderColor: '#10b981', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.03)' } }, x: { display: false } } }
    });

    const summaryMetrics = calculateSummaryMetrics();
    const sortedLeaderboard = [...summaryMetrics].sort((a, b) => b.averageScore - a.averageScore);
    const leadCtx = document.getElementById('chartLeaderboard').getContext('2d');
    if(chartLeaderboardObj) chartLeaderboardObj.destroy();
    chartLeaderboardObj = new Chart(leadCtx, {
        type: 'bar',
        data: {
            labels: sortedLeaderboard.map(s => s.name.split(' ')[0]),
            datasets: [{
                label: 'Rata-rata',
                data: sortedLeaderboard.map(s => s.averageScore),
                backgroundColor: 'rgba(0, 114, 255, 0.5)',
                borderColor: '#0072ff',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            const student = sortedLeaderboard[idx];
                            return student ? `#${idx + 1} ${student.name}` : '';
                        },
                        label: (tooltipItem) => `Rata-rata: ${tooltipItem.formattedValue}%`
                    }
                }
            },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.03)' } },
                x: { ticks: { color: '#94a3b8', font: { size: 9 } } }
            }
        }
    });
}

// ================= DATA MANIPULATION CRUD =================
function renderUpdateDataTable() {
    const head = document.getElementById('tableHeaderInject');
    const body = document.getElementById('tableBodyInject');
    const lbl = document.getElementById('lblSubTitle');
    head.innerHTML = ""; body.innerHTML = "";
    const currentSubject = getCurrentSubject();
    const dataset = ensureSubjectDataset(currentSubject);

    // ================= 1. TAB DAFTAR HADIR =================
    if(currentSubTab === 'subAttendance') {
        // Mengganti judul dan menyematkan input manual nomor Pertemuan Ke
        lbl.innerHTML = `Pertemuan Ke: <input type="number" id="inputPertemuanKe" value="${pertemuanKe}" class="w-16 bg-slate-950 border border-slate-800 text-center p-1 rounded text-cyan-400 font-mono focus:outline-none focus:border-cyan-400 inline-block ml-2">`;
        
        // Memasang listener agar input manual langsung tersimpan di variabel state
        document.getElementById('inputPertemuanKe').addEventListener('input', (e) => {
            pertemuanKe = parseInt(e.target.value) || 1;
        });

        // Struktur header baru dengan kolom akumulasi Sakit, Izin, Mangkir, dan Total Pertemuan
        head.innerHTML = `
            <tr>
                <th class="p-3">Nama</th>
                <th class="p-3">NIM</th>
                <th class="p-3">Status Kehadiran</th>
                <th class="p-3 text-center">Total Hadir</th>
                <th class="p-3 text-center">Total Sakit</th>
                <th class="p-3 text-center">Total Izin</th>
                <th class="p-3 text-center">Total Mangkir</th>
                <th class="p-3 text-center">Total Pertemuan</th>
                <th class="p-3 text-center">Nilai Kehadiran</th>
                <th class="p-3 text-center">Bobot (10%)</th>
            </tr>`;

        dataset.forEach((s, idx) => {
            let scoreAtt = s.attendance.meetings > 0 ? (s.attendance.present / s.attendance.meetings) * 100 : 0;
            let weightAtt = scoreAtt * 0.10;

            let tr = document.createElement('tr');
            tr.className = "hover:bg-slate-900/30 transition-colors";
            tr.innerHTML = `
                <td class="p-3 text-white font-bold">${s.name}</td>
                <td class="p-3 text-cyan-400 font-mono">${s.nim}</td>
                <td class="p-3">
                    <select id="selAtt-${idx}" class="bg-slate-950 border border-slate-800 text-xs text-slate-300 p-1.5 rounded focus:border-cyan-400 focus:outline-none">
                        <option value="Hadir" ${s.attendance.status === 'Hadir' ? 'selected' : ''}>Hadir</option>
                        <option value="Sakit" ${s.attendance.status === 'Sakit' ? 'selected' : ''}>Sakit</option>
                        <option value="Izin" ${s.attendance.status === 'Izin' ? 'selected' : ''}>Izin</option>
                        <option value="Mangkir" ${s.attendance.status === 'Mangkir' ? 'selected' : ''}>Mangkir</option>
                    </select>
                </td>
                <td class="p-3 text-center text-emerald-400 font-mono">${s.attendance.present}</td>
                <td class="p-3 text-center text-amber-400 font-mono">${s.attendance.sick || 0}</td>
                <td class="p-3 text-center text-blue-400 font-mono">${s.attendance.permit || 0}</td>
                <td class="p-3 text-center text-red-400 font-mono">${s.attendance.absent || 0}</td>
                <td class="p-3 text-center text-slate-400 font-mono">${s.attendance.meetings}</td>
                <td class="p-3 text-center font-mono">${scoreAtt.toFixed(0)}</td>
                <td class="p-3 text-center text-fuchsia-400 font-bold font-mono">${weightAtt.toFixed(1)}</td>`;
            body.appendChild(tr);

            // Listener dropdown hanya merubah status sementara sebelum klik tombol Submit
                document.getElementById(`selAtt-${idx}`).addEventListener('change', (e) => {
                    s.attendance.status = e.target.value;
                });
        });
    }
    
    // ================= 2. TAB NILAI PROAKTIF =================
    else if(currentSubTab === 'subProactive') {
        lbl.innerHTML = `Nilai Proaktif`;
        
        // Date dihapus, ditambahkan kolom Jumlah Pertemuan yang sinkron dari tabel daftar hadir
        head.innerHTML = `
            <tr>
                <th class="p-3">Nama</th>
                <th class="p-3">NIM</th>
                <th class="p-3 text-center">Jumlah Pertemuan</th>
                <th class="p-3 text-center">Bertanya</th>
                <th class="p-3 text-center">Menjawab</th>
                <th class="p-3 text-center">Menambahkan</th>
                <th class="p-3 text-center">Jumlah Proaktif</th>
                <th class="p-3 text-center">Nilai Proaktif</th>
                <th class="p-3 text-center">Bobot (20%)</th>
            </tr>`;

        dataset.forEach((s, idx) => {
            let totalProactive = s.proactive.ask + s.proactive.answer + s.proactive.add;
            let scoreProactive = s.proactive.score || 50;
            let weightProactive = scoreProactive * 0.20;

            let tr = document.createElement('tr');
            tr.className = "hover:bg-slate-900/30 transition-colors";
            tr.innerHTML = `
                <td class="p-3 text-white font-bold">${s.name}</td>
                <td class="p-3 text-cyan-400 font-mono">${s.nim}</td>
                <td class="p-3 text-center text-slate-400 font-mono">${s.attendance.meetings}</td>
                <td class="p-3 text-center"><input type="number" id="ask-${idx}" value="${s.proactive.ask}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-cyan-400 focus:outline-none focus:border-cyan-400"></td>
                <td class="p-3 text-center"><input type="number" id="ans-${idx}" value="${s.proactive.answer}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-cyan-400 focus:outline-none focus:border-cyan-400"></td>
                <td class="p-3 text-center"><input type="number" id="add-${idx}" value="${s.proactive.add}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-cyan-400 focus:outline-none focus:border-cyan-400"></td>
                <td class="p-3 text-center text-amber-400 font-bold font-mono">${totalProactive}</td>
                <td class="p-3 text-center font-mono">${scoreProactive}</td>
                <td class="p-3 text-center text-pink-500 font-bold font-mono">${weightProactive.toFixed(1)}</td>`;
            body.appendChild(tr);

            ['ask', 'ans', 'add'].forEach(f => {
                document.getElementById(`${f}-${idx}`).addEventListener('change', (e) => {
                    let fieldName = f === 'ans' ? 'answer' : f;
                    s.proactive[fieldName] = parseInt(e.target.value) || 0;
                    recomputeCalculatedMetrics(idx, dataset); 
                    renderUpdateDataTable();
                });
            });
        });
    }
    
    // ================= 3. TAB NILAI TUGAS =================
    else if(currentSubTab === 'subTasks') {
        lbl.innerHTML = `Tugas Ke: <input type="number" id="inputTugasKe" min="1" value="${tugasKe}" class="w-16 bg-slate-950 border border-cyan-500/50 text-center p-1 rounded text-cyan-400 focus:outline-none focus:border-cyan-400" />`;
        head.innerHTML = `
            <tr>
                <th class="p-3">Nama</th>
                <th class="p-3">NIM</th>
                <th class="p-3 text-center">Selesai</th>
                <th class="p-3 text-center">Tidak Selesai</th>
                <th class="p-3 text-center">Jumlah Selesai</th>
                <th class="p-3 text-center">Jumlah Tugas</th>
                <th class="p-3 text-center">Nilai Tugas</th>
                <th class="p-3 text-center">Bobot (30%)</th>
            </tr>`;

        // Set up event listener untuk input tugasKe
        setTimeout(() => {
            const inputTugasKe = document.getElementById('inputTugasKe');
            if(inputTugasKe) {
                inputTugasKe.addEventListener('change', (e) => {
                    tugasKe = parseInt(e.target.value) || 1;
                    renderUpdateDataTable();
                });
            }
        }, 0);

        dataset.forEach((s, idx) => {
            let taskTotal = tugasKe; // Gunakan tugasKe sebagai total tugas
            let taskDone = s.tasks.done;
            let taskNotDone = Math.max(0, taskTotal - taskDone);
            let scoreTask = taskTotal > 0 ? (taskDone / taskTotal) * 100 : 0;
            let weightTask = scoreTask * 0.30;

            let tr = document.createElement('tr');
            tr.className = "hover:bg-slate-900/30 transition-colors";
            tr.innerHTML = `
                <td class="p-3 text-white font-bold">${s.name}</td>
                <td class="p-3 text-cyan-400 font-mono">${s.nim}</td>
                <td class="p-3 text-center"><input type="number" id="done-${idx}" value="${taskDone}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-emerald-400 focus:outline-none focus:border-emerald-400"></td>
                <td class="p-4 text-center text-red-400 font-mono">${taskNotDone}</td>
                <td class="p-3 text-center text-emerald-400 font-mono">${taskDone}</td>
                <td class="p-3 text-center text-slate-400 font-mono">${taskTotal}</td>
                <td class="p-3 text-center font-mono">${scoreTask.toFixed(0)}</td>
                <td class="p-3 text-center text-amber-500 font-bold font-mono">${weightTask.toFixed(1)}</td>`;
            body.appendChild(tr);

            document.getElementById(`done-${idx}`).addEventListener('change', (e) => {
                let inputVal = parseInt(e.target.value) || 0;
                s.tasks.done = Math.min(tugasKe, inputVal);
                recomputeCalculatedMetrics(idx, dataset); 
                renderUpdateDataTable();
            });
        });
    }

    // ================= 4. TAB NILAI UJIAN =================
    else if(currentSubTab === 'subExams') {
        lbl.innerHTML = `Nilai Ujian`;
        head.innerHTML = `
            <tr>
                <th class="p-3">Nama</th>
                <th class="p-3">NIM</th>
                <th class="p-3 text-center">UTS 1</th>
                <th class="p-3 text-center">UAS 1</th>
                <th class="p-3 text-center">UTS 2</th>
                <th class="p-3 text-center">UAS 2</th>
                <th class="p-3 text-center">Nilai Rata-Rata</th>
                <th class="p-3 text-center">Bobot (40%)</th>
            </tr>`;

        dataset.forEach((s, idx) => {
            let examAvg = (s.exams.uts1 + s.exams.uas1 + s.exams.uts2 + s.exams.uas2) / 4;
            let weightExam = examAvg * 0.40;

            let tr = document.createElement('tr');
            tr.className = "hover:bg-slate-900/30 transition-colors";
            tr.innerHTML = `
                <td class="p-3 text-white font-bold">${s.name}</td>
                <td class="p-3 text-cyan-400 font-mono">${s.nim}</td>
                <td class="p-3 text-center"><input type="number" id="uts1-${idx}" value="${s.exams.uts1}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-slate-200 focus:outline-none focus:border-cyan-400"></td>
                <td class="p-3 text-center"><input type="number" id="uas1-${idx}" value="${s.exams.uas1}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-slate-200 focus:outline-none focus:border-cyan-400"></td>
                <td class="p-3 text-center"><input type="number" id="uts2-${idx}" value="${s.exams.uts2}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-slate-200 focus:outline-none focus:border-cyan-400"></td>
                <td class="p-3 text-center"><input type="number" id="uas2-${idx}" value="${s.exams.uas2}" class="w-14 bg-slate-950 border border-slate-800 text-center p-1 rounded text-slate-200 focus:outline-none focus:border-cyan-400"></td>
                <td class="p-3 text-center text-purple-400 font-mono">${examAvg.toFixed(1)}</td>
                <td class="p-3 text-center text-blue-500 font-bold font-mono">${weightExam.toFixed(1)}</td>`;
            body.appendChild(tr);

            ['uts1', 'uas1', 'uts2', 'uas2'].forEach(examType => {
                document.getElementById(`${examType}-${idx}`).addEventListener('change', (e) => {
                    s.exams[examType] = parseInt(e.target.value) || 0;
                    recomputeCalculatedMetrics(idx, dataset); 
                    renderUpdateDataTable();
                });
            });
        });
    }
    
    // ================= 5. TAB TOTAL NILAI SUMMARY =================
    else {
        lbl.innerHTML = `Total Nilai`;
        head.innerHTML = `
            <tr>
                <th class="p-3 text-center">Rank</th>
                <th class="p-3">Nama</th>
                <th class="p-3">NIM</th>
                <th class="p-3 text-center">Bobot Kehadiran</th>
                <th class="p-3 text-center">Bobot Proaktif</th>
                <th class="p-3 text-center">Bobot Tugas</th>
                <th class="p-3 text-center">Bobot Ujian</th>
                <th class="p-3 text-center">Total Nilai</th>
            </tr>`;

        let sortedSummary = [...dataset].sort((a,b) => b.finalScore - a.finalScore);

        sortedSummary.forEach((s, rankIdx) => {
            let tr = document.createElement('tr');
            tr.className = "hover:bg-slate-900/30 transition-colors";
            tr.innerHTML = `
                <td class="p-3 text-center font-bold font-mono text-amber-400">#${rankIdx + 1}</td>
                <td class="p-3 text-white font-bold">${s.name}</td>
                <td class="p-3 text-slate-400 font-mono">${s.nim}</td>
                <td class="p-3 text-center font-mono text-fuchsia-400">${s.attendance.weight.toFixed(1)}</td>
                <td class="p-3 text-center font-mono text-pink-500">${s.proactive.weight.toFixed(1)}</td>
                <td class="p-3 text-center font-mono text-amber-500">${s.tasks.weight.toFixed(1)}</td>
                <td class="p-3 text-center font-mono text-blue-500">${s.exams.weight.toFixed(1)}</td>
                <td class="p-3 text-center text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400 font-mono">${s.finalScore.toFixed(2)}</td>`;
            body.appendChild(tr);
        });
    }
}

function renderStudentManagementTable() {
    const tbody = document.getElementById('studentManagementTableBody');
    tbody.innerHTML = "";
    
    studentDataset.forEach((s, idx) => {
        let tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/30 transition-colors";
        tr.innerHTML = `
            <td class="p-4">
                <div class="w-12 h-12 rounded-full overflow-hidden border border-slate-700 relative group cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.1)]">
                    <img id="avatarImg-${idx}" src="${s.avatar}" class="w-full h-full object-cover transition duration-300 group-hover:scale-110">
                    <label for="fileInput-${idx}" class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
                        <span class="text-[10px] text-cyan-400 font-bold tracking-wider uppercase">Upload</span>
                        <span class="text-[8px] text-slate-400 font-mono">PNG/JPG</span>
                    </label>
                    <input type="file" id="fileInput-${idx}" accept="image/*" class="hidden">
                </div>
            </td>
            <td class="p-4 text-white font-bold">
                <input type="text" id="nameIn-${idx}" value="${s.name}" 
                       class="bg-slate-950/40 border border-slate-800/80 rounded px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none w-full max-w-xs font-sans transition">
            </td>
            <td class="p-4 text-cyan-400 font-mono tracking-wider">
                <input type="number" id="nimIn-${idx}" value="${s.nim}" 
                       class="bg-slate-950/40 border border-slate-800/80 rounded px-3 py-1.5 text-xs text-cyan-400 focus:border-cyan-400 focus:outline-none w-28 font-mono transition">
            </td>
            <td class="p-4 text-center">
                <button id="editBtn-${idx}" class="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition active:scale-95 shadow-[0_0_10px_rgba(0,240,255,0.05)]">
                    ✏️ Edit Data
                </button>
                <button id="deleteBtn-${idx}" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition active:scale-95 shadow-[0_0_10px_rgba(255,0,0,0.05)] ml-2">
                    🗑️ Hapus
                </button>
            </td>`;
            
        tbody.appendChild(tr);

        document.getElementById(`nameIn-${idx}`).addEventListener('change', async (e) => { 
            s.name = e.target.value; 
            // propagate to subject datasets
            Object.keys(subjectData).forEach(key => {
                if (subjectData[key] && subjectData[key][idx]) subjectData[key][idx].name = s.name;
            });
            populateStudentDropdowns();
            await syncToFirestoreCloud();
        });

        document.getElementById(`nimIn-${idx}`).addEventListener('change', async (e) => {
            let newNim = parseInt(e.target.value);
            if (isNaN(newNim)) {
                alert("NIM harus berupa angka!");
                e.target.value = s.nim;
                return;
            }
            let isDuplicate = studentDataset.some((student, i) => student.nim === newNim && i !== idx);
            if (isDuplicate) {
                alert(`NIM ${newNim} sudah digunakan murid lain!`);
                e.target.value = s.nim;
                return;
            }
            s.nim = newNim; 
            // propagate to subject datasets by index
            Object.keys(subjectData).forEach(key => {
                if (subjectData[key] && subjectData[key][idx]) subjectData[key][idx].nim = s.nim;
            });
            populateStudentDropdowns();
            await syncToFirestoreCloud();
        });

        document.getElementById(`fileInput-${idx}`).addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 500 * 1024) { // 500KB limit untuk base64
                    alert("🚨 Ukuran file terlalu besar! Maksimal adalah 500KB.\n💡 Kompresi gambar terlebih dahulu.");
                    return;
                }
                const reader = new FileReader();
                reader.onload = async function(event) {
                    const base64Image = event.target.result;
                    document.getElementById(`avatarImg-${idx}`).src = base64Image;
                    s.avatar = base64Image;
                    
                    // PENTING: Propagate avatar update ke semua subjectData
                    Object.keys(subjectData).forEach(key => {
                        if (subjectData[key] && subjectData[key][idx]) {
                            subjectData[key][idx].avatar = base64Image;
                        }
                    });
                    
                    await syncToFirestoreCloud();
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById(`editBtn-${idx}`).addEventListener('click', () => {
            const currentNameInput = document.getElementById(`nameIn-${idx}`);
            currentNameInput.focus();
            currentNameInput.classList.add('border-cyan-400', 'bg-slate-900');
            currentNameInput.addEventListener('blur', () => {
                currentNameInput.classList.remove('border-cyan-400', 'bg-slate-900');
            }, { once: true });
        });

        document.getElementById(`deleteBtn-${idx}`).addEventListener('click', async () => {
            const studentName = s.name;
            const studentNim = s.nim;
            const confirmDelete = confirm(
                `⚠️ KONFIRMASI PENGHAPUSAN\n\nApakah Anda yakin ingin menghapus data murid:\n\n📛 Nama: ${studentName}\n📋 NIM: ${studentNim}\n\nTindakan ini TIDAK DAPAT DIBATALKAN dan akan menghapus data permanen dari Firestore.`
            );

            if (confirmDelete) {
                try {
                    // Hapus dari studentDataset
                    studentDataset.splice(idx, 1);

                    // Hapus dari semua subjectData di index yang sama
                    Object.keys(subjectData).forEach(key => {
                        if (subjectData[key] && subjectData[key][idx] !== undefined) {
                            subjectData[key].splice(idx, 1);
                        }
                    });

                    // Sinkronisasi ke Firestore
                    await syncToFirestoreCloud();
                    alert(`✅ Data murid ${studentName} (NIM: ${studentNim}) berhasil dihapus permanen.`);

                    // Re-render tabel dan dropdown
                    populateStudentDropdowns();
                    renderStudentManagementTable();
                    syncSelectedStudentProfile();
                } catch (e) {
                    alert(`❌ Gagal menghapus data: ${e.message}`);
                }
            }
        });
    });
}

function recomputeCalculatedMetrics(idx, dataset = null) {
    let ds = dataset || studentDataset;
    let s = ds[idx];
    
    s.attendance.score = s.attendance.meetings > 0 ? (s.attendance.present / s.attendance.meetings) * 100 : 0;
    s.attendance.weight = s.attendance.score * 0.10;
    
    s.proactive.total = s.proactive.ask + s.proactive.answer + s.proactive.add;
    let scoreProactive = 50;
    if (s.proactive.total > s.attendance.present) {
        scoreProactive = 100;
    } else if (s.proactive.total === s.attendance.present) {
        scoreProactive = 70;
    }
    s.proactive.score = scoreProactive;
    s.proactive.weight = scoreProactive * 0.20;
    
    s.tasks.score = (s.tasks.done / s.tasks.total) * 100;
    s.tasks.weight = s.tasks.score * 0.30;
    
    s.exams.avg = (s.exams.uts1 + s.exams.uas1 + s.exams.uts2 + s.exams.uas2) / 4;
    s.exams.weight = s.exams.avg * 0.40;
    
    s.finalScore = parseFloat((s.attendance.weight + s.proactive.weight + s.tasks.weight + s.exams.weight).toFixed(2));
}

// ================= SUMMARY TABLE CALCULATION & RENDERING =================
function calculateSummaryMetrics() {
    const metrics = studentDataset.map((student, idx) => {
        let totalScoreBySubject = {};
        let subjectCount = 0;
        let totalScoreSum = 0;

        subjectList.forEach(mapel => {
            ensureSubjectDataset(mapel);
            const mapelData = subjectData[mapel];

            if(mapelData && mapelData[idx]) {
                const s = mapelData[idx];
                const mapelTotal = s.attendance.weight + s.proactive.weight + s.tasks.weight + s.exams.weight;
                totalScoreBySubject[mapel] = parseFloat(mapelTotal.toFixed(2));
                totalScoreSum += mapelTotal;
                subjectCount++;
            } else {
                totalScoreBySubject[mapel] = 0;
            }
        });

        const averageScore = subjectCount > 0 ? parseFloat((totalScoreSum / subjectCount).toFixed(2)) : 0;

        return {
            nim: student.nim,
            name: student.name,
            avatar: student.avatar,
            subjectScores: totalScoreBySubject,
            totalScore: parseFloat(totalScoreSum.toFixed(2)),
            averageScore
        };
    });

    return metrics
        .sort((a, b) => b.averageScore - a.averageScore)
        .map((m, idx) => ({ ...m, rank: idx + 1 }));
}

function renderSummaryTable() {
    const metrics = calculateSummaryMetrics();
    const thead = document.getElementById('summaryTableHead');
    const tbody = document.getElementById('summaryTableBody');

    // Build dynamic header: Rank, Nama, NIM, one column per subject, Total Nilai, Rata-Rata
    thead.innerHTML = `
        <tr>
            <th class="p-3 text-center">Rank</th>
            <th class="p-3">Nama</th>
            <th class="p-3">NIM</th>
            ${subjectList.map(mapel => `<th class="p-3 text-center">${mapel}</th>`).join('')}
            <th class="p-3 text-center">Total Nilai</th>
            <th class="p-3 text-center">Rata-Rata</th>
        </tr>`;

    tbody.innerHTML = metrics.map(m => {
        const perSubjectCells = subjectList.map(mapel => {
            const value = m.subjectScores?.[mapel] ?? 0;
            return `<td class="p-3 text-center text-slate-300 font-mono">${value.toFixed(2)}</td>`;
        }).join('');

        return `
            <tr class="hover:bg-slate-900/30 transition">
                <td class="p-3 text-center font-bold text-cyan-400">#${m.rank}</td>
                <td class="p-3 text-emerald-300 font-semibold">${m.name}</td>
                <td class="p-3 text-slate-400">${m.nim}</td>
                ${perSubjectCells}
                <td class="p-3 text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-bold">${m.totalScore.toFixed(2)}</td>
                <td class="p-3 text-center text-slate-200">${m.averageScore.toFixed(2)}</td>
            </tr>`;
    }).join('');
}

// ================= ROUTING NAVIGATION EVENT BINDINGS =================
export function switchTab(tabId) {
    ['tabDashboard', 'tabUpdateData', 'tabUpdateStudents', 'tabSummary', 'tabChatAI'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    const target = document.getElementById(tabId);
    if(target) target.classList.remove('hidden');

    if(tabId === 'tabDashboard') {
        populateStudentDropdowns();
        syncSelectedStudentProfile();
    }
    if(tabId === 'tabUpdateData') renderUpdateDataTable();
    if(tabId === 'tabUpdateStudents') renderStudentManagementTable();
    if(tabId === 'tabSummary') renderSummaryTable();
    if(tabId === 'tabChatAI') ensureChatAIInit();
}

document.getElementById('btnNavDashboard').addEventListener('click', () => switchTab('tabDashboard'));
document.getElementById('btnNavSummary').addEventListener('click', () => switchTab('tabSummary'));
document.getElementById('btnNavData').addEventListener('click', () => switchTab('tabUpdateData'));
document.getElementById('btnNavStudents').addEventListener('click', () => switchTab('tabUpdateStudents'));
document.getElementById('btnNavChatAI')?.addEventListener('click', () => switchTab('tabChatAI'));
document.getElementById('filterStudent').addEventListener('change', syncSelectedStudentProfile);


['Attendance', 'Proactive', 'Tasks', 'Exams', 'Summary'].forEach(sub => {
    document.getElementById(`subTab${sub}`).addEventListener('click', (e) => {
        currentSubTab = `sub${sub}`;
        document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.className = "sub-tab-btn px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg bg-slate-900 text-slate-400 transition");
        e.target.className = "sub-tab-btn px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg bg-cyan-500 text-slate-950 transition";
        renderUpdateDataTable();
    });
});

// Pembaruan Aksi Submit Data: Mengakumulasi data absensi secara cerdas saat tombol Submit diklik
document.getElementById('btnActionSubmitData').addEventListener('click', async () => {
    const currentSubject = getCurrentSubject();
    const dataset = ensureSubjectDataset(currentSubject);
    if (currentSubTab === 'subAttendance') {
        dataset.forEach((s, idx) => {
            const selectEl = document.getElementById(`selAtt-${idx}`);
            if (selectEl) {
                const statusTerpilih = selectEl.value;
                if (statusTerpilih === 'Hadir') s.attendance.present = (s.attendance.present || 0) + 1;
                else if (statusTerpilih === 'Sakit') s.attendance.sick = (s.attendance.sick || 0) + 1;
                else if (statusTerpilih === 'Izin') s.attendance.permit = (s.attendance.permit || 0) + 1;
                else if (statusTerpilih === 'Mangkir') s.attendance.absent = (s.attendance.absent || 0) + 1;
                s.attendance.meetings = pertemuanKe;
                recomputeCalculatedMetrics(idx, dataset);
            }
        });
        renderUpdateDataTable();
    }
    await syncToFirestoreCloud(); // Jalankan proses upload cloud database
});

document.getElementById('btnActionSubmitStud').addEventListener('click', syncToFirestoreCloud);

document.getElementById('btnAddStudent').addEventListener('click', async () => {
    let namePrompt = prompt("Nama Murid Baru:");
    if(!namePrompt) return;
    
    let nimPrompt = prompt("Masukkan NIM Murid Baru (Harus Angka & Unik):");
    if(!nimPrompt) return;
    let targetNim = parseInt(nimPrompt);

    if (isNaN(targetNim)) {
        alert("🚨 Gagal! NIM harus berupa angka.");
        return;
    }

    let isDuplicate = studentDataset.some(s => s.nim === targetNim);
    if (isDuplicate) {
        alert(`🚨 Gagal! NIM ${targetNim} sudah digunakan.`);
        return;
    }

    let nikPrompt = prompt("Masukkan NIK Murid Baru (Nomor Induk Keluarga, Angka & Unik):");
    let targetNik = nikPrompt ? parseInt(nikPrompt) : targetNim;
    if (isNaN(targetNik)) targetNik = targetNim;

    let nikDuplicate = studentDataset.some(s => s.nik === targetNik);
    if (nikDuplicate) {
        alert(`🚨 Gagal! NIK ${targetNik} sudah digunakan.`);
        return;
    }

    studentDataset.push({
        nik: targetNik,
        nim: targetNim, 
        name: namePrompt,
        avatar: avatarsMock[0], 
        attendance: { present: 20, sick: 0, permit: 0, absent: 0, meetings: 20, status: 'Hadir', score: 100, weight: 10 },
        proactive: { ask: 0, answer: 0, add: 0, total: 0, score: 50, weight: 10 }, 
        tasks: { done: 20, total: 20, score: 100, weight: 30 },
        exams: { uts1: 80, uas1: 80, uts2: 80, uas2: 80, avg: 80, weight: 32 }, 
        finalScore: 82.0
    });
    // also add to each subject dataset to keep indexes aligned
    Object.keys(subjectData).forEach(key => {
        subjectData[key].push({
            nim: targetNim,
            name: namePrompt,
            avatar: avatarsMock[0],
            attendance: { present: 20, sick: 0, permit: 0, absent: 0, meetings: 20, status: 'Hadir', score: 100, weight: 10 },
            proactive: { ask: 0, answer: 0, add: 0, total: 0, score: 50, weight: 10 },
            tasks: { done: 20, total: 20, score: 100, weight: 30 },
            exams: { uts1: 80, uas1: 80, uts2: 80, uas2: 80, avg: 80, weight: 32 },
            finalScore: 82.0
        });
    });
    populateStudentDropdowns();
    renderStudentManagementTable();
    await syncToFirestoreCloud();
});

// ---------------- Subject UI & CRUD (Add / Edit / Delete) ----------------
function subjectSelectionChanged() {
    const selected = this.value;
    ['filterSubject', 'filterSubjectList'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = selected;
    });
    ensureSubjectDataset(selected);
    renderUpdateDataTable();
    syncSelectedStudentProfile();
}

function populateSubjectSelectors() {
    ['filterSubject', 'filterSubjectList'].forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        const prev = sel.value;
        sel.innerHTML = '';
        subjectList.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s;
            opt.innerText = s;
            sel.appendChild(opt);
        });
        sel.value = (prev && subjectList.includes(prev)) ? prev : subjectList[0];
        sel.onchange = subjectSelectionChanged;
    });
}

document.getElementById('btnEditSubject')?.addEventListener('click', () => {
    const sel = document.getElementById('filterSubjectList');
    if(!sel) return alert('Filter mapel tidak tersedia.');
    const current = sel.value;
    const newName = prompt('Ubah nama mapel:', current);
    if(!newName) return;
    const idx = subjectList.indexOf(current);
    if(idx >= 0) {
        subjectList[idx] = newName.trim();
            populateSubjectSelectors();
    }
});

document.getElementById('btnAddSubject')?.addEventListener('click', () => {
    const name = prompt('Nama mapel baru:');
    if(!name) return;
    if(subjectList.includes(name.trim())) return alert('Mapel sudah ada.');
    subjectList.push(name.trim());
    subjectData[name.trim()] = {};
    populateSubjectSelectors();
    const sel = document.getElementById('filterSubjectList');
    if(sel) sel.value = name.trim();
    renderUpdateDataTable();
    syncToFirestoreCloud();
});

document.getElementById('btnDeleteSubject')?.addEventListener('click', () => {
    const sel = document.getElementById('filterSubjectList');
    if(!sel) return alert('Filter mapel tidak tersedia.');
    const current = sel.value;
    if(!confirm(`Hapus mapel "${current}" ? Tindakan ini tidak mempengaruhi data murid.`)) return;
    if(subjectList.length <= 1) return alert('Tidak dapat menghapus semua mapel.');
    const idx = subjectList.indexOf(current);
    if(idx >= 0) subjectList.splice(idx, 1);
    delete subjectData[current];
    populateSubjectSelectors();
    renderUpdateDataTable();
    syncToFirestoreCloud();
});

// Ensure subject filter exists for initial render
populateSubjectSelectors();

// ================= CHAT AI (ADVANCED INTELLIGENT ENGINE) =================
let chatAIInited = false;

// ---------- Helper: Get context from UI ----------
function getActiveStudentNim() {
    const dropdown = document.getElementById('filterStudent');
    if (dropdown && dropdown.value) return parseInt(dropdown.value, 10);
    const nimText = document.getElementById('profileNim')?.innerText;
    const m = String(nimText || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

function getActiveStudentData() {
    const nim = getActiveStudentNim();
    if (nim == null) {
        const dropdown = document.getElementById('filterStudent');
        if(dropdown?.value) {
            return studentDataset.find(s => s.nim === parseInt(dropdown.value, 10)) || null;
        }
        return null;
    }
    return studentDataset.find(s => s.nim === nim) || null;
}

function getActiveStudentDataAllSubjects() {
    const nim = getActiveStudentNim();
    if (nim == null) return null;
    const result = {};
    subjectList.forEach(mapel => {
        ensureSubjectDataset(mapel);
        const mapelData = subjectData[mapel];
        if (mapelData) {
            const s = mapelData.find(st => st.nim === nim);
            if (s) result[mapel] = s;
        }
    });
    return Object.keys(result).length > 0 ? result : null;
}

function getUserRoleFromUI() {
    const badge = document.getElementById('roleBadge')?.innerText || '';
    if (badge.toLowerCase().includes('admin')) return 'admin';
    if (badge.toLowerCase().includes('walimurid')) return 'walimurid';
    return 'murid';
}

// ---------- DEEP DATA ANALYSIS FUNCTIONS ----------

/** Get detailed breakdown for a single student in their active subject */
function getStudentComponentBreakdown(student) {
    if (!student) return null;
    return [
        { key: 'Kehadiran', value: student.attendance?.score ?? 0, raw: student.attendance?.present ?? 0, max: student.attendance?.meetings ?? 1, weight: student.attendance?.weight ?? 0, bobot: '10%' },
        { key: 'Proaktif', value: student.proactive?.score ?? 0, raw: student.proactive?.total ?? 0, max: student.attendance?.present ?? 1, weight: student.proactive?.weight ?? 0, bobot: '20%' },
        { key: 'Tugas', value: student.tasks?.score ?? 0, raw: student.tasks?.done ?? 0, max: student.tasks?.total ?? 1, weight: student.tasks?.weight ?? 0, bobot: '30%' },
        { key: 'Ujian', value: student.exams?.avg ?? 0, raw: 'UTS1:'+(student.exams?.uts1 ?? 0)+', UAS1:'+(student.exams?.uas1 ?? 0)+', UTS2:'+(student.exams?.uts2 ?? 0)+', UAS2:'+(student.exams?.uas2 ?? 0), max: 100, weight: student.exams?.weight ?? 0, bobot: '40%' }
    ];
}

/** Rank student across all subjects */
function getStudentOverallRank(nim) {
    const metrics = calculateSummaryMetrics();
    const idx = metrics.findIndex(m => m.nim === nim);
    if (idx === -1) return null;
    return { rank: idx + 1, total: metrics.length, metrics: metrics[idx] };
}

/** Get all students sorted by a component across all subjects (average) */
function getClassComponentAverages() {
    const components = ['Kehadiran', 'Proaktif', 'Tugas', 'Ujian'];
    const result = {};
    components.forEach(comp => {
        let totalVal = 0, count = 0;
        subjectList.forEach(mapel => {
            ensureSubjectDataset(mapel);
            const ds = subjectData[mapel];
            if (ds) {
                ds.forEach(s => {
                    let val = 0;
                    if (comp === 'Kehadiran') val = s.attendance?.score ?? 0;
                    else if (comp === 'Proaktif') val = s.proactive?.score ?? 0;
                    else if (comp === 'Tugas') val = s.tasks?.score ?? 0;
                    else if (comp === 'Ujian') val = s.exams?.avg ?? 0;
                    totalVal += val;
                    count++;
                });
            }
        });
        result[comp] = count > 0 ? totalVal / count : 0;
    });
    return result;
}

/** Get at-risk students (finalScore < threshold across all subjects avg) */
function getAtRiskStudents(threshold) {
    if (threshold === undefined) threshold = 75;
    const metrics = calculateSummaryMetrics();
    return metrics
        .filter(m => m.averageScore < threshold)
        .sort((a, b) => a.averageScore - b.averageScore)
        .map(m => ({
            ...m,
            student: studentDataset.find(s => s.nim === m.nim)
        }));
}

/** Get top performers (talent detection) */
function getTopPerformers(topN) {
    if (topN === undefined) topN = 5;
    const metrics = calculateSummaryMetrics();
    return metrics
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, topN)
        .map(m => ({
            ...m,
            student: studentDataset.find(s => s.nim === m.nim)
        }));
}

/** Get student's best & worst subjects */
function getStudentBestWorstSubjects(nim) {
    const scores = [];
    subjectList.forEach(mapel => {
        ensureSubjectDataset(mapel);
        const ds = subjectData[mapel];
        if (ds) {
            const s = ds.find(st => st.nim === nim);
            if (s) {
                scores.push({ subject: mapel, score: s.finalScore });
            }
        }
    });
    if (scores.length === 0) return null;
    scores.sort((a, b) => b.score - a.score);
    return { best: scores[0], worst: scores[scores.length - 1], all: scores };
}

/** Get overall class performance summary per subject */
function getSubjectPerformanceSummary() {
    return subjectList.map(mapel => {
        ensureSubjectDataset(mapel);
        const ds = subjectData[mapel];
        if (!ds || ds.length === 0) return { subject: mapel, avg: 0, min: 0, max: 0, count: 0 };
        const scores = ds.map(s => s.finalScore);
        return {
            subject: mapel,
            avg: scores.reduce((a, b) => a + b, 0) / scores.length,
            min: Math.min(...scores),
            max: Math.max(...scores),
            count: scores.length
        };
    });
}

/** Get component-level recommendation for improvement */
function getComponentRecommendation(componentKey, studentName, value) {
    const advice = {
        'Kehadiran': {
            low: [studentName+' perlu meningkatkan kehadiran.', '• Tetapkan target hadir 100% setiap pertemuan.', '• Jika sakit/izin, segera laporkan dengan surat keterangan.', '• Cek jadwal rutin agar tidak lupa jam pelajaran.', '• Diskusikan dengan guru jika ada kendala transportasi.'],
            medium: ['Kehadiran '+studentName+' cukup baik, masih bisa ditingkatkan.', '• Pertahankan konsistensi kehadiran.', '• Usahakan tidak pernah terlambat.'],
            high: ['Kehadiran '+studentName+' sudah sangat baik! Pertahankan!']
        },
        'Proaktif': {
            low: [studentName+' perlu lebih aktif di kelas.', '• Targetkan bertanya minimal 1x setiap pertemuan.', '• Catat poin yang kurang paham, lalu tanyakan ke guru.', '• Coba menjawab pertanyaan guru meskipun ragu.', '• Berani menambahkan pendapat saat diskusi.'],
            medium: ['Partisipasi '+studentName+' cukup baik, bisa lebih ditingkatkan.', '• Coba lebih sering menjawab pertanyaan.', '• Bantu teman yang kesulitan untuk menambah poin.'],
            high: [studentName+' sangat aktif dan partisipatif! Luar biasa!']
        },
        'Tugas': {
            low: [studentName+' perlu lebih disiplin mengerjakan tugas.', '• Buat jadwal pengerjaan tugas setiap hari.', '• Kerjakan tugas segera setelah diberikan.', '• Jangan menunda - kerjakan sedikit demi sedikit.', '• Minta bantuan teman atau guru jika kesulitan.'],
            medium: ['Pengerjaan tugas '+studentName+' cukup konsisten.', '• Coba selesaikan tugas sebelum tenggat waktu.', '• Tingkatkan kualitas dengan membaca ulang sebelum dikumpulkan.'],
            high: [studentName+' sangat rajin mengerjakan tugas! Prestasi yang membanggakan!']
        },
        'Ujian': {
            low: ['Nilai ujian '+studentName+' perlu ditingkatkan.', '• Buat ringkasan materi untuk dipelajari.', '• Latihan soal UTS/UAS tahun sebelumnya.', '• Belajar kelompok dengan teman untuk diskusi materi.', '• Fokus pada konsep dasar yang sering muncul di ujian.'],
            medium: ['Nilai ujian '+studentName+' cukup baik, masih ada ruang untuk naik.', '• Perdalam materi yang masih kurang dikuasai.', '• Coba kerjakan soal-soal dengan level lebih sulit.'],
            high: ['Nilai ujian '+studentName+' sangat memuaskan! Pertahankan strategi belajarnya!']
        }
    };
    var a = advice[componentKey];
    if (!a) return '';
    if (value >= 85) return a.high.join('\n');
    if (value >= 65) return a.medium.join('\n');
    return a.low.join('\n');
}

// ---------- QUERY UNDERSTANDING ENGINE ----------
function analyzeQuery(question) {
    var q = question.toLowerCase().trim();
    
    // Detect query intent categories
    var intents = {
        greeting: /(?:^|\s)(?:halo|hai|hey|selamat|pagi|siang|malam|hallo|hi|hello|assalamualaikum)(?:\s|$)/i.test(q),
        thanks: /(?:^|\s)(?:terima kasih|makasih|thanks|thank|syukron)(?:\s|$)/i.test(q),
        goodbye: /(?:^|\s)(?:bye|dadah|sampai jumpa|daah|goodbye)(?:\s|$)/i.test(q),
        aboutStudent: /(?:^|\s)(?:siapa|nama|murid|siswa|student)(?:\s|$)/i.test(q) && /(?:^|\s)(?:aku|saya|kami|murid|siswa|semua|data)(?:\s|$)/i.test(q),
        whoAmI: /(?:^|\s)(?:siapa aku|siapa saya|data saya|profil saya)(?:\s|$)/i.test(q),
        studentCount: /(?:^|\s)(?:berapa|jumlah)(?:\s|$)/i.test(q) && /(?:^|\s)(?:murid|siswa|student|orang)(?:\s|$)/i.test(q),
        explainDashboard: /(?:^|\s)(?:dashboard|grafik|chart|tampilan|menu utama)(?:\s|$)/i.test(q),
        leaderboard: /(?:^|\s)(?:leaderboard|peringkat|ranking|rank|urutan|tertinggi|terbaik)(?:\s|$)/i.test(q),
        ranking: /(?:^|\s)(?:ranking|rank|peringkat|urutan|nomor)(?:\s|$)/i.test(q) || /#\d/.test(q),
        weakPoint: /(?:^|\s)(?:lemah|terendah|rendah|buruk|kurang|jelek|minus|turun)(?:\s|$)/i.test(q),
        strongPoint: /(?:^|\s)(?:kuat|tertinggi|tinggi|baik|bagus|hebat|pintar|jago|unggul|talent|bakat)(?:\s|$)/i.test(q),
        recommendation: /(?:^|\s)(?:saran|rekomendasi|rekom|tips|harus|perbaiki|perlu|upgrade|tingkatkan|solusi)(?:\s|$)/i.test(q),
        summary: /(?:^|\s)(?:ringkas|ringkasan|summar|rangkum|rangkuman|kesimpulan|intisari)(?:\s|$)/i.test(q),
        attendance: /(?:^|\s)(?:hadir|kehadiran|attendance|absensi|sakit|izin|mangkir)(?:\s|$)/i.test(q),
        proactive: /(?:^|\s)(?:proaktif|aktif|bertanya|menjawab|partisipasi|tanya|jawab)(?:\s|$)/i.test(q),
        tasks: /(?:^|\s)(?:tugas|pr|pekerjaan rumah|task|kerjakan|selesai)(?:\s|$)/i.test(q),
        exams: /(?:^|\s)(?:ujian|uts|uas|nilai ujian|exam|test|ulangan)(?:\s|$)/i.test(q),
        compare: /(?:^|\s)(?:banding|compare|vs|lawan|lebih|dari pada|daripada|komparasi)(?:\s|$)/i.test(q),
        forecast: /(?:^|\s)(?:prediksi|ramal|forecast|perkiraan|masa depan|akan|tren|trend)(?:\s|$)/i.test(q),
        atRisk: /(?:^|\s)(?:risiko|beresiko|bahaya|warning|peringatan|awas|drop|gagal|terancam)(?:\s|$)/i.test(q),
        bestStudent: /(?:^|\s)(?:terpintar|terbaik|paling|juara|nomor satu|top|tertinggi)(?:\s|$)/i.test(q),
        worstStudent: /(?:^|\s)(?:terburuk|paling rendah|paling lemah|terendah|terbawah)(?:\s|$)/i.test(q),
        perSubject: /(?:^|\s)(?:mapel|mata pelajaran|pelajaran|semua mapel|per mapel|semua pelajaran)(?:\s|$)/i.test(q),
        subjectSpecific: /(?:^|\s)(?:matematika|ipa|ips|bahasa|agama|pkn|pancasila|pjok|seni|inggris|mulok)(?:\s|$)/i.test(q),
        help: /(?:^|\s)(?:help|tolong|bantuan|bantu|fitur|bisa)(?:\s|$)/i.test(q) || /\?/.test(q),
        allStudents: /(?:^|\s)(?:semua murid|semua siswa|seluruh|keseluruhan kelas|kelas)(?:\s|$)/i.test(q),
        improvement: /(?:^|\s)(?:progress|perkembangan|perubahan|naik|meningkat|membaik)(?:\s|$)/i.test(q),
        finalScore: /(?:^|\s)(?:nilai akhir|final|total nilai|score|skor)(?:\s|$)/i.test(q),
        studyPlan: /(?:^|\s)(?:belajar|jadwal|rencana|plan|strategi|cara belajar)(?:\s|$)/i.test(q),
        teacher: /(?:^|\s)(?:guru|pengajar|wali kelas)(?:\s|$)/i.test(q),
        parentAdvice: /(?:^|\s)(?:anak|orang tua|parent|rumah|bimbing|damping)(?:\s|$)/i.test(q),
    };
    
    // Detect numeric references (student NIM, rank number)
    var nimMatch = q.match(/\b(\d{4,})\b/);
    var detectedNim = nimMatch ? parseInt(nimMatch[1]) : null;
    
    // Detect subject name references
    var subjectKeywords = {
        'matematika': 'Matematika',
        'ipa': 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
        'ipas': 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
        'sains': 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
        'bahasa indonesia': 'Bahasa Indonesia',
        'indonesia': 'Bahasa Indonesia',
        'bahasa inggris': 'Bahasa Inggris',
        'inggris': 'Bahasa Inggris',
        'agama': 'Pendidikan Agama dan Budi Pekerti',
        'pendidikan agama': 'Pendidikan Agama dan Budi Pekerti',
        'pancasila': 'Pendidikan Pancasila',
        'pkn': 'Pendidikan Pancasila',
        'seni': 'Seni dan Budaya',
        'budaya': 'Seni dan Budaya',
        'pjok': 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
        'penjas': 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
        'olahraga': 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
        'mulok': 'Muatan Lokal',
        'muatan lokal': 'Muatan Lokal'
    };
    var detectedSubject = null;
    for (var keyword in subjectKeywords) {
        if (subjectKeywords.hasOwnProperty(keyword) && q.indexOf(keyword) !== -1) {
            detectedSubject = subjectKeywords[keyword];
            break;
        }
    }
    
    // Detect name references
    var detectedName = null;
    for (var si = 0; si < studentDataset.length; si++) {
        var s = studentDataset[si];
        var nameLower = s.name.toLowerCase();
        var nameParts = nameLower.split(' ');
        for (var pi = 0; pi < nameParts.length; pi++) {
            if (nameParts[pi].length > 2 && q.indexOf(nameParts[pi]) !== -1) {
                detectedName = s;
                break;
            }
        }
        if (detectedName) break;
    }
    
    return {
        raw: q,
        intents: intents,
        detectedNim: detectedNim,
        detectedSubject: detectedSubject,
        detectedName: detectedName,
        isQuestion: q.indexOf('?') !== -1 || q.indexOf('apa') !== -1 || q.indexOf('bagaimana') !== -1 || q.indexOf('siapa') !== -1 || q.indexOf('berapa') !== -1 || q.indexOf('mengapa') !== -1 || q.indexOf('kenapa') !== -1 || q.indexOf('kapan') !== -1 || q.indexOf('dimana') !== -1
    };
}

// ---------- RESPONSE GENERATORS ----------

function generateGreeting(role, student) {
    var hour = new Date().getHours();
    var timeGreeting = hour < 10 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
    
    if (role === 'admin') {
        var atRisk = getAtRiskStudents(75);
        var top = getTopPerformers(3);
        var metrics = calculateSummaryMetrics();
        var avgClass = metrics.length > 0 ? (metrics.reduce(function(s, m) { return s + m.averageScore; }, 0) / metrics.length).toFixed(2) : 0;
        
        return timeGreeting+', Admin! 👋\n\n📊 *LAPORAN CEPAT KELAS:*\n' +
            '• 👥 Total murid: **'+studentDataset.length+'** orang\n' +
            '• 📈 Rata-rata kelas: **'+avgClass+'**\n' +
            '• 🥇 Terbaik: '+(top[0] ? top[0].name+' ('+top[0].averageScore+')' : '-')+'\n' +
            '• 🚨 Berisiko: **'+atRisk.length+'** murid\n\n' +
            'Ada yang bisa saya bantu? Saya siap menganalisis data kelas lebih dalam.\n\n' +
            '💡 *Coba tanya:*\n' +
            '• "Siapa murid yang perlu perhatian?"\n' +
            '• "Ringkasan performa kelas"\n' +
            '• "Bandingkan nilai Matematika dan IPA"\n' +
            '• "Saran untuk murid dengan nilai terendah"';
    }
    
    if (role === 'walimurid') {
        if (!student) return timeGreeting+', Bapak/Ibu wali murid! 👋\n\nAda yang ingin ditanyakan tentang perkembangan anak?\n\n💡 Coba tanya:\n• "Bagaimana nilai anak saya?"\n• "Apa yang perlu diperbaiki?"\n• "Saran belajar di rumah"';
        
        var breakdown = getStudentComponentBreakdown(student);
        var rankInfo = getStudentOverallRank(student.nim);
        var subjectScores = getStudentBestWorstSubjects(student.nim);
        var sortedBreakdown = breakdown.slice().sort(function(a, b) { return a.value - b.value; });
        var weakest = sortedBreakdown[0];
        var strongest = sortedBreakdown[sortedBreakdown.length - 1];
        
        var resp = timeGreeting+', Bapak/Ibu wali murid dari **'+student.name+'**! 👋\n\n';
        resp += '📋 *LAPORAN PERKEMBANGAN '+student.name.toUpperCase()+':*\n';
        resp += '• 🏅 Peringkat: #'+(rankInfo ? rankInfo.rank : '-')+' dari '+studentDataset.length+' murid\n';
        resp += '• 📊 Nilai Akhir: **'+student.finalScore.toFixed(2)+'**\n';
        resp += '• ✅ Terkuat: **'+strongest.key+'** ('+strongest.value.toFixed(1)+'/100)\n';
        resp += '• ⚠️ Perlu perhatian: **'+weakest.key+'** ('+weakest.value.toFixed(1)+'/100)\n';
        
        if (subjectScores) {
            resp += '• 📚 Mapel terbaik: **'+subjectScores.best.subject+'** ('+subjectScores.best.score.toFixed(2)+')\n';
            resp += '• 📚 Mapel terendah: **'+subjectScores.worst.subject+'** ('+subjectScores.worst.score.toFixed(2)+')\n';
        }
        
        resp += '\n💡 *Rekomendasi:* '+getComponentRecommendation(weakest.key, student.name, weakest.value).split('\n')[0]+'\n\n';
        resp += 'Ada yang ingin ditanyakan tentang perkembangan '+student.name+'?\n\n';
        resp += '💡 *Coba tanya:*\n';
        resp += '• "Bagaimana nilai anak saya?"\n';
        resp += '• "Apa kelemahan dan kelebihannya?"\n';
        resp += '• "Saran belajar di rumah"\n';
        resp += '• "Bandingkan semua mata pelajaran"';
        
        return resp;
    }
    
    // Murid
    if (!student) return timeGreeting+', teman belajar! 👋\n\nSemangat belajarnya! Ada yang ingin kamu tanyakan?\n\n💡 Coba tanya:\n• "Nilai apa yang harus aku perbaiki?"\n• "Ringkas dashboard aku"\n• "Bagaimana cara meningkatkan nilai ujian?"';
    
    var breakdown = getStudentComponentBreakdown(student);
    var rankInfo = getStudentOverallRank(student.nim);
    var subjectScores = getStudentBestWorstSubjects(student.nim);
    var sortedBreakdown = breakdown.slice().sort(function(a, b) { return a.value - b.value; });
    var weakest = sortedBreakdown[0];
    var strongest = sortedBreakdown[sortedBreakdown.length - 1];
    
    var resp = 'Halo, **'+student.name+'**! '+timeGreeting+'! 🌟\n\n';
    resp += '📋 *RINGKASAN NILAIMU:*\n';
    resp += '• 🏅 Peringkat: #'+(rankInfo ? rankInfo.rank : '-')+' dari '+studentDataset.length+' murid\n';
    resp += '• 📊 Nilai Akhir: **'+student.finalScore.toFixed(2)+'**\n';
    resp += '• ✅ Terkuat: **'+strongest.key+'** ('+strongest.value.toFixed(1)+'/100)\n';
    resp += '• ⚠️ Perlu ditingkatkan: **'+weakest.key+'** ('+weakest.value.toFixed(1)+'/100)\n';
    
    if (subjectScores) {
        resp += '• 📚 Mapel terbaik: **'+subjectScores.best.subject+'** ('+subjectScores.best.score.toFixed(2)+')\n';
        resp += '• 📚 Mapel terendah: **'+subjectScores.worst.subject+'** ('+subjectScores.worst.score.toFixed(2)+')\n';
    }
    
    resp += '\n💡 *Semangat ya!* '+getComponentRecommendation(weakest.key, student.name, weakest.value).split('\n')[0]+'\n\n';
    resp += 'Ada yang ingin kamu tanyakan?\n\n';
    resp += '💡 *Coba tanya:*\n';
    resp += '• "Nilai apa yang harus aku perbaiki?"\n';
    resp += '• "Apa kelebihanku?"\n';
    resp += '• "Kasih saran belajar"\n';
    resp += '• "Buatkan rencana belajar"';
    
    return resp;
}

function generateHelp(role) {
    if (role === 'admin') {
        return '🤖 *AI INSIGHT ENGINE - DAFTAR PERINTAH*\n\n📊 *Analisis Kelas:*\n• "Ringkasan performa kelas"\n• "Siapa murid yang perlu perhatian?"\n• "Nilai rata-rata kelas per mapel"\n• "Leaderboard keseluruhan"\n\n🔍 *Analisis Individu:*\n• "Analisis [nama murid]"\n• "Kelemahan [nama murid]"\n• "Saran untuk [nama murid]"\n\n📈 *Perbandingan:*\n• "Bandingkan [murid A] dan [murid B]"\n• "Mapel mana yang paling rendah?"\n\n🛠️ *Rekomendasi:*\n• "Rekomendasi intervensi"\n• "Saran untuk meningkatkan nilai"';
    }
    if (role === 'walimurid') {
        return '👨‍👩‍👧‍👦 *AI PARENTING COACH - DAFTAR PERINTAH*\n\n• "Bagaimana nilai anak saya?"\n• "Apa kelemahan anak saya?"\n• "Apa kelebihan anak saya?"\n• "Saran belajar di rumah"\n• "Bandingkan semua mata pelajaran"';
    }
    return '🎓 *AI LEARNING COACH - DAFTAR PERINTAH*\n\n• "Nilai apa yang harus aku perbaiki?"\n• "Apa kelebihanku?"\n• "Ringkas dashboard"\n• "Cara meningkatkan nilai ujian"\n• "Saran belajar yang efektif"';
}

function generateAboutStudent(student, role, studentAllSubjects) {
    if (!student) return 'Silakan pilih murid terlebih dahulu di menu utama.';
    
    var breakdown = getStudentComponentBreakdown(student);
    var rankInfo = getStudentOverallRank(student.nim);
    var subjectScores = getStudentBestWorstSubjects(student.nim);
    
    var response = '📋 *PROFIL '+student.name.toUpperCase()+'*\n';
    response += 'NIM: '+student.nim+' | NIK: '+(student.nik || '-')+'\n\n';
    
    response += '📊 *Komponen Penilaian (Mapel aktif):*\n';
    for (var bi = 0; bi < breakdown.length; bi++) {
        var b = breakdown[bi];
        var emoji = b.value >= 85 ? '🟢' : b.value >= 65 ? '🟡' : '🔴';
        response += emoji+' '+b.key+': '+b.value.toFixed(1)+'/100 (Bobot: '+b.bobot+')\n';
    }
    
    if (subjectScores) {
        response += '\n📚 *Semua Mapel:*\n';
        response += '🏆 Terbaik: '+subjectScores.best.subject+' ('+subjectScores.best.score.toFixed(2)+')\n';
        response += '📉 Terendah: '+subjectScores.worst.subject+' ('+subjectScores.worst.score.toFixed(2)+')\n';
        response += '\n📈 Detail per Mapel:\n';
        for (var sai = 0; sai < subjectScores.all.length; sai++) {
            var sa = subjectScores.all[sai];
            var emj = sa.score >= 80 ? '🟢' : sa.score >= 65 ? '🟡' : '🔴';
            response += emj+' '+sa.subject+': '+sa.score.toFixed(2)+'\n';
        }
    }
    
    if (rankInfo) {
        response += '\n🏅 Peringkat Keseluruhan: #'+rankInfo.rank+' dari '+rankInfo.total+' murid\n';
        response += 'Rata-rata semua mapel: '+rankInfo.metrics.averageScore.toFixed(2)+'\n';
    }
    
    response += '\n*💡 RECOMMENDATION:*\n';
    var sortedBreakdown = breakdown.slice().sort(function(a, b) { return a.value - b.value; });
    var worstComp = sortedBreakdown[0];
    response += 'Fokus utama: **'+worstComp.key+'** ('+worstComp.value.toFixed(1)+'/100)\n';
    response += getComponentRecommendation(worstComp.key, student.name, worstComp.value);
    
    return response;
}

function generateWeakPointAnalysis(student, role) {
    if (!student) return 'Silakan pilih murid terlebih dahulu.';
    
    var breakdown = getStudentComponentBreakdown(student);
    var sorted = breakdown.slice().sort(function(a, b) { return a.value - b.value; });
    
    var response = '🔍 *ANALISIS KELEMAHAN: '+student.name.toUpperCase()+'*\n\n';
    
    response += '⚠️ *Peringkat Kelemahan (dari yang terlemah):*\n';
    for (var i = 0; i < sorted.length; i++) {
        var emj = i === 0 ? '🔴' : i === 1 ? '🟠' : '🟡';
        response += emj+' '+(i+1)+'. '+sorted[i].key+': '+sorted[i].value.toFixed(1)+'/100\n';
    }
    
    response += '\n📊 *Detail Analisis:*\n';
    var weakest = sorted[0];
    response += '\n🔴 **'+weakest.key+'** (Nilai: '+weakest.value.toFixed(1)+'/100):\n';
    response += getComponentRecommendation(weakest.key, student.name, weakest.value);
    
    if (sorted.length > 1) {
        var second = sorted[1];
        response += '\n\n🟠 **'+second.key+'** (Nilai: '+second.value.toFixed(1)+'/100):\n';
        response += getComponentRecommendation(second.key, student.name, second.value);
    }
    
    var subjectScores = getStudentBestWorstSubjects(student.nim);
    if (subjectScores && subjectScores.worst.score < 75) {
        response += '\n\n📚 **Mapel terlemah:** '+subjectScores.worst.subject+' ('+subjectScores.worst.score.toFixed(2)+')\n';
        response += 'Fokuskan perbaikan pada mapel ini dengan belajar lebih intensif.';
    }
    
    return response;
}

function generateStrongPointAnalysis(student, role) {
    if (!student) return 'Silakan pilih murid terlebih dahulu.';
    
    var breakdown = getStudentComponentBreakdown(student);
    var sorted = breakdown.slice().sort(function(a, b) { return b.value - a.value; });
    var subjectScores = getStudentBestWorstSubjects(student.nim);
    
    var response = '⭐ *ANALISIS KEKUATAN & BAKAT: '+student.name.toUpperCase()+'*\n\n';
    
    response += '🏆 *Peringkat Kekuatan (dari yang terkuat):*\n';
    for (var i = 0; i < sorted.length; i++) {
        var emj = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        response += emj+' '+sorted[i].key+': '+sorted[i].value.toFixed(1)+'/100\n';
    }
    
    if (subjectScores) {
        response += '\n🌟 *Mapel Terkuat:* '+subjectScores.best.subject+' ('+subjectScores.best.score.toFixed(2)+')\n';
        
        var topOverall = getTopPerformers(3);
        var isTopOverall = false;
        for (var toi = 0; toi < topOverall.length; toi++) {
            if (topOverall[toi].nim === student.nim) { isTopOverall = true; break; }
        }
        if (isTopOverall) {
            response += '\n👏 Selamat! '+student.name+' termasuk dalam **3 besar** performa terbaik keseluruhan!\n';
        }
        
        var exceptionalSubjects = [];
        for (var sai = 0; sai < subjectScores.all.length; sai++) {
            if (subjectScores.all[sai].score >= 85) {
                exceptionalSubjects.push(subjectScores.all[sai]);
            }
        }
        if (exceptionalSubjects.length > 0) {
            response += '\n🎯 *Bakat Terdeteksi:* '+student.name+' unggul di:\n';
            for (var ei = 0; ei < exceptionalSubjects.length; ei++) {
                response += '✅ '+exceptionalSubjects[ei].subject+' ('+exceptionalSubjects[ei].score.toFixed(2)+')\n';
            }
            response += '\n💡 Pertahankan dan kembangkan bakat ini!';
        }
    }
    
    return response;
}

function generateClassSummary(role) {
    var metrics = calculateSummaryMetrics();
    if (!metrics || metrics.length === 0) return 'Belum ada data.';
    
    var subjectSummary = getSubjectPerformanceSummary();
    var classCompAverages = getClassComponentAverages();
    var atRisk = getAtRiskStudents(75);
    var topPerformers = getTopPerformers(3);
    
    var response = '📊 *RINGKASAN PERFORM KELAS*\n\n';
    
    response += '👥 Total Murid Terdaftar: '+studentDataset.length+'\n\n';
    
    response += '📈 *Rata-rata Komponen Kelas:*\n';
    for (var comp in classCompAverages) {
        if (classCompAverages.hasOwnProperty(comp)) {
            var val = classCompAverages[comp];
            var emj = val >= 80 ? '🟢' : val >= 65 ? '🟡' : '🔴';
            response += emj+' '+comp+': '+val.toFixed(1)+'/100\n';
        }
    }
    
    response += '\n📚 *Rata-rata per Mata Pelajaran:*\n';
    var totalAvg = 0;
    for (var si = 0; si < subjectSummary.length; si++) {
        var s = subjectSummary[si];
        var emj2 = s.avg >= 80 ? '🟢' : s.avg >= 65 ? '🟡' : '🔴';
        response += emj2+' '+s.subject+': '+s.avg.toFixed(2)+' (Min: '+s.min.toFixed(2)+', Max: '+s.max.toFixed(2)+')\n';
        totalAvg += s.avg;
    }
    response += '\n📊 *Rata-rata Keseluruhan Kelas:* '+(totalAvg / subjectSummary.length).toFixed(2)+'\n\n';
    
    response += '🥇 *TOP 3 PERFORMER:*\n';
    for (var ti = 0; ti < topPerformers.length; ti++) {
        response += '   '+(ti+1)+'. '+topPerformers[ti].name+' - Rata-rata: '+topPerformers[ti].averageScore.toFixed(2)+'\n';
    }
    
    response += '\n🚨 *Early Warning System - Murid Berisiko:*\n';
    if (atRisk.length === 0) {
        response += '   ✅ Tidak ada murid yang berisiko. Semua murid memiliki nilai di atas 75.\n';
    } else {
        for (var ri = 0; ri < atRisk.length; ri++) {
            response += '   ⚠️ '+atRisk[ri].name+' (NIM: '+atRisk[ri].nim+') - Rata-rata: '+atRisk[ri].averageScore.toFixed(2)+'\n';
        }
    }
    
    if (role === 'admin') {
        response += '\n🛠️ *REKOMENDASI INTERVENSI:*\n';
        if (atRisk.length > 0) {
            response += '• Segera lakukan pendampingan pada '+atRisk.length+' murid berisiko.\n';
            var compEntries = [];
            for (var c in classCompAverages) {
                if (classCompAverages.hasOwnProperty(c)) {
                    compEntries.push([c, classCompAverages[c]]);
                }
            }
            compEntries.sort(function(a, b) { return a[1] - b[1]; });
            response += '• Fokus kelas saat ini: **'+compEntries[0][0]+'** (rata-rata '+compEntries[0][1].toFixed(1)+'/100)\n';
            response += '• Adakan remedial atau latihan tambahan untuk komponen tersebut.\n';
        } else {
            response += '• Pertahankan kualitas pembelajaran yang sudah baik.\n';
            response += '• Berikan pengayaan untuk murid-murid top performer.\n';
        }
    }
    
    return response;
}

function generateLeaderboardInfo(role) {
    var metrics = calculateSummaryMetrics();
    if (!metrics || metrics.length === 0) return 'Belum ada data.';
    
    var response = '🏆 *LEADERBOARD KESELURUHAN*\n\n';
    response += 'Peringkat berdasarkan rata-rata nilai semua mata pelajaran.\n\n';
    
    for (var mi = 0; mi < metrics.length; mi++) {
        var medal = mi === 0 ? '🥇' : mi === 1 ? '🥈' : mi === 2 ? '🥉' : '#'+(mi+1);
        var activeStudent = getActiveStudentData();
        var highlight = activeStudent && metrics[mi].nim === activeStudent.nim ? ' ← *KAMU*' : '';
        response += medal+' '+metrics[mi].name+' - '+metrics[mi].averageScore.toFixed(2)+highlight+'\n';
    }
    
    if (role === 'admin' || role === 'murid') {
        var classCompAverages = getClassComponentAverages();
        response += '\n📊 *Rata-rata Komponen Kelas:*\n';
        for (var c in classCompAverages) {
            if (classCompAverages.hasOwnProperty(c)) {
                response += '• '+c+': '+classCompAverages[c].toFixed(1)+'/100\n';
            }
        }
    }
    
    return response;
}

function generateRecommendation(role, student) {
    if (role === 'admin') {
        var atRisk = getAtRiskStudents(75);
        var subjectSummary = getSubjectPerformanceSummary();
        var sortedSubj = subjectSummary.slice().sort(function(a, b) { return a.avg - b.avg; });
        var worstSubject = sortedSubj[0];
        var classCompAverages = getClassComponentAverages();
        var compEntries = [];
        for (var c in classCompAverages) {
            if (classCompAverages.hasOwnProperty(c)) {
                compEntries.push([c, classCompAverages[c]]);
            }
        }
        compEntries.sort(function(a, b) { return a[1] - b[1]; });
        var worstComp = compEntries[0];
        
        var response = '🛠️ *REKOMENDASI INTERVENSI PINTAR*\n\n';
        response += '📋 *Analisis Situasi:*\n';
        response += '• Mapel terlemah: **'+worstSubject.subject+'** (rata-rata '+worstSubject.avg.toFixed(2)+')\n';
        response += '• Komponen terlemah: **'+worstComp[0]+'** (rata-rata '+worstComp[1].toFixed(1)+'/100)\n';
        response += '• Murid berisiko: '+atRisk.length+' orang\n\n';
        response += '📌 *Rencana Tindakan:*\n';
        response += '1️⃣ **Fokus pada '+worstComp[0]+'** - Komponen dengan nilai terendah\n';
        response += '   • Adakan latihan khusus untuk '+worstComp[0]+'\n';
        response += '   • Berikan contoh dan pendampingan ekstra\n\n';
        response += '2️⃣ **Intervensi untuk '+atRisk.length+' murid berisiko**\n';
        if (atRisk.length > 0) {
            for (var ri = 0; ri < Math.min(3, atRisk.length); ri++) {
                response += '   • '+atRisk[ri].name+': dampingi dengan program remedial\n';
            }
        }
        response += '\n3️⃣ **Perbaikan di mapel '+worstSubject.subject+'**\n';
        response += '   • Evaluasi metode pengajaran\n';
        response += '   • Berikan tugas tambahan penguatan\n\n';
        response += '📈 *Target:* Tingkatkan rata-rata kelas sebesar 5-10 poin dalam 1 bulan.';
        return response;
    }
    
    if (!student) return 'Silakan pilih murid terlebih dahulu.';
    
    var breakdown = getStudentComponentBreakdown(student);
    var sorted = breakdown.slice().sort(function(a, b) { return a.value - b.value; });
    var subjectScores = getStudentBestWorstSubjects(student.nim);
    
    var response = '💡 *SARAN PERSONAL UNTUK '+student.name.toUpperCase()+'*\n\n';
    response += '📊 *Kondisi Saat Ini:*\n';
    for (var bi = 0; bi < breakdown.length; bi++) {
        var b = breakdown[bi];
        var status = b.value >= 85 ? '✅ Baik' : b.value >= 65 ? '⚠️ Cukup' : '❌ Perlu Perbaikan';
        response += '• '+b.key+': '+b.value.toFixed(1)+'/100 ('+status+')\n';
    }
    
    response += '\n🎯 *Prioritas Perbaikan:*\n';
    for (var si = 0; si < sorted.length; si++) {
        var urgency = si === 0 ? '🔴 SEGERA' : si === 1 ? '🟠 PENTING' : '🟡 BAIK';
        response += urgency+': '+sorted[si].key+' ('+sorted[si].value.toFixed(1)+'/100)\n';
    }
    
    var weakest = sorted[0];
    response += '\n📚 *Rencana Belajar untuk '+weakest.key+':*\n';
    response += getComponentRecommendation(weakest.key, student.name, weakest.value);
    
    if (subjectScores && subjectScores.worst) {
        response += '\n\n📖 *Fokus Mapel:* '+subjectScores.worst.subject+'\n';
        response += 'Nilai saat ini: '+subjectScores.worst.score.toFixed(2)+'\n';
        response += 'Target: naikkan minimal 10 poin dengan belajar rutin.';
    }
    
    if (role === 'walimurid') {
        response += '\n\n👨‍👩‍👧‍👦 *Saran untuk Orang Tua:*\n';
        response += '• Dampingi '+student.name+' belajar 1-2 jam setiap hari\n';
        response += '• Cek tugas sekolah secara berkala\n';
        response += '• Diskusikan kesulitan yang dihadapi di sekolah\n';
        response += '• Berikan motivasi dan apresiasi atas usahanya';
    }
    
    return response;
}

function generateForecast(student, role) {
    if (!student) return 'Silakan pilih murid terlebih dahulu.';
    
    var breakdown = getStudentComponentBreakdown(student);
    var currentTotal = student.finalScore || 0;
    
    var sorted = breakdown.slice().sort(function(a, b) { return a.value - b.value; });
    var weakest = sorted[0];
    var improvement = Math.min(20, 100 - weakest.value);
    var potentialNewValue = weakest.value + improvement;
    var weightFactor = weakest.weight / (weakest.value || 1);
    var scoreIncrease = (potentialNewValue - weakest.value) * weightFactor;
    var potentialTotal = Math.min(100, currentTotal + scoreIncrease);
    
    var response = '📈 *AI PROGRESS FORECAST*\n\n';
    response += '🎯 Murid: '+student.name+'\n';
    response += '📊 Nilai Saat Ini: '+currentTotal.toFixed(2)+'\n\n';
    response += '🔮 *Skenario Prediksi:*\n';
    response += 'Jika **'+weakest.key+'** ditingkatkan sebesar '+improvement.toFixed(0)+' poin:\n';
    response += '• Nilai '+weakest.key+': '+weakest.value.toFixed(1)+' → '+potentialNewValue.toFixed(1)+'\n';
    response += '• Nilai Akhir: '+currentTotal.toFixed(2)+' → '+potentialTotal.toFixed(2)+' 📈\n';
    response += '• Peningkatan: +'+(potentialTotal - currentTotal).toFixed(2)+' poin\n\n';
    response += '💡 *Rekomendasi:* '+getComponentRecommendation(weakest.key, student.name, weakest.value)+'\n\n⏳ Target: Capai dalam 1-2 bulan ke depan dengan konsistensi.';
    
    return response;
}

function generateSubjectComparison() {
    var subjectSummary = getSubjectPerformanceSummary();
    var classCompAverages = getClassComponentAverages();
    
    var response = '📊 *PERBANDINGAN MATA PELAJARAN*\n\n';
    
    var sorted = subjectSummary.slice().sort(function(a, b) { return b.avg - a.avg; });
    
    response += '🏆 *Peringkat Mapel (Rata-rata Tertinggi):*\n';
    for (var si = 0; si < sorted.length; si++) {
        var emoji = si === 0 ? '🥇' : si === 1 ? '🥈' : si === 2 ? '🥉' : (si+1)+'.';
        response += emoji+' '+sorted[si].subject+': '+sorted[si].avg.toFixed(2)+'\n';
    }
    
    response += '\n📉 *Yang Perlu Diperhatikan:*\n';
    var worst = sorted[sorted.length - 1];
    response += '• Mapel terendah: **'+worst.subject+'** ('+worst.avg.toFixed(2)+')\n';
    var best = sorted[0];
    response += '• Mapel tertinggi: **'+best.subject+'** ('+best.avg.toFixed(2)+')\n';
    response += '• Selisih: '+(best.avg - worst.avg).toFixed(2)+' poin\n\n';
    
    response += '📋 *Analisis Per Komponen:*\n';
    for (var c in classCompAverages) {
        if (classCompAverages.hasOwnProperty(c)) {
            response += '• '+c+': '+classCompAverages[c].toFixed(1)+'/100\n';
        }
    }
    
    return response;
}

function generateAtRiskWarning(role) {
    var atRisk = getAtRiskStudents(75);
    var metrics = calculateSummaryMetrics();
    var classCompAverages = getClassComponentAverages();
    
    var response = '🚨 *EARLY WARNING SYSTEM*\n\n';
    response += '📊 *Status Kelas:*\n';
    response += '• Total murid: '+studentDataset.length+'\n';
    response += '• Murid berisiko: '+atRisk.length+' ('+(studentDataset.length > 0 ? (atRisk.length/studentDataset.length*100).toFixed(1) : 0)+'%)\n';
    response += '• Rata-rata kelas: '+(metrics.reduce(function(s, m) { return s + m.averageScore; }, 0) / metrics.length).toFixed(2)+'\n\n';
    
    if (atRisk.length > 0) {
        response += '⚠️ *Daftar Murid Berisiko:*\n';
        for (var ri = 0; ri < atRisk.length; ri++) {
            var r = atRisk[ri];
            var compObj = {
                'Kehadiran': r.student ? (r.student.attendance ? r.student.attendance.score : 0) : 0,
                'Proaktif': r.student ? (r.student.proactive ? r.student.proactive.score : 0) : 0,
                'Tugas': r.student ? (r.student.tasks ? r.student.tasks.score : 0) : 0,
                'Ujian': r.student ? (r.student.exams ? r.student.exams.avg : 0) : 0
            };
            var compEntries = [];
            for (var ck in compObj) {
                if (compObj.hasOwnProperty(ck)) {
                    compEntries.push([ck, compObj[ck]]);
                }
            }
            compEntries.sort(function(a, b) { return a[1] - b[1]; });
            var worstComp = compEntries[0];
            response += '🔴 '+r.name+' (NIM: '+r.nim+')\n';
            response += '   Rata-rata: '+r.averageScore.toFixed(2)+' | Komponen terlemah: '+worstComp[0]+' ('+worstComp[1].toFixed(1)+'/100)\n';
        }
        
        response += '\n🛠️ *Intervensi yang Direkomendasikan:*\n';
        response += '1️⃣ Program remedial khusus untuk murid berisiko\n';
        response += '2️⃣ Pendampingan one-on-one untuk komponen terlemah\n';
        response += '3️⃣ Monitoring mingguan perkembangan mereka\n';
        response += '4️⃣ Libatkan orang tua untuk dukungan di rumah';
    } else {
        response += '✅ *Tidak ada murid berisiko!*\n';
        response += 'Semua murid memiliki rata-rata nilai di atas 75.\n';
        response += 'Pertahankan kualitas pembelajaran yang sudah baik.\n';
        
        var compEntries2 = [];
        for (var ck2 in classCompAverages) {
            if (classCompAverages.hasOwnProperty(ck2)) {
                compEntries2.push([ck2, classCompAverages[ck2]]);
            }
        }
        compEntries2.sort(function(a, b) { return a[1] - b[1]; });
        response += '\n💡 *Saran:* Meskipun aman, perhatikan komponen **'+compEntries2[0][0]+'** (rata-rata '+compEntries2[0][1].toFixed(1)+'/100) untuk terus ditingkatkan.';
    }
    
    return response;
}

function generateStudyPlan(student, role) {
    if (!student) return 'Silakan pilih murid terlebih dahulu.';
    
    var breakdown = getStudentComponentBreakdown(student);
    var sorted = breakdown.slice().sort(function(a, b) { return a.value - b.value; });
    
    var response = '📚 *RENCANA BELAJAR PERSONAL*\n\n';
    response += '👤 Untuk: '+student.name+'\n\n';
    
    response += '📅 *Jadwal Belajar Harian:*\n';
    response += '• **30 menit**: Ulangi materi pelajaran hari ini\n';
    response += '• **20 menit**: Kerjakan tugas yang diberikan\n';
    response += '• **15 menit**: Latihan soal (bergantian per mapel)\n';
    response += '• **10 menit**: Baca materi untuk pertemuan berikutnya\n\n';
    
    response += '🎯 *Fokus Minggu Ini:*\n';
    for (var i = 0; i < Math.min(2, sorted.length); i++) {
        response += '🔴 **'+sorted[i].key+'** - Nilai '+sorted[i].value.toFixed(1)+'/100. Target: naik ke '+Math.min(100, sorted[i].value + 15).toFixed(0)+'/100\n';
        var recLine = getComponentRecommendation(sorted[i].key, student.name, sorted[i].value).split('\n')[0] || '';
        response += '   '+recLine+'\n';
    }
    
    var subjectScores = getStudentBestWorstSubjects(student.nim);
    if (subjectScores && subjectScores.worst) {
        response += '\n📖 *Prioritas Mapel:* '+subjectScores.worst.subject+'\n';
        response += 'Alokasi waktu belajar: 40% dari total waktu belajar harian.\n';
    }
    
    response += '\n✅ *Tips Sukses:*\n';
    response += '• Belajar di tempat yang tenang dan nyaman\n';
    response += '• Hindari gadget saat belajar (kecuali untuk materi)\n';
    response += '• Istirahat 5 menit setiap 30 menit belajar\n';
    response += '• Evaluasi pencapaian setiap akhir pekan';
    
    return response;
}

// ---------- MAIN ANSWER BUILDER ----------
function buildAIAnswer(questionRaw) {
    var question = String(questionRaw || '').trim();
    if (!question) return 'Silakan ketik pertanyaan.';
    
    var analysis = analyzeQuery(question);
    var role = getUserRoleFromUI();
    var activeStudent = getActiveStudentData();
    var activeStudentAllSubjects = getActiveStudentDataAllSubjects();
    
    // Override active student if a name or NIM was detected
    var targetStudent = activeStudent;
    if (analysis.detectedName) {
        targetStudent = analysis.detectedName;
    } else if (analysis.detectedNim) {
        var found = studentDataset.find(function(s) { return s.nim === analysis.detectedNim; });
        if (found) targetStudent = found;
    }
    
    // --- Greeting ---
    if (analysis.intents.greeting && !analysis.intents.weakPoint && !analysis.intents.strongPoint && !analysis.intents.recommendation) {
        return generateGreeting(role, targetStudent);
    }
    
    // --- Thanks ---
    if (analysis.intents.thanks) {
        return 'Sama-sama! 😊 Senang bisa membantu.\n\nAda lagi yang ingin ditanyakan?';
    }
    
    // --- Goodbye ---
    if (analysis.intents.goodbye) {
        return 'Sampai jumpa! Semoga harimu menyenangkan dan tetap semangat belajar! 👋😊';
    }
    
    // --- Help ---
    if (analysis.intents.help) {
        return generateHelp(role);
    }
    
    // --- Who Am I ---
    if (analysis.intents.whoAmI) {
        if (!targetStudent) return 'Silakan pilih murid terlebih dahulu di menu utama.';
        return generateAboutStudent(targetStudent, role, activeStudentAllSubjects);
    }
    
    // --- Student count ---
    if (analysis.intents.studentCount) {
        return '👥 Total murid terdaftar: **'+studentDataset.length+'** orang.\n\nMata pelajaran tersedia: '+subjectList.length+' mapel.';
    }
    
    // --- Weak point analysis ---
    if (analysis.intents.weakPoint) {
        return generateWeakPointAnalysis(targetStudent, role);
    }
    
    // --- Strong point / talent detection ---
    if (analysis.intents.strongPoint || analysis.intents.bestStudent) {
        if (analysis.intents.bestStudent && role === 'admin') {
            var top = getTopPerformers(5);
            var resp = '⭐ *TOP PERFORMER DETECTION*\n\n';
            for (var ti = 0; ti < top.length; ti++) {
                resp += '🥇 '+(ti+1)+'. '+top[ti].name+' - Rata-rata: '+top[ti].averageScore.toFixed(2)+'\n';
            }
            return resp;
        }
        return generateStrongPointAnalysis(targetStudent, role);
    }
    
    // --- At-risk / warning ---
    if (analysis.intents.atRisk || analysis.intents.worstStudent) {
        return generateAtRiskWarning(role);
    }
    
    // --- Forecast ---
    if (analysis.intents.forecast) {
        return generateForecast(targetStudent, role);
    }
    
    // --- Study plan ---
    if (analysis.intents.studyPlan) {
        return generateStudyPlan(targetStudent, role);
    }
    
    // --- Subject comparison ---
    if (analysis.intents.compare || analysis.intents.perSubject) {
        return generateSubjectComparison();
    }
    
    // --- Dashboard explanation ---
    if (analysis.intents.explainDashboard) {
        if (role === 'admin') {
            return '📊 *PANDUAN MEMBACA DASHBOARD*\n\n' +
                'Panel-panel yang tersedia:\n' +
                '1️⃣ **Profil Murid** - Pilih murid dan mapel untuk melihat data spesifik\n' +
                '2️⃣ **Nilai Ujian** - Grafik batang UTS 1, UAS 1, UTS 2, UAS 2, dan rata-rata\n' +
                '3️⃣ **Nilai Proaktif** - Diagram lingkaran komponen Bertanya/Menjawab/Menambahkan\n' +
                '4️⃣ **Nilai Tugas** - Donat chart perbandingan tugas selesai/belum\n' +
                '5️⃣ **Nilai Kehadiran** - Grafik batang perbandingan kehadiran tiap murid\n' +
                '6️⃣ **Leaderboard** - Peringkat berdasarkan rata-rata keseluruhan\n\n' +
                '💡 Gunakan tab **Ringkasan Nilai** untuk tabel detail per mapel.';
        }
        if (!targetStudent) return 'Silakan pilih murid terlebih dahulu.';
        return '📊 *PANDUAN DASHBOARD '+targetStudent.name.toUpperCase()+'*\n\n' +
            'Panel yang menampilkan data kamu:\n' +
            '• **Nilai Ujian**: '+targetStudent.exams.uts1+' | '+targetStudent.exams.uas1+' | '+targetStudent.exams.uts2+' | '+targetStudent.exams.uas2+' (Rata-rata: '+targetStudent.exams.avg.toFixed(1)+')\n' +
            '• **Proaktif**: Bertanya '+targetStudent.proactive.ask+'x, Menjawab '+targetStudent.proactive.answer+'x, Menambahkan '+targetStudent.proactive.add+'x\n' +
            '• **Tugas**: '+targetStudent.tasks.done+' selesai dari '+targetStudent.tasks.total+' tugas\n' +
            '• **Kehadiran**: Hadir '+targetStudent.attendance.present+'/'+targetStudent.attendance.meetings+' pertemuan\n' +
            '• **Nilai Akhir**: '+targetStudent.finalScore.toFixed(2)+'\n\n' +
            '💡 Ketik "analisis" untuk penjelasan lebih detail.';
    }
    
    // --- Leaderboard ---
    if (analysis.intents.leaderboard || analysis.intents.ranking) {
        return generateLeaderboardInfo(role);
    }
    
    // --- Summary / Ringkasan ---
    if (analysis.intents.summary || analysis.intents.allStudents) {
        return generateClassSummary(role);
    }
    
    // --- Specific component questions ---
    if (analysis.intents.attendance) {
        if (!targetStudent) return 'Silakan pilih murid terlebih dahulu.';
        var att = targetStudent.attendance;
        var resp = '📋 *DATA KEHADIRAN '+targetStudent.name.toUpperCase()+'*\n\n';
        resp += '✅ Hadir: '+att.present+' kali\n';
        resp += '🤒 Sakit: '+(att.sick || 0)+' kali\n';
        resp += '📝 Izin: '+(att.permit || 0)+' kali\n';
        resp += '❌ Mangkir: '+(att.absent || 0)+' kali\n';
        resp += '📊 Total Pertemuan: '+att.meetings+'\n';
        resp += '📈 Skor Kehadiran: '+att.score.toFixed(1)+'/100\n';
        resp += '⚖️ Bobot ke nilai akhir: '+att.weight.toFixed(2)+'\n\n';
        resp += getComponentRecommendation('Kehadiran', targetStudent.name, att.score);
        return resp;
    }
    
    if (analysis.intents.proactive) {
        if (!targetStudent) return 'Silakan pilih murid terlebih dahulu.';
        var pro = targetStudent.proactive;
        var resp = '📋 *DATA PROAKTIF '+targetStudent.name.toUpperCase()+'*\n\n';
        resp += '❓ Bertanya: '+pro.ask+' kali\n';
        resp += '💬 Menjawab: '+pro.answer+' kali\n';
        resp += '➕ Menambahkan: '+pro.add+' kali\n';
        resp += '📊 Total Poin Proaktif: '+pro.total+'\n';
        resp += '📈 Skor Proaktif: '+pro.score.toFixed(1)+'/100\n';
        resp += '⚖️ Bobot ke nilai akhir: '+pro.weight.toFixed(2)+'\n\n';
        resp += getComponentRecommendation('Proaktif', targetStudent.name, pro.score);
        return resp;
    }
    
    if (analysis.intents.tasks) {
        if (!targetStudent) return 'Silakan pilih murid terlebih dahulu.';
        var t = targetStudent.tasks;
        var resp = '📋 *DATA TUGAS '+targetStudent.name.toUpperCase()+'*\n\n';
        resp += '✅ Selesai: '+t.done+' tugas\n';
        resp += '❌ Belum: '+Math.max(0, t.total - t.done)+' tugas\n';
        resp += '📊 Total Tugas: '+t.total+'\n';
        resp += '📈 Skor Tugas: '+t.score.toFixed(1)+'/100\n';
        resp += '⚖️ Bobot ke nilai akhir: '+t.weight.toFixed(2)+'\n\n';
        resp += getComponentRecommendation('Tugas', targetStudent.name, t.score);
        return resp;
    }
    
    if (analysis.intents.exams || analysis.intents.finalScore) {
        if (!targetStudent) return 'Silakan pilih murid terlebih dahulu.';
        var e = targetStudent.exams;
        var resp = '📋 *DATA UJIAN '+targetStudent.name.toUpperCase()+'*\n\n';
        resp += '📝 UTS 1: '+e.uts1+'\n';
        resp += '📝 UAS 1: '+e.uas1+'\n';
        resp += '📝 UTS 2: '+e.uts2+'\n';
        resp += '📝 UAS 2: '+e.uas2+'\n';
        resp += '📊 Rata-rata: '+e.avg.toFixed(1)+'/100\n';
        resp += '⚖️ Bobot ke nilai akhir: '+e.weight.toFixed(2)+'\n\n';
        resp += getComponentRecommendation('Ujian', targetStudent.name, e.avg);
        if (analysis.intents.finalScore) {
            resp += '\n🏆 **NILAI AKHIR:** '+targetStudent.finalScore.toFixed(2);
        }
        return resp;
    }
    
    // --- About student (general) ---
    if (analysis.intents.aboutStudent) {
        return generateAboutStudent(targetStudent, role, activeStudentAllSubjects);
    }
    
    // --- Recommendation ---
    if (analysis.intents.recommendation) {
        return generateRecommendation(role, targetStudent);
    }
    
    // --- Improvement / progress ---
    if (analysis.intents.improvement) {
        return generateForecast(targetStudent, role);
    }
    
    // --- Parent advice ---
    if (analysis.intents.parentAdvice && role === 'walimurid') {
        if (!targetStudent) return 'Silakan pilih murid terlebih dahulu.';
        var resp = '👨‍👩‍👧‍👦 *PARENTING COACH - SARAN UNTUK '+targetStudent.name.toUpperCase()+'*\n\n';
        resp += '📊 Kondisi '+targetStudent.name+' saat ini:\n';
        resp += '• Nilai Akhir: '+targetStudent.finalScore.toFixed(2)+'\n';
        var breakdown = getStudentComponentBreakdown(targetStudent);
        for (var bi = 0; bi < breakdown.length; bi++) {
            resp += '• '+breakdown[bi].key+': '+breakdown[bi].value.toFixed(1)+'/100\n';
        }
        resp += '\n💡 *Tips untuk Orang Tua:*\n';
        resp += '1️⃣ Ciptakan rutinitas belajar di rumah (1-2 jam/hari)\n';
        resp += '2️⃣ Tanyakan kegiatan belajar di sekolah setiap hari\n';
        resp += '3️⃣ Berikan pujian atas usaha, bukan hanya hasil\n';
        resp += '4️⃣ Sediakan tempat belajar yang nyaman\n';
        resp += '5️⃣ Komunikasikan dengan guru jika ada kendala\n';
        resp += '6️⃣ Batasi waktu bermain gadget\n\n';
        resp += '🌟 Ingat: Dukungan Anda sangat berarti untuk kesuksesan '+targetStudent.name+'!';
        return resp;
    }
    
    // --- Subject specific ---
    if (analysis.intents.subjectSpecific && analysis.detectedSubject) {
        var subject = analysis.detectedSubject;
        ensureSubjectDataset(subject);
        var ds = subjectData[subject];
        if (!ds) return 'Data untuk mapel '+subject+' belum tersedia.';
        
        var scores = ds.map(function(s) { return s.finalScore; });
        var avg = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
        var max = Math.max.apply(null, scores);
        var min = Math.min.apply(null, scores);
        
        var resp = '📚 *ANALISIS MAPEL: '+subject+'*\n\n';
        resp += '📊 Rata-rata kelas: '+avg.toFixed(2)+'\n';
        resp += '🏆 Nilai tertinggi: '+max.toFixed(2)+'\n';
        resp += '📉 Nilai terendah: '+min.toFixed(2)+'\n';
        resp += '👥 Jumlah murid: '+ds.length+'\n\n';
        
        var sorted = ds.slice().sort(function(a, b) { return b.finalScore - a.finalScore; });
        resp += '🥇 *Top 3:*\n';
        for (var ti = 0; ti < Math.min(3, sorted.length); ti++) {
            resp += (ti+1)+'. '+sorted[ti].name+' - '+sorted[ti].finalScore.toFixed(2)+'\n';
        }
        
        if (targetStudent) {
            var st = null;
            for (var fsi = 0; fsi < ds.length; fsi++) {
                if (ds[fsi].nim === targetStudent.nim) { st = ds[fsi]; break; }
            }
            if (st) {
                var rank = -1;
                for (var rsi = 0; rsi < sorted.length; rsi++) {
                    if (sorted[rsi].nim === st.nim) { rank = rsi + 1; break; }
                }
                resp += '\n📍 Posisi '+targetStudent.name+': #'+rank+' dari '+ds.length+' ('+st.finalScore.toFixed(2)+')\n';
            }
        }
        
        return resp;
    }
    
    // --- Student name query ---
    if (analysis.detectedName) {
        return generateAboutStudent(analysis.detectedName, role, activeStudentAllSubjects);
    }
    
    // --- Fallback: Try to understand anything else ---
    if (role === 'admin') {
        if (question.toLowerCase().indexOf('total') !== -1 || question.toLowerCase().indexOf('semua') !== -1) {
            return generateClassSummary(role);
        }
        var metrics = calculateSummaryMetrics();
        var sortedAsc = metrics.slice().sort(function(a, b) { return a.averageScore - b.averageScore; });
        var worst = sortedAsc[0];
        return 'Saya mengerti pertanyaan Anda. Berikut yang saya bisa bantu:\n\n' +
            '📊 Performa terendah saat ini: **'+(worst ? worst.name : '-')+'** (rata-rata '+(worst ? worst.averageScore.toFixed(2) : '-')+')\n' +
            '💡 Coba tanya dengan lebih spesifik:\n' +
            '• "Ringkasan performa kelas"\n' +
            '• "Siapa yang perlu perbaikan?"\n' +
            '• "Analisis [nama murid]"\n' +
            '• "Bandingkan semua mapel"\n' +
            '• "Rekomendasi intervensi"\n' +
            '• Ketik "help" untuk bantuan lengkap';
    }
    
    if (!targetStudent) return 'Silakan pilih murid terlebih dahulu di menu utama.';
    
    return 'Hai '+targetStudent.name+'! 👋\n\n' +
        'Maaf, saya belum begitu paham maksud pertanyaanmu. Coba tanya dengan cara berikut:\n\n' +
        '• "Nilai apa yang harus aku perbaiki?"\n' +
        '• "Apa kelebihanku?"\n' +
        '• "Bagaimana nilai ujianku?"\n' +
        '• "Kasih saran belajar"\n' +
        '• "Buatkan rencana belajar"\n' +
        '• "Ringkas dashboard"\n' +
        '• Atau ketik "help" untuk bantuan';
}

// ---------- UI: Chat message renderer ----------
function pushChatMessage(role, text) {
    var history = document.getElementById('chatAIHistory');
    if(!history) return;
    var item = document.createElement('div');
    var isUser = role === 'user';
    item.className = isUser ? 'text-right' : 'text-left';
    var bubble = document.createElement('div');
    bubble.className = isUser ? 'inline-block bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 rounded-xl px-3 py-2 text-xs font-mono max-w-[85%] whitespace-pre-line' : 'inline-block bg-slate-900/60 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-xs font-mono max-w-[85%] whitespace-pre-line';
    bubble.innerText = text;
    item.appendChild(bubble);
    history.appendChild(item);
    history.scrollTop = history.scrollHeight;
}

// ---------- CHAT AI INITIALIZATION ----------
export function resetChatAI() {
    chatAIInited = false;
}

export function ensureChatAIInit() {
    if(chatAIInited) return;
    var form = document.getElementById('chatAIForm');
    var input = document.getElementById('chatAIInput');
    var badge = document.getElementById('chatAIBadge');
    var history = document.getElementById('chatAIHistory');
    if(!form || !input || !badge || !history) return;

    chatAIInited = true;
    var role = getUserRoleFromUI();
    history.innerHTML = '';
    var s = getActiveStudentData();

    // Welcome message based on role
    var welcomeMsg = generateGreeting(role, s);
    
    if(role === 'admin') badge.innerText = '🧠 AI Insight Engine v2.0 - Mode: Admin';
    else if (role === 'walimurid') badge.innerText = '👨‍👩‍👧‍👦 AI Parenting Coach v2.0 - Mode: Walimurid';
    else badge.innerText = '🎓 AI Learning Coach v2.0 - Mode: Murid';
    
    pushChatMessage('assistant', welcomeMsg);

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var q = input.value;
        if(!q || !q.trim()) return;
        pushChatMessage('user', q);
        var ans = buildAIAnswer(q);
        pushChatMessage('assistant', ans);
        input.value = '';
    });
}
