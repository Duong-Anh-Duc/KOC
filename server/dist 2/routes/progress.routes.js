"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const progress_service_1 = require("../services/progress.service");
const router = (0, express_1.Router)();
/**
 * GET /api/progress/:taskId
 * SSE endpoint for receiving real-time progress updates
 */
router.get('/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();
    // Send initial progress event to confirm connection
    res.write(`event: progress\ndata: ${JSON.stringify({ step: 0, total: 0, percent: 0, message: 'Connected', done: false })}\n\n`);
    // Register client
    progress_service_1.ProgressService.addClient(taskId, res);
    // Clean up on disconnect
    req.on('close', () => {
        progress_service_1.ProgressService.removeClient(taskId, res);
    });
});
exports.default = router;
//# sourceMappingURL=progress.routes.js.map