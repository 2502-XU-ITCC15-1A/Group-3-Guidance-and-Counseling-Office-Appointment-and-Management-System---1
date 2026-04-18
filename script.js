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
  student: ["Overview", "My Appointments", "Notifications", "Settings"],
  counselor: ["Calendar", "Requests", "Analytics", "Settings"],
  admin: ["Overview", "Users", "Schedules", "Appointments", "Reports", "Settings"]
  };
  
  document.getElementById("roleDashboardLabel").textContent =
    `${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`;
  const menuNav = document.getElementById("menuNav");
  if (!state.activeMenu || !menusByRole[role].includes(state.activeMenu)) {
    state.activeMenu = menusByRole[role][0];
  }

menuNav.innerHTML = "";

/* top menus only */
menusByRole[role]
  .filter(menu => menu !== "Settings")
  .forEach((menu) => {
    const btn = document.createElement("button");
    btn.className = `menu-btn ${menu === state.activeMenu ? "active" : ""}`;
    btn.textContent = menu;

    btn.onclick = () => {
      state.activeMenu = menu;
      renderDashboard(role);
    };

    menuNav.appendChild(btn);
  });

/* spacer pushes bottom buttons */
const spacer = document.createElement("div");
spacer.style.flex = "1";
menuNav.appendChild(spacer);

/* settings button */
const settingsBtn = document.createElement("button");
settingsBtn.className = `menu-btn ${state.activeMenu === "Settings" ? "active" : ""}`;
settingsBtn.textContent = "Settings";
settingsBtn.onclick = () => {
  state.activeMenu = "Settings";
  renderDashboard(role);
};
menuNav.appendChild(settingsBtn);

/* logout button */
const sideLogout = document.createElement("button");
sideLogout.className = "menu-btn";
sideLogout.textContent = "Logout";
sideLogout.onclick = () => {
  state.currentRole = null;
  state.activeMenu = null;
  state.token = null;
  state.user = null;
  localStorage.removeItem("gco_token");
  localStorage.removeItem("gco_user");
  renderRoleSelect();
};
menuNav.appendChild(sideLogout);

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
  try {
    state.counselors = await api("/utility/counselors");
  } catch (error) {
    state.counselors = [
      { id: 1, name: "Default Counselor" }
    ];
  }
}
async function renderStudentView(root, menu) {
 if (menu === "Overview") {
  let currentDate = new Date();

  function renderCalendar() {
    const savedBooking = JSON.parse(localStorage.getItem("studentBooking") || "null");
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    let start = firstDay === 0 ? 6 : firstDay - 1;
    let daysHTML = "";

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
                <p>${savedBooking ? "1 appointment scheduled" : "No appointments"}</p>
              </div>

              <button class="book-now openBooking">Book now</button>
            </div>

            ${
              savedBooking
                ? `
                <div class="booked-item">
                  <div><strong>${savedBooking.time}</strong></div>
                  <div>${savedBooking.name}</div>
                  <div>${savedBooking.type}</div>
                  <button class="view-btn">View</button>
                </div>
              `
                : `
                <div class="empty-state">
                  <div class="calendar-icon"></div>
                  <small>Start booking for this date</small>
                  <button class="make-btn openBooking">Make your appointment</button>
                </div>
              `
            }

          </div>
        </div>
      </div>

      <div class="booking-modal hidden" id="bookingModal">
        <div class="booking-box">

          <div class="modal-top">
            <h3>New Counseling Appointment</h3>
            <button id="closeModal">✕</button>
          </div>

          <form id="bookingForm">

            <input type="text" id="bkName" placeholder="Full Name" required>
            <input type="email" id="bkEmail" placeholder="Email" required>

            <div class="two-col">
              <select id="bkType">
                <option>Mental Health</option>
                <option>Academic Concern</option>
                <option>Career Counseling</option>
              </select>

              <input type="time" id="bkTime" required>
            </div>

            <textarea id="bkNotes" placeholder="Additional Notes"></textarea>

            <div class="modal-actions">
              <button type="button" id="closeBtn">Cancel</button>
              <button type="submit" class="confirm-btn">Confirm Booking</button>
            </div>

          </form>

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

    document.querySelectorAll(".openBooking").forEach(btn => {
      btn.onclick = () => {
        document.getElementById("bookingModal").classList.remove("hidden");
      };
    });

    document.getElementById("closeModal").onclick = closeModal;
    document.getElementById("closeBtn").onclick = closeModal;

    function closeModal() {
      document.getElementById("bookingModal").classList.add("hidden");
    }

    document.getElementById("bookingForm").onsubmit = (e) => {
      e.preventDefault();

      const booking = {
        name: document.getElementById("bkName").value,
        type: document.getElementById("bkType").value,
        time: document.getElementById("bkTime").value
      };

      localStorage.setItem("studentBooking", JSON.stringify(booking));
      renderCalendar();
    };
  }

  renderCalendar();
} else if (menu === "Calendar") {

  renderCalendar();
  } else if (menu === "Book Appointment") {

  root.innerHTML = `
    <div class="book-page">

      <h1 class="book-title">Book Appointment</h1>
      <p class="book-sub">Schedule your counseling session easily.</p>

      <form id="bookForm">
        <div class="book-grid">

          <div class="book-card">
            <h3>Appointment Details</h3>

            <div class="book-field">
              <label>Counselor</label>
              <select id="bookCounselor">
                <option value="1">Default Counselor</option>
              </select>
            </div>

            <div class="book-field">
              <label>Service Type</label>
              <select id="bookService">
                <option>Personal Counseling</option>
                <option>Academic Advising</option>
                <option>Career Counseling</option>
              </select>
            </div>

            <div class="book-field">
              <label>Date</label>
              <input type="date" id="bookDate">
            </div>

            <div class="book-field">
              <label>Time</label>
              <input type="time" id="bookTime">
            </div>
          </div>

          <div class="book-card">
            <h3>Additional Notes</h3>

            <div class="book-field">
              <label>Reason</label>
              <textarea id="bookReason"></textarea>
            </div>

            <button class="book-btn" type="submit">
              Submit Appointment
            </button>
          </div>

        </div>
      </form>

      <p id="bookMsg" class="feedback"></p>
    </div>
  `;

  document.getElementById("bookForm").addEventListener("submit", (e) => {
    e.preventDefault();

    document.getElementById("bookMsg").textContent =
      "Demo mode: Appointment submitted successfully.";
    document.getElementById("bookMsg").className =
      "feedback status-success";
  });
   
 } else if (menu === "My Appointments") {

  const booking = JSON.parse(localStorage.getItem("studentBooking") || "null");

  if (!booking) {
    root.innerHTML = `
      <h2 class="section-title">My Appointments</h2>
      <p class="muted">No appointments found.</p>
    `;
    return;
  }

  root.innerHTML = `
    <h2 class="section-title">My Appointments</h2>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Name</th>
            <th>Concern</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>${booking.time}</td>
            <td>${booking.name}</td>
            <td>${booking.type}</td>
            <td><span class="pill accepted">Scheduled</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  } else if (menu === "Notifications") {
  root.innerHTML = `
    <h2 class="section-title">Notifications</h2>

    <div class="notif-page">

      <div class="notif-item">
        <div class="notif-left">
          <strong>Your booking on April 18, 2026 was Cancelled</strong>
          <small>Please reschedule your booking</small>
        </div>
        <span>April 17, 2026 at 9:30 AM</span>
      </div>

      <div class="notif-item">
        <div class="notif-left">
          <strong>Your booking on April 18, 2026 was Approved</strong>
          <small>Please arrive on time</small>
        </div>
        <span>April 17, 2026 at 9:30 AM</span>
      </div>

      <div class="notif-item">
        <div class="notif-left">
          <strong>Your booking on April 18, 2026 was Rescheduled</strong>
          <small>Your reschedule was confirmed</small>
        </div>
        <span>April 17, 2026 at 9:30 AM</span>
      </div>

      <div class="notif-item">
        <div class="notif-left">
          <strong>You canceled your booking on April 18, 2026</strong>
          <small>Your request has been confirmed</small>
        </div>
        <span>April 17, 2026 at 9:30 AM</span>
      </div>

    </div>
  `;
  
} else if (menu === "Settings") {
  root.innerHTML = `
    <h2 class="section-title">Settings</h2>

    <div class="settings-simple">

      <div class="setting-row">
        <div class="setting-info">
          <strong>🌙 Dark Mode</strong>
          <small>Enable dark theme interface</small>
        </div>

        <label class="switch">
          <input type="checkbox" id="darkModeToggle" ${state.darkMode ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </div>

    </div>
  `;

  document.getElementById("darkModeToggle").onchange = (e) => {
    setDarkMode(e.target.checked);
  };
}

} // closes renderStudentView

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