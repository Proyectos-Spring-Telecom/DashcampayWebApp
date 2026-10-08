import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TransaccionesService {

  constructor(private http: HttpClient) { }

  obtenerTransaccionesData(body: {
      page: number;
      limit: number;
      fechaInicio?: string | null;
      fechaFin?: string | null;
    }): Observable<any> {
      return this.http.post(
        `${environment.API_SECURITY}/transacciones/paginado`,
        body
      );
    }

  obtenerTransaccion(): Observable<any> {
		return this.http.get(`${environment.API_SECURITY}/transacciones/list`);
	}
  
  agregarTransaccion(data: any) {
    return this.http.post(environment.API_SECURITY + '/transacciones', data);
  }

  /**
   * Clave por operación, no por intento: si la petición falla (timeout, red) y
   * el usuario reintenta la misma recarga, viaja la misma clave y la API
   * devuelve la recarga ya hecha en lugar de cobrar otra vez. Se libera al
   * terminar bien, para que la siguiente recarga igual sea una operación nueva.
   */
  private readonly clavesRecargaPendientes = new Map<string, string>();

  agregarRecarga(data: any) {
    const huella = [
      data?.numeroSerieMonedero,
      Number(data?.monto),
      data?.idMetodoPago,
      data?.tokenCardNetPay ?? '',
    ].join('|');
    const claveIdempotencia =
      data?.claveIdempotencia ||
      this.clavesRecargaPendientes.get(huella) ||
      crypto.randomUUID();
    this.clavesRecargaPendientes.set(huella, claveIdempotencia);
    return this.http
      .post(environment.API_SECURITY + '/transacciones/recarga', {
        ...data,
        claveIdempotencia
      })
      .pipe(tap(() => this.clavesRecargaPendientes.delete(huella)));
  }

  
}