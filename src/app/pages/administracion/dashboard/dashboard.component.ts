import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DashboardService } from '../../services/dashboard.service';

type TrendPoint = { d: string; v: number };

@Component({
  selector: 'vex-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  animations: [fadeInRight400ms],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  ahora = new Date();
  ventanaMin = 15;
  
  opcionesFiltro = [
    { valor: 1, etiqueta: 'Hoy' },
    { valor: 2, etiqueta: '7 Días' },
    { valor: 3, etiqueta: 'Mes Actual' }
  ];
  filtroSeleccionado = this.opcionesFiltro[0];
  metricas: any = null;
  cargando: boolean = false;

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  kpis = {
    ingresosHoy: 0,
    deltaIngresos: 8.3,
    pasajerosValidadosHoy: 0,
    ticketProm: 0,
    pctElectronico: 0,
    validacionesOk: 0,
    validacionesFail: 0,
    enServicio: 0,
    totalVehiculos: 220,
    cumplimientoTurnos: 0,
    turnosInicio: 0,
    turnosFin: 0,
    ocupacion: 0
  };

  topRutas: any[] = [];
  alertasValidadores: any[] = [];

  ingresosHora: any[] = [];
  pagoDistrib: any[] = [];
  ascensosVsBoletos: any[] = [];
  pasajerosPorRuta: any[] = [];
  tiposPasajero: any[] = [];
  
  // Mapeo de colores para tipos de pasajero
  coloresTiposPasajero: { [key: string]: string } = {
    'estandar': '#008ffb',      // Azul
    'estudiantes': '#f44336',   // Rojo
    'embarazadas': '#f44336',   // Rojo
    'discapacidad': '#ffc107'   // Amarillo
  };

  histPuntualidad: any[] = [];

  mapLayers = [{
    type: 'area',
    data: 'world'
  }];
  mapMarkers: any[] = [];

  ngOnInit(): void {
    this.simularDatos();
    this.cargarMetricas();
    setInterval(() => this.ahora = new Date(), 30000);
  }

  cargarMetricas(): void {
    this.cargando = true;
    this.dashboardService.obtenerMetricas(this.filtroSeleccionado.valor).subscribe({
      next: (data) => {
        this.metricas = data;
        // Actualizar ingresos con datos de la API: 7 días, mes actual y año actual (y Hoy) usan ingresosTotales
        if (data && data.ingresosTotales !== undefined) {
          this.kpis.ingresosHoy = data.ingresosTotales ?? 0;
          const filtro = this.filtroSeleccionado?.valor ?? 1;
          // Calcular porcentaje de diferencia solo cuando el filtro es "Hoy"
          if (filtro === 1 && data.ingresoTotalAyer !== undefined && data.ingresoTotalAyer !== null) {
            const ingresoAyer = data.ingresoTotalAyer || 0;
            if (ingresoAyer > 0) {
              this.kpis.deltaIngresos = ((data.ingresosTotales - ingresoAyer) / ingresoAyer) * 100;
            } else {
              this.kpis.deltaIngresos = data.ingresosTotales > 0 ? 100 : 0;
            }
          }
        }
        // Actualizar pasajeros validados
        if (data && data.pasajerosValidados !== undefined) {
          this.kpis.pasajerosValidadosHoy = data.pasajerosValidados || 0;
        }
        // Actualizar ticket promedio
        if (data && data.ticketPromedio && data.ticketPromedio.ticketPromedio !== undefined) {
          this.kpis.ticketProm = data.ticketPromedio.ticketPromedio || 0;
        }
        // Actualizar porcentaje de pagos electrónicos y tarjeta
        if (data && data.porcentajeMonederoVirtual) {
          if (data.porcentajeMonederoVirtual.porcentajePagoElectronico !== undefined) {
            this.kpis.pctElectronico = data.porcentajeMonederoVirtual.porcentajePagoElectronico / 100 || 0;
          }
        }
        // Actualizar validaciones exitosas y fallidas
        if (data && data.validacionesExitosas !== undefined) {
          this.kpis.validacionesOk = data.validacionesExitosas || 0;
        }
        if (data && data.validacionesFallidas !== undefined) {
          this.kpis.validacionesFail = data.validacionesFallidas || 0;
        }
        // Actualizar unidades en servicio / total
        // viajesAbiertos es un objeto con viajesAbiertos y totalValidadores dentro
        if (data && data.viajesAbiertos) {
          if (data.viajesAbiertos.viajesAbiertos !== undefined) {
            this.kpis.enServicio = Number(data.viajesAbiertos.viajesAbiertos) || 0;
          }
          if (data.viajesAbiertos.totalValidadores !== undefined) {
            this.kpis.totalVehiculos = Number(data.viajesAbiertos.totalValidadores) || 0;
          }
        }
        // Actualizar Top 5 rutas
        if (data && data.top5Rutas && Array.isArray(data.top5Rutas)) {
          this.topRutas = data.top5Rutas.map((ruta: any) => ({
            ruta: ruta.nombreRuta || ruta.idRuta,
            monto: Number(ruta.ingresosTotales) || 0,
            pasajeros: Number(ruta.totalViajes) || 0,
            ticketPromedio:  Number(ruta.ticketPromedio)
          })).slice(0, 5);
        }
        // Actualizar curva de ascensos vs boletos
        if (data && data.graficaAscensosVsBoletos && Array.isArray(data.graficaAscensosVsBoletos)) {
          this.ascensosVsBoletos = data.graficaAscensosVsBoletos.map((item: any) => ({
            hora: `Viaje ${item.idViaje}`,
            ascensos: Number(item.ascensos) || 0,
            boletos: Number(item.boletos) || 0
          }));
        }
        // Actualizar pasajeros por ruta
        if (data && data.pasajerosPorRutaTipo && Array.isArray(data.pasajerosPorRutaTipo)) {
          // Función para normalizar nombres de tipos
          const normalizarTipo = (tipo: string): string => {
            return tipo.toLowerCase()
              .replace(/\s+/g, '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
          };
          
          // Obtener tipos únicos de pasajero y crear mapeo de nombres originales a campos normalizados
          const tiposUnicosMap = new Map<string, string>();
          data.pasajerosPorRutaTipo.forEach((item: any) => {
            if (item.tipoPasajero) {
              const campoNormalizado = normalizarTipo(item.tipoPasajero);
              if (!tiposUnicosMap.has(campoNormalizado)) {
                tiposUnicosMap.set(campoNormalizado, item.tipoPasajero);
              }
            }
          });
          
          // Crear array de tipos con colores
          this.tiposPasajero = Array.from(tiposUnicosMap.entries()).map(([campo, nombreOriginal], index) => {
            return {
              name: nombreOriginal,
              value: campo,
              color: this.coloresTiposPasajero[campo] || this.obtenerColorPorIndice(index)
            };
          });
          
          // Agrupar por ruta y tipo de pasajero
          const rutasMap = new Map<string, any>();
          data.pasajerosPorRutaTipo.forEach((item: any) => {
            const rutaKey = item.nombreRuta || item.idRuta;
            if (!rutasMap.has(rutaKey)) {
              const rutaInicial: any = { ruta: rutaKey };
              // Inicializar todos los tipos de pasajero en 0
              this.tiposPasajero.forEach(tipo => {
                rutaInicial[tipo.value] = 0;
              });
              rutasMap.set(rutaKey, rutaInicial);
            }
            const rutaData = rutasMap.get(rutaKey);
            const cantidad = Number(item.cantidadPasajeros) || 0;
            const campoNormalizado = normalizarTipo(item.tipoPasajero || '');
            
            if (rutaData.hasOwnProperty(campoNormalizado)) {
              rutaData[campoNormalizado] += cantidad;
            }
          });
          this.pasajerosPorRuta = Array.from(rutasMap.values());
        }

        // Actualizar "Validadores con alertas" desde el API (/metrics)
        if (data && Array.isArray(data.alertas)) {
          const pick = (o: any, keys: string[]) => {
            for (const k of keys) {
              const v = o?.[k];
              if (v !== undefined && v !== null) return v;
            }
            return null;
          };

          const toSeveridad = (s: any): string => {
            const v = String(s ?? '').toLowerCase();
            if (v.includes('high') || v.includes('alta') || v.includes('crit')) return 'sev-high';
            if (v.includes('low') || v.includes('baja')) return 'sev-low';
            if (v.includes('med') || v.includes('media') || v.includes('warn')) return 'sev-med';
            return 'sev-med';
          };

          this.alertasValidadores = data.alertas.map((a: any) => {
            const numeroEconomico = pick(a, ['vehiculoNumeroEconomico']) ??
              pick(a?.vehiculo, ['numeroEconomico', 'NumeroEconomico', 'numEconomico']) ??
              pick(a, ['numeroEconomico', 'NumeroEconomico']);
            const serieValidador = pick(a, ['numeroSerieValidador', 'NumeroSerieValidador', 'serieValidador', 'SerieValidador']);
            const descripcion = pick(a, ['descripcion', 'Descripcion', 'detalle', 'Detalle', 'mensaje', 'Mensaje']) ?? '';
            const tag = pick(a, ['tag', 'Tag', 'tipo', 'Tipo', 'categoria', 'Categoria']) ?? 'Alerta';
            const severidad = toSeveridad(pick(a, ['severidad', 'Severidad', 'nivel', 'Nivel', 'prioridad', 'Prioridad']));

            return {
              nombre: `${numeroEconomico ?? 'N/A'} Validador: ${serieValidador ?? 'N/A'}`,
              detalle: String(descripcion ?? ''),
              tag: String(tag ?? 'Alerta'),
              severidad
            };
          });
        } else if (data && data.alertas !== undefined) {
          // Si el API envía alertas pero no es array, vaciar para evitar basura
          this.alertasValidadores = [];
        }

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar métricas:');
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFiltroChange(): void {
    this.cargarMetricas();
  }

  compararFiltros = (f1: any, f2: any): boolean => {
    return f1 && f2 ? f1.valor === f2.valor : f1 === f2;
  }

  obtenerTextoFiltro(): string {
    return this.filtroSeleccionado?.etiqueta || 'Hoy';
  }

  obtenerTextoIngresos(): string {
    const filtro = this.filtroSeleccionado?.valor || 1;
    switch (filtro) {
      case 1:
        return 'Ingresos del día';
      case 2:
        return 'Ingresos de los últimos 7 días';
      case 3:
        return 'Ingresos del mes';
      default:
        return 'Ingresos del día';
    }
  }

  obtenerTextoPasajeros(): string {
    const filtro = this.filtroSeleccionado?.valor || 1;
    if (filtro === 1) {
      return 'Pasajeros validados hoy';
    }
    return `Pasajeros validados (${this.obtenerTextoFiltro()})`;
  }

  obtenerColorPorIndice(index: number): string {
    const coloresDefault = ['#008ffb', '#f44336', '#4caf50', '#ffc107', '#9c27b0', '#00bcd4', '#ff9800', '#795548'];
    return coloresDefault[index % coloresDefault.length];
  }

  simularDatos(): void {
    const horas = Array.from({ length: 24 }, (_, i) => i);
    const ingresos = horas.map(h =>
  Math.max(
    0,
    2500 + Math.sin((h + 2) / 24 * Math.PI * 2) * 1500 + (h < 5 ? -2000 : 0)
  )
);

    const validaciones = horas.map(h => Math.max(200, 900 + Math.sin((h + 1) / 24 * Math.PI * 2) * 500 + (h < 5 ? -600 : 0)));
    const ascensos = horas.map((_, i) => Math.round(validaciones[i] * (1.06 + Math.random() * 0.04)));
    const boletos = validaciones;

    this.ingresosHora = horas.map(h => ({
      hora: `${h.toString().padStart(2,'0')}:00`,
      ingresos: Math.round(ingresos[h] * 100) / 100,
      ticket: ingresos[h] / Math.max(1, validaciones[h])
    }));

    const ingresosHoy = this.ingresosHora.reduce((a,b)=>a+b.ingresos,0);
    const pasajerosHoy = validaciones.reduce((a,b)=>a+b,0);
    const ticket = ingresosHoy / Math.max(1, pasajerosHoy);

    const monedero = Math.round(pasajerosHoy * 0.68);
    const otrosEMVQR = Math.round(pasajerosHoy * 0.17);
    const cortesias = Math.round(pasajerosHoy * 0.03);
    const efectivo = Math.max(0, ascensos.reduce((a,b)=>a+b,0) - pasajerosHoy);

    this.pagoDistrib = [
      { metodo: 'Monedero', valor: monedero },
      { metodo: 'EMV', valor: otrosEMVQR },
      { metodo: 'QR', valor: Math.round(pasajerosHoy * 0.08) },
      { metodo: 'Cortesía / Otros', valor: cortesias }
    ];

    this.ascensosVsBoletos = horas.map((h,i)=>({
      hora: `${h.toString().padStart(2,'0')}:00`,
      ascensos: ascensos[i],
      boletos: boletos[i]
    }));

    const rutas = ['R-01','R-02','R-03','R-04','R-05','R-06','R-07'];
    const buildFranja = () => rutas.reduce((acc,r)=> (acc[r]=Math.round(800+Math.random()*200),acc), {} as any);
    const fMan = buildFranja();
    const fMed = buildFranja();
    const fTar = buildFranja();
    const fNoc = buildFranja();

    this.pasajerosPorRuta = rutas.map(r=>({
      ruta: r,
      manana: fMan[r],
      mediodia: fMed[r],
      tarde: fTar[r],
      noche: fNoc[r]
    }));

    this.topRutas = rutas.map(r=>{
  const p = [fMan[r],fMed[r],fTar[r],fNoc[r]].reduce((a,b)=>a+b,0);
  const pInt = Math.round(p);
  const m = Math.round((pInt * ticket) * 100) / 100;
  return { ruta:r, monto:m, pasajeros:pInt, ticket: m/Math.max(1,pInt) };
}).sort((a,b)=>b.monto-a.monto).slice(0,5);


    const fallidas = Math.round(pasajerosHoy * 0.02);
    const ok = pasajerosHoy;

    this.kpis.ingresosHoy = ingresosHoy;
    this.kpis.pasajerosValidadosHoy = pasajerosHoy;
    this.kpis.ticketProm = ticket;
    this.kpis.pctElectronico = (monedero + otrosEMVQR + Math.round(pasajerosHoy * 0.08)) / Math.max(1, pasajerosHoy + efectivo);
    this.kpis.validacionesOk = ok;
    this.kpis.validacionesFail = fallidas;
    // enServicio y totalVehiculos ahora vienen de la API, no se establecen aquí
    // this.kpis.enServicio = 185;
    this.kpis.cumplimientoTurnos = 0.91;
    this.kpis.turnosInicio = 210;
    this.kpis.turnosFin = Math.round(this.kpis.turnosInicio * this.kpis.cumplimientoTurnos);
    this.kpis.ocupacion = 0.54;
    // this.kpis.totalVehiculos = 220;

    this.alertasValidadores = [
      { nombre: 'Validador A-102', detalle: 'Sin posición > 20 min', tag: 'Sin señal', severidad: 'sev-high' },
      { nombre: 'Validador C-331', detalle: 'Validaciones ~0 en 07:00–09:00', tag: 'Anomalía', severidad: 'sev-med' },
      { nombre: 'Validador B-219', detalle: 'Estatus ≠ 1', tag: 'Offline', severidad: 'sev-high' }
    ];

    const buckets = ['<-10','-10 a -5','-5 a 0','0 a +5','+5 a +10','>+10'];
    this.histPuntualidad = buckets.map(b=>({ bucket:b, conteo: Math.round(20 + Math.random()*80) }));

    this.mapMarkers = Array.from({length: 60}).map((_,i)=>({
      coordinates: [ -99.2 + Math.random()*0.8, 19.2 + Math.random()*0.8 ],
      text: `Validador ${100+i}`
    }));
  }
}
