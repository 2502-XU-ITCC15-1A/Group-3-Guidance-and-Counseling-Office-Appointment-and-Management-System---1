const express = require("express");
const cors = require("cors");
const path = require("path");   // ADD THIS
const app = express();

app.use(cors());
app.use(express.json());

/* SERVE FRONTEND FILES */
app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// Temporary in-memory users
let users = [];

/* SIGNUP */
app.post("/api/auth/signup", (req, res) => {
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ message: "All fields required" });
  }

  const exists = users.find(u => u.email === email);
  if (exists) {
    return res.status(400).json({ message: "Email already exists" });
  }

  users.push({
    id: Date.now(),
    fullName,
    email,
    password,
    role
  });

  res.json({
    message: "Account created successfully!"
  });
});

/* LOGIN */
app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;

  const user = users.find(
    u =>
      u.email === email &&
      u.password === password &&
      u.role === role
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials"
    });
  }

  res.json({
    token: "demo-token",
    user
  });
});

/* START SERVER */
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});