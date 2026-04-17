const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  interval: number; // window in ms
  uniqueTokenPerInterval: number; // max requests per interval
}

export function rateLimit(options: RateLimitOptions) {
  const { interval, uniqueTokenPerInterval } = options;

  return {
    check: async (identifier: string): Promise<{ success: boolean; remaining: number; reset: number }> => {
      const now = Date.now();
      const record = rateLimitMap.get(identifier);

      if (!record || now > record.resetTime) {
        rateLimitMap.set(identifier, {
          count: 1,
          resetTime: now + interval,
        });
        return { success: true, remaining: uniqueTokenPerInterval - 1, reset: now + interval };
      }

      record.count++;

      if (record.count > uniqueTokenPerInterval) {
        return { success: false, remaining: 0, reset: record.resetTime };
      }

      return {
        success: true,
        remaining: uniqueTokenPerInterval - record.count,
        reset: record.resetTime,
      };
    },
  };
}

// Default rate limiter: 60 requests per minute
export const apiRateLimit = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 60,
});
