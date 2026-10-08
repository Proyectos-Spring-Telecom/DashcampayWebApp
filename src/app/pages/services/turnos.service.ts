import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TurnoService {

  constructor(private http: HttpClient) { }

  obtenerTurnosData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/turnos/${page}/${pageSize}`);
  }

  obtenerTurnos(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/turnos/list`);
  }

  eliminarTurno(idTurno: number) {
    return this.http.delete(environment.API_SECURITY + '/turnos/' + idTurno);
  }

  obtenerTurno(idTurno: number): Observable<any> {
    return this.http.get<any>(environment.API_SECURITY + '/turnos/' + idTurno);
  }

  private apiUrl = `${environment.API_SECURITY}/turnos`;
  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }
}