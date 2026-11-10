import CircuitBreaker from "opossum";

export type ServiceName = "event" | "admission" | "engagement";

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

const DEFAULT_OPTIONS: CircuitBreaker.Options = {
  timeout: 2000, // 2s hard timeout
  errorThresholdPercentage: 50, // Trip if >= 50% errors
  resetTimeout: 10000, // 10s cooldown before half-open
  volumeThreshold: 5, // Minimum 5 requests to trip
  rollingCountTimeout: 30000, // 30s rolling statistical window
  rollingCountBuckets: 10,
};

export class ServiceCircuitBreakers {
  public breakers: Map<ServiceName, CircuitBreaker>;

  constructor(customOptions?: Partial<CircuitBreaker.Options>) {
    const opts = { ...DEFAULT_OPTIONS, ...customOptions };

    this.breakers = new Map<ServiceName, CircuitBreaker>([
      ["event", this.createBreaker("event-service", opts)],
      ["admission", this.createBreaker("admission-service", opts)],
      ["engagement", this.createBreaker("engagement-service", opts)],
    ]);
  }

  private createBreaker(serviceName: string, opts: CircuitBreaker.Options): CircuitBreaker {
    // Action wrapped by opossum
    const action = async (fn: () => Promise<Response>): Promise<Response> => {
      const response = await fn();
      // Downstream gateway/infrastructure error codes trip the circuit
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`Downstream ${serviceName} responded with HTTP ${response.status}`);
      }
      return response;
    };

    const breaker = new CircuitBreaker(action, {
      ...opts,
      name: serviceName,
    });

    breaker.on("open", () => {
      console.warn(`[CircuitBreaker] Circuit OPEN for ${serviceName}`);
    });

    breaker.on("halfOpen", () => {
      console.info(`[CircuitBreaker] Circuit HALF-OPEN for ${serviceName}`);
    });

    breaker.on("close", () => {
      console.info(`[CircuitBreaker] Circuit CLOSED for ${serviceName}`);
    });

    return breaker;
  }

  public getBreaker(name: ServiceName): CircuitBreaker {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Unknown circuit breaker: ${name}`);
    }
    return breaker;
  }

  public getState(name: ServiceName): "OPEN" | "HALF_OPEN" | "CLOSED" {
    const breaker = this.getBreaker(name);
    if (breaker.opened) return "OPEN";
    if (breaker.halfOpen) return "HALF_OPEN";
    return "CLOSED";
  }

  public getAllStates(): Record<ServiceName, "OPEN" | "HALF_OPEN" | "CLOSED"> {
    return {
      event: this.getState("event"),
      admission: this.getState("admission"),
      engagement: this.getState("engagement"),
    };
  }
}
