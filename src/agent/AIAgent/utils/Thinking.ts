import { loading } from '@/utils/print';

export default class Thinking {
  isThinking: boolean = false;
  loadingEvent: any = null;
  start() {
    if (!this.isThinking) {
      this.isThinking = true;
      this.loadingEvent = loading('Thinking...');
    }
  }
  stop() {
    this.isThinking = false;
    if (this.loadingEvent) {
      this.loadingEvent('I have finished thinking.');
      this.loadingEvent = null;
    }
  }
}
