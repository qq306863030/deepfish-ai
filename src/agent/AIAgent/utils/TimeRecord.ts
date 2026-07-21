export default class TimeRecord {
  private startTime: number = 0;
  private endTime: number = 0;

  start() {
    this.startTime = performance.now();
    this.endTime = 0;
  }

  end(): string {
    this.endTime = performance.now();
    const elapsed = this.endTime - this.startTime;

    if (elapsed < 1000) {
      return `用时 ${elapsed.toFixed(1)}ms`;
    }

    const seconds = elapsed / 1000;
    if (seconds < 60) {
      return `用时 ${seconds.toFixed(1)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds - minutes * 60;
    return `用时 ${minutes}m ${remainSeconds.toFixed(1)}s`;
  }
}
