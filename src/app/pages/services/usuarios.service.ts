import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {

  constructor(private http: HttpClient) { }

  obtenerUsuarios(): Observable<any> {
    return this.http.get<any>(`${environment.API_SECURITY}/usuarios/list`);
  }

  obtenerUsuariosData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/usuarios/${page}/${pageSize}`);
  }

  obtenerUsuariosRolOperador(idCliente: any): Observable<any> {
    return this.http.get<any>(`${environment.API_SECURITY}/usuarios/list/rol/operador/${idCliente}`)
  }

  agregarUsuario(data: FormData) {
    return this.http.post(environment.API_SECURITY + '/usuarios', data);
  }

  eliminarUsuario(idUsuario: Number) {
    return this.http.delete(environment.API_SECURITY + '/usuarios/' + idUsuario);
  }

  obtenerUsuario(idUsuario: number): Observable<any> {
    return this.http.get<any>(environment.API_SECURITY + '/usuarios/' + idUsuario);
  }

  actualizarUsuario(idUsuario: number, saveForm: any): Observable<any> {
    const { idCliente: _idCliente, ...body } = saveForm || {};
    return this.http.put(`${environment.API_SECURITY}/usuarios/` + idUsuario, body);
  }

  uploadFile(data: FormData): Observable<any> {
    return this.http.post<any>(`${environment.API_SECURITY}/s3/upload`, data);
  }

  actualizarContrasena(data: any): Observable<any> {
    return this.http.put(`${environment.API_SECURITY}/usuarios/actualizar/contrasena`, data);
  }

  subirFotoPerfil(formData: FormData): Observable<any> {
    return this.http.post(`${environment.API_SECURITY}/usuarios/foto-perfil`, formData);
  }

  private apiUrl = `${environment.API_SECURITY}/usuarios`;
  updateEstatus(id: number, estatus: number): Observable<string> {
    const url = `${this.apiUrl}/estatus/${id}`;
    const body = { estatus };
    return this.http.patch(url, body, { responseType: 'text' }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  solicitarCambioContrasena(data: any) {
    return this.http.post(
      environment.API_SECURITY + '/login/usuario/recuperar/acceso',
      data,
      { responseType: 'text' as const }
    );
  }


  cambioContrasena(data: any, token: string) {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post(
      environment.API_SECURITY + '/login/cambiar/accesso',
      data,
      {
        headers,
        responseType: 'text' as const
      }
    );
  }
}