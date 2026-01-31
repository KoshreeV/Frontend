
// in d:\frontend\js\script.js
const BASE_URL = "https://backend-a9pu.onrender.com/api/v1";


async function register() {
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;

  if (!email || !password || !confirmPassword) {
    alert("Please fill all fields");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Registration failed");
      return;
    }

    alert("Registration successful! Please login.");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Registration error:", error);
    alert("Registration error: " + error.message);
  }
}

// ---------- LOGIN ----------
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please fill all fields");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      alert(data.message || "Login failed");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);

    if (data.role === "ADMIN") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "employee.html";
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Login error: " + error.message);
  }
}


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


function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

if (document.getElementById("list")) {
  loadAnnouncements();
}
