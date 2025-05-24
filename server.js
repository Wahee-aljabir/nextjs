const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Pusher = require('pusher');

const app = express();
const SECRET_KEY = 'your-secret-key';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// SQLite setup
const db = new sqlite3.Database('./chat-app.db', (err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Create rooms table (with is_private)
db.run(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,
    is_private BOOLEAN DEFAULT 0
  );
`);

// Create messages table
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    message TEXT,
    user_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Create room_permissions table
db.run(`
  CREATE TABLE IF NOT EXISTS room_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    can_view BOOLEAN DEFAULT 1,
    can_message BOOLEAN DEFAULT 1,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Pusher setup
const pusher = new Pusher({
  appId: '1973708',
  key: '28e44a48a94c5b1504fd',
  secret: '5064df22f704e80d1036',
  cluster: 'eu',
  useTLS: true
});

// Helper: Authenticate JWT
function authenticateToken(req, res, next) {
  console.log("Authenticating token...");
  const authHeader = req.headers['authorization'];
  console.log("Auth header:", authHeader);
  const token = authHeader && authHeader.split(' ')[1];
  console.log("Token:", token);
  if (!token) return res.sendStatus(401);
  console.log(authHeader)

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Route: Signup
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
    if (row) return res.status(400).json({ error: "Username already exists" });

    bcrypt.hash(password, 10, (err, hash) => {
      db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function (err) {
        if (err) return res.status(500).json({ error: "Error creating user" });
        const token = jwt.sign({ id: this.lastID, username }, SECRET_KEY);
        res.json({ token });
      });
    });
  });
});

// Route: Signin
app.post("/signin", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(400).json({ error: "Invalid username or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (valid) {
      const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
      res.json({ userId: user.id, username: user.username, token });
    } else {
      res.status(400).json({ error: "Invalid username or password" });
    }
  });
});

// Route: Create a chat room (with permissions and allowed users)
app.post("/create-room", authenticateToken, (req, res) => {
  const { name, description, isPrivate, allowedUsers } = req.body;
  const userId = req.user.id;

  if (!name || !description) {
    return res.status(400).json({ error: "Room name and description are required" });
  }

  db.run('BEGIN TRANSACTION', err => {
    if (err) return res.status(500).json({ error: "Transaction failed" });

    db.run(
      `INSERT INTO rooms (name, description, user_id, is_private)
       VALUES (?, ?, ?, ?)`,
      [name, description, userId, isPrivate ? 1 : 0],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: "Failed to create room" });
        }

        const roomId = this.lastID;
        if (isPrivate) {
          const allowed = Array.isArray(allowedUsers) ? allowedUsers : [];
          console.log(`Private room created (ID: ${roomId}). Allowed users: [${[userId, ...allowed].join(', ')}]`);
        }

        // Add permission for room creator
        db.run(
          'INSERT INTO room_permissions (room_id, user_id, can_view, can_message) VALUES (?, ?, 1, 1)',
          [roomId, userId],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: "Failed to set creator permissions" });
            }
            // If private room, add permissions for selected users
            if (isPrivate && Array.isArray(allowedUsers) && allowedUsers.length > 0) {
              const stmt = db.prepare(
                'INSERT INTO room_permissions (room_id, user_id, can_view, can_message) VALUES (?, ?, 1, 1)'
              );
              let permissionError = false;
              let completed = 0;
              allowedUsers.forEach(allowedUserId => {
                stmt.run([roomId, allowedUserId], function(err) {
                  if (err) permissionError = true;
                  completed++;
                  if (completed === allowedUsers.length) {
                    stmt.finalize(err => {
                      if (err || permissionError) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: "Failed to set user permissions" });
                      }
                      db.run('COMMIT', err => {
                        if (err) {
                          db.run('ROLLBACK');
                          return res.status(500).json({ error: "Failed to commit transaction" });
                        }
                        res.json({
                          success: true,
                          room: { id: roomId, name, description, isPrivate }
                        });
                      });
                    });
                  }
                });
              });
            } else {
              db.run('COMMIT', err => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: "Failed to commit transaction" });
                }
                res.json({
                  success: true,
                  room: { id: roomId, name, description, isPrivate }
                });
              });
            }
          }
        );
      }
    );
  });
});

// Route: Get all rooms the user can access
app.get("/rooms", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const query = `
    SELECT DISTINCT r.*, r.user_id
    FROM rooms r
    LEFT JOIN room_permissions rp ON r.id = rp.room_id
    WHERE r.is_private = 0 
    OR r.user_id = ? 
    OR (rp.user_id = ? AND rp.can_view = 1)
  `;
  db.all(query, [userId, userId], (err, rooms) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch rooms' });
    res.json(rooms);
  });
});

// Route: Get room details (with permission logging)
app.get('/room/:id', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.id;

  const roomQuery = `
    SELECT r.*, u.username as owner_username
    FROM rooms r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN room_permissions rp ON r.id = rp.room_id
    WHERE r.id = ? 
    AND (r.is_private = 0 
    OR r.user_id = ? 
    OR (rp.user_id = ? AND rp.can_view = 1))
  `;

  db.get(roomQuery, [roomId, userId, userId], (err, room) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch room' });
    if (!room) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch users in the room (creator + allowed users)
    const usersQuery = `
      SELECT DISTINCT u.id, u.username
      FROM users u
      JOIN room_permissions rp ON u.id = rp.user_id
      WHERE rp.room_id = ?
      UNION
      SELECT u.id, u.username
      FROM users u
      JOIN rooms r ON u.id = r.user_id
      WHERE r.id = ?
    `;
    db.all(usersQuery, [roomId, roomId], (err, users) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch users' });
      res.json({ ...room, users });
    });
  });
});

// Route: Get message history for a room (with permission check)
app.get('/messages/:roomId', authenticateToken, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;

  const query = `
    SELECT DISTINCT m.id, m.room_id, m.message, m.user_id, m.timestamp, u.username
    FROM messages m
    JOIN users u ON m.user_id = u.id
    JOIN rooms r ON m.room_id = r.id
    LEFT JOIN room_permissions rp ON r.id = rp.room_id AND rp.user_id = ?
    WHERE m.room_id = ?
      AND (r.is_private = 0 OR r.user_id = ? OR (rp.user_id = ? AND rp.can_view = 1))
    ORDER BY m.timestamp ASC
  `;

  db.all(query, [userId, roomId, userId, userId], (err, messages) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch messages' });
    res.json(messages);
  });
});

// Route: Send a message
app.post('/message', authenticateToken, (req, res) => {
  const { roomId, message } = req.body;
  const userId = req.user.id;

  db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(500).json({ error: "Failed to get username" });

    db.run(`INSERT INTO messages (room_id, message, user_id) VALUES (?, ?, ?)`, [roomId, message, userId], function (err) {
      if (err) return res.status(500).json({ error: "Failed to send message" });

      pusher.trigger(`room-${roomId}`, 'new-message', {
        message,
        userId,
        username: user.username, // <-- include username
        timestamp: new Date().toISOString()
      });

      res.json({ success: true });
    });
  });
});

// Route: Get all users (for room permissions UI)
app.get('/users', authenticateToken, (req, res) => {
  db.all('SELECT id, username FROM users', [], (err, users) => {
    if (err) return res.status(500).json({ error: "Failed to fetch users" });
    res.json(users);
  });
});

// Route: Get all rooms created by the logged-in user
app.get('/my-rooms', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM rooms WHERE user_id = ?`, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch rooms" });
    res.json(rows);
  });
});

// Route: Leave a room (remove user's permission)
app.post('/rooms/:id/leave', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.id;

  // Prevent owner from leaving their own room
  db.get('SELECT user_id FROM rooms WHERE id = ?', [roomId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Room not found' });
    if (row.user_id === userId) {
      return res.status(400).json({ error: 'Owner cannot leave their own room' });
    }

    // Remove permission
    db.run('DELETE FROM room_permissions WHERE room_id = ? AND user_id = ?', [roomId, userId], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to leave room' });
      return res.json({ success: true });
    });
  });
});

// Route: Get message stats per day (all users, all time)
app.get('/stats/messages-per-day', authenticateToken, (req, res) => {
  db.all(
    `SELECT DATE(timestamp) as date, COUNT(*) as count
     FROM messages
     GROUP BY DATE(timestamp)
     ORDER BY DATE(timestamp) ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch stats' });
      res.json(rows);
    }
  );
});

// Route: Get number of messages sent today (all users)
app.get('/stats/messages-today', authenticateToken, (req, res) => {
  db.get(
    `SELECT COUNT(*) as count
     FROM messages
     WHERE DATE(timestamp) = DATE('now', 'localtime')`,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch today\'s message count' });
      res.json({ count: row.count });
    }
  );
});

// Route: Get total number of users
app.get('/stats/total-users', authenticateToken, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch user count' });
    res.json({ count: row.count });
  });
});

// Route: Get number of active users today (sent at least one message today) and their usernames
app.get('/stats/active-users-today', authenticateToken, (req, res) => {
  db.all(
    `SELECT DISTINCT u.username
     FROM messages m
     JOIN users u ON m.user_id = u.id
     WHERE DATE(m.timestamp) = DATE('now', 'localtime')`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch active users' });
      const usernames = rows.map(r => r.username);
      res.json({ count: usernames.length, usernames });
    }
  );
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Route: Get number of messages sent per hour (9am-9pm) today
app.get('/stats/messages-by-hour-today', authenticateToken, (req, res) => {
  db.all(
    `SELECT strftime('%H', timestamp, 'localtime') as hour, COUNT(*) as count
     FROM messages
     WHERE DATE(timestamp, 'localtime') = DATE('now', 'localtime')
       AND CAST(strftime('%H', timestamp, 'localtime') AS INTEGER) BETWEEN 9 AND 21
     GROUP BY hour
     ORDER BY hour ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch hourly stats' });
      // Fill missing hours with 0
      const result = [];
      for (let h = 9; h <= 21; h++) {
        const hourStr = h.toString().padStart(2, '0');
        const found = rows.find(r => r.hour === hourStr);
        result.push({ hour: hourStr, count: found ? found.count : 0 });
      }
      res.json(result);
    }
  );
});

// Route: Get all rooms with total message count, sorted by popularity (most messages)
app.get('/stats/rooms-by-popularity', authenticateToken, (req, res) => {
  db.all(
    `SELECT r.id, r.name, r.description, u.username as owner, COUNT(m.id) as message_count
     FROM rooms r
     LEFT JOIN messages m ON r.id = m.room_id
     JOIN users u ON r.user_id = u.id
     GROUP BY r.id
     ORDER BY message_count DESC, r.id ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch rooms' });
      res.json({ total: rows.length, rooms: rows });
    }
  );
});

// Route: Get message count per room for bar chart
app.get('/stats/messages-per-room', authenticateToken, (req, res) => {
  db.all(
    `SELECT r.name, COUNT(m.id) as message_count
     FROM rooms r
     LEFT JOIN messages m ON r.id = m.room_id
     GROUP BY r.id
     ORDER BY message_count DESC, r.id ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch messages per room' });
      res.json(rows);
    }
  );
});

// Add member to room
app.post('/room/:id/add-member', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  const { username } = req.body;

  // Check if user exists
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if user is already a member
    db.get(
      'SELECT * FROM room_permissions WHERE room_id = ? AND user_id = ?',
      [roomId, user.id],
      (err, permission) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (permission) return res.status(400).json({ error: 'User is already a member' });

        // Add user to room
        db.run(
          'INSERT INTO room_permissions (room_id, user_id) VALUES (?, ?)',
          [roomId, user.id],
          (err) => {
            if (err) return res.status(500).json({ error: 'Failed to add member' });
            res.json({ success: true });
          }
        );
      }
    );
  });
});

// Get room members
app.get('/room/:id/members', authenticateToken, (req, res) => {
  const roomId = req.params.id;
  
  db.all(
    `SELECT u.username 
     FROM room_permissions rp 
     JOIN users u ON rp.user_id = u.id 
     WHERE rp.room_id = ?`,
    [roomId],
    (err, members) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch members' });
      res.json(members);
    }
  );
});