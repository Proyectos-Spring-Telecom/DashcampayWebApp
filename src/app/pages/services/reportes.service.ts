import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mensajeRangoFechas } from '../../core/utils/rango-fechas';

@Injectable({
  providedIn: 'root'
})
export class ReportesService {

  constructor(private http: HttpClient) { }

  private postReporte(url: string, filtros: { fechaInicio: string; fechaFin: string }): Observable<any> {
    const mensaje = mensajeRangoFechas(filtros.fechaInicio, filtros.fechaFin);
    if (mensaje) {
      return throwError(() => ({ error: { message: mensaje }, status: 400 }));
    }
    return this.http.post(url, filtros);
  }

  obtenerRecaudacionDiariaRuta(filtros: {
    fechaInicio: string;
    fechaFin: string;
    idCliente?: number | null;
    idRegion?: number | null;
    idRuta?: number | null;
    idVariante?: number | null;
  }): Observable<any> {
    return this.postReporte(
      `${environment.API_SECURITY}/reportes/recaudacion-diaria-ruta`,
      filtros
    );
  }

  obtenerRecaudacionPorOperador(filtros: {
    fechaInicio: string;
    fechaFin: string;
    idCliente?: number | null;
    idOperador?: number | null;
  }): Observable<any> {
    return this.postReporte(
      `${environment.API_SECURITY}/reportes/recaudacion-por-operador`,
      filtros
    );
  }

  obtenerRecaudacionPorVehiculo(filtros: {
    fechaInicio: string;
    fechaFin: string;
    idCliente?: number | null;
    idVehiculo?: number | null;
    idRuta?: number | null;
  }): Observable<any> {
    return this.postReporte(
      `${environment.API_SECURITY}/reportes/recaudacion-por-vehiculo`,
      filtros
    );
  }

  obtenerRecaudacionPorDispositivo(filtros: {
    fechaInicio: string;
    fechaFin: string;
    idCliente?: number | null;
    idValidador?: number | null;
    idInstalacion?: number | null;
  }): Observable<any> {
    return this.postReporte(
      `${environment.API_SECURITY}/reportes/recaudacion-por-dispositivo`,
      filtros
    );
  }

  /** Transacciones débit (validaciones detalladas) */
  obtenerTransaccionesDebit(filtros: {
    fechaInicio: string;
    fechaFin: string;
    idCliente?: number | null;
    idZona?: number | null;
    idRuta?: number | null;
    idVariante?: number | null;
  }): Observable<any> {
    return this.postReporte(
      `${environment.API_SECURITY}/reportes/transacciones-debito`,
      filtros
    );
  }
}

