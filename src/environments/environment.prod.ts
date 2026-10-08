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
