// Error con status HTTP y código estable que el frontend puede interpretar ({ error, code }).
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
