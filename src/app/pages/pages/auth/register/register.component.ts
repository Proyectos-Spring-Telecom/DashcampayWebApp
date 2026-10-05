import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fadeInUp400ms } from '@vex/animations/fade-in-up.animation';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { animate, style, transition, trigger } from '@angular/animations';
import { Credentials } from 'src/app/entities/Credentials';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { PasajerosService } from 'src/app/pages/services/pasajeros.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { AlertsService } from '../../modal/alerts.service';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import {
  getPasswordGuideText,
  getPasswordRuleKey,
  PASSWORD_PATTERN,
} from 'src/app/core/validators/password-policy';

@Component({
  selector: 'vex-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  animations: [
    fadeInRight400ms,
    trigger('fadeOnChange', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(4px)' }),
        animate('160ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(4px)' }),
        animate('160ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' }))
      ])
    ])
  ],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTooltipModule,
    NgIf,
    NgFor,
    MatIconModule,
    MatCheckboxModule,
    MatSelectModule,
    RouterLink,
    NgClass
  ]
})
export class RegisterComponent implements OnInit, OnDestroy {
  afiliacionPasajero!: UntypedFormGroup;
  public credentials!: Credentials;
  public textLogin: string = 'Iniciar Sesión';
  public idUsuario!: any;
  submitted = false;
  error = '';
  returnUrl!: string;
  public passwordType: string = 'password';
  public submitButton: string = 'Guardar';
  public loading: boolean = false;

  hide = true;
  type = 'password';
  pwFocused = false;
  pwAllOk = false;
  pwGuideText = getPasswordGuideText('needLength');
  pwGuideKey = 'needLength';
  readonly OTP_LENGTH = 6;
  verifyForm!: UntypedFormGroup;

  private subs: Subscription[] = [];

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;
  otp: string[] = Array(6).fill('');
  readonly otpIndexes = [0, 1, 2, 3, 4, 5];

  resendDisabled = false;
  resendSeconds = 60;
  private resendTimer: any;
  listaClientes: any[] = [];
  loadingClientes = false;

  togglePassword(): void {
    this.hide = !this.hide;
  }

  myFunctionPasswordCurrent() {
    this.type = this.type === 'password' ? 'text' : 'password';
  }

  get showPwHint(): boolean {
    const c = this.afiliacionPasajero?.get('passwordHash');
    const v = (c?.value || '').toString();
    return this.pwFocused && v.length > 0;
  }

  constructor(
    private router: Router,
    private auth: AuthenticationService,
    private fb: FormBuilder,
    private pasajService: PasajerosService,
    private clientesService: ClientesService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private alerts: AlertsService,
  ) { }

  initForm() {
    this.afiliacionPasajero = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellidoPaterno: ['', [Validators.required]],
      apellidoMaterno: [null],
      fechaNacimiento: ['', [Validators.required]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      correo: ['', [Validators.required, Validators.email]],
      passwordHash: [
        '',
        [Validators.required, Validators.pattern(PASSWORD_PATTERN)]
      ],
      numeroSerieMonedero: ['', [Validators.maxLength(50)]],
      idCliente: [null]
    });

    // Validación condicional: idCliente es obligatorio solo si numeroSerieMonedero está vacío
    this.afiliacionPasajero.get('numeroSerieMonedero')?.valueChanges.subscribe((numeroSerie: string) => {
      const idClienteControl = this.afiliacionPasajero.get('idCliente');
      if (!numeroSerie || numeroSerie.trim() === '') {
        // Si no hay número de serie, idCliente es obligatorio y habilitado
        idClienteControl?.enable({ emitEvent: false });
        idClienteControl?.setValidators([Validators.required]);
      } else {
        // Si hay número de serie, idCliente se pone en null, se deshabilita y no es obligatorio
        idClienteControl?.setValue(null, { emitEvent: false });
        idClienteControl?.disable({ emitEvent: false });
        idClienteControl?.clearValidators();
      }
      idClienteControl?.updateValueAndValidity({ emitEvent: false });
    });

    // También validar al inicio
    const numeroSerieValue = this.afiliacionPasajero.get('numeroSerieMonedero')?.value;
    const idClienteControl = this.afiliacionPasajero.get('idCliente');
    if (!numeroSerieValue || numeroSerieValue.trim() === '') {
      idClienteControl?.enable({ emitEvent: false });
      idClienteControl?.setValidators([Validators.required]);
    } else {
      idClienteControl?.setValue(null, { emitEvent: false });
      idClienteControl?.disable({ emitEvent: false });
      idClienteControl?.clearValidators();
    }
    idClienteControl?.updateValueAndValidity({ emitEvent: false });
  }

  ngOnInit(): void {
    this.verifyForm = this.fb.group({
      codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
    this.initForm();
    this.cargarClientes();
    this.subs.push(
      this.afiliacionPasajero.get('passwordHash')!.valueChanges.subscribe((raw: string) => {
        const v = (raw || '').trim();
        if (raw !== v) this.afiliacionPasajero.get('passwordHash')!.setValue(v, { emitEvent: false });

        const ruleKey = getPasswordRuleKey(v);
        this.pwGuideKey = ruleKey;
        this.pwGuideText = getPasswordGuideText(ruleKey);
        this.pwAllOk = ruleKey === 'ok';
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearInterval(this.resendTimer);
  }

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    this.afiliacionPasajero.markAllAsTouched();
    this.afiliacionPasajero.updateValueAndValidity();

    if (this.afiliacionPasajero.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: any = {
        nombre: 'Nombre',
        apellidoPaterno: 'Apellido Paterno',
        apellidoMaterno: 'Apellido Materno',
        fechaNacimiento: 'Fecha de Nacimiento',
        telefono: 'Teléfono',
        correo: 'Correo Electrónico',
        passwordHash: 'Contraseña',
        numeroSerieMonedero: 'Número de Serie',
        idCliente: 'Compañía de transporte',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.afiliacionPasajero.controls).forEach(key => {
        const control = this.afiliacionPasajero.get(key);
        if (control?.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      const lista = camposFaltantes.map((campo, index) => `
        <div style="padding: 8px 12px; border-left: 4px solid #d9534f; background: #caa8a8; text-align: center; margin-bottom: 8px; border-radius: 4px;">
          <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
        </div>
      `).join('');

      this.alerts.open({
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

    if (this.afiliacionPasajero.contains('id')) {
      this.afiliacionPasajero.removeControl('id');
    }

    this.pasajService.agregarPasajeroAfiliacion(this.afiliacionPasajero.value).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;

        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Te enviamos un código de <strong>6 dígitos</strong> a tu correo. Ingrésalo para activar tu cuenta.',
          confirmText: 'Ingresar código',
          backdropClose: false
        }).then((res: any) => {
          // Asegura compatibilidad: si el servicio retorna string ('confirm') o { result: 'confirm' }
          const result = typeof res === 'string' ? res : res?.result;
          if (result === 'confirm') {
            this.openOtpModal();
            this.startResendCountdown();
          }
        });
      },
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;

        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'No pudimos completar tu afiliación. Revisa que tus datos estén correctos y vuelve a intentarlo. Si el problema continúa, contáctanos para ayudarte.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
      }
    );
  }

  // ===================== Lógica OTP y Reenvío =====================

  onOtpInput(e: Event, i: number) {
    const input = e.target as HTMLInputElement;
    const v = (input.value || '').replace(/\D/g, '').slice(0, 1);
    input.value = v;
    this.otp[i] = v;

    if (v && i < this.OTP_LENGTH - 1) {
      const sib = input.nextElementSibling as HTMLInputElement | null;
      if (sib && sib.classList.contains('otp-box')) {
        sib.focus();
        sib.select();
      } else {
        const next = this.otpInputs?.get(i + 1)?.nativeElement;
        next?.focus();
        next?.select();
      }
    }

    if (this.otp.join('').length === this.OTP_LENGTH) {
      this.verifyForm.patchValue({ codigo: this.otp.join('') }, { emitEvent: false });
    }
  }

  onOtpKeydown(e: KeyboardEvent, i: number) {
    const input = e.target as HTMLInputElement;

    if (e.key === 'Backspace' && !input.value && i > 0) {
      const prev = input.previousElementSibling as HTMLInputElement | null;
      if (prev && prev.classList.contains('otp-box')) {
        prev.focus();
        prev.select();
      } else {
        const p = this.otpInputs?.get(i - 1)?.nativeElement;
        p?.focus();
        p?.select();
      }
      return;
    }

    if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key.length === 1) {
      e.preventDefault();
    }
  }

  private startResendCountdown() {
    clearInterval(this.resendTimer);
    this.resendDisabled = true;
    this.resendSeconds = 60;
    this.resendTimer = setInterval(() => {
      this.resendSeconds -= 1;
      if (this.resendSeconds <= 0) {
        clearInterval(this.resendTimer);
        this.resendDisabled = false;
      }
    }, 1000);
  }

  onVerify() {
    const code = this.otp.join('');
    this.verifyForm.patchValue({ codigo: code }, { emitEvent: false });
    this.startResendCountdown();

    this.verifyForm.markAllAsTouched();
    this.verifyForm.updateValueAndValidity();
    if (this.verifyForm.invalid) {
      this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
          <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
            Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
            Por favor complétalos antes de continuar:
          </p>
          <div style="max-height:350px;overflow-y:auto;">
            <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
              <strong style="color:#b02a37;">1. Código de Verificación</strong>
            </div>
          </div>
        `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    this.Verify();
  }

  onResend() {
    if (this.resendDisabled) return;
    const payload = this.afiliacionPasajero.value;
    this.startResendCountdown();
    this.pasajService.agregarPasajeroAfiliacion(payload).subscribe({
      next: () => {},
      error: (err) => console.error('Error al reenviar')
    });
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.keyCode ? event.keyCode : (event as any).which;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  Verify() {
  this.submitButton = 'Cargando...';
  this.loading = true;

  const codigo = (this.verifyForm.get('codigo')!.value || '').toString().trim();
  const userName = (this.afiliacionPasajero?.get('correo')?.value || '').toString().trim();
  this.pasajService.verificarPasajero(codigo, userName).subscribe({
    next: () => {
      this.submitButton = 'Guardar';
      this.loading = false;
      this.pasajService.clearVerificationToken();
      this.alerts.open({
        type: 'success',
        title: '¡Operación Exitosa!',
        message: 'Tu cuenta de pasajero quedó activada. Ahora puedes iniciar sesión y empezar a usar tu monedero.',
        confirmText: 'Ir a iniciar sesión',
        backdropClose: false
      }).then((res: any) => {
        const result = typeof res === 'string' ? res : res?.result;
        if (result === 'confirm') {
          this.router.navigate(['/login']);
        }
      });
    },
    error: async (err) => {
      const msg = await this.getErrorMessage(err);
      this.submitButton = 'Guardar';
      this.loading = false;
      this.alerts.open({
        type: 'error',
        title: '¡Ops!',
        message: msg || 'Código inválido o expirado. Verifica el código de activación y vuelve a intentarlo.',
        confirmText: 'Entendido',
        backdropClose: false
      });
    }
  });
}


  openOtpModal(): void {
    // Reinicia el hash para forzar :target incluso si ya estaba abierto
    window.location.hash = '';
    // Espera un tick y aplica el target
    setTimeout(() => {
      window.location.hash = 'otp-modal';
      setTimeout(() => {
        const first = document.querySelector('#otp-modal .otp-box') as HTMLInputElement | null;
        first?.focus();
        first?.select();
      }, 0);
    }, 0);
  }

  private async getErrorMessage(err: any): Promise<string> {
    if (err?.status === 0 && !err?.error) {
      return 'No hay conexión con el servidor (status 0). Verifica tu red.';
    }
    if (err?.error instanceof Blob) {
      try {
        const txt = await err.error.text();
        if (txt) return txt;
      } catch { }
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

  closeOtpModal(): void {
    window.location.hash = '';
  }

  cargarClientes(): void {
    this.loadingClientes = true;
    this.clientesService.obtenerClientesPublicos().subscribe({
      next: (response: any) => {
        // Manejar diferentes estructuras de respuesta
        let clientes: any[] = [];
        if (Array.isArray(response)) {
          clientes = response;
        } else if (response?.data && Array.isArray(response.data)) {
          clientes = response.data;
        } else if (response?.data && !Array.isArray(response.data)) {
          clientes = [response.data];
        }
        
        // Mapear los clientes para asegurar que tengan el formato correcto
        this.listaClientes = clientes.map((cliente: any) => ({
          id: cliente.id,
          nombre: cliente.nombre || '',
          apellidoPaterno: cliente.apellidoPaterno || null,
          apellidoMaterno: cliente.apellidoMaterno || null,
          tipoPersona: cliente.tipoPersona || 1,
          // Crear nombreCliente para compatibilidad
          nombreCliente: cliente.tipoPersona === 2 
            ? cliente.nombre 
            : `${cliente.nombre || ''} ${cliente.apellidoPaterno || ''} ${cliente.apellidoMaterno || ''}`.trim()
        }));
        
        this.loadingClientes = false;
      },
      error: (err) => {
        console.error('Error al cargar clientes:');
        this.listaClientes = [];
        this.loadingClientes = false;
      }
    });
  }
}
