import { InfraError, resilientFetch, type ResilientFetchOptions } from "../lib/resilient-fetch";

export type ReservationRequest = {
  operationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
};

export type DownstreamResponse = { status: number; body: unknown };

export interface EventClient {
  createReservation(input: ReservationRequest): Promise<DownstreamResponse>;
  releaseReservation(operationId: string): Promise<DownstreamResponse>;
}

export class HttpEventClient implements EventClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
    private readonly options: ResilientFetchOptions = {}
  ) {}

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-service-token": this.serviceToken,
    };
  }

  createReservation(input: ReservationRequest): Promise<DownstreamResponse> {
    return resilientFetch(
      `${this.baseUrl}/internal/reservations`,
      { method: "POST", headers: this.headers(), body: JSON.stringify(input) },
      this.options
    );
  }

  releaseReservation(operationId: string): Promise<DownstreamResponse> {
    return resilientFetch(
      `${this.baseUrl}/internal/reservations/${encodeURIComponent(operationId)}`,
      { method: "DELETE", headers: this.headers() },
      this.options
    );
  }
}

export { InfraError };
