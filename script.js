const appRoot = document.getElementById("appRoot");
const logoutBtn = document.getElementById("logoutBtn");
const API_BASE = "/api";

const state = {
  currentRole: null,
  activeMenu: null,
  darkMode: false,
  token: localStorage.getItem("gco_token") || null,
  user: JSON.parse(localStorage.getItem("gco_user") || "null"),
  appointments: [],
  users: [],
  adminOverview: null,
  counselorAnalytics: null,
  counselors: []
};

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (_networkError) {
    throw new Error("Cannot reach API. Open the app via http://localhost:3000 (not file://).");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function setupLogoDisplay() {
  const logoImg = document.getElementById("schoolLogo");
  const logoFallback = document.getElementById("logoFallback");
  if (!logoImg || !logoFallback) return;

  logoImg.addEventListener("load", () => {
    logoImg.style.display = "block";
    logoFallback.style.display = "none";
  });
  logoImg.addEventListener("error", () => {
    logoImg.style.display = "none";
    logoFallback.style.display = "grid";
  });
}

function setDarkMode(enabled) {
  state.darkMode = enabled;
  document.body.style.background = enabled
    ? "linear-gradient(145deg, #09111f 0%, #10203a 100%)"
    : "linear-gradient(145deg, #f8fbff 0%, #eef4ff 100%)";
  document.querySelectorAll(".panel, .card, .top-bar").forEach((el) => {
    el.style.background = enabled ? "#111827" : "";
    el.style.color = enabled ? "#f3f4f6" : "";
    el.style.borderColor = enabled ? "#1f2937" : "";
  });
}

function getRequiredDomainByRole(role) {
  if (role === "student") return "my.xu.edu.ph";
  if (role === "counselor" || role === "admin") return "xu.edu.ph";
  return "";
}

function isValidUniversityEmailForRole(email, role) {
  const requiredDomain = getRequiredDomainByRole(role);
  return email.trim().toLowerCase().endsWith(`@${requiredDomain}`);
}

function renderRoleSelect() {
  const tpl = document.getElementById("roleSelectTpl").content.cloneNode(true);
  appRoot.innerHTML = "";
  appRoot.appendChild(tpl);
  logoutBtn.classList.add("hidden");

  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentRole = btn.dataset.role;
      renderLogin(state.currentRole);
    });
  });
}

function renderLogin(role) {
  const tpl = document.getElementById("loginTpl").content.cloneNode(true);
  appRoot.innerHTML = "";
  appRoot.appendChild(tpl);
  logoutBtn.classList.add("hidden");

  document.getElementById("loginRoleLabel").textContent =
    role.charAt(0).toUpperCase() + role.slice(1);

  const form = document.getElementById("loginForm");
  const message = document.getElementById("loginMessage");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberInput = document.getElementById("rememberMe");

  const remembered = localStorage.getItem(`remember-${role}`);
  if (remembered) {
    emailInput.value = remembered;
    rememberInput.checked = true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!isValidUniversityEmailForRole(email, role)) {
      message.textContent = `Invalid domain for ${role}. Use @${getRequiredDomainByRole(role)}.`;
      message.style.color = "#b91c1c";
      return;
    }

    api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role })
    })
      .then((result) => {
        state.token = result.token;
        state.user = result.user;
        localStorage.setItem("gco_token", result.token);
        localStorage.setItem("gco_user", JSON.stringify(result.user));
        if (rememberInput.checked) localStorage.setItem(`remember-${role}`, email);
        else localStorage.removeItem(`remember-${role}`);
        message.textContent = "Login successful. Redirecting to dashboard...";
        message.classList.add("status-success");
        setTimeout(() => renderDashboard(role), 450);
      })
      .catch((err) => {
        message.textContent = err.message;
        message.style.color = "#b91c1c";
      });
  });

  document.getElementById("backBtn").addEventListener("click", renderRoleSelect);
  document.getElementById("gotoSignupBtn").addEventListener("click", renderSignup);
  document.getElementById("gotoVerifyBtn").addEventListener("click", renderVerify);
}

function renderSignup() {
  const tpl = document.getElementById("signupTpl").content.cloneNode(true);
  appRoot.innerHTML = "";
  appRoot.appendChild(tpl);
  logoutBtn.classList.add("hidden");

  const form = document.getElementById("signupForm");
  const message = document.getElementById("signupMessage");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fullName = document.getElementById("signupFullName").value.trim();
    const role = document.getElementById("signupRole").value;
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;

    if (!isValidUniversityEmailForRole(email, role)) {
      message.textContent = `Invalid domain for ${role}. Use @${getRequiredDomainByRole(role)}.`;
      message.style.color = "#b91c1c";
      return;
    }

    api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password, role })
    })
      .then((result) => {
        const verifyHint = result.devVerifyUrl
          ? ` Demo mode verification link: ${result.devVerifyUrl}`
          : "";
        message.textContent = `${result.message}${verifyHint}`;
        message.className = "feedback status-success";
      })
      .catch((err) => {
        message.textContent = err.message;
        message.style.color = "#b91c1c";
      });
  });

document.getElementById("signupBackBtn").addEventListener("click", () => {
  renderLogin(state.currentRole || "student");
});}

function renderVerify(prefilledToken = "") {
  const tpl = document.getElementById("verifyTpl").content.cloneNode(true);
  appRoot.innerHTML = "";
  appRoot.appendChild(tpl);
  logoutBtn.classList.add("hidden");

  const form = document.getElementById("verifyForm");
  const message = document.getElementById("verifyMessage");
  const tokenInput = document.getElementById("verifyTokenInput");
  if (prefilledToken) tokenInput.value = prefilledToken;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    api("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: tokenInput.value.trim() })
    })
      .then((result) => {
        message.textContent = result.message;
        message.className = "feedback status-success";
      })
      .catch((err) => {
        message.textContent = err.message;
        message.style.color = "#b91c1c";
      });
  });

  document.getElementById("verifyBackBtn").addEventListener("click", renderRoleSelect);
}

function renderDashboard(role) {
  const tpl = document.getElementById("dashboardTpl").content.cloneNode(true);
  appRoot.innerHTML = "";
  appRoot.appendChild(tpl);
  logoutBtn.classList.remove("hidden");
  logoutBtn.onclick = () => {
    state.currentRole = null;
    state.activeMenu = null;
    state.token = null;
    state.user = null;
    localStorage.removeItem("gco_token");
    localStorage.removeItem("gco_user");
    renderRoleSelect();
  };

  const menusByRole = {
    student: ["Overview", "Book Appointment", "My Appointments", "Settings"],
    counselor: ["Calendar", "Requests", "Analytics", "Settings"],
    admin: ["Overview", "Users", "Schedules", "Appointments", "Reports", "Settings"]
  };

  document.getElementById("roleDashboardLabel").textContent =
    `${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`;
  const menuNav = document.getElementById("menuNav");
  if (!state.activeMenu || !menusByRole[role].includes(state.activeMenu)) {
    state.activeMenu = menusByRole[role][0];
  }

  menusByRole[role].forEach((menu) => {
    const btn = document.createElement("button");
    btn.className = `menu-btn ${menu === state.activeMenu ? "active" : ""}`;
    btn.textContent = menu;
    btn.onclick = () => {
      state.activeMenu = menu;
      renderDashboard(role);
    };
    menuNav.appendChild(btn);
  });

  renderViewByRole(role, state.activeMenu).catch((err) => {
    const root = document.getElementById("viewRoot");
    root.innerHTML = `<p class="feedback" style="color:#b91c1c;">${err.message}</p>`;
  });
}

async function renderViewByRole(role, menu) {
  const root = document.getElementById("viewRoot");
  if (!root) return;
  if (role === "student") return renderStudentView(root, menu);
  if (role === "counselor") return renderCounselorView(root, menu);
  if (role === "admin") return renderAdminView(root, menu);
}

async function loadAppointments() {
  state.appointments = await api("/appointments/my");
}

async function loadCounselors() {
  state.counselors = await api("/utility/counselors");
}

async function renderStudentView(root, menu) {
 if (menu === "Overview") {
  let currentDate = new Date();

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    let daysHTML = "";

    let start = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < start; i++) {
      daysHTML += `<div class="empty"></div>`;
    }

    for (let d = 1; d <= totalDays; d++) {
      daysHTML += `<div>${d}</div>`;
    }

    root.innerHTML = `
      <div class="student-dashboard-page">
        <h2 class="dash-title">Dashboard</h2>

        <div class="student-grid">

          <div class="dash-card">
            <div class="card-head">
              <h3>${monthNames[month]} ${year}</h3>
              <div class="arrows">
                <span id="prevMonth">‹</span>
                <span id="nextMonth">›</span>
              </div>
            </div>

            <div class="weekdays">
              <span>Mo</span><span>Tu</span><span>We</span>
              <span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
            </div>

            <div class="calendar-body">
              ${daysHTML}
            </div>
          </div>

          <div class="dash-card appoint-box">
            <div class="card-head">
              <div>
                <h4>Appointments</h4>
                <p>No appointments</p>
              </div>
              <button class="book-now">Book now</button>
            </div>

            <div class="empty-state">
              <div class="calendar-icon">📅</div>
              <small>Start booking for this date</small>
              <button class="make-btn">Make your appointment</button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.getElementById("prevMonth").onclick = () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    };

    document.getElementById("nextMonth").onclick = () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    };
  }

  renderCalendar();
  } else if (menu === "Book Appointment") {
    await loadCounselors();
    if (state.counselors.length === 0) {
      root.innerHTML = `<p class="feedback" style="color:#b91c1c;">No active counselors are available right now. Please contact the office.</p>`;
      return;
    }
    root.innerHTML = `
      <h2 class="section-title">Book New Appointment</h2>
      <form id="bookForm" class="grid-2">
        <label class="field">
          <span>Counselor</span>
          <select id="bookCounselor" required>
            ${state.counselors.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Service Type</span>
          <select id="bookService">
            <option>Personal Counseling</option>
            <option>Academic Advising</option>
            <option>Career Counseling</option>
          </select>
        </label>
        <label class="field">
          <span>Date</span>
          <input type="date" id="bookDate" required />
        </label>
        <label class="field">
          <span>Time Slot</span>
          <input type="time" id="bookTime" required />
        </label>
        <label class="field" style="grid-column:1/-1;">
          <span>Reason / Concern</span>
          <textarea id="bookReason"></textarea>
        </label>
        <button class="btn primary" type="submit">Submit Request</button>
        <button class="btn ghost" type="button" id="clearBookForm">Clear</button>
      </form>
      <p id="bookMsg" class="feedback"></p>
    `;
    document.getElementById("bookForm").addEventListener("submit", (e) => {
      e.preventDefault();
      api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          counselorId: Number(document.getElementById("bookCounselor").value),
          serviceType: document.getElementById("bookService").value,
          date: document.getElementById("bookDate").value,
          time: document.getElementById("bookTime").value,
          reason: document.getElementById("bookReason").value.trim()
        })
      })
        .then((result) => {
          const msg = document.getElementById("bookMsg");
          msg.textContent = `Booking ${result.bookingCode} submitted successfully.`;
          msg.className = "feedback status-success";
          document.getElementById("bookForm").reset();
        })
        .catch((err) => {
          const msg = document.getElementById("bookMsg");
          msg.textContent = err.message;
          msg.style.color = "#b91c1c";
        });
    });
    document.getElementById("clearBookForm").onclick = () => document.getElementById("bookForm").reset();
  } else if (menu === "My Appointments") {
    await loadAppointments();
    const myItems = state.appointments;
    root.innerHTML = `
      <h2 class="section-title">My Appointments</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Counselor</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${myItems.map((a) => `
              <tr>
                <td>${a.booking_code || a.id}</td>
                <td>${a.counselor_name}</td>
                <td>${a.appointment_date?.slice(0,10) || ""}</td>
                <td>${String(a.appointment_time || "").slice(0,5)}</td>
                <td><span class="pill ${a.status}">${a.status}</span></td>
                <td>
                  <button class="btn ghost" data-cancel="${a.id}">Cancel</button>
                  ${a.status === "accepted" ? `<button class="btn ghost" data-resched="${a.id}">Request Reschedule</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    document.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        api(`/appointments/${btn.dataset.cancel}`, { method: "DELETE" }).then(() => renderStudentView(root, "My Appointments"));
      });
    });
    document.querySelectorAll("[data-resched]").forEach((btn) => {
      btn.addEventListener("click", () => {
        api(`/appointments/${btn.dataset.resched}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "reschedule_requested" })
        }).then(() => renderStudentView(root, "My Appointments"));
      });
    });
  } else if (menu === "Settings") {
    root.innerHTML = `
      <h2 class="section-title">Settings</h2>
      <div class="switch-row">
        <span>Dark Mode</span>
        <input type="checkbox" id="darkModeToggle" ${state.darkMode ? "checked" : ""} />
      </div>
      <div class="switch-row">
        <span>Email Notifications</span>
        <input type="checkbox" checked />
      </div>
      <div class="switch-row">
        <span>Session Auto Logout (30 mins)</span>
        <input type="checkbox" checked />
      </div>
      <p class="danger-link" id="deleteAccount">Delete Account</p>
    `;
    document.getElementById("darkModeToggle").onchange = (e) => setDarkMode(e.target.checked);
    document.getElementById("deleteAccount").onclick = () => {
      alert("Demo mode: account deletion request sent to Admin.");
    };
  }
}

async function renderCounselorView(root, menu) {
  await loadAppointments();
  if (menu === "Calendar") {
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    const eventDays = new Set(state.appointments.map((a) => Number((a.appointment_date || "").slice(-2))));
    root.innerHTML = `
      <h2 class="section-title">Calendar of Events</h2>
      <p class="muted">Highlighted days have assigned appointments.</p>
      <div class="calendar-grid">
        ${days.map((d) => `<div class="day-card ${eventDays.has(d) ? "has-event" : ""}">${d}${eventDays.has(d) ? "<br/><span class='pill accepted'>Event</span>" : ""}</div>`).join("")}
      </div>
    `;
  } else if (menu === "Requests") {
    const requests = state.appointments.filter((a) => a.status === "pending");
    root.innerHTML = `
      <h2 class="section-title">Student Requests</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Student</th><th>Date</th><th>Time</th><th>Service</th><th>Action</th></tr></thead>
          <tbody>
            ${requests.map((r) => `
              <tr>
                <td>${r.booking_code || r.id}</td><td>${r.student_name}</td><td>${r.appointment_date?.slice(0,10) || ""}</td><td>${String(r.appointment_time || "").slice(0,5)}</td><td>${r.service_type}</td>
                <td>
                  <button class="btn primary" data-accept="${r.id}">Accept</button>
                  <button class="btn ghost" data-decline="${r.id}">Decline</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    document.querySelectorAll("[data-accept]").forEach((btn) => {
      btn.onclick = () => updateStatus(btn.dataset.accept, "accepted", () => renderCounselorView(root, "Requests"));
    });
    document.querySelectorAll("[data-decline]").forEach((btn) => {
      btn.onclick = () => updateStatus(btn.dataset.decline, "declined", () => renderCounselorView(root, "Requests"));
    });
  } else if (menu === "Analytics") {
    state.counselorAnalytics = await api("/counselor/analytics");
    root.innerHTML = `
      <h2 class="section-title">Counselor Analytics</h2>
      <div class="grid-3">
        <div class="kpi"><strong>${state.counselorAnalytics.yearly}</strong>Total this year</div>
        <div class="kpi"><strong>${state.counselorAnalytics.monthly}</strong>Total this month</div>
        <div class="kpi"><strong>${state.counselorAnalytics.weekly}</strong>Total this week</div>
      </div>
      <p class="muted" style="margin-top:1rem;">Monthly/weekly/yearly views can be expanded with backend reports and Google Sheets sync.</p>
    `;
  } else if (menu === "Settings") {
    root.innerHTML = `
      <h2 class="section-title">Counselor Settings</h2>
      <label class="field">
        <span>Set Available Days</span>
        <input type="text" value="Mon-Fri, 8:00 AM - 5:00 PM" />
      </label>
      <label class="field">
        <span>Mark Unavailable Dates</span>
        <input type="text" placeholder="e.g., 2026-04-25, 2026-04-26" />
      </label>
      <button class="btn primary" style="margin-top:0.8rem;">Save Availability</button>
    `;
  }
}

async function renderAdminView(root, menu) {
  if (menu !== "Overview") await loadAppointments();
  if (menu === "Overview") {
    state.adminOverview = await api("/admin/overview");
    root.innerHTML = `
      <h2 class="section-title">Admin Overview</h2>
      <div class="grid-3">
        <div class="kpi"><strong>${state.adminOverview.totalUsers}</strong>Registered users</div>
        <div class="kpi"><strong>${state.adminOverview.totalAppointments}</strong>Total bookings</div>
        <div class="kpi"><strong>${state.adminOverview.pendingRequests}</strong>Open requests</div>
      </div>
      <p class="muted" style="margin-top:1rem;">Admin has system-wide visibility and can manage users, schedules, and all appointments.</p>
    `;
  } else if (menu === "Users") {
    state.users = await api("/admin/users");
    root.innerHTML = `
      <h2 class="section-title">User Management</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            ${state.users.map((u) => `<tr><td>${u.full_name}</td><td>${u.role}</td><td>${u.email}</td><td>${u.is_active ? "Active" : "Inactive"}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else if (menu === "Schedules") {
    await loadCounselors();
    root.innerHTML = `
      <h2 class="section-title">Counselor Schedules</h2>
      <p>Admin can monitor counselor coverage and workload allocation.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Counselor</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            ${state.counselors.map((c) => `<tr><td>${c.name}</td><td>${c.email}</td><td>Active</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else if (menu === "Appointments") {
    root.innerHTML = `
      <h2 class="section-title">All Appointments</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Student</th><th>Counselor</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
          <tbody>
            ${state.appointments.map((a) => `
              <tr>
                <td>${a.booking_code || a.id}</td><td>${a.student_name}</td><td>${a.counselor_name}</td><td>${a.appointment_date?.slice(0,10) || ""}</td><td>${String(a.appointment_time || "").slice(0,5)}</td>
                <td><span class="pill ${a.status}">${a.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else if (menu === "Reports") {
    root.innerHTML = `
      <h2 class="section-title">Reports and Integrations</h2>
      <ul>
        <li>Google Sheets (read-only sync for reporting)</li>
        <li>Gmail API for notification triggers</li>
        <li>Audit logs for booking and schedule actions</li>
      </ul>
      <button class="btn primary">Generate Monthly Report</button>
    `;
  } else if (menu === "Settings") {
    root.innerHTML = `
      <h2 class="section-title">System Settings</h2>
      <div class="switch-row"><span>Enable Emergency Coverage Rule</span><input type="checkbox" checked /></div>
      <div class="switch-row"><span>Enforce Session Timeout</span><input type="checkbox" checked /></div>
      <div class="switch-row"><span>Enable Activity Logging</span><input type="checkbox" checked /></div>
      <p class="muted">Security baseline: HTTPS, password hashing, RBAC, input validation, and account verification.</p>
    `;
  }
}

function updateStatus(id, status, callback) {
  api(`/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  })
    .then(callback)
    .catch((err) => {
      alert(err.message);
    });
}

const verifyTokenFromUrl = new URLSearchParams(window.location.search).get("verifyToken");
if (verifyTokenFromUrl) {
  renderVerify(verifyTokenFromUrl);
} else if (state.user && state.token) {
  state.currentRole = state.user.role;
  renderDashboard(state.user.role);
} else {
  renderRoleSelect();
}

setupLogoDisplay();

function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);

  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = "👁";
  } else {
    input.type = "password";
    icon.innerHTML = "👁‍🗨";
  }
}