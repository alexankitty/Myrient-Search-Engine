export default class TaskQueue {
  constructor(
    maxTasksPerSecond = 4,
    maxSimultaneousTasks = 8,
    maxQueueLength = 20
  ) {
    this.maxTasksPerSecond = maxTasksPerSecond;
    this.maxQueueLength = maxQueueLength;
    this.maxSimultaneousTasks = maxSimultaneousTasks;
    this.queue = [];
    this.processing = false;
    this.lastProcessTime = 0;
    this.taskCount = 0;
    this.tasksWaiting = 0;
  }

  async enqueue(taskFunction, that = this, ...args) {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.maxQueueLength) {
        reject(new Error("Queue is full. Maximum queue size exceeded."));
        return;
      }
      this.queue.push({
        taskFunction,
        that,
        args,
        resolve,
        reject,
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      if (now - this.lastProcessTime >= 1000) {
        this.taskCount = 0;
        this.lastProcessTime = now;
      }

      if (
        this.taskCount >= this.maxTasksPerSecond ||
        this.tasksWaiting >= this.maxSimultaneousTasks
      ) {
        const waitTime = 1000 - (now - this.lastProcessTime);
        await this.sleep(waitTime);
        continue;
      }

      const task = this.queue.shift();
      this.taskCount++;
      this.tasksWaiting++;

      try {
        const result = await task.taskFunction.apply(task.that, task.args);
        this.tasksWaiting--;
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      tasksPerSecond: this.maxTasksPerSecond,
      currentTaskCount: this.taskCount,
      isProcessing: this.processing,
    };
  }
}
