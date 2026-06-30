const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
// Use the new built-in Node.js SQLite module (No npm packages needed!)
const { DatabaseSync } = require('node:sqlite'); 

const app = express();
// Change app.use(cors()); to:
app.use(cors({ origin: '*' }));app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Initialize Native SQLite database file
const dbPath = path.resolve(__dirname, 'logistics.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables
db.exec(`CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_number TEXT UNIQUE NOT NULL,
    driver_name TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    current_lat REAL,
    current_lng REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT UNIQUE NOT NULL,
    vehicle_id INTEGER,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    estimated_delivery TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS telemetry_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Seed mock vehicle data if empty
const countQuery = db.prepare("SELECT COUNT(*) as count FROM vehicles").get();
if (countQuery && countQuery.count === 0) {
    db.exec(`INSERT INTO vehicles (vehicle_number, driver_name, status, current_lat, current_lng) VALUES 
        ('TRUCK-001', 'John Doe', 'en_route', 40.7128, -74.0060),
        ('TRUCK-002', 'Jane Smith', 'idle', 40.7306, -73.9352)`);
    
    db.exec(`INSERT INTO shipments (tracking_number, vehicle_id, origin, destination, status) VALUES 
        ('TRACK-999A', 1, 'Manhattan Hub', 'Brooklyn Depot', 'out_for_delivery'),
        ('TRACK-888B', 2, 'Queens Hub', 'Bronx Sorting', 'pending')`);
    console.log("Database seeded with native sample tracking data.");
}

// --- REST API ENDPOINTS ---

app.get('/api/vehicles', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM vehicles').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics', (req, res) => {
    try {
        const fleet = db.prepare('SELECT COUNT(*) as total FROM vehicles').get();
        const active = db.prepare("SELECT COUNT(*) as active FROM shipments WHERE status = 'out_for_delivery'").get();
        const delivered = db.prepare("SELECT COUNT(*) as delivered FROM shipments WHERE status = 'delivered'").get();
        
        res.json({
            totalVehicles: fleet.total,
            activeShipments: active.active,
            deliveredCount: delivered.delivered
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/route-optimize', (req, res) => {
    const { start, end } = req.body;
    if (!start || !end) return res.status(400).json({ error: "Missing coordinates" });

    const steps = 4;
    const optimizedWaypoints = [];
    for(let i = 0; i <= steps; i++) {
        const t = i / steps;
        optimizedWaypoints.push({
            lat: start.lat + (end.lat - start.lat) * t,
            lng: start.lng + (end.lng - start.lng) * t
        });
    }
    res.json({ status: "optimized", route: optimizedWaypoints, distance_km: 8.7 });
});

// --- REAL-TIME WEBSOCKET ROUTING ---
io.on('connection', (socket) => {
    console.log(`Tracking client active: ${socket.id}`);

    socket.on('update_location', (data) => {
        const { vehicle_id, lat, lng } = data;
        
        try {
            db.prepare('UPDATE vehicles SET current_lat = ?, current_lng = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(lat, lng, vehicle_id);
              
            db.prepare('INSERT INTO telemetry_logs (vehicle_id, lat, lng) VALUES (?, ?, ?)')
              .run(vehicle_id, lat, lng);

            io.emit('location_broadcast', { vehicle_id, lat, lng });
        } catch (err) {
            console.error("Database update error:", err.message);
        }
    });
});

const PORT = 5500;
server.listen(PORT, () => console.log(`Logistics Server operational on http://localhost:${PORT}`));