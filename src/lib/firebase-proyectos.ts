// Conexión a la MISMA base de Firestore que usa hoy proyectos-itelsa.itelsasas.com
// (proyecto "tablero-itelsa"). Esto NO es una migración de datos: PayFlow lee y
// escribe en vivo la base real, para que lo que se cargue acá se vea reflejado
// en la app original (y viceversa) mientras ambas convivan.
//
// Credenciales tomadas tal cual del index.html original (ver /tmp/protectos-itelsa
// en el análisis que armó este módulo). La apiKey de Firebase client-side NO es un
// secreto — la seguridad la dan las reglas de Firestore, no esta key — así que es
// seguro tenerla en el bundle del cliente, igual que en la app original.
//
// Client SDK (no Admin SDK) a propósito: todo este módulo corre en componentes
// "use client" con onSnapshot para tiempo real, igual que el original.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB0kfu3MR2AaC9rnP3c3bIa60nfxQ6R9RA",
  authDomain: "tablero-itelsa.firebaseapp.com",
  projectId: "tablero-itelsa",
  storageBucket: "tablero-itelsa.firebasestorage.app",
  messagingSenderId: "1070045066685",
  appId: "1:1070045066685:web:ceaa3d92c300451c148ed4",
};

// Patrón getApps()/getApp() en vez de initializeApp directo: evita el error
// "Firebase App named '[DEFAULT]' already exists" con el hot-reload de Next.js
// en desarrollo (mismo motivo que el patrón models.X || model(...) en Mongoose).
export const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const dbProyectos = getFirestore(fbApp);
