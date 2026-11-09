export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const NotFound = (msg = 'Ressource introuvable.') => new AppError(404, 'NOT_FOUND', msg);
export const Forbidden = (msg = "Tu n'as pas le droit de faire ça.") =>
  new AppError(403, 'FORBIDDEN', msg);
export const Unauthorized = (msg = 'Jeton manquant ou invalide.') =>
  new AppError(401, 'UNAUTHORIZED', msg);
export const SessionClosed = () =>
  new AppError(409, 'SESSION_CLOSED', 'La commande est clôturée : plus aucune modification possible.');
export const Conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const BadRequest = (code: string, msg: string) => new AppError(400, code, msg);
