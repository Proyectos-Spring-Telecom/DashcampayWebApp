import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { ZonasService } from 'src/app/pages/services/zonas.service';
import { googleMapsScriptUrl } from 'src/app/core/security/load-google-maps';
import {
  bloquearCaracteresEspecialesNombre,
  NOMBRE_SIN_ESPECIALES_REGEX,
  onPasteNombreSinEspeciales
} from 'src/app/core/validators/nombre-sin-especiales';

declare const google: any;

@Component({
  selector: 'vex-agregar-zona',
  templateUrl: './agregar-zona.component.html',
  styleUrl: './agregar-zona.component.scss',
  animations: [fadeInRight400ms],
})
export class AgregarZonaComponent implements OnInit, AfterViewInit, OnDestroy {
  layoutCtrl = new UntypedFormControl('fullwidth');

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public zonasForm!: FormGroup;
  public idZona!: number;
  public title = 'Agregar Zona';
  loadingDependientes = false;
  listaClientes: any[] = [];
  listaDipositivos: any[] = [];
  listaBlueVox: any[] = [];
  listaVehiculos: any[] = [];
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;

  public idClienteUser!: number;
  public idRolUser!: number;
  get isAdmin(): boolean { return this.idRolUser === 1; }

  private static mapsLoading?: Promise<void>;
  private map?: any;
  private resizeObserver?: ResizeObserver;
  private polygon?: any;
  private drawingMode = false;
  private drawPath?: any;
  private drawPolyline?: any;
  private mapClickListener?: any;
  private mapDblClickListener?: any;
  private drawControlBtn?: HTMLButtonElement;

  private readonly defaultCenter = { lat: 21.110778, lng: -86.762590 };
  private readonly defaultZoom = 13;

  constructor(
    private fb: FormBuilder,
    private zonService: ZonasService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private clieService: ClientesService,
    private users: AuthenticationService,
    private alerts: AlertsService,
  ) {
    const user = this.users.getUser();
    this.idClienteUser = Number(user?.idCliente);
    this.idRolUser = Number(user?.rol?.id);
  }

  ngOnInit(): void {
    this.initForm();
    this.obtenerClientes();

    this.activatedRouted.params.subscribe(
      (params) => {
        this.idZona = params['idZona'];
        if (this.idZona) {
          this.title = 'Actualizar Zona';
          this.submitButton = 'Actualizar';
          this.obtenerZona();
        } else {
          this.submitButton = 'Guardar';
        }
      }
    );
  }

  ngAfterViewInit(): void {
    this.loadGoogleMaps()
      .then(async () => {
        await this.initMap();
        this.observeResize();

        this.addDrawControl();
        this.addClearControl();

        const path = this.zonasForm.get('geocerca')?.value;
        if (Array.isArray(path) && path.length >= 3) {
          this.drawPolygonFromPath(path);
          this.fitToPolygon();
        }
      })
      .catch((err) => {
        this.showMapsErrorOverlay(
          'No se pudo cargar Google Maps',
          (err as Error)?.message || 'Error desconocido'
        );
        console.error('Google Maps no cargó:');
      });
  }

  ngOnDestroy(): void {
    this.stopCustomDrawing();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  obtenerClientes() {
    this.clieService.obtenerClientes().subscribe((response: any) => {
      this.listaClientes = this.normalizeId(response?.data);

      if (!this.isAdmin) {
        this.zonasForm.get('idCliente')?.setValue(this.idClienteUser, { emitEvent: false });
      }
    });
  }

  obtenerZona() {
    this.zonService.obtenerZona(this.idZona).subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data[0] : response?.data;

        if (!data) {
          return;
        }

        const idCliSrv = Number(
          (data as any)?.idCliente ??
          (data as any)?.idCliente2?.id ??
          null
        );

        const gxAny: any =
          (data as any)?.geocerca ??
          (data as any)?.poligono ??
          (data as any)?.polygon ??
          (data as any)?.coordenadas ??
          null;

        const path = this.extractPathFromGeo(gxAny);

        this.zonasForm.patchValue(
          {
            estatus: data?.estatus ?? 1,
            nombre: data?.nombre ?? '',
            descripcion: data?.descripcion ?? '',
            idCliente: this.isAdmin ? idCliSrv : this.idClienteUser,
            geocerca: path || [],
          },
          { emitEvent: false }
        );

        if (this.map && Array.isArray(path) && path.length >= 3) {
          this.drawPolygonFromPath(path);
          this.fitToPolygon();
        }

        if (!this.isAdmin) {
          this.zonasForm.get('idCliente')?.disable({ onlySelf: true });
        } else {
          this.zonasForm.get('idCliente')?.enable({ onlySelf: true });
        }
      },
      error: (err) => {
        console.error('Error al obtener zona:');
      },
    });
  }

  private extractPathFromGeo(gx: any): Array<{ lat: number; lng: number }> {
    if (!gx) return [];

    if (
      gx.type === 'FeatureCollection' &&
      Array.isArray(gx.features) &&
      gx.features.length
    ) {
      const geom = gx.features[0]?.geometry;
      return this.extractPathFromGeo(geom);
    }

    if (gx.type === 'Feature' && gx.geometry) {
      return this.extractPathFromGeo(gx.geometry);
    }

    if (gx.type === 'Polygon' && Array.isArray(gx.coordinates)) {
      const ring = gx.coordinates[0] || [];
      return ring
        .map((p: any) =>
          Array.isArray(p) && p.length >= 2
            ? { lat: Number(p[1]), lng: Number(p[0]) }
            : null
        )
        .filter(Boolean) as Array<{ lat: number; lng: number }>;
    }

    if (Array.isArray(gx)) {
      return gx
        .map((p: any) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    }

    return [];
  }

  private normalizeId<T extends { id: any }>(arr: T[] = []): (T & { id: number })[] {
    return arr.map((x: any) => ({ ...x, id: Number(x.id) }));
  }

  initForm() {
    this.zonasForm = this.fb.group({
      estatus: [1, Validators.required],
      nombre: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
      descripcion: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
      idCliente: [this.isAdmin ? null : this.idClienteUser, Validators.required],
      geocerca: [[]],
    });

    if (!this.isAdmin) {
      this.zonasForm.get('idCliente')?.disable({ onlySelf: true });
    }
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idZona) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  async agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.zonasForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      this.zonasForm.markAllAsTouched();

      const etiquetas: any = {
        nombre: 'Nombre',
        descripcion: 'Descripción',
        idCliente: 'Cliente',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.zonasForm.controls).forEach(key => {
        const control = this.zonasForm.get(key);
        if (!control?.invalid || !control.errors) return;
        const label = etiquetas[key] || key;
        if (control.errors['required']) {
          camposFaltantes.push(label);
        } else if (control.errors['maxlength']) {
          camposFaltantes.push(`${label}: máximo ${control.errors['maxlength'].requiredLength} caracteres`);
        } else if (control.errors['pattern']) {
          camposFaltantes.push(`${label}: no permite caracteres especiales`);
        }
      });

      const lista = camposFaltantes.map((campo, index) => `
      <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                  background: #caa8a8; text-align: center; margin-bottom: 8px;
                  border-radius: 4px;">
        <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
      </div>
    `).join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Hay campos obligatorios sin completar.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    const raw = this.zonasForm.getRawValue();
    const featureCollection = this.buildFeatureCollectionFromForm();

    const payload = {
      nombre: raw.nombre,
      descripcion: raw.descripcion,
      geocerca: featureCollection,
      estatus: raw.estatus,
      idCliente: raw.idCliente,
    };

    this.zonService.agregarZona(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;

        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó una nueva zona de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });

        this.regresar();
      },
      (error) => {
        this.submitButton = 'Guardar';
        this.loading = false;

        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: String(error),
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  async actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.zonasForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      this.zonasForm.markAllAsTouched();

      const etiquetas: any = {
        nombre: 'Nombre',
        descripcion: 'Descripción',
        idCliente: 'Cliente',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.zonasForm.controls).forEach(key => {
        const control = this.zonasForm.get(key);
        if (!control?.invalid || !control.errors) return;
        const label = etiquetas[key] || key;
        if (control.errors['required']) {
          camposFaltantes.push(label);
        } else if (control.errors['maxlength']) {
          camposFaltantes.push(`${label}: máximo ${control.errors['maxlength'].requiredLength} caracteres`);
        } else if (control.errors['pattern']) {
          camposFaltantes.push(`${label}: no permite caracteres especiales`);
        }
      });

      const lista = camposFaltantes.map((campo, index) => `
      <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                  background: #caa8a8; text-align: center; margin-bottom: 8px;
                  border-radius: 4px;">
        <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
      </div>
    `).join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Hay campos obligatorios sin completar.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return; // importante salir si es inválido
    }

    const raw = this.zonasForm.getRawValue();
    const featureCollection = this.buildFeatureCollectionFromForm();

    const payload = {
      nombre: raw.nombre,
      descripcion: raw.descripcion,
      geocerca: featureCollection,
      estatus: raw.estatus,
      idCliente: raw.idCliente,
    };

    this.zonService.actualizarZona(this.idZona, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;

        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos de la zona se actualizaron correctamente.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });

        this.regresar();
      },
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;

        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al actualizar la zona.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }


  onPasteSinEspeciales(event: ClipboardEvent, controlName: 'nombre' | 'descripcion'): void {
    onPasteNombreSinEspeciales(event, this.zonasForm.get(controlName));
  }

  bloquearCaracteresEspecialesNombre = bloquearCaracteresEspecialesNombre;

  regresar() {
    this.route.navigateByUrl('/administracion/zonas');
  }

  private buildFeatureCollectionFromForm() {
    let path: Array<{ lat: number; lng: number }> = [];
    if (this.polygon) {
      path = this.polygon
        .getPath()
        .getArray()
        .map((ll: any) => ({
          lat: Number(ll.lat()),
          lng: Number(ll.lng()),
        }));
    } else {
      path = Array.isArray(this.zonasForm.get('geocerca')?.value)
        ? this.zonasForm.get('geocerca')!.value
        : [];
    }

    const cleaned = path
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    const ring: number[][] = cleaned.map((p) => [p.lng, p.lat]);
    if (ring.length >= 3) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
    }

    return {
      type: 'FeatureCollection',
      features:
        cleaned.length >= 3
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Polygon',
                  coordinates: [ring],
                },
              },
            ]
          : [],
    };
  }

  private loadGoogleMaps(): Promise<void> {
    if ((window as any).google?.maps?.Map) {
      return Promise.resolve();
    }

    const existing =
      document.querySelector<HTMLScriptElement>('script[data-gmaps="js"]') ||
      (Array.from(document.getElementsByTagName('script')).find((s) =>
        s.src.includes('maps.googleapis.com/maps/api/js')
      ) as HTMLScriptElement | undefined);

    if (existing) {
      if ((window as any).google?.maps?.Map) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('No se pudo cargar Google Maps'))
        );
      });
    }

    if (!AgregarZonaComponent.mapsLoading) {
      AgregarZonaComponent.mapsLoading = this.loadGoogleMapsScript();
    }
    return AgregarZonaComponent.mapsLoading;
  }

  private loadGoogleMapsScript(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.setAttribute('data-gmaps', 'js');
      const src = googleMapsScriptUrl('marker');
      if (!src) {
        reject(new Error('No se pudo cargar Google Maps'));
        return;
      }
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('No se pudo cargar Google Maps'));
      document.head.appendChild(script);
    });
  }

  private getMapElement(): HTMLElement | null {
    const el = document.getElementById('map');
    return el instanceof HTMLElement ? el : null;
  }

  private async initMap(): Promise<void> {
    await new Promise(requestAnimationFrame);
    const el = this.getMapElement();
    if (!el) return;

    if (!(window as any).google?.maps?.Map) {
      this.showMapsErrorOverlay(
        'Google Maps no ha cargado',
        'Revisa la API key o las restricciones del referer.'
      );
      return;
    }

    this.map = new google.maps.Map(el, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      clickableIcons: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        },
        {
          featureType: 'poi',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    setTimeout(() => {
      if (this.map) {
        google.maps.event.trigger(this.map, 'resize');
        this.map.setCenter(this.defaultCenter);
      }
    }, 0);
  }

  private observeResize(): void {
    const el = this.getMapElement();
    if (!el || !('ResizeObserver' in window)) return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      if (this.map && this.getMapElement()) {
        google.maps.event.trigger(this.map, 'resize');
      }
    });
    this.resizeObserver.observe(el);
  }

  private startCustomDrawing(): void {
    if (!this.map) return;

    this.stopCustomDrawing();

    if (this.polygon) {
      this.polygon.setMap(null);
      this.polygon = undefined;
    }
    this.zonasForm.get('geocerca')?.setValue([], { emitEvent: false });
    this.zonasForm.get('geocerca')?.markAsDirty();

    this.drawingMode = true;
    this.drawPath = new google.maps.MVCArray();
    this.drawPolyline = new google.maps.Polyline({
      map: this.map,
      path: this.drawPath,
      strokeColor: '#1E88E5',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      clickable: false,
      zIndex: 10,
    });

    this.map.setOptions({
      draggableCursor: 'crosshair',
      disableDoubleClickZoom: true,
    });

    this.mapClickListener = this.map.addListener('click', (e: any) => {
      if (!this.drawingMode || !e?.latLng || !this.drawPath) return;
      this.drawPath.push(e.latLng);
    });

    this.mapDblClickListener = this.map.addListener('dblclick', (e: any) => {
      if (!this.drawingMode) return;
      if (e?.domEvent?.preventDefault) e.domEvent.preventDefault();
      if (e?.domEvent?.stopPropagation) e.domEvent.stopPropagation();
      this.finishCustomDrawing();
    });

    if (this.drawControlBtn) {
      this.drawControlBtn.textContent = 'Finalizar geocerca';
      this.drawControlBtn.style.background = '#198754';
    }
  }

  private finishCustomDrawing(): void {
    if (!this.drawingMode || !this.drawPath) return;

    const points = this.drawPath.getArray() || [];
    if (points.length < 3) {
      this.alerts.open({
        type: 'warning',
        title: 'Geocerca incompleta',
        message: 'Debes marcar al menos 3 puntos. Haz clic en el mapa para agregar vértices y luego finaliza.',
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    const coords = points.map((ll: any) => ({
      lat: ll.lat(),
      lng: ll.lng(),
    }));

    this.stopCustomDrawing();
    this.drawPolygonFromPath(coords);
    this.fitToPolygon();
  }

  private stopCustomDrawing(): void {
    this.drawingMode = false;

    if (this.mapClickListener) {
      google.maps.event.removeListener(this.mapClickListener);
      this.mapClickListener = undefined;
    }
    if (this.mapDblClickListener) {
      google.maps.event.removeListener(this.mapDblClickListener);
      this.mapDblClickListener = undefined;
    }

    if (this.drawPolyline) {
      this.drawPolyline.setMap(null);
      this.drawPolyline = undefined;
    }
    this.drawPath = undefined;

    this.map?.setOptions({
      draggableCursor: null,
      disableDoubleClickZoom: false,
    });

    if (this.drawControlBtn) {
      this.drawControlBtn.textContent = 'Dibujar geocerca';
      this.drawControlBtn.style.background = '#0d6efd';
    }
  }

  private syncPolygonToForm(): void {
    if (!this.polygon) {
      this.zonasForm.get('geocerca')?.setValue([]);
      return;
    }
    const path: any[] = this.polygon
      .getPath()
      .getArray()
      .map((ll: any) => ({
        lat: ll.lat(),
        lng: ll.lng(),
      }));
    this.zonasForm.get('geocerca')?.setValue(path, { emitEvent: false });
    this.zonasForm.get('geocerca')?.markAsDirty();
  }

  private drawPolygonFromPath(path: Array<{ lat: number; lng: number }>): void {
    if (!this.map || !Array.isArray(path) || path.length < 3) return;

    if (this.polygon) {
      this.polygon.setMap(null);
      this.polygon = undefined;
    }

    this.polygon = new google.maps.Polygon({
      paths: path,
      fillColor: '#1E88E5',
      fillOpacity: 0.15,
      strokeColor: '#1E88E5',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      editable: true,
      draggable: false,
      map: this.map,
      zIndex: 10,
    });

    const p = this.polygon.getPath();
    p.addListener('insert_at', () => this.syncPolygonToForm());
    p.addListener('set_at', () => this.syncPolygonToForm());
    p.addListener('remove_at', () => this.syncPolygonToForm());

    this.syncPolygonToForm();
  }

  private fitToPolygon(): void {
    if (!this.map || !this.polygon) return;
    const bounds = new google.maps.LatLngBounds();
    this.polygon.getPath().forEach((ll: any) => bounds.extend(ll));
    this.map.fitBounds(bounds);
  }

  private addDrawControl(): void {
    if (!this.map) return;

    const controlDiv = document.createElement('div');
    controlDiv.style.margin = '10px';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Dibujar geocerca';
    btn.style.padding = '8px 12px';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 1px 4px rgba(0,0,0,.3)';
    btn.style.background = '#0d6efd';
    btn.style.color = '#fff';
    btn.style.fontSize = '13px';
    this.drawControlBtn = btn;

    btn.onclick = () => {
      if (this.drawingMode) {
        this.finishCustomDrawing();
        return;
      }
      this.startCustomDrawing();
    };

    controlDiv.appendChild(btn);
    this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
  }

  private addClearControl(): void {
    if (!this.map) return;

    const controlDiv = document.createElement('div');
    controlDiv.style.margin = '10px';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Borrar geocerca';
    btn.style.padding = '8px 12px';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 1px 4px rgba(0,0,0,.3)';
    btn.style.background = '#b02a37';
    btn.style.color = '#fff';
    btn.style.fontSize = '13px';

    btn.onclick = () => {
      this.stopCustomDrawing();
      if (this.polygon) {
        this.polygon.setMap(null);
        this.polygon = undefined;
      }
      this.zonasForm.get('geocerca')?.setValue([], { emitEvent: false });
      this.zonasForm.get('geocerca')?.markAsDirty();
    };

    controlDiv.appendChild(btn);
    this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
  }

  private showMapsErrorOverlay(title: string, detail: string) {
    const el = this.getMapElement();
    if (!el) return;
    el.replaceChildren();
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#e9ecef;border-radius:8px;';
    const inner = document.createElement('div');
    inner.style.cssText = 'text-align:center;max-width:520px;padding:16px;';
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:42px;line-height:1;';
    icon.textContent = '⚠️';
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight:600;margin-top:8px;color:#333;';
    titleEl.textContent = title ?? '';
    const detailEl = document.createElement('div');
    detailEl.style.cssText = 'font-size:13px;margin-top:6px;color:#555;';
    detailEl.textContent = detail ?? '';
    inner.append(icon, titleEl, detailEl);
    wrap.appendChild(inner);
    el.appendChild(wrap);
  }
}
