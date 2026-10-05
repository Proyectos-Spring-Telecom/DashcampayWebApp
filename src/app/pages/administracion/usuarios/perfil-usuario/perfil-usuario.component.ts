import {
  Component,
  OnInit,
  ViewChild,
  DestroyRef,
  inject,
  Input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, UntypedFormControl, ValidationErrors, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { VexPageLayoutComponent } from '@vex/components/vex-page-layout/vex-page-layout.component';
import { VexPageLayoutHeaderDirective } from '@vex/components/vex-page-layout/vex-page-layout-header.directive';
import { VexBreadcrumbsComponent } from '@vex/components/vex-breadcrumbs/vex-breadcrumbs.component';
import { VexPageLayoutContentDirective } from '@vex/components/vex-page-layout/vex-page-layout-content.directive';

import { DxDataGridComponent, DxDataGridModule } from 'devextreme-angular';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { animate, style, transition, trigger } from '@angular/animations';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { UsuariosService } from 'src/app/pages/services/usuarios.service';
import { finalize } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import {
  getPasswordGuideText,
  getPasswordRuleKey,
  isPasswordValid,
  PASSWORD_MIN_LENGTH,
} from 'src/app/core/validators/password-policy';

declare const google: any;


export interface PerfilUsuario {
  nombre: string;
  rol: string;
  descripcion: string;
  telefono: string;
  correo: string;
  avatarUrl?: string | null;
}

export interface UserMini {
  nombre: string;
  usuario?: string;
  rol: string;
  email: string;
  telefono?: string;
  ubicacion?: string;
  bio?: string;
  avatarUrl?: string;
  joinedAt?: string | Date;
  stats?: {
    posts?: number;
    seguidores?: number;
    siguiendo?: number;
    reputacion?: number;
  };
  skills?: string[];
  tags?: string[];
}

@Component({
  selector: 'vex-perfil-usuario',
  standalone: true,
  templateUrl: './perfil-usuario.component.html',
  styleUrl: './perfil-usuario.component.scss',
  animations: [fadeInRight400ms,
    trigger('hintSwap', [
      transition('* => *', [
        animate(
          '90ms ease-in',
          style({ opacity: 0, transform: 'translateY(-4px)' })
        ),
        animate(
          '180ms 40ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
    ]),
  ],
  imports: [
    CommonModule,
    MatButtonToggleModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    MatMenuModule,
    MatTableModule,
    MatSortModule,
    MatCheckboxModule,
    MatPaginatorModule,
    FormsModule,
    MatDialogModule,
    MatInputModule,
    DxDataGridModule
  ]
})
export class PerfilUsuarioComponent {
  @Input() user: UserMini = {
    nombre: 'Jane Cooper',
    usuario: '@janecooper',
    rol: 'Product Manager',
    email: 'jane.cooper@example.com',
    telefono: '+52 55 1234 5678',
    ubicacion: 'CDMX, México',
    bio: 'Creando productos útiles con foco en datos y experiencia.',
    avatarUrl: 'assets/images/user_default.png',
    joinedAt: new Date('2023-07-18'),
    stats: { posts: 124, seguidores: 3482, siguiendo: 198, reputacion: 97 },
    skills: ['Angular', 'DevExtreme', 'RxJS', 'UX Writing'],
    tags: ['Activo'],
  };
  public showId: any;
  public showNombre: any;
  public showApellidoPaterno: any;
  public showApellidoMaterno: any;
  public showTelefono: any;
  public showCorreo: any;
  public showRol: any;
  public showRolDescripcion: any;
  public showImage: any;
  public showRolExtraDescripcion: any;
  public showCreacion: any;
  ultimoLogin: string | null = null;
  show = { curr: false, neu: false, conf: false };
  uploadingFoto = false;
  loading = false;
  dryRun = true;
  confirmMsg = '';
  confirmState: 'neutral' | 'valid' | 'invalid' = 'neutral';
  passwordStrengthMsg = '';
  passwordStrengthColor = '';
  hintVersion = 0;
  isAllValid = false;
  defaultAvatar = 'assets/img/avatars/noavatar.png';
  showUltimoLogin: string | null = null;

  constructor(
  private fb: FormBuilder,
  private alerts: AlertsService,
  private users: AuthenticationService,
  private usuarioService: UsuariosService
) {
  // 1) User crudo (puede venir null/undefined o con otra forma)
  const userRaw = (this.users.getUser?.() ?? null) as any;

  // 2) Helpers seguros
  const sanitize = (v: unknown, fallback = ''): string => {
    if (v === null || v === undefined) return fallback;
    const s = String(v);
    return s && s !== 'null' ? s : fallback;
  };

  // Busca la primera key existente y no vacía en userRaw
  const pick = <T = any>(...keys: string[]): T | undefined => {
    for (const k of keys) {
      const val = userRaw?.[k];
      if (val !== undefined && val !== null && val !== '' && val !== 'null') return val as T;
    }
    return undefined;
  };

  // 3) Normalización de campos con nombres alternativos
  const rolObj = (userRaw?.rol ?? userRaw?.role) || {};
  const u = {
    nombre:            sanitize(pick('nombre', 'name')),
    apellidoPaterno:   sanitize(pick('apellidoPaterno', 'apellido1', 'apellido')),
    apellidoMaterno:   sanitize(pick('apellidoMaterno', 'apellido2')),
    fechaCreacion:           pick<Date | string>('fechaCreacion', 'fhRegistro', 'createdAt'),
    ultimoLogin:             pick<Date | string>('ultimoLogin', 'lastLogin', 'last_sign_in_at'),
    telefono:          sanitize(pick('telefono', 'phone'), ''),
    userName:          sanitize(pick('userName', 'email', 'correo'), ''),
    rolNombre:         sanitize(rolObj?.nombre ?? rolObj?.name ?? userRaw?.rol ?? userRaw?.role ?? ''),
    rolDescripcion:    sanitize(rolObj?.descripcion ?? rolObj?.description ?? ''),
    fotoPerfil:        sanitize(pick('fotoPerfil', 'avatar', 'profileImage'), 'assets/img/avatars/noavatar.png'),
    id:                pick<number | string>('id', 'userId')
  };

  // 4) Asignaciones a tus variables de vista
  this.showNombre               = u.nombre;
  this.showApellidoPaterno      = u.apellidoPaterno;
  this.showApellidoMaterno      = u.apellidoMaterno;
  this.showCreacion             = this.formatFechaCreacion(u.fechaCreacion as any);
  this.ultimoLogin              = this.formatFechaCreacion(u.ultimoLogin as any);
  this.showTelefono             = u.telefono || 'Sin registro';
  this.showCorreo               = u.userName;
  this.showRol                  = u.rolNombre;
  this.showRolDescripcion       = u.rolDescripcion;
  this.showRolExtraDescripcion  = this.getDescripcionRol(u.rolNombre);
  this.showImage                = u.fotoPerfil;
  this.showId                   = u.id as any;
}


  private formatFechaCreacion(raw: any): string {
    if (!raw || raw === 'null') return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    const pad = (n: number) => String(n).padStart(2, '0');
    // Mostrar en UTC para no desplazar la hora del instante real (06:11 GMT-0600 → 12:11)
    return (
      `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    );
  }

  get resolvedAvatar(): string {
    const v = (this.showImage ?? '').toString().trim();
    if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') {
      return this.defaultAvatar;
    }
    return v;
  }

  onAvatarError(ev: Event) {
    if (this.showImage && this.showImage !== this.defaultAvatar) {
      this.showImage = this.defaultAvatar;
    }
  }

  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      if (file) {
        this.alerts.open({
          type: 'warning',
          title: 'Archivo no válido',
          message: 'Por favor selecciona una imagen (JPG, PNG, etc.).',
          backdropClose: false
        });
      }
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('foto', file, file.name);
    if (this.showId != null) {
      formData.append('idUsuario', String(this.showId));
    }

    this.uploadingFoto = true;
    this.usuarioService.subirFotoPerfil(formData).pipe(
      finalize(() => {
        this.uploadingFoto = false;
        input.value = '';
      })
    ).subscribe({
      next: (resp: any) => {
        const url = resp?.data?.url ?? resp?.url ?? resp?.fotoPerfil ?? resp?.foto;
        if (url) {
          this.showImage = url;
        }
        this.alerts.open({
          type: 'success',
          title: '¡Foto actualizada!',
          message: 'Tu foto de perfil se ha actualizado correctamente.',
          backdropClose: false
        });
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Error al subir la foto.';
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: msg,
          backdropClose: false
        });
      }
    });
  }

  private getDescripcionRol(rol: string): string {
    switch (rol?.toUpperCase()) {
      case 'SA':
        return 'Acceso total al sistema, puede gestionar usuarios, configuraciones, operaciones y seguridad sin restricciones.';
      case 'Administrador':
        return 'Responsable de la gestión general, incluyendo altas y bajas de recursos, configuración básica y soporte a operadores.';
      case 'Operador':
        return 'Enfocado únicamente en sus propias rutas y actividades asignadas. No tiene acceso a información de otros usuarios ni a configuraciones críticas.';
      case 'Reportes':
        return 'Encargado de la generación, análisis y consulta de reportes operativos y administrativos, con acceso especializado a datos históricos y métricas.';
      case 'Pasajeros':
        return 'Acceso limitado a la información relacionada con sus viajes, historial de rutas y notificaciones relevantes.';
      default:
        return 'Rol sin descripción extra definida.';
    }
  }

  passwordForm: FormGroup = this.fb.group(
    {
      // ✅ NUEVOS NOMBRES
      passwordActual: ['', Validators.required],
      passwordNueva: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
      passwordNuevaConfirmacion: ['', Validators.required],
    },
    { validators: this.passwordsMatchValidator }
  );

  onPasswordInput(): void {
    const value = this.passwordForm.get('passwordNueva')?.value || '';
    const key = getPasswordRuleKey(value);
    this.isAllValid = key === 'ok';
    const prevMsg = this.passwordStrengthMsg;
    this.passwordStrengthMsg = getPasswordGuideText(key);
    this.passwordStrengthColor = this.isAllValid ? 'valid' : 'invalid';
    if (this.passwordStrengthMsg !== prevMsg) this.hintVersion++;
  }

  updateConfirmState(): void {
    const newPwd = this.passwordForm.get('passwordNueva')?.value || '';
    const conf = this.passwordForm.get('passwordNuevaConfirmacion')?.value || '';
    if (!newPwd || !conf) {
      this.confirmMsg = '';
      this.confirmState = 'neutral';
      return;
    }
    if (newPwd === conf) {
      this.confirmMsg = 'Las contraseñas coinciden';
      this.confirmState = 'valid';
    } else {
      this.confirmMsg = 'Las contraseñas no coinciden';
      this.confirmState = 'invalid';
    }
  }

  get canSave(): boolean {
    const f = this.passwordForm;
    const a = f.get('passwordActual')?.value?.trim();
    const n = f.get('passwordNueva')?.value;
    const c = f.get('passwordNuevaConfirmacion')?.value;
    const allFilled = !!a && !!n && !!c;
    const match = n === c;
    return allFilled && match && isPasswordValid(n) && !this.loading;
  }

  // ✅ validador con NUEVOS nombres
  private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const a = group.get('passwordNueva')?.value;
    const b = group.get('passwordNuevaConfirmacion')?.value;
    return a && b && a !== b ? { passwordMismatch: true } : null;
  }

  // ✅ Ejecuta el servicio (sin dry-run). Mantengo logging.
  actualizarContrasena(): void {
    if (this.passwordForm.invalid || !isPasswordValid(this.passwordForm.get('passwordNueva')?.value || '')) {
      this.passwordForm.markAllAsTouched();
      this.alerts.open({
        type: 'error',
        title: 'Formulario incompleto',
        message: 'Por favor, completa todos los campos correctamente.',
        backdropClose: false
      });
      return;
    }

    const body = {
      passwordActual: this.passwordForm.get('passwordActual')?.value,
      passwordNueva: this.passwordForm.get('passwordNueva')?.value,
      passwordNuevaConfirmacion: this.passwordForm.get('passwordNuevaConfirmacion')?.value,
    };

    this.loading = true;

    this.usuarioService
      .actualizarContrasena(body)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.alerts.open({
            type: 'success',
            title: '¡Contraseña actualizada!',
            message: 'Tu contraseña ha sido cambiada correctamente.',
            backdropClose: false
          });
          this.passwordForm.reset();
          this.show = { curr: false, neu: false, conf: false };
          this.confirmMsg = '';
          this.confirmState = 'neutral';
          this.passwordStrengthMsg = '';
          this.passwordStrengthColor = '';
          this.isAllValid = false;
        },
        error: (error) => {
          const mensaje = error?.error?.message || 'Ocurrió un error al actualizar la contraseña.';
          console.error('[ERROR] actualizarContrasena');
          this.alerts.open({
            type: 'error',
            title: '¡Ops!',
            message: mensaje,
            backdropClose: false
          });
        },
      });
  }



  t = (c: string): AbstractControl => this.passwordForm.get(c)!;

  onResetPassword(): void {
    this.passwordForm.reset();
    this.show = { curr: false, neu: false, conf: false };
  }

  async onSubmitPassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    try {
      const { currentPassword, newPassword } = this.passwordForm.value;
      this.onResetPassword();
    } catch (e) {
    } finally {
      this.loading = false;
    }
  }

  trackByIndex = (i: number) => i;
}
