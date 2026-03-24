/* ══════════════════════════════════════════════
   NEXUS — Frontend Logic
   Backend: https://backend-a9pu.onrender.com/api/v1
   Auth: /auth/register  /auth/login
   Announcements: /announcements  (GET, POST, PUT/:id, DELETE/:id)
   AI: Anthropic claude-sonnet-4-20250514 via proxy
══════════════════════════════════════════════ */

const API = "https://backend-a9pu.onrender.com/api/v1";

let allAnnouncements = [];
let currentFilter = "all";
let editingId = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function getToken()    { return localStorage.getItem("token"); }
function getRole()     { return localStorage.getItem("role"); }
function getUserName() { return localStorage.getItem("userName") || "User"; }

function escHtml(s) {
  return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isActive(expiryDate)   { return new Date(expiryDate) >= new Date(); }
function isExpiring(expiryDate) {
  const d = new Date(expiryDate), now = new Date();
  return d >= now && d <= new Date(now.getTime() + 7 * 86400000);
}

// ── Toast ─────────────────────────────────────────────────────────────────

function toast(msg, type = "info") {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s, transform 0.3s";
    el.style.opacity = "0"; el.style.transform = "translateX(12px)";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── Loading state ─────────────────────────────────────────────────────────

function btnLoad(id, loading, label = "") {
  const b = document.getElementById(id);
  if (!b) return;
  if (loading) {
    b._orig = b.innerHTML;
    b.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${label || "Please wait…"}`;
    b.disabled = true;
  } else {
    b.innerHTML = b._orig || b.innerHTML;
    b.disabled = false;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────

async function login() {
  const email    = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value;
  if (!email || !password) { toast("Enter your email and password", "error"); return; }

  btnLoad("loginBtn", true, "Signing in…");
  try {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (!r.ok || !d.token) { toast(d.message || "Invalid credentials", "error"); return; }

    localStorage.setItem("token",    d.token);
    localStorage.setItem("role",     d.user.role);
    localStorage.setItem("userName", d.user.name);
    localStorage.setItem("userEmail",d.user.email);

    toast(`Welcome back, ${d.user.name}!`, "success");
    setTimeout(() => {
      window.location.href = d.user.role === "ADMIN" ? "admin.html" : "employee.html";
    }, 900);
  } catch { toast("Network error. Check your connection.", "error"); }
  finally  { btnLoad("loginBtn", false); }
}

async function register() {
  const name            = document.getElementById("regName")?.value?.trim();
  const email           = document.getElementById("regEmail")?.value?.trim();
  const password        = document.getElementById("regPassword")?.value;
  const confirmPassword = document.getElementById("regConfirmPassword")?.value;
  const role            = document.getElementById("role")?.value;
  const adminCode       = document.getElementById("adminCode")?.value?.trim() || "";

  if (!name || !email || !password || !confirmPassword) { toast("Please fill in all fields", "error"); return; }
  if (password !== confirmPassword) { toast("Passwords do not match", "error"); return; }
  if (password.length < 8)          { toast("Password must be at least 8 characters", "error"); return; }

  btnLoad("registerBtn", true, "Creating account…");
  try {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, adminCode })
    });
    const d = await r.json();
    if (!r.ok) { toast(d.message || "Registration failed", "error"); return; }
    toast("Account created! Redirecting…", "success");
    setTimeout(() => window.location.href = "index.html", 1400);
  } catch { toast("Network error.", "error"); }
  finally  { btnLoad("registerBtn", false); }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

function onRoleChange(val) {
  const wrap = document.getElementById("adminCodeWrap");
  if (wrap) wrap.style.display = val === "ADMIN" ? "block" : "none";
}

function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  btn.innerHTML = `<i class="fas ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;
}

// ── Announcements ─────────────────────────────────────────────────────────

async function loadAnnouncements() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading…</p></div>`;
  try {
    const r = await fetch(`${API}/announcements`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (r.status === 401) { toast("Session expired. Please sign in again.", "error"); setTimeout(logout, 1200); return; }
    const d = await r.json();
    allAnnouncements = Array.isArray(d) ? d : [];
    renderList();
    updateStats();
  } catch {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Failed to load announcements.</p></div>`;
  }
}

function renderList() {
  const list = document.getElementById("list");
  if (!list) return;
  const role   = getRole();
  const search = (document.getElementById("searchInput")?.value || "").toLowerCase();

  const filtered = allAnnouncements.filter(a => {
    const act = isActive(a.expiryDate);
    if (currentFilter === "active"  && !act) return false;
    if (currentFilter === "expired" &&  act) return false;
    if (search && !(a.title + " " + a.description).toLowerCase().includes(search)) return false;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>No announcements found</p></div>`;
    return;
  }

  list.innerHTML = "";
  filtered.forEach((a, i) => {
    const act  = isActive(a.expiryDate);
    const exp  = isExpiring(a.expiryDate);
    const cls  = exp ? "expiring" : act ? "active" : "expired";
    const lbl  = exp ? "Expiring soon" : act ? "Active" : "Expired";
    const indCls = exp ? "expiring" : act ? "" : "expired";

    const item = document.createElement("div");
    item.className = "ann-item";
    item.style.animationDelay = `${i * 0.04}s`;
    item.innerHTML = `
      <div class="ann-indicator ${indCls}"></div>
      <div class="ann-body">
        <div class="ann-title">${escHtml(a.title)}</div>
        <div class="ann-desc">${escHtml(a.description)}</div>
        <div class="ann-meta">
          <span class="meta-tag"><i class="fas fa-calendar-xmark"></i> Expires ${fmtDate(a.expiryDate)}</span>
          ${a.createdAt ? `<span class="meta-tag"><i class="fas fa-clock"></i> Posted ${fmtDate(a.createdAt)}</span>` : ""}
        </div>
      </div>
      <div class="ann-aside">
        <span class="badge ${cls}">${lbl}</span>
        ${role === "ADMIN" ? `
        <div class="ann-btns">
          <button class="btn-icon edit" title="Edit" onclick="openEdit('${a._id}')"><i class="fas fa-pen"></i></button>
          <button class="btn-icon del"  title="Delete" onclick="delAnnouncement('${a._id}')"><i class="fas fa-trash"></i></button>
        </div>` : ""}
      </div>
    `;
    list.appendChild(item);
  });
}

function updateStats() {
  const now  = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  const total    = allAnnouncements.length;
  const active   = allAnnouncements.filter(a => new Date(a.expiryDate) >= now).length;
  const expired  = total - active;
  const expiring = allAnnouncements.filter(a => { const d = new Date(a.expiryDate); return d >= now && d <= week; }).length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("stat-total",    total);
  set("stat-active",   active);
  set("stat-expired",  expired);
  set("stat-expiring", expiring);
  set("tb-total",      total);
  set("tb-active",     active);
  set("activeCount",   active);
}

function setFilter(val, btn) {
  currentFilter = val;
  document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderList();
}

// ── Modal (Create / Edit) ─────────────────────────────────────────────────

function openCreateModal() {
  editingId = null;
  document.getElementById("modalTitle").innerHTML = `<i class="fas fa-plus-circle"></i> New Announcement`;
  const sub = document.getElementById("modalSubmit");
  if (sub) sub.innerHTML = `<i class="fas fa-paper-plane"></i> <span>Publish</span>`;
  document.getElementById("mTitle").value  = "";
  document.getElementById("mDesc").value   = "";
  document.getElementById("mExpiry").value = "";
  document.getElementById("modal").classList.add("open");
}

function openEdit(id) {
  const a = allAnnouncements.find(x => x._id === id);
  if (!a) return;
  editingId = id;
  document.getElementById("modalTitle").innerHTML = `<i class="fas fa-pen"></i> Edit Announcement`;
  const sub = document.getElementById("modalSubmit");
  if (sub) sub.innerHTML = `<i class="fas fa-check"></i> <span>Save changes</span>`;
  document.getElementById("mTitle").value  = a.title || "";
  document.getElementById("mDesc").value   = a.description || "";
  document.getElementById("mExpiry").value = a.expiryDate ? a.expiryDate.split("T")[0] : "";
  document.getElementById("modal").classList.add("open");
}

function closeModal() {
  document.getElementById("modal")?.classList.remove("open");
}

function onBackdropClick(e) {
  if (e.target.id === "modal") closeModal();
}

async function submitModal() {
  const title  = document.getElementById("mTitle").value.trim();
  const desc   = document.getElementById("mDesc").value.trim();
  const expiry = document.getElementById("mExpiry").value;
  if (!title || !desc || !expiry) { toast("Please fill in all fields", "error"); return; }

  btnLoad("modalSubmit", true, "Saving…");
  const url    = editingId ? `${API}/announcements/${editingId}` : `${API}/announcements`;
  const method = editingId ? "PUT" : "POST";

  try {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ title, description: desc, expiryDate: expiry })
    });
    const d = await r.json();
    if (!r.ok) { toast(d.message || "Failed", "error"); return; }
    toast(editingId ? "Announcement updated!" : "Announcement published!", "success");
    closeModal();
    loadAnnouncements();
  } catch { toast("Network error.", "error"); }
  finally  { btnLoad("modalSubmit", false); }
}

async function delAnnouncement(id) {
  if (!confirm("Delete this announcement? This cannot be undone.")) return;
  try {
    const r = await fetch(`${API}/announcements/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const d = await r.json();
    if (!r.ok) { toast(d.message || "Delete failed", "error"); return; }
    toast("Announcement deleted", "success");
    loadAnnouncements();
  } catch { toast("Network error.", "error"); }
}

// ── AI Writer ─────────────────────────────────────────────────────────────

function toggleAiPanel() {
  const panel = document.getElementById("aiPanel");
  if (!panel) return;
  const open = panel.style.display === "none" || panel.style.display === "";
  panel.style.display = open ? "block" : "none";
  if (open) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setPrompt(p) {
  const inp = document.getElementById("aiPrompt");
  if (inp) { inp.value = p; inp.focus(); }
}

async function aiGenerate() {
  const prompt = document.getElementById("aiPrompt")?.value?.trim();
  if (!prompt) { toast("Please enter a prompt for the AI", "error"); return; }

  const btn    = document.getElementById("aiSendBtn");
  const result = document.getElementById("aiResult");
  if (btn) { btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Writing…`; btn.disabled = true; }
  if (result) result.classList.remove("visible");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are an expert corporate communications writer. 
When given a prompt, produce a professional announcement with:
1. A concise, clear title (max 10 words)
2. A well-written description (2-4 paragraphs, professional tone)

IMPORTANT: Respond with ONLY valid JSON in this exact format, no markdown, no extra text:
{"title": "Your title here", "description": "Your description here"}`,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      // If API key missing / unauthorized, show a helpful demo
      if (r.status === 401 || r.status === 403) {
        fillAiDemo(prompt);
        toast("AI demo mode — add your Anthropic API key to enable full AI generation", "info");
        return;
      }
      throw new Error(err.error?.message || "AI request failed");
    }

    const data = await r.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      // fallback: extract title/desc from text
      const lines = text.split("\n").filter(Boolean);
      parsed = { title: lines[0] || "Announcement", description: lines.slice(1).join("\n") || text };
    }

    document.getElementById("aiTitle").value = parsed.title || "";
    document.getElementById("aiDesc").value  = parsed.description || "";
    result.classList.add("visible");
    toast("Draft generated! Review and edit before publishing.", "success");

  } catch (err) {
    console.error(err);
    fillAiDemo(prompt);
    toast("AI demo mode — configure your Anthropic API key for live generation", "info");
  } finally {
    if (btn) { btn.innerHTML = `<i class="fas fa-sparkles"></i> Generate`; btn.disabled = false; }
  }
}

function fillAiDemo(prompt) {
  // Intelligent demo that adapts to keyword in the prompt
  const p = prompt.toLowerCase();
  let title, desc;

  if (p.includes("holiday") || p.includes("closure")) {
    title = "Public Holiday Notice — Office Closure";
    desc  = "Please be informed that our offices will be closed in observance of the upcoming public holiday. All operations will resume on the next working day.\n\nFor urgent matters during the closure period, please contact the on-call team via the emergency line provided in the company directory.\n\nWe thank you for your understanding and wish everyone a restful holiday.";
  } else if (p.includes("maintenance") || p.includes("system") || p.includes("outage")) {
    title = "Scheduled Maintenance Window This Weekend";
    desc  = "Our IT team will be performing scheduled maintenance on core systems this weekend. Services may be intermittently unavailable during this period.\n\nMaintenance window: Saturday 11 PM – Sunday 3 AM. Please save your work and log out before the maintenance begins.\n\nWe apologize for any inconvenience and appreciate your patience as we work to improve system performance.";
  } else if (p.includes("welcome") || p.includes("new member") || p.includes("joining")) {
    title = "Welcome Our Newest Team Member!";
    desc  = "We are thrilled to announce that a new colleague is joining our team. They bring a wealth of experience and fresh perspectives that will undoubtedly strengthen our work.\n\nPlease join us in giving them a warm welcome. We encourage everyone to introduce themselves and help make their onboarding experience as smooth and welcoming as possible.\n\nWe look forward to achieving great things together!";
  } else if (p.includes("policy") || p.includes("guideline") || p.includes("wfh") || p.includes("remote")) {
    title = "Updated Work-From-Home Policy — Effective Immediately";
    desc  = "Following a review of our operational needs, we are updating our remote work guidelines effective this month. Employees may now work from home up to three days per week, subject to manager approval and team requirements.\n\nAll remote employees must remain available during core hours (10 AM – 4 PM) and ensure a stable internet connection. The full policy document has been shared on the company intranet.\n\nPlease reach out to HR if you have any questions regarding these changes.";
  } else {
    title = "Important Announcement from Management";
    desc  = `We would like to share an important update with all team members regarding: ${prompt.slice(0,80)}.\n\nThis initiative is part of our ongoing commitment to transparency and clear communication across the organization. We believe this will have a positive impact on our team's collaboration and effectiveness.\n\nFurther details will be communicated through your department heads. Please don't hesitate to raise any questions during your next team meeting or with HR directly.`;
  }

  document.getElementById("aiTitle").value = title;
  document.getElementById("aiDesc").value  = desc;
  const result = document.getElementById("aiResult");
  if (result) result.classList.add("visible");
}

function useAiDraft() {
  const title = document.getElementById("aiTitle")?.value?.trim();
  const desc  = document.getElementById("aiDesc")?.value?.trim();
  if (!title || !desc) { toast("No AI draft to use", "error"); return; }

  editingId = null;
  document.getElementById("modalTitle").innerHTML = `<i class="fas fa-sparkles"></i> Publish AI Draft`;
  const sub = document.getElementById("modalSubmit");
  if (sub) sub.innerHTML = `<i class="fas fa-paper-plane"></i> <span>Publish</span>`;
  document.getElementById("mTitle").value  = title;
  document.getElementById("mDesc").value   = desc;
  document.getElementById("mExpiry").value = "";
  document.getElementById("modal").classList.add("open");
}

// ── Sidebar toggle ────────────────────────────────────────────────────────

function toggleSidebar() {
  document.getElementById("layout")?.classList.toggle("collapsed");
}

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Populate sidebar user
  const name = getUserName();
  const nameEl = document.getElementById("sidebarName");
  if (nameEl) nameEl.textContent = name;
  const avaEl = document.getElementById("sidebarAva");
  if (avaEl) avaEl.textContent = name.charAt(0).toUpperCase();

  // Greeting
  const greetEl = document.getElementById("greeting");
  if (greetEl) {
    const h = new Date().getHours();
    const g = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    greetEl.textContent = `Good ${g}, ${name}! 👋`;
  }

  // Date
  const dateEl = document.getElementById("currentDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
  }

  // Keyboard shortcut
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });

  if (document.getElementById("list")) loadAnnouncements();
});