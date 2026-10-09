// Entorno de desarrollo. `ng build --configuration production` lo reemplaza por
// environment.prod.ts (fileReplacements en angular.json). V2-19: antes no había
// reemplazo y este archivo, que apuntaba a la API de producción, se usaba siempre.

export const environment = {
  production: false,
  stripe_token: 'STRIPE_TOKEN',
  paypal_token: 'PAYPAL_TOKEN',
  API_SECURITY: 'https://dashcampay.com/apidev',
  //API_SECURITY:'http://localhost:3000',
  NETPAY_PUBLIC_KEY: 'pk_netpay_YbahDkYgsFmUhIFYNzijoIqDJ',
  // Debe coincidir con NETPAY_ENVIRONMENT de la API a la que apunta.
  NETPAY_SANDBOX: true,
  defaultauth: 'fackbackend',
  // H-43: la key de Google Maps se centraliza aquí (sigue siendo visible en el
  // navegador por diseño). Restríngela por referrer en Google Cloud y ROTA esta key.
  googleMapsApiKey: 'AIzaSyDOlZGwePQfNGK5JPaRZjjIyj5OhCBezaE',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
