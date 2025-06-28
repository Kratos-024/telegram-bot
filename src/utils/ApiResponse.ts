// utils/ApiResponse.ts
export class ApiResponse<T> {
  public statusCode: number;
  public success: boolean;
  public message: string;
  public data?: T;

  constructor(statusCode: number, message: string, data?: T) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}
