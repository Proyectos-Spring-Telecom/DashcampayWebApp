import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { PasajerosService } from 'src/app/pages/services/pasajeros.service';
import {
  bloquearCaracteresEspecialesNombre,
  NOMBRE_SIN_ESPECIALES_REGEX,
  onPasteNombreSinEspeciales
} from 'src/app/core/validators/nombre-sin-especiales';

@Component({
  selector: 'vex-agregar-pasajero',
  templateUrl: './agregar-pasajero.component.html',
  styleUrl: './agregar-pasajero.component.scss',
  animations: [fadeInRight400ms],
})
export class AgregarPasajeroComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public pasajeroForm!: FormGroup;
  public idPasajero!: number;
  public title = 'Agregar Pasajero';
  public showCorreo: boolean = true;
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;
  listaTiposPasajero: any[] = [];
  selectedDocumentoFile: File | null = null;
  documentoPreviewUrl: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private pasajService: PasajerosService,
    private activatedRouted: ActivatedRoute,
    private router: Router,
    private alerts: AlertsService,
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.obtenerTiposPasajero();
    this.activatedRouted.params.subscribe(
      (params) => {
        this.idPasajero = params['idPasajero'];
        if (this.idPasajero) {
          this.title = 'Actualizar Pasajero';
          this.obtenerPasajeroID();
          this.showCorreo = false;
          this.pasajeroForm.get('correo')?.disable();
        }
      }
    )
  }

  obtenerTiposPasajero(): void {
    this.pasajService.obtenerTiposPasajero().subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        this.listaTiposPasajero = data.map((t: any) => ({
          id: Number(t?.id ?? t?.Id ?? t?.ID ?? 0),
          nombre: t?.nombre ?? t?.Nombre ?? ''
        })).filter((t: any) => Number.isFinite(t.id) && t.id > 0);
      },
      error: (error) => {
        console.error('Error al obtener tipos de pasajero:');
        this.listaTiposPasajero = [];
      }
    });
  }

  obtenerPasajeroID() {
    this.pasajService.obtenerPasajero(this.idPasajero).subscribe(
      (response: any) => {
        const fecha = response.data.fechaNacimiento
          ? response.data.fechaNacimiento.split('T')[0]
          : '';
        this.pasajeroForm.patchValue({
          estatus: response.data.estatus,
          nombre: response.data.nombre,
          apellidoPaterno: response.data.apellidoPaterno,
          apellidoMaterno: response.data.apellidoMaterno,
          telefono: response.data.telefono,
          correo: response.data.correo,
          fechaNacimiento: fecha,
          curp: response.data.curp || '',
          numeroSerieMonedero: response.data.numeroSerieMonedero || '',
          idTipoPasajero: response.data.idTipoPasajero || null,
        });
        // Nota: passwordHash y documentacion no se cargan por seguridad
      }
    );
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.keyCode ? event.keyCode : event.which;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  initForm() {
    this.pasajeroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
      apellidoPaterno: ['', Validators.required],
      apellidoMaterno: ['', Validators.required],
      fechaNacimiento: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.required],
      curp: ['', Validators.required],
      numeroSerieMonedero: ['', Validators.required],
      idTipoPasajero: [null, Validators.required],
      passwordHash: ['', Validators.required],
      documentacion: [null],
      estatus: [1, Validators.required],
    });
  }

  documentoDragging = false;

  onDocumentoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.documentoDragging = true;
  }

  onDocumentoDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.documentoDragging = false;
  }

  onDocumentoDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.documentoDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const fileEvent = { target: { files: [files[0]] } };
      this.onDocumentoFileSelected(fileEvent);
    }
  }

  openDocumentoFilePicker(): void {
    const fileInput = document.getElementById('documentacion-file') as HTMLInputElement;
    if (fileInput) fileInput.click();
  }

  onDocumentoFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Validar tipo de archivo (imagen o PDF)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      this.alerts.open({
        type: 'error',
        title: '¡Ops!',
        message: 'El archivo debe ser una imagen (JPG, PNG, GIF) o un PDF.',
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.alerts.open({
        type: 'error',
        title: '¡Ops!',
        message: 'El archivo no debe exceder 5MB.',
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    this.selectedDocumentoFile = file;
    this.selectedFileName = file.name;

    // Mostrar preview si es imagen
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.documentoPreviewUrl = e.target?.result || null;
      };
      reader.readAsDataURL(file);
    } else {
      this.documentoPreviewUrl = null;
    }
  }

  removeDocumentoFile(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedDocumentoFile = null;
    this.selectedFileName = '';
    this.documentoPreviewUrl = null;
    this.pasajeroForm.get('documentacion')?.setValue(null);
    const fileInput = document.getElementById('documentacion-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  submit() {
    if (this.idPasajero) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  async agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.pasajeroForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: any = {
        nombre: 'Nombre',
        apellidoPaterno: 'Apellido Paterno',
        apellidoMaterno: 'Apellido Materno',
        fechaNacimiento: 'Fecha de Nacimiento',
        telefono: 'Teléfono',
        correo: 'Correo Electrónico',
        curp: 'CURP',
        numeroSerieMonedero: 'Número de Serie',
        idTipoPasajero: 'Tipo Pasajero',
        passwordHash: 'Contraseña',
        estatus: 'Estatus',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.pasajeroForm.controls).forEach((key) => {
        const control = this.pasajeroForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
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
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    // Crear FormData para enviar el archivo
    const formValue = this.pasajeroForm.getRawValue();
    const formData = new FormData();
    
    formData.append('nombre', formValue.nombre);
    formData.append('apellidoPaterno', formValue.apellidoPaterno);
    formData.append('apellidoMaterno', formValue.apellidoMaterno);
    formData.append('fechaNacimiento', this.formatDate(formValue.fechaNacimiento));
    formData.append('telefono', formValue.telefono);
    formData.append('correo', formValue.correo);
    formData.append('curp', formValue.curp);
    formData.append('numeroSerieMonedero', formValue.numeroSerieMonedero);
    formData.append('idTipoPasajero', String(formValue.idTipoPasajero));
    formData.append('passwordHash', formValue.passwordHash);
    formData.append('estatus', String(formValue.estatus));
    
    if (this.selectedDocumentoFile) {
      formData.append('documentacion', this.selectedDocumentoFile);
    }

    this.pasajService.agregarPasajero(formData).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó un nuevo pasajero de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.regresar();
      },
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al agregar el pasajero.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  async actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.pasajeroForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        nombre: 'Nombre',
        apellidoPaterno: 'Apellido Paterno',
        apellidoMaterno: 'Apellido Materno',
        fechaNacimiento: 'Fecha de Nacimiento',
        telefono: 'Teléfono',
        correo: 'Correo Electrónico',
        curp: 'CURP',
        numeroSerieMonedero: 'Número de Serie',
        idTipoPasajero: 'Tipo Pasajero',
        passwordHash: 'Contraseña',
        estatus: 'Estatus',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.pasajeroForm.controls).forEach((key) => {
        const control = this.pasajeroForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
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
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    // Excluir "correo" SIEMPRE del payload
    const { correo, ...payload } = this.pasajeroForm.value;

    // Normalizar fechaNacimiento a YYYY-MM-DD
    if (payload.fechaNacimiento instanceof Date) {
      const y = payload.fechaNacimiento.getFullYear();
      const m = String(payload.fechaNacimiento.getMonth() + 1).padStart(2, '0');
      const d = String(payload.fechaNacimiento.getDate()).padStart(2, '0');
      payload.fechaNacimiento = `${y}-${m}-${d}`;
    } else if (typeof payload.fechaNacimiento === 'string' && payload.fechaNacimiento.includes('T')) {
      payload.fechaNacimiento = payload.fechaNacimiento.split('T')[0];
    }

    this.pasajService.actualizarPasajero(this.idPasajero, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos del pasajero se actualizaron correctamente.',
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
          message: 'Ocurrió un error al actualizar el pasajero.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  formatDate(date: any): string {
    if (!date) return '';
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && date.includes('T')) {
      return date.split('T')[0];
    }
    return date;
  }

  onPasteNombre(event: ClipboardEvent): void {
    onPasteNombreSinEspeciales(event, this.pasajeroForm.get('nombre'));
  }

  bloquearCaracteresEspecialesNombre = bloquearCaracteresEspecialesNombre;

  regresar() {
    this.router.navigateByUrl('/administracion/pasajeros')
  }

}
