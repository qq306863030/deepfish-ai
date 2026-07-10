//#!/usr/bin/env node

import { startServer } from './service/index';
import { startAgentRoomServer } from './service/agent-room/server';
import { logSuccess } from '@/server/utils/print';

// 启动服务器
startServer({
  onReady: (httpServer) => {
    // 将 agent-room WebSocket 附着到同一个 HTTP server，共享Port与生命周期
    startAgentRoomServer({ httpServer, path: '/agent-room' });
    logSuccess('PM2 Service started');
  },
});
