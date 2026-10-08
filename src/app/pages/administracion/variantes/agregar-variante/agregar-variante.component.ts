import { mensajeDeError } from 'src/app/core/utils/mensaje-error';
import { loadGoogleMaps } from 'src/app/core/security/load-google-maps';
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, UntypedFormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { RutasService } from 'src/app/pages/services/ruta.service';
import { TarifasService } from 'src/app/pages/services/tarifa.service';
import { VariantesService } from 'src/app/pages/services/variantes.service';
import { ZonasService } from 'src/app/pages/services/zonas.service';

interface RutaUI {
  id: number;
  nombre: string;
  origen: string | null;
  destino: string | null;
  distanciaKm: number | null;
  fechaCreacion: Date | null;
  activa: boolean;
  nombreCliente?: string | null;
  // claves que usa el mapa:
  inicio: any;
  fin: any;

  // extras por si los ocupas después
  puntoInicio?: { lat?: number; lng?: number };
  puntoFin?: { lat?: number; lng?: number };
  zona?: { id?: number; nombre?: string | null; descripcion?: string | null };
}

@Component({
  selector: 'vex-agregar-variante',
  templateUrl: './agregar-variante.component.html',
  styleUrl: './agregar-variante.component.scss',
  animations: [fadeInRight400ms],
})
export class AgregarVarianteComponent implements OnInit, AfterViewInit, OnDestroy {
  layoutCtrl = new UntypedFormControl('fullwidth');

  // flujo (ANTES: 1=Zona, 2=Ruta, 3=Variante, 4=Tarifa)
  // AHORA: 1=Ruta, 2=Variante, 3=Tarifa
  step: 1 | 2 | 3 = 1;

  // RUTAS
  public listaRutas: RutaUI[] = [];
  public rutasFiltradas: RutaUI[] = [];
  public selectedRuta: RutaUI | null = null;
  public searchRuta = '';
  public cargandoRutas = false;

  // TARIFA (Paso 3)
  tarifaForm!: FormGroup;
  listaTiposTarifa: any[] = [];

  // TIPO VARIANTE (Paso 2)
  listaTiposVariante: any[] = [];
  idTipoVariante: number | null = null;
  nombreVariante: string = '';

  esEstacionaria(): boolean {
    if (!this.idTipoVariante) return false;
    const tipoVariante = this.listaTiposVariante.find(t => t.id === this.idTipoVariante);
    return this.idTipoVariante === 3 || 
           tipoVariante?.nombre?.toLowerCase().includes('estacionaria') ||
           tipoVariante?.nombre?.toLowerCase().includes('estacionario');
  }

  esTipoTarifaEstacionaria(): boolean {
    const idTipoTarifa = this.tarifaForm.get('idTipoTarifa')?.value;
    if (!idTipoTarifa) return false;
    const tipoTarifa = this.listaTiposTarifa.find(t => t.id === idTipoTarifa);
    const nombreTipo = tipoTarifa?.nombre?.toLowerCase() || '';
    return nombreTipo.includes('estacionaria') || nombreTipo.includes('estacionario');
  }

  constructor(
    private variaService: VariantesService,
    private fb: FormBuilder,
    private alerts: AlertsService,
    private route: Router,
    private rutService: RutasService,
    private tarSerice: TarifasService,
  ) { }

  // ==========================
  // GOOGLE MAPS (Paso 2)
  // ==========================
  private readonly mapOptions: google.maps.MapOptions = {
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    fullscreenControl: true,
    zoomControl: true,
    streetViewControl: false,
    clickableIcons: false,
    center: { lat: 21.110778, lng: -86.762590 },
    zoom: 12,
  };

  private gmap: google.maps.Map | null = null;
  private startMarker: any = null;
  private endMarker: any = null;

  private mapClickListener: google.maps.MapsEventListener | null = null;
  private pathPolyline: google.maps.Polyline | null = null;
  private pathPoints: (google.maps.LatLngLiteral & { nombre?: string })[] = [];
  private pathPointMarkers: google.maps.Marker[] = [];

  private readonly polylineStyle: google.maps.PolylineOptions = {
    strokeColor: '#1F5AA8',
    strokeOpacity: 1,
    strokeWeight: 4,
  };

  // Punto circular para el trazado
  // Getter: el componente se construye antes de que cargue Maps y
  // google.maps.SymbolPath en un campo tiraba la pantalla.
  private get circlePoint(): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#000000',
      fillOpacity: 1,
      strokeColor: '#000000',
      strokeWeight: 1,
      scale: 5,
    };
  }

  // Control de flujo del trazado
  isRouteFinalized = false;
  isDrawing = false;
  get canFinalize(): boolean {
    return this.idTipoVariante !== null && this.pathPoints.length >= 2 && !this.isRouteFinalized;
  }

  // ==========================
  // Ciclo de vida
  // ==========================
  ngOnInit(): void {
    this.obtenerRutas();
    this.obtenerTiposTarifa();
    this.obtenerTiposVariante();
    this.tarifaForm = this.fb.group({
      idTipoTarifa: [null, Validators.required],
      tarifaBase: [null, [Validators.required, Validators.min(0)]],
      cantidadEstacionesBase: [{value: null, disabled: true}, [Validators.min(0)]],
      distanciaBaseKm: [{value: null, disabled: true}, [Validators.min(0)]],
      incrementoCadaMetros: [{value: null, disabled: true}, [Validators.min(0)]],
      costoAdicional: [{value: null, disabled: true}, [Validators.min(0)]],
      costoPorEstacion: [{value: null, disabled: true}, [Validators.min(0)]],
      estatus: [1],
      idVariante: [null, [Validators.required, Validators.min(0)]],
    });
    
    // Suscribirse a cambios en idTipoTarifa para habilitar/deshabilitar campos
    this.tarifaForm.get('idTipoTarifa')?.valueChanges.subscribe((idTipoTarifa) => {
      this.actualizarCamposSegunTipo(idTipoTarifa);
    });

    // Suscribirse a cambios en idTipoVariante para habilitar/deshabilitar campos
    // Necesitamos usar un observable o watch manual ya que idTipoVariante no está en el form
    // Usaremos un setter o método que se llame cuando cambie idTipoVariante
  }

  obtenerTiposTarifa(): void {
    this.tarSerice.obtenerTiposTarifa().subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        this.listaTiposTarifa = data.map((t: any) => ({
          id: Number(t?.id ?? t?.Id ?? t?.ID ?? 0),
          nombre: t?.nombre ?? t?.Nombre ?? ''
        })).filter((t: any) => Number.isFinite(t.id) && t.id > 0);
      },
      error: (error) => {
        console.error('Error al obtener tipos de tarifa:');
        this.listaTiposTarifa = [];
      }
    });
  }

  obtenerTiposVariante(): void {
    this.variaService.obtenerTiposVariante().subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        this.listaTiposVariante = data.map((t: any) => ({
          id: Number(t?.id ?? t?.Id ?? t?.ID ?? 0),
          nombre: t?.nombre ?? t?.Nombre ?? ''
        })).filter((t: any) => Number.isFinite(t.id) && t.id > 0);
      },
      error: (error) => {
        console.error('Error al obtener tipos de variante:');
        this.listaTiposVariante = [];
      }
    });
  }

  actualizarCamposSegunTipoVariante(): void {
    // Este método se mantiene por compatibilidad, pero la lógica de campos
    // ahora se maneja en actualizarCamposSegunTipo basado en el tipo de tarifa
    // Si hay un tipo de tarifa seleccionado, aplicar su lógica
    const idTipoTarifa = this.tarifaForm.get('idTipoTarifa')?.value;
    if (idTipoTarifa) {
      this.actualizarCamposSegunTipo(idTipoTarifa);
    }
  }

  actualizarCamposSegunTipo(idTipoTarifa: number | null): void {
    const distanciaControl = this.tarifaForm.get('distanciaBaseKm');
    const incrementoControl = this.tarifaForm.get('incrementoCadaMetros');
    const costoControl = this.tarifaForm.get('costoAdicional');
    const tarifaBaseControl = this.tarifaForm.get('tarifaBase');
    const costoPorEstacionControl = this.tarifaForm.get('costoPorEstacion');
    const cantidadEstacionesBaseControl = this.tarifaForm.get('cantidadEstacionesBase');

    if (!idTipoTarifa) {
      // Si no hay tipo seleccionado, deshabilitar todos excepto tarifaBase
      distanciaControl?.disable({ emitEvent: false });
      incrementoControl?.disable({ emitEvent: false });
      costoControl?.disable({ emitEvent: false });
      costoPorEstacionControl?.disable({ emitEvent: false });
      cantidadEstacionesBaseControl?.disable({ emitEvent: false });
      // Limpiar validadores de campos deshabilitados
      distanciaControl?.clearValidators();
      incrementoControl?.clearValidators();
      costoControl?.clearValidators();
      costoPorEstacionControl?.clearValidators();
      cantidadEstacionesBaseControl?.clearValidators();
      // Limpiar valores (habilitar temporalmente para setValue)
      distanciaControl?.enable({ emitEvent: false });
      incrementoControl?.enable({ emitEvent: false });
      costoControl?.enable({ emitEvent: false });
      costoPorEstacionControl?.enable({ emitEvent: false });
      cantidadEstacionesBaseControl?.enable({ emitEvent: false });
      distanciaControl?.setValue(null, { emitEvent: false });
      incrementoControl?.setValue(null, { emitEvent: false });
      costoControl?.setValue(null, { emitEvent: false });
      costoPorEstacionControl?.setValue(null, { emitEvent: false });
      cantidadEstacionesBaseControl?.setValue(null, { emitEvent: false });
      distanciaControl?.disable({ emitEvent: false });
      incrementoControl?.disable({ emitEvent: false });
      costoControl?.disable({ emitEvent: false });
      costoPorEstacionControl?.disable({ emitEvent: false });
      cantidadEstacionesBaseControl?.disable({ emitEvent: false });
      // Actualizar validadores
      distanciaControl?.updateValueAndValidity({ onlySelf: true });
      incrementoControl?.updateValueAndValidity({ onlySelf: true });
      costoControl?.updateValueAndValidity({ onlySelf: true });
      costoPorEstacionControl?.updateValueAndValidity({ onlySelf: true });
      cantidadEstacionesBaseControl?.updateValueAndValidity({ onlySelf: true });
      return;
    }

    // Buscar el tipo de tarifa para verificar si es "Estacionaria", "Fija" o "Incremental"
    const tipoTarifa = this.listaTiposTarifa.find(t => t.id === idTipoTarifa);
    const nombreTipo = tipoTarifa?.nombre?.toLowerCase() || '';

    if (nombreTipo.includes('estacionaria') || nombreTipo.includes('estacionario')) {
      // Tipo Estacionaria: habilitar Tarifa Base, Número de estaciones y Costo por Estación
      // Deshabilitar distancia, incremento, costo adicional
      distanciaControl?.disable({ emitEvent: false });
      incrementoControl?.disable({ emitEvent: false });
      costoControl?.disable({ emitEvent: false });

      // Limpiar validadores de campos deshabilitados
      distanciaControl?.clearValidators();
      incrementoControl?.clearValidators();
      costoControl?.clearValidators();

      // Limpiar valores (habilitar temporalmente para setValue)
      distanciaControl?.enable({ emitEvent: false });
      incrementoControl?.enable({ emitEvent: false });
      costoControl?.enable({ emitEvent: false });
      distanciaControl?.setValue(null, { emitEvent: false });
      incrementoControl?.setValue(null, { emitEvent: false });
      costoControl?.setValue(null, { emitEvent: false });
      distanciaControl?.disable({ emitEvent: false });
      incrementoControl?.disable({ emitEvent: false });
      costoControl?.disable({ emitEvent: false });

      // Habilitar tarifa base (editable para Estacionaria)
      tarifaBaseControl?.enable({ emitEvent: false });
      tarifaBaseControl?.setValidators([Validators.required, Validators.min(0)]);

      // Habilitar y hacer obligatorio cantidadEstacionesBase (no puede superar puntos del recorrido)
      cantidadEstacionesBaseControl?.enable({ emitEvent: false });
      cantidadEstacionesBaseControl?.setValidators([
        Validators.required,
        Validators.min(0),
        this.cantidadEstacionesBaseMaxValidator(),
      ]);

      // Habilitar y hacer obligatorio costoPorEstacion
      costoPorEstacionControl?.enable({ emitEvent: false });
      costoPorEstacionControl?.setValidators([Validators.required, Validators.min(0)]);

      // Actualizar validadores
      distanciaControl?.updateValueAndValidity({ onlySelf: true });
      incrementoControl?.updateValueAndValidity({ onlySelf: true });
      costoControl?.updateValueAndValidity({ onlySelf: true });
      tarifaBaseControl?.updateValueAndValidity({ onlySelf: true });
      cantidadEstacionesBaseControl?.updateValueAndValidity({ onlySelf: true });
      costoPorEstacionControl?.updateValueAndValidity({ onlySelf: true });
    } else if (nombreTipo.includes('fija') || nombreTipo.includes('fijo')) {
      // Tipo Fija: habilitar Tarifa Base (obligatoria), deshabilitar los demás
      tarifaBaseControl?.enable({ emitEvent: false });
      tarifaBaseControl?.setValidators([Validators.required, Validators.min(0)]);

      cantidadEstacionesBaseControl?.enable({ emitEvent: false });
      cantidadEstacionesBaseControl?.setValue(null, { emitEvent: false });
      cantidadEstacionesBaseControl?.clearValidators();
      cantidadEstacionesBaseControl?.disable({ emitEvent: false });

      distanciaControl?.disable({ emitEvent: false });
      incrementoControl?.disable({ emitEvent: false });
      costoControl?.disable({ emitEvent: false });
      costoPorEstacionControl?.disable({ emitEvent: false });
      // Limpiar validadores
      distanciaControl?.clearValidators();
      incrementoControl?.clearValidators();
      costoControl?.clearValidators();
      costoPorEstacionControl?.clearValidators();
      cantidadEstacionesBaseControl?.clearValidators();
      // Limpiar valores (habilitar temporalmente para setValue)
      distanciaControl?.enable({ emitEvent: false });
      incrementoControl?.enable({ emitEvent: false });
      costoControl?.enable({ emitEvent: false });
      costoPorEstacionControl?.enable({ emitEvent: false });
      cantidadEstacionesBaseControl?.enable({ emitEvent: false });
      distanciaControl?.setValue(null, { emitEvent: false });
      incrementoControl?.setValue(null, { emitEvent: false });
      costoControl?.setValue(null, { emitEvent: false });
      costoPorEstacionControl?.setValue(null, { emitEvent: false });
      cantidadEstacionesBaseControl?.setValue(null, { emitEvent: false });
      distanciaControl?.disable({ emitEvent: false });
      incrementoControl?.disable({ emitEvent: false });
      costoControl?.disable({ emitEvent: false });
      costoPorEstacionControl?.disable({ emitEvent: false });
      cantidadEstacionesBaseControl?.disable({ emitEvent: false });
    } else if (nombreTipo.includes('incremental')) {
      // Tipo Incremental: habilitar todos los campos (incluyendo Tarifa Base) y hacerlos obligatorios
      tarifaBaseControl?.enable({ emitEvent: false });
      tarifaBaseControl?.setValidators([Validators.required, Validators.min(0)]);

      cantidadEstacionesBaseControl?.enable({ emitEvent: false });
      cantidadEstacionesBaseControl?.setValue(null, { emitEvent: false });
      cantidadEstacionesBaseControl?.clearValidators();
      cantidadEstacionesBaseControl?.disable({ emitEvent: false });

      distanciaControl?.enable({ emitEvent: false });
      incrementoControl?.enable({ emitEvent: false });
      costoControl?.enable({ emitEvent: false });
      costoPorEstacionControl?.disable({ emitEvent: false });
      costoPorEstacionControl?.clearValidators();
      costoPorEstacionControl?.enable({ emitEvent: false });
      costoPorEstacionControl?.setValue(null, { emitEvent: false });
      costoPorEstacionControl?.disable({ emitEvent: false });
      // Agregar validadores requeridos
      distanciaControl?.setValidators([Validators.required, Validators.min(0)]);
      incrementoControl?.setValidators([Validators.required, Validators.min(0)]);
      costoControl?.setValidators([Validators.required, Validators.min(0)]);
    }

    // Actualizar validadores
    tarifaBaseControl?.updateValueAndValidity({ onlySelf: true });
    cantidadEstacionesBaseControl?.updateValueAndValidity({ onlySelf: true });
    distanciaControl?.updateValueAndValidity({ onlySelf: true });
    incrementoControl?.updateValueAndValidity({ onlySelf: true });
    costoControl?.updateValueAndValidity({ onlySelf: true });
    costoPorEstacionControl?.updateValueAndValidity({ onlySelf: true });
  }

  regresar() { this.route.navigateByUrl('/administracion/variantes'); }

  ngAfterViewInit(): void { }
  ngOnDestroy(): void { this.destroyMap(); }

  // ==========================
  // Rutas
  // ==========================
  obtenerRutas() {
    this.cargandoRutas = true;
    this.rutService.obtenerRutas().subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data : [];

        this.listaRutas = data.map((r: any): RutaUI => {
          const origen = r?.nombreInicio ?? r?.nombreInicioRuta ?? null;
          const destino = r?.nombreFin ?? r?.nombreFinRuta ?? null;

          const pIni = r?.puntoInicio ?? {};
          const pFin = r?.puntoFin ?? {};

          const distanciaKm =
            isFiniteNumber(pIni.lat) &&
              isFiniteNumber(pIni.lng) &&
              isFiniteNumber(pFin.lat) &&
              isFiniteNumber(pFin.lng)
              ? haversineKm(pIni.lat, pIni.lng, pFin.lat, pFin.lng)
              : isFiniteNumber(r?.distanciaKm)
                ? Number(r.distanciaKm)
                : null;

          return {
            id: Number(r.id),
            nombre: r?.nombre ?? 'Ruta sin nombre',
            origen,
            destino,
            distanciaKm,
            fechaCreacion: r?.fechaCreacionRuta ? new Date(r.fechaCreacionRuta) : null,
            activa: Number(r?.estatusRuta) === 1,
            nombreCliente: r?.nombreCliente ?? null,
            inicio: (isFiniteNumber(pIni.lat) && isFiniteNumber(pIni.lng)) ? { lat: Number(pIni.lat), lng: Number(pIni.lng) } : null,
            fin: (isFiniteNumber(pFin.lat) && isFiniteNumber(pFin.lng)) ? { lat: Number(pFin.lat), lng: Number(pFin.lng) } : null,
            puntoInicio: { lat: pIni.lat, lng: pIni.lng },
            puntoFin: { lat: pFin.lat, lng: pFin.lng },
            zona: {
              id: isFiniteNumber(r?.idZona) ? Number(r.idZona) : undefined,
              nombre: r?.nombreZona ?? null,
              descripcion: r?.descripcionZona ?? null,
            },
          };
        });

        this.rutasFiltradas = this.listaRutas;
      },
      error: (err) => {
        console.error('[RUTAS][ERROR]');
        this.listaRutas = [];
        this.rutasFiltradas = [];
      },
      complete: () => (this.cargandoRutas = false),
    });
  }

  filtrarRutas() {
    const t = (this.searchRuta || '').toLowerCase().trim();
    this.rutasFiltradas = t
      ? this.listaRutas.filter(
        (r) =>
          (r.nombre || '').toLowerCase().includes(t) ||
          (r.origen || '').toLowerCase().includes(t) ||
          (r.destino || '').toLowerCase().includes(t)
      )
      : this.listaRutas;
  }

  selectRuta(r: RutaUI) {
    this.selectedRuta = r;
    if (this.step === 2) setTimeout(() => this.renderGoogleMap(), 0);
  }

  trackByRuta(_i: number, r: RutaUI) { return r.id; }

  // ==========================
  // Google Maps helpers
  // ==========================
  private ensureGoogleLoaded(): Promise<void> {
    return loadGoogleMaps();
  }

  private setDrawingEnabled(on: boolean): void {
    if (!this.gmap) return;

    this.mapClickListener?.remove();
    this.mapClickListener = null;

    if (on) {
      this.gmap.setOptions({ draggableCursor: 'crosshair' });
      this.mapClickListener = this.gmap.addListener('click', async (ev: google.maps.MapMouseEvent) => {
        if (ev.latLng) await this.addPathPoint(ev.latLng);
      });
    } else {
      this.gmap.setOptions({ draggableCursor: undefined });
    }
    this.isDrawing = on;
  }

  private enableDrawingMode(): void {
    if (!this.gmap || this.isRouteFinalized) return;

    if (!this.pathPolyline) {
      this.pathPolyline = new google.maps.Polyline({
        ...this.polylineStyle,
        path: this.pathPoints,
        map: this.gmap!,
      });
    }
    this.setDrawingEnabled(true);
  }

  private async addPathPoint(latLng: google.maps.LatLng | google.maps.LatLngLiteral): Promise<void> {
    // Validar que haya un tipo de variante seleccionado antes de agregar puntos
    if (!this.idTipoVariante) {
      this.alerts.open({
        type: 'warning',
        title: 'Tipo de Variante Requerido',
        message: 'Por favor, selecciona un tipo de variante antes de comenzar el recorrido detallado.',
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    const ll =
      (latLng as google.maps.LatLng).toJSON
        ? (latLng as google.maps.LatLng).toJSON()
        : (latLng as google.maps.LatLngLiteral);

    // Si el tipo de variante es estacionaria (id 2), pedir el nombre de la estación
    let nombreEstacion: string | undefined = undefined;
    if (this.idTipoVariante === 2) {
      const resultado = await this.alerts.open({
        type: 'info',
        title: 'Nombre de la Estación',
        message: 'Ingresa el nombre de la estación para este punto:',
        confirmText: 'Guardar',
        cancelText: 'Cancelar',
        showCancel: true,
        backdropClose: false,
        inputEnabled: true,
        inputLabel: 'Nombre de la estación',
        inputPlaceholder: 'Ej: Estación Central, Terminal Norte, etc.',
        inputValue: '',
      });

      if (resultado === 'confirm') {
        nombreEstacion = this.alerts.getInputValue()?.trim() || undefined;
        if (!nombreEstacion) {
          this.alerts.open({
            type: 'warning',
            title: 'Nombre Requerido',
            message: 'El nombre de la estación es obligatorio para variantes estacionarias.',
            confirmText: 'Entendido',
            backdropClose: false,
          });
          return; // No agregar el punto si no hay nombre
        }
      } else {
        // Si canceló, no agregar el punto
        return;
      }
    }

    // Crear el punto con nombre si existe
    const punto: google.maps.LatLngLiteral & { nombre?: string } = {
      ...ll,
      ...(nombreEstacion ? { nombre: nombreEstacion } : {})
    };

    this.pathPoints.push(punto);

    const marker = new google.maps.Marker({
      map: this.gmap!,
      position: ll,
      icon: this.circlePoint,
      title: nombreEstacion || undefined, // Mostrar el nombre en el tooltip del marcador
    });
    this.pathPointMarkers.push(marker);

    this.pathPolyline?.setPath(this.pathPoints);
  }

  public deshacerUltimoPunto(): void {
    if (!this.pathPoints.length || this.isRouteFinalized) return;
    this.pathPoints.pop();
    const m = this.pathPointMarkers.pop();
    m?.setMap(null);
    this.pathPolyline?.setPath(this.pathPoints);
  }

  public limpiarTrazo(): void {
    this.resetDrawing();
    this.isRouteFinalized = false;
    this.setDrawingEnabled(true);
  }

  public obtenerTrazo(): (google.maps.LatLngLiteral & { nombre?: string })[] {
    return [...this.pathPoints];
  }

  /** Máximo permitido para cantidadEstacionesBase: cantidad de puntos del recorrido detallado */
  get maxCantidadEstacionesBase(): number {
    return this.obtenerTrazo().length;
  }

  private cantidadEstacionesBaseMaxValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const val = control.value;
      if (val == null || val === '') return null;
      const n = Number(val);
      if (Number.isNaN(n)) return null;
      const max = this.maxCantidadEstacionesBase;
      if (n > max) return { cantidadEstacionesBaseMax: { max, actual: n } };
      return null;
    };
  }

  private resetDrawing(): void {
    this.pathPointMarkers.forEach((m) => m.setMap(null));
    this.pathPointMarkers = [];
    this.pathPoints = [];

    if (this.pathPolyline) {
      this.pathPolyline.setMap(null as any);
      this.pathPolyline = null;
    }

    this.mapClickListener?.remove();
    this.mapClickListener = null;
    this.isDrawing = false;
  }

  public finalizarTrayecto(): void {
    if (!this.canFinalize) return;
    this.setDrawingEnabled(false);
    this.isRouteFinalized = true;
  }

  // Opcional: MapID vector
  private readonly MAP_ID = 'DEMO_MAP_ID';

  private createFaMarker(iconClass: string, color: string, sizePx = 38): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.transform = 'translateY(-6px)';
    const i = document.createElement('i');
    i.className = iconClass; // 'fa-solid fa-location-dot'
    i.style.fontSize = `${sizePx}px`;
    i.style.color = color;
    i.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,.35))';
    wrap.appendChild(i);
    return wrap;
  }

  private makeWhiteDot(): HTMLElement {
    const el = document.createElement('div');
    el.style.width = '10px';
    el.style.height = '10px';
    el.style.borderRadius = '9999px';
    el.style.background = '#fff';
    el.style.boxShadow = 'none';
    return el;
  }

  private svgPinUrl(color: string) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
      <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" fill="${color}"/>
      <circle cx="12" cy="9" r="3" fill="#ffffff"/>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  private clearMarker(m: any) {
    if (!m) return;
    if (typeof m.setMap === 'function') m.setMap(null);
    else if ('map' in m) (m as any).map = null;
  }

private async renderGoogleMap(): Promise<void> {
  if (!this.selectedRuta || !this.selectedRuta.inicio || !this.selectedRuta.fin) return;

  await this.ensureGoogleLoaded();

  const el = document.getElementById('map');
  if (!el) return;

  // (Re)crear el mapa si no existe o si el DIV cambió
  const needsRecreate = !this.gmap || (this.gmap.getDiv && this.gmap.getDiv() !== el);
  if (needsRecreate) {
    this.gmap = new google.maps.Map(el, this.mapOptions);
  }

  // A partir de aquí, usa una ref local no nula para evitar TS2531
  const map = this.gmap as google.maps.Map;

  // MapID (opcional)
  if (this.MAP_ID) map.setOptions({ mapId: this.MAP_ID });

  // Limpiar markers previos
  this.clearMarker(this.startMarker);
  this.clearMarker(this.endMarker);
  this.startMarker = null;
  this.endMarker = null;

  const start: google.maps.LatLngLiteral = this.selectedRuta.inicio as google.maps.LatLngLiteral;
  const end: google.maps.LatLngLiteral = this.selectedRuta.fin as google.maps.LatLngLiteral;

  // Advanced Markers detection
  const Advanced = (google.maps as any)?.marker?.AdvancedMarkerElement;
  const Pin = (google.maps as any)?.marker?.PinElement;
  const canAdvancedFa = Boolean(Advanced);
  const canAdvancedPin = Boolean(Advanced && Pin);

  if (canAdvancedFa) {
    // AdvancedMarker + Font Awesome (preferido)
    const iniEl = this.createFaMarker('fa-solid fa-location-dot', '#16a34a', 38);
    const finEl = this.createFaMarker('fa-solid fa-location-dot', '#ef4444', 38);

    this.startMarker = new Advanced({
      map,
      position: start,
      title: `Inicio: ${this.selectedRuta.origen ?? ''}`,
      content: iniEl
    });
    this.endMarker = new Advanced({
      map,
      position: end,
      title: `Fin: ${this.selectedRuta.destino ?? ''}`,
      content: finEl
    });

  } else if (canAdvancedPin) {
    // AdvancedMarker + PinElement
    const dot = this.makeWhiteDot();
    const pinInicio = new Pin({ background: '#16a34a', borderColor: '#16a34a', glyph: dot });
    const pinFin = new Pin({ background: '#ef4444', borderColor: '#ef4444', glyph: dot.cloneNode(true) as HTMLElement });

    this.startMarker = new Advanced({
      map,
      position: start,
      title: `Inicio: ${this.selectedRuta.origen ?? ''}`,
      content: pinInicio.element
    });
    this.endMarker = new Advanced({
      map,
      position: end,
      title: `Fin: ${this.selectedRuta.destino ?? ''}`,
      content: pinFin.element
    });

  } else {
    // Fallback: Marker clásico con SVG
    this.startMarker = new google.maps.Marker({
      map,
      position: start,
      title: `Inicio: ${this.selectedRuta.origen ?? ''}`,
      icon: {
        url: this.svgPinUrl('#16a34a'),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 38)
      }
    });
    this.endMarker = new google.maps.Marker({
      map,
      position: end,
      title: `Fin: ${this.selectedRuta.destino ?? ''}`,
      icon: {
        url: this.svgPinUrl('#ef4444'),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 38)
      }
    });
  }

  // Ajuste de cámara con padding
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(start);
  bounds.extend(end);
  // @ts-ignore overload con padding
  map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  requestAnimationFrame(() => {
    // @ts-ignore
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  });

  // Modo dibujo según estado
  if (!this.isRouteFinalized) this.enableDrawingMode();
  else this.setDrawingEnabled(false);
}

private destroyMap(): void {
  // Limpia markers y trazos
  this.clearMarker(this.startMarker);
  this.startMarker = null;
  this.clearMarker(this.endMarker);
  this.endMarker = null;

  this.resetDrawing();

  // Si el div del mapa existe, límpialo
  const el = document.getElementById('map');
  if (el) el.innerHTML = '';

  // *** Importante: anular la instancia para forzar recreación al volver ***
  this.gmap = null;
}


  // ==========================
  // Navegación de pasos
  // ==========================
  goStep1(): void {
    // ahora step 1 = Rutas
    this.step = 1;
    this.selectedRuta = null;
    this.nombreVariante = '';
    this.isRouteFinalized = false;
    this.destroyMap();
  }

goStep2(): void {
  if (!this.selectedRuta) return;
  this.step = 2;
  this.nombreVariante = this.selectedRuta.nombre || '';
  // esperar a que el DOM monte el nuevo #map
  setTimeout(() => this.renderGoogleMap(), 0);
}


  private async buildVariantePayloadAsync(): Promise<any> {
  if (typeof this.buildVariantePayload === 'function') {
    return this.buildVariantePayload();
  }
  return null;
}

async agregarVariante(): Promise<void> {
  const body = await this.buildVariantePayloadAsync();

  if (
    !body?.idRuta ||
    !body?.puntoInicio?.coordenadas ||
    !body?.puntoFin?.coordenadas ||
    !(Array.isArray(body?.recorridoDetallado) && body.recorridoDetallado.length >= 2)
  ) {
    // Warning con lista numerada en negritas (patrón base)
    this.alerts.open({
      type: 'warning',
      title: '¡Atención!',
      message: `
        <ol style="padding-left:18px;margin:0">
          <li><strong>Selecciona una ruta válida.</strong></li>
          <li><strong>Verifica inicio y fin con coordenadas.</strong></li>
          <li><strong>Traza al menos un segmento (2 puntos o más).</strong></li>
        </ol>
      `,
      confirmText: 'Entendido',
      backdropClose: false,
    });
    return;
  }

  // Preguntar si desea registrar una variante de regreso (ANTES de la confirmación de guardar)
  const respuestaRegreso = await this.alerts.open({
    type: 'warning',
    title: 'Variante de Regreso',
    message: '¿Desea registrar una variante de regreso para esta variante?',
    showCancel: true,
    confirmText: 'Sí',
    cancelText: 'No',
    backdropClose: false,
  });

  const registraRegreso = respuestaRegreso === 'confirm';
  body.registraRegreso = registraRegreso;

  // Confirmación de guardar
  const res = await this.alerts.open({
    type: 'warning',
    title: '¡Confirmar!',
    message: '¿Deseas guardar la variante con el trayecto actual?',
    showCancel: true,
    confirmText: 'Confirmar',
    cancelText: 'Editar',
    backdropClose: false,
  });

  if (res !== 'confirm') {
    // Seguir editando
    return;
  }

  this.variaService.agregarVariante(body).subscribe({
  next: (resp: any) => {
    // Respuesta típica: { status: "succes", message: "...", id: 49, nombre: "...", distancia: 1.2, estatus: 1 }
    const createdId = Number(resp?.id ?? resp?.data?.id);
    if (!Number.isFinite(createdId) || createdId <= 0) {
      // Si el backend llegó sin ID, mostramos error
      this.alerts.open({
        type: 'error',
        title: '¡Ops!',
        message: 'El servicio no devolvió un ID de variante válido.',
        confirmText: 'Confirmar',
        backdropClose: false,
      });
      return;
    }


    // Parchar el form de TARIFA con el id de la variante creada (requerido en tu form)
    this.tarifaForm.patchValue({
      idVariante: createdId,
      estatus: 1,      // opcional pero útil para el usuario
    });

    this.tarifaForm.get('idVariante')?.markAsDirty();
    this.tarifaForm.get('idVariante')?.updateValueAndValidity({ onlySelf: true });

    // Actualizar campos según el tipo de variante antes de ir al paso 3
    this.actualizarCamposSegunTipoVariante();

    // Ir directo a Paso 3 (sin alertas de éxito)
    this.step = 3;
  },
  error: (error: any) => {
    this.alerts.open({
      type: 'error',
      title: '¡Ops!',
      message: mensajeDeError(error) || 'Ocurrió un error al guardar la variante. Inténtalo de nuevo.',
      confirmText: 'Confirmar',
      backdropClose: false,
    });
  },
});

}



  // Guarda el último payload armado (opcional, por si luego lo quieres enviar)
  private payloadVariante: any | null = null;

  private polylineDistanceKm(points: google.maps.LatLngLiteral[]): number {
    if (!Array.isArray(points) || points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    }
    return Math.round(total * 10) / 10; // 1 decimal
  }

  private buildVariantePayload(): any {
    if (!this.selectedRuta || !this.selectedRuta.inicio || !this.selectedRuta.fin) return null;

    const start = this.selectedRuta.inicio as google.maps.LatLngLiteral;
    const end = this.selectedRuta.fin as google.maps.LatLngLiteral;

    // Trayecto dibujado por el usuario (si no hay, será [])
    const recorridoDetallado = this.obtenerTrazo();

    // Distancia: si hay trazo, sumar segmentos; si no, recta inicio-fin
    const distanciaKm = (recorridoDetallado.length >= 2)
      ? this.polylineDistanceKm(recorridoDetallado)
      : Math.round(haversineKm(start.lat, start.lng, end.lat, end.lng) * 10) / 10;

    const payload = {
      nombre: (this.nombreVariante || '').trim() || this.selectedRuta.nombre || '',
      puntoInicio: {
        coordenadas: { lat: start.lat, lng: start.lng },
        direccion: this.selectedRuta.origen ?? null,   // viene de la ruta
      },
      puntoFin: {
        coordenadas: { lat: end.lat, lng: end.lng },
        direccion: this.selectedRuta.destino ?? null,  // viene de la ruta
      },
      recorridoDetallado,       // array de { lat, lng } del trazo en el mapa
      distanciaKm,              // calculada arriba
      estatus: 1,               // fijo a 1
      idRuta: this.selectedRuta.id, // de la ruta seleccionada
      idTipoVariante: this.idTipoVariante ?? null, // tipo de variante seleccionado
    };

    return payload;
  }


  // ==========================
  // Tarifa
  // ==========================
  isTarifaValida(): boolean { return this.tarifaForm.valid; }

    private toNum(v: any): number {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'string') v = v.replace(',', '.').trim();
    return Number(v);
  }
agregarTarifa(): void {

  if (this.tarifaForm.invalid) {

    const etiquetas: Record<string, string> = {
      idTipoTarifa: 'Tipo Tarifa',
      tarifaBase: 'Tarifa Base',
      cantidadEstacionesBase: 'Cantidad Estaciones Base',
      distanciaBaseKm: 'Distancia Base KM',
      incrementoCadaMetros: 'Incremento por cada 100 m adicionales',
      costoAdicional: 'Costo Adicional',
      costoPorEstacion: 'Costo por Estación',
      estatus: 'Estatus',
      idVariante: 'Variante',
    };

    const faltantes: string[] = [];
    Object.keys(this.tarifaForm.controls).forEach((key) => {
      const control = this.tarifaForm.get(key);
      if (!control?.invalid) return;
      if (control.errors?.['required']) {
        faltantes.push(etiquetas[key] || key);
      } else if (control.errors?.['cantidadEstacionesBaseMax']) {
        faltantes.push(`Cantidad Estaciones Base no puede superar las ${this.maxCantidadEstacionesBase} estaciones del recorrido`);
      }
    });

    const lista = faltantes.map((campo, i) => `
      <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
        <strong style="color:#b02a37;">${i + 1}. ${campo}</strong>
      </div>
    `).join('');

    this.alerts.open({
      type: 'error',
      title: '¡Faltan campos obligatorios!',
      message: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;">
          Completa los siguientes campos antes de continuar:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
      confirmText: 'Entendido',
      backdropClose: false,
    });
    return;
  }

  const v = this.tarifaForm.getRawValue();
  const tipoTarifa = this.listaTiposTarifa.find(t => t.id === v.idTipoTarifa);
  const nombreTipo = tipoTarifa?.nombre?.toLowerCase() || '';
  const esFija = nombreTipo.includes('fija') || nombreTipo.includes('fijo');
  const esEstacionaria = nombreTipo.includes('estacionaria') || nombreTipo.includes('estacionario');
  
  const payload: any = {
    idTipoTarifa: this.toNum(v.idTipoTarifa),
    estatus: this.toNum(v.estatus),
    idVariante: this.toNum(v.idVariante),
  };

  // Si es Estacionaria: tarifaBase, cantidadEstacionesBase y costoPorEstacion
  if (esEstacionaria) {
    payload.tarifaBase = this.toNum(v.tarifaBase);
    payload.cantidadEstacionesBase = this.toNum(v.cantidadEstacionesBase);
    payload.costoPorEstacion = this.toNum(v.costoPorEstacion);
  } else {
    // Para Fija e Incremental, agregar tarifaBase
    payload.tarifaBase = this.toNum(v.tarifaBase);
    
    // Solo agregar campos adicionales si es Incremental (no Fija)
    if (!esFija) {
      payload.distanciaBaseKm = this.toNum(v.distanciaBaseKm);
      payload.incrementoCadaMetros = this.toNum(v.incrementoCadaMetros);
      payload.costoAdicional = this.toNum(v.costoAdicional);
    }
  }

  const etiquetasNum: Record<string, string> = {
    idTipoTarifa: 'Tipo Tarifa',
    tarifaBase: 'Tarifa Base',
    cantidadEstacionesBase: 'Cantidad Estaciones Base',
    distanciaBaseKm: 'Distancia Base KM',
    incrementoCadaMetros: 'Incremento por cada 100 m adicionales',
    costoAdicional: 'Costo Adicional',
    costoPorEstacion: 'Costo por Estación',
    estatus: 'Estatus',
    idVariante: 'Variante',
  };

  // Filtrar campos que no deben validarse según el tipo de tarifa
  const camposAValidar: Record<string, number> = {};
  Object.entries(payload).forEach(([key, value]) => {
    // Si es Estacionaria, no validar distanciaBaseKm ni incrementoCadaMetros ni costoAdicional
    if (esEstacionaria && (key === 'distanciaBaseKm' || key === 'incrementoCadaMetros' || key === 'costoAdicional')) {
      return; // No agregar estos campos a la validación
    }
    // Si es Fija, no validar distanciaBaseKm, incrementoCadaMetros ni costoAdicional
    if (esFija && (key === 'distanciaBaseKm' || key === 'incrementoCadaMetros' || key === 'costoAdicional')) {
      return; // No agregar estos campos a la validación
    }
    camposAValidar[key] = value as number;
  });

  const invalidNums = Object.entries(camposAValidar)
    .filter(([, val]) => Number.isNaN(val))
    .map(([k]) => etiquetasNum[k] || k);

  if (invalidNums.length) {

    const lista = invalidNums.map((campo, i) => `
      <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
        <strong style="color:#b02a37;">${i + 1}. ${campo} (número inválido)</strong>
      </div>
    `).join('');

    this.alerts.open({
      type: 'error',
      title: 'Datos inválidos',
      message: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;">
          Revisa los siguientes campos. Deben ser valores numéricos:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
      confirmText: 'Entendido',
      backdropClose: false,
    });
    return;
  }

  this.tarSerice.agregarTarifa(payload).subscribe(
    () => {

      // Éxito: tu patrón de alertas
      this.alerts.open({
        type: 'success',
        title: '¡Operación Exitosa!',
        message: 'Se agregó una variante de manera correcta.',
        confirmText: 'Confirmar',
        backdropClose: false,
      });

      // Si cierras modales aquí, deja tu línea (opcional):
      // this.modalService.dismissAll();

      this.regresar();
    },
    (err) => {

      this.alerts.open({
        type: 'error',
        title: '¡Ops!',
        message: 'Ocurrió un error al agregar la tarifa.',
        confirmText: 'Confirmar',
        backdropClose: false,
      });
      console.error('[TARIFA][ERROR]');
    }
  );
}


   moneyKeydown(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    const input = e.target as HTMLInputElement;
    const value = input.value || '';
    if (e.key === '.') {
      if (value.includes('.')) e.preventDefault();
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    const selStart = input.selectionStart ?? value.length;
    const selEnd = input.selectionEnd ?? value.length;
    const newValue = value.slice(0, selStart) + e.key + value.slice(selEnd);
    const parts = newValue.split('.');
    if (parts[1] && parts[1].length > 2) e.preventDefault();
  }

  moneyInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = (input.value || '').replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    const parts = v.split('.');
    if (parts[1]) v = parts[0] + '.' + parts[1].slice(0, 2);
    input.value = v;
    this.tarifaForm.get('tarifaBase')?.setValue(v, { emitEvent: false });
  }

  moneyPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const text = (e.clipboardData?.getData('text') || '').replace(',', '.');

    let v = text.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    const parts = v.split('.');
    if (parts[1]) v = parts[0] + '.' + parts[1].slice(0, 2);

    input.value = v;
    this.tarifaForm.get('tarifaBase')?.setValue(v, { emitEvent: false });
  }

  moneyBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    let v = input.value;
    if (!v) return;
    if (/^\d+$/.test(v)) {
      v = v + '.00';
    } else if (/^\d+\.\d$/.test(v)) {
      v = v + '0';
    } else if (/^\d+\.\d{2}$/.test(v)) {
    } else {
      v = v.replace(',', '.').replace(/[^0-9.]/g, '');
      const parts = v.split('.');
      v = parts[0] + (parts[1] ? '.' + parts[1].slice(0, 2) : '.00');
      if (/^\d+$/.test(v)) v = v + '.00';
      if (/^\d+\.\d$/.test(v)) v = v + '0';
    }
    input.value = v;
    this.tarifaForm.get('tarifaBase')?.setValue(v, { emitEvent: false });
  }

  costoKeydown(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    const input = e.target as HTMLInputElement;
    const value = input.value || '';
    if (e.key === '.') {
      if (value.includes('.')) e.preventDefault();
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    const selStart = input.selectionStart ?? value.length;
    const selEnd = input.selectionEnd ?? value.length;
    const newValue = value.slice(0, selStart) + e.key + value.slice(selEnd);
    const parts = newValue.split('.');
    if (parts[1] && parts[1].length > 2) e.preventDefault();
  }

  costoInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = (input.value || '').replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    const parts = v.split('.');
    if (parts[1]) v = parts[0] + '.' + parts[1].slice(0, 2);
    input.value = v;
    this.tarifaForm.get('costoAdicional')?.setValue(v, { emitEvent: false });
  }

  costoPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const text = (e.clipboardData?.getData('text') || '').replace(',', '.');

    let v = text.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    const parts = v.split('.');
    if (parts[1]) v = parts[0] + '.' + parts[1].slice(0, 2);

    input.value = v;
    this.tarifaForm.get('costoAdicional')?.setValue(v, { emitEvent: false });
  }

  costoBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    let v = input.value;
    if (!v) return;
    if (/^\d+$/.test(v)) {
      v = v + '.00';
    } else if (/^\d+\.\d$/.test(v)) {
      v = v + '0';
    } else if (/^\d+\.\d{2}$/.test(v)) {
    } else {
      v = v.replace(',', '.').replace(/[^0-9.]/g, '');
      const parts = v.split('.');
      v = parts[0] + (parts[1] ? '.' + parts[1].slice(0, 2) : '.00');
      if (/^\d+$/.test(v)) v = v + '.00';
      if (/^\d+\.\d$/.test(v)) v = v + '0';
    }
    input.value = v;
    this.tarifaForm.get('costoAdicional')?.setValue(v, { emitEvent: false });
  }

  incrementoKeydown(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;

    const input = e.target as HTMLInputElement;
    const value = input.value || '';

    if (e.key === '.') {
      if (value.includes('.')) e.preventDefault();
      return;
    }

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  incrementoInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = (input.value || '').replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');

    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }

    input.value = v;
    this.tarifaForm.get('incrementoCadaMetros')?.setValue(v, { emitEvent: false });
  }

  incrementoPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const text = (e.clipboardData?.getData('text') || '').replace(',', '.');

    let v = text.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }

    input.value = v;
    this.tarifaForm.get('incrementoCadaMetros')?.setValue(v, { emitEvent: false });
  }

  distanciaKeydown(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;

    const input = e.target as HTMLInputElement;
    const value = input.value || '';

    if (e.key === '.') {
      if (value.includes('.')) e.preventDefault();
      return;
    }

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  distanciaInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = (input.value || '').replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');

    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }

    input.value = v;
    this.tarifaForm.get('distanciaBaseKm')?.setValue(v, { emitEvent: false });
  }

  distanciaPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const text = (e.clipboardData?.getData('text') || '').replace(',', '.');

    let v = text.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }

    input.value = v;
    this.tarifaForm.get('distanciaBaseKm')?.setValue(v, { emitEvent: false });
  }
}

/* ==========================
   Helpers puros
========================== */
function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(a))) * 10) / 10;
}
