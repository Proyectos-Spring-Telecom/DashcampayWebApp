import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MonederosServices {

  constructor(private http: HttpClient) { }

  obtenerMonederosData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/monederos/${page}/${pageSize}`);
  }

  obtenerMonederos(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/monederos/list`);
  }

  agregarMonedero(data: FormData) {
    return this.http.post(environment.API_SECURITY + '/monederos', data);
  }

  crearTransaccion (data: any) {
    return this.http.post(environment.API_SECURITY + '/transacciones', data);
  }

  eliminarMonedero(idMonedero: Number) {
    return this.http.delete(environment.API_SECURITY + '/monederos/' + idMonedero);
  }

  obtenerMonedero(idMonedero: number): Observable<any> {
    return this.http.get<any>(environment.API_SECURITY + '/monederos/' + idMonedero);
  }

  actualizarMonedero(idMonedero: number, saveForm: any): Observable<any> {
    const { idCliente: _idCliente, ...body } = saveForm || {};
    return this.http.put(`${environment.API_SECURITY}/monederos/${idMonedero}`, body);
  }

  actualizarMonederoForm(saveForm: any): Observable<any> {
    return this.http.put(`${environment.API_SECURITY}/monederos/`, saveForm);
  }

  private apiUrl = `${environment.API_SECURITY}/monederos`;
  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  actualizarTipoPasajero(id: number, idTipoPasajero: number): Observable<any> {
    const url = `${this.apiUrl}/tipo/pasajero/${id}`;
    const body = { idTipoPasajero };
    return this.http.patch(url, body).pipe(
      catchError(error => throwError(() => error))
    );
  }

  reporteExtravio(correo: string, numeroSerie: string): Observable<any> {
    const body = { correo, numeroSerie };
    return this.http.post(`${environment.API_SECURITY}/monederos/reporte/extravio`, body);
  }

  updateTipoPasajero(idMonedero: number, idTipoPasajero: number): Observable<string> {
    const url = `${this.apiUrl}/tipo/pasajero/${idMonedero}`;
    const body = { idTipoPasajero };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }
}