export const environment = {
  production: true,
  stripe_token: 'STRIPE_TOKEN',
  paypal_token: 'PAYPAL_TOKEN',
  // V2-19: producción apunta a la API de producción (antes apuntaba a apidev).
  API_SECURITY: 'https://dashcampay.com/api',
  NETPAY_PUBLIC_KEY: 'pk_netpay_YbahDkYgsFmUhIFYNzijoIqDJ',
  // Debe coincidir con NETPAY_ENVIRONMENT=production de la API y con una llave pública de producción.
  NETPAY_SANDBOX: false,
  defaultauth: 'fackbackend',
  // H-43: la key de Google Maps se centraliza aquí (sigue siendo visible en el
  // navegador por diseño). Restríngela por referrer en Google Cloud y ROTA esta key.
  googleMapsApiKey: 'AIzaSyDOlZGwePQfNGK5JPaRZjjIyj5OhCBezaE',
  firebaseConfig: {
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  }
};
