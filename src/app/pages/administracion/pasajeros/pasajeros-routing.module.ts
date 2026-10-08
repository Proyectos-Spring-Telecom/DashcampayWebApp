import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaPasajerosComponent } from './lista-pasajeros/lista-pasajeros.component';
import { AgregarPasajeroComponent } from './agregar-pasajero/agregar-pasajero.component';

const routes: Routes = 
[
  { path: '',
    component: ListaPasajerosComponent
  },
  { path: 'agregar-pasajero',
    component: AgregarPasajeroComponent
  },
  {
    path: 'editar-pasajero/:idPasajero',
    component: AgregarPasajeroComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PasajerosRoutingModule { }
