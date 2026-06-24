// 1. TU CONFIGURACIÓN EXACTA DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCRIkDyaNCz9h4--fA0u2Ctcq5WG5WPcdM",
  authDomain: "partidos-atm-41d3f.firebaseapp.com",
  databaseURL: "https://partidos-atm-41d3f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "partidos-atm-41d3f",
  storageBucket: "partidos-atm-41d3f.firebasestorage.app",
  messagingSenderId: "480203612762",
  appId: "1:480203612762:web:9788ff48c58f456cc42e63"
};

// 2. INICIALIZAR FIREBASE Y FIRESTORE (Formato Compatible con tu App)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 3. AUTENTICACIÓN INVISIBLE (Para cumplir con las reglas estrictas de seguridad)
firebase.auth().signInAnonymously()
    .then(() => {
        console.log("Conexión segura establecida con la base de datos.");
    })
    .catch((error) => {
        console.error("Error al conectar de forma segura:", error);
    });