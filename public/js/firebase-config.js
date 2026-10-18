// StockSense Firebase Web SDK Configuration
// Connected to Firebase Project: stocksense-906b6

export const firebaseConfig = {
  apiKey: "AIzaSyC8I-tUSILZIs7LKdHPF-vltufs6M9ZmNg",
  authDomain: "stocksense-906b6.firebaseapp.com",
  projectId: "stocksense-906b6",
  storageBucket: "stocksense-906b6.firebasestorage.app",
  messagingSenderId: "145887963992",
  appId: "1:145887963992:web:2d3928748c473eddbed32d",
  measurementId: "G-RZ6ZET68SX"
};

// Helper to detect if real Firebase credentials have been configured
export function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes("DEMO_KEY") &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId === "stocksense-906b6"
  );
}
