import { ApplicationConfig, APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { appRoutes } from './app.routes';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi
} from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';  // ✅ NUEVO
import { provideIcons } from './core/icons/icons.provider';
import { provideLuxon } from './core/luxon/luxon.provider';
import { provideVex } from '@vex/vex.provider';
import { provideNavigation } from './core/navigation/navigation.provider';
import { vexConfigs } from '@vex/config/vex-configs';
import { interceptServiceInterceptor } from './pages/pages/auth/login/intercept.service';
import { authRefreshInterceptor } from './core/interceptors/auth-refresh.interceptor';
import { initializeAuthSession } from './core/services/auth-session.initializer';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(
      BrowserModule,
      MatDialogModule,
      MatBottomSheetModule,
      MatNativeDateModule,
      BrowserAnimationsModule,
      MatIconModule  // ✅ NUEVO
    ),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled'
      })
    ),
    provideAnimations(),
    provideHttpClient(
      withInterceptors([interceptServiceInterceptor, authRefreshInterceptor])
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthSession,
      multi: true,
    },

    provideVex({
      config: vexConfigs.poseidon,
      availableThemes: [
        { name: 'Default', className: 'vex-theme-default' },
        { name: 'Teal', className: 'vex-theme-teal' },
        { name: 'Green', className: 'vex-theme-green' },
        { name: 'Purple', className: 'vex-theme-purple' },
        { name: 'Red', className: 'vex-theme-red' },
        { name: 'Orange', className: 'vex-theme-orange' }
      ]
    }),
    provideNavigation(),
    provideIcons(),
    provideLuxon()
  ]
};
