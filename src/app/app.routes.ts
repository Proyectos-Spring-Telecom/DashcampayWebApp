import { AuthGuard } from './core/guards/auth.guard';
import { DashboardPermissionGuard } from './core/guards/dashboard-permission.guard';
import { LayoutComponent } from './layouts/layout/layout.component';
import { VexRoutes } from '@vex/interfaces/vex-route.interface';

export const appRoutes: VexRoutes = [
  // 🔹 Redirección automática al login al iniciar la app
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/pages/auth/login/login.component').then(
        (m) => m.LoginComponent
      )
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/pages/auth/register/register.component').then(
        (m) => m.RegisterComponent
      )
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./pages/pages/auth/signup/signup.component').then(
        (m) => m.SignupComponent
      )
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import(
        './pages/pages/auth/forgot-password/forgot-password.component'
      ).then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'coming-soon',
    loadComponent: () =>
      import('./pages/pages/coming-soon/coming-soon.component').then(
        (m) => m.ComingSoonComponent
      )
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboards/analytics',
        redirectTo: '/',
        pathMatch: 'full'
      },
      {
        path: '',
        loadComponent: () =>
          import(
            './pages/dashboards/dashboard-analytics/dashboard-analytics.component'
          ).then((m) => m.DashboardAnalyticsComponent)
      },
      {
        path: 'administracion',
        children: [
          {
            path: 'validadores',
            loadChildren: () => import('./pages/administracion/dispositivos/dispositivos.module')
              .then(m => m.DispositivosModule)
          },
          {
            path: 'vehiculos',
            loadChildren: () => import('./pages/administracion/vehiculos/vehiculos.module')
              .then(m => m.VehiculosModule)
          },
          {
            path: 'operadores',
            loadChildren: () => import('./pages/administracion/operadores/operadores.module')
              .then(m => m.OperadoresModule)
          },
          {
            path: 'monederos',
            loadChildren: () => import('./pages/administracion/monederos/monederos.module')
              .then(m => m.MonederosModule)
          },
          {
            path: 'pasajeros',
            loadChildren: () => import('./pages/administracion/pasajeros/pasajeros.module')
              .then(m => m.PasajerosModule)
          },
          {
            path: 'tipos-pasajero',
            loadComponent: () => import('./pages/administracion/tipos-pasajero/tipos-pasajero.component')
              .then(m => m.TiposPasajeroComponent)
          },
          {
            path: 'tipos-pasajero/registrar',
            loadComponent: () => import('./pages/administracion/tipos-pasajero/registrar-tipo-pasajero/registrar-tipo-pasajero.component')
              .then(m => m.RegistrarTipoPasajeroComponent)
          },
          {
            path: 'tipos-pasajero/editar/:id',
            loadComponent: () => import('./pages/administracion/tipos-pasajero/registrar-tipo-pasajero/registrar-tipo-pasajero.component')
              .then(m => m.RegistrarTipoPasajeroComponent)
          },
          {
            path: 'transacciones',
            loadChildren: () => import('./pages/administracion/transacciones/transacciones.module')
              .then(m => m.TransaccionesModule)
          },
          {
            path: 'bitacora',
            loadChildren: () => import('./pages/administracion/bitacora/bitacora.module')
              .then(m => m.BitacoraModule)
          },
          {
            path: 'perfil-usuario',
            loadChildren: () => import('./pages/administracion/usuarios/perfil-usuario/perfil-usuario.module')
              .then(m => m.PerfilUsuarioModule)
          },
          {
            path: 'usuarios',
            loadChildren: () => import('./pages/administracion/usuarios/usuarios.module')  
              .then(m => m.UsuariosModule)
          },
          {
            path: 'clientes',
            loadChildren: () => import('./pages/administracion/clientes/clientes.module')  
              .then(m => m.ClientesModule)
          },
          {
            path: 'talleres',
            loadChildren:() => import('./pages/administracion/talleres/talleres.module')
              .then(m => m.TalleresModule)
          },
          {
            path: 'mantenimientos',
            loadChildren:() => import('./pages/administracion/mantenimientos/mantenimientos.module')
              .then(m => m.MantenimientosModule)
          },
          {
            path: 'verificaciones',
            loadChildren:() => import('./pages/administracion/verificaciones/verificaciones.module')
              .then(m => m.VerificacionesModule)
          },
          {
            path: 'incidentes',
            loadChildren:() => import('./pages/administracion/incidentes/incidentes.module')
              .then(m => m.IncidentesModule)
          },
          {
            path: 'permisos',
            loadChildren:() => import('./pages/administracion/permisos/permisos.module')
              .then(m => m.PermisosModule)
          },
          {
            path: 'modulos',
            loadChildren:() => import('./pages/administracion/modulos/modulos.module')
              .then(m => m.ModulosModule)
          },
          {
            path: 'contadora',
            loadChildren:() => import('./pages/administracion/contador/contador.module')
              .then(m => m.ContadorModule)
          },
          {
            path: 'rutas',
            loadChildren:() => import('./pages/administracion/rutas/rutas.module')
              .then(m => m.RutasModule)
          },
          {
            path: 'monitoreo',
            loadChildren:() => import('./pages/administracion/monitoreo/monitoreo.module')
              .then(m => m.MonitoreoModule)
          },
          {
            path: 'dashboard',
            canActivate: [DashboardPermissionGuard],
            loadChildren:() => import('./pages/administracion/dashboard/dashboard.module')
              .then(m => m.DashboardModule)
          },
          {
            path: 'roles',
            loadChildren:() => import('./pages/administracion/roles/roles.module')
              .then(m => m.RolesModule)
          },
          {
            path: 'punto-venta',
            loadChildren:() => import('./pages/administracion/punto-venta/punto-venta.module')
              .then(m => m.PuntoVentaModule)
          },
          {
            path: 'variantes',
            loadChildren:() => import('./pages/administracion/variantes/variantes.module')
              .then(m => m.VariantesModule)
          },
          {
            path: 'transbordos',
            loadChildren:() => import('./pages/administracion/transbordos/transbordos.module')
              .then(m => m.TransbordosModule)
          },
          {
            path: 'zonas',
            loadChildren:() => import('./pages/administracion/zonas/zonas.module')
              .then(m => m.ZonasModule)
          },
          {
            path: 'instalaciones',
            loadChildren:() => import('./pages/administracion/instalacion/instalacion.module')
              .then(m => m.InstalacionModule)
          },
          {
            path: 'reportes',
            loadChildren:() => import('./pages/administracion/reportes/reportes.module')
              .then(m => m.ReportesModule)
          },
          {
            path: 'tarifas',
            loadChildren:() => import('./pages/administracion/tarifas/tarifas.module')
              .then(m => m.TarifasModule)
          },
          {
            path: 'turnos',
            loadChildren:() => import('./pages/administracion/turnos/turnos.module')
              .then(m => m.TurnosModule)
          },
          {
            path: 'bitacora-viajes',
            loadChildren:() => import('./pages/administracion/bitacora-viajes/bitacora-viajes.module')
              .then(m => m.BitacoraViajesModule)
          },
          {
            path: 'perfil-pasajero',
            loadChildren:() => import('./pages/administracion/perfil-pasajero/perfil-pasajero.module')
              .then(m => m.PerfilPasajeroModule)
          }
        ]
      },
      {
        path: 'pages',
        children: [
          {
            path: 'error-404',
            loadComponent: () =>
              import('./pages/pages/errors/error-404/error-404.component').then(
                (m) => m.Error404Component
              )
          },
          {
            path: 'error-500',
            loadComponent: () =>
              import('./pages/pages/errors/error-500/error-500.component').then(
                (m) => m.Error500Component
              )
          }
        ]
      },
      {
        path: '**',
        loadComponent: () =>
          import('./pages/pages/errors/error-404/error-404.component').then(
            (m) => m.Error404Component
          )
      }
    ]
  }
];
