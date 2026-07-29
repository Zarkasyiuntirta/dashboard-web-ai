import { loadDataFromFirestore, initDashboardEngine, studentDataset, loginContext, resetChatAI, firestoreConnected, updateFirestoreStatusIndicator } from './dashboard.js';

// ================= ENGINE: 4D PARTICLES BACKGROUND =================
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: null, y: null };

function resizeCanvas() {
    if(canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1 - 0.5;
    }
    update() {
        if (mouse.x !== null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 180) {
                this.x += dx * 0.02;
                this.y += dy * 0.02;
            }
        }
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }
    draw() {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

if(canvas) {
    for (let i = 0; i < 175; i++) particles.push(new Particle());
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

const loginCardWrapper = document.getElementById('loginCardWrapper');
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    let xAxis = (window.innerWidth / 2 - e.clientX) / 25;
    let yAxis = (window.innerHeight / 2 - e.clientY) / 25;
    if(loginCardWrapper) loginCardWrapper.style.transform = `rotateY(${-xAxis}deg) rotateX(${yAxis}deg)`;
});

// ================= VALIDASI LOGIN MATRIX =================
const authForm = document.getElementById('authForm');
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const flipInner = document.getElementById('flipCardInner');
    const errLabel = document.getElementById('loginError');

    const cleanUser = String(user || '').trim();
    const cleanPass = String(pass || '').trim();

    // ADMIN: tetap hardcoded
    const isAdmin = cleanUser === 'admin' && cleanPass === '13579';

    // MURID: username = NIM, password = NIM yang sama (dari data murid)
    const nimAsNumber = parseInt(cleanUser, 10);
    const isNim = !isNaN(nimAsNumber) && String(nimAsNumber) === cleanUser;
    const isStudent = isNim && cleanPass === cleanUser;

    // WALIMURID: username = "Walimurid" (case-insensitive), password = NIM murid (diambil dari kolom NIM di menu perbarui murid)
    const cleanUserLower = cleanUser.toLowerCase();
    const isWalimurid = cleanUserLower === 'walimurid';

    // Cek apakah valid sebagai murid atau walimurid atau admin
    let isValid = isAdmin || isStudent;

    // Cek walimurid: cari murid berdasarkan NIM di password
    let walimuridStudent = null;
    if (isWalimurid) {
        const nimPass = parseInt(cleanPass, 10);
        if (!isNaN(nimPass)) {
            // Data harus dimuat dulu
            await loadDataFromFirestore();
            walimuridStudent = studentDataset.find(s => s.nim === nimPass);
            if (walimuridStudent) {
                isValid = true;
            }
        }
    }

    if(isValid) {
        errLabel.classList.add('hidden');
        flipInner.classList.add('flipped');

        // Reset login context
        loginContext.role = 'admin';
        loginContext.nim = null;
        loginContext.nik = null;
        loginContext.studentName = null;

        // Ambil Data dari Firestore Cloud (jika belum dimuat)
        if (!isWalimurid) {
            await loadDataFromFirestore();
        }
        
        // Update status Firestore indicator setelah load data
        updateFirestoreStatusIndicator();

        setTimeout(() => {
            document.getElementById('loginInterface').classList.add('hidden');
            document.getElementById('mainInterface').classList.remove('hidden');

            // Tentukan role dan set filterStudent dropdown SEBELUM initDashboardEngine
            // agar sapaan AI dan profil langsung sesuai dengan yang login
            const filterStudent = document.getElementById('filterStudent');

            if(isAdmin) {
                loginContext.role = 'admin';
                document.getElementById('roleBadge').innerText = "ADMIN ADMINISTRATOR";
                document.getElementById('btnNavData').classList.remove('hidden');
                document.getElementById('btnNavStudents').classList.remove('hidden');
                document.getElementById('btnNavSummary').classList.remove('hidden');
                document.getElementById('btnNavChatAI').classList.remove('hidden');
            } else if (isWalimurid && walimuridStudent) {
                loginContext.role = 'walimurid';
                loginContext.nik = walimuridStudent.nik;
                loginContext.nim = walimuridStudent.nim;
                loginContext.studentName = walimuridStudent.name;
                document.getElementById('roleBadge').innerText = `WALIMURID DARI: ${walimuridStudent.name} (NIM: ${walimuridStudent.nim})`;
                // Set dropdown dulu biar pas initDashboardEngine, AI langsung kenal
                if(filterStudent) {
                    filterStudent.value = walimuridStudent.nim;
                }
                // Sembunyikan menu data/modifikasi untuk walimurid
                document.getElementById('btnNavData').classList.add('hidden');
                document.getElementById('btnNavStudents').classList.add('hidden');
                document.getElementById('btnNavSummary').classList.remove('hidden');
                document.getElementById('btnNavChatAI').classList.remove('hidden');
            } else {
                // student
                loginContext.role = 'murid';
                loginContext.nim = nimAsNumber;
                const student = studentDataset.find(s => s.nim === nimAsNumber);
                loginContext.studentName = student ? student.name : null;
                loginContext.nik = student ? student.nik : null;
                document.getElementById('roleBadge').innerText = `MURID: ${student ? student.name : ''} (NIM: ${cleanUser})`;
                // Set dropdown dulu biar pas initDashboardEngine, AI langsung kenal
                if(filterStudent) {
                    filterStudent.value = nimAsNumber;
                }
                document.getElementById('btnNavSummary').classList.remove('hidden');
                document.getElementById('btnNavChatAI').classList.remove('hidden');
                // FORCE HIDE: Sembunyikan paksa menu modifikasi jika login sebagai murid
                document.getElementById('btnNavData').classList.add('hidden');
                document.getElementById('btnNavStudents').classList.add('hidden');
            }

            // Panggil initDashboardEngine SETELAH dropdown di-set,
            // sehingga AI greeting langsung memakai data murid yang benar
            initDashboardEngine();

            // Panggil ulang agar profil & chart sync dengan data yang sudah di-dropdown
            if(isStudent || (isWalimurid && walimuridStudent)) {
                try {
                    filterStudent?.dispatchEvent(new Event('change'));
                } catch(_e) {}
            }
        }, 1500);
    } else {
        errLabel.classList.remove('hidden');
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    document.getElementById('mainInterface').classList.add('hidden');
    document.getElementById('loginInterface').classList.remove('hidden');
    document.getElementById('flipCardInner').classList.remove('flipped');
    document.getElementById('authForm').reset();
    
    // Reset chat AI agar bersih saat login ulang
    const chatHistory = document.getElementById('chatAIHistory');
    if (chatHistory) {
        chatHistory.innerHTML = '';
    }
    // Reset flag inisialisasi chat agar bisa di-init ulang dengan sapaan baru
    if (typeof resetChatAI === 'function') {
        resetChatAI();
    }
    
    // Reset Firestore status indicator
    if (typeof updateFirestoreStatusIndicator === 'function') {
        updateFirestoreStatusIndicator();
    }
});
