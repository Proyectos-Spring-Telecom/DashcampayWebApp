import { animate, style, transition, trigger } from '@angular/animations';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, UntypedFormControl, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { finalize } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { ModulosService } from 'src/app/pages/services/modulos.service';
import { PermisosService } from 'src/app/pages/services/permisos.service';
import { RolesService } from 'src/app/pages/services/roles.service';
import { UsuariosService } from 'src/app/pages/services/usuarios.service';
import {
  getPasswordRuleKey,
  PASSWORD_PATTERN,
} from 'src/app/core/validators/password-policy';
import {
  bloquearCaracteresEspecialesNombre,
  NOMBRE_SIN_ESPECIALES_REGEX
} from 'src/app/core/validators/nombre-sin-especiales';

@Component({
  selector: 'vex-alta-usuario',
  templateUrl: './alta-usuario.component.html',
  styleUrl: './alta-usuario.component.scss',
  animations: [fadeInRight400ms,
    trigger('fadeIn', [
      transition(':enter', [style({ opacity: 0 }), animate('160ms ease-out', style({ opacity: 1 }))]),
      transition(':leave', [animate('100ms ease-in', style({ opacity: 0 }))]),
    ]),
  ],
})
export class AltaUsuarioComponent {
  layoutCtrl = new UntypedFormControl('fullwidth');

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public usuarioForm!: FormGroup;
  public idUsuario!: number;
  public inputContrasena: boolean = true;
  public title = 'Agregar Usuario';
  public listaModulos: any[] = [];
  public listaRoles: any;
  public listaClientes: any;
  readonly DEFAULT_FOTO_URL =
    'https://dashcamsys.s3.us-east-2.amazonaws.com/imagenes/2c369ac0-c489-4384-8d35-3ba482f7ccaa.jpeg';
  type = 'password';
  typeConfirm: string = 'password';
  public permisosIds: number[] = [];

  hidePass = true;
  showPwdHints = false;
  pwdValue = '';
  hideConfirm = true;
  confirmName = 'cpwd_' + Math.random().toString(36).slice(2, 12);
  confirmValue = '';
  confirmHintVisible = false;
  confirmMatch = false;
  private confirmTimer: any;

  get currentRuleKey(): 'case' | 'special' | 'number' | 'length' | 'ok' {
    const key = getPasswordRuleKey(this.pwdValue);
    if (key === 'needLetter') return 'case';
    if (key === 'needSymbol') return 'special';
    if (key === 'needNumber') return 'number';
    if (key === 'needLength') return 'length';
    return 'ok';
  }

  onPwdFocus() { this.showPwdHints = true; }
  onPwdBlur() { this.showPwdHints = false; }
  onPwdInput(e: Event) { this.pwdValue = (e.target as HTMLInputElement).value || ''; if (this.confirmHintVisible) this.validateConfirm(); }

  onConfirmInput(e: Event) {
    this.confirmValue = (e.target as HTMLInputElement).value || '';
    clearTimeout(this.confirmTimer);
    this.confirmTimer = setTimeout(() => { this.validateConfirm(); this.confirmHintVisible = this.confirmValue.length > 0; }, 400);
  }
  onConfirmBlur() {
    clearTimeout(this.confirmTimer);
    this.validateConfirm();
    this.confirmHintVisible = this.confirmValue.length > 0;
  }
  private validateConfirm() { this.confirmMatch = this.confirmValue === this.pwdValue; }

  constructor(
    private fb: FormBuilder,
    private usuaService: UsuariosService,
    private route: Router,
    private activatedRouted: ActivatedRoute,
    private moduService: ModulosService,
    private permService: PermisosService,
    private rolService: RolesService,
    private clienService: ClientesService,
    private alerts: AlertsService,
  ) { }

  ngOnInit(): void {
    this.obtenerClientes();
    this.obtenerRoles();
    this.obtenerModulos();
    this.initForm();

    this.activatedRouted.params.subscribe((params) => {
      this.idUsuario = params['idUsuario'];
      if (this.idUsuario) {
        this.title = 'Actualizar Usuario';
        this.submitButton = 'Actualizar';
        this.inputContrasena = false;
        this.usuarioForm.get('passwordHash')?.clearValidators();
        this.usuarioForm.get('passwordHash')?.updateValueAndValidity({ emitEvent: false });
        this.usuarioForm.get('confirmPassword')?.clearValidators();
        this.usuarioForm.get('confirmPassword')?.updateValueAndValidity({ emitEvent: false });
        this.obtenerUsuarioID();
      }
    });
  }

  passwordsMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('passwordHash')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  toggleConfirmPassword() {
    this.typeConfirm = this.typeConfirm === 'password' ? 'text' : 'password';
  }

  initForm() {
    this.usuarioForm = this.fb.group(
      {
        userName: ['', [Validators.required, Validators.email]],
        passwordHash: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
        confirmPassword: [''],
        telefono: ['', [Validators.required]],
        nombre: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
        apellidoPaterno: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
        apellidoMaterno: ['', [Validators.maxLength(100), Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
        fotoPerfil: [this.DEFAULT_FOTO_URL],
        idRol: [null, Validators.required],
        emailConfirmado: [0],
        estatus: [1],
        idCliente: [null],
        permisosIds: this.fb.control<number[]>([]),
      },
      { validators: this.passwordsMatchValidator }
    );
  }

  obtenerModulos() {
    this.permService.obtenerPermisosAgrupados().subscribe((response: any) => {
      let raw: any = response;
      if (Array.isArray(response) && Array.isArray(response[0])) {
        raw = response[0];
      }
      if (!Array.isArray(raw)) raw = [];
      this.applyAssignedPermsToModules();
      this.listaModulos = raw.map((m: any) => ({
        id: Number(m?.Id ?? m?.id),
        nombre: m?.NombreModulo ?? m?.nombre ?? m?.Nombre ?? '',
        descripcion: m?.Descripcion ?? m?.descripcion ?? '',
        estatus: m?.Estatus ?? m?.estatus,
        permisos: (m?.Permisos ?? m?.permisos ?? []).map((p: any) => ({
          id: p?.Id ?? p?.id,
          nombre: p?.Nombre ?? p?.nombre ?? '',
          descripcion: p?.Descripcion ?? p?.descripcion ?? '',
          estatus: p?.Estatus ?? p?.estatus,
        })),
      }));
    });
  }

  obtenerRoles() {
    this.rolService.obtenerRoles().subscribe((response: any) => {
      const raw = response?.data ?? response ?? [];
      this.listaRoles = (Array.isArray(raw) ? raw : []).map((r: any) => ({
        id: Number(r?.id ?? r?.Id ?? r?.idRol ?? r?.rolId),
        nombre: r?.nombre ?? r?.Nombre ?? r?.rolNombre ?? ''
      }));
    });
  }

  private wasSASelection = false;
  // AJUSTE: comportamiento según rol seleccionado
  onRolChanged(value: any) {
    const idRol = Number(value);

    if (idRol === 1) {
      // SA => seleccionar todos y marcar que fue automático por SA
      this.selectAllPerms();
      this.wasSASelection = true;
    } else {
      // Otro rol: solo limpiar si veníamos de SA (no tocar si ya estaba en otro rol)
      if (this.wasSASelection) {
        this.clearAllPerms();
        this.wasSASelection = false;
      }
      // si no veníamos de SA, no hacemos nada
    }
  }


  // NUEVO: limpia todos los permisos (UI + form)
  private clearAllPerms(): void {
    this.permisosIds = [];
    // apaga visualmente los switches
    this.listaModulos = (this.listaModulos || []).map(m => ({
      ...m,
      permisos: (m.permisos || []).map((p: any) => ({ ...p, estatus: 0 }))
    }));
    // sincroniza el form
    this.usuarioForm.patchValue({ permisosIds: [] });
    // si usas este helper para reflejar por ids, también puedes llamarlo
    this.applyAssignedPermsToModules?.();
  }


  private selectAllPerms(): void {
    const allIds: number[] = [];

    (this.listaModulos || []).forEach((m: any, mi: number) => {
      const permisos = m?.permisos || [];
      permisos.forEach((p: any, pi: number) => {
        const nid = this.getPermisoId(p);
        if (Number.isFinite(nid)) {
          allIds.push(nid as number);
          // reflejar visualmente el switch en la UI
          if (this.listaModulos[mi].permisos[pi]) {
            this.listaModulos[mi].permisos[pi].estatus = 1;
          }
        }
      });
    });

    // Únicos y ordenados (opcional)
    this.permisosIds = Array.from(new Set(allIds));

    // Actualiza el form y (si usas) otras vistas dependientes
    this.usuarioForm.patchValue({ permisosIds: this.permisosIds });

    // Si tienes esta utilidad, refresca los switches ligados a módulos
    this.applyAssignedPermsToModules?.();
  }


  // Para que mat-select compare por valor numérico aunque venga como string
  compareById = (a: any, b: any) => {
    const na = Number(a); const nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
  };


  obtenerClientes() {
    this.clienService.obtenerClientes().subscribe((response) => {
      this.listaClientes = (response.data || []).map((c: any) => ({
        ...c,
        id: Number(c.id),
      }));
    });
  }

  private getPermisoId(p: any): number | null {
    const val = p?.idPermiso ?? p?.IdPermiso ?? p?.id ?? p?.Id ?? null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  trackModulo = (_: number, m: any) => m.id ?? m.Id;
  trackPermiso = (_: number, p: any) => p.id ?? p.Id;

  onToggle(permiso: any, checked: boolean) {
    const idNum = this.getPermisoId(permiso);
    if (idNum === null) return;
    permiso.estatus = checked ? 1 : 0;
    if (checked) {
      if (!this.permisosIds.includes(idNum)) this.permisosIds.push(idNum);
    } else {
      this.permisosIds = this.permisosIds.filter((id) => id !== idNum);
    }
    this.usuarioForm.patchValue({ permisosIds: this.permisosIds });
  }

  obtenerUsuarioID() {
    this.usuaService.obtenerUsuario(this.idUsuario).subscribe((response: any) => {
      const data = response?.data ?? {};

      const usuarios = Array.isArray(data?.usuario)
        ? data.usuario
        : Array.isArray(data?.usuarios)
          ? data.usuarios
          : data?.usuario
            ? [data.usuario]
            : [];

      const u = usuarios[0] ?? {};

      const perms = Array.isArray(data?.permiso)
        ? data.permiso
        : Array.isArray(data?.permisos)
          ? data.permisos
          : [];

      this.permisosIds = Array.from(
        new Set(
          (perms || [])
            .filter((p: any) => Number(p?.estatus) === 1)
            .map((p: any) => this.getPermisoId(p))
            .filter((n: any): n is number => Number.isFinite(n))
        )
      );

      this.usuarioForm.patchValue({ permisosIds: this.permisosIds });
      this.applyAssignedPermsToModules?.();

      this.usuarioForm.patchValue({
        userName: u?.userName ?? '',
        telefono: u?.telefono ?? '',
        nombre: u?.nombre ?? '',
        apellidoPaterno: u?.apellidoPaterno ?? '',
        apellidoMaterno: u?.apellidoMaterno ?? '',
        fotoPerfil: u?.fotoPerfil ?? this.usuarioForm.get('fotoPerfil')?.value,
        emailConfirmado: Number(u?.emailConfirmado ?? 0),
        estatus: Number(u?.estatus ?? 1),
        idRol: u?.idRol != null ? Number(u.idRol) : null,
        idCliente: u?.idCliente != null ? Number(u.idCliente) : null,
        permisosIds: this.permisosIds,
      });

    });
  }


  isPermisoAsignado(id: any): boolean {
    const nid = this.getPermisoId({ idPermiso: id, id });
    return (
      nid !== null &&
      Array.isArray(this.permisosIds) &&
      this.permisosIds.includes(nid)
    );
  }

  private applyAssignedPermsToModules(): void {
    if (!Array.isArray(this.listaModulos)) return;

    const asignados = new Set<number>((this.permisosIds || []).map(Number));

    this.listaModulos = this.listaModulos.map((m: any) => ({
      ...m,
      permisos: (m.permisos || []).map((p: any) => {
        const idNum = Number(p?.id ?? p?.Id);
        return { ...p, id: idNum, estatus: asignados.has(idNum) ? 1 : 0 };
      }),
    }));
  }


  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.keyCode ? event.keyCode : event.which;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  myFunctionPasswordCurrent() {
    this.type = this.type === 'password' ? 'text' : 'password';
  }

  // onPasswordInput(event: Event): void {
  //   const value = (event.target as HTMLInputElement).value;
  //   this.minCaracteres = value.length >= 6;
  //   this.maxCaracteres = value.length <= 16;
  //   this.hasNumber = /\d/.test(value);
  //   this.hasMinus = /[a-z]/.test(value);
  //   this.hasMayus = /[A-Z]/.test(value);
  //   this.espCaracter = /[^\w\d]/.test(value);
  // }

  submit() {
    if (this.idUsuario) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  async agregar() {
    if (this.loading) return;

    this.submitButton = 'Cargando...';
    this.loading = true;

    this.usuarioForm.markAllAsTouched();

    const etiquetas: Record<string, string> = {
      userName: 'Correo electrónico',
      passwordHash: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      telefono: 'Teléfono',
      nombre: 'Nombre',
      apellidoPaterno: 'Apellido Paterno',
      apellidoMaterno: 'Apellido Materno',
      fotoPerfil: 'Foto de perfil',
      idRol: 'Rol',
      estatus: 'Estatus',
      permisosIds: 'Permisos',
    };

    if (this.usuarioForm.invalid) {
      const camposFaltantes: string[] = [];
      const camposNombre = ['nombre', 'apellidoPaterno', 'apellidoMaterno'];
      Object.keys(this.usuarioForm.controls).forEach((key) => {
        const control = this.usuarioForm.get(key);
        if (control?.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
        if (key === 'passwordHash' && control?.errors?.['pattern']) {
          camposFaltantes.push('Contraseña (no cumple la política de seguridad)');
        }
        if (camposNombre.includes(key) && control?.errors?.['maxlength']) {
          camposFaltantes.push(`${etiquetas[key]}: máximo 100 caracteres`);
        }
        if (camposNombre.includes(key) && control?.errors?.['pattern']) {
          camposFaltantes.push(`${etiquetas[key]}: no permite caracteres especiales`);
        }
      });

      const mensajes: string[] = [...camposFaltantes];
      if (this.usuarioForm.hasError('passwordMismatch')) {
        mensajes.push('Las contraseñas no coinciden');
      }

      const lista = mensajes.map((campo, index) => `
      <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
        <strong style="color:#b02a37;">${index + 1}. ${campo}</strong>
      </div>`).join('');

      this.submitButton = 'Guardar';
      this.loading = false;

      await this.alerts.open({
        type: 'warning',
        title: '¡Faltan campos obligatorios!',
        message: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
          Los siguientes <strong>campos</strong> requieren atención:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    // Foto por defecto si no hay foto subida
    const fotoCtrl = this.usuarioForm.get('fotoPerfil');
    const fotoVal = fotoCtrl?.value;
    if (!fotoVal || (typeof File !== 'undefined' && fotoVal instanceof File)) {
      fotoCtrl?.setValue('https://dashcamsys.s3.us-east-2.amazonaws.com/imagenes/2c369ac0-c489-4384-8d35-3ba482f7ccaa.jpeg');
    }

    const { confirmPassword, idCliente, idRol, permisosIds, ...rest } = this.usuarioForm.value;
    const toNumOrNull = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));

    const payload = {
      ...rest,
      idCliente: toNumOrNull(idCliente),
      idRol: toNumOrNull(idRol),
      permisosIds: (permisosIds || []).map((x: any) => Number(x)),
    };

    if (!payload.permisosIds || payload.permisosIds.length === 0) {
      this.submitButton = 'Guardar';
      this.loading = false;
      await this.alerts.open({
        type: 'warning',
        title: '¡Faltan permisos!',
        message: `
        <div style="max-height:350px;overflow-y:auto;">
          <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
            <strong style="color:#b02a37;">Debes asignar los permisos correspondientes al usuario.</strong>
          </div>
        </div>
      `,
        confirmText: 'De acuerdo',
        backdropClose: false,
      });
      return;
    }

    this.usuaService.agregarUsuario(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó un nuevo usuario de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.regresar();
      },
      error: (err: any) => {
        this.loading = false;
        this.submitButton = 'Guardar';
        this.getErrorMessage(err).then((msg) => {
          setTimeout(() => {
            this.alerts.open({
              type: 'error',
              title: '¡Ops!',
              message: msg,
              confirmText: 'Aceptar',
              backdropClose: false
            });
          }, 200);
        });
      }
    });
  }

  async actualizar() {
    if (this.loading) return;

    this.submitButton = 'Cargando...';
    this.loading = true;

    if (!this.inputContrasena) {
      const passCtrl = this.usuarioForm.get('passwordHash');
      const confirmCtrl = this.usuarioForm.get('confirmPassword');
      passCtrl?.clearValidators();
      passCtrl?.updateValueAndValidity({ emitEvent: false });
      confirmCtrl?.clearValidators();
      confirmCtrl?.updateValueAndValidity({ emitEvent: false });
    }

    const etiquetas: Record<string, string> = {
      userName: 'Correo electrónico',
      passwordHash: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      telefono: 'Teléfono',
      nombre: 'Nombre',
      apellidoPaterno: 'Apellido Paterno',
      apellidoMaterno: 'Apellido Materno',
      idRol: 'Rol',
      estatus: 'Estatus',
      permisosIds: 'Permisos',
    };

    const camposFaltantes: string[] = [];
    const camposNombre = ['nombre', 'apellidoPaterno', 'apellidoMaterno'];
    Object.keys(this.usuarioForm.controls).forEach((key) => {
      if (!this.inputContrasena && (key === 'passwordHash' || key === 'confirmPassword')) return;
      const control = this.usuarioForm.get(key);
      if (control?.errors?.['required']) {
        camposFaltantes.push(etiquetas[key] || key);
      }
      if (camposNombre.includes(key) && control?.errors?.['maxlength']) {
        camposFaltantes.push(`${etiquetas[key]}: máximo 100 caracteres`);
      }
      if (camposNombre.includes(key) && control?.errors?.['pattern']) {
        camposFaltantes.push(`${etiquetas[key]}: no permite caracteres especiales`);
      }
    });

    const listaMensajes: string[] = [...camposFaltantes];
    if (this.inputContrasena && this.usuarioForm.hasError('passwordMismatch')) {
      listaMensajes.push('Las contraseñas no coinciden');
    }

    if (this.usuarioForm.invalid || listaMensajes.length > 0) {
      this.submitButton = 'Actualizar';
      this.loading = false;

      await this.alerts.open({
        type: 'warning',
        title: '¡Faltan campos obligatorios!',
        message: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
          Los siguientes <strong>campos</strong> requieren atención:
        </p>
        <div style="max-height:350px;overflow-y:auto;">
          ${listaMensajes.map((msg, idx) => `
            <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
              <strong style="color:#b02a37;">${idx + 1}. ${msg}</strong>
            </div>`).join('')}
        </div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    // Foto por defecto si no hay foto subida
    const fotoCtrl = this.usuarioForm.get('fotoPerfil');
    const fotoVal = fotoCtrl?.value;
    if (!fotoVal || (typeof File !== 'undefined' && fotoVal instanceof File)) {
      fotoCtrl?.setValue('https://dashcamsys.s3.us-east-2.amazonaws.com/imagenes/2c369ac0-c489-4384-8d35-3ba482f7ccaa.jpeg');
    }

    const {
      userName,
      confirmPassword,
      passwordHash,
      idRol,
      idCliente,
      permisosIds,
      ...rest
    } = this.usuarioForm.value;

    const payload: any = {
      ...rest,
      idRol: Number(idRol),
      permisosIds: (permisosIds || []).map((x: any) => Number(x)),
    };

    if (this.inputContrasena && passwordHash) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      await this.alerts.open({
        type: 'warning',
        title: 'La contraseña no se cambia aquí',
        message: 'El resto de los datos sí se puede guardar. La contraseña se cambia desde el perfil, con la contraseña actual.',
        confirmText: 'Entendido',
        backdropClose: false,
      });
      this.loading = true;
      this.submitButton = 'Cargando...';
    }

    if (!payload.permisosIds || payload.permisosIds.length === 0) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      await this.alerts.open({
        type: 'warning',
        title: '¡Faltan permisos!',
        message: `
        <div style="max-height:350px;overflow-y:auto;">
          <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
            <strong style="color:#b02a37;">Debes asignar los permisos correspondientes al usuario.</strong>
          </div>
        </div>
      `,
        confirmText: 'De acuerdo',
        backdropClose: false,
      });
      return;
    }

    this.usuaService.actualizarUsuario(this.idUsuario, payload).subscribe({
      next: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos del usuario se actualizaron correctamente.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.regresar();
      },
      error: (err: any) => {
        this.loading = false;
        this.submitButton = 'Actualizar';
        this.getErrorMessage(err).then((msg) => {
          setTimeout(() => {
            this.alerts.open({
              type: 'error',
              title: '¡Ops!',
              message: msg,
              confirmText: 'Aceptar',
              backdropClose: false
            });
          }, 200);
        });
      }
    });
  }


  private async getErrorMessage(err: any): Promise<string> {
    if (err?.status === 0 && !err?.error) {
      return 'No hay conexión con el servidor (status 0). Verifica tu red.';
    }
    if (err?.error instanceof Blob) {
      try {
        const txt = await err.error.text();
        if (txt) return txt;
      } catch {
      }
    }
    if (typeof err?.error === 'string' && err.error.trim()) {
      return err.error;
    }
    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message;
    }
    if (err?.error?.message) {
      return String(err.error.message);
    }
    if (err?.error?.errors) {
      const e = err.error.errors;
      if (Array.isArray(e)) {
        return e.filter(Boolean).join('\n');
      }
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

  private async mostrarAlertaPermisos(): Promise<void> {
    await this.alerts.open({
      type: 'warning',
      title: '¡Faltan permisos!',
      message: `
      <div style="max-height:350px;overflow-y:auto;">
        <div style="padding:8px 12px;border-left:4px solid #d9534f;
                    background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
          <strong style="color:#b02a37;">Debes asignar los permisos correspondientes al usuario.</strong>
        </div>
      </div>
    `,
      confirmText: 'De acuerdo',
      backdropClose: false,
    });
  }

  onNombreKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V')) {
      event.preventDefault();
      return;
    }
    bloquearCaracteresEspecialesNombre(event);
  }

  bloquearPegado(event: Event): void {
    event.preventDefault();
  }

  regresar() {
    this.route.navigateByUrl('/administracion/usuarios');
  }

  // === Props / estado ===
  @ViewChild('fotoFileInput') fotoFileInput!: ElementRef<HTMLInputElement>;

  fotoPreviewUrl: string | null = null;
  fotoFileName: string | null = null;
  fotoDragging = false;
  uploadingFoto = false;

  // Límite MB visible desde template
  readonly MAX_MB = 3;

  // === Utils ===
  private isImage(file: File) {
    return /^image\/(png|jpe?g|webp)$/i.test(file.type);
  }
  private isAllowedImage(file: File) {
    return this.isImage(file) && file.size <= this.MAX_MB * 1024 * 1024;
  }
  private loadImagePreview(file: File, setter: (url: string | null) => void) {
    if (!this.isImage(file)) { setter(null); return; }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  }
  private extractFileUrl(res: any): string {
    return res?.url ?? res?.Location ?? res?.data?.url ?? res?.data?.Location
      ?? res?.key ?? res?.Key ?? res?.path ?? res?.filePath ?? '';
  }

  // === UI Handlers ===
  openFotoFilePicker() { this.fotoFileInput?.nativeElement.click(); }
  onFotoDragOver(e: DragEvent) { e.preventDefault(); this.fotoDragging = true; }
  onFotoDragLeave(_e: DragEvent) { this.fotoDragging = false; }
  onFotoDrop(e: DragEvent) {
    e.preventDefault();
    this.fotoDragging = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) this.handleFotoFile(f);
  }
  onFotoFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement)?.files?.[0];
    if (f) this.handleFotoFile(f);
  }
  clearFotoFile(e: Event) {
    e.stopPropagation();
    this.fotoPreviewUrl = null;
    this.fotoFileName = null;
    if (this.fotoFileInput) this.fotoFileInput.nativeElement.value = '';
    // ⬇⬇⬇ default en vez de null
    this.usuarioForm.patchValue({ fotoPerfil: this.DEFAULT_FOTO_URL });
  }


  // === Core ===
  private handleFotoFile(file: File) {
    if (!this.isAllowedImage(file)) {
      this.usuarioForm.get('fotoPerfil')?.setErrors({ invalid: true });
      return;
    }
    this.fotoFileName = file.name;
    this.loadImagePreview(file, (url) => this.fotoPreviewUrl = url);
    // Guarda el File temporalmente por si quieres reintentar
    this.usuarioForm.patchValue({ fotoPerfil: file });
    this.usuarioForm.get('fotoPerfil')?.setErrors(null);
    this.uploadFoto(file);
  }

  private uploadFoto(file: File): void {
    if (this.uploadingFoto) return;
    this.uploadingFoto = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'usuarios');
    fd.append('idModule', '2');

    this.usuaService.uploadFile(fd).pipe(
      finalize(() => this.uploadingFoto = false)
    ).subscribe({
      next: (res: any) => {
        const url = this.extractFileUrl(res);
        if (url) {
          this.usuarioForm.patchValue({ fotoPerfil: url });
          this.fotoFileName = file.name;
        } else {
          // ⬇⬇⬇ si el backend no devuelve URL, usamos default
          this.usuarioForm.patchValue({ fotoPerfil: this.DEFAULT_FOTO_URL });
        }
      },
      error: (err: any) => {
        console.error('[UPLOAD][fotoPerfil]');
        // ⬇⬇⬇ fallback seguro
        this.usuarioForm.patchValue({ fotoPerfil: this.DEFAULT_FOTO_URL });
        this.fotoPreviewUrl = null;
        this.fotoFileName = null;
      }
    });
  }


  private ensureDefaultFoto(): void {
    const val = this.usuarioForm.get('fotoPerfil')?.value;
    // si está vacío o quedó como File local (aún no subido), forzamos default
    if (!val || val instanceof File) {
      this.usuarioForm.patchValue({ fotoPerfil: this.DEFAULT_FOTO_URL });
    }
  }



}
