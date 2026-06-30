const io = require('socket.io-client');
const socket = io('http://localhost:5500');

// Initial coordinate starting points (Manhattan)
let currentLat = 40.7128;
let currentLng = -74.0060;

console.log("Starting Real-Time Fleet Telemetry hardware simulator...");

socket.on('connect', () => {
    console.log("Connected to local tracking gateway. Sending GPS telemetry stream...");
    
    setInterval(() => {
        // Move slightly north-east every cycle
        currentLat += 0.0004;
        currentLng += 0.0006;
        
        console.log(`[Ping GPS] Vehicle 1 Position -> Lat: ${currentLat.toFixed(4)}, Lng: ${currentLng.toFixed(4)}`);
        
        socket.emit('update_location', {
            vehicle_id: 1,
            lat: currentLat,
            lng: currentLng
        });
    }, 2500); // Emits new positions every 2.5 seconds
});