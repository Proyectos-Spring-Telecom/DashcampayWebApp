import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClientesService {

  constructor(private http: HttpClient) { }

  obtenerClientesData(page: number, pageSize: number): Observable<any> {
		return this.http.get(`${environment.API_SECURITY}/clientes/${page}/${pageSize}`);
	}

  /** Listado autenticado (árbol JWT). Usar en pantallas admin. */
  obtenerClientes(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/clientes/list`);
  }

  /** Solo id+nombre, sin JWT. Registro / signup público. */
  obtenerClientesPublicos(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/clientes/public`);
  }

  obtenerClientesList(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/clientes/list`);
  }

  agregarCliente(data: FormData) {
    return this.http.post(environment.API_SECURITY + '/clientes', data);
  }

  eliminarCliente(idCliente: Number) {
        return this.http.delete(environment.API_SECURITY + '/clientes/' + idCliente);
    }

  obtenerCliente(idCliente: number): Observable<any> {
        return this.http.get<any>(environment.API_SECURITY + '/clientes/' + idCliente);
    }

  actualizarCliente(idCliente: number, saveForm: any): Observable<any> {
    const { idPadre: _idPadre, ...body } = saveForm || {};
    return this.http.put(`${environment.API_SECURITY}/clientes/` + idCliente, body);
  }

  private apiUrl = `${environment.API_SECURITY}/clientes`;
  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }
  
}