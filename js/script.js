// 🔴 CHANGE THIS after backend is deployed
const BASE_URL = "https://your-backend.onrender.com/api/v1";

// ---------- LOGIN ----------
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!data.token) {
    alert("Login failed");
    return;
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);

  if (data.role === "ADMIN") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "employee.html";
  }
}

// ---------- CREATE ANNOUNCEMENT ----------
async function createAnnouncement() {
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const expiryDate = document.getElementById("expiryDate").value;

  await fetch(`${BASE_URL}/announcements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ title, description, expiryDate })
  });

  alert("Announcement created");
}

// ---------- LOAD ANNOUNCEMENTS ----------
async function loadAnnouncements() {
  const res = await fetch(`${BASE_URL}/announcements`, {
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    }
  });

  const data = await res.json();
  const list = document.getElementById("list");

  list.innerHTML = "";

  data.forEach(a => {
    list.innerHTML += `
      <div class="card">
        <h3>${a.title}</h3>
        <p>${a.description}</p>
      </div>
    `;
  });
}

// ---------- LOGOUT ----------
function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

if (document.getElementById("list")) {
  loadAnnouncements();
}
