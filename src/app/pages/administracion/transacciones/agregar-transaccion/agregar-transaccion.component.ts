import { Component, Input, NgZone, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { DispositivosService } from 'src/app/pages/services/dispositivos.service';
import { MonederosServices } from 'src/app/pages/services/monederos.service';
import { TransaccionesService } from 'src/app/pages/services/transacciones.service';
import { loadGoogleMaps as cargarGoogleMaps } from 'src/app/core/security/load-google-maps';

@Component({
  selector: 'vex-agregar-transaccion',
  templateUrl: './agregar-transaccion.component.html',
  styleUrls: ['./agregar-transaccion.component.scss']
})
export class AgregarTransaccionComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton = 'Guardar';
  public loading = false;
  public listaDispositivos: any[] = [];
  public listaMonederos: any[] = [];
  public transaccionForm!: FormGroup;
  public title = 'Generar Transacción';

  constructor(
    private fb: FormBuilder,
    private route: Router,
    private transaccionService: TransaccionesService,
    private dispService: DispositivosService,
    private moneService: MonederosServices,
    private zone: NgZone,
    private alerts: AlertsService
  ) {}

  ngOnInit(): void {
    this.obtenerDispositivos();
    this.obtenerMonederos();
    this.initForm();
  }

  initForm() {
    this.transaccionForm = this.fb.group({
      tipoTransaccion: [null, Validators.required],
      monto: [null, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
      latitud: [null],
      longitud: [null],
      fechaHora: [this.nowForDatetimeLocal(), Validators.required],
      numeroSerieMonedero: ['', Validators.required],
      numeroSerieValidador: [null],
    });
  }

  obtenerDispositivos() {
    this.dispService.obtenerDispositivos().subscribe((response) => {
      this.listaDispositivos = (response?.data || []).map((d: any) => ({
        ...d,
        numeroSerie: d?.numeroSerie ?? d?.NumeroSerie ?? d?.numSerie ?? d?.serie ?? null,
      }));
    });
  }

  obtenerMonederos() {
    this.moneService.obtenerMonederos().subscribe((response) => {
      this.listaMonederos = response?.data || [];
    });
  }

  submit() {
    if (this.transaccionForm.invalid) {
      this.mostrarCamposFaltantes();
      return;
    }
    this.openUbicacionModal();
  }

  private async mostrarCamposFaltantes() {
    const etiquetas: Record<string, string> = {
      tipoTransaccion: 'Tipo de Transacción',
      monto: 'Monto',
      fechaHora: 'Fecha y Hora',
      numeroSerieMonedero: 'N° de Serie de Monedero',
    };

    const camposFaltantes: string[] = [];
    Object.keys(this.transaccionForm.controls).forEach((key) => {
      const control = this.transaccionForm.get(key);
      if (control?.errors?.['required']) {
        camposFaltantes.push(etiquetas[key] || key);
      }
    });

    if (!camposFaltantes.length) return;

    const lista = camposFaltantes.map((campo, i) => `
      <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                  background: #caa8a8; text-align: center; margin-bottom: 8px;
                  border-radius: 4px;">
        <strong style="color: #b02a37;">${i + 1}. ${campo}</strong>
      </div>
    `).join('');

    await this.alerts.open({
      type: 'warning',
      title: '¡Ops!',
      message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
      confirmText: 'Entendido',
      backdropClose: false,
    });
  }

  @Input() modalOpen = false;
  @Input() modalClosing = false;
  @Input() modalAnim: 'in' | 'out' = 'in';
  hasCoords = false;
  private map!: any;
  private marker!: any;
  private infoWindow!: any;
  private geocoder!: any;
  lat: number | null = null;
  lng: number | null = null;
  private readonly POLANCO = { lat: 19.4326, lng: -99.2000 };

  async openUbicacionModal() {
    this.modalOpen = true;
    this.modalAnim = 'in';
    this.modalClosing = false;

    await this.loadGoogleMaps('TU_API_KEY');
    setTimeout(() => this.initMapForModal(), 100);
  }

  private initMapForModal(): void {
    const el = document.getElementById('map') as HTMLElement;
    if (!el) return;

    this.map = new google.maps.Map(el, { center: this.POLANCO, zoom: 15,styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      },
      {
        featureType: 'poi',
        stylers: [{ visibility: 'off' }]
      }
    ] });
    this.geocoder = new google.maps.Geocoder();
    this.infoWindow = new google.maps.InfoWindow();

    const latInit = this.toNumber6(this.transaccionForm.get('latitud')?.value);
    const lngInit = this.toNumber6(this.transaccionForm.get('longitud')?.value);
    const hasInit = Number.isFinite(latInit) && Number.isFinite(lngInit) && !(latInit === 0 && lngInit === 0);

    if (hasInit) {
      const pos = { lat: latInit as number, lng: lngInit as number };
      this.placeMarker(pos);
      this.map.setCenter(pos);
      this.hasCoords = true;
    } else {
      this.hasCoords = false;
    }

    this.map.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.lat = lat;
      this.lng = lng;
      this.hasCoords = true;
      this.transaccionForm.patchValue({ latitud: lat, longitud: lng });
      this.placeMarker({ lat, lng });
      this.openInfoAt(e.latLng);
    });
  }

  private placeMarker(position: { lat: number; lng: number }) {
    if (this.marker) {
      this.marker.setPosition(position);
    } else {
      this.marker = new google.maps.Marker({ position, map: this.map, title: 'Ubicación de la transacción' });
    }
    this.map.panTo(position);
  }

  private openInfoAt(latLng: any): void {
    if (!this.geocoder) return;
    this.geocoder.geocode({ location: latLng }, (results: any, status: string) => {
      const address = status === 'OK' && results?.[0]?.formatted_address
        ? results[0].formatted_address
        : `Lat: ${latLng.lat().toFixed(6)}, Lng: ${latLng.lng().toFixed(6)}`;
      const html = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 260px;">
          <strong style="font-size: 14px; color: #002136">Punto seleccionado</strong>
          <div style="font-size: 13px; color: #4a4a4a;">${address}</div>
        </div>`;
      this.infoWindow.setContent(html);
      this.infoWindow.open(this.map, this.marker);
    });
  }

  confirmarUbicacionYEnviar() {
    if (!this.hasCoords) {
      this.transaccionForm.patchValue({ latitud: null, longitud: null });
    }
    this.cerrarModal();
    this.agregar();
  }

  onBackdrop() { this.cerrarModal(); }
  cerrarModal() { this.modalAnim = 'out'; setTimeout(() => this.modalOpen = false, 220); }

  private toNumber6(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Number(n.toFixed(6)) : null;
  }

  private loadGoogleMaps(_apiKey: string): Promise<void> {

    return cargarGoogleMaps();

  }

  async agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    const raw = this.transaccionForm.value;
    const payload = {
      tipoTransaccion: (raw?.tipoTransaccion || '').toString().toUpperCase() || null,
      monto: (() => {
        if (raw?.monto === '' || raw?.monto == null) return null;
        const n = Number(parseFloat(String(raw.monto).replace(',', '.')).toFixed(2));
        return isNaN(n) ? null : n;
      })(),
      latitud: this.toNumber6(raw?.latitud),
      longitud: this.toNumber6(raw?.longitud),
      fechaHora: this.localDatetimeToOffsetISO(raw?.fechaHora || null),
      numeroSerieMonedero: raw?.numeroSerieMonedero ?? null,
      numeroSerieValidador: raw?.numeroSerieValidador ?? null,
    };

    this.transaccionService.agregarTransaccion(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó una nueva transacción de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.regresar();
      },
      error: (err) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: err?.message || 'Ocurrió un error al agregar la transacción.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    });
  }

  regresar() { this.route.navigateByUrl('/administracion/transacciones'); }

  private nowForDatetimeLocal(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MI = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${HH}:${MI}`;
  }

  private localDatetimeToOffsetISO(localStr: string | null): string | null {
    if (!localStr) return null;
    const d = new Date(localStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MI = String(d.getMinutes()).padStart(2, '0');
    const tz = d.getTimezoneOffset();
    const sign = tz > 0 ? '-' : '+';
    const offH = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0');
    const offM = String(Math.abs(tz) % 60).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${HH}:${MI}:00${sign}${offH}:${offM}`;
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
    this.transaccionForm.get('monto')?.setValue(v, { emitEvent: false });
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
    this.transaccionForm.get('monto')?.setValue(v, { emitEvent: false });
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
    this.transaccionForm.get('monto')?.setValue(v, { emitEvent: false });
  }
}
