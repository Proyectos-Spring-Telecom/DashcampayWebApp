import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { TalleresService } from 'src/app/pages/services/talleres.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { NgZone } from '@angular/core';
import {
  bloquearCaracteresEspecialesNombre,
  NOMBRE_SIN_ESPECIALES_REGEX,
  onPasteNombreSinEspeciales
} from 'src/app/core/validators/nombre-sin-especiales';
import { loadGoogleMaps as cargarGoogleMaps } from 'src/app/core/security/load-google-maps';

declare const google: any;

@Component({
  selector: 'vex-agregar-taller',
  templateUrl: './agregar-taller.component.html',
  styleUrl: './agregar-taller.component.scss',
  animations: [fadeInRight400ms]
})
export class AgregarTallerComponent implements OnInit, AfterViewInit, OnDestroy {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public tallerForm!: FormGroup;
  public title = 'Agregar Taller';
  public showRequiredMsgs: boolean = false;
  public idTaller: number | null = null;
  public isEditMode: boolean = false;

  // Listas para selects
  public listaClientes: any[] = [];

  // Mapa
  private map: any = null;
  private marker: any = null;
  private geocoder: any = null;
  private infoWindow: any = null;
  public mapType: 'roadmap' | 'satellite' = 'roadmap';
  public hasCoords: boolean = false;
  public lat: number = 21.110778; // Misma coordenada que zona/ruta (Polanco/Cancún)
  public lng: number = -86.762590;
  private readonly MAP_CENTER = { lat: 21.110778, lng: -86.762590 };

  constructor(
    private route: Router,
    private fb: FormBuilder,
    private talleresService: TalleresService,
    private clientesService: ClientesService,
    private activatedRoute: ActivatedRoute,
    private alerts: AlertsService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.obtenerClientes();
    this.initForm();
    
    this.activatedRoute.params.subscribe((params) => {
      this.idTaller = params['idTaller'] ? Number(params['idTaller']) : null;
      if (this.idTaller) {
        this.isEditMode = true;
        this.title = 'Actualizar Taller';
        this.obtenerTaller();
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.loadGoogleMaps();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.marker) {
      this.marker.setMap(null);
    }
  }

  initForm() {
    this.tallerForm = this.fb.group({
      idCliente: [null, Validators.required],
      nombre: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
      descripcion: ['', [Validators.required, Validators.maxLength(255)]],
      icono: [''],
      direccion: [''],
      lat: [null, Validators.required],
      lng: [null, Validators.required],
      estatus: [1, Validators.required]
    });
  }

  obtenerClientes() {
    this.clientesService.obtenerClientes().subscribe({
      next: (response: any) => {
        this.listaClientes = (response.data || response || []).map((item: any) => ({
          ...item,
          id: Number(item?.id ?? item?.Id ?? item?.ID)
        }));
      },
      error: (error: unknown) => {
        console.error('Error al obtener clientes:');
      }
    });
  }

  obtenerTaller() {
    if (!this.idTaller) return;
    
    this.loading = true;
    this.talleresService.obtenerTallerPorId(this.idTaller).subscribe({
      next: (response: any) => {
        const data = response?.data ?? response ?? {};
        this.loading = false;
        
        // Coordenadas: API puede devolver lat/lng o latitud/longitud
        const latVal = data.lat ?? data.Lat ?? data.latitud ?? data.Latitud;
        const lngVal = data.lng ?? data.Lng ?? data.longitud ?? data.Longitud;
        
        // Convertir idCliente de string a número
        const idClienteNum = Number(data.idCliente ?? data.IdCliente ?? 0);
        
        // Llenar el formulario
        this.tallerForm.patchValue({
          idCliente: Number.isFinite(idClienteNum) ? idClienteNum : null,
          nombre: data.nombre ?? data.Nombre ?? '',
          descripcion: data.descripcion ?? data.Descripcion ?? '',
          icono: data.icono ?? data.Icono ?? '',
          direccion: data.direccion ?? data.Direccion ?? '',
          lat: latVal != null ? Number(latVal) : null,
          lng: lngVal != null ? Number(lngVal) : null,
          estatus: data.estatus ?? data.Estatus ?? 1
        });

        // Si hay coordenadas, centrar el mapa y colocar el marcador
        if (latVal != null && lngVal != null) {
          this.lat = Number(latVal);
          this.lng = Number(lngVal);
          this.hasCoords = true;
          // Esperar a que el mapa esté listo y luego inicializar/actualizar con el marcador
          setTimeout(() => {
            this.initMap();
          }, 600);
        }
      },
      error: (error) => {
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al cargar los datos del taller.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
        this.regresar();
      }
    });
  }

  private loadGoogleMaps(): Promise<void> {

    return cargarGoogleMaps();

  }

  private initMap(): void {
    const el = document.getElementById('map-taller') as HTMLElement;
    if (!el) return;

    const center = this.hasCoords ? { lat: this.lat, lng: this.lng } : this.MAP_CENTER;

    this.map = new google.maps.Map(el, {
      center: center,
      zoom: this.hasCoords ? 15 : 10,
      mapTypeId: this.mapType === 'satellite' ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP
    ,styles: [
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

    this.geocoder = new google.maps.Geocoder();
    this.infoWindow = new google.maps.InfoWindow();

    // Si hay coordenadas iniciales, colocar el marcador
    if (this.hasCoords) {
      this.placeMarker({ lat: this.lat, lng: this.lng });
    }

    // Listener para clicks en el mapa
    this.map.addListener('click', (e: any) => {
      this.ngZone.run(() => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        this.lat = lat;
        this.lng = lng;
        this.hasCoords = true;
        this.tallerForm.patchValue({ lat, lng });
        this.placeMarker({ lat, lng });
        this.openInfoAt(e.latLng);
      });
    });
  }

  private placeMarker(position: { lat: number; lng: number }) {
    if (this.marker) {
      this.marker.setMap(this.map); // Reasignar al mapa actual (puede haberse recreado en edición)
      this.marker.setPosition(position);
    } else {
      this.marker = new google.maps.Marker({
        position,
        map: this.map,
        title: 'Ubicación del taller',
        draggable: true
      });

      // Listener para cuando se arrastra el marcador
      this.marker.addListener('dragend', (e: any) => {
        this.ngZone.run(() => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          this.lat = lat;
          this.lng = lng;
          this.tallerForm.patchValue({ lat, lng });
          this.openInfoAt(e.latLng);
        });
      });
    }
    this.map.panTo(position);
  }

  private openInfoAt(latLng: any): void {
    if (!this.geocoder) return;
    this.geocoder.geocode({ location: latLng }, (results: any, status: string) => {
      const address = status === 'OK' && results?.[0]?.formatted_address
        ? results[0].formatted_address
        : `Lat: ${latLng.lat().toFixed(6)}, Lng: ${latLng.lng().toFixed(6)}`;
      
      // Actualizar dirección en el formulario si está disponible
      if (status === 'OK' && results?.[0]?.formatted_address) {
        this.tallerForm.patchValue({ direccion: results[0].formatted_address });
      }

      const html = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 260px;">
          <strong style="font-size: 14px; color: #002136">Ubicación del taller</strong>
          <div style="font-size: 13px; color: #4a4a4a;">${address}</div>
        </div>`;
      this.infoWindow.setContent(html);
      this.infoWindow.open(this.map, this.marker);
    });
  }

  toggleMapType() {
    this.mapType = this.mapType === 'roadmap' ? 'satellite' : 'roadmap';
    if (this.map) {
      this.map.setMapTypeId(
        this.mapType === 'satellite' 
          ? google.maps.MapTypeId.SATELLITE 
          : google.maps.MapTypeId.ROADMAP
      );
    }
  }

  async submit() {
    this.showRequiredMsgs = true;

    if (this.tallerForm.invalid || !this.hasCoords) {
      if (!this.hasCoords) {
        this.alerts.open({
          type: 'warning',
          title: '¡Ops!',
          message: 'Debes seleccionar una ubicación en el mapa haciendo clic sobre él.',
          confirmText: 'Entendido',
          backdropClose: false
        });
        return;
      }

      const etiquetas: Record<string, string> = {
        idCliente: 'Cliente',
        nombre: 'Nombre',
        descripcion: 'Descripción',
        lat: 'Latitud',
        lng: 'Longitud'
      };

      const mensajes: string[] = [];
      Object.keys(this.tallerForm.controls).forEach((key) => {
        const control = this.tallerForm.get(key);
        if (!control?.invalid || !control.errors) return;
        const label = etiquetas[key] || key;
        if (control.errors['required']) {
          mensajes.push(label);
        } else if (control.errors['maxlength']) {
          const max = control.errors['maxlength'].requiredLength;
          mensajes.push(`${label}: máximo ${max} caracteres`);
        } else if (control.errors['pattern']) {
          mensajes.push(`${label}: no permite caracteres especiales`);
        }
      });

      const lista = mensajes.map((campo, i) => `
        <div style="padding:8px 12px; border-left:4px solid #d9534f; background:#caa8a8; text-align:center; margin-bottom:8px; border-radius:4px;">
          <strong style="color:#b02a37;">${i + 1}. ${campo}</strong>
        </div>
      `).join('');

      this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
          <p style="text-align:center; font-size:15px; margin-bottom:16px;">
            Hay campos con errores de validación.
          </p>
          <div style="max-height:350px; overflow-y:auto;">${lista}</div>
        `,
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    this.submitButton = 'Cargando...';
    this.loading = true;

    const formValue = this.tallerForm.getRawValue();
    const payload = {
      nombre: formValue.nombre,
      descripcion: formValue.descripcion,
      icono: formValue.icono || '',
      direccion: formValue.direccion || '',
      lat: Number(this.lat),
      lng: Number(this.lng),
      estatus: Number(formValue.estatus || 1),
      idCliente: Number(formValue.idCliente)
    };

    const request = this.isEditMode && this.idTaller
      ? this.talleresService.actualizarTaller(this.idTaller, payload)
      : this.talleresService.agregarTaller(payload);

    request.subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: this.isEditMode
            ? 'Se actualizó el taller de manera exitosa.'
            : 'Se registró el taller de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.regresar();
      },
      error: (error) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: this.isEditMode
            ? 'Ocurrió un error al actualizar el taller.'
            : 'Ocurrió un error al registrar el taller.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
      }
    });
  }

  onPasteNombre(event: ClipboardEvent): void {
    onPasteNombreSinEspeciales(event, this.tallerForm.get('nombre'));
  }

  bloquearCaracteresEspecialesNombre = bloquearCaracteresEspecialesNombre;

  regresar() {
    this.route.navigateByUrl('/administracion/talleres');
  }
}
