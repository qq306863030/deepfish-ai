import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSessionPath, getSessionsPath, getUserFilePath, getWorkspacePath, getSessionDirPath } from './getGlobalPath';
import AIAgent from '../../agent/AIAgent/index';
import type { ConfigFile, Session } from '@/@types/ConfigFile';
import { getTrueCwd, openDirectory } from '@/utils/normal';
import { logSuccess, logWarning, logInfo, logError } from '@/utils/print';
import { AgentRoomClient } from '@/serve/service/agent-room/agent-client';
import { getServePort } from './getGlobalData';
import { handleServeStart } from '../cli-core/serve';

export async function initAgent(config: ConfigFile, skills?: string[]): Promise<AIAgent> {
  const session = initSession();
  const currentAI = _getCurrentAIConfig(config);
  const userPath = getUserFilePath();
  const id = session.id;
  const agent = new AIAgent({
    id,
    modelOpt: {
      type: currentAI.type,
      apiKey: currentAI.apiKey,
      modelName: currentAI.model,
      baseUrl: currentAI.baseUrl,
      maxContextLength: currentAI.maxContextLength,
    },
    basespace: getSessionPath(id),
    workspace: getTrueCwd(),
    memoryFilePath: userPath.memory,
    userStorePath: userPath.userStore,
    sessionDirPath: getSessionDirPath(id),
    agentRulesPath: userPath.agentRules,
    maxBlockFileSize: config.maxBlockFileSize, // Max chunk file size in KB; files exceeding this size need to be processed in chunks
    encoding: config.encoding, // CLI encoding format, can be set to utf-8, gbk, etc., or left empty for auto-detection
    maxSubAgentCount: config.maxSubAgentCount, // Maximum parallel sub-agent execution count, -1 means unlimited
    externalSkills: skills,
    isPrintThinking: config.isPrintThinking, // Whether to print intermediate information during AI thinking, default is true
    isUseMemory: config.isUseMemory,
    isVision: currentAI.isVision
  });
  await agent.init();
  return agent;
}

// ─── agent-room Connection ──────────────────────────────

export type ConnectAgentRoomResult = { ok: true; client: AgentRoomClient } | { ok: false; reason: 'duplicate-id' | 'offline' };

/**
 * Connect to the agent-room socket server and register as an agent.
 * - Success → { ok: true, client }
 * - ID already taken → { ok: false, reason: 'duplicate-id' }
 * - Connection failed → { ok: false, reason: 'offline' }
 */
export function connectAgentRoom(agent: AIAgent): Promise<ConnectAgentRoomResult> {
  const id = agent.id;
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: ConnectAgentRoomResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (result.ok) {
        agent.roomClient = result.client;
      }
      resolve(result);
    };

    const client = new AgentRoomClient({
      id,
      reconnectInterval: 0, // Disable auto-reconnect during Promise phase
      onReady: () => {
        // logSuccess(`[agent-room] agent online: ${id}`);
        done({ ok: true, client });
      },
      onError: (_c, code) => {
        if (code === 'AGENT_ALREADY_CONNECTED') {
          done({ ok: false, reason: 'duplicate-id' });
        }
      },
      onClose: () => {
        if (!settled) {
          logInfo(`[agent-room] agent offline: ${id}`);
        }
        done({ ok: false, reason: 'offline' });
      },
    });

    // Timeout protection: consider as failure if no result within 300 seconds
    const timer = setTimeout(() => {
      logWarning(`[agent-room] agent "${id}" connection timeout`);
      done({ ok: false, reason: 'offline' });
    }, 300_000);
  });
}

/**
 * Test if serve service is already running, auto-start if not running.
 *
 * Logic:
 * 1. Try to request http://localhost:{port}/ping
 * 2. Receive "pong" → Service already running, return directly
 * 3. Check if PM2 has a service running, try to start via PM2
 * 4. Connection refused (ECONNREFUSED) → Port is free, start service via PM2
 * 5. Connection succeeded but non-"pong" response → Port occupied by other process, error and exit
 */
export async function testServer(): Promise<boolean> {
  const port = getServePort();
  const url = `http://localhost:${port}/ping`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    if (text === 'pong') {
      return true;
    }
    // Port is occupied but the response is not from our service
    logError(`Port ${port} is occupied but /ping did not return expected result (received: ${text}), please check for port conflict`);
    return false;
  } catch {
    // Fetch error → Check PM2 and start service
    logInfo(`Port ${port} is free, starting service via PM2...`);
    try {
      await handleServeStart();
      // Wait and verify after starting
      let retries = 10;
      while (retries > 0) {
        try {
          const res = await fetch(url, { method: 'GET' });
          const text = await res.text();
          if (text === 'pong') {
            logSuccess(`Service started: http://localhost:${port}`);
            return true;
          }
        } catch {
          // Wait for service to start
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        retries--;
      }
      logError('Service start timeout');
      return false;
    } catch (startErr) {
      logError(`Failed to start service: ${startErr instanceof Error ? startErr.message : String(startErr)}`);
      return false;
    }
  }
}

export function clearSession() {
  const agentId = getAgentId();
  if (agentId) {
    removeSessionById(agentId);
  }
}

export function removeSessionById(agentId: string) {
  if (!agentId) {
    logWarning('No current session found, cannot open session directory');
    return;
  }
  const sessionDir = getSessionPath(agentId);
  fs.removeSync(sessionDir);
  // Remove from json file
  const sessionsPath = getSessionsPath();
  const sessionsFilePath = path.join(sessionsPath, 'sessions.json');
  if (!fs.pathExistsSync(sessionsFilePath)) {
    logSuccess('Current session history cleared');
    return;
  }
  const content = fs.readFileSync(sessionsFilePath, 'utf-8');
  const parsed = JSON.parse(content);
  const sessions = Array.isArray(parsed) ? parsed : [];
  const existingSessionIndex = sessions.findIndex((s: Session) => s.id === agentId);
  if (existingSessionIndex !== -1) {
    sessions.splice(existingSessionIndex, 1);
    fs.writeFileSync(sessionsFilePath, JSON.stringify(sessions, null, 2), 'utf-8');
  }
  logSuccess('Current session history cleared');
}

export function openSessionDir() {
  const agentId = getAgentId();
  if (!agentId) {
    logWarning('No current session found, cannot open session directory');
    return;
  }
  const sessionDir = getSessionPath(agentId);
  logSuccess(`Session directory path: ${sessionDir}`);
  openDirectory(sessionDir);
}

export function initSession(): Session {
  const sessionsPath = getSessionsPath();
  const sessionsFilePath = path.join(sessionsPath, 'sessions.json');

  let sessions: Session[] = [];
  if (fs.pathExistsSync(sessionsFilePath)) {
    const content = fs.readFileSync(sessionsFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    sessions = Array.isArray(parsed) ? parsed : [];
  } else {
    fs.ensureDirSync(sessionsPath);
    fs.writeFileSync(sessionsFilePath, '[]', 'utf-8');
  }

  const workspace = getWorkspacePath();
  const existingSession = sessions.find((s) => s.workspace === workspace);

  if (existingSession) {
    initSessionDir(existingSession.id);
    return existingSession;
  }

  const agentId = randomUUID();
  const newSession: Session = {
    id: agentId,
    name: path.basename(workspace),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspace,
  };

  sessions.push(newSession);
  fs.writeFileSync(sessionsFilePath, JSON.stringify(sessions, null, 2), 'utf-8');
  initSessionDir(newSession.id);
  return newSession;
}

function initSessionDir(agentId: string) {
  const sessionDir = getSessionPath(agentId);
  fs.ensureDirSync(sessionDir);
  // Create files and directories
  const mainSessionPath = `${sessionDir}/main-session/`;
  const mainMsgQueuePath = `${sessionDir}/main-msg-queue.json`;
  fs.ensureDirSync(mainSessionPath);
  fs.ensureFileSync(mainMsgQueuePath);
}

function _getCurrentAIConfig(config: ConfigFile) {
  const currentModelName = config.currentModel;
  if (!currentModelName) {
    throw new Error('No AI model configured, please run ai model use <name>');
  }
  const currentAI = config['aiList'].find((m) => m.name === currentModelName);
  if (!currentAI) {
    throw new Error(`AI config not found: ${currentModelName}`);
  }
  return currentAI;
}

export function getAgentId(): string | undefined {
  const sessionsPath = getSessionsPath();
  const sessionsFilePath = path.join(sessionsPath, 'sessions.json');
  if (!fs.pathExistsSync(sessionsFilePath)) {
    return;
  }
  const content = fs.readFileSync(sessionsFilePath, 'utf-8');
  const parsed = JSON.parse(content);
  const sessions = Array.isArray(parsed) ? parsed : [];
  const workspace = getWorkspacePath();
  const existingSession = sessions.find((s) => s.workspace === workspace);
  if (existingSession) {
    const agentId = existingSession.id;
    return agentId;
  }
  return;
}
