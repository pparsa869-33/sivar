const firebaseConfig = {
  apiKey: "AIzaSyCHdHnK0Lz8TITlrkWYgSdV8AmFZU3F7_0",
  authDomain: "sivarvocationalhighschoo-513aa.firebaseapp.com",
  projectId: "sivarvocationalhighschoo-513aa",
  storageBucket: "sivarvocationalhighschoo-513aa.firebasestorage.app",
  messagingSenderId: "498314470915",
  appId: "1:498314470915:web:1d75488d20372f81e71036"
};

let auth = null;
let db = null;
let storage = null;
let currentDashboardRole = null;
let departmentLessonsUnsubscribe = null;
let publicAnnouncementsUnsubscribe = null;
let publicCommentsUnsubscribe = null;
let adminLessonsUnsubscribe = null;
let adminAnnouncementsUnsubscribe = null;
let adminCommentsUnsubscribe = null;

if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  auth = firebase.auth();
  db = firebase.firestore();
  storage = typeof firebase.storage === "function" ? firebase.storage() : null;
}

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(value) {
  return String(value == null ? "" : value).replace(/[<>]/g, "");
}

function sanitizeFilename(name) {
  return String(name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function showNotification(message, type = "success") {
  const existing = qs(".notification");
  if (existing) existing.remove();

  const box = document.createElement("div");
  box.className = `notification ${type}`;
  box.innerHTML = `
    <i class="fas ${
      type === "error"
        ? "fa-circle-exclamation"
        : type === "warning"
        ? "fa-triangle-exclamation"
        : "fa-circle-check"
    }"></i>
    <span>${escapeHtml(message)}</span>
  `;

  document.body.appendChild(box);

  setTimeout(() => {
    box.style.opacity = "0";
    box.style.transform = "translateX(16px)";
    setTimeout(() => box.remove(), 220);
  }, 2600);
}

function formatRelativeTime(date) {
  if (!date) return "";

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "ئێستا";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} خولەک لەمەوپێش`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} کاتژمێر لەمەوپێش`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} ڕۆژ لەمەوپێش`;

  return date.toLocaleDateString("ar-IQ");
}

function renderEmptyState(message) {
  return `
    <div class="empty-state">
      <i class="fas fa-inbox" style="font-size:34px; margin-bottom:12px; color:#2f7cf6;"></i>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function openAuthModal() {
  const modal = qs("#authModal");
  if (!modal) return;
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  switchAuthTab("login");
}

function closeAuthModal() {
  const modal = qs("#authModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  qs("#loginFormElement")?.reset();
  qs("#registerFormElement")?.reset();
}

function switchAuthTab(tabName) {
  qsa(".auth-tab").forEach((tab) => {
    const target = tab.getAttribute("data-tab");
    tab.classList.toggle("active", target === tabName);
  });

  const loginPanel = qs("#loginForm");
  const registerPanel = qs("#registerForm");

  if (loginPanel) loginPanel.classList.toggle("active", tabName === "login");
  if (registerPanel) registerPanel.classList.toggle("active", tabName === "register");
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const toggle = input.parentElement?.querySelector(".password-toggle i");
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";

  if (toggle) {
    toggle.className = isHidden ? "fas fa-eye-slash" : "fas fa-eye";
  }
}

async function ensureUserProfile(user) {
  if (!user || !db) return null;

  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    const payload = {
      name: user.displayName || user.email?.split("@")[0] || "بەکارهێنەر",
      email: user.email || "",
      role: "student",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(payload, { merge: true });
    return payload;
  }

  const data = snap.data() || {};

  await userRef.set(
    {
      name: data.name || user.displayName || user.email?.split("@")[0] || "بەکارهێنەر",
      email: data.email || user.email || ""
    },
    { merge: true }
  );

  return { ...data, email: data.email || user.email || "" };
}

async function register(event) {
  event?.preventDefault();

  if (!auth || !db) {
    showNotification("Firebase ئامادە نییە.", "error");
    return;
  }

  const name = qs("#registerName")?.value.trim();
  const email = qs("#registerEmail")?.value.trim();
  const password = qs("#registerPassword")?.value || "";
  const confirm = qs("#registerConfirmPassword")?.value || "";

  if (!name || !email || !password || !confirm) {
    showNotification("تکایە هەموو خانەکان پڕ بکەوە.", "error");
    return;
  }

  if (password !== confirm) {
    showNotification("وشەی نهێنیەکان یەکسان نین.", "error");
    return;
  }

  if (password.length < 6) {
    showNotification("وشەی نهێنی دەبێت لانی کەم ٦ نووسە بێت.", "error");
    return;
  }

  const btn = qs("#registerBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName: name });

    await db.collection("users").doc(result.user.uid).set({
      name,
      email,
      role: "student",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showNotification("تۆمارکردن بە سەرکەوتوویی ئەنجامدرا.");
    closeAuthModal();
  } catch (error) {
    let message = "هەڵەیەک ڕوویدا.";

    if (error.code === "auth/email-already-in-use") message = "ئەم ئیمەیڵە پێشتر تۆمار کراوە.";
    if (error.code === "auth/invalid-email") message = "ئیمەیڵەکە دروست نییە.";
    if (error.code === "auth/weak-password") message = "وشەی نهێنی زۆر لاوازە.";

    showNotification(message, "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

async function login(event) {
  event?.preventDefault();

  if (!auth) {
    showNotification("Firebase ئامادە نییە.", "error");
    return;
  }

  const email = qs("#loginEmail")?.value.trim();
  const password = qs("#loginPassword")?.value || "";

  if (!email || !password) {
    showNotification("ئیمەیڵ و وشەی نهێنی پێویستن.", "error");
    return;
  }

  const btn = qs("#loginBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    await ensureUserProfile(result.user);
    showNotification("بە سەرکەوتوویی چوویتە ژوورەوە.");
    closeAuthModal();
  } catch (error) {
    let message = "ئیمەیڵ یان وشەی نهێنی هەڵەیە.";

    if (error.code === "auth/invalid-email") message = "ئیمەیڵەکە دروست نییە.";
    if (error.code === "auth/user-disabled") message = "ئەم ئەکاونتە داخراوە.";

    showNotification(message, "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

async function loginWithGoogle() {
  if (!auth) {
    showNotification("Firebase ئامادە نییە.", "error");
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    await ensureUserProfile(result.user);
    showNotification("بە سەرکەوتوویی چوویتە ژوورەوە.");
    closeAuthModal();
  } catch (error) {
    showNotification("هەڵە لە چوونەژورەوە بە گووگڵ.", "error");
  }
}

function loginWithFacebook() {
  showNotification("ئەم بەشە دواتر زیاد دەکرێت.", "warning");
}

async function logout() {
  if (!auth) return;

  try {
    await auth.signOut();
    showNotification("بە سەرکەوتوویی چوویتە دەرەوە.");
    const menu = qs(".user-menu");
    if (menu) menu.remove();
  } catch (error) {
    showNotification("هەڵە لە چوونەدەرەوە.", "error");
  }
}

async function getUserRole(uid) {
  if (!uid || !db) return null;
  const doc = await db.collection("users").doc(uid).get();
  if (!doc.exists) return null;
  return doc.data()?.role || null;
}

function getVisibleUserProfile() {
  const candidates = [qs("#userProfile"), qs("#userProfileMobile")].filter(Boolean);
  return candidates.find((el) => window.getComputedStyle(el).display !== "none") || candidates[0] || null;
}

function buildUserMenu() {
  return `
    <div class="user-menu-item" data-action="profile"><i class="fas fa-user"></i><span>پڕۆفایل</span></div>
    <div class="user-menu-item" data-action="dashboard"><i class="fas fa-chalkboard-user"></i><span>داشبۆرد</span></div>
    <div class="user-menu-item" data-action="logout" style="color:#c53a3a;"><i class="fas fa-right-from-bracket"></i><span>چوونە دەرەوە</span></div>
  `;
}

function toggleUserMenu(targetElement = null) {
  const host = targetElement || getVisibleUserProfile();
  if (!host) return;

  const existing = qs(".user-menu", host);
  if (existing) {
    existing.remove();
    return;
  }

  qsa(".user-menu").forEach((menu) => menu.remove());

  const menu = document.createElement("div");
  menu.className = "user-menu";
  menu.innerHTML = buildUserMenu();
  host.appendChild(menu);

  menu.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-action]");
    if (!item) return;

    const action = item.getAttribute("data-action");

    if (action === "logout") {
      await logout();
      return;
    }

    if (action === "dashboard") {
      window.location.href = "login.html";
      return;
    }

    if (action === "profile") {
      showNotification("پڕۆفایل دواتر زیاد دەکرێت.", "warning");
    }
  });

  setTimeout(() => {
    const handleOutside = (event) => {
      if (!host.contains(event.target)) {
        menu.remove();
        document.removeEventListener("click", handleOutside);
      }
    };

    document.addEventListener("click", handleOutside);
  }, 0);
}

function applyUserDataToUI(user, userData) {
  const desktopProfile = qs("#userProfile");
  const mobileProfile = qs("#userProfileMobile");
  const loginButton = qs("#loginButton");
  const roleText = userData?.role === "admin" ? "ئەدمین" : userData?.role === "teacher" ? "مامۆستا" : "خوێندکار";
  const nameText = user.displayName || userData?.name || "بەکارهێنەر";
  const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameText)}&background=1e4ea8&color=fff&size=160`;

  if (desktopProfile) desktopProfile.style.display = user ? "flex" : "none";
  if (mobileProfile) mobileProfile.style.display = user ? "flex" : "none";
  if (loginButton) loginButton.style.display = user ? "none" : "inline-flex";

  const desktopName = qs("#userDisplayName");
  const desktopRole = qs("#userRole");
  const desktopAvatar = qs("#userAvatar");
  const mobileName = qs("#userDisplayNameMobile");
  const mobileRole = qs("#userRoleMobile");
  const mobileAvatar = qs("#userAvatarMobile");

  if (desktopName) desktopName.textContent = nameText;
  if (desktopRole) desktopRole.textContent = roleText;
  if (desktopAvatar) desktopAvatar.src = avatarUrl;
  if (mobileName) mobileName.textContent = nameText;
  if (mobileRole) mobileRole.textContent = roleText;
  if (mobileAvatar) mobileAvatar.src = avatarUrl;
}

function updateUI() {
  if (!auth) return;

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      applyUserDataToUI(null, null);
      if (isDashboardPage()) {
        window.location.replace("login.html");
      }
      return;
    }

    try {
      const userData = await ensureUserProfile(user);
      applyUserDataToUI(user, userData);
    } catch (error) {
      applyUserDataToUI(user, null);
    }
  });
}

function isDashboardPage() {
  return window.location.pathname.toLowerCase().endsWith("admin.html");
}

function isAccessLoginPage() {
  return window.location.pathname.toLowerCase().endsWith("login.html");
}

function setDashboardRoleState(role) {
  currentDashboardRole = role;
  const roleBox = qs("#dashboardRoleBadge");
  if (roleBox) {
    roleBox.textContent = role === "admin" ? "ئەدمین" : role === "teacher" ? "مامۆستا" : "نەناسراو";
  }

  const adminOnlyBlocks = qsa("[data-admin-only]");
  adminOnlyBlocks.forEach((block) => {
    block.classList.toggle("hidden", role !== "admin");
  });
}

function protectDashboardPage() {
  if (!auth || !db || !isDashboardPage()) return;

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    try {
      const role = await getUserRole(user.uid);

      if (role !== "admin" && role !== "teacher") {
        showNotification("تەنها ئەدمین یان مامۆستا دەتوانێت بچێتە ناو داشبۆرد.", "error");
        await auth.signOut();
        window.location.replace("login.html");
        return;
      }

      setDashboardRoleState(role);
      initDashboard();
    } catch (error) {
      window.location.replace("login.html");
    }
  });
}

function initAccessLoginPage() {
  if (!auth || !db || !isAccessLoginPage()) return;

  const form = qs("#adminLoginForm");
  const errorEl = qs("#error");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.textContent = "";

    const email = qs("#adminEmail")?.value.trim();
    const password = qs("#adminPassword")?.value || "";
    const submitBtn = qs("#accessLoginBtn");
    const old = submitBtn?.innerHTML;
    if (submitBtn) submitBtn.innerHTML = '<span class="loading"></span>';

    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      await ensureUserProfile(cred.user);
      const role = await getUserRole(cred.user.uid);

      if (role !== "admin" && role !== "teacher") {
        await auth.signOut();
        if (errorEl) errorEl.textContent = "تەنها ئەدمین یان مامۆستا دەتوانێت بچێتە ژوورەوە.";
        return;
      }

      window.location.href = "admin.html";
    } catch (error) {
      if (errorEl) errorEl.textContent = "چوونەژورەوە سەرکەوتوو نەبوو.";
    } finally {
      if (submitBtn && old) submitBtn.innerHTML = old;
    }
  });
}

async function uploadToImgBB(file) {
  const apiKey = "a60d17c9e2a12b41ef35cd6ef4f10115";
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData
  });

  const data = await response.json();
  return data?.data?.url || "";
}

async function postAnnouncement(event) {
  event?.preventDefault();

  if (!db) return;

  const text = qs("#announcementText")?.value.trim() || "";
  const imageFile = qs("#announcementImage")?.files?.[0] || null;

  if (!text && !imageFile) {
    showNotification("دەق یان وێنە زیاد بکە.", "error");
    return;
  }

  const btn = qs("#postAnnouncementBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';

  try {
    let imageUrl = "";
    if (imageFile) {
      imageUrl = await uploadToImgBB(imageFile);
    }

    await db.collection("announcements").add({
      text,
      imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    qs("#announcementText").value = "";
    if (qs("#announcementImage")) qs("#announcementImage").value = "";
    showNotification("ڕاگەیاندن زیادکرا.");
  } catch (error) {
    showNotification("هەڵە لە ناردنی ڕاگەیاندن.", "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

function loadPublicAnnouncements() {
  if (!db) return;
  const container = qs("#announcementPublicList");
  if (!container) return;

  if (publicAnnouncementsUnsubscribe) publicAnnouncementsUnsubscribe();

  publicAnnouncementsUnsubscribe = db
    .collection("announcements")
    .orderBy("createdAt", "desc")
    .limit(12)
    .onSnapshot(
      (snapshot) => {
        if (snapshot.empty) {
          container.innerHTML = renderEmptyState("هێشتا هیچ ڕاگەیاندنێک زیاد نەکراوە.");
          return;
        }

        container.innerHTML = snapshot.docs
          .map((doc) => {
            const data = doc.data() || {};
            const createdAt = data.createdAt?.toDate?.();
            return `
              <article class="announcement-card">
                <h3><i class="fas fa-bullhorn"></i> ڕاگەیاندن</h3>
                <p>${escapeHtml(data.text || "")}</p>
                ${data.imageUrl ? `<img class="announcement-image" src="${data.imageUrl}" alt="ڕاگەیاندن">` : ""}
                <div class="lesson-date">${createdAt ? formatRelativeTime(createdAt) : ""}</div>
              </article>
            `;
          })
          .join("");
      },
      () => {
        container.innerHTML = renderEmptyState("نەتوانرا ڕاگەیاندنەکان باربکرێن.");
      }
    );
}

function loadAdminAnnouncements() {
  if (!db) return;
  const list = qs("#announcementList");
  if (!list) return;

  db.collection("announcements")
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        list.innerHTML = renderEmptyState("هێشتا ڕاگەیاندن نییە.");
        return;
      }

      list.innerHTML = snapshot.docs
        .map((doc) => {
          const data = doc.data() || {};
          return `
            <article class="announcement-card">
              <h3>ڕاگەیاندنی نوێ</h3>
              <p>${escapeHtml(data.text || "")}</p>
              ${data.imageUrl ? `<img class="announcement-image" src="${data.imageUrl}" alt="Announcement">` : ""}
              <div class="dashboard-item-actions">
                <button class="danger-btn" data-delete-announcement="${doc.id}"><i class="fas fa-trash"></i> سڕینەوە</button>
              </div>
            </article>
          `;
        })
        .join("");

      qsa("[data-delete-announcement]", list).forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-delete-announcement");
          if (!confirm("دڵنیای لە سڕینەوەی ئەم ڕاگەیاندنە؟")) return;
          await db.collection("announcements").doc(id).delete();
        });
      });
    });
}

async function addComment(event) {
  event?.preventDefault();

  if (!auth || !db) {
    showNotification("Firebase ئامادە نییە.", "error");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    showNotification("تکایە یەکەم چوونەژورەوە بکە.", "error");
    openAuthModal();
    return;
  }

  const textarea = qs("#commentText");
  const text = textarea?.value.trim() || "";

  if (text.length < 3) {
    showNotification("کۆمێنتەکە دەبێت لانی کەم ٣ نووسە بێت.", "error");
    return;
  }

  const formBtn = qs("#commentForm button[type='submit']");
  const old = formBtn?.innerHTML;
  if (formBtn) formBtn.innerHTML = '<span class="loading"></span>';

  try {
    const userData = await ensureUserProfile(user);

    await db.collection("comments").add({
      userId: user.uid,
      userName: user.displayName || userData?.name || "بەکارهێنەر",
      userRole: userData?.role || "student",
      text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    textarea.value = "";
    showNotification("کۆمێنتەکەت نێردرا.");
  } catch (error) {
    showNotification("هەڵە لە ناردنی کۆمێنت.", "error");
  } finally {
    if (formBtn && old) formBtn.innerHTML = old;
  }
}

function renderCommentHtml(data) {
  const createdAt = data.timestamp?.toDate?.();
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.userName || "User")}&background=1e4ea8&color=fff&size=160`;
  const roleLabel = data.userRole === "teacher" ? "مامۆستا" : data.userRole === "admin" ? "ئەدمین" : "خوێندکار";

  return `
    <article class="comment">
      <div class="comment-header">
        <div class="comment-user">
          <img class="comment-avatar" src="${avatar}" alt="${escapeHtml(data.userName || "User")}">
          <div class="comment-user-info">
            <h4>${escapeHtml(data.userName || "بەکارهێنەر")}</h4>
            <div class="teacher-meta">
              <span class="teacher-badge">${roleLabel}</span>
              <span class="comment-time">${createdAt ? formatRelativeTime(createdAt) : ""}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="comment-body">${escapeHtml(data.text || "").replace(/\n/g, "<br>")}</div>
    </article>
  `;
}

function loadComments() {
  if (!db) return;
  const list = qs("#commentsList");
  if (!list) return;
  if (publicCommentsUnsubscribe) publicCommentsUnsubscribe();

  publicCommentsUnsubscribe = db
    .collection("comments")
    .orderBy("timestamp", "desc")
    .limit(20)
    .onSnapshot(
      (snapshot) => {
        if (snapshot.empty) {
          list.innerHTML = renderEmptyState("هێشتا هیچ کۆمێنتێک نییە.");
          return;
        }

        list.innerHTML = snapshot.docs.map((doc) => renderCommentHtml(doc.data() || {})).join("");
      },
      () => {
        list.innerHTML = renderEmptyState("نەتوانرا کۆمێنتەکان باربکرێن.");
      }
    );
}

function loadAdminComments() {
  if (!db) return;
  const container = qs("#adminCommentsList");
  if (!container) return;

  db.collection("comments")
    .orderBy("timestamp", "desc")
    .limit(50)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = renderEmptyState("هێشتا هیچ کۆمێنتێک نییە.");
        return;
      }

      container.innerHTML = snapshot.docs
        .map((doc) => {
          const data = doc.data() || {};
          return `
            <article class="comment">
              ${renderCommentBody(data)}
              <div class="dashboard-item-actions">
                <button class="danger-btn" data-delete-comment="${doc.id}"><i class="fas fa-trash"></i> سڕینەوە</button>
              </div>
            </article>
          `;
        })
        .join("");

      qsa("[data-delete-comment]", container).forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-delete-comment");
          if (!confirm("سڕینەوەی ئەم کۆمێنتە؟")) return;
          await db.collection("comments").doc(id).delete();
        });
      });
    });
}

async function uploadLessonVideo(file, department) {
  if (!storage) {
    throw new Error("Storage not ready");
  }

  const safeName = sanitizeFilename(file.name || "lesson-video.mp4");
  const path = `lessons/${department}/${Date.now()}-${safeName}`;
  const ref = storage.ref(path);
  const snapshot = await ref.put(file, { contentType: file.type || "video/mp4" });
  const url = await snapshot.ref.getDownloadURL();
  return { url, path };
}

async function postLesson(event) {
  event?.preventDefault();

  if (!db || !auth) return;

  const user = auth.currentUser;
  if (!user) {
    showNotification("تکایە یەکەم چوونەژورەوە بکە.", "error");
    return;
  }

  const department = qs("#lessonDepartment")?.value || "";
  const title = qs("#lessonTitle")?.value.trim() || "";
  const teacher = qs("#lessonTeacher")?.value.trim() || user.displayName || "";
  const subject = qs("#lessonSubject")?.value.trim() || "";
  const description = qs("#lessonDescription")?.value.trim() || "";
  const videoFile = qs("#lessonVideo")?.files?.[0] || null;

  if (!department || !title || !teacher || !subject || !videoFile) {
    showNotification("تکایە خانە سەرەکییەکان و ڤیدیۆکە پڕ بکەوە.", "error");
    return;
  }

  const btn = qs("#postLessonBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';

  try {
    const { url, path } = await uploadLessonVideo(videoFile, department);

    await db.collection("lessons").add({
      department,
      title,
      teacher,
      subject,
      description,
      videoUrl: url,
      storagePath: path,
      uploadedBy: user.uid,
      uploadedByName: user.displayName || teacher,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    qs("#lessonForm")?.reset();
    showNotification("وانەکە بە سەرکەوتوویی زیادکرا.");
  } catch (error) {
    showNotification("هەڵە لە بارکردنی وانەکە.", "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

function mapDepartmentName(value) {
  if (value === "programming") return "پڕۆگرامسازی";
  if (value === "architecture") return "بیناسازی";
  if (value === "veterinary") return "ڤێتەرنەری";
  return value;
}

function getYouTubeEmbedUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return '';
}

function renderLessonMedia(data, options = {}) {
  const videoUrl = String(data.videoUrl || '').trim();
  if (!videoUrl) {
    return `<div class="lesson-media-placeholder"><i class="fas fa-video"></i></div>`;
  }

  const youtubeEmbed = getYouTubeEmbedUrl(videoUrl);
  if (youtubeEmbed) {
    return `
      <div class="lesson-media-frame${options.compactMedia ? ' compact' : ''}">
        <iframe src="${youtubeEmbed}" title="${escapeHtml(data.title || 'Lesson video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
    `;
  }

  return `
    <div class="lesson-media-frame${options.compactMedia ? ' compact' : ''}">
      <video controls preload="metadata">
        <source src="${videoUrl}" type="video/mp4">
        <source src="${videoUrl}" type="video/webm">
        <source src="${videoUrl}" type="video/ogg">
      </video>
    </div>
  `;
}

function renderLessonCard(data, options = {}) {
  const createdAt = data.createdAt?.toDate?.();
  const showDelete = options.showDelete === true;
  const lessonId = options.lessonId || "";
  const openUrl = String(data.videoUrl || '').trim();
  const compactMedia = options.compactMedia === true;
  return `
    <article class="lesson-card${compactMedia ? ' compact-media' : ''}">
      <div class="lesson-card-media">
        ${renderLessonMedia(data, options)}
      </div>
      <div class="lesson-card-body">
        <div>
          <h3>${escapeHtml(data.title || (currentLang === "en" ? "Lesson" : "وانە"))}</h3>
          ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ""}
          <div class="lesson-meta">
            <span class="lesson-badge"><i class="fas fa-book"></i>${t("badge_subject")}: ${escapeHtml(data.subject || t("badge_subject"))}</span>
            <span class="lesson-badge"><i class="fas fa-user"></i>${t("badge_teacher")}: ${escapeHtml(data.teacher || t("badge_teacher"))}</span>
            <span class="lesson-badge"><i class="fas fa-building"></i>${t("badge_department")}: ${escapeHtml(mapDepartmentName(data.department || ""))}</span>
          </div>
        </div>
        <div class="lesson-card-footer">
          <div class="lesson-date">${createdAt ? formatRelativeTime(createdAt) : ""}</div>
          <div class="lesson-card-actions">
            ${openUrl ? `<a class="outline-btn small" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-up-right-from-square"></i> ${currentLang === 'en' ? 'Open' : 'کردنەوە'}</a>` : ""}
            ${showDelete ? `<button class="danger-btn" data-delete-lesson="${lessonId}"><i class="fas fa-trash"></i> ${t("delete_text")}</button>` : ""}
          </div>
        </div>
      </div>
    </article>
  `;
}

function loadDepartmentLessons() {
  if (!db) return;
  const container = qs("#departmentLessonsList");
  if (!container) return;

  const department = container.getAttribute("data-department") || document.body.getAttribute("data-department") || "";
  if (!department) return;

  if (departmentLessonsUnsubscribe) departmentLessonsUnsubscribe();

  departmentLessonsUnsubscribe = db
    .collection("lessons")
    .orderBy("createdAt", "desc")
    .limit(80)
    .onSnapshot(
      (snapshot) => {
        const lessons = snapshot.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
          .filter((item) => item.department === department);

        if (!lessons.length) {
          container.innerHTML = renderEmptyState("هێشتا هیچ وانەیەک بۆ ئەم بەشە زیاد نەکراوە.");
          return;
        }

        container.innerHTML = lessons.map((lesson) => renderLessonCard(lesson)).join("");
      },
      () => {
        container.innerHTML = renderEmptyState("نەتوانرا وانەکان باربکرێن.");
      }
    );
}

function loadAdminLessons() {
  if (!db) return;
  const container = qs("#lessonAdminList");
  if (!container) return;

  db.collection("lessons")
    .orderBy("createdAt", "desc")
    .limit(100)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = renderEmptyState("هێشتا هیچ وانەیەک زیاد نەکراوە.");
        return;
      }

      container.innerHTML = snapshot.docs
        .map((doc) => renderLessonCard(doc.data() || {}, { showDelete: true, lessonId: doc.id }))
        .join("");

      qsa("[data-delete-lesson]", container).forEach((button) => {
        button.addEventListener("click", async () => {
          const lessonId = button.getAttribute("data-delete-lesson");
          if (!confirm("دڵنیای لە سڕینەوەی ئەم وانەیە؟")) return;

          try {
            const lessonRef = db.collection("lessons").doc(lessonId);
            const snap = await lessonRef.get();
            const data = snap.data() || {};

            if (data.storagePath && storage) {
              try {
                await storage.ref(data.storagePath).delete();
              } catch (error) {
                // ignore missing storage file
              }
            }

            await lessonRef.delete();
            showNotification("وانەکە سڕایەوە.");
          } catch (error) {
            showNotification("هەڵە لە سڕینەوەی وانەکە.", "error");
          }
        });
      });
    });
}

async function updateUserRole(event) {
  event?.preventDefault();

  if (!db || currentDashboardRole !== "admin") return;

  const email = qs("#roleEmail")?.value.trim().toLowerCase() || "";
  const role = qs("#roleSelect")?.value || "student";

  if (!email) {
    showNotification("ئیمەیڵی بەکارهێنەر بنووسە.", "error");
    return;
  }

  const btn = qs("#roleUpdateBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';

  try {
    const result = await db.collection("users").where("email", "==", email).limit(1).get();

    if (result.empty) {
      showNotification("هیچ بەکارهێنەرێک بەو ئیمەیڵە نەدۆزرایەوە.", "error");
      return;
    }

    const doc = result.docs[0];
    await doc.ref.set({ role }, { merge: true });
    qs("#roleForm")?.reset();
    showNotification("ڕۆڵی بەکارهێنەر نوێکرایەوە.");
  } catch (error) {
    showNotification("هەڵە لە گۆڕینی ڕۆڵ.", "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

function initDashboard() {
  const dashboard = qs("#dashboardReady");
  if (!dashboard || dashboard.getAttribute("data-ready") === "true") return;
  dashboard.setAttribute("data-ready", "true");

  qs("#announcementForm")?.addEventListener("submit", postAnnouncement);
  qs("#lessonForm")?.addEventListener("submit", postLesson);
  qs("#roleForm")?.addEventListener("submit", updateUserRole);
  qs("#logoutAdmin")?.addEventListener("click", async () => {
    await logout();
    window.location.replace("index.html");
  });

  qs("#lessonVideo")?.addEventListener("change", (event) => {
    const file = event.target?.files?.[0];
    if (!file) {
      setLessonUploadStatus(t("lesson_url_mode"), "info");
      return;
    }
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setLessonUploadStatus(`${file.name} • ${sizeMb} MB`, "info");
  });

  qs("#lessonVideoUrl")?.addEventListener("input", (event) => {
    const value = event.target?.value?.trim() || "";
    if (!value) return;
    setLessonUploadStatus(t("lesson_url_mode"), "info");
  });

  loadAdminAnnouncements();
  loadAdminLessons();
  loadAdminComments();
}

function openDepartmentPage(department) {
  const map = {
    programming: "department-programming.html",
    architecture: "department-architecture.html",
    veterinary: "department-veterinary.html"
  };

  const target = map[department];
  if (!target) {
    showNotification("بەش نەدۆزرایەوە.", "error");
    return;
  }

  window.location.href = target;
}

function uploadMedia() {
  showNotification("بارکردنی میدیا هێشتا کراوە بە بەشێکی جیاواز. بۆ وانەکان، داشبۆرد بەکاربهێنە.", "warning");
}

function initializeStatsOnView() {
  const statsSection = qs("#stats");
  if (!statsSection) return;

  const targets = [
    { id: "studentsCount", value: 140, suffix: "+" },
    { id: "teachersCount", value: 12, suffix: "+" },
    { id: "departmentsCount", value: 3, suffix: "" }
  ];

  let started = false;

  const animate = (element, target, suffix) => {
    let current = 0;
    const duration = 1200;
    const start = performance.now();

    const frame = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      current = Math.floor(progress * target);
      element.textContent = `${current.toLocaleString("ar-IQ")}${suffix}`;
      if (progress < 1) requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !started) {
          started = true;
          targets.forEach((item) => {
            const el = document.getElementById(item.id);
            if (el) animate(el, item.value, item.suffix);
          });
          observer.disconnect();
        }
      });
    },
    { threshold: 0.35 }
  );

  observer.observe(statsSection);
}

function initializeSmoothScroll() {
  qsa("a[href^='#']").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = qs(href);
      if (!target) return;

      event.preventDefault();
      const offset = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: offset, behavior: "smooth" });
      closeMenu();
    });
  });
}

function initializeScrollReveal() {
  const items = qsa(".section, .department-card, .stat-card, .media-item, .teacher-card, .video-card, .news-card, .goal-card, .quick-card, .map-card");
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  items.forEach((item) => {
    item.classList.add("reveal");
    observer.observe(item);
  });
}

function initHeaderScrollEffect() {
  const header = qs("header");
  if (!header) return;

  const update = () => {
    header.classList.toggle("scrolled", window.scrollY > 60);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function toggleMenu() {
  const nav = qs("#mainNav");
  if (!nav) return;
  nav.classList.toggle("active");
  document.body.classList.toggle("menu-open", nav.classList.contains("active"));
}

function closeMenu() {
  const nav = qs("#mainNav");
  if (!nav) return;
  nav.classList.remove("active");
  document.body.classList.remove("menu-open");
}

function toggleDepartments(forceState = null) {
  const item = qs("#departmentsItem");
  if (!item) return;
  if (forceState == null) item.classList.toggle("submenu-open");
  else item.classList.toggle("submenu-open", Boolean(forceState));

  const toggle = qs(".dept-toggle", item);
  if (toggle) {
    toggle.setAttribute("aria-expanded", item.classList.contains("submenu-open") ? "true" : "false");
  }
}

function initMenuAndSubmenu() {
  const toggle = qs(".menu-toggle");
  const deptToggle = qs(".dept-toggle");
  const nav = qs("#mainNav");

  if (toggle) {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu();
    });
  }

  if (deptToggle) {
    deptToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleDepartments();
    });
  }

  document.addEventListener("click", (event) => {
    if (nav && nav.classList.contains("active") && !nav.contains(event.target) && !toggle?.contains(event.target)) {
      closeMenu();
    }

    const item = qs("#departmentsItem");
    if (item && item.classList.contains("submenu-open") && !item.contains(event.target)) {
      toggleDepartments(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 992) closeMenu();
  });
}

function initScrollProgressBar() {
  const bar = qs("#scrollProgress");
  if (!bar) return;

  const update = () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = height > 0 ? (scrollTop / height) * 100 : 0;
    bar.style.width = `${progress}%`;
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initScrollTopButton() {
  const button = qs("#scrollTopBtn");
  if (!button) return;

  const update = () => {
    button.classList.toggle("show", window.scrollY > 420);
  };

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initHeroTyping() {
  const title = qs("#heroTitle");
  if (!title) return;

  const text = title.getAttribute("data-text") || "ئامادەیی پیشەیی سیڤەر";
  let index = 0;
  title.textContent = "";

  const type = () => {
    if (index < text.length) {
      title.textContent += text.charAt(index);
      index += 1;
      setTimeout(type, 75);
    }
  };

  type();
}

function initLoader() {
  const loader = qs("#loader");
  if (!loader) return;

  window.addEventListener("load", () => {
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
    }, 280);
  });
}

function initPrincipalLightbox() {
  const image = qs(".principal-img");
  const lightbox = qs("#principalLightbox");
  const lightboxImage = qs("#principalLightboxImage");
  const closeBtn = qs("#closePrincipalLightbox");

  if (!image || !lightbox || !lightboxImage) return;

  const open = () => {
    lightboxImage.src = image.getAttribute("src") || "";
    lightboxImage.alt = image.getAttribute("alt") || "Principal";
    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
  };

  image.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("active")) {
      close();
    }
  });
}

function initAuthModalEvents() {
  const modal = qs("#authModal");
  if (!modal) return;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeAuthModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (modal.style.display === "flex") closeAuthModal();
    }
  });

  qsa(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchAuthTab(tab.getAttribute("data-tab")));
  });

  qsa(".password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => togglePassword(toggle.getAttribute("data-target")));
  });

  qs("#loginFormElement")?.addEventListener("submit", login);
  qs("#registerFormElement")?.addEventListener("submit", register);
}

function initUserProfileButtons() {
  const desktop = qs("#userProfile");
  const mobile = qs("#userProfileMobile");

  desktop?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleUserMenu(desktop);
  });

  mobile?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleUserMenu(mobile);
  });
}

function initQuickActions() {
  qsa("[data-open-auth]").forEach((button) => {
    button.addEventListener("click", openAuthModal);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLoader();
  initAuthModalEvents();
  initUserProfileButtons();
  initQuickActions();
  updateUI();
  protectDashboardPage();
  initAccessLoginPage();
  initializeStatsOnView();
  initializeSmoothScroll();
  initializeScrollReveal();
  initHeaderScrollEffect();
  initMenuAndSubmenu();
  initScrollProgressBar();
  initScrollTopButton();
  initHeroTyping();
  initPrincipalLightbox();
  loadPublicAnnouncements();
  loadComments();
  loadDepartmentLessons();
});

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.togglePassword = togglePassword;
window.login = login;
window.register = register;
window.loginWithGoogle = loginWithGoogle;
window.loginWithFacebook = loginWithFacebook;
window.logout = logout;
window.toggleUserMenu = toggleUserMenu;
window.toggleMenu = toggleMenu;
window.toggleDepartments = toggleDepartments;
window.openDepartmentPage = openDepartmentPage;
window.addComment = addComment;
window.uploadMedia = uploadMedia;

/* =====================================================
   2026-03-30 upgrades: language, mobile UX, upload fixes
   ===================================================== */
let currentLang = "ku";
localStorage.setItem("sivar_lang", "ku");

const runtimeText = {
  badge_subject: { ku: "بابەت", en: "Subject" },
  badge_teacher: { ku: "مامۆستا", en: "Teacher" },
  badge_department: { ku: "بەش", en: "Department" },
  badge_announcement: { ku: "ڕاگەیاندن", en: "Announcement" },
  empty_announcements: { ku: "هێشتا هیچ ڕاگەیاندنێک زیاد نەکراوە.", en: "No announcements have been posted yet." },
  empty_comments: { ku: "هێشتا هیچ کۆمێنتێک نییە.", en: "No comments yet." },
  empty_lessons: { ku: "هێشتا هیچ وانەیەک بۆ ئەم بەشە زیاد نەکراوە.", en: "No lessons have been added for this department yet." },
  empty_admin_lessons: { ku: "هێشتا هیچ وانەیەک بار نەکراوە.", en: "No lesson videos have been uploaded yet." },
  empty_admin_announcements: { ku: "هێشتا ڕاگەیاندن نییە.", en: "No announcements yet." },
  empty_admin_comments: { ku: "هێشتا هیچ کۆمێنتێک نییە.", en: "No comments yet." },
  role_admin: { ku: "ئەدمین", en: "Admin" },
  role_teacher: { ku: "مامۆستا", en: "Teacher" },
  role_student: { ku: "خوێندکار", en: "Student" },
  not_ready: { ku: "Firebase ئامادە نییە.", en: "Firebase is not ready." },
  need_login: { ku: "تکایە یەکەم چوونەژورەوە بکە.", en: "Please log in first." },
  lesson_missing: { ku: "تکایە بەش، ناونیشان، بابەت و ڤیدیۆ یان بەستەر پڕ بکەوە.", en: "Please fill in the department, title, subject, and add a video file or link." },
  lesson_posted: { ku: "وانەکە بە سەرکەوتوویی زیادکرا.", en: "The lesson was uploaded successfully." },
  lesson_deleted: { ku: "وانەکە سڕایەوە.", en: "The lesson was deleted." },
  lesson_uploading: { ku: "بارکردنی ڤیدیۆ دەست پێکرد...", en: "Uploading the video..." },
  lesson_processing: { ku: "بارکردن تەواو بوو، زانیاریەکان تۆمار دەکرێن...", en: "Upload completed. Saving lesson details..." },
  lesson_upload_progress: { ku: "بارکردن", en: "Upload" },
  lesson_upload_done: { ku: "بارکردن تەواو بوو.", en: "Upload finished." },
  lesson_url_mode: { ku: "وانەکە بە بەستەری ڤیدیۆ زیاد دەکرێت.", en: "The lesson will be added using the video link." },
  invalid_video_link: { ku: "بەستەری ڤیدیۆ دروست نییە.", en: "The video link is not valid." },
  lesson_delete_confirm: { ku: "دڵنیای لە سڕینەوەی ئەم وانەیە؟", en: "Are you sure you want to delete this lesson?" },
  announcement_delete_confirm: { ku: "دڵنیای لە سڕینەوەی ئەم ڕاگەیاندنە؟", en: "Are you sure you want to delete this announcement?" },
  comment_delete_confirm: { ku: "سڕینەوەی ئەم کۆمێنتە؟", en: "Delete this comment?" },
  announcement_missing: { ku: "دەق یان وێنە زیاد بکە.", en: "Please add announcement text or an image." },
  announcement_added: { ku: "ڕاگەیاندن زیادکرا.", en: "The announcement was posted." },
  announcement_error: { ku: "هەڵە لە ناردنی ڕاگەیاندن.", en: "There was a problem posting the announcement." },
  comment_posted: { ku: "کۆمێنتەکەت نێردرا.", en: "Your comment was sent." },
  comment_min: { ku: "کۆمێنتەکە دەبێت لانی کەم ٣ نووسە بێت.", en: "A comment must be at least 3 characters long." },
  login_success: { ku: "بە سەرکەوتوویی چوویتە ژوورەوە.", en: "You are now signed in." },
  login_fail: { ku: "ئیمەیڵ یان وشەی نهێنی هەڵەیە.", en: "Incorrect email or password." },
  register_success: { ku: "تۆمارکردن بە سەرکەوتوویی ئەنجامدرا.", en: "Registration completed successfully." },
  saved: { ku: "تۆمارکرا.", en: "Saved." },
  upload_media_info: { ku: "بارکردنی میدیا هێشتا کراوە بە بەشێکی جیاواز. بۆ وانەکان، داشبۆرد بەکاربهێنە.", en: "Media upload is handled separately for now. Please use the dashboard for lessons." },
  profile_soon: { ku: "پڕۆفایل دواتر زیاد دەکرێت.", en: "Profile will be added later." },
  dashboard_login_only: { ku: "تەنها ئەدمین یان مامۆستا دەتوانێت بچێتە ناو داشبۆرد.", en: "Only admins or teachers can access the dashboard." },
  delete_text: { ku: "سڕینەوە", en: "Delete" },
  dashboard_text: { ku: "داشبۆرد", en: "Dashboard" },
  profile_text: { ku: "پڕۆفایل", en: "Profile" },
  logout_text: { ku: "چوونە دەرەوە", en: "Logout" },
  now: { ku: "ئێستا", en: "now" },
  mins_ago: { ku: "خولەک لەمەوپێش", en: "min ago" },
  hours_ago: { ku: "کاتژمێر لەمەوپێش", en: "hours ago" },
  days_ago: { ku: "ڕۆژ لەمەوپێش", en: "days ago" },
  open_map: { ku: "کردنەوەی نەخشە", en: "Open map" },
  upload_lesson_btn: { ku: "بارکردنی وانە", en: "Upload lesson" }
};

function t(key, fallback = "") {
  const bucket = runtimeText[key];
  if (!bucket) return fallback || key;
  return bucket[currentLang] || bucket.ku || fallback || key;
}

function updateLangButtonsUI() {
  qsa(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
  });
}

function applyRule(rule) {
  qsa(rule.selector).forEach((el) => {
    const value = rule[currentLang] ?? rule.ku ?? "";
    if (rule.attr) el.setAttribute(rule.attr, value);
    else if (rule.html) el.innerHTML = value;
    else el.textContent = value;
  });
}

const pageTranslations = {
  common: [
    { selector: "title", ku: document.title, en: document.title },
    { selector: ".logo-text", html: true, ku: "ئامادەیی پیشەیی سیڤەر<span>پەروەردەی شارەزایانەی داهاتوو</span>", en: "Sivar Vocational HS<span>Smart education for the future</span>" },
    { selector: ".lang-switch", attr: "aria-label", ku: "گۆڕینی زمان", en: "Change language" }
  ],
  index: [
    { selector: "title", ku: "ئامادەیی پیشەیی سیڤەر", en: "Sivar Vocational High School" },
    { selector: "#authTitle", ku: "بەخێربێیت", en: "Welcome" },
    { selector: ".auth-header p", ku: "تکایە چوونەژورەوە بکە یان تۆمار ببە", en: "Please sign in or create an account." },
    { selector: ".auth-tab[data-tab='login']", ku: "چوونەژورەوە", en: "Login" },
    { selector: ".auth-tab[data-tab='register']", ku: "تۆمارکردن", en: "Register" },
    { selector: "label[for='loginEmail']", html: true, ku: "<i class='fas fa-envelope'></i> ئیمەیڵ", en: "<i class='fas fa-envelope'></i> Email" },
    { selector: "label[for='loginPassword']", html: true, ku: "<i class='fas fa-lock'></i> وشەی نهێنی", en: "<i class='fas fa-lock'></i> Password" },
    { selector: "#loginEmail", attr: "placeholder", ku: "example@gmail.com", en: "example@gmail.com" },
    { selector: "#loginPassword", attr: "placeholder", ku: "وشەی نهێنی", en: "Password" },
    { selector: "#loginBtn span", ku: "چوونەژورەوە", en: "Login" },
    { selector: ".social-login p", ku: "یان چوونەژورەوە بە", en: "Or sign in with" },
    { selector: ".social-buttons button:nth-child(1)", html: true, ku: "<i class='fab fa-google'></i> گووگڵ", en: "<i class='fab fa-google'></i> Google" },
    { selector: ".social-buttons button:nth-child(2)", html: true, ku: "<i class='fab fa-facebook-f'></i> فەیسبووک", en: "<i class='fab fa-facebook-f'></i> Facebook" },
    { selector: "label[for='registerName']", html: true, ku: "<i class='fas fa-user'></i> ناوی تەواو", en: "<i class='fas fa-user'></i> Full name" },
    { selector: "label[for='registerEmail']", html: true, ku: "<i class='fas fa-envelope'></i> ئیمەیڵ", en: "<i class='fas fa-envelope'></i> Email" },
    { selector: "label[for='registerPassword']", html: true, ku: "<i class='fas fa-lock'></i> وشەی نهێنی", en: "<i class='fas fa-lock'></i> Password" },
    { selector: "label[for='registerConfirmPassword']", html: true, ku: "<i class='fas fa-lock'></i> دووبارەکردنەوەی وشەی نهێنی", en: "<i class='fas fa-lock'></i> Confirm password" },
    { selector: "#registerName", attr: "placeholder", ku: "ناوی تەواو", en: "Full name" },
    { selector: "#registerEmail", attr: "placeholder", ku: "example@gmail.com", en: "example@gmail.com" },
    { selector: "#registerPassword", attr: "placeholder", ku: "وشەی نهێنی (لانی کەم ٦ نووسە)", en: "Password (at least 6 characters)" },
    { selector: "#registerConfirmPassword", attr: "placeholder", ku: "دووبارەکردنەوەی وشەی نهێنی", en: "Confirm password" },
    { selector: "#registerBtn span", ku: "تۆمارکردن", en: "Register" },
    { selector: ".nav-list a[href='#home']", html: true, ku: "<i class='fas fa-house'></i> سەرەتا", en: "<i class='fas fa-house'></i> Home" },
    { selector: ".dept-toggle span", html: true, ku: "<i class='fas fa-book'></i> بەشەکان", en: "<i class='fas fa-book'></i> Departments" },
    { selector: "#departmentsSubmenu a[href='department-programming.html']", ku: "پڕۆگرامسازی", en: "Programming" },
    { selector: "#departmentsSubmenu a[href='department-architecture.html']", ku: "بیناسازی", en: "Architecture" },
    { selector: "#departmentsSubmenu a[href='department-veterinary.html']", ku: "ڤێتەرنەری", en: "Veterinary" },
    { selector: ".nav-list a[href='#online-lessons']", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: ".nav-list a[href='#announcements']", html: true, ku: "<i class='fas fa-bullhorn'></i> ڕاگەیاندن", en: "<i class='fas fa-bullhorn'></i> Announcements" },
    { selector: ".nav-list a[href='#comments']", html: true, ku: "<i class='fas fa-comments'></i> کۆمێنت", en: "<i class='fas fa-comments'></i> Comments" },
    { selector: ".nav-list a[href='#about']", html: true, ku: "<i class='fas fa-circle-info'></i> دەربارە", en: "<i class='fas fa-circle-info'></i> About" },
    { selector: "#loginButton", html: true, ku: "<i class='fas fa-right-to-bracket'></i> چوونەژورەوە", en: "<i class='fas fa-right-to-bracket'></i> Login" },
    { selector: ".hero-content p", ku: "پەروەردەی شارەزایانەی داهاتوو لە بواری تەکنەلۆژیا، پیشەسازی و فێربوونی کارا", en: "Smart future-ready education in technology, vocational skills, and practical learning." },
    { selector: ".hero-actions .hero-btn", html: true, ku: "<i class='fas fa-book-open'></i> بەشەکان ببینە", en: "<i class='fas fa-book-open'></i> Explore departments" },
    { selector: ".hero-actions .secondary-btn", html: true, ku: "<i class='fas fa-circle-play'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-circle-play'></i> Online lessons" },
    { selector: ".principal-content .section-title", html: true, ku: "<i class='fas fa-user-tie'></i> پەیامی بەڕێوەبەر", en: "<i class='fas fa-user-tie'></i> Principal's message" },
    { selector: ".principal-content p:nth-of-type(1)", ku: "بەخێرهاتن بۆ ئامادەیی پیشەیی سیڤەر. ئامانجی ئێمە تەنها فێربوونی زانیاری نییە، بەڵکو دروستکردنی کادیرێکی توانا و سەربەخۆیە کە بتوانێت لە بازاڕی کاردا بە شێوەیەکی کاریگەر بەشداری بکات.", en: "Welcome to Sivar Vocational High School. Our goal is not only to teach knowledge, but also to build confident and capable graduates who can contribute effectively in the job market." },
    { selector: ".principal-content p:nth-of-type(2)", ku: "هەوڵ دەدەین ژینگەیەکی ئەکادیمی سەردەمی و پڕ لە پەرەپێدان بۆ خوێندکاران دابین بکەین، بۆ ئەوەی داهاتوویەکی سەقامگیر بۆ خۆیان دروست بکەن.", en: "We strive to provide a modern academic environment full of growth, so our students can build a strong and stable future for themselves." },
    { selector: ".principal-name", ku: "— بەڕێوەبەری گشتی، شێروان جەبار حاجی", en: "— General Principal, Sherwan Jabar Haji" },
    { selector: "#announcements .section-title", html: true, ku: "<i class='fas fa-bullhorn'></i> ڕاگەیاندنەکان", en: "<i class='fas fa-bullhorn'></i> Announcements" },
    { selector: "#announcements .outline-btn", html: true, ku: "<i class='fas fa-chalkboard-user'></i> چوونە ناو داشبۆرد", en: "<i class='fas fa-chalkboard-user'></i> Open dashboard" },
    { selector: "#announcements .section-subtitle", ku: "ڕاگەیاندنەکان و هەواڵی نوێ لێرە بە شێوەی ئۆتۆماتیکی نیشان دەدرێن.", en: "New announcements and updates will appear here automatically." },
    { selector: "main .section:nth-of-type(2) .section-title", html: true, ku: "<i class='fas fa-graduation-cap'></i> بەخێربێیت بۆ ئامادەیی پیشەیی سیڤەر", en: "<i class='fas fa-graduation-cap'></i> Welcome to Sivar Vocational High School" },
    { selector: ".welcome-quote", html: true, ku: "<i class='fas fa-quote-right'></i> ئامانجەکەت لە ئامادەیی پیشەیی سیڤەر بەدی بهێنە <i class='fas fa-quote-left'></i>", en: "<i class='fas fa-quote-right'></i> Reach your goals at Sivar Vocational High School <i class='fas fa-quote-left'></i>" },
    { selector: ".welcome-goals h3", html: true, ku: "<i class='fas fa-bullseye'></i> ئامانجەکانی ئێمە", en: "<i class='fas fa-bullseye'></i> Our goals" },
    { selector: ".welcome-goals li:nth-child(1)", html: true, ku: "<i class='fas fa-check-circle'></i> پەروەردەی کادیرێکی کاریگەر لە بواری تەکنەلۆژیای زانیاری", en: "<i class='fas fa-check-circle'></i> Train capable graduates in information technology" },
    { selector: ".welcome-goals li:nth-child(2)", html: true, ku: "<i class='fas fa-check-circle'></i> دابینکردنی سەرچاوەی نوێ بۆ خوێندکاران", en: "<i class='fas fa-check-circle'></i> Provide modern learning resources for students" },
    { selector: ".welcome-goals li:nth-child(3)", html: true, ku: "<i class='fas fa-check-circle'></i> پەیوەندی بە بازاڕی کارەوە لە ڕێگەی پراکتیک", en: "<i class='fas fa-check-circle'></i> Connect learning with the job market through practice" },
    { selector: ".welcome-goals li:nth-child(4)", html: true, ku: "<i class='fas fa-check-circle'></i> دابینکردنی ژینگەیەکی سەردەمی بۆ خوێندن", en: "<i class='fas fa-check-circle'></i> Create a modern and supportive learning environment" },
    { selector: "#departments .section-title", html: true, ku: "<i class='fas fa-book'></i> بەشەکانی ئامادەیی پیشەیی سیڤەر", en: "<i class='fas fa-book'></i> School departments" },
    { selector: "#departments .department-card:nth-child(1) h3", html: true, ku: "<i class='fas fa-code'></i> پڕۆگرامسازی", en: "<i class='fas fa-code'></i> Programming" },
    { selector: "#departments .department-card:nth-child(1) .muted", ku: "بەشی پڕۆگرامسازی پێک دێت لە خوێندنی پڕۆگرامسازی، داتابەیس، سیکیوریتی، و IT.", en: "The programming department focuses on software development, databases, security, and IT." },
    { selector: "#departments .department-card:nth-child(1) .dept-meta li:nth-child(1)", html: true, ku: "<i class='fas fa-check'></i> ماوەی خوێندن: ٣ ساڵ", en: "<i class='fas fa-check'></i> Study duration: 3 years" },
    { selector: "#departments .department-card:nth-child(1) .dept-meta li:nth-child(2)", html: true, ku: "<i class='fas fa-check'></i> بابەتەکان: ١٣ بابەت", en: "<i class='fas fa-check'></i> Subjects: 13" },
    { selector: "#departments .department-card:nth-child(1) .dept-meta li:nth-child(3)", html: true, ku: "<i class='fas fa-check'></i> ئاست: کادیری کارا", en: "<i class='fas fa-check'></i> Outcome: job-ready graduate" },
    { selector: "#departments .department-card:nth-child(2) h3", html: true, ku: "<i class='fas fa-paw'></i> ڤێتەرنەری", en: "<i class='fas fa-paw'></i> Veterinary" },
    { selector: "#departments .department-card:nth-child(2) .muted", ku: "بەشی ڤێتەرنەری پێک دێت لە توێکاری، نەخۆشییەکان، و پزیشکی ئاژەڵ.", en: "The veterinary department covers animal health, diseases, and practical veterinary care." },
    { selector: "#departments .department-card:nth-child(2) .dept-meta li:nth-child(1)", html: true, ku: "<i class='fas fa-check'></i> ماوەی خوێندن: ٣ ساڵ", en: "<i class='fas fa-check'></i> Study duration: 3 years" },
    { selector: "#departments .department-card:nth-child(2) .dept-meta li:nth-child(2)", html: true, ku: "<i class='fas fa-check'></i> بابەتەکان: ١٥ بابەت", en: "<i class='fas fa-check'></i> Subjects: 15" },
    { selector: "#departments .department-card:nth-child(2) .dept-meta li:nth-child(3)", html: true, ku: "<i class='fas fa-check'></i> ئاست: کادیری کارا", en: "<i class='fas fa-check'></i> Outcome: job-ready graduate" },
    { selector: "#departments .department-card:nth-child(3) h3", html: true, ku: "<i class='fas fa-building'></i> بیناسازی", en: "<i class='fas fa-building'></i> Architecture" },
    { selector: "#departments .department-card:nth-child(3) .muted", ku: "بەشی بیناسازی پێک دێت لە وێنە ئەندازەیی، لکاندن، و دیزاینی بینا.", en: "The architecture department focuses on drafting, planning, and building design." },
    { selector: "#departments .department-card:nth-child(3) .dept-meta li:nth-child(1)", html: true, ku: "<i class='fas fa-check'></i> ماوەی خوێندن: ٣ ساڵ", en: "<i class='fas fa-check'></i> Study duration: 3 years" },
    { selector: "#departments .department-card:nth-child(3) .dept-meta li:nth-child(2)", html: true, ku: "<i class='fas fa-check'></i> بابەتەکان: ١٠ بابەت", en: "<i class='fas fa-check'></i> Subjects: 10" },
    { selector: "#departments .department-card:nth-child(3) .dept-meta li:nth-child(3)", html: true, ku: "<i class='fas fa-check'></i> ئاست: کادیری کارا", en: "<i class='fas fa-check'></i> Outcome: job-ready graduate" },
    { selector: "#departments .department-btn span", ku: "زیاتر بزانە", en: "Learn more" },
    { selector: "#online-lessons .section-title", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: "#online-lessons .section-subtitle", ku: "ڤیدیۆی وانەکان لێرە بە شێوەی ئۆتۆماتیکی نیشان دەدرێن. مامۆستاکان دەتوانن لە داشبۆرددا وانەکان بەپێی بەش زیاد بکەن.", en: "Lesson videos appear here automatically. Teachers can add lessons from the dashboard by department." },
    { selector: "#media .section-title", html: true, ku: "<i class='fas fa-photo-video'></i> وێنە و ڤیدیۆ", en: "<i class='fas fa-photo-video'></i> Photos and videos" },
    { selector: "#media .section-subtitle", ku: "لێرە دەتوانی نموونەی میدیای ئامادەیی پیشەیی سیڤەر ببینی.", en: "Here you can view sample school media. For class videos, please use the online lessons section." },
    { selector: "#media .media-item:nth-child(1) h3", ku: "خوێندن لە ئامادەیەکەمان", en: "Learning at our school" },
    { selector: "#media .media-item:nth-child(1) p", ku: "خوێندکاران لە قوتابخانە لە کاتی وانەدا", en: "Students during an in-person lesson" },
    { selector: "#media .media-item:nth-child(2) h3", ku: "خوێندکاران وانە دەگرنەوە", en: "Students reviewing a lesson" },
    { selector: "#media .media-item:nth-child(2) p", ku: "خوێندکاران لە کاتی وانەگرتنەوەدا", en: "Students revising together" },
    { selector: "#media .media-item:nth-child(3) h3", ku: "مامۆستا وانە دەڵێت", en: "Teacher delivering a lesson" },
    { selector: "#media .media-item:nth-child(3) p", ku: "مامۆستایان لە کاتی وانەوتندا", en: "Teachers during classroom instruction" },
    { selector: "#media .auth-btn", html: true, ku: "<i class='fas fa-cloud-arrow-up'></i> بارکردنی میدیا", en: "<i class='fas fa-cloud-arrow-up'></i> Upload media" },
    { selector: "#comments .section-title", html: true, ku: "<i class='fas fa-comments'></i> کۆمێنتەکان", en: "<i class='fas fa-comments'></i> Comments" },
    { selector: ".comment-form h3", ku: "کۆمێنتێک بنووسە", en: "Write a comment" },
    { selector: "#commentText", attr: "placeholder", ku: "کۆمێنتەکەت لێرە بنووسە...", en: "Write your comment here..." },
    { selector: "#commentForm .auth-btn span", ku: "ناردنی کۆمێنت", en: "Send comment" },
    { selector: ".comments-title", ku: "کۆمێنتەکانی خەڵک", en: "Community comments" },
    { selector: "#about .section-title", html: true, ku: "<i class='fas fa-info-circle'></i> دەربارەی ئێمە", en: "<i class='fas fa-info-circle'></i> About us" },
    { selector: ".about-text > p:nth-of-type(1)", ku: "ئامادەیی پیشەیی سیڤەر لە ساڵی 2025 دامەزراوە، وەک دامەزراوەیەکی ئەکادیمی کە ئامانجمان پەرەپێدانی قوتابیانە، بە بنەمای زانستی و پێویستییە ڕاستەقینەکانی بازاڕی کار.", en: "Sivar Vocational High School was established in 2025 as an academic institution focused on student development through real-world, market-relevant education." },
    { selector: ".about-text > p:nth-of-type(2)", ku: "لە ئامادەیی پیشەیی سیڤەر تەنها فێربوونی زانیاری نییە، بەڵکو پڕۆسەیەکی بەردەوامە کە گەشەپێدانی بیرکردنەوەی ستراتیژی، ئەخلاقی کار و توانای گونجاندن لەگەڵ گۆڕانکارییەکانی ژینگەی کار لەخۆ دەگرێت.", en: "At Sivar, education is not only about knowledge. It is an ongoing process that develops strategic thinking, work ethics, and the ability to adapt to a changing professional environment." },
    { selector: ".about-highlights h3", html: true, ku: "<i class='fas fa-star'></i> پێشکەوتنەکانی ئێمە", en: "<i class='fas fa-star'></i> Our highlights" },
    { selector: ".highlight-card:nth-child(1) h4", html: true, ku: "<i class='fas fa-award'></i> خەڵاتەکان", en: "<i class='fas fa-award'></i> Awards" },
    { selector: ".highlight-card:nth-child(1) p", ku: "خەڵاتی باشترین پەیمانگای پێشەنگی لە هەرێمی کوردستان", en: "Recognized among the leading vocational schools in the Kurdistan Region" },
    { selector: ".highlight-card:nth-child(2) h4", html: true, ku: "<i class='fas fa-handshake'></i> هاوپەیمانییەکان", en: "<i class='fas fa-handshake'></i> Partnerships" },
    { selector: ".highlight-card:nth-child(2) p", ku: "هاوپەیمانی لەگەڵ ٢٠+ کۆمپانیای تەکنەلۆژیا", en: "Partnerships with 20+ technology companies" },
    { selector: ".highlight-card:nth-child(3) h4", html: true, ku: "<i class='fas fa-briefcase'></i> ڕێژەی کار", en: "<i class='fas fa-briefcase'></i> Employment rate" },
    { selector: ".highlight-card:nth-child(3) p", ku: "٨٥٪ی خوێندکاران دوای تەواوکردن کار دەکەنەوە", en: "85% of students move into work after graduation" },
    { selector: ".map-grid .section-title", html: true, ku: "<i class='fas fa-map-location-dot'></i> شوێنی ئامادەیی پیشەیی سیڤەر", en: "<i class='fas fa-map-location-dot'></i> School location" },
    { selector: "main .section:nth-last-of-type(1) .section-subtitle", ku: "ئەم نەخشە بەکاربهێنە بۆ گەیشتن بە ئامادەیی پیشەیی سیڤەر", en: "The map is placed near the bottom of the website so visitors can find the school easily." },
    { selector: ".map-info-row:nth-child(1) strong", ku: "ناونیشان", en: "Address" },
    { selector: ".map-info-row:nth-child(1) p", ku: "هەولێر - شەقامی ٦٠مەتری نزیک سوپەرمارکێتی نیوستی", en: "Sivar Vocational High School - Erbil, Kurdistan Region" },
    { selector: ".map-info-row:nth-child(2) strong", ku: "پەیوەندی", en: "Phone" },
    { selector: ".map-info-row:nth-child(3) strong", ku: "ئیمەیڵ", en: "Email" },
    { selector: ".map-details .primary-btn", html: true, ku: "<i class='fas fa-diamond-turn-right'></i> کردنەوەی نەخشە", en: "<i class='fas fa-diamond-turn-right'></i> Open map" },
    { selector: ".goals .section-title", html: true, ku: "<i class='fas fa-bullseye'></i> ئامانجەکانی ئامادەیی پیشەیی سیڤەر", en: "<i class='fas fa-bullseye'></i> Goals of Sivar Vocational High School" },
    { selector: ".goal-card:nth-child(1) span", ku: "هاندان بۆ دیاریکردنی ئامانجی پیشەیی", en: "Help students define their vocational goals" },
    { selector: ".goal-card:nth-child(2) span", ku: "ڕێنمایی لە پلاندانان و هەنگاوەکان", en: "Guide planning and next steps" },
    { selector: ".goal-card:nth-child(3) span", ku: "ئامادەبوون بۆ گونجاندن لەگەڵ بازاڕی کار", en: "Prepare students for the job market" },
    { selector: ".goal-card:nth-child(4) span", ku: "دروستکردنی هەڵوێستی پۆزەتیڤ", en: "Build a positive mindset" },
    { selector: ".goal-card:nth-child(5) span", ku: "بەشداری کارا لە تیم و کۆمەڵگا", en: "Encourage teamwork and community participation" },
    { selector: ".goal-card:nth-child(6) span", ku: "فێربوونی بەرپرسیارێتی", en: "Teach responsibility" },
    { selector: ".goal-card:nth-child(7) span", ku: "داهاتوویەکی سەقامگیر و توانا‌دار", en: "Build a strong and stable future" },
    { selector: "footer .footer-section:nth-child(1) h3", html: true, ku: "<i class='fas fa-graduation-cap'></i> ئامادەیی پیشەیی سیڤەر", en: "<i class='fas fa-graduation-cap'></i> Sivar Vocational High School" },
    { selector: "footer .footer-section:nth-child(1) p:nth-of-type(1)", ku: "لە سەرکەوتنەکانت مەترسە، تۆ لە ئامادەی سیڤەری.", en: "Shape your success at Sivar Vocational High School." },
    { selector: "footer .footer-section:nth-child(1) p:nth-of-type(2)", ku: "هەموو بابەتەکان بە زمانی کوردی و بە شێوەیەکی سادە و ڕوون ڕێکخراون.", en: "All school content is organized clearly and accessibly for students and families." },
    { selector: "footer .footer-section:nth-child(2) h3", html: true, ku: "<i class='fas fa-address-book'></i> پەیوەندی", en: "<i class='fas fa-address-book'></i> Contact" },
    { selector: "footer .footer-section:nth-child(3) h3", html: true, ku: "<i class='fas fa-link'></i> بەستەرە خێراکان", en: "<i class='fas fa-link'></i> Quick links" },
    { selector: "footer .footer-section:nth-child(3) a[href='#home']", html: true, ku: "<i class='fas fa-house'></i> سەرەتا", en: "<i class='fas fa-house'></i> Home" },
    { selector: "footer .footer-section:nth-child(3) a[href='#departments']", html: true, ku: "<i class='fas fa-book'></i> بەشەکان", en: "<i class='fas fa-book'></i> Departments" },
    { selector: "footer .footer-section:nth-child(3) a[href='#online-lessons']", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: "footer .footer-section:nth-child(3) a[href='#comments']", html: true, ku: "<i class='fas fa-comments'></i> کۆمێنت", en: "<i class='fas fa-comments'></i> Comments" },
    { selector: "footer .footer-section:nth-child(3) a[href='#about']", html: true, ku: "<i class='fas fa-circle-info'></i> دەربارە", en: "<i class='fas fa-circle-info'></i> About" },
    { selector: ".copyright p:nth-child(1)", ku: "© ٢٠٢٦ هەموو مافەکان پارێزراون بۆ ئامادەیی پیشەیی سیڤەر.", en: "© 2026 All rights reserved by Sivar Vocational High School." },
    { selector: ".copyright p:nth-child(2)", ku: "هەرێمی کوردستان - هەولێر", en: "Erbil - Kurdistan Region" }
  ],
  activities: [
    { selector: "title", ku: "وانە و چالاکییەکان - ئامادەیی پیشەیی سیڤەر", en: "Lessons and Activities - Sivar Vocational High School" },
    { selector: ".nav-list a[href='index.html']", html: true, ku: "<i class='fas fa-house'></i> سەرەکی", en: "<i class='fas fa-house'></i> Home" },
    { selector: ".nav-list a[href='activity-programming.html']", html: true, ku: "<i class='fas fa-code'></i> پڕۆگرامسازی", en: "<i class='fas fa-code'></i> Programming" },
    { selector: ".nav-list a[href='activity-architecture.html']", html: true, ku: "<i class='fas fa-building'></i> بیناسازی", en: "<i class='fas fa-building'></i> Architecture" },
    { selector: ".nav-list a[href='activity-veterinary.html']", html: true, ku: "<i class='fas fa-paw'></i> ڤێتەرنەری", en: "<i class='fas fa-paw'></i> Veterinary" },
    { selector: ".hero-content h1", ku: "وانە و چالاکییەکان", en: "Lessons and activities" },
    { selector: ".hero-content p", ku: "هەموو بەشەکان لە یەک شوێندا بۆ گەیشتن بە وانە و ڤیدیۆکان", en: "All departments in one place for easy access to lessons and videos." },
    { selector: ".section-title", html: true, ku: "<i class='fas fa-clapperboard'></i> بەشەکان هەڵبژێرە", en: "<i class='fas fa-clapperboard'></i> Choose a department" },
    { selector: ".quick-card:nth-child(1) h3", html: true, ku: "<i class='fas fa-code'></i> پڕۆگرامسازی", en: "<i class='fas fa-code'></i> Programming" },
    { selector: ".quick-card:nth-child(1) p", ku: "وانە و ڤیدیۆکانی پڕۆگرامسازی.", en: "Programming lessons and videos." },
    { selector: ".quick-card:nth-child(2) h3", html: true, ku: "<i class='fas fa-paw'></i> ڤێتەرنەری", en: "<i class='fas fa-paw'></i> Veterinary" },
    { selector: ".quick-card:nth-child(2) p", ku: "وانە و ڤیدیۆکانی ڤێتەرنەری.", en: "Veterinary lessons and videos." },
    { selector: ".quick-card:nth-child(3) h3", html: true, ku: "<i class='fas fa-building'></i> بیناسازی", en: "<i class='fas fa-building'></i> Architecture" },
    { selector: ".quick-card:nth-child(3) p", ku: "وانە و ڤیدیۆکانی بیناسازی.", en: "Architecture lessons and videos." }
  ],
  admissions: [
    { selector: "title", ku: "وەرگرتن و تۆمارکردن - ئامادەیی پیشەیی سیڤەر", en: "Admissions and Registration - Sivar Vocational High School" },
    { selector: ".nav-list a[href='index.html']", html: true, ku: "<i class='fas fa-house'></i> سەرەکی", en: "<i class='fas fa-house'></i> Home" },
    { selector: ".nav-list a[href='#requirements']", html: true, ku: "<i class='fas fa-file-lines'></i> مەرجەکان", en: "<i class='fas fa-file-lines'></i> Requirements" },
    { selector: ".nav-list a[href='#documents']", html: true, ku: "<i class='fas fa-folder-open'></i> بەڵگەنامەکان", en: "<i class='fas fa-folder-open'></i> Documents" },
    { selector: ".nav-list a[href='#steps']", html: true, ku: "<i class='fas fa-list-ol'></i> هەنگاوەکان", en: "<i class='fas fa-list-ol'></i> Steps" },
    { selector: ".header-actions .login-btn", html: true, ku: "<i class='fas fa-arrow-right'></i> گەڕانەوە", en: "<i class='fas fa-arrow-right'></i> Back" },
    { selector: ".hero-content h1", ku: "وەرگرتن و تۆمارکردن", en: "Admissions and registration" },
    { selector: ".hero-content p", ku: "زانیاری دەربارەی مەرجەکان و چۆنیەتی تۆمارکردن بۆ بەشەکانی قوتابخانە", en: "Information about the requirements and registration process for the school departments." },
    { selector: "#requirements .section-title", html: true, ku: "<i class='fas fa-file-lines'></i> مەرجەکانی وەرگرتن", en: "<i class='fas fa-file-lines'></i> Admission requirements" },
    { selector: "#requirements .info-card:nth-child(1) h3", ku: "بڕوانامەی پێشووتر", en: "Previous certificate" },
    { selector: "#requirements .info-card:nth-child(1) p", ku: "پێویستە خوێندکار بڕوانامەی قۆناغی پێشووتر هەبێت.", en: "Students must have the required certificate from the previous stage." },
    { selector: "#requirements .info-card:nth-child(2) h3", ku: "نمرەی وەرگرتن", en: "Admission score" },
    { selector: "#requirements .info-card:nth-child(2) p", ku: "پێویستە نمرەی گونجاو بەپێی بەشەکە بێت.", en: "Students should meet the required score for their chosen department." },
    { selector: "#requirements .info-card:nth-child(3) h3", ku: "ناسنامە", en: "Identification" },
    { selector: "#requirements .info-card:nth-child(3) p", ku: "وێنەی ناسنامە و بەڵگەنامەی کەسی پێویستە.", en: "A copy of an ID card and personal documents is required." },
    { selector: "#documents .section-title", html: true, ku: "<i class='fas fa-folder-open'></i> بەڵگەنامە پێویستەکان", en: "<i class='fas fa-folder-open'></i> Required documents" },
    { selector: "#documents li:nth-child(1)", html: true, ku: "<i class='fas fa-check'></i> وێنەی 4x3", en: "<i class='fas fa-check'></i> 4x3 photo" },
    { selector: "#documents li:nth-child(2)", html: true, ku: "<i class='fas fa-check'></i> بڕوانامەی پێشووتر", en: "<i class='fas fa-check'></i> Previous certificate" },
    { selector: "#documents li:nth-child(3)", html: true, ku: "<i class='fas fa-check'></i> ناسنامە", en: "<i class='fas fa-check'></i> ID card" },
    { selector: "#documents li:nth-child(4)", html: true, ku: "<i class='fas fa-check'></i> فۆرمی تۆمارکردن", en: "<i class='fas fa-check'></i> Registration form" },
    { selector: "#steps .section-title", html: true, ku: "<i class='fas fa-list-ol'></i> چۆنیەتی تۆمارکردن", en: "<i class='fas fa-list-ol'></i> How to register" },
    { selector: "#steps .step-card:nth-child(1) p", ku: "پڕکردنەوەی فۆرمی ئۆنلاین", en: "Fill out the online form" },
    { selector: "#steps .step-card:nth-child(2) p", ku: "ناردنی بەڵگەنامەکان", en: "Submit the required documents" },
    { selector: "#steps .step-card:nth-child(3) p", ku: "چاوپێکەوتن (ئەگەر پێویست بوو)", en: "Interview (if required)" },
    { selector: "#steps .step-card:nth-child(4) p", ku: "وەرگرتنی پەسەندکردن", en: "Receive admission approval" },
    { selector: "#steps .hero-btn", html: true, ku: "<i class='fas fa-paper-plane'></i> پەیوەندی بکە بۆ تۆمارکردن", en: "<i class='fas fa-paper-plane'></i> Contact us to register" }
  ],
  login: [
    { selector: "title", ku: "چوونەژورەوەی داشبۆرد - ئامادەیی پیشەیی سیڤەر", en: "Dashboard Login - Sivar Vocational High School" },
    { selector: ".login-container h2", ku: "چوونەژورەوەی داشبۆرد", en: "Dashboard login" },
    { selector: ".login-container > p", html: true, ku: "ئەم پەڕەیە بۆ ئەدمین و مامۆستایانە. ئەگەر مامۆستایت، پێویستە ئەدمین ڕۆڵی تۆ بکات بە <strong>teacher</strong>.", en: "This page is for admins and teachers. If you are a teacher, an admin must first set your role to <strong>teacher</strong>." },
    { selector: "#adminEmail", attr: "placeholder", ku: "ئیمەیڵ", en: "Email" },
    { selector: "#adminPassword", attr: "placeholder", ku: "وشەی نهێنی", en: "Password" },
    { selector: "#accessLoginBtn", html: true, ku: "<i class='fas fa-right-to-bracket'></i> چوونەژورەوە", en: "<i class='fas fa-right-to-bracket'></i> Login" },
    { selector: ".center .outline-btn", html: true, ku: "<i class='fas fa-arrow-right'></i> گەڕانەوە بۆ سەرەکی", en: "<i class='fas fa-arrow-right'></i> Back to home" }
  ],
  admin: [
    { selector: "title", ku: "داشبۆردی قوتابخانە - ئامادەیی پیشەیی سیڤەر", en: "School Dashboard - Sivar Vocational High School" },
    { selector: ".admin-header h1", ku: "داشبۆردی قوتابخانە", en: "School dashboard" },
    { selector: ".admin-header .muted", html: true, ku: "ڕۆڵی ئێستات: <strong id='dashboardRoleBadge'>...</strong>", en: "Your current role: <strong id='dashboardRoleBadge'>...</strong>" },
    { selector: ".admin-inline-actions .outline-btn", html: true, ku: "<i class='fas fa-house'></i> سەرەکی", en: "<i class='fas fa-house'></i> Home" },
    { selector: "#logoutAdmin", html: true, ku: "<i class='fas fa-right-from-bracket'></i> چوونە دەرەوە", en: "<i class='fas fa-right-from-bracket'></i> Logout" },

    { selector: ".dashboard-stat:nth-child(1) .dashboard-stat-label", ku: "وانەکان", en: "Lessons" },
    { selector: ".dashboard-stat:nth-child(2) .dashboard-stat-label", ku: "ڕاگەیاندنەکان", en: "Announcements" },
    { selector: ".dashboard-stat:nth-child(3) .dashboard-stat-label", ku: "کۆمێنتەکان", en: "Comments" },
    { selector: ".dashboard-stat:nth-child(4) .dashboard-stat-label", ku: "ڕۆڵی ئێستا", en: "Current role" },
    { selector: ".admin-card:nth-of-type(1) h2", ku: "ڕێنمایی خێرا", en: "Quick guide" },
    { selector: ".admin-card:nth-of-type(1) .dashboard-note", ku: "١. مامۆستا یان ئەدمین لە پەڕەی login.html چوونەژورەوە دەکات. ٢. وانەکە بە هەڵبژاردنی بەش، ناونیشان، بابەت و ڤیدیۆ زیاد دەکات. ٣. وانەکە خۆکارانە لە پەڕەی هەمان بەشدا نیشان دەدرێت.", en: "1. A teacher or admin signs in from login.html. 2. Add the lesson by choosing a department, title, subject, and video. 3. The lesson appears automatically on the matching department page." },
    { selector: ".admin-card:nth-of-type(2) h2", ku: "زیادکردنی وانە ئۆنلاین", en: "Add online lesson" },
    { selector: ".admin-card:nth-of-type(2) .muted", ku: "ئەم فۆرمە بۆ بارکردنی ڤیدیۆی وانەکانە بۆ هەر یەکێک لە سێ بەشەکە.", en: "Use this form to upload lesson videos for any of the three departments." },
    { selector: "label[for='lessonDepartment']", ku: "بەش", en: "Department" },
    { selector: "#lessonDepartment option[value='']", ku: "بەش هەڵبژێرە", en: "Choose department" },
    { selector: "#lessonDepartment option[value='programming']", ku: "پڕۆگرامسازی", en: "Programming" },
    { selector: "#lessonDepartment option[value='architecture']", ku: "بیناسازی", en: "Architecture" },
    { selector: "#lessonDepartment option[value='veterinary']", ku: "ڤێتەرنەری", en: "Veterinary" },
    { selector: "label[for='lessonTitle']", ku: "ناونیشانی وانە", en: "Lesson title" },
    { selector: "#lessonTitle", attr: "placeholder", ku: "نموونە: وانەی یەکەم - HTML", en: "Example: Lesson 1 - HTML" },
    { selector: "label[for='lessonTeacher']", ku: "ناوی مامۆستا", en: "Teacher name" },
    { selector: "#lessonTeacher", attr: "placeholder", ku: "ناوی مامۆستا", en: "Teacher name" },
    { selector: "label[for='lessonSubject']", ku: "بابەت", en: "Subject" },
    { selector: "#lessonSubject", attr: "placeholder", ku: "نموونە: Web Design", en: "Example: Web Design" },
    { selector: "label[for='lessonDescription']", ku: "کورتە دەربارەی وانە", en: "Short lesson description" },
    { selector: "#lessonDescription", attr: "placeholder", ku: "کورتە باسێک لەسەر ناوەڕۆکی وانەکە...", en: "A short summary of the lesson content..." },
    { selector: "label[for='lessonVideo']", ku: "ڤیدیۆی وانە", en: "Lesson video file" },
    { selector: ".file-note", ku: "باشترە ناوی وانەکە ڕوون بێت. وەک: lesson-1-html.mp4 یان lesson-1.mov", en: "Use a clear file name, for example: lesson-1-html.mp4 or lesson-1.mov" },
    { selector: "label[for='lessonVideoUrl']", ku: "بەستەری ڤیدیۆ (هەڵبژاردەی دووەم)", en: "Video link (optional fallback)" },
    { selector: "#lessonVideoUrl", attr: "placeholder", ku: "https://example.com/lesson.mp4", en: "https://example.com/lesson.mp4" },
    { selector: "#lessonUploadStatus", ku: "دەتوانیت فایل باربکەیت یان ئەگەر پێویست بوو بەستەری ڤیدیۆ بنێریت.", en: "You can upload a file or, if needed, provide a direct video URL." },
    { selector: "#postLessonBtn", html: true, ku: "<i class='fas fa-cloud-arrow-up'></i> بارکردنی وانە", en: "<i class='fas fa-cloud-arrow-up'></i> Upload lesson" },
    { selector: ".admin-card:nth-of-type(3) h2", ku: "وانە بارکراوەکان", en: "Uploaded lessons" },
    { selector: ".admin-card:nth-of-type(3) .muted", ku: "لێرە دەتوانیت هەموو وانە بارکراوەکان ببینیت و ئەگەر پێویست بوو بسڕیتەوە.", en: "Review all uploaded lessons here and remove them if necessary." },
    { selector: ".admin-card:nth-of-type(4) h2", ku: "ڕاگەیاندن", en: "Announcements" },
    { selector: "label[for='announcementText']", ku: "دەقی ڕاگەیاندن", en: "Announcement text" },
    { selector: "#announcementText", attr: "placeholder", ku: "نووسینی ڕاگەیاندن...", en: "Write the announcement..." },
    { selector: "label[for='announcementImage']", ku: "وێنەی ڕاگەیاندن", en: "Announcement image" },
    { selector: "#postAnnouncementBtn", html: true, ku: "<i class='fas fa-paper-plane'></i> ناردن", en: "<i class='fas fa-paper-plane'></i> Post" },
    { selector: "[data-admin-only] h2", ku: "بەڕێوەبردنی ڕۆڵەکان", en: "Manage roles" },
    { selector: "[data-admin-only] .muted", ku: "ئەم بەشە تەنها بۆ ئەدمینە. مامۆستا سەرەتا تۆمار دەکات، پاشان ئەدمین دەتوانێت ڕۆڵی بکات بە teacher.", en: "This section is for admins only. Teachers register first, then an admin can change their role to teacher." },
    { selector: "label[for='roleEmail']", ku: "ئیمەیڵی بەکارهێنەر", en: "User email" },
    { selector: "#roleEmail", attr: "placeholder", ku: "teacher@example.com", en: "teacher@example.com" },
    { selector: "label[for='roleSelect']", ku: "ڕۆڵ", en: "Role" },
    { selector: "#roleUpdateBtn", html: true, ku: "<i class='fas fa-user-shield'></i> نوێکردنەوەی ڕۆڵ", en: "<i class='fas fa-user-shield'></i> Update role" },
    { selector: ".admin-card:last-child h2", ku: "کۆمێنتەکان", en: "Comments" }
  ],
  "department-programming": [
    { selector: "title", ku: "بەشی پڕۆگرامسازی - ئامادەیی پیشەیی سیڤەر", en: "Programming Department - Sivar Vocational High School" },
    { selector: ".nav-list a[href='index.html']", html: true, ku: "<i class='fas fa-house'></i> سەرەکی", en: "<i class='fas fa-house'></i> Home" },
    { selector: ".nav-list a[href='#about-dept']", html: true, ku: "<i class='fas fa-circle-info'></i> دەربارەی بەش", en: "<i class='fas fa-circle-info'></i> About department" },
    { selector: ".nav-list a[href='#online-lessons']", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: ".nav-list a[href='#teachers']", html: true, ku: "<i class='fas fa-chalkboard-teacher'></i> مامۆستاکان", en: "<i class='fas fa-chalkboard-teacher'></i> Teachers" },
    { selector: ".header-actions .login-btn", html: true, ku: "<i class='fas fa-chalkboard-user'></i> داشبۆرد", en: "<i class='fas fa-chalkboard-user'></i> Dashboard" },
    { selector: ".hero-content h1", ku: "بەشی پڕۆگرامسازی", en: "Programming department" },
    { selector: ".hero-content p", ku: "پەروەردەی شارەزایانی تەکنەلۆژیا و داهێنان، هەروەها بەردەستکردنی وانە ئۆنلاین بۆ هەموو بابەتەکان", en: "A department for future technology creators, with online lessons available for every core subject." },
    { selector: ".hero-actions .hero-btn", html: true, ku: "<i class='fas fa-circle-play'></i> بینینی وانەکان", en: "<i class='fas fa-circle-play'></i> View lessons" },
    { selector: ".hero-actions .secondary-btn", html: true, ku: "<i class='fas fa-cloud-arrow-up'></i> بارکردنی وانە", en: "<i class='fas fa-cloud-arrow-up'></i> Upload lesson" },
    { selector: "#about-dept .section-title", html: true, ku: "<i class='fas fa-code'></i> دەربارەی بەش", en: "<i class='fas fa-code'></i> About the department" },
    { selector: "#about-dept .section-subtitle", ku: "ئەم بەشە بۆ ئەو خوێندکارانەیە کە دەتەوێن ببن بە پڕۆگرامساز و لەسەر وێب، مۆبایل، داتابەیس و سیکیوریتی کار بکەن.", en: "This department is designed for students who want to become programmers and work on web, mobile, databases, and security." },
    { selector: "#online-lessons .section-title", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکانی پڕۆگرامسازی", en: "<i class='fas fa-video'></i> Programming online lessons" },
    { selector: "#online-lessons .outline-btn", html: true, ku: "<i class='fas fa-arrow-up-from-bracket'></i> چوونە ناو داشبۆرد", en: "<i class='fas fa-arrow-up-from-bracket'></i> Open dashboard" },
    { selector: "#online-lessons .section-subtitle", ku: "هەر وانەیەک کە لە داشبۆرد زیاد بکرێت، لێرە خۆکارانە دەردەکەوێت. تکایە وانەکان بە ناونیشان و بابەتێکی ڕوون زیاد بکەن.", en: "Every lesson added from the dashboard appears here automatically. Please use clear titles and subjects for each lesson." },
    { selector: "#teachers .section-title", html: true, ku: "<i class='fas fa-chalkboard-teacher'></i> مامۆستایانی بەش", en: "<i class='fas fa-chalkboard-teacher'></i> Department teachers" },
    { selector: "#teachers .department-btn span", ku: "گەڕانەوە بۆ سەرەکی", en: "Back to home" }
  ],
  "department-architecture": [
    { selector: "title", ku: "بەشی بیناسازی - ئامادەیی پیشەیی سیڤەر", en: "Architecture Department - Sivar Vocational High School" },
    { selector: ".hero-content h1", ku: "بەشی بیناسازی", en: "Architecture department" },
    { selector: ".hero-content p", ku: "فێربوونی دیزاین، پلانکردن و دروستکردنی پڕۆژەی بیناسازی، هەروەها بەردەستکردنی وانە ئۆنلاین", en: "Study design, planning, and architectural projects with online lessons available for every subject." },
    { selector: "#about-dept .section-title", html: true, ku: "<i class='fas fa-building'></i> دەربارەی بەش", en: "<i class='fas fa-building'></i> About the department" },
    { selector: "#about-dept .section-subtitle", ku: "ئەم بەشە بۆ فێربوونی دیزاین، پلانکردن، و وێنە ئەندازەیی و دروستکردنی پڕۆژەی بیناسازییە.", en: "This department focuses on design, planning, drafting, and architectural project work." },
    { selector: "#online-lessons .section-title", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکانی بیناسازی", en: "<i class='fas fa-video'></i> Architecture online lessons" },
    { selector: "#teachers .section-title", html: true, ku: "<i class='fas fa-chalkboard-teacher'></i> مامۆستایانی بەش", en: "<i class='fas fa-chalkboard-teacher'></i> Department teachers" },
    { selector: "#teachers .department-btn span", ku: "گەڕانەوە بۆ سەرەکی", en: "Back to home" }
  ],
  "department-veterinary": [
    { selector: "title", ku: "بەشی ڤێتەرنەری - ئامادەیی پیشەیی سیڤەر", en: "Veterinary Department - Sivar Vocational High School" },
    { selector: ".hero-content h1", ku: "بەشی ڤێتەرنەری", en: "Veterinary department" },
    { selector: ".hero-content p", ku: "پزیشکی ئاژەڵ و پاراستنی تەندروستیان، هەروەها بەردەستکردنی وانە ئۆنلاین", en: "Learn animal health and veterinary care with online lessons available across the department." },
    { selector: "#about-dept .section-title", html: true, ku: "<i class='fas fa-paw'></i> دەربارەی بەش", en: "<i class='fas fa-paw'></i> About the department" },
    { selector: "#about-dept .section-subtitle", ku: "ئەم بەشە پەیوەندیدارە بە پزیشکی ئاژەڵ، توێکاری و پاراستنی تەندروستی ئاژەڵان.", en: "This department focuses on animal medicine, diagnosis, and animal health care." },
    { selector: "#online-lessons .section-title", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکانی ڤێتەرنەری", en: "<i class='fas fa-video'></i> Veterinary online lessons" },
    { selector: "#teachers .section-title", html: true, ku: "<i class='fas fa-chalkboard-teacher'></i> مامۆستایانی بەش", en: "<i class='fas fa-chalkboard-teacher'></i> Department teachers" },
    { selector: "#teachers .department-btn span", ku: "گەڕانەوە بۆ سەرەکی", en: "Back to home" }
  ],
  "activity-programming": [
    { selector: "title", ku: "وانە و چالاکییەکانی پڕۆگرامسازی - ئامادەیی پیشەیی سیڤەر", en: "Programming Lessons and Activities - Sivar Vocational High School" },
    { selector: ".nav-list a[href='activities.html']", html: true, ku: "<i class='fas fa-arrow-right'></i> گەڕانەوە", en: "<i class='fas fa-arrow-right'></i> Back" },
    { selector: ".hero-content h1", ku: "وانە و چالاکییەکانی پڕۆگرامسازی", en: "Programming lessons and activities" },
    { selector: ".hero-content p", ku: "هەموو ڤیدیۆ و وانەکان بۆ بەشی پڕۆگرامسازی", en: "All videos and lessons for the programming department." },
    { selector: "main .section:nth-child(1) .section-title", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: "main .section:nth-child(2) .section-title", html: true, ku: "<i class='fas fa-star'></i> نموونەی چالاکی", en: "<i class='fas fa-star'></i> Sample activity" },
    { selector: ".video-card p", ku: "چالاکی یەکەم", en: "Activity one" }
  ],
  "activity-architecture": [
    { selector: "title", ku: "وانە و چالاکییەکانی بیناسازی - ئامادەیی پیشەیی سیڤەر", en: "Architecture Lessons and Activities - Sivar Vocational High School" },
    { selector: ".nav-list a[href='activities.html']", html: true, ku: "<i class='fas fa-arrow-right'></i> گەڕانەوە", en: "<i class='fas fa-arrow-right'></i> Back" },
    { selector: ".hero-content h1", ku: "وانە و چالاکییەکانی بیناسازی", en: "Architecture lessons and activities" },
    { selector: ".hero-content p", ku: "هەموو ڤیدیۆ و وانەکان بۆ بەشی بیناسازی", en: "All videos and lessons for the architecture department." },
    { selector: "main .section:nth-child(1) .section-title", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: "main .section:nth-child(2) .section-title", html: true, ku: "<i class='fas fa-star'></i> نموونەی چالاکی", en: "<i class='fas fa-star'></i> Sample activity" },
    { selector: ".video-card p", ku: "چالاکی یەکەم", en: "Activity one" }
  ],
  "activity-veterinary": [
    { selector: "title", ku: "وانە و چالاکییەکانی ڤێتەرنەری - ئامادەیی پیشەیی سیڤەر", en: "Veterinary Lessons and Activities - Sivar Vocational High School" },
    { selector: ".nav-list a[href='activities.html']", html: true, ku: "<i class='fas fa-arrow-right'></i> گەڕانەوە", en: "<i class='fas fa-arrow-right'></i> Back" },
    { selector: ".hero-content h1", ku: "وانە و چالاکییەکانی ڤێتەرنەری", en: "Veterinary lessons and activities" },
    { selector: ".hero-content p", ku: "هەموو ڤیدیۆ و وانەکان بۆ بەشی ڤێتەرنەری", en: "All videos and lessons for the veterinary department." },
    { selector: "main .section:nth-child(1) .section-title", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: "main .section:nth-child(2) .section-title", html: true, ku: "<i class='fas fa-star'></i> نموونەی چالاکی", en: "<i class='fas fa-star'></i> Sample activity" },
    { selector: ".video-card p", ku: "چالاکی یەکەم", en: "Activity one" }
  ]
};

function applyTranslations() {
  const pageKey = document.body?.dataset.page || "index";
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "en" ? "ltr" : "rtl";
  document.body?.classList.toggle("lang-en", currentLang === "en");
  document.body?.classList.toggle("lang-ku", currentLang !== "en");
  (pageTranslations.common || []).forEach(applyRule);
  (pageTranslations[pageKey] || []).forEach(applyRule);
  const heroTitle = qs("#heroTitle");
  if (heroTitle) heroTitle.setAttribute("data-text", currentLang === "en" ? "Sivar Vocational High School" : "ئامادەیی پیشەیی سیڤەر");
  updateLangButtonsUI();
}

function initLanguageSystem() {
  currentLang = "ku";
  localStorage.setItem("sivar_lang", "ku");
  qsa(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextLang = btn.getAttribute("data-lang") === "en" ? "en" : "ku";
      if (nextLang === currentLang) return;
      currentLang = nextLang;
      localStorage.setItem("sivar_lang", currentLang);
      applyTranslations();
      if (qs("#announcementPublicList")) loadPublicAnnouncements();
      if (qs("#commentsList")) loadComments();
      if (qs("#departmentLessonsList")) loadDepartmentLessons();
      if (qs("#lessonAdminList")) loadAdminLessons();
      if (qs("#announcementList")) loadAdminAnnouncements();
      if (qs("#adminCommentsList")) loadAdminComments();
      if (qs("#heroTitle")) initHeroTyping();
      if (auth?.currentUser) {
        ensureUserProfile(auth.currentUser)
          .then((userData) => applyUserDataToUI(auth.currentUser, userData))
          .catch(() => applyUserDataToUI(auth.currentUser, null));
      } else {
        applyUserDataToUI(null, null);
      }
    });
  });
  applyTranslations();
}

function mapDepartmentName(value) {
  if (value === "programming") return currentLang === "en" ? "Programming" : "پڕۆگرامسازی";
  if (value === "architecture") return currentLang === "en" ? "Architecture" : "بیناسازی";
  if (value === "veterinary") return currentLang === "en" ? "Veterinary" : "ڤێتەرنەری";
  return value;
}

function formatRelativeTime(date) {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return t("now");
  if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t("mins_ago")}`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t("hours_ago")}`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} ${t("days_ago")}`;
  return date.toLocaleDateString(currentLang === "en" ? "en-US" : "ar-IQ");
}

function renderEmptyState(message) {
  return `
    <div class="empty-state">
      <i class="fas fa-inbox" style="font-size:34px; margin-bottom:12px; color:#2f7cf6;"></i>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function buildUserMenu() {
  return `
    <div class="user-menu-item" data-action="profile"><i class="fas fa-user"></i><span>${t("profile_text")}</span></div>
    <div class="user-menu-item" data-action="dashboard"><i class="fas fa-chalkboard-user"></i><span>${t("dashboard_text")}</span></div>
    <div class="user-menu-item" data-action="logout" style="color:#c53a3a;"><i class="fas fa-right-from-bracket"></i><span>${t("logout_text")}</span></div>
  `;
}

function applyUserDataToUI(user, userData) {
  const desktopProfile = qs("#userProfile");
  const mobileProfile = qs("#userProfileMobile");
  const loginButton = qs("#loginButton");
  const roleText = userData?.role === "admin" ? t("role_admin") : userData?.role === "teacher" ? t("role_teacher") : t("role_student");
  const nameText = user?.displayName || userData?.name || (currentLang === "en" ? "User" : "بەکارهێنەر");
  const avatarUrl = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameText)}&background=1e4ea8&color=fff&size=160`;

  if (desktopProfile) desktopProfile.style.display = user && window.innerWidth > 992 ? "flex" : "none";
  if (mobileProfile) mobileProfile.style.display = user && window.innerWidth <= 992 ? "flex" : "none";
  if (loginButton) loginButton.style.display = user ? "none" : "inline-flex";

  [
    ["#userDisplayName", nameText], ["#userRole", roleText], ["#userAvatar", avatarUrl, true],
    ["#userDisplayNameMobile", nameText], ["#userRoleMobile", roleText], ["#userAvatarMobile", avatarUrl, true]
  ].forEach(([selector, value, isSrc]) => {
    const el = qs(selector);
    if (!el) return;
    if (isSrc) el.src = value;
    else el.textContent = value;
  });
}

function setDashboardRoleState(role) {
  currentDashboardRole = role;
  const roleBox = qs("#dashboardRoleBadge");
  const roleLabel = role === "admin" ? t("role_admin") : role === "teacher" ? t("role_teacher") : (currentLang === "en" ? "Unknown" : "نەناسراو");
  if (roleBox) {
    roleBox.textContent = roleLabel;
  }
  updateDashboardStat("statRoleValue", roleLabel);
  qsa("[data-admin-only]").forEach((block) => block.classList.toggle("hidden", role !== "admin"));
}

function setLessonUploadStatus(message, type = "info") {
  const target = qs("#lessonUploadStatus");
  if (!target) return;
  target.textContent = message;
  target.style.color = type === "error" ? "#c53a3a" : type === "success" ? "#148a4b" : "var(--muted)";
}

function updateDashboardStat(id, value) {
  const target = qs(`#${id}`);
  if (!target) return;
  target.textContent = String(value);
}

async function uploadLessonVideo(file, department) {
  if (!storage) throw new Error("storage-unavailable");
  const safeName = sanitizeFilename(file.name || "lesson-video.mp4");
  const path = `lessons/${department}/${Date.now()}-${safeName}`;
  const ref = storage.ref(path);

  return await new Promise((resolve, reject) => {
    const task = ref.put(file, { contentType: file.type || "video/mp4" });
    task.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
        setLessonUploadStatus(`${t("lesson_upload_progress")}: ${progress}%`, "info");
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await task.snapshot.ref.getDownloadURL();
          resolve({ url, path });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

async function postLesson(event) {
  event?.preventDefault();
  if (!db || !auth) return showNotification(t("not_ready"), "error");
  const user = auth.currentUser;
  if (!user) return showNotification(t("need_login"), "error");

  const department = qs("#lessonDepartment")?.value || "";
  const title = qs("#lessonTitle")?.value.trim() || "";
  const teacher = qs("#lessonTeacher")?.value.trim() || user.displayName || "";
  const subject = qs("#lessonSubject")?.value.trim() || "";
  const description = qs("#lessonDescription")?.value.trim() || "";
  const videoFile = qs("#lessonVideo")?.files?.[0] || null;
  const videoUrlInput = qs("#lessonVideoUrl")?.value.trim() || "";

  if (!department || !title || !teacher || !subject || (!videoFile && !videoUrlInput)) {
    showNotification(t("lesson_missing"), "error");
    return;
  }

  const btn = qs("#postLessonBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';
  setLessonUploadStatus(videoFile ? t("lesson_uploading") : t("lesson_url_mode"), "info");

  try {
    let finalUrl = videoUrlInput;
    let storagePath = "";

    if (videoFile) {
      const uploaded = await uploadLessonVideo(videoFile, department);
      finalUrl = uploaded.url;
      storagePath = uploaded.path;
      setLessonUploadStatus(t("lesson_processing"), "info");
    } else if (!/^https?:\/\//i.test(finalUrl)) {
      throw new Error("invalid-video-link");
    }

    await db.collection("lessons").add({
      department,
      title,
      teacher,
      subject,
      description,
      videoUrl: finalUrl,
      storagePath,
      uploadedBy: user.uid,
      uploadedByName: user.displayName || teacher,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    qs("#lessonForm")?.reset();
    setLessonUploadStatus(t("lesson_upload_done"), "success");
    showNotification(t("lesson_posted"));
  } catch (error) {
    console.error("Lesson upload error:", error);
    let message = currentLang === "en" ? "There was a problem uploading the lesson." : "هەڵە لە بارکردنی وانەکە.";
    if (error.code === "storage/unauthorized") message = currentLang === "en" ? "Storage rules rejected the upload. Check your Firebase Storage rules." : "یاساکانی Firebase Storage بارکردنەکە ڕەت کرد. تکایە rules ـەکان بپشکنە.";
    if (error.code === "storage/canceled") message = currentLang === "en" ? "The upload was canceled." : "بارکردنەکە وەستێنرا.";
    if (error.code === "storage/unknown") message = currentLang === "en" ? "Unknown storage error. Check the selected bucket and storage rules." : "هەڵەی نەناسراوی storage. storage bucket و rules بپشکنە.";
    if (String(error.message || "") === "invalid-video-link") message = t("invalid_video_link");
    setLessonUploadStatus(message, "error");
    showNotification(message, "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

function renderLessonCard(data, options = {}) {
  const createdAt = data.createdAt?.toDate?.();
  const showDelete = options.showDelete === true;
  const lessonId = options.lessonId || "";
  const openUrl = String(data.videoUrl || '').trim();
  const compactMedia = options.compactMedia === true;
  return `
    <article class="lesson-card${compactMedia ? ' compact-media' : ''}">
      <div class="lesson-card-media">
        ${renderLessonMedia(data, options)}
      </div>
      <div class="lesson-card-body">
        <div>
          <h3>${escapeHtml(data.title || (currentLang === "en" ? "Lesson" : "وانە"))}</h3>
          ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ""}
          <div class="lesson-meta">
            <span class="lesson-badge"><i class="fas fa-book"></i>${t("badge_subject")}: ${escapeHtml(data.subject || t("badge_subject"))}</span>
            <span class="lesson-badge"><i class="fas fa-user"></i>${t("badge_teacher")}: ${escapeHtml(data.teacher || t("badge_teacher"))}</span>
            <span class="lesson-badge"><i class="fas fa-building"></i>${t("badge_department")}: ${escapeHtml(mapDepartmentName(data.department || ""))}</span>
          </div>
        </div>
        <div class="lesson-card-footer">
          <div class="lesson-date">${createdAt ? formatRelativeTime(createdAt) : ""}</div>
          <div class="lesson-card-actions">
            ${openUrl ? `<a class="outline-btn small" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-up-right-from-square"></i> ${currentLang === 'en' ? 'Open' : 'کردنەوە'}</a>` : ""}
            ${showDelete ? `<button class="danger-btn" data-delete-lesson="${lessonId}"><i class="fas fa-trash"></i> ${t("delete_text")}</button>` : ""}
          </div>
        </div>
      </div>
    </article>
  `;
}

function loadDepartmentLessons() {
  if (!db) return;
  const container = qs("#departmentLessonsList");
  if (!container) return;
  const department = container.getAttribute("data-department") || document.body?.dataset.department || "";
  if (!department) return;
  if (departmentLessonsUnsubscribe) departmentLessonsUnsubscribe();
  departmentLessonsUnsubscribe = db.collection("lessons").where("department", "==", department).onSnapshot(
    (snapshot) => {
      const lessons = snapshot.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
          return bTime - aTime;
        });
      if (!lessons.length) {
        container.innerHTML = renderEmptyState(t("empty_lessons"));
        return;
      }
      container.innerHTML = lessons.map((lesson) => renderLessonCard(lesson, { compactMedia: true })).join("");
    },
    () => {
      container.innerHTML = renderEmptyState(currentLang === "en" ? "Unable to load lessons." : "نەتوانرا وانەکان باربکرێن.");
    }
  );
}

function loadAdminLessons() {
  if (!db) return;
  const container = qs("#lessonAdminList");
  if (!container) return;
  if (adminLessonsUnsubscribe) adminLessonsUnsubscribe();
  adminLessonsUnsubscribe = db.collection("lessons").orderBy("createdAt", "desc").limit(60).onSnapshot((snapshot) => {
    updateDashboardStat("statLessonsCount", snapshot.size);
    if (snapshot.empty) {
      container.innerHTML = renderEmptyState(t("empty_admin_lessons"));
      return;
    }
    container.innerHTML = snapshot.docs.map((doc) => renderLessonCard(doc.data() || {}, { showDelete: true, lessonId: doc.id })).join("");
    qsa("[data-delete-lesson]", container).forEach((button) => {
      button.addEventListener("click", async () => {
        const lessonId = button.getAttribute("data-delete-lesson");
        if (!confirm(t("lesson_delete_confirm"))) return;
        try {
          const lessonRef = db.collection("lessons").doc(lessonId);
          const snap = await lessonRef.get();
          const data = snap.data() || {};
          if (data.storagePath && storage) {
            try { await storage.ref(data.storagePath).delete(); } catch (err) { console.warn(err); }
          }
          await lessonRef.delete();
          showNotification(t("lesson_deleted"));
        } catch (error) {
          showNotification(currentLang === "en" ? "Could not delete the lesson." : "نەتوانرا وانەکە بسڕدرێتەوە.", "error");
        }
      });
    });
  });
}

function loadPublicAnnouncements() {
  if (!db) return;
  const container = qs("#announcementPublicList");
  if (!container) return;
  if (publicAnnouncementsUnsubscribe) publicAnnouncementsUnsubscribe();
  publicAnnouncementsUnsubscribe = db.collection("announcements").orderBy("createdAt", "desc").limit(12).onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = renderEmptyState(t("empty_announcements"));
        return;
      }
      container.innerHTML = snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        const createdAt = data.createdAt?.toDate?.();
        return `
          <article class="announcement-card">
            <h3><i class="fas fa-bullhorn"></i> ${t("badge_announcement")}</h3>
            <p>${escapeHtml(data.text || "")}</p>
            ${data.imageUrl ? `<img class="announcement-image" src="${data.imageUrl}" alt="announcement">` : ""}
            <div class="lesson-date">${createdAt ? formatRelativeTime(createdAt) : ""}</div>
          </article>
        `;
      }).join("");
    },
    () => { container.innerHTML = renderEmptyState(currentLang === "en" ? "Unable to load announcements." : "نەتوانرا ڕاگەیاندنەکان باربکرێن."); }
  );
}

function loadAdminAnnouncements() {
  if (!db) return;
  const list = qs("#announcementList");
  if (!list) return;
  if (adminAnnouncementsUnsubscribe) adminAnnouncementsUnsubscribe();
  adminAnnouncementsUnsubscribe = db.collection("announcements").orderBy("createdAt", "desc").limit(50).onSnapshot((snapshot) => {
    updateDashboardStat("statAnnouncementsCount", snapshot.size);
    if (snapshot.empty) {
      list.innerHTML = renderEmptyState(t("empty_admin_announcements"));
      return;
    }
    list.innerHTML = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return `
        <article class="announcement-card">
          <h3>${t("badge_announcement")}</h3>
          <p>${escapeHtml(data.text || "")}</p>
          ${data.imageUrl ? `<img class="announcement-image" src="${data.imageUrl}" alt="announcement">` : ""}
          <div class="dashboard-item-actions">
            <button class="danger-btn" data-delete-announcement="${doc.id}"><i class="fas fa-trash"></i> ${t("delete_text")}</button>
          </div>
        </article>
      `;
    }).join("");
    qsa("[data-delete-announcement]", list).forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-delete-announcement");
        if (!confirm(t("announcement_delete_confirm"))) return;
        await db.collection("announcements").doc(id).delete();
      });
    });
  });
}

async function postAnnouncement(event) {
  event?.preventDefault();
  if (!db) return;
  const text = qs("#announcementText")?.value.trim() || "";
  const imageFile = qs("#announcementImage")?.files?.[0] || null;
  if (!text && !imageFile) return showNotification(t("announcement_missing"), "error");
  const btn = qs("#postAnnouncementBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';
  try {
    let imageUrl = "";
    if (imageFile) imageUrl = await uploadToImgBB(imageFile);
    await db.collection("announcements").add({ text, imageUrl, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    if (qs("#announcementText")) qs("#announcementText").value = "";
    if (qs("#announcementImage")) qs("#announcementImage").value = "";
    showNotification(t("announcement_added"));
  } catch (error) {
    showNotification(t("announcement_error"), "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

function renderCommentHtml(data) {
  const createdAt = data.timestamp?.toDate?.();
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.userName || "User")}&background=1e4ea8&color=fff&size=160`;
  const roleLabel = data.userRole === "teacher" ? t("role_teacher") : data.userRole === "admin" ? t("role_admin") : t("role_student");
  return `
    <article class="comment">
      <div class="comment-header">
        <div class="comment-user">
          <img class="comment-avatar" src="${avatar}" alt="${escapeHtml(data.userName || "User")}">
          <div class="comment-user-info">
            <h4>${escapeHtml(data.userName || (currentLang === "en" ? "User" : "بەکارهێنەر"))}</h4>
            <div class="teacher-meta">
              <span class="teacher-badge">${roleLabel}</span>
              <span class="comment-time">${createdAt ? formatRelativeTime(createdAt) : ""}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="comment-body">${escapeHtml(data.text || "").replace(/\n/g, "<br>")}</div>
    </article>
  `;
}

function loadComments() {
  if (!db) return;
  const list = qs("#commentsList");
  if (!list) return;
  if (publicCommentsUnsubscribe) publicCommentsUnsubscribe();
  publicCommentsUnsubscribe = db.collection("comments").orderBy("timestamp", "desc").limit(20).onSnapshot(
    (snapshot) => {
      if (snapshot.empty) { list.innerHTML = renderEmptyState(t("empty_comments")); return; }
      list.innerHTML = snapshot.docs.map((doc) => renderCommentHtml(doc.data() || {})).join("");
    },
    () => { list.innerHTML = renderEmptyState(currentLang === "en" ? "Unable to load comments." : "نەتوانرا کۆمێنتەکان باربکرێن."); }
  );
}

function loadAdminComments() {
  if (!db) return;
  const container = qs("#adminCommentsList");
  if (!container) return;
  if (adminCommentsUnsubscribe) adminCommentsUnsubscribe();
  adminCommentsUnsubscribe = db.collection("comments").orderBy("timestamp", "desc").limit(50).onSnapshot((snapshot) => {
    updateDashboardStat("statCommentsCount", snapshot.size);
    if (snapshot.empty) { container.innerHTML = renderEmptyState(t("empty_admin_comments")); return; }
    container.innerHTML = snapshot.docs.map((doc) => `
      <article class="comment">
        ${renderCommentHtml(doc.data() || {})}
        <div class="dashboard-item-actions">
          <button class="danger-btn" data-delete-comment="${doc.id}"><i class="fas fa-trash"></i> ${t("delete_text")}</button>
        </div>
      </article>`).join("");
    qsa("[data-delete-comment]", container).forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-delete-comment");
        if (!confirm(t("comment_delete_confirm"))) return;
        await db.collection("comments").doc(id).delete();
      });
    });
  });
}

async function addComment(event) {
  event?.preventDefault();
  if (!auth || !db) return showNotification(t("not_ready"), "error");
  const user = auth.currentUser;
  if (!user) { openAuthModal(); return showNotification(t("need_login"), "error"); }
  const textarea = qs("#commentText");
  const text = textarea?.value.trim() || "";
  if (text.length < 3) return showNotification(t("comment_min"), "error");
  const formBtn = qs("#commentForm button[type='submit']");
  const old = formBtn?.innerHTML;
  if (formBtn) formBtn.innerHTML = '<span class="loading"></span>';
  try {
    const userData = await ensureUserProfile(user);
    await db.collection("comments").add({
      userId: user.uid,
      userName: user.displayName || userData?.name || (currentLang === "en" ? "User" : "بەکارهێنەر"),
      userRole: userData?.role || "student",
      text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (textarea) textarea.value = "";
    showNotification(t("comment_posted"));
  } catch (error) {
    showNotification(currentLang === "en" ? "There was a problem sending the comment." : "هەڵە لە ناردنی کۆمێنت.", "error");
  } finally {
    if (formBtn && old) formBtn.innerHTML = old;
  }
}

async function login(event) {
  event?.preventDefault();
  if (!auth) return showNotification(t("not_ready"), "error");
  const email = qs("#loginEmail")?.value.trim();
  const password = qs("#loginPassword")?.value || "";
  if (!email || !password) return showNotification(currentLang === "en" ? "Email and password are required." : "ئیمەیڵ و وشەی نهێنی پێویستن.", "error");
  const btn = qs("#loginBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    await ensureUserProfile(result.user);
    showNotification(t("login_success"));
    closeAuthModal();
  } catch (error) {
    let message = t("login_fail");
    if (error.code === "auth/invalid-email") message = currentLang === "en" ? "The email address is not valid." : "ئیمەیڵەکە دروست نییە.";
    if (error.code === "auth/user-disabled") message = currentLang === "en" ? "This account is disabled." : "ئەم ئەکاونتە داخراوە.";
    showNotification(message, "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

async function register(event) {
  event?.preventDefault();
  if (!auth || !db) return showNotification(t("not_ready"), "error");
  const name = qs("#registerName")?.value.trim();
  const email = qs("#registerEmail")?.value.trim();
  const password = qs("#registerPassword")?.value || "";
  const confirm = qs("#registerConfirmPassword")?.value || "";
  if (!name || !email || !password || !confirm) return showNotification(currentLang === "en" ? "Please fill in all fields." : "تکایە هەموو خانەکان پڕ بکەوە.", "error");
  if (password !== confirm) return showNotification(currentLang === "en" ? "Passwords do not match." : "وشەی نهێنیەکان یەکسان نین.", "error");
  if (password.length < 6) return showNotification(currentLang === "en" ? "Password must be at least 6 characters." : "وشەی نهێنی دەبێت لانی کەم ٦ نووسە بێت.", "error");
  const btn = qs("#registerBtn");
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName: name });
    await db.collection("users").doc(result.user.uid).set({ name, email, role: "student", createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    showNotification(t("register_success"));
    closeAuthModal();
  } catch (error) {
    let message = currentLang === "en" ? "An error occurred." : "هەڵەیەک ڕوویدا.";
    if (error.code === "auth/email-already-in-use") message = currentLang === "en" ? "This email is already registered." : "ئەم ئیمەیڵە پێشتر تۆمار کراوە.";
    if (error.code === "auth/invalid-email") message = currentLang === "en" ? "The email address is not valid." : "ئیمەیڵەکە دروست نییە.";
    if (error.code === "auth/weak-password") message = currentLang === "en" ? "The password is too weak." : "وشەی نهێنی زۆر لاوازە.";
    showNotification(message, "error");
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

function loginWithFacebook() {
  showNotification(currentLang === "en" ? "This option will be added later." : "ئەم بەشە دواتر زیاد دەکرێت.", "warning");
}

function uploadMedia() {
  showNotification(t("upload_media_info"), "warning");
}

function initHeroTyping() {
  const title = qs("#heroTitle");
  if (!title) return;
  const text = title.getAttribute("data-text") || (currentLang === "en" ? "Sivar Vocational High School" : "ئامادەیی پیشەیی سیڤەر");
  let index = 0;
  title.textContent = "";
  const type = () => {
    if (index < text.length) {
      title.textContent += text.charAt(index);
      index += 1;
      setTimeout(type, currentLang === "en" ? 45 : 75);
    }
  };
  type();
}

function initPrincipalLightbox() {
  return;
}

function initAccessLoginPage() {
  if (!auth || !db || !isAccessLoginPage()) return;
  const form = qs("#adminLoginForm");
  const errorEl = qs("#error");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.textContent = "";
    const email = qs("#adminEmail")?.value.trim();
    const password = qs("#adminPassword")?.value || "";
    const submitBtn = qs("#accessLoginBtn");
    const old = submitBtn?.innerHTML;
    if (submitBtn) submitBtn.innerHTML = '<span class="loading"></span>';
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      await ensureUserProfile(cred.user);
      const role = await getUserRole(cred.user.uid);
      if (role !== "admin" && role !== "teacher") {
        await auth.signOut();
        if (errorEl) errorEl.textContent = currentLang === "en" ? "Only admins or teachers can sign in here." : "تەنها ئەدمین یان مامۆستا دەتوانێت بچێتە ژوورەوە.";
        return;
      }
      window.location.href = "admin.html";
    } catch (error) {
      if (errorEl) errorEl.textContent = currentLang === "en" ? "Login failed." : "چوونەژورەوە سەرکەوتوو نەبوو.";
    } finally {
      if (submitBtn && old) submitBtn.innerHTML = old;
    }
  });
}

function initResponsiveAccountRefresh() {
  window.addEventListener("resize", () => {
    if (auth?.currentUser) ensureUserProfile(auth.currentUser).then((userData) => applyUserDataToUI(auth.currentUser, userData)).catch(() => applyUserDataToUI(auth.currentUser, null));
    else applyUserDataToUI(null, null);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLanguageSystem();
  initResponsiveAccountRefresh();
});

/* extra translation rules */
if (pageTranslations["department-architecture"]) {
  pageTranslations["department-architecture"].push(
    { selector: ".nav-list a[href='index.html']", html: true, ku: "<i class='fas fa-house'></i> سەرەکی", en: "<i class='fas fa-house'></i> Home" },
    { selector: ".nav-list a[href='#about-dept']", html: true, ku: "<i class='fas fa-circle-info'></i> دەربارەی بەش", en: "<i class='fas fa-circle-info'></i> About department" },
    { selector: ".nav-list a[href='#online-lessons']", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: ".nav-list a[href='#teachers']", html: true, ku: "<i class='fas fa-chalkboard-teacher'></i> مامۆستاکان", en: "<i class='fas fa-chalkboard-teacher'></i> Teachers" },
    { selector: ".header-actions .login-btn", html: true, ku: "<i class='fas fa-chalkboard-user'></i> داشبۆرد", en: "<i class='fas fa-chalkboard-user'></i> Dashboard" },
    { selector: ".hero-actions .hero-btn", html: true, ku: "<i class='fas fa-circle-play'></i> بینینی وانەکان", en: "<i class='fas fa-circle-play'></i> View lessons" },
    { selector: ".hero-actions .secondary-btn", html: true, ku: "<i class='fas fa-cloud-arrow-up'></i> بارکردنی وانە", en: "<i class='fas fa-cloud-arrow-up'></i> Upload lesson" },
    { selector: "#online-lessons .outline-btn", html: true, ku: "<i class='fas fa-arrow-up-from-bracket'></i> چوونە ناو داشبۆرد", en: "<i class='fas fa-arrow-up-from-bracket'></i> Open dashboard" },
    { selector: "#online-lessons .section-subtitle", ku: "هەر وانەیەک کە لە داشبۆرد زیاد بکرێت، لێرە خۆکارانە دەردەکەوێت. تکایە وانەکان بە ناونیشان و بابەتێکی ڕوون زیاد بکەن.", en: "Every lesson added from the dashboard appears here automatically. Please use clear titles and subjects for each lesson." }
  );
}
if (pageTranslations["department-veterinary"]) {
  pageTranslations["department-veterinary"].push(
    { selector: ".nav-list a[href='index.html']", html: true, ku: "<i class='fas fa-house'></i> سەرەکی", en: "<i class='fas fa-house'></i> Home" },
    { selector: ".nav-list a[href='#about-dept']", html: true, ku: "<i class='fas fa-circle-info'></i> دەربارەی بەش", en: "<i class='fas fa-circle-info'></i> About department" },
    { selector: ".nav-list a[href='#online-lessons']", html: true, ku: "<i class='fas fa-video'></i> وانە ئۆنلاینەکان", en: "<i class='fas fa-video'></i> Online lessons" },
    { selector: ".nav-list a[href='#teachers']", html: true, ku: "<i class='fas fa-chalkboard-teacher'></i> مامۆستاکان", en: "<i class='fas fa-chalkboard-teacher'></i> Teachers" },
    { selector: ".header-actions .login-btn", html: true, ku: "<i class='fas fa-chalkboard-user'></i> داشبۆرد", en: "<i class='fas fa-chalkboard-user'></i> Dashboard" },
    { selector: ".hero-actions .hero-btn", html: true, ku: "<i class='fas fa-circle-play'></i> بینینی وانەکان", en: "<i class='fas fa-circle-play'></i> View lessons" },
    { selector: ".hero-actions .secondary-btn", html: true, ku: "<i class='fas fa-cloud-arrow-up'></i> بارکردنی وانە", en: "<i class='fas fa-cloud-arrow-up'></i> Upload lesson" },
    { selector: "#online-lessons .outline-btn", html: true, ku: "<i class='fas fa-arrow-up-from-bracket'></i> چوونە ناو داشبۆرد", en: "<i class='fas fa-arrow-up-from-bracket'></i> Open dashboard" },
    { selector: "#online-lessons .section-subtitle", ku: "هەر وانەیەک کە لە داشبۆرد زیاد بکرێت، لێرە خۆکارانە دەردەکەوێت. تکایە وانەکان بە ناونیشان و بابەتێکی ڕوون زیاد بکەن.", en: "Every lesson added from the dashboard appears here automatically. Please use clear titles and subjects for each lesson." }
  );
}
if (pageTranslations.index) {
  pageTranslations.index.push(
    { selector: "main .section:nth-last-of-type(1) .section-title", html: true, ku: "<i class='fas fa-map-location-dot'></i> شوێنی ئامادەیی پیشەیی سیڤەر", en: "<i class='fas fa-map-location-dot'></i> School location" },
    { selector: "main .section:nth-last-of-type(1) .section-subtitle", ku: "ئەم نەخشە بەکاربهێنە بۆ گەیشتن بە ئامادەیی پیشەیی سیڤەر", en: "The map is placed near the bottom of the website so visitors can find the school easily." }
  );
}


/* =====================================================
   2026-03-31 teacher lesson pages upgrade
   ===================================================== */

const teacherDirectory = {
  programming: [
    {
      slug: 'xanda',
      name: 'مامۆستا خەندە صدیق محمد',
      subject: 'C++ / Security / Database',
      image: 'assets/images/Staff/teachers/xanda.jpg'
    },
    {
      slug: 'delvin',
      name: 'مامۆستا دلڤین ڕەشید محمد',
      subject: 'Human Rights',
      image: 'assets/images/Staff/teachers/delvin.jpg'
    },
    {
      slug: 'faridun',
      name: 'مامۆستا فەریدون',
      subject: 'Arabic / Religion',
      image: 'assets/images/Staff/teachers/faridun.jpg'
    },
    {
      slug: 'hassan',
      name: 'مامۆستا حەسەن جەبار حاجی',
      subject: 'Kurdish',
      image: 'assets/images/Staff/teachers/hassan.jpg'
    },
    {
      slug: 'helin',
      name: 'مامۆستا هێلین ابراهیم',
      subject: 'IT / MS',
      image: 'assets/images/Staff/teachers/helin.jpg'
    },
    {
      slug: 'hunar',
      name: 'مامۆستا هونەر محسن',
      subject: 'English',
      image: 'assets/images/Staff/teachers/hunar.jpg'
    },
    {
      slug: 'shoxan',
      name: 'مامۆستا شۆخان عومەر',
      subject: 'Physics',
      image: 'assets/images/Staff/teachers/shoxan.jpg'
    },
    {
      slug: 'yusra',
      name: 'مامۆستا یسرا',
      subject: 'Math',
      image: 'assets/images/Staff/teachers/yusra.jpg'
    }
  ],
  veterinary: [
    {
      slug: 'hazhar',
      name: 'مامۆستا هەژار خوادا غلام',
      subject: 'توێکارزانی',
      image: 'assets/images/Staff/teachers/hazhar.jpg'
    },
    {
      slug: 'sarab',
      name: 'مامۆستا سراب',
      subject: 'Veterinary',
      image: 'assets/images/Staff/teachers/sarab.jpg'
    },
    {
      slug: 'faridun',
      name: 'مامۆستا فەریدون',
      subject: 'Arabic / Religion',
      image: 'assets/images/Staff/teachers/faridun.jpg'
    },
    {
      slug: 'hassan',
      name: 'مامۆستا حەسەن جەبار حاجی',
      subject: 'Kurdish',
      image: 'assets/images/Staff/teachers/hassan.jpg'
    },
    {
      slug: 'shoxan',
      name: 'مامۆستا شۆخان عومەر',
      subject: 'Chemistry',
      image: 'assets/images/Staff/teachers/shoxan.jpg'
    },
    {
      slug: 'hunar',
      name: 'مامۆستا هونەر محسن',
      subject: 'English',
      image: 'assets/images/Staff/teachers/hunar.jpg'
    },
    {
      slug: 'delvin',
      name: 'مامۆستا دلڤین ڕەشید محمد',
      subject: 'Human Rights',
      image: 'assets/images/Staff/teachers/delvin.jpg'
    },
    {
      slug: 'helin',
      name: 'مامۆستا هێلین ابراهیم',
      subject: 'IT',
      image: 'assets/images/Staff/teachers/helin.jpg'
    }
  ],
  architecture: [
    {
      slug: 'sapan',
      name: 'مامۆستا سەپان جەمیل علی',
      subject: 'Architecture',
      image: 'assets/images/Staff/teachers/sapan.jpg'
    },
    {
      slug: 'wanawsha',
      name: 'مامۆستا وەنەوشە',
      subject: 'Design / Drawing / S.F',
      image: 'assets/images/Staff/teachers/wanawsha.svg'
    },
    {
      slug: 'yusra',
      name: 'مامۆستا یسرا',
      subject: 'Math',
      image: 'assets/images/Staff/teachers/yusra.jpg'
    },
    {
      slug: 'xanda',
      name: 'مامۆستا خەندە صدیق محمد',
      subject: 'IT',
      image: 'assets/images/Staff/teachers/xanda.jpg'
    },
    {
      slug: 'shoxan',
      name: 'مامۆستا شۆخان عومەر',
      subject: 'Physics',
      image: 'assets/images/Staff/teachers/shoxan.jpg'
    },
    {
      slug: 'hunar',
      name: 'مامۆستا هونەر محسن',
      subject: 'English',
      image: 'assets/images/Staff/teachers/hunar.jpg'
    },
    {
      slug: 'faridun',
      name: 'مامۆستا فەریدون',
      subject: 'Arabic / Religion',
      image: 'assets/images/Staff/teachers/faridun.jpg'
    },
    {
      slug: 'hassan',
      name: 'مامۆستا حەسەن جەبار حاجی',
      subject: 'Kurdish',
      image: 'assets/images/Staff/teachers/hassan.jpg'
    }
  ]
};

function getDepartmentPageLink(department) {
  return { programming: 'department-programming.html', architecture: 'department-architecture.html', veterinary: 'department-veterinary.html' }[department] || 'index.html';
}

function getDepartmentTeacherList(department) {
  return Array.isArray(teacherDirectory[department]) ? teacherDirectory[department] : [];
}

function findTeacherData(department, teacherSlug) {
  return getDepartmentTeacherList(department).find((item) => item.slug === teacherSlug) || null;
}

function normalizeTeacherToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟ‌‏]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, '')
    .replace(/ە/g, 'ه')
    .replace(/\bمامۆستا\b|\bماموستا\b|\bteacher\b/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalTeacherKey(value) {
  return normalizeTeacherToken(value).replace(/\s+/g, '');
}

function lessonMatchesTeacher(lesson, teacherData) {
  if (!teacherData) return false;

  const teacherSlug = String(teacherData.slug || '').trim();
  const lessonSlug = String(lesson.teacherSlug || '').trim();
  if (teacherSlug && lessonSlug && lessonSlug === teacherSlug) return true;

  const teacherKeys = new Set([
    canonicalTeacherKey(teacherData.name),
    canonicalTeacherKey(teacherData.subject),
    canonicalTeacherKey(teacherData.slug)
  ].filter(Boolean));

  const lessonKeys = [
    lesson.teacherKey,
    lesson.teacher,
    lesson.uploadedByName,
    lesson.subject,
    lesson.teacherSlug
  ].map(canonicalTeacherKey).filter(Boolean);

  if (teacherData.image && lesson.teacherImage && String(lesson.teacherImage).trim() === String(teacherData.image).trim()) {
    return true;
  }

  return lessonKeys.some((lessonKey) => {
    if (!lessonKey) return false;
    for (const teacherKey of teacherKeys) {
      if (!teacherKey) continue;
      if (lessonKey === teacherKey || lessonKey.includes(teacherKey) || teacherKey.includes(lessonKey)) {
        return true;
      }
    }
    return false;
  });
}

function populateLessonTeacherOptions(preferredSlug = '') {
  const department = qs('#lessonDepartment')?.value || '';
  const select = qs('#lessonTeacherSelect');
  const teacherInput = qs('#lessonTeacher');
  const subjectInput = qs('#lessonSubject');
  if (!select) return;

  const teachers = getDepartmentTeacherList(department);
  const placeholder = currentLang === 'en' ? 'Choose teacher' : 'مامۆستا هەڵبژێرە';
  select.innerHTML = `<option value="">${placeholder}</option>` + teachers.map((teacher) => `<option value="${teacher.slug}">${escapeHtml(teacher.name)}</option>`).join('');

  const targetSlug = preferredSlug && teachers.some((teacher) => teacher.slug === preferredSlug) ? preferredSlug : '';
  select.value = targetSlug;

  if (!teachers.length) {
    if (teacherInput) { teacherInput.value = ''; teacherInput.readOnly = false; }
    return;
  }

  if (teacherInput) teacherInput.readOnly = true;
  syncTeacherSelectionFields();

  if (subjectInput && targetSlug) {
    const selected = findTeacherData(department, targetSlug);
    subjectInput.value = selected?.subject || '';
  }
}

function syncTeacherSelectionFields() {
  const department = qs('#lessonDepartment')?.value || '';
  const select = qs('#lessonTeacherSelect');
  const teacherInput = qs('#lessonTeacher');
  const subjectInput = qs('#lessonSubject');
  if (!select || !teacherInput) return;

  const teacherData = findTeacherData(department, select.value || '');
  if (!teacherData) {
    teacherInput.value = '';
    teacherInput.readOnly = false;
    return;
  }

  teacherInput.value = teacherData.name || '';
  teacherInput.readOnly = true;
  if (subjectInput) {
    subjectInput.value = teacherData.subject || '';
  }
}

function getTeacherPageState() {
  const params = new URLSearchParams(window.location.search);
  const department = params.get('department') || '';
  const teacherSlug = params.get('teacher') || '';
  const teacherData = findTeacherData(department, teacherSlug);
  return { department, teacherSlug, teacherData };
}

function syncTeacherPageContent() {
  if (document.body?.dataset.page !== 'teacher-lessons') return;

  const { department, teacherData } = getTeacherPageState();
  const pageName = qs('#teacherPageName');
  const pagePhoto = qs('#teacherPagePhoto');
  const subject = qs('#teacherPageSubject');
  const deptBadge = qs('#teacherDepartmentBadge');
  const heading = qs('#teacherPageHeading');
  const heroText = qs('#teacherHeroText');
  const desc = qs('#teacherPageDescription');
  const lessonsTitle = qs('#teacherLessonsTitle');
  const lessonsSubtitle = qs('#teacherLessonsSubtitle');
  const backBtn = qs('#teacherBackButton');
  const deptLink = qs('#teacherDepartmentLink');
  const dashLink = qs('#teacherDashboardLink');
  const overviewNav = qs('#teacherNavOverview');
  const lessonsNav = qs('#teacherNavLessons');
  const headerDash = qs('.header-actions .login-btn');

  const fallbackName = currentLang === 'en' ? 'Teacher lessons' : 'وانەکانی مامۆستا';
  const teacherName = teacherData?.name || fallbackName;
  const teacherSubject = teacherData?.subject || (currentLang === 'en' ? 'Department teacher' : 'مامۆستای بەش');
  const departmentName = mapDepartmentName(department);

  document.title = currentLang === 'en' ? `${teacherName} - Lessons | Sivar Vocational High School` : `${teacherName} - وانەکان | ئامادەیی پیشەیی سیڤەر`;
  if (pageName) pageName.textContent = teacherName;
  if (pagePhoto) {
    const resolvedPhoto = teacherData?.image || window.__teacherPageInitialData?.image || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    pagePhoto.alt = teacherName;
    if (pagePhoto.getAttribute('src') !== resolvedPhoto) {
      pagePhoto.classList.add('is-loading');
      pagePhoto.classList.remove('is-ready');
      pagePhoto.onload = () => {
        pagePhoto.classList.remove('is-loading');
        pagePhoto.classList.add('is-ready');
      };
      pagePhoto.src = resolvedPhoto;
    } else {
      pagePhoto.classList.remove('is-loading');
      pagePhoto.classList.add('is-ready');
    }
  }
  if (subject) subject.textContent = teacherSubject;
  if (deptBadge) deptBadge.textContent = `${currentLang === 'en' ? 'Department' : 'بەش'}: ${departmentName}`;
  if (heading) heading.textContent = currentLang === 'en' ? `${teacherName} lessons` : `وانەکانی ${teacherName}`;
  if (heroText) heroText.textContent = currentLang === 'en' ? 'All online lesson videos for this teacher are collected here in one place.' : 'هەموو ڤیدیۆ و وانە ئۆنلاینەکانی ئەم مامۆستایە لێرە لە یەک شوێندا کۆ کراونەتەوە.';
  if (desc) desc.textContent = currentLang === 'en' ? 'Use this page to reach the exact teacher videos quickly and without confusion.' : 'ئەم پەڕەیە بۆ گەیشتن بە ڤیدیۆکانی هەمان مامۆستایە بە شێوەیەکی ڕێکخراو و خێرا.';
  if (lessonsTitle) lessonsTitle.innerHTML = `<i class="fas fa-video"></i> ${currentLang === 'en' ? 'Teacher lessons' : 'وانە ئۆنلاینەکان'}`;
  if (lessonsSubtitle) lessonsSubtitle.textContent = currentLang === 'en' ? 'Only the uploaded lessons that belong to this teacher appear below.' : 'تەنها ئەو وانانەی بۆ ئەم مامۆستایە بارکراون، لە خوارەوە نیشان دەدرێن.';
  const deptHref = getDepartmentPageLink(department);
  if (backBtn) { backBtn.href = deptHref; backBtn.innerHTML = currentLang === 'en' ? '<i class="fas fa-arrow-left"></i> Back to department' : '<i class="fas fa-arrow-left"></i> گەڕانەوە بۆ بەش'; }
  if (deptLink) { deptLink.href = deptHref; deptLink.innerHTML = currentLang === 'en' ? '<i class="fas fa-building"></i> Department page' : '<i class="fas fa-building"></i> پەڕەی بەش'; }
  if (dashLink) dashLink.innerHTML = currentLang === 'en' ? '<i class="fas fa-arrow-up-from-bracket"></i> Open dashboard' : '<i class="fas fa-arrow-up-from-bracket"></i> چوونە ناو داشبۆرد';
  if (overviewNav) overviewNav.innerHTML = currentLang === 'en' ? '<i class="fas fa-user"></i> Teacher' : '<i class="fas fa-user"></i> مامۆستا';
  if (lessonsNav) lessonsNav.innerHTML = currentLang === 'en' ? '<i class="fas fa-video"></i> Lessons' : '<i class="fas fa-video"></i> وانەکان';
  if (headerDash) headerDash.innerHTML = currentLang === 'en' ? '<i class="fas fa-chalkboard-user"></i> Dashboard' : '<i class="fas fa-chalkboard-user"></i> داشبۆرد';

  qsa('[data-ku][data-en]').forEach((element) => {
    const next = currentLang === 'en' ? element.getAttribute('data-en') : element.getAttribute('data-ku');
    if (next) element.textContent = next;
  });
}

function loadTeacherLessonsPage() {
  if (!db || document.body?.dataset.page !== 'teacher-lessons') return;
  const container = qs('#teacherLessonsList');
  if (!container) return;
  const { department, teacherSlug, teacherData } = getTeacherPageState();
  if (!department || !teacherData) {
    container.innerHTML = renderEmptyState(currentLang === 'en' ? 'Teacher page data is missing.' : 'زانیاری مامۆستا تەواو نییە.');
    return;
  }

  if (departmentLessonsUnsubscribe) departmentLessonsUnsubscribe();
  departmentLessonsUnsubscribe = db.collection('lessons').where('department', '==', department).onSnapshot(
    (snapshot) => {
      const lessons = snapshot.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
        .filter((lesson) => {
          if (lesson.teacherSlug && teacherSlug && String(lesson.teacherSlug).trim() === teacherSlug) return true;
          return lessonMatchesTeacher(lesson, teacherData);
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
          return bTime - aTime;
        });

      if (!lessons.length) {
        container.innerHTML = renderEmptyState(currentLang === 'en' ? 'No lessons have been uploaded for this teacher yet.' : 'هێشتا هیچ وانەیەک بۆ ئەم مامۆستایە بارنەکراوە.');
        return;
      }

      container.innerHTML = lessons.map((lesson) => renderLessonCard(lesson, { compactMedia: true })).join('');
    },
    (error) => {
      console.error('Teacher lessons load error:', error);
      container.innerHTML = renderEmptyState(currentLang === 'en' ? 'Unable to load teacher lessons.' : 'نەتوانرا وانەکانی مامۆستا باربکرێن.');
    }
  );
}

function initDashboard() {
  const dashboard = qs('#dashboardReady');
  if (!dashboard || dashboard.getAttribute('data-ready') === 'true') return;
  dashboard.setAttribute('data-ready', 'true');

  qs('#announcementForm')?.addEventListener('submit', postAnnouncement);
  qs('#lessonForm')?.addEventListener('submit', postLesson);
  qs('#roleForm')?.addEventListener('submit', updateUserRole);
  qs('#logoutAdmin')?.addEventListener('click', async () => {
    await logout();
    window.location.replace('index.html');
  });

  qs('#lessonDepartment')?.addEventListener('change', () => populateLessonTeacherOptions());
  qs('#lessonTeacherSelect')?.addEventListener('change', () => syncTeacherSelectionFields());

  qs('#lessonVideo')?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0];
    if (!file) {
      setLessonUploadStatus(t('lesson_url_mode'), 'info');
      return;
    }
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setLessonUploadStatus(`${file.name} • ${sizeMb} MB`, 'info');
  });

  qs('#lessonVideoUrl')?.addEventListener('input', (event) => {
    const value = event.target?.value?.trim() || '';
    if (!value) return;
    setLessonUploadStatus(t('lesson_url_mode'), 'info');
  });

  populateLessonTeacherOptions();
  loadAdminAnnouncements();
  loadAdminLessons();
  loadAdminComments();
}

async function postLesson(event) {
  event?.preventDefault();
  if (!db || !auth) return showNotification(t('not_ready'), 'error');
  const user = auth.currentUser;
  if (!user) return showNotification(t('need_login'), 'error');

  const department = qs('#lessonDepartment')?.value || '';
  const teacherSelect = qs('#lessonTeacherSelect');
  const teacherSlug = teacherSelect?.value || '';
  const teacherMeta = findTeacherData(department, teacherSlug);
  const title = qs('#lessonTitle')?.value.trim() || '';
  const teacher = (teacherMeta?.name || qs('#lessonTeacher')?.value.trim() || user.displayName || '').trim();
  const subject = qs('#lessonSubject')?.value.trim() || teacherMeta?.subject || '';
  const description = qs('#lessonDescription')?.value.trim() || '';
  const videoFile = qs('#lessonVideo')?.files?.[0] || null;
  const videoUrlInput = qs('#lessonVideoUrl')?.value.trim() || '';

  if (!department || !title || !teacher || !subject || (!videoFile && !videoUrlInput)) {
    showNotification(t('lesson_missing'), 'error');
    return;
  }

  const btn = qs('#postLessonBtn');
  const old = btn?.innerHTML;
  if (btn) btn.innerHTML = '<span class="loading"></span>';
  setLessonUploadStatus(videoFile ? t('lesson_uploading') : t('lesson_url_mode'), 'info');

  try {
    let finalUrl = videoUrlInput;
    let storagePath = '';

    if (videoFile) {
      const uploaded = await uploadLessonVideo(videoFile, department);
      finalUrl = uploaded.url;
      storagePath = uploaded.path;
      setLessonUploadStatus(t('lesson_processing'), 'info');
    } else if (!/^https?:\/\//i.test(finalUrl)) {
      throw new Error('invalid-video-link');
    }

    await db.collection('lessons').add({
      department,
      teacher,
      teacherSlug: teacherMeta?.slug || teacherSlug || '',
      teacherKey: canonicalTeacherKey(teacherMeta?.name || teacher),
      teacherImage: teacherMeta?.image || '',
      title,
      subject,
      description,
      videoUrl: finalUrl,
      storagePath,
      uploadedBy: user.uid,
      uploadedByName: user.displayName || teacher,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    qs('#lessonForm')?.reset();
    populateLessonTeacherOptions();
    setLessonUploadStatus(t('lesson_upload_done'), 'success');
    showNotification(t('lesson_posted'));
  } catch (error) {
    console.error('Lesson upload error:', error);
    let message = currentLang === 'en' ? 'There was a problem uploading the lesson.' : 'هەڵە لە بارکردنی وانەکە.';
    if (error.code === 'storage/unauthorized') message = currentLang === 'en' ? 'Storage rules rejected the upload. Check your Firebase Storage rules.' : 'یاساکانی Firebase Storage بارکردنەکە ڕەت کرد. تکایە rules ـەکان بپشکنە.';
    if (error.code === 'storage/canceled') message = currentLang === 'en' ? 'The upload was canceled.' : 'بارکردنەکە وەستێنرا.';
    if (error.code === 'storage/unknown') message = currentLang === 'en' ? 'Unknown storage error. Check the selected bucket and storage rules.' : 'هەڵەی نەناسراوی storage. storage bucket و rules بپشکنە.';
    if (String(error.message || '') === 'invalid-video-link') message = t('invalid_video_link');
    setLessonUploadStatus(message, 'error');
    showNotification(message, 'error');
  } finally {
    if (btn && old) btn.innerHTML = old;
  }
}

function applyTranslations() {
  const pageKey = document.body?.dataset.page || 'index';
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
  document.body?.classList.toggle('lang-en', currentLang === 'en');
  document.body?.classList.toggle('lang-ku', currentLang !== 'en');
  (pageTranslations.common || []).forEach(applyRule);
  (pageTranslations[pageKey] || []).forEach(applyRule);
  const heroTitle = qs('#heroTitle');
  if (heroTitle) heroTitle.setAttribute('data-text', currentLang === 'en' ? 'Sivar Vocational High School' : 'ئامادەیی پیشەیی سیڤەر');
  updateLangButtonsUI();
  syncTeacherPageContent();
  populateLessonTeacherOptions(qs('#lessonTeacherSelect')?.value || '');
  loadTeacherLessonsPage();
  qsa('[data-ku][data-en]').forEach((element) => {
    const next = currentLang === 'en' ? element.getAttribute('data-en') : element.getAttribute('data-ku');
    if (next) element.textContent = next;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  syncTeacherPageContent();
  loadTeacherLessonsPage();
  populateLessonTeacherOptions();
});
