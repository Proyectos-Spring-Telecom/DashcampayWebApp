import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from 'src/environments/environment';
import { SKIP_APP_AUTH } from '../../pages/pages/auth/login/intercept.service';

export interface LoginTokensResponse {
  token: string;
  refreshToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private readonly USER_KEY = 'user';
  private readonly PERMISSIONS_KEY = 'permissions';

  /** Access token solo en memoria (no persiste en sessionStorage). */
  private accessToken: string | null = null;
  private refreshInFlight$: Observable<LoginTokensResponse> | null = null;

  private user: any;
  private authenticationChanged = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.migrateLegacyTokenStorage();
    this.user = this.readStoredUser();
    this.authenticationChanged.next(this.isAuthenticated());
  }

  authenticate(credentials: { userName: string; password: string }): Observable<LoginTokensResponse> {
    return this.http.post<LoginTokensResponse>(
      `${environment.API_SECURITY}/login`,
      credentials,
      { context: this.skipAuthContext() }
    );
  }

  getMe(): Observable<any> {
    return this.http.get<any>(`${environment.API_SECURITY}/login/me`);
  }

  refreshTokens(): Observable<LoginTokensResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No hay refresh token'));
    }

    return this.http.post<LoginTokensResponse>(
      `${environment.API_SECURITY}/login/refresh`,
      { refreshToken },
      { context: this.skipAuthContext() }
    ).pipe(
      tap((res) => this.setTokens(res.token, res.refreshToken))
    );
  }

  /** Un solo POST /login/refresh en vuelo; las peticiones 401 concurrentes esperan el mismo resultado. */
  refreshSessionSingleFlight(): Observable<void> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.refreshTokens().pipe(
        shareReplay(1),
        finalize(() => {
          this.refreshInFlight$ = null;
        })
      );
    }
    return this.refreshInFlight$.pipe(map(() => void 0));
  }

  /**
   * Tras recargar la página: si hay refreshToken, renovar par y cargar perfil.
   */
  restoreSession(): Observable<boolean> {
    this.migrateLegacyTokenStorage();

    if (this.accessToken && this.user) {
      return of(true);
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return of(false);
    }

    return this.refreshTokens().pipe(
      switchMap(() => this.getMe()),
      tap((user) => this.setData(user)),
      map(() => true),
      catchError(() => {
        this.forceLogout();
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }

  setTokens(token: string, refreshToken: string): void {
    this.accessToken = token;
    sessionStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    sessionStorage.removeItem('token');
    this.authenticationChanged.next(true);
  }

  setData(user: any): void {
    const { token: _t, refreshToken: _r, ...safeUser } = user ?? {};
    this.user = safeUser;
    sessionStorage.setItem(this.USER_KEY, JSON.stringify(safeUser));
    const permissions = safeUser?.permisos ?? safeUser?.permissions ?? [];
    this.setStoragePermissions(permissions);
    this.authenticationChanged.next(true);
  }

  getToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    const value = sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
    return value && value !== 'null' ? value : null;
  }

  getUser(): any {
    return this.user;
  }

  getPermissions(): string[] {
    const raw = sessionStorage.getItem(this.PERMISSIONS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return (Array.isArray(parsed) ? parsed : []).map((p) =>
        String((p && typeof p === 'object' && 'idPermiso' in p) ? p.idPermiso : p).trim()
      );
    } catch {
      return [];
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearLocalSession();
      this.router.navigate(['/login']);
      return of(void 0);
    }

    return this.http.post(
      `${environment.API_SECURITY}/login/logout`,
      { refreshToken },
      { context: this.skipAuthContext() }
    ).pipe(
      catchError(() => of(null)),
      tap(() => {
        this.clearLocalSession();
        this.router.navigate(['/login']);
      }),
      map(() => void 0)
    );
  }

  forceLogout(): void {
    this.clearLocalSession();
  }

  cleanSession(): void {
    this.clearLocalSession();
  }

  authenticationChanged$(): Observable<boolean> {
    return this.authenticationChanged.asObservable();
  }

  isAuthenticationChanged(): Observable<boolean> {
    return this.authenticationChanged$();
  }

  recuperarAcceso(data: { userName: string }): Observable<string> {
    return this.http.post<string>(
      `${environment.API_SECURITY}/login/recuperar/confirmacion`,
      data,
      { responseType: 'text' as 'json', context: this.skipAuthContext() }
    );
  }

  reenviarCodigo(payload: { codigo: string; userName: string }): Observable<string> {
    return this.http.patch<string>(
      `${environment.API_SECURITY}/login/verify`,
      payload,
      { responseType: 'text' as 'json', context: this.skipAuthContext() }
    );
  }

  private clearLocalSession(): void {
    this.accessToken = null;
    this.user = null;
    this.refreshInFlight$ = null;
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.PERMISSIONS_KEY);
    sessionStorage.removeItem('token');
    this.authenticationChanged.next(false);
  }

  private migrateLegacyTokenStorage(): void {
    const legacy = sessionStorage.getItem('token');
    if (legacy && legacy !== 'null' && !this.accessToken) {
      this.accessToken = legacy;
      sessionStorage.removeItem('token');
    }
  }

  private readStoredUser(): any {
    const raw = sessionStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private setStoragePermissions(permissions: any[]): void {
    const flat = (Array.isArray(permissions) ? permissions : []).map((p) =>
      String((p && typeof p === 'object' && 'idPermiso' in p) ? p.idPermiso : p).trim()
    );
    sessionStorage.setItem(this.PERMISSIONS_KEY, JSON.stringify(flat));
  }

  private skipAuthContext(): HttpContext {
    return new HttpContext().set(SKIP_APP_AUTH, true);
  }
}
