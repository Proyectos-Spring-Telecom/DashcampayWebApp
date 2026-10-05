import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, UntypedFormControl, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { finalize } from 'rxjs';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { OperadoresService } from 'src/app/pages/services/operadores.service';
import { UsuariosService } from 'src/app/pages/services/usuarios.service';

@Component({
  selector: 'vex-agregar-operador',
  templateUrl: './agregar-operador.component.html',
  styleUrl: './agregar-operador.component.scss',
  animations: [fadeInRight400ms],
})
export class AgregarOperadorComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public operadorForm!: FormGroup;
  public idOperador!: number;
  public listaUsuarios: any;
  public title = 'Agregar Operador';
  public showUsuario: boolean = true;
  public showCliente: any;
  listaClientes: any[] = [];
  public idClienteUser: number = 0;
  /** Fecha máxima permitida: hace exactamente 18 años (mayor o igual a 18). */
  public maxFechaNacimiento: Date = this.calcularFechaMaxima18();

  /** Deshabilita en el calendario cualquier fecha posterior al límite de 18 años. */
  public filtroMayorEdad = (date: Date | null): boolean => {
    if (!date) return false;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() <= this.maxFechaNacimiento.getTime();
  };
  public selectedClienteId: number | null = null;
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;
  listaCategoriasLicencia: any[] = [];
  listaTiposLicencia: any[] = [];
  /** Nombre del usuario en modo edición (solo lectura) */
  nombreUsuarioDisplay = '';

  constructor(
    private fb: FormBuilder,
    private operService: OperadoresService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private usuaService: UsuariosService,
    private alerts: AlertsService,
    private users: AuthenticationService,
    private clieService: ClientesService
  ) {
    const user = this.users.getUser();
    this.showCliente = user?.rol?.nombre === 'SA';
    this.idClienteUser = Number(user?.idCliente);
  }

  ngOnInit(): void {
    this.initForm();
    this.obtenerCategoriasLicencia();
    this.obtenerTiposLicencia();

    if (this.showCliente) {
      this.obtenerClientes();
      this.listaUsuarios = [];
      this.operadorForm.patchValue({ idUsuario: null });
    } else {
      this.obtenerUsuarios(this.idClienteUser);
    }

    this.activatedRouted.params.subscribe(params => {
      this.idOperador = params['idOperador'];
      if (this.idOperador) {
        this.title = 'Actualizar Operador';
        this.submitButton = 'Actualizar';
        this.operadorForm.controls['idUsuario'].disable();
        // Al editar no se exigen vigencia, categoría ni tipo de licencia
        this.operadorForm.get('vigencia')?.clearValidators();
        this.operadorForm.get('vigencia')?.updateValueAndValidity();
        this.operadorForm.get('vigencia.start')?.clearValidators();
        this.operadorForm.get('vigencia.start')?.updateValueAndValidity();
        this.operadorForm.get('vigencia.end')?.clearValidators();
        this.operadorForm.get('vigencia.end')?.updateValueAndValidity();
        this.operadorForm.get('idCategoriaLicencia')?.clearValidators();
        this.operadorForm.get('idCategoriaLicencia')?.updateValueAndValidity();
        this.operadorForm.get('idTipoLicencia')?.clearValidators();
        this.operadorForm.get('idTipoLicencia')?.updateValueAndValidity();
        this.operadorForm.get('numeroLicencia')?.clearValidators();
        this.operadorForm.get('numeroLicencia')?.updateValueAndValidity();
        this.obtenerOperadorID();
      }
    });
  }

  obtenerClientes() {
    this.clieService.obtenerClientes().subscribe({
      next: (response: any) => {
        this.listaClientes = (response?.data || []).map((x: any) => ({
          ...x,
          id: Number(x?.id ?? x?.Id ?? x?.ID),
        }));
      },
      error: () => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'No fue posible obtener la lista de clientes.',
          confirmText: 'Aceptar',
          backdropClose: false,
        });
      },
    });
  }

  private async getErrorMessage(err: any): Promise<string> {
    if (err?.status === 0 && !err?.error)
      return 'No hay conexión con el servidor (status 0). Verifica tu red.';
    if (err?.error instanceof Blob) {
      try {
        const txt = await err.error.text();
        if (txt) return txt;
      } catch { }
    }
    if (typeof err?.error === 'string' && err.error.trim()) return err.error;
    if (typeof err?.message === 'string' && err.message.trim())
      return err.message;
    if (err?.error?.message) return String(err.error.message);
    if (err?.error?.errors) {
      const e = err.error.errors;
      if (Array.isArray(e)) return e.filter(Boolean).join('\n');
      if (typeof e === 'object') {
        const lines: string[] = [];
        for (const k of Object.keys(e)) {
          const val = e[k];
          if (Array.isArray(val)) lines.push(`${k}: ${val.join(', ')}`);
          else if (val) lines.push(`${k}: ${val}`);
        }
        if (lines.length) return lines.join('\n');
      }
    }
    const statusLine = err?.status
      ? `HTTP ${err.status}${err.statusText ? ' ' + err.statusText : ''}`
      : '';
    return statusLine;
  }

  private pickId(obj: any, keys: string[]): any {
    for (const k of keys)
      if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
    return null;
  }

  obtenerOperadorID() {
    const id = Number(this.idOperador);
    if (!id) return;

    this.operService.obtenerOperador(id).subscribe((response: any) => {
      const raw = Array.isArray(response?.data)
        ? response.data[0]
        : response?.operador ?? response?.data ?? response ?? {};

      const get = (o: any, keys: string[]) => {
        if (!o) return null;
        for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
        return null;
      };

      // Datos de licencia: pueden estar en el objeto raíz o dentro de licencias[0]
      const licencias = raw?.licencias;
      const primeraLicencia = Array.isArray(licencias) && licencias.length > 0 ? licencias[0] : null;

      const numeroLicencia = get(primeraLicencia, ['numeroLicencia', 'NumeroLicencia'])
        ?? get(raw, ['numeroLicencia', 'NumeroLicencia']);
      const fechaNacimientoRaw = get(raw, ['fechaNacimiento', 'FechaNacimiento']);
      const fechaExpedicionRaw = get(primeraLicencia, ['fechaExpedicion', 'FechaExpedicion'])
        ?? get(raw, ['fechaExpedicion', 'FechaExpedicion']);
      const fechaVencimientoRaw = get(primeraLicencia, ['fechaVencimiento', 'FechaVencimiento', 'fechaExpiracion', 'FechaExpiracion'])
        ?? get(raw, ['fechaVencimiento', 'FechaVencimiento', 'fechaExpiracion', 'FechaExpiracion']);
      const idUsuario = get(raw, ['idUsuario', 'IdUsuario']);
      const estatus = get(raw, ['estatusOperador', 'estatus', 'Estatus']);
      const idCategoriaLicencia = get(primeraLicencia, ['idCategoriaLicencia', 'IdCategoriaLicencia'])
        ?? get(raw, ['idCategoriaLicencia', 'IdCategoriaLicencia']);
      const idTipoLicencia = get(primeraLicencia, ['idTipoLicencia', 'IdTipoLicencia'])
        ?? get(raw, ['idTipoLicencia', 'IdTipoLicencia']);
      const identificacion = get(raw, ['identificacion', 'Identificacion']);
      const comprobanteDomicilio = get(raw, ['comprobanteDomicilio', 'ComprobanteDomicilio']);
      const foto = get(raw, ['fotoPerfil', 'foto', 'Foto']);
      const certificadoMedico = get(raw, ['certificadoMedico', 'CertificadoMedico']);
      const antecedentesNoPenales = get(raw, ['antecedentesNoPenales', 'AntecedentesNoPenales']);
      // Licencia de conducir: siempre desde licencias[0]
      const licencia = primeraLicencia
        ? get(primeraLicencia, ['licencia', 'Licencia'])
        : get(raw, ['licencia', 'Licencia']);

      // Cargar preview y nombre de licencia de conducir
      if (typeof licencia === 'string' && /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(licencia)) {
        this.licPreviewUrl = licencia;
        this.licFileName = licencia.split('/').pop()?.split('?')[0] || 'licencia.jpg';
      } else {
        this.licPreviewUrl = null;
        this.licFileName = null;
      }

      // Cargar preview de foto si existe
      if (typeof foto === 'string' && /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(foto)) {
        this.fotoPreviewUrl = foto;
        this.fotoFileName = foto.split('/').pop()?.split('?')[0] || 'foto.jpg';
      } else {
        this.fotoPreviewUrl = null;
        this.fotoFileName = null;
      }

      // Nombres de archivo para PDFs cuando vienen como URL
      const setPdfFileName = (url: string | null, prop: 'identFileName' | 'domFileName' | 'antFileName' | 'certificadoFileName') => {
        if (typeof url === 'string' && url.trim()) {
          (this as any)[prop] = url.split('/').pop()?.split('?')[0] || 'documento.pdf';
        } else {
          (this as any)[prop] = null;
        }
      };
      setPdfFileName(identificacion, 'identFileName');
      setPdfFileName(comprobanteDomicilio, 'domFileName');
      setPdfFileName(antecedentesNoPenales, 'antFileName');
      setPdfFileName(certificadoMedico, 'certificadoFileName');

      const fechaNacimiento = fechaNacimientoRaw
        ? new Date(String(fechaNacimientoRaw).split('T')[0])
        : null;
      const fechaExpedicion = fechaExpedicionRaw
        ? String(fechaExpedicionRaw).split('T')[0]
        : null;
      const fechaVencimiento = fechaVencimientoRaw
        ? String(fechaVencimientoRaw).split('T')[0]
        : null;

      const patchForm = () => {
        // Nombre del usuario para mostrar en input solo lectura (modo edición)
        const nom = get(raw, ['nombreUsuario', 'NombreUsuario']);
        const apP = get(raw, ['apellidoPaternoUsuario', 'ApellidoPaternoUsuario']);
        const apM = get(raw, ['apellidoMaternoUsuario', 'ApellidoMaternoUsuario']);
        this.nombreUsuarioDisplay = [nom, apP, apM].filter(Boolean).join(' ').trim()
          || get(raw, ['userNameUsuario', 'userName', 'email']) || '';

        this.operadorForm.patchValue({
          numeroLicencia: numeroLicencia ?? '',
          fechaNacimiento,
          vigencia: {
            start: fechaExpedicion ? new Date(fechaExpedicion) : null,
            end: fechaVencimiento ? new Date(fechaVencimiento) : null
          },
          idUsuario: idUsuario != null ? Number(idUsuario) : null,
          estatus: estatus != null ? Number(estatus) : 1,
          idCategoriaLicencia: idCategoriaLicencia != null ? Number(idCategoriaLicencia) : null,
          idTipoLicencia: idTipoLicencia != null ? Number(idTipoLicencia) : null,
          identificacion: identificacion ?? null,
          comprobanteDomicilio: comprobanteDomicilio ?? null,
          foto: foto ?? null,
          certificadoMedico: certificadoMedico ?? null,
          antecedentesNoPenales: antecedentesNoPenales ?? null,
          licencia: licencia ?? null,
        });
      };

      // Si es SA y el operador tiene idCliente, cargar usuarios de ese cliente para el select
      const idCliente = get(raw, ['idCliente', 'IdCliente']);
      if (this.showCliente && idCliente != null) {
        this.selectedClienteId = Number(idCliente);
        this.usuaService.obtenerUsuariosRolOperador(Number(idCliente)).subscribe({
          next: (resUsuarios: any) => {
            this.listaUsuarios = (resUsuarios?.data || resUsuarios || []).map((c: any) => ({
              ...c,
              id: Number(c?.id ?? c?.Id ?? c?.ID ?? c?.idUsuario ?? c?.IdUsuario),
            }));
            patchForm();
          },
          error: () => patchForm()
        });
      } else {
        patchForm();
      }
    });
  }

  obtenerUsuarios(clienteId: number) {
    this.usuaService.obtenerUsuariosRolOperador(clienteId).subscribe((response) => {
      this.listaUsuarios = (response?.data || response || []).map((c: any) => ({
        ...c,
        id: Number(c?.id ?? c?.Id ?? c?.ID ?? c?.idUsuario ?? c?.IdUsuario),
      }));

      if (!this.listaUsuarios.length) {
        this.operadorForm.patchValue({ idUsuario: null });
      }

    });
  }

  obtenerCategoriasLicencia() {
    this.operService.obtenerCategoriasLicencia().subscribe({
      next: (response: any) => {
        this.listaCategoriasLicencia = (response.data || response || []).map((c: any) => ({
          ...c,
          id: Number(c?.id ?? c?.Id ?? c?.ID ?? c?.idCategoriaLicencia ?? c?.IdCategoriaLicencia)
        }));
      },
      error: (error: unknown) => {
        console.error('Error al obtener categorías de licencia:');
      }
    });
  }

  obtenerTiposLicencia() {
    this.operService.obtenerTiposLicencia().subscribe({
      next: (response: any) => {
        this.listaTiposLicencia = (response.data || response || []).map((t: any) => ({
          ...t,
          id: Number(t?.idCatTipoLicencia ?? t?.IdCatTipoLicencia ?? t?.id ?? t?.Id ?? t?.ID ?? t?.idTipoLicencia ?? t?.IdTipoLicencia)
        }));
      },
      error: (error: unknown) => {
        console.error('Error al obtener tipos de licencia:');
        this.listaTiposLicencia = [];
      }
    });
  }

  compareTipoLicenciaById = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Number(a) === Number(b));

  compareUsuarioById = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Number(a) === Number(b));

  getNombreCompletoUsuario(u: any): string {
    if (!u) return '';
    const nombre = String(u?.nombreUsuario ?? u?.nombre ?? u?.Nombre ?? '').trim();
    const apellidoP = String(u?.apellidoPaternoUsuario ?? u?.apellidoPaterno ?? u?.ApellidoPaterno ?? '').trim();
    const apellidoM = String(u?.apellidoMaternoUsuario ?? u?.apellidoMaterno ?? u?.ApellidoMaterno ?? '').trim();
    const completo = [nombre, apellidoP, apellidoM].filter(Boolean).join(' ');
    return completo || String(u?.userName ?? u?.userNameUsuario ?? u?.email ?? u?.correo ?? '').trim();
  }

  onClienteChange(id: number) {
    this.selectedClienteId = id;
    if (id) {
      this.obtenerUsuarios(id);
    } else {
      this.listaUsuarios = [];
      this.operadorForm.patchValue({ idUsuario: null });
    }
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.keyCode ? event.keyCode : event.which;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  initForm() {
    this.operadorForm = this.fb.group({
      numeroLicencia: ['', [Validators.required, Validators.maxLength(20)]],
      fechaNacimiento: ['', [Validators.required, this.mayorDeEdadValidator]],
      vigencia: this.fb.group({
        start: [null, Validators.required],
        end: [null, Validators.required]
      }),
      idCategoriaLicencia: [null, Validators.required],
      idTipoLicencia: [null, Validators.required],
      identificacion: ['', Validators.required],
      comprobanteDomicilio: ['', Validators.required],
      foto: ['', Validators.required],
      certificadoMedico: ['', Validators.required],
      antecedentesNoPenales: ['', Validators.required],
      estatus: [1, Validators.required],
      licencia: ['', Validators.required],
      idUsuario: [null, Validators.required]
    });
  }

  private calcularFechaMaxima18(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setFullYear(d.getFullYear() - 18);
    return d;
  }

  private mayorDeEdadValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;

    const birth = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(birth.getTime())) return null;

    birth.setHours(0, 0, 0, 0);
    const limite = this.calcularFechaMaxima18();
    return birth.getTime() <= limite.getTime() ? null : { underAge: true };
  };

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idOperador) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  async agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.operadorForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      this.operadorForm.markAllAsTouched();

      const etiquetas: any = {
        numeroLicencia: 'Número de Licencia',
        fechaNacimiento: 'Fecha de Nacimiento',
        vigencia: 'Vigencia (Expedición - Expiración)',
        idCategoriaLicencia: 'Categoría de Licencia',
        idTipoLicencia: 'Tipo de Licencia',
        idUsuario: 'Usuario',
        licencia: 'Licencia de Conducir',
        identificacion: 'Identificación',
        comprobanteDomicilio: 'Comprobante de Domicilio',
        foto: 'Foto',
        certificadoMedico: 'Certificado Médico',
        antecedentesNoPenales: 'Antecedentes No Penales',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.operadorForm.controls).forEach(key => {
        const control = this.operadorForm.get(key);
        if (control?.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
        if (key === 'numeroLicencia' && control?.errors?.['maxlength']) {
          camposFaltantes.push('Número de Licencia (máximo 20 caracteres)');
        }
        if (key === 'fechaNacimiento' && control?.errors?.['underAge']) {
          camposFaltantes.push('Fecha de Nacimiento (debe ser mayor o igual a 18 años)');
        }
        // Validar el FormGroup anidado de vigencia
        if (key === 'vigencia' && control instanceof FormGroup) {
          const vigenciaStart = control.get('start');
          const vigenciaEnd = control.get('end');
          if (vigenciaStart?.invalid || vigenciaEnd?.invalid) {
            camposFaltantes.push(etiquetas['vigencia'] || 'Vigencia');
          }
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
        <p style="text-align:center; font-size:15px; margin-bottom:16px;">
          Hay campos que requieren atención.
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    this.operadorForm.removeControl('id');
    const formValue = this.operadorForm.value;
    const vigencia = formValue.vigencia || {};
    const fechaNacimiento = formValue.fechaNacimiento instanceof Date 
      ? formValue.fechaNacimiento.toISOString().split('T')[0] 
      : formValue.fechaNacimiento;
    const payload = {
      ...formValue,
      fechaNacimiento,
      fechaExpedicion: vigencia.start ? vigencia.start.toISOString().split('T')[0] : null,
      fechaVencimiento: vigencia.end ? vigencia.end.toISOString().split('T')[0] : null
    };
    delete payload.idCliente;
    delete payload.vigencia;
    this.operService.agregarOperador(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó un nuevo operador de manera exitosa.',
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
          message: 'Ocurrió un error al agregar el operador.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  async actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.operadorForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      this.operadorForm.markAllAsTouched();

      const etiquetas: any = {
        numeroLicencia: 'Número de Licencia',
        fechaNacimiento: 'Fecha de Nacimiento',
        vigencia: 'Vigencia (Expedición - Expiración)',
        idCategoriaLicencia: 'Categoría de Licencia',
        idTipoLicencia: 'Tipo de Licencia',
        idUsuario: 'Usuario',
        licencia: 'Licencia de Conducir',
        identificacion: 'Identificación',
        comprobanteDomicilio: 'Comprobante de Domicilio',
        foto: 'Foto',
        certificadoMedico: 'Certificado Médico',
        antecedentesNoPenales: 'Antecedentes No Penales',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.operadorForm.controls).forEach(key => {
        const control = this.operadorForm.get(key);
        if (control?.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
        if (key === 'numeroLicencia' && control?.errors?.['maxlength']) {
          camposFaltantes.push('Número de Licencia (máximo 20 caracteres)');
        }
        if (key === 'fechaNacimiento' && control?.errors?.['underAge']) {
          camposFaltantes.push('Fecha de Nacimiento (debe ser mayor o igual a 18 años)');
        }
        // Validar el FormGroup anidado de vigencia
        if (key === 'vigencia' && control instanceof FormGroup) {
          const vigenciaStart = control.get('start');
          const vigenciaEnd = control.get('end');
          if (vigenciaStart?.invalid || vigenciaEnd?.invalid) {
            camposFaltantes.push(etiquetas['vigencia'] || 'Vigencia');
          }
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
        <p style="text-align:center; font-size:15px; margin-bottom:16px;">
          Hay campos que requieren atención.
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    // getRawValue incluye controles deshabilitados (idUsuario en modo edición)
    const formValue = this.operadorForm.getRawValue();
    const fechaNacimiento = formValue.fechaNacimiento instanceof Date 
      ? formValue.fechaNacimiento.toISOString().split('T')[0] 
      : formValue.fechaNacimiento;
    // Al editar no se envían vigencia, categoría ni tipo de licencia (no se actualizan)
    const payload: any = {
      ...formValue,
      fechaNacimiento
    };
    delete payload.idCliente;
    delete payload.vigencia;
    delete payload.fechaExpedicion;
    delete payload.fechaVencimiento;
    delete payload.idCategoriaLicencia;
    delete payload.idTipoLicencia;
    delete payload.numeroLicencia;
    delete payload.licencia;
    this.operService.actualizarOperador(this.idOperador, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos del operador se actualizaron correctamente.',
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
          message: 'Ocurrió un error al actualizar el operador.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  regresar() {
    const clienteEfectivo = this.showCliente
      ? (this.selectedClienteId ?? this.idClienteUser)
      : this.idClienteUser;

    this.route.navigate(['/administracion/operadores'], {
      queryParams: { clienteId: clienteEfectivo }
    });
  }


  // ====== ViewChilds de inputs de archivo ======
  @ViewChild('identFileInput') identFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('domFileInput') domFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('antFileInput') antFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('licFileInput') licFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('fotoFileInput') fotoFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('certificadoFileInput') certificadoFileInput!: ElementRef<HTMLInputElement>;

  // ====== Estado drag & drop ======
  identDragging = false;
  domDragging = false;
  antDragging = false;
  licDragging = false;
  fotoDragging = false;
  certificadoDragging = false;

  // ====== Estado de archivos / nombres ======
  identFileName: string | null = null;
  domFileName: string | null = null;
  antFileName: string | null = null;
  licFileName: string | null = null;
  licPreviewUrl: string | null = null;
  fotoFileName: string | null = null;
  certificadoFileName: string | null = null;
  fotoPreviewUrl: string | null = null;

  // ====== Loading / processing ======
  uploadingIdent = false;
  uploadingDom = false;
  uploadingAnt = false;
  uploadingLic = false;
  uploadingFoto = false;
  uploadingCertificado = false;

  // Evita manejar el mismo archivo dos veces por eventos consecutivos
  private processingIdent = false;
  private processingDom = false;
  private processingAnt = false;
  private processingLic = false;
  private processingFoto = false;
  private processingCertificado = false;

  // Guard para evitar doble .click() cuando el evento burbujea (dropzone + botón)
  private openGuard = {
    ident: false,
    dom: false,
    ant: false,
    lic: false,
    foto: false,
    certificado: false,
  };

  // Límite MB visible desde template (no private)
  readonly MAX_MB = 3;

  // ================= Utilidades =================
  private isAllowedPdf(file: File): boolean {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/bmp'
    ];
    return allowed.includes(file.type);
  }

  private validateFile(file: File, tipo: 'licencia' | 'pdf'): 'type' | 'size' | null {
    const maxBytes = this.MAX_MB * 1024 * 1024;
    const allowed = tipo === 'licencia'
      ? ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp']
      : ['application/pdf'];
    if (!allowed.includes(file.type)) return 'type';
    if (file.size > maxBytes) return 'size';
    return null;
  }



  private extractFileUrl(res: any): string {
    return res?.url ?? res?.Location ?? res?.data?.url ?? res?.data?.Location
      ?? res?.key ?? res?.Key ?? res?.path ?? res?.filePath ?? '';
  }

  // ====== Guards para .click() (evita doble invocación por bubbling) ======
  private guardOpen(kind: 'ident' | 'dom' | 'ant' | 'lic' | 'foto' | 'certificado', fn: () => void) {
    if (this.openGuard[kind]) return;
    this.openGuard[kind] = true;
    try { fn(); } finally {
      // libera el guard después de un pequeño lapso
      setTimeout(() => (this.openGuard[kind] = false), 200);
    }
  }

  // ================= Identificación =================
  openIdentFilePicker(): void {
    this.guardOpen('ident', () => this.identFileInput?.nativeElement.click());
  }
  onIdentDragOver(e: DragEvent) { e.preventDefault(); this.identDragging = true; }
  onIdentDragLeave(_e: DragEvent) { this.identDragging = false; }
  onIdentDrop(e: DragEvent) {
    e.preventDefault(); this.identDragging = false;
    const f = e.dataTransfer?.files?.[0]; if (f) this.handleIdentFile(f);
  }
  onIdentFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement)?.files?.[0]; if (f) this.handleIdentFile(f);
  }
  clearIdentFile(e: Event) {
    e.stopPropagation();
    this.identFileName = null;
    if (this.identFileInput) this.identFileInput.nativeElement.value = '';
    this.operadorForm.patchValue({ identificacion: null });
    this.operadorForm.get('identificacion')?.setErrors({ required: true });
  }
  private handleIdentFile(file: File) {
    if (this.processingIdent) return;               // <-- evita doble manejo
    this.processingIdent = true;

    if (!this.isAllowedPdf(file)) {
      this.operadorForm.get('identificacion')?.setErrors({ invalid: true });
      this.processingIdent = false;
      return;
    }

    this.identFileName = file.name;
    this.operadorForm.patchValue({ identificacion: file });
    this.operadorForm.get('identificacion')?.setErrors(null);
    this.uploadIdent(file);
  }
  private uploadIdent(file: File): void {
    if (this.uploadingIdent) { this.processingIdent = false; return; } // ya subiendo
    this.uploadingIdent = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'operadores');
    fd.append('idModule', '9');

    this.usuaService.uploadFile(fd).pipe(
      finalize(() => {
        this.uploadingIdent = false;
        this.processingIdent = false; // libera procesamiento sí o sí
      })
    ).subscribe({
      next: (res: any) => {
        const url = this.extractFileUrl(res);
        if (url) {
          // EXACTO
          this.operadorForm.patchValue({ identificacion: url });
        }
      },
      error: (err: any) => console.error('[UPLOAD][identificacion]'),
    });
  }

  // ================= Comprobante de domicilio =================
  openDomFilePicker(): void {
    this.guardOpen('dom', () => this.domFileInput?.nativeElement.click());
  }
  onDomDragOver(e: DragEvent) { e.preventDefault(); this.domDragging = true; }
  onDomDragLeave(_e: DragEvent) { this.domDragging = false; }
  onDomDrop(e: DragEvent) {
    e.preventDefault(); this.domDragging = false;
    const f = e.dataTransfer?.files?.[0]; if (f) this.handleDomFile(f);
  }
  onDomFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement)?.files?.[0]; if (f) this.handleDomFile(f);
  }
  clearDomFile(e: Event) {
    e.stopPropagation();
    this.domFileName = null;
    if (this.domFileInput) this.domFileInput.nativeElement.value = '';
    this.operadorForm.patchValue({ comprobanteDomicilio: null });
    this.operadorForm.get('comprobanteDomicilio')?.setErrors({ required: true });
  }
  private handleDomFile(file: File) {
    if (this.processingDom) return;                 // <-- evita doble manejo
    this.processingDom = true;

    if (!this.isAllowedPdf(file)) {
      this.operadorForm.get('comprobanteDomicilio')?.setErrors({ invalid: true });
      this.processingDom = false;
      return;
    }

    this.domFileName = file.name;
    this.operadorForm.patchValue({ comprobanteDomicilio: file });
    this.operadorForm.get('comprobanteDomicilio')?.setErrors(null);
    this.uploadDom(file);
  }
  private uploadDom(file: File): void {
    if (this.uploadingDom) { this.processingDom = false; return; }
    this.uploadingDom = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'operadores');
    fd.append('idModule', '9');

    this.usuaService.uploadFile(fd).pipe(
      finalize(() => {
        this.uploadingDom = false;
        this.processingDom = false;
      })
    ).subscribe({
      next: (res: any) => {
        const url = this.extractFileUrl(res);
        if (url) {
          // EXACTO
          this.operadorForm.patchValue({ comprobanteDomicilio: url });
        }
      },
      error: (err: any) => console.error('[UPLOAD][comprobanteDomicilio]'),
    });
  }

  // ================= Antecedentes no penales =================
  openAntFilePicker(): void {
    this.guardOpen('ant', () => this.antFileInput?.nativeElement.click());
  }
  onAntDragOver(e: DragEvent) { e.preventDefault(); this.antDragging = true; }
  onAntDragLeave(_e: DragEvent) { this.antDragging = false; }
  onAntDrop(e: DragEvent) {
    e.preventDefault(); this.antDragging = false;
    const f = e.dataTransfer?.files?.[0]; if (f) this.handleAntFile(f);
  }
  onAntFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement)?.files?.[0]; if (f) this.handleAntFile(f);
  }
  clearAntFile(e: Event) {
    e.stopPropagation();
    this.antFileName = null;
    if (this.antFileInput) this.antFileInput.nativeElement.value = '';
    this.operadorForm.patchValue({ antecedentesNoPenales: null });
    this.operadorForm.get('antecedentesNoPenales')?.setErrors({ required: true });
  }
  private handleAntFile(file: File) {
    if (this.processingAnt) return;                 // <-- evita doble manejo
    this.processingAnt = true;

    if (!this.isAllowedPdf(file)) {
      this.operadorForm.get('antecedentesNoPenales')?.setErrors({ invalid: true });
      this.processingAnt = false;
      return;
    }

    this.antFileName = file.name;
    this.operadorForm.patchValue({ antecedentesNoPenales: file });
    this.operadorForm.get('antecedentesNoPenales')?.setErrors(null);
    this.uploadAnt(file);
  }
  private uploadAnt(file: File): void {
    if (this.uploadingAnt) { this.processingAnt = false; return; }
    this.uploadingAnt = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'operadores');
    fd.append('idModule', '9');

    this.usuaService.uploadFile(fd).pipe(
      finalize(() => {
        this.uploadingAnt = false;
        this.processingAnt = false;
      })
    ).subscribe({
      next: (res: any) => {
        const url = this.extractFileUrl(res);
        if (url) {
          this.operadorForm.patchValue({ antecedentesNoPenales: url });
        }
      },
      error: (err: any) => console.error('[UPLOAD][antecedentesNoPenales]'),
    });
  }

  // ====== Licencia de conducir ======
  openLicFilePicker(): void {
    this.guardOpen('lic', () => this.licFileInput?.nativeElement.click());
  }
  onLicDragOver(e: DragEvent) { e.preventDefault(); this.licDragging = true; }
  onLicDragLeave(_e: DragEvent) { this.licDragging = false; }
  onLicDrop(e: DragEvent) {
    e.preventDefault(); this.licDragging = false;
    const f = e.dataTransfer?.files?.[0]; if (f) this.handleLicFile(f);
  }
  onLicFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement)?.files?.[0]; if (f) this.handleLicFile(f);
  }
  clearLicFile(e: Event) {
    e.stopPropagation();
    this.licFileName = null;
    this.licPreviewUrl = null;
    if (this.licFileInput) this.licFileInput.nativeElement.value = '';
    this.operadorForm.patchValue({ licencia: null });
    this.operadorForm.get('licencia')?.setErrors({ required: true });
  }

  private handleLicFile(file: File) {
    if (this.processingLic) return;
    this.processingLic = true;

    const v = this.validateFile(file, 'licencia');
    if (v) {
      this.operadorForm.get('licencia')?.setErrors({ invalid: true });
      this.processingLic = false;
      return;
    }

    this.licFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.licPreviewUrl = reader.result as string;
      this.operadorForm.patchValue({ licencia: file });
      this.operadorForm.get('licencia')?.setErrors(null);
      this.uploadLic(file);
    };
    reader.readAsDataURL(file);
  }

  private uploadLic(file: File): void {
    if (this.uploadingLic) { this.processingLic = false; return; }
    this.uploadingLic = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'operadores');
    fd.append('idModule', '9');

    this.usuaService.uploadFile(fd).pipe(
      finalize(() => {
        this.uploadingLic = false;
        this.processingLic = false;
      })
    ).subscribe({
      next: (res: any) => {
        const url = this.extractFileUrl(res);
        if (url) {
          this.operadorForm.patchValue({ licencia: url });
          this.licPreviewUrl = url;
        }
      },
      error: (err: any) => console.error('[UPLOAD][licencia]'),
    });
  }

  // ================= Foto =================
  openFotoFilePicker(): void {
    this.guardOpen('foto', () => this.fotoFileInput?.nativeElement.click());
  }
  onFotoDragOver(e: DragEvent) { e.preventDefault(); this.fotoDragging = true; }
  onFotoDragLeave(_e: DragEvent) { this.fotoDragging = false; }
  onFotoDrop(e: DragEvent) {
    e.preventDefault(); this.fotoDragging = false;
    const f = e.dataTransfer?.files?.[0]; if (f) this.handleFotoFile(f);
  }
  onFotoFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement)?.files?.[0]; if (f) this.handleFotoFile(f);
  }
  clearFotoFile(e: Event) {
    e.stopPropagation();
    this.fotoFileName = null;
    this.fotoPreviewUrl = null;
    if (this.fotoFileInput) this.fotoFileInput.nativeElement.value = '';
    this.operadorForm.patchValue({ foto: null });
    this.operadorForm.get('foto')?.setErrors({ required: true });
  }
  private handleFotoFile(file: File) {
    if (this.processingFoto) return;
    this.processingFoto = true;

    const v = this.validateFile(file, 'licencia');
    if (v) {
      this.operadorForm.get('foto')?.setErrors({ invalid: true });
      this.processingFoto = false;
      return;
    }

    this.fotoFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.fotoPreviewUrl = reader.result as string;
      this.operadorForm.patchValue({ foto: file });
      this.operadorForm.get('foto')?.setErrors(null);
      this.uploadFoto(file);
    };
    reader.readAsDataURL(file);
  }
  private uploadFoto(file: File): void {
    if (this.uploadingFoto) { this.processingFoto = false; return; }
    this.uploadingFoto = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'operadores');
    fd.append('idModule', '9');

    this.usuaService.uploadFile(fd).pipe(
      finalize(() => {
        this.uploadingFoto = false;
        this.processingFoto = false;
      })
    ).subscribe({
      next: (res: any) => {
        const url = this.extractFileUrl(res);
        if (url) {
          this.operadorForm.patchValue({ foto: url });
          this.fotoPreviewUrl = url;
        }
      },
      error: (err: any) => console.error('[UPLOAD][foto]'),
    });
  }

  // ================= Certificado Médico =================
  openCertificadoFilePicker(): void {
    this.guardOpen('certificado', () => this.certificadoFileInput?.nativeElement.click());
  }
  onCertificadoDragOver(e: DragEvent) { e.preventDefault(); this.certificadoDragging = true; }
  onCertificadoDragLeave(_e: DragEvent) { this.certificadoDragging = false; }
  onCertificadoDrop(e: DragEvent) {
    e.preventDefault(); this.certificadoDragging = false;
    const f = e.dataTransfer?.files?.[0]; if (f) this.handleCertificadoFile(f);
  }
  onCertificadoFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement)?.files?.[0]; if (f) this.handleCertificadoFile(f);
  }
  clearCertificadoFile(e: Event) {
    e.stopPropagation();
    this.certificadoFileName = null;
    if (this.certificadoFileInput) this.certificadoFileInput.nativeElement.value = '';
    this.operadorForm.patchValue({ certificadoMedico: null });
    this.operadorForm.get('certificadoMedico')?.setErrors({ required: true });
  }
  private handleCertificadoFile(file: File) {
    if (this.processingCertificado) return;
    this.processingCertificado = true;

    if (!this.isAllowedPdf(file)) {
      this.operadorForm.get('certificadoMedico')?.setErrors({ invalid: true });
      this.processingCertificado = false;
      return;
    }

    this.certificadoFileName = file.name;
    this.operadorForm.patchValue({ certificadoMedico: file });
    this.operadorForm.get('certificadoMedico')?.setErrors(null);
    this.uploadCertificado(file);
  }
  private uploadCertificado(file: File): void {
    if (this.uploadingCertificado) { this.processingCertificado = false; return; }
    this.uploadingCertificado = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'operadores');
    fd.append('idModule', '9');

    this.usuaService.uploadFile(fd).pipe(
      finalize(() => {
        this.uploadingCertificado = false;
        this.processingCertificado = false;
      })
    ).subscribe({
      next: (res: any) => {
        const url = this.extractFileUrl(res);
        if (url) {
          this.operadorForm.patchValue({ certificadoMedico: url });
        }
      },
      error: (err: any) => console.error('[UPLOAD][certificadoMedico]'),
    });
  }
}
