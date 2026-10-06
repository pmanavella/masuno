// Error con status HTTP y código estable que el frontend puede interpretar ({ error, code }).
// field (opcional): el campo del formulario al que corresponde el error.
export class HttpError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}
