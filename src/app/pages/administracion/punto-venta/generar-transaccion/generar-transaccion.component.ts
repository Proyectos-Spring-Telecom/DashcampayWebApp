import { Component, OnInit, NgZone } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { MonederosServices } from 'src/app/pages/services/monederos.service';
import { TransaccionesService } from 'src/app/pages/services/transacciones.service';
import { NetpayService } from 'src/app/pages/services/netpay.service';
import { NetpayDialogComponent } from '../netpay-dialog/netpay-dialog.component';
import { AuthenticationService } from 'src/app/core/services/auth.service';

declare const NetPay: any;

@Component({
  selector: 'vex-generar-transaccion',
  templateUrl: './generar-transaccion.component.html',
  styleUrl: './generar-transaccion.component.scss',
  animations: [fadeInRight400ms]
})
export class GenerarTransaccionComponent implements OnInit {
  step = 1;
  layoutCtrl = new UntypedFormControl('fullwidth');
  query = '';
  monederos = [
    {
      id: 1,
      numeroSerie: 'MX-001-AB',
      pasajero: 'Andrea López',
      cliente: 'Transp. Aurora',
      saldo: 320.5
    },
    {
      id: 2,
      numeroSerie: 'MX-002-CD',
      pasajero: 'Luis Pérez',
      cliente: 'Transp. Aurora',
      saldo: 150.0
    },
    {
      id: 3,
      numeroSerie: 'MX-003-EF',
      pasajero: 'María Ruiz',
      cliente: 'Logística Sol',
      saldo: 980.75
    }
  ];
  monederosFiltrados = [...this.monederos];
  monederosPaginados: any[] = [];
  pageIndex = 0;
  pageSize = 9;
  monto = 0;
  montoView = '';
  metodoPago: 'efectivo' | 'tarjeta' = 'efectivo';
  tarjetaSeleccionada: any = null;
  // Información adicional de la tarjeta para transacciones
  tarjetaInfo: {
    tokenCard?: string;
    deviceFingerPrint?: string;
    deviceInformation?: any;
    idDireccion?: number | null;
  } = {};

  rolUsuario: string = '';
  esPasajero: boolean = false;

  constructor(
    private moneService: MonederosServices,
    private transaccionService: TransaccionesService,
    private alerts: AlertsService,
    private route: Router,
    private dialog: MatDialog,
    private netpayService: NetpayService,
    private authService: AuthenticationService
  ) {}

  ngOnInit() {
    // Obtener el rol del usuario
    const user = this.authService.getUser();
    this.rolUsuario = user?.rol?.nombre || '';
    this.esPasajero = this.rolUsuario?.toLowerCase() === 'pasajero';
    
    // Establecer el método de pago por defecto según el rol
    if (this.esPasajero) {
      this.metodoPago = 'tarjeta';
    } else {
      this.metodoPago = 'efectivo';
    }
    
    this.aplicarPaginacion();
    this.obtenerMonederos();
  }

  irPaso(n: 1 | 2) {
    this.step = n;
    // Cerrar todas las tarjetas al cambiar de paso
    if (this.tarjetasCliente && this.tarjetasCliente.length > 0) {
      this.cerrarTodasLasTarjetas();
    }
  }

  onPage(e: { pageIndex: number; pageSize: number }) {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.aplicarPaginacion();
  }

  private aplicarPaginacion() {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    this.monederosPaginados = this.monederosFiltrados.slice(start, end);
  }

  seleccionarMonedero(m: any) {
    this.monederoSeleccionado = m;
    // Solo resetear a efectivo si NO es Pasajero, si es Pasajero mantener tarjeta
    if (!this.esPasajero) {
      this.metodoPago = 'efectivo';
    } else {
      this.metodoPago = 'tarjeta';
    }
    this.tarjetaSeleccionada = null; // Limpiar tarjeta seleccionada
    this.tarjetaInfo = {}; // Limpiar información de la tarjeta
    
    // Si el monedero tiene customerId, obtener las tarjetas y direcciones
    if (m?.customerId !== null && m?.customerId !== undefined) {
      this.obtenerTarjetas(m.customerId);
    } else {
      this.tarjetasCliente = [];
      this.direccionesDisponibles = [];
    }
  }

  seleccionarTarjeta(tarjeta: any) {
    this.tarjetaSeleccionada = tarjeta;
    this.metodoPago = 'tarjeta'; // Cambiar automáticamente a método de pago con tarjeta
    
    // Guardar información de la tarjeta seleccionada para la transacción
    const tokenCard = tarjeta.source || tarjeta.card?.token;
    if (tokenCard) {
      // Buscar la dirección en datosTarjeta usando el tokenCard
      let idDireccion: number | null = null;
      if (this.direccionesDisponibles && this.direccionesDisponibles.length > 0) {
        const direccionEncontrada = this.direccionesDisponibles.find(
          (dir: any) => dir.tokenCard === tokenCard
        );
        if (direccionEncontrada && direccionEncontrada.idDireccion) {
          idDireccion = direccionEncontrada.idDireccion;
        }
      }
      
      // Generar valores para la transacción (para tarjetas existentes)
      this.tarjetaInfo = {
        tokenCard: tokenCard,
        deviceFingerPrint: tarjeta.card?.deviceFingerPrint || Date.now().toString(),
        deviceInformation: this.generarDeviceInformation(),
        idDireccion: idDireccion
      };
    }
  }
  
  private generarDeviceInformation(): any {
    // Generar información del dispositivo obtenida del navegador
    // Algunos valores son del navegador real, otros son valores por defecto cuando no están disponibles
    const colorDepth = window.screen.colorDepth || window.screen.pixelDepth || 24;
    const javaEnabled = (navigator as any).javaEnabled ? (navigator as any).javaEnabled() : false;
    
    return {
      deviceChannel: "Browser",
      httpBrowserColorDepth: colorDepth.toString(),
      httpBrowserJavaEnabled: javaEnabled ? "TRUE" : "FALSE",
      httpBrowserJavaScriptEnabled: "TRUE", // Siempre true en navegadores modernos
      httpBrowserLanguage: navigator.language || (navigator as any).userLanguage || "es",
      httpBrowserScreenHeight: window.screen.height.toString(),
      httpBrowserScreenWidth: window.screen.width.toString(),
      httpBrowserTimeDifference: new Date().getTimezoneOffset().toString()
    };
  }

  // Cerrar todas las tarjetas abiertas
  cerrarTodasLasTarjetas() {
    this.tarjetasCliente.forEach(t => {
      t._swipeX = 0;
      t._isSwiping = false;
    });
  }

  obtenerTarjetas(customerId: string) {
    this.cargandoTarjetas = true;
    this.netpayService.obtenerTarjetasCliente(customerId).subscribe(
      (response: any) => {
        this.cargandoTarjetas = false;
        
        // Guardar las direcciones disponibles del array datosTarjeta
        if (response?.datosTarjeta && Array.isArray(response.datosTarjeta)) {
          this.direccionesDisponibles = response.datosTarjeta;
        } else if (response?.data?.datosTarjeta && Array.isArray(response.data.datosTarjeta)) {
          this.direccionesDisponibles = response.data.datosTarjeta;
        } else {
          this.direccionesDisponibles = [];
        }
        
        // Las tarjetas vienen en el array paymentSources
        // Inicializar propiedades de swipe en cada tarjeta
        if (response?.paymentSources && Array.isArray(response.paymentSources)) {
          this.tarjetasCliente = response.paymentSources.map((t: any) => ({
            ...t,
            _swipeX: 0,
            _isSwiping: false
          }));
        } else if (Array.isArray(response)) {
          this.tarjetasCliente = response.map((t: any) => ({
            ...t,
            _swipeX: 0,
            _isSwiping: false
          }));
        } else if (response?.data?.paymentSources && Array.isArray(response.data.paymentSources)) {
          this.tarjetasCliente = response.data.paymentSources.map((t: any) => ({
            ...t,
            _swipeX: 0,
            _isSwiping: false
          }));
        } else {
          this.tarjetasCliente = [];
        }
      },
      (error: any) => {
        this.cargandoTarjetas = false;
        this.tarjetasCliente = [];
        this.direccionesDisponibles = [];
      }
    );
  }

  private sanitizeNumber(str: string): number {
    const clean = (str || '').replace(/[^\d.]/g, '');
    const parts = clean.split('.');
    const fixed =
      parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
    const n = parseFloat(fixed);
    return isNaN(n) ? 0 : n;
  }

  onInputMonto(ev: Event) {
    const val = (ev.target as HTMLInputElement).value;
    const n = this.sanitizeNumber(val);
    this.monto = Math.max(0, n);
    this.montoView = val;
  }

  agregarMonto(v: number) {
    this.monto = (this.monto || 0) + v;
    this.montoView = this.monto.toFixed(2);
  }

  key(k: string) {
    if (k === '00' && this.montoView) {
      this.montoView += '00';
    } else {
      this.montoView += k;
    }
    this.monto = this.sanitizeNumber(this.montoView);
  }

  borrar() {
    this.montoView = (this.montoView || '').slice(0, -1);
    this.monto = this.sanitizeNumber(this.montoView);
  }

  cargando = false;

  private toLocalISOString(d = new Date()): string {
    const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const offH = pad(Math.trunc(Math.abs(offsetMin) / 60));
    const offM = pad(Math.trunc(Math.abs(offsetMin) % 60));
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}${sign}${offH}:${offM}`;
  }

  private getNumeroSerieMonedero(): string {
    return (
      this.monederoSeleccionado?.numeroSerie ||
      this.monederoSeleccionado?.serie ||
      ''
    );
  }

  confirmarRecarga() {
    if (this.cargando) return;
    if (!this.monederoSeleccionado || !this.monto || this.monto <= 0) return;

    // Validar que si el método de pago es tarjeta, debe haber una tarjeta seleccionada
    if (this.metodoPago === 'tarjeta' && !this.tarjetaSeleccionada) {
      this.alerts.open({
        type: 'warning',
        title: '¡Atención!',
        message: 'Por favor seleccione una tarjeta para realizar el pago.',
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    // Determinar idMetodoPago: 1 para efectivo, 3 o 4 para tarjeta
    const idMetodoPago = this.metodoPago === 'efectivo' ? 1 : 3;

    const payload: any = {
      idTipoTransaccion: 1,
      monto: Number(this.monto),
      latitudInicial: null,
      longitudInicial: null,
      numeroSerieMonedero: this.getNumeroSerieMonedero(),
      numeroSerieValidador: null,
      idMetodoPago: idMetodoPago
    };

    // Si el método de pago es tarjeta, agregar campos adicionales
    if (this.metodoPago === 'tarjeta' && this.tarjetaSeleccionada) {
      const tokenCard = this.tarjetaInfo.tokenCard || this.tarjetaSeleccionada.source || this.tarjetaSeleccionada.card?.token;
      
      if (tokenCard) {
        // Generar sessionId y referenceId
        const sessionId = Date.now().toString();
        const referenceId = Date.now().toString();
        
        const deviceFingerPrint = this.tarjetaInfo.deviceFingerPrint || sessionId;
        
        payload.tokenCardNetPay = tokenCard;
        payload.referenceIdNetPay = referenceId;
        payload.sessionId = sessionId;
        payload.deviceFingerPrint = deviceFingerPrint;
        payload.transactionTokenIdNetPay = deviceFingerPrint; // Obligatorio cuando método de pago es tarjeta
        
        // Agregar idDireccion si existe
        if (this.tarjetaInfo.idDireccion) {
          payload.idDireccion = this.tarjetaInfo.idDireccion;
        }
        
        // Agregar deviceInformation
        if (this.tarjetaInfo.deviceInformation) {
          payload.deviceInformation = this.tarjetaInfo.deviceInformation;
        }
      }
    }

    // Enviar la petición
    this.agregar(payload);
  }

  pagarConTarjeta() {
    if (this.cargando) return;
    if (!this.monederoSeleccionado) {
      this.alerts.open({
        type: 'warning',
        title: '¡Atención!',
        message: 'Por favor seleccione un monedero.',
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    // Cargar NetpayJS y mostrar el formulario
    this.loadNetpayScript().then(() => {
      this.abrirDialogNetpay();
    }).catch(error => {
      this.alerts.open({
        type: 'error',
        title: '¡Error!',
        message: 'No se pudo cargar el sistema de pagos. Por favor, intente nuevamente.',
        confirmText: 'Entendido',
        backdropClose: false
      });
    });
  }

  private loadNetpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verificar si NetPay ya está cargado
      if ((window as any).NetPay) {
        resolve();
        return;
      }

      // Verificar si el script ya existe
      const existing = document.getElementById('netpay-sdk') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }

      // Crear y cargar el script
      const script = document.createElement('script');
      script.id = 'netpay-sdk';
      script.type = 'text/javascript';
      script.src = 'https://docs.netpay.mx/cdn/v1.3/netpay.min.js';
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  private abrirDialogNetpay() {
    const dialogRef = this.dialog.open(NetpayDialogComponent, {
      width: '600px',
      disableClose: true,
      data: {
        monto: this.monto,
        monederoSerie: this.getNumeroSerieMonedero(),
        customerId: this.monederoSeleccionado?.customerId,
        direccionesDisponibles: this.direccionesDisponibles // Pasar las direcciones ya obtenidas
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.token && result.deviceFingerPrint && result.deviceInformation) {
        // Guardar información de la tarjeta para usar en la transacción
        this.tarjetaInfo = {
          tokenCard: result.token,
          deviceFingerPrint: result.deviceFingerPrint,
          deviceInformation: result.deviceInformation,
          idDireccion: result.clienteInfo?.idDireccion || null
        };
        
        // Asegurar que el token esté completamente procesado antes de crear el cliente
        setTimeout(() => {
          // Solo crear el cliente si es necesario, NO procesar el pago (charge)
          this.crearClienteSiEsNecesario(result.token, result.deviceFingerPrint, result.deviceInformation, result.clienteInfo, result.referenceId);
        }, 100); // Pequeño delay para asegurar que todo esté procesado
      }
    });
  }

  private crearClienteSiEsNecesario(token: string, deviceFingerPrint: string, deviceInformation: any, clienteInfo?: any, referenceId?: string) {
    // Validar que el token esté completamente listo antes de proceder
    if (!token || token.trim() === '') {
      this.alerts.open({
        type: 'error',
        title: '¡Error!',
        message: 'El token de la tarjeta no está disponible. Por favor, intente nuevamente.',
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    this.cargando = true;

    // Verificar si el monedero tiene customerId null
    const monedero = this.monederoSeleccionado;
    const customerId = monedero?.customerId;

    // Si customerId es null, crear el cliente (solo después de que el token esté listo)
    if (customerId === null || customerId === undefined) {
      this.crearClienteNetpay(token, monedero, clienteInfo, referenceId).subscribe(
        (response: any) => {
          // Obtener el customerId de la respuesta
          const nuevoCustomerId = response?.customerId || response?.data?.customerId || response?.id;
          
          if (nuevoCustomerId) {
            // Actualizar el customerId en el monedero seleccionado
            if (this.monederoSeleccionado) {
              this.monederoSeleccionado.customerId = nuevoCustomerId;
            }
            
            this.cargando = false;
            
            // Obtener las tarjetas actualizadas
            this.obtenerTarjetas(nuevoCustomerId);
            
            this.alerts.open({
              type: 'success',
              title: '¡Operación Exitosa!',
              message: 'Tarjeta tokenizada y cliente creado correctamente.',
              confirmText: 'Entendido',
              backdropClose: false
            });
          } else {
            this.cargando = false;
            
            this.alerts.open({
              type: 'warning',
              title: '¡Atención!',
              message: 'Cliente creado pero no se pudo obtener el ID del cliente. Por favor, verifique manualmente.',
              confirmText: 'Entendido',
              backdropClose: false
            });
          }
        },
        (error: any) => {
          this.cargando = false;
          
          // Construir mensaje de error detallado
          let errorMessage = 'Ocurrió un error al crear el cliente en Netpay.';
          
          if (error?.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.error?.error) {
              errorMessage = error.error.error;
            } else {
              errorMessage = JSON.stringify(error.error, null, 2);
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }
          
          // Mostrar también el status code
          const statusInfo = error?.status ? ` (Status: ${error.status})` : '';
          errorMessage = `${errorMessage}${statusInfo}`;
          
          this.alerts.open({
            type: 'error',
            title: '¡Error!',
            message: errorMessage,
            confirmText: 'Entendido',
            backdropClose: false
          });
        }
      );
    } else {
      // Si ya tiene customerId, actualizar el token del cliente
      this.actualizarTokenCliente(customerId, token, clienteInfo, referenceId).subscribe(
        (response: any) => {
          this.cargando = false;
          
          // Obtener las tarjetas actualizadas después de agregar la nueva tarjeta
          this.obtenerTarjetas(customerId);
          
          this.alerts.open({
            type: 'success',
            title: '¡Operación Exitosa!',
            message: 'Tarjeta tokenizada y actualizada correctamente.',
            confirmText: 'Entendido',
            backdropClose: false
          });
        },
        (error: any) => {
          this.cargando = false;
          
          // Construir mensaje de error detallado
          let errorMessage = 'Ocurrió un error al actualizar el token de la tarjeta.';
          
          if (error?.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.error?.error) {
              errorMessage = error.error.error;
            } else {
              errorMessage = JSON.stringify(error.error, null, 2);
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }
          
          const statusInfo = error?.status ? ` (Status: ${error.status})` : '';
          errorMessage = `${errorMessage}${statusInfo}`;
          
          this.alerts.open({
            type: 'error',
            title: '¡Error!',
            message: errorMessage,
            confirmText: 'Entendido',
            backdropClose: false
          });
        }
      );
    }
  }

  private actualizarTokenCliente(customerId: string, token: string, clienteInfo?: any, referenceId?: string) {
    let tokenData: any;
    
    if (clienteInfo) {
      // Usar la información del formulario de tokenización
      tokenData = {
        customerId: String(customerId),
        token: token,
        preAuth: false,
        nombre: clienteInfo.nombre,
        apellidoPaterno: clienteInfo.apellidoPaterno,
        apellidoMaterno: clienteInfo.apellidoMaterno,
        email: clienteInfo.email,
        telefono: clienteInfo.telefono,
        idDireccion: clienteInfo.idDireccion || null
      };
      
      // Agregar referenceId si existe
      if (referenceId) {
        tokenData.referenceId = referenceId;
      }
      
      // Solo enviar direccion si existe (cuando es nueva dirección)
      if (clienteInfo.direccion) {
        tokenData.direccion = clienteInfo.direccion;
      }
    } else {
      // Compatibilidad hacia atrás: usar solo los campos básicos
      tokenData = {
        customerId: String(customerId),
        token: token,
        preAuth: false,
        // Campos adicionales con valores por defecto si no hay clienteInfo
        nombre: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        email: '',
        telefono: '',
        idDireccion: null,
        direccion: {
          ciudad: '',
          pais: 'MX',
          CP: '',
          estado: '',
          calle: '',
          calleEsquina: ''
        }
      };
    }

    return this.netpayService.actualizarTokenCliente(customerId, tokenData);
  }

  private crearClienteNetpay(token: string, monedero: any, clienteInfo?: any, referenceId?: string) {
    // Si clienteInfo está disponible, usar esa información; de lo contrario, usar los datos del monedero
    let customerData: any;
    
    if (clienteInfo) {
      // Usar la información del formulario de tokenización con el formato completo
      customerData = {
        token: token,
        preAuth: false,
        nombre: clienteInfo.nombre,
        apellidoPaterno: clienteInfo.apellidoPaterno,
        apellidoMaterno: clienteInfo.apellidoMaterno,
        email: clienteInfo.email,
        telefono: clienteInfo.telefono,
        idDireccion: clienteInfo.idDireccion || null,
        idPasajero: monedero?.idPasajero || null
      };
      
      // Agregar referenceId si existe
      if (referenceId) {
        customerData.referenceId = referenceId;
      }
      
      // Solo enviar direccion si existe (cuando es nueva dirección)
      if (clienteInfo.direccion) {
        customerData.direccion = clienteInfo.direccion;
      }
    } else {
      // Usar los datos del monedero (compatibilidad hacia atrás)
      customerData = {
        firstName: monedero?.pasajeroNombre || '',
        lastName: monedero?.pasajeroApellidoPaterno || '',
        email: monedero?.correoUsuario || '',
        phone: monedero?.telefonoUsuario || '',
        token: token,
        idPasajero: monedero?.idPasajero || null
      };
    }

    return this.netpayService.crearCliente(customerData);
  }

  // Variables para el swipe
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private currentSwipeX: number = 0;
  private swipeThreshold: number = -80; // Umbral para revelar el botón de eliminar
  private swipeMaxDistance: number = -100; // Máxima distancia de deslizamiento

  onSwipeStart(event: any, tarjeta: any, index: number) {
    // Cerrar otras tarjetas que puedan estar abiertas
    this.tarjetasCliente.forEach((t, i) => {
      if (i !== index && t._swipeX !== 0) {
        t._swipeX = 0;
      }
    });

    const touch = event.touches ? event.touches[0] : event;
    this.swipeStartX = touch.clientX;
    this.swipeStartY = touch.clientY;
    this.currentSwipeX = tarjeta._swipeX || 0;
    tarjeta._isSwiping = true;

    // Prevenir scroll durante el swipe
    if (event.touches) {
      event.preventDefault();
    }

    // Event listeners para mouse
    if (!event.touches) {
      const onMouseMove = (e: MouseEvent) => this.onSwipeMove(e, tarjeta);
      const onMouseUp = (e: MouseEvent) => {
        this.onSwipeEnd(e, tarjeta);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    } else {
      // Event listeners para touch
      const onTouchMove = (e: TouchEvent) => this.onSwipeMove(e, tarjeta);
      const onTouchEnd = (e: TouchEvent) => {
        this.onSwipeEnd(e, tarjeta);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
      };
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
    }
  }

  onSwipeMove(event: any, tarjeta: any) {
    if (!tarjeta._isSwiping) return;

    const touch = event.touches ? event.touches[0] : event;
    const deltaX = touch.clientX - this.swipeStartX;
    const deltaY = touch.clientY - this.swipeStartY;

    // Si el movimiento es más vertical que horizontal, no hacer swipe
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 10) {
      return;
    }

    // Solo permitir deslizar hacia la izquierda
    let newX = this.currentSwipeX + deltaX;
    if (newX > 0) {
      newX = 0;
    } else if (newX < this.swipeMaxDistance) {
      newX = this.swipeMaxDistance;
    }

    tarjeta._swipeX = newX;

    // Prevenir scroll durante el swipe horizontal
    if (Math.abs(deltaX) > 10) {
      event.preventDefault();
    }
  }

  onSwipeEnd(event: any, tarjeta: any) {
    tarjeta._isSwiping = false;

    // Si se deslizó más allá del umbral, mostrar modal de confirmación
    if (tarjeta._swipeX < this.swipeThreshold) {
      tarjeta._swipeX = this.swipeMaxDistance;
      // Pequeño delay para que se vea la animación antes de abrir el modal
      setTimeout(() => {
        this.confirmarEliminarTarjeta(tarjeta);
      }, 200);
    } else {
      // Si no, volver a la posición inicial
      tarjeta._swipeX = 0;
    }
  }

  onTarjetaClick(tarjeta: any) {
    // Si la tarjeta está abierta, cerrarla en lugar de seleccionarla
    if (tarjeta._swipeX !== 0) {
      tarjeta._swipeX = 0;
      return;
    }
    
    // Si no está abierta, seleccionarla
    this.seleccionarTarjeta(tarjeta);
  }

  confirmarEliminarTarjeta(tarjeta: any) {
    const lastFour = tarjeta.card?.lastFourDigits || '****';
    const bank = tarjeta.card?.bank || 'desconocido';
    
    this.alerts.open({
      type: 'warning',
      title: '¿Eliminar tarjeta?',
      message: `
        <div style="text-align: center;">
          <p style="font-size: 16px; margin-bottom: 16px;">
            ¿Estás seguro de que deseas eliminar esta tarjeta?
          </p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 4px 0; color: #374151;">
              <strong>Banco:</strong> ${bank}
            </p>
            <p style="margin: 4px 0; color: #374151;">
              <strong>Últimos 4 dígitos:</strong> **** ${lastFour}
            </p>
          </div>
          <p style="color: #dc2626; font-size: 14px;">
            <i class="fa fa-exclamation-triangle"></i>
            Esta acción no se puede deshacer
          </p>
        </div>
      `,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      backdropClose: false,
      showCancel: true
    }).then((result: any) => {
      const confirmed = typeof result === 'string' ? result : result?.result;
      if (confirmed === 'confirm') {
        this.eliminarTarjeta(tarjeta);
      } else {
        // Si cancela, cerrar la tarjeta deslizada
        tarjeta._swipeX = 0;
      }
    });
  }

  eliminarTarjeta(tarjeta: any) {
    const customerId = this.monederoSeleccionado?.customerId;
    // Usar el atributo 'source' que es el token de la tarjeta
    const tokenCard = tarjeta.source || tarjeta.card?.token;
    
    if (!customerId || !tokenCard) {
      this.alerts.open({
        type: 'error',
        title: '¡Error!',
        message: 'No se pudo obtener la información necesaria para eliminar la tarjeta.',
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    // Cerrar el swipe de la tarjeta
    tarjeta._swipeX = 0;
    tarjeta._isSwiping = false;

    this.cargando = true;
    
    this.netpayService.eliminarTarjeta(customerId, tokenCard).subscribe(
      () => {
        this.cargando = false;
        
        // Si la tarjeta eliminada estaba seleccionada, limpiar la selección
        if (this.tarjetaSeleccionada === tarjeta) {
          this.tarjetaSeleccionada = null;
        }
        
        // Actualizar la lista de tarjetas
        this.obtenerTarjetas(customerId);
        
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'La tarjeta ha sido eliminada correctamente.',
          confirmText: 'Entendido',
          backdropClose: false
        });
      },
      (error: any) => {
        this.cargando = false;
        
        let errorMessage = 'Ocurrió un error al eliminar la tarjeta.';
        
        if (error?.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        this.alerts.open({
          type: 'error',
          title: '¡Error!',
          message: errorMessage,
          confirmText: 'Entendido',
          backdropClose: false
        });
      }
    );
  }

  cancelar() {
    this.step = 1;
    this.query = '';
    this.monto = 0;
    this.montoView = '';
    this.monederoSeleccionado = null;
    this.monederosFiltrados = [...this.monederos];
    this.pageIndex = 0;
    this.aplicarPaginacion();
  }

  public listaMonederos: any[] = [];
  public listaMonederosFiltrados: any[] = [];
  monederoSeleccionado: any = null;
  tarjetasCliente: any[] = [];
  cargandoTarjetas: boolean = false;
  direccionesDisponibles: any[] = [];

  obtenerMonederos() {
    this.moneService.obtenerMonederos().subscribe((response) => {
      this.listaMonederos = response?.data ?? [];
      this.listaMonederosFiltrados = [...this.listaMonederos];
    });
  }

  filtrarMonederos() {
    const q = (this.query || '').toLowerCase().trim();
    if (!q) {
      this.listaMonederosFiltrados = [...this.listaMonederos];
    } else {
      this.listaMonederosFiltrados = this.listaMonederos.filter((m) =>
        `${m.numeroSerie || m.serie || ''} ${m.nombreCompletoPasajero || ''} ${m.clienteNombre || m.nombreCompletoCliente || ''}`
          .toLowerCase()
          .includes(q)
      );
    }
  }

  regresar() {
    this.route.navigateByUrl('/administracion/transacciones');
  }

  agregar(payload: any) {
    this.cargando = true;
    this.transaccionService.agregarRecarga(payload).subscribe(
      (_response: any) => {
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se realizo la recarga de manera correcta.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.cargando = false;
        this.regresar();
      },
      (_error: any) => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al agregar la transacción.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.cargando = false;
      }
    );
  }

  getNombrePasajero(m: any): string {
    if (!m) return '—';
    const nombreCompleto = (m.nombreCompletoPasajero || '').trim();
    const porPartes = (
      (m.pasajeroNombre || '') +
      ' ' +
      (m.pasajeroApellidoPaterno || '') +
      ' ' +
      (m.pasajeroApellidoMaterno || '')
    )
      .replace(/\s+/g, ' ')
      .trim();
    const simple = (m.pasajero || '').trim();

    const final = nombreCompleto || porPartes || simple;
    return final || '—'; 
  }

  hasPasajero(m: any): boolean {
    if (!m) return false;
    return !!(
      (m.nombreCompletoPasajero && m.nombreCompletoPasajero.trim()) ||
      (m.pasajero && m.pasajero.trim()) ||
      (
        (m.pasajeroNombre || '') +
        (m.pasajeroApellidoPaterno || '') +
        (m.pasajeroApellidoMaterno || '')
      ).trim()
    );
  }
}
