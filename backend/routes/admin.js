const express = require('express');
const os = require('os');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const Call = require('../models/Call');

router.use(authMiddleware);
router.use(adminOnly);

router.get('/overview', async (req, res) => {
    try {
        const socketData = req.app.get('socketData');
        const { userSockets } = socketData || {};

        // Online users from socket.io in-memory state
        const onlineUserIds = userSockets ? Array.from(userSockets.keys()) : [];
        const onlineUsers = onlineUserIds.length;

        // Active calls from DB (more reliable than in-memory maps)
        const dbCalls = await Call.find({ status: { $in: ['ringing', 'active'] } })
            .select('_id type participants startedAt chat')
            .lean();

        const now = Date.now();
        const callsData = dbCalls.map(c => ({
            callId: String(c._id),
            type: c.type,
            participants: c.participants
                .filter(p => !p.leftAt)
                .map(p => String(p.user)),
            durationSec: Math.floor((now - new Date(c.startedAt).getTime()) / 1000)
        }));

        // Server stats using only Node.js built-ins
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const server = {
            uptimeSec: Math.floor(process.uptime()),
            memoryMb: Math.round(memUsage.heapUsed / 1024 / 1024),
            memoryTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
            loadAvg: os.loadavg(),
            cpuUser: Math.round(cpuUsage.user / 1000), // microseconds to ms
            cpuSystem: Math.round(cpuUsage.system / 1000)
        };

        res.json({
            onlineUsers,
            onlineUserIds,
            activeCalls: callsData,
            server
        });
    } catch (err) {
        console.error('[Admin] overview error:', err);
        res.status(500).json({ error: 'overview_failed' });
    }
});

module.exports = router;
