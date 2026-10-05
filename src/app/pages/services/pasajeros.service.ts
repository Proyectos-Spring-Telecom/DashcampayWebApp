import { HttpClient, HttpHeaders, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_APP_AUTH } from '../pages/auth/login/intercept.service';

@Injectable({
  providedIn: 'root'
})
export class PasajerosService {
  private readonly VERIFY_TOKEN_KEY = 'verify_token';
  private apiUrl = `${environment.API_SECURITY}/pasajeros`;

  constructor(private http: HttpClient) { }

  setVerificationToken(token: string): void {
    sessionStorage.setItem(this.VERIFY_TOKEN_KEY, token);
  }

  getVerificationToken(): string | null {
    return sessionStorage.getItem(this.VERIFY_TOKEN_KEY);
  }

  clearVerificationToken(): void {
    sessionStorage.removeItem(this.VERIFY_TOKEN_KEY);
  }

  obtenerPasajerosData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/pasajeros/${page}/${pageSize}`);
  }

  obtenerPasajeros(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/pasajeros/list`);
  }

  agregarPasajero(data: FormData) {
    return this.http.post(`${environment.API_SECURITY}/pasajeros`, data);
  }

  eliminarPasajero(idPasajero: number) {
    return this.http.delete(`${environment.API_SECURITY}/pasajeros/${idPasajero}`);
  }

  obtenerPasajero(idPasajero: number): Observable<any> {
    return this.http.get<any>(`${environment.API_SECURITY}/pasajeros/${idPasajero}`);
  }

  actualizarPasajero(idPasajero: number, saveForm: any): Observable<any> {
    return this.http.put(`${environment.API_SECURITY}/pasajeros/${idPasajero}`, saveForm);
  }

  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  agregarPasajeroAfiliacion(data: FormData) {
    return this.http.post(`${environment.API_SECURITY}/login/pasajero/registro`, data);
  }

  verificarPasajero(codigo: string, userName: string): Observable<any> {
    const context = new HttpContext().set(SKIP_APP_AUTH, true);

    return this.http.patch(
      `${environment.API_SECURITY}/login/verify`,
      { codigo, userName },
      { responseType: 'text' as 'json', context }
    ).pipe(catchError(err => throwError(() => err)));
  }


  verificarPorCodigo(codigo: string, userName: string): Observable<string> {
    return this.verificarPasajero(codigo, userName) as unknown as Observable<string>;
  }

  datosUsuarioPasajero(): Observable<any> {
    return this.http.get<any>(`${environment.API_SECURITY}/pasajeros/wallet`);
  }

  obtenerTiposPasajero(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/catpasajero/list`).pipe(
      catchError(error => throwError(() => error))
    );
  }
}
