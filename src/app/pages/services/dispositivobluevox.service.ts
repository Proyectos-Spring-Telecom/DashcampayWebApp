import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DispositivoBluevoxService {

  constructor(private http: HttpClient) { }

  obtenerDispositivosBlueData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/contadores/${page}/${pageSize}`);
  }

  obtenerDispositivosBlue(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/contadores/list`);
  }

  obtenerDispositivosBlueByCliente(idCliente: any): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/contadores/clientes/${idCliente}`);
  }

  agregarDispositivoBlue(data: FormData) {
    return this.http.post(environment.API_SECURITY + '/contadores', data);
  }

  eliminarDispositivoBlue(idDispositivo: Number) {
    return this.http.delete(environment.API_SECURITY + '/contadores/' + idDispositivo);
  }

  obtenerDispositivoBlue(idDispositivo: number): Observable<any> {
    return this.http.get<any>(environment.API_SECURITY + '/contadores/' + idDispositivo);
  }

  actualizarDispositivoBlue(idDispositivo: number, saveForm: any): Observable<any> {
    const { idCliente: _idCliente, ...body } = saveForm || {};
    return this.http.put(`${environment.API_SECURITY}/contadores/` + idDispositivo, body);
  }

  private apiUrl = `${environment.API_SECURITY}/contadores`;
  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }
}