interface MockDelayOptions {
  shouldFail?: boolean;
  errorMessage?: string;
}

export function withMockDelay<T>(data: T, delay?: number, options: MockDelayOptions = {}): Promise<T> {
  const fallbackDelay = Math.floor(Math.random() * 401) + 300;
  const finalDelay = delay ?? fallbackDelay;
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (options.shouldFail) {
        reject(new Error(options.errorMessage ?? "Mock API error"));
        return;
      }
      resolve(data);
    }, finalDelay);
  });
}

export function mockDelay<T>(value: T, min = 300, max = 700): Promise<T> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return withMockDelay(value, delay);
}
