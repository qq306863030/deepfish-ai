import { createSignal, onCleanup, onMount, For, Show } from 'solid-js';
import './App.less';
import { AgentRoomWebClient } from '../service/agent-room/web-client';
import type { Session } from '@/@types/ConfigFile';

const STATUS_LABEL: Record<0 | 1, string> = {
  0: 'Idle',
  1: 'Working',
};

const STATUS_DOT_CLASS: Record<'connecting' | 'connected' | 'disconnected' | 'error' | 'ssr', string> = {
  connecting: 'is-connecting',
  connected: 'is-connected',
  disconnected: 'is-disconnected',
  error: 'is-error',
  ssr: 'is-disconnected',
};

const STATUS_PILL_TEXT: Record<'connecting' | 'connected' | 'disconnected' | 'error' | 'ssr', string> = {
  ssr: 'LOADING',
  connecting: 'CONNECTING',
  connected: 'CONNECTED',
  disconnected: 'DISCONNECTED',
  error: 'ERROR',
};

/** 把 ISO 时间格式化为本地字符串（兼容 invalid）。 */
function formatTime(value: string | undefined | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function App() {
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [status, setStatus] = createSignal<'connecting' | 'connected' | 'disconnected' | 'error' | 'ssr'>('ssr');
  const [errorMsg, setErrorMsg] = createSignal<string>('');
  const [deletingId, setDeletingId] = createSignal<string>('');
  const [confirmingId, setConfirmingId] = createSignal<string>('');
  const [showConfirm, setShowConfirm] = createSignal(false);
  const [confirmMessage, setConfirmMessage] = createSignal('');

  let client: AgentRoomWebClient | null = null;

  // Only establish socket connection on client-side; during SSR render a static skeleton and hydrate on client
  onMount(() => {
    if (typeof window === 'undefined') return;
    setStatus('connecting');

    const wsUrl = `ws://${window.location.host}/agent-room`;
    client = new AgentRoomWebClient({
      url: wsUrl,
      onReady: () => {
        setStatus('connected');
        setErrorMsg('');
      },
      onSessionsPush: (_c, list) => {
        setSessions(list ?? []);
        setDeletingId('');
      },
      onError: (_c, _code, message) => {
        setStatus('error');
        setErrorMsg(message);
        setDeletingId('');
      },
      onClose: () => {
        setStatus('disconnected');
        setDeletingId('');
      },
    });
  });

  /**
   * 删除 session：发送 delete-session 消息到 server，server 会调用 removeSessionById
   * 并通过 sessions-push 自动刷新表格。
   */
  const handleDelete = (id: string) => {
    // Show custom confirmation modal; client will send delete request after confirmation
    setConfirmingId(id);
    setConfirmMessage(`Are you sure you want to delete session "${id}"? This action cannot be undone.`);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    const id = confirmingId();
    if (!client || !id) {
      setShowConfirm(false);
      return;
    }
    setDeletingId(id);
    setShowConfirm(false);
    client.send('delete-session', { id });
  };

  const cancelDelete = () => {
    setConfirmingId('');
    setShowConfirm(false);
  };

  onCleanup(() => client?.disconnect());

  return (
    <div class="app-shell">
      <header class="app-header">
        <div>
          <h1 class="app-title">DeepFish Sessions</h1>
          <p class="app-subtitle">// agent-room · realtime</p>
        </div>
        <div class="status-pill" title={errorMsg()}>
          <span class={`status-dot ${STATUS_DOT_CLASS[status()]}`}></span>
          {STATUS_PILL_TEXT[status()]}
        </div>
      </header>

      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">
            Active Sessions
            <span class="badge">{sessions().length}</span>
          </h2>
        </div>

        <Show
          when={sessions().length > 0}
          fallback={
            <div class="empty-state">
              <div class="icon">◇</div>
              <div>
                {status() === 'connected'
                  ? 'No active sessions'
                  : status() === 'ssr'
                    ? 'Hydrating…'
                    : 'Waiting for data…'}
              </div>
            </div>
          }
        >
          <div class="table-wrap">
            <table class="sessions">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Workspace</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th class="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <For each={sessions()}>
                  {(s) => (
                    <tr>
                      <td class="cell-mono">{s.id}</td>
                      <td class="cell-name">{s.name}</td>
                      <td class="cell-mono">{s.workspace}</td>
                      <td>
                        <span
                          class={`status-tag ${
                            s.status === 1 ? 'is-online' : 'is-offline'
                          }`}
                        >
                          {STATUS_LABEL[s.status ?? 0]}
                        </span>
                      </td>
                      <td class="cell-time">{formatTime(s.createdAt)}</td>
                      <td class="cell-time">{formatTime(s.updatedAt)}</td>
                      <td class="cell-actions">
                        <button
                          type="button"
                          class="btn-delete"
                          disabled={deletingId() === s.id}
                          onClick={() => handleDelete(s.id)}
                        >
                          {deletingId() === s.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </section>

        <Show when={showConfirm()}>
          <div class="modal-backdrop">
            <div class="modal" role="dialog" aria-modal="true" aria-label="确认删除">
              <div class="modal-body">{confirmMessage()}</div>
              <div class="modal-actions">
                <button type="button" class="btn btn-cancel" onClick={cancelDelete}>取消</button>
                <button type="button" class="btn btn-confirm" onClick={confirmDelete} disabled={deletingId() === confirmingId()}>
                  {deletingId() === confirmingId() ? 'Deleting...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </Show>
    </div>
  );
}
