// utils/ApiError.ts
export class ApiError extends Error {
  public statusCode: number;
  public errors?: any;
  public stack?: string;
  public message: string;

  constructor(
    statusCode: number,
    message: string = "Something went wrong",
    errors: any = [],
    stack: string = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.stack = stack || new Error().stack;
  }
}
