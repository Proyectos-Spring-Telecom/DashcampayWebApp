import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TransbordosService {

  constructor(private http: HttpClient) { }

  obtenerTransbordosData(page: number, pageSize: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/transbordos/${page}/${pageSize}`);
  }

  obtenerTransbordo(id: number): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/transbordos/${id}`);
  }

  agregarTransbordo(data: any): Observable<any> {
    return this.http.post(`${environment.API_SECURITY}/transbordos`, data);
  }

  actualizarTransbordo(id: number, data: any): Observable<any> {
    const { idCliente: _idCliente, ...body } = data || {};
    return this.http.patch(`${environment.API_SECURITY}/transbordos/${id}`, body);
  }

  eliminarTransbordo(id: number): Observable<any> {
    return this.http.delete(`${environment.API_SECURITY}/transbordos/${id}`);
  }

  obtenerTiposDescuento(): Observable<any> {
    return this.http.get(`${environment.API_SECURITY}/transbordos/tipos-descuento`);
  }
}

