import { loading } from '@/server/utils/print';

/**
 * Thinking 动画控制器 — 在 CLI 客户端显示思考状态动画。
 *
 * 用法：
 * - 收到 THINKING_START 事件 → thinking.start()
 * - 收到 THINKING_STOP 事件 → thinking.stop()
 * - 收到 STREAM_CONTENT_OUTPUT 有内容 → thinking.start()
 * - 收到 MODEL_AFTER / MODEL_ERROR → thinking.stop()
 */
export default class Thinking {
  private isThinking: boolean = false;
  private loadingEvent: ReturnType<typeof loading> | null = null;

  start() {
    if (!this.isThinking) {
      this.isThinking = true;
      this.loadingEvent = loading('Thinking...');
    }
  }

  stop() {
    if (this.isThinking) {
      this.isThinking = false;
      if (this.loadingEvent) {
        this.loadingEvent('I have finished thinking.');
        this.loadingEvent = null;
      }
    }
  }
}
