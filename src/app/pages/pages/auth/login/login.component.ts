import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { NavigationService } from 'src/app/core/navigation/navigation.service';
import { AlertsService } from '../../modal/alerts.service';
import { User } from 'src/app/entities/User';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'vex-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInRight400ms],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    RouterLink,
    NgIf,
    NgFor
  ]
})
export class LoginComponent implements OnInit, OnDestroy {
  inputType = 'password';
  visible = false;
  textLogin = 'Iniciar Sesión';
  loading = false;
  otpOpen = false;
  loginForm: FormGroup = this.fb.group({
    userName: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });
  emailForm: FormGroup = this.fb.group({
    userName: ['', [Validators.required, Validators.email]]
  });
  readonly OTP_LENGTH = 6;
  verifyForm: FormGroup = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });
  modalStep: 'email' | 'otp' = 'email';
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;
  otp: string[] = Array(6).fill('');
  readonly otpIndexes = [0, 1, 2, 3, 4, 5];
  resendDisabled = false;
  resendSeconds = 60;
  private resendTimer?: number;
  private emailFlowTimers: any[] = [];

  constructor(
    private fb: FormBuilder,
    private auth: AuthenticationService,
    private navigation: NavigationService,
    private alerts: AlertsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private location: Location
  ) { }

  ngOnInit(): void {
    this.otpOpen = false;
    if (window?.location?.hash) {
      this.location.replaceState(window.location.pathname + window.location.search);
    }
    this.otpOpen = false;
  }

  ngOnDestroy(): void {
    if (this.resendTimer) clearInterval(this.resendTimer as any);
    this.clearEmailFlowTimers();
  }

  toggleVisibility() {
    this.inputType = this.visible ? 'password' : 'text';
    this.visible = !this.visible;
    this.cdr.markForCheck();
  }


onSubmit() {
  if (this.loginForm.invalid || this.loading) return;

  this.loading = true;
  this.textLogin = 'Cargando...';

  const credentials = this.loginForm.value as { userName: string; password: string };

  this.auth.authenticate(credentials).pipe(
    tap((auth) => this.auth.setTokens(auth.token, auth.refreshToken)),
    switchMap(() => this.auth.getMe())
  ).subscribe({
    next: (user: User) => {
      this.loading = false;
      this.textLogin = 'Iniciar Sesión';
      this.cdr.markForCheck();

      this.alerts.open({
        type: 'success',
        title: '¡Operación Exitosa!',
        message: 'Tu cuenta ha sido autenticada exitosamente.',
        confirmText: 'Confirmar',
        backdropClose: false
      }).then((res) => {
        if (res === 'confirm') {
          this.auth.setData(user);
          this.router.navigateByUrl(this.navigation.getHomeRoute());
        }
      });
    },
    error: async (err: HttpErrorResponse) => {
      this.auth.cleanSession();
      // mostrar EXACTO lo que manda el back (text/plain, Blob o JSON)
      let backendMsg = '';
      if (typeof err?.error === 'string') {
        backendMsg = err.error;
      } else if (err?.error instanceof Blob) {
        try { backendMsg = await err.error.text(); } catch {}
      } else if (err?.error?.message) {
        backendMsg = Array.isArray(err.error.message)
          ? err.error.message.join(' ')
          : String(err.error.message);
      }
      if (!backendMsg) backendMsg = err?.statusText || `HTTP ${err?.status || ''}`.trim();

      if (
        (err?.status === 401 && !backendMsg.toLowerCase().includes('bloqueada')) ||
        err?.status === 404 ||
        this.isGenericLoginFailure(backendMsg)
      ) {
        backendMsg = 'Credenciales invalidas';
      }

      const message = this.isLoginThrottled(err, backendMsg)
        ? 'Intentos excedidos, por favor espera unos minutos y vuelve a intentarlo.'
        : backendMsg;

      this.loading = false;
      this.textLogin = 'Iniciar Sesión';
      this.cdr.markForCheck();

      this.alerts.open({
        type: 'error',
        title: '¡Ops!',
        message,
        confirmText: 'Entendido',
        backdropClose: false
      });
    }
  });
}


  onSendEmail() {
    if (this.emailForm.invalid || this.loading) return;
    this.loading = true;
    const payload = { userName: this.emailForm.get('userName')!.value };

    this.auth.recuperarAcceso(payload).subscribe({
      next: (msg: string) => {
        this.loading = false;
        this.cdr.markForCheck();
        this.closeOtpModal();
        const t1 = setTimeout(() => {
          this.alerts.open({
            type: 'success',
            title: '¡Operación Exitosa!',
            message: msg || 'Se ha enviado a su correo electrónico el código de verificación para su cuenta.',
            confirmText: 'Confirmar',
            backdropClose: false
          })
          .then(() => {
            const t2 = setTimeout(() => {
              this.startResendCountdown();
              this.resendMsg = null;
              this.goToOtpStep();
              this.openModal('otp');
            }, 1000);
          });
        }, 1000);
      },
      error: async (err) => {
        const msg = (await this.getErrorMessage(err));
        this.loading = false;
        this.cdr.markForCheck();
        this.alerts.open({ type: 'error', title: '¡Ops!', message: msg, confirmText: 'Entendido', backdropClose: false });
      }
    });
  }

  onOtpInput(e: Event, i: number) {
    const input = e.target as HTMLInputElement;
    const v = (input.value || '').replace(/\D/g, '').slice(0, 1);
    input.value = v;
    this.otp[i] = v;
    if (v && i < this.OTP_LENGTH - 1) {
      const next = this.otpInputs?.get(i + 1)?.nativeElement;
      next?.focus();
      next?.select();
    }
    if (this.otp.join('').length === this.OTP_LENGTH) {
      this.verifyForm.patchValue({ codigo: this.otp.join('') }, { emitEvent: false });
    }
  }

  onOtpKeydown(e: KeyboardEvent, i: number) {
    const input = e.target as HTMLInputElement;
    if (e.key === 'Backspace' && !input.value && i > 0) {
      const prev = this.otpInputs?.get(i - 1)?.nativeElement;
      prev?.focus();
      prev?.select();
      return;
    }
    if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key.length === 1) {
      e.preventDefault();
    }
  }

  onVerify() {
    this.verifyForm.patchValue({ codigo: this.otp.join('') }, { emitEvent: false });
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
        backdropClose: false
      });
      return;
    }

    const codigo = (this.verifyForm.get('codigo')!.value || '').toString().trim();
    const userName = (this.emailForm.get('userName')?.value || this.loginForm.get('userName')?.value || '').toString().trim();
    if (!userName) {
      this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: 'Indica el correo de la cuenta antes de validar el código.',
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    this.loading = true;
    this.auth.reenviarCodigo({ codigo, userName }).subscribe({
      next: (msg: string) => {
        this.loading = false;
        this.otp = Array(6).fill('');
        this.verifyForm.reset({ codigo: '' }, { emitEvent: false });
        this.closeOtpModal();
        this.cdr.markForCheck();
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: msg || 'Código validado correctamente. Tu cuenta fue verificada.',
          confirmText: 'Entendido',
          backdropClose: false
        });
      },
      error: async (err) => {
        this.loading = false;
        this.cdr.markForCheck();
        const msg = (await this.getErrorMessage(err));
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: msg,
          confirmText: 'Entendido',
          backdropClose: false
        });
      }
    });
  }


  private goToOtpStep(): void {
    this.resendMsg = null;
    this.modalStep = 'otp';
    this.otp = Array(6).fill('');
    this.verifyForm.reset({ codigo: '' }, { emitEvent: false });
    this.cdr.detectChanges();
    setTimeout(() => {
      const first = this.otpInputs?.get(0)?.nativeElement;
      first?.focus(); first?.select?.();
    }, 0);
  }

  otpClosing = false;

  onResend() {
    if (this.resendDisabled || this.loading) return;
    if (this.emailForm.invalid) return;

    this.loading = true;
    const payload = { userName: this.emailForm.get('userName')!.value };

    this.auth.recuperarAcceso(payload).subscribe({
      next: (msg: string) => {
        this.loading = false;
        this.startResendCountdown();
        this.resendMsg = msg || 'Se ha enviado nuevamente el correo con tu código de verificación.';
        this.cdr.markForCheck();
      },
      error: async (err) => {
        // si prefieres no mostrar errores inline, mantenemos alerta para error
        const msg = (await this.getErrorMessage(err));
        this.loading = false;
        this.cdr.markForCheck();
        this.alerts.open({ type: 'error', title: '¡Ops!', message: msg, confirmText: 'Entendido', backdropClose: false });
      }
    });
  }

  private startResendCountdown() {
    if (this.resendTimer) clearInterval(this.resendTimer as any);
    this.resendDisabled = true;
    this.resendSeconds = 60;
    this.resendTimer = setInterval(() => {
      this.resendSeconds -= 1;
      if (this.resendSeconds <= 0) {
        clearInterval(this.resendTimer as any);
        this.resendDisabled = false;
      }
      this.cdr.markForCheck();
    }, 1000) as unknown as number;
  }

  openOtpModal(): void {
    this.modalStep = 'email';
    this.otpOpen = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      const el = document.querySelector('#otp-modal .otp-email') as HTMLInputElement | null;
      el?.focus(); el?.select?.();
    }, 0);
  }
closeOtpModal(ev?: Event) {
  ev?.preventDefault();
  if (!this.otpOpen || this.otpClosing) return;

  // Reiniciar formularios del flujo de email/OTP
  this.emailForm.reset({ userName: '' }, { emitEvent: false });
  this.emailForm.markAsPristine();
  this.emailForm.markAsUntouched();

  this.verifyForm.reset({ codigo: '' }, { emitEvent: false });
  this.verifyForm.markAsPristine();
  this.verifyForm.markAsUntouched();

  this.otpClosing = true;
  this.cdr.markForCheck();

  setTimeout(() => {
    this.otpOpen = false;
    this.otpClosing = false;
    this.cdr.markForCheck();
  }, 220); // debe coincidir con la duración en CSS
}


  private clearEmailFlowTimers() {
    this.emailFlowTimers.forEach(t => clearTimeout(t));
    this.emailFlowTimers = [];
  }

  openModal(step: 'email' | 'otp' = 'email') {
    this.modalStep = step;
    this.otpClosing = false;
    this.otpOpen = true;
    this.cdr.detectChanges();
    if (step === 'otp') {
      setTimeout(() => {
        this.otpInputs?.get(0)?.nativeElement?.focus();
        this.otpInputs?.get(0)?.nativeElement?.select?.();
      }, 0);
    }
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

  setEmailStep() {
    this.modalStep = 'email';
    this.cdr.markForCheck();
  }
  resendMsg: string | null = null;

  private isGenericLoginFailure(backendMsg: string): boolean {
    const text = (backendMsg || '').toLowerCase();
    return (
      text.includes('no se encontró al usuario') ||
      text.includes('no se encontro al usuario') ||
      text.includes('not found')
    );
  }

  private isLoginThrottled(err: HttpErrorResponse, backendMsg: string): boolean {
    if (err?.status === 429) {
      return true;
    }
    const fragments = [backendMsg];
    const nested = err?.error?.message;
    if (Array.isArray(nested)) {
      fragments.push(...nested.map(String));
    } else if (nested) {
      fragments.push(String(nested));
    }
    if (typeof err?.error === 'string') {
      fragments.push(err.error);
    }
    const text = fragments.join(' ').toLowerCase();
    return text.includes('throttlerexception') || text.includes('too many requests');
  }
}
