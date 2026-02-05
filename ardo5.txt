// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHdHnK0Lz8TITlrkWYgSdV8AmFZU3F7_0",
  authDomain: "sivarvocationalhighschoo-513aa.firebaseapp.com",
  projectId: "sivarvocationalhighschoo-513aa",
  storageBucket: "sivarvocationalhighschoo-513aa.firebasestorage.app",
  messagingSenderId: "498314470915",
  appId: "1:498314470915:web:1d75488d20372f81e71036",
};

// Init Firebase (Compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// DOM Elements
const authModal = document.getElementById("authModal");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const userProfile = document.getElementById("userProfile");
const loginButton = document.getElementById("loginButton");
const commentsList = document.getElementById("commentsList");

// Helpers
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

// Notification
function showNotification(message, type = "success") {
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideInRight 0.3s ease reverse";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Password toggle
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const icon = input.parentElement.querySelector(".password-toggle i");

  if (input.type === "password") {
    input.type = "text";
    icon.className = "fas fa-eye-slash";
  } else {
    input.type = "password";
    icon.className = "fas fa-eye";
  }
}

// Tabs
function switchAuthTab(tab, el) {
  qsa(".auth-tab").forEach((t) => t.classList.remove("active"));
  if (el) el.classList.add("active");
  else {
    // fallback: activate by text
    const target = Array.from(qsa(".auth-tab")).find((x) => x.textContent.includes(tab === "login" ? "چوونەژورەوە" : "تۆمار"));
    if (target) target.classList.add("active");
  }

  if (tab === "login") {
    loginForm.classList.add("active");
    registerForm.classList.remove("active");
  } else {
    loginForm.classList.remove("active");
    registerForm.classList.add("active");
  }
}

// Modal
function openAuthModal() {
  authModal.style.display = "flex";
  authModal.setAttribute("aria-hidden", "false");
  // default to login tab
  const firstTab = qsa(".auth-tab")[0];
  switchAuthTab("login", firstTab);
}

function closeAuthModal() {
  authModal.style.display = "none";
  authModal.setAttribute("aria-hidden", "true");
  document.getElementById("loginFormElement")?.reset();
  document.getElementById("registerFormElement")?.reset();
}

// Register
async function register(event) {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("registerConfirmPassword").value;

  if (password !== confirmPassword) {
    showNotification("وشەی نهێنیەکان جیاوازن!", "error");
    return;
  }
  if (password.length < 6) {
    showNotification("وشەی نهێنی دەبێت لانی کەم ٦ نووسە بێت!", "error");
    return;
  }

  const registerBtn = document.getElementById("registerBtn");
  const originalText = registerBtn.innerHTML;
  registerBtn.innerHTML = '<div class="loading"></div>';

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);

    await userCredential.user.updateProfile({ displayName: name });

    await db.collection("users").doc(userCredential.user.uid).set({
      name,
      email,
      role: "student",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showNotification("بە سەرکەوتوویی تۆمارت کرد!", "success");
    closeAuthModal();
  } catch (error) {
    console.error("Registration error:", error);
    let errorMessage = "هەڵەیەک ڕوویدا!";

    if (error.code === "auth/email-already-in-use") {
      errorMessage = "ئەم ئیمەیڵە پێشتر تۆمار کراوە!";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "ئیمەیڵەکە نادروستە!";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "وشەی نهێنیەکە زۆر لاوازە!";
    }
    showNotification(errorMessage, "error");
  } finally {
    registerBtn.innerHTML = originalText;
  }
}

// Login
async function login(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const loginBtn = document.getElementById("loginBtn");
  const originalText = loginBtn.innerHTML;
  loginBtn.innerHTML = '<div class="loading"></div>';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showNotification("بە سەرکەوتوویی چوویتە ژوورەوە!", "success");
    closeAuthModal();
  } catch (error) {
    console.error("Login error:", error);
    let errorMessage = "هەڵەیەک ڕوویدا!";

    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-login-credentials") {
      errorMessage = "ئیمەیڵ یان وشەی نهێنی هەڵەیە!";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "ئیمەیڵەکە نادروستە!";
    } else if (error.code === "auth/user-disabled") {
      errorMessage = "ئەکاونتەکەت داخراوە!";
    }
    showNotification(errorMessage, "error");
  } finally {
    loginBtn.innerHTML = originalText;
  }
}

// Google login
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    showNotification("بە سەرکەوتوویی چوویتە ژوورەوە!", "success");
    closeAuthModal();
  } catch (error) {
    console.error("Google login error:", error);
    showNotification("هەڵە لە چوونەژورەوە بە گووگڵ!", "error");
  }
}

// Facebook login (placeholder)
function loginWithFacebook() {
  showNotification("لە وەشانی داھاتوودا بەردەست دەبێت!", "warning");
}

// Logout
async function logout() {
  try {
    await auth.signOut();
    showNotification("بە سەرکەوتوویی چووتە دەرەوە!", "success");
    const userMenu = document.querySelector(".user-menu");
    if (userMenu) userMenu.remove();
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("هەڵە لە چوونەدەرەوە!", "error");
  }
}

// User menu
function toggleUserMenu() {
  const existingMenu = document.querySelector(".user-menu");
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const menu = document.createElement("div");
  menu.className = "user-menu";
  menu.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #f0f0f0;">
      <div style="font-weight: 600; color: var(--primary-color);">ئەکاونت</div>
    </div>
    <div style="padding: 0;">
      <div class="user-menu-item" onclick="window.location.href='#profile'">
        <i class="fas fa-user"></i>
        <span>پڕۆفایل</span>
      </div>
      <div class="user-menu-item" onclick="window.location.href='#settings'">
        <i class="fas fa-cog"></i>
        <span>ڕێکخستنەکان</span>
      </div>
      <div class="user-menu-item" onclick="logout()" style="color: var(--danger-color);">
        <i class="fas fa-sign-out-alt"></i>
        <span>چوونە دەرەوە</span>
      </div>
    </div>
  `;

  userProfile.appendChild(menu);

  setTimeout(() => {
    document.addEventListener("click", function closeMenu(e) {
      if (!userProfile.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    });
  }, 10);
}

// Auth UI
function updateUI() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      loginButton.style.display = "none";
      userProfile.style.display = "flex";

      try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        const userData = userDoc.data();

        document.getElementById("userDisplayName").textContent =
          user.displayName || userData?.name || "بەکارهێنەر";
        document.getElementById("userRole").textContent = userData?.role || "خوێندکار";

        const userAvatar = document.getElementById("userAvatar");
        if (user.photoURL) {
          userAvatar.src = user.photoURL;
        } else {
          const displayName = user.displayName || userData?.name || "User";
          userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3498db&color=fff&size=150`;
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    } else {
      loginButton.style.display = "flex";
      userProfile.style.display = "none";
    }

    loadComments();
  });
}

// Comments
async function addComment(event) {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    showNotification("تکایە یەکەم چوونەژورەوە بکە!", "error");
    openAuthModal();
    return;
  }

  const commentText = document.getElementById("commentText").value.trim();
  if (!commentText) {
    showNotification("تکایە کۆمێنتێک بنووسە!", "error");
    return;
  }
  if (commentText.length < 3) {
    showNotification("کۆمێنتەکە دەبێت لانی کەم ٣ نووسە بێت!", "error");
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<div class="loading"></div>';

  try {
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.data();

    await db.collection("comments").add({
      userId: user.uid,
      userName: user.displayName || userData?.name || "بەکارهێنەرێکی نەناسراو",
      userRole: userData?.role || "خوێندکار",
      text: commentText,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      likes: 0,
    });

    document.getElementById("commentText").value = "";
    showNotification("کۆمێنتەکەت بە سەرکەوتوویی نێردرا!", "success");
    loadComments();
  } catch (error) {
    console.error("Error adding comment:", error);
    showNotification("هەڵەیەک ڕوویدا لە ناردنی کۆمێنتەکە!", "error");
  } finally {
    submitBtn.innerHTML = originalText;
  }
}

async function loadComments() {
  try {
    const snapshot = await db.collection("comments").orderBy("timestamp", "desc").limit(20).get();

    commentsList.innerHTML = "";

    if (snapshot.empty) {
      commentsList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--gray-color);">
          <i class="fas fa-comment-slash" style="font-size: 48px; margin-bottom: 20px;"></i>
          <p>هێشتا کۆمێنتێک نەنێردراوە!</p>
          <p style="font-size: 14px; margin-top: 10px;">یەکەم کەس بە کۆمێنتەکەت!</p>
        </div>
      `;
      return;
    }

    snapshot.forEach((doc) => {
      const comment = doc.data();
      const time = comment.timestamp?.toDate?.() || new Date();

      const commentDiv = document.createElement("div");
      commentDiv.className = "comment";
      commentDiv.innerHTML = `
        <div class="comment-header">
          <div class="comment-user">
            <img
              src="https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName)}&background=3498db&color=fff&size=150"
              alt="${comment.userName}"
              class="comment-avatar"
            />
            <div class="comment-user-info">
              <h4>${comment.userName}</h4>
              <div style="display:flex; gap:10px; align-items:center;">
                <span style="background:${comment.userRole === "teacher" ? "var(--secondary-color)" : "var(--gray-color)"}; color:#fff; padding:2px 8px; border-radius:10px; font-size:12px;">
                  ${comment.userRole === "teacher" ? "مامۆستا" : "خوێندکار"}
                </span>
                <span class="comment-time">${formatTime(time)}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="comment-body" style="font-size: 16px; line-height: 1.6; color: var(--text-color);">
          ${String(comment.text || "").replace(/\n/g, "<br>")}
        </div>
      `;

      commentsList.appendChild(commentDiv);
    });
  } catch (error) {
    console.error("Error loading comments:", error);
    commentsList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--danger-color);">
        <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 20px;"></i>
        <p>هەڵە لە بارکردنی کۆمێنتەکان!</p>
        <p style="font-size: 14px; margin-top: 10px;">تکایە دووبارە هەوڵ بدەرەوە</p>
      </div>
    `;
  }
}

// Time format
function formatTime(date) {
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "ئێستا";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} خولەک لەمەوپێش`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} کاتژمێر لەمەوپێش`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} ڕۆژ لەمەوپێش`;

  return date.toLocaleDateString("ar-KW");
}

// Department placeholder
function openDepartmentPage(department) {
  const departments = {
    programming: "پڕۆگرامسازی",
    veterinary: "ڤێتەرنەری",
    architecture: "بیناسازی",
  };
  showNotification(`پەڕەی ${departments[department]} بەردەست نییە لە وەشانی ئەم وێبسایتە!`, "warning");
}

// Upload placeholder
function uploadMedia() {
  const user = auth.currentUser;
  if (!user) {
    showNotification("تکایە یەکەم چوونەژورەوە بکە بۆ بارکردنی میدیا!", "error");
    openAuthModal();
    return;
  }
  showNotification("بەشی بارکردنی میدیا لە وەشانی داھاتوودا بەردەست دەبێت!", "warning");
}

// Stats animation
function initializeStats() {
  const stats = [
    { id: "studentsCount", target: 1200, plus: true },
    { id: "teachersCount", target: 80, plus: true },
    { id: "graduatesCount", target: 5000, plus: true },
    { id: "departmentsCount", target: 6, plus: false },
  ];

  stats.forEach((stat) => {
    const el = document.getElementById(stat.id);
    if (!el) return;

    let current = 0;
    const steps = 50;
    const increment = stat.target / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= stat.target) {
        current = stat.target;
        clearInterval(timer);
      }
      el.textContent = Math.floor(current).toLocaleString("ar") + (stat.plus ? "+" : "");
    }, 30);
  });
}

// Smooth scroll + active nav on scroll
function initializeSmoothScroll() {
  const links = Array.from(document.querySelectorAll("nav a"));

  links.forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;

      e.preventDefault();
      links.forEach((x) => x.classList.remove("active"));
      a.classList.add("active");

      const target = document.querySelector(href);
      if (target) {
        window.scrollTo({ top: target.offsetTop - 80, behavior: "smooth" });
      }
    });
  });

  // highlight current section while scrolling
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = "#" + en.target.id;
        links.forEach((x) => x.classList.toggle("active", x.getAttribute("href") === id));
      });
    },
    { rootMargin: "-40% 0px -55% 0px", threshold: 0.01 }
  );

  sections.forEach((s) => obs.observe(s));
}

// Boot
document.addEventListener("DOMContentLoaded", function () {
  updateUI();
  initializeStats();
  initializeSmoothScroll();

  // close modal when clicking outside
  authModal.addEventListener("click", function (e) {
    if (e.target === authModal) closeAuthModal();
  });

  // close modal via ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && authModal.style.display === "flex") closeAuthModal();
  });

  // go to hash if exists
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => {
        window.scrollTo({ top: target.offsetTop - 80, behavior: "smooth" });
      }, 300);
    }
  }

  // Firestore connection test (silent)
  setTimeout(() => {
    db.collection("test")
      .add({ test: "connection", timestamp: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(() => {});
  }, 1000);
});

function showNotification(message, type = 'success') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.animation = 'slideInRight 0.3s ease';
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2400);
}

// Buttons now OPEN real pages (no warning anymore)
function openDepartmentPage(department) {
  const map = {
    programming: 'department-programming.html',
    veterinary: 'department-veterinary.html',
    architecture: 'department-architecture.html',
  };

  const target = map[department];
  if (!target) {
    showNotification('بەش نەدۆزرایەوە!', 'error');
    return;
  }
  window.location.href = target;
}
