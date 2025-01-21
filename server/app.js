const express = require("express");
const http = require("http");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { Server } = require("socket.io");
const fs = require("fs");
const db = require("./database");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "quiz-game-secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(express.static("public"));
app.use("/dashboard", express.static("dashboard"));

let questions = JSON.parse(fs.readFileSync("./server/questions.json"));
let rooms = {};

// User routes
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashedPassword],
    (err) => {
      if (err) return res.status(400).send("User exists");
      res.status(201).send("User registered");
    }
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err || !user || !(await bcrypt.compare(password, user.password)))
        return res.status(401).send("Invalid credentials");
      req.session.userId = user.id;
      res.send("Login successful");
    }
  );
});

app.get("/create-quiz", (req, res) => {
  res.sendFile(__dirname + "/dashboard/index.html");
});

app.get("/join-room", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Socket.io handling
io.on("connection", (socket) => {
  console.log("A user connected", socket.id);
  socket.on("create-room", (room) => {
    rooms[room] = [];
    socket.join(room);
    console.log(`Room created: ${room}`);
  });
  socket.on("join-room", (room) => {
    if (rooms[room]) {
      socket.join(room);
      rooms[room].push(socket.id);
      console.log(`User joined room: ${room}`);
    } else {
      socket.emit("room-error", "Room not found");
    }
  });
});

server.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
