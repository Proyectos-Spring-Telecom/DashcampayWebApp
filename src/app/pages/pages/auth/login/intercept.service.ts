// intercept-service.interceptor.ts
import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthenticationService } from 'src/app/core/services/auth.service';

// === Compatibilidad con tu versión en clase ===
export const SKIP_APP_AUTH = new HttpContextToken<boolean>(() => false);
// Alias opcional si ya usabas otro nombre en algún lugar
export const BYPASS_AUTH = SKIP_APP_AUTH;

// Helper opcional para setear el flag de forma compacta
export function withSkipAuth(ctx: HttpContext = new HttpContext()): HttpContext {
  return ctx.set(SKIP_APP_AUTH, true);
}

export const interceptServiceInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthenticationService);
  const token = auth.getToken();

  // Respeta el contexto para saltar Authorization
  const skipAuth = req.context.get(SKIP_APP_AUTH) === true;

  // No pisar Authorization si ya viene, y sólo agregar si no se pidió saltar
  let headers = req.headers;
  if (!skipAuth && token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  // Aceptar JSON por defecto (no afecta binarios) si no viene definido
  if (!headers.has('Accept')) {
    headers = headers.set('Accept', 'application/json');
  }

  // Reglas para Content-Type: sólo si hay body JSON y no es FormData
  const isMutating = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH';
  const hasBody = isMutating && req.body != null;
  const isFormData = hasBody && (req.body instanceof FormData);

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers = headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  // Clon único
  const finalReq = req.clone({ headers });
  return next(finalReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      const raw = typeof err.error === 'string' ? err.error : '';
      if (!pareceErrorDeMotor(raw)) {
        return throwError(() => err);
      }
      return throwError(
        () =>
          new HttpErrorResponse({
            error:
              (err.status ?? 0) >= 500
                ? 'Error interno del servidor'
                : 'Solicitud inválida.',
            headers: err.headers,
            status: err.status,
            statusText: err.statusText,
            url: err.url ?? undefined,
          }),
      );
    }),
  );
};

function pareceErrorDeMotor(text: string): boolean {
  return /queryfailed|sql syntax|unknown column|duplicate entry|econnreset|econnrefused|sqlstate/i.test(
    text,
  );
}
