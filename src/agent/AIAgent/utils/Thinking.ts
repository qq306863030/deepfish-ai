import { loading } from '@/utils/print';

export default class Thinking {
    isThinking: boolean = false;
    loadingEvent: any = null;
    content: string = '';
    init() {
        this.content = '';
        this.isThinking = true;
        this.loadingEvent = loading('Thinking...');
    }
    stop() {
        this.isThinking = false;
        this.content = ''
        if (this.loadingEvent) {
            this.loadingEvent('I have finished thinking.');
            this.loadingEvent = null;
        }
    }
    setStop(content: string) {
        if (this.isThinking) {
            this.content += content.replace(/\s+/g, '');
            if (this.content.length > 0) {
                this.stop();
            }
        }
    }
}