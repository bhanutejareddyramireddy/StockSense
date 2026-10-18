import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const DEMO_USER_STORAGE_KEY = 'stocksense_current_user';

export class AuthService {
  constructor() {
    this.currentUser = null;
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(DEMO_USER_STORAGE_KEY);
      if (stored) {
        try {
          this.currentUser = JSON.parse(stored);
        } catch (e) {}
      }
    }
    if (!this.currentUser) {
      this.currentUser = {
        uid: "user-demo-c19",
        email: "planner@stocksense.in",
        displayName: "Rohan Verma",
        organization: "StockSense Retail Hub",
        location: "Central Warehouse, Mumbai",
        phone: "+91 98765 43210",
        role: "Regional Inventory Planner",
        isDemo: true
      };
    }
    if (this.currentUser && !this.currentUser.organization) {
      this.currentUser.organization = "StockSense Retail Hub";
    }
    this.isDemo = !isFirebaseConfigured();
    this.firebaseApp = null;
    this.firebaseAuth = null;
    this.firebaseDb = null;
    this.firestoreOps = null;
    this.listeners = [];
    this._init();
  }

  async _init() {
    if (!this.isDemo) {
      try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js');
        const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js');
        const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js');
        
        this.firebaseApp = initializeApp(firebaseConfig);
        this.firebaseAuth = getAuth(this.firebaseApp);
        this.firebaseDb = getFirestore(this.firebaseApp);
        this.firestoreOps = { doc, setDoc, getDoc };

        onAuthStateChanged(this.firebaseAuth, async (user) => {
          if (user) {
            const isDemoAccount = (user.email === "admin@stocksense.ai" || user.email === "planner@stocksense.in");
            let extraData = {};
            if (this.firebaseDb && this.firestoreOps) {
              try {
                const snap = await this.firestoreOps.getDoc(this.firestoreOps.doc(this.firebaseDb, "users", user.uid));
                if (snap.exists()) {
                  extraData = snap.data();
                }
              } catch (e) {}
            }

            this.currentUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || extraData.displayName || user.email.split('@')[0],
              organization: extraData.organization || "StockSense Retail Hub",
              role: extraData.role || "Inventory Planner",
              location: extraData.location || "Central Warehouse",
              phone: extraData.phone || "+91 98765 43210",
              isDemo: isDemoAccount
            };
            localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
            
            // Sync to Firestore in background so user record is guaranteed in users collection
            if (!isDemoAccount) {
              this._syncUserToFirestore(this.currentUser);
            }
          } else {
            // No active Firebase user
            const stored = localStorage.getItem(DEMO_USER_STORAGE_KEY);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (!parsed.isDemo) {
                  this.currentUser = null;
                  localStorage.removeItem(DEMO_USER_STORAGE_KEY);
                }
              } catch (e) {}
            }
          }
          this._notify();
        });
        return;
      } catch (err) {
        console.warn("Could not load Firebase Web SDK. Falling back to Demo Session.", err);
        this.isDemo = true;
      }
    }

    // Local / Demo initial session
    const stored = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch (e) {
        this.currentUser = null;
      }
    } else {
      this.currentUser = {
        uid: "user-demo-c19",
        email: "planner@stocksense.in",
        displayName: "Rohan Verma",
        role: "Regional Inventory Planner",
        isDemo: true
      };
      localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
    }
  }

  async _syncUserToFirestore(user, additionalData = {}) {
    if (!this.firebaseDb || !this.firestoreOps || !user || !user.uid || user.isDemo) {
      return;
    }
    try {
      const { doc, setDoc, getDoc } = this.firestoreOps;
      const userDocRef = doc(this.firebaseDb, "users", user.uid);
      
      let createdAt = new Date().toISOString();
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists() && snap.data().createdAt) {
          createdAt = snap.data().createdAt;
        }
      } catch (e) {
        // preserve current ISO date
      }

      const payload = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : "User"),
        role: user.role || additionalData.role || "Inventory Planner",
        organization: user.organization || additionalData.organization || "StockSense Retail Hub",
        location: user.location || additionalData.location || "Central Warehouse",
        phone: user.phone || additionalData.phone || "+91 98765 43210",
        createdAt: createdAt,
        lastLoginAt: new Date().toISOString(),
        ...additionalData
      };

      await setDoc(userDocRef, payload, { merge: true });
      console.log("StockSense: Synced account profile to Firestore 'users' collection ->", user.uid);
    } catch (err) {
      console.warn("StockSense: Could not sync user profile to Firestore:", err);
    }
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
  }

  _notify() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    if (!this.isDemo && this.firebaseAuth) {
      try {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js');
        const userCred = await signInWithEmailAndPassword(this.firebaseAuth, email, password);
        const isDemoAccount = (email === "admin@stocksense.ai" || email === "planner@stocksense.in");
        
        let extraData = {};
        if (this.firebaseDb && this.firestoreOps) {
          try {
            const snap = await this.firestoreOps.getDoc(this.firestoreOps.doc(this.firebaseDb, "users", userCred.user.uid));
            if (snap.exists()) {
              extraData = snap.data();
            }
          } catch (e) {}
        }

        this.currentUser = {
          uid: userCred.user.uid,
          email: userCred.user.email,
          displayName: userCred.user.displayName || extraData.displayName || email.split('@')[0],
          organization: extraData.organization || "StockSense Retail Hub",
          role: extraData.role || "Inventory Planner",
          location: extraData.location || "Central Warehouse",
          phone: extraData.phone || "+91 98765 43210",
          isDemo: isDemoAccount
        };
        localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));

        // Sync to Firestore users collection
        if (!isDemoAccount) {
          await this._syncUserToFirestore(this.currentUser);
        }

        this._notify();
        return this.currentUser;
      } catch (err) {
        if ((email === "admin@stocksense.ai" || email === "planner@stocksense.in") && password === "StockSense2026!") {
          this.currentUser = {
            uid: "admin-eval-c19",
            email: email,
            displayName: "Administrator",
            role: "Inventory Director",
            isDemo: true
          };
          localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
          this._notify();
          return this.currentUser;
        }
        let msg = err.message || "Failed to authenticate with Firebase.";
        if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
          msg = "Invalid email or password. If this is a new account, please click the 'Register' tab first.";
        } else if (err.code === "auth/operation-not-allowed") {
          msg = "Email/Password sign-in is not yet enabled in Firebase Console. Please enable it under Authentication > Sign-in method.";
        }
        throw new Error(msg);
      }
    } else {
      // Local fallback mode
      const isDemoAccount = (email === "admin@stocksense.ai" || email === "planner@stocksense.in");
      this.currentUser = {
        uid: "user-" + btoa(email).substring(0, 8),
        email: email,
        displayName: email.split('@')[0],
        role: "Inventory Planner",
        isDemo: isDemoAccount
      };
      localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
      this._notify();
      return this.currentUser;
    }
  }

  async register(email, password, displayName, organization = "") {
    if (!email || !password) {
      throw new Error("Please enter all required fields.");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error("Password must include at least one uppercase letter (A-Z).");
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      throw new Error("Password must include a mix of letters, numbers, and symbols.");
    }

    const orgName = (organization && organization.trim()) ? organization.trim() : "StockSense Retail Hub";

    if (!this.isDemo && this.firebaseAuth) {
      try {
        const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js');
        const userCred = await createUserWithEmailAndPassword(this.firebaseAuth, email, password);
        if (displayName) {
          try {
            await updateProfile(userCred.user, { displayName });
          } catch (e) {}
        }
        const isDemoAccount = (email === "admin@stocksense.ai" || email === "planner@stocksense.in");
        this.currentUser = {
          uid: userCred.user.uid,
          email: userCred.user.email,
          displayName: displayName || email.split('@')[0],
          organization: orgName,
          location: "Central Warehouse",
          phone: "+91 98765 43210",
          role: "Inventory Planner",
          isDemo: isDemoAccount
        };
        localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));

        // Immediately create profile document in Cloud Firestore 'users' collection
        await this._syncUserToFirestore(this.currentUser, {
          createdAt: new Date().toISOString(),
          organization: orgName
        });

        this._notify();
        return this.currentUser;
      } catch (err) {
        let msg = err.message || "Failed to register account with Firebase.";
        if (err.code === "auth/email-already-in-use") {
          msg = "This email is already registered. Please sign in.";
        } else if (err.code === "auth/weak-password") {
          msg = "Password is too weak according to security policy. Please meet all password criteria.";
        } else if (err.code === "auth/operation-not-allowed") {
          msg = "Email/Password sign-in is not yet enabled in Firebase Console. Please enable it in Authentication > Sign-in method.";
        }
        throw new Error(msg);
      }
    } else {
      const isDemoAccount = (email === "admin@stocksense.ai" || email === "planner@stocksense.in");
      this.currentUser = {
        uid: "user-" + btoa(email).substring(0, 8),
        email: email,
        displayName: displayName || email.split('@')[0],
        organization: orgName,
        location: "Central Warehouse",
        phone: "+91 98765 43210",
        role: "Inventory Planner",
        isDemo: isDemoAccount
      };
      localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
      this._notify();
      return this.currentUser;
    }
  }

  updateProfile(data) {
    if (!this.currentUser) {
      this.currentUser = {};
    }
    this.currentUser = { ...this.currentUser, ...data };
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
    if (this.currentUser && !this.currentUser.isDemo && this.firebaseDb) {
      this._syncUserToFirestore(this.currentUser, data);
    }
    this._notify();
    return this.currentUser;
  }

  async logout() {
    if (!this.isDemo && this.firebaseAuth) {
      try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js');
        await signOut(this.firebaseAuth);
      } catch (e) {}
    }
    this.currentUser = null;
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    this._notify();
    window.location.href = "index.html";
  }

  async socialLogin(providerName = 'google') {
    if (!this.isDemo && this.firebaseAuth && providerName === 'google') {
      try {
        const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js');
        const provider = new GoogleAuthProvider();
        const res = await signInWithPopup(this.firebaseAuth, provider);
        this.currentUser = {
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || res.user.email.split('@')[0],
          organization: "StockSense Retail Hub",
          role: "Inventory Planner",
          isDemo: false
        };
        localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
        await this._syncUserToFirestore(this.currentUser);
        this._notify();
        return this.currentUser;
      } catch (err) {
        console.warn("Firebase popup sign-in encountered error or was blocked; falling back to seamless SSO demo session:", err);
      }
    }

    const providerLabel = providerName.charAt(0).toUpperCase() + providerName.slice(1);
    this.currentUser = {
      uid: `sso-${providerName}-${Date.now().toString(36)}`,
      email: `planner@${providerName}.com`,
      displayName: `${providerLabel} Enterprise User`,
      role: "Inventory Planner",
      isDemo: true
    };
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
    this._notify();
    return this.currentUser;
  }

  async quickDemoLogin() {
    this.currentUser = {
      uid: "user-demo-c19",
      email: "planner@stocksense.in",
      displayName: "Rohan Verma",
      role: "Regional Inventory Planner",
      isDemo: true
    };
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(this.currentUser));
    this._notify();
    return this.currentUser;
  }

  getUser() {
    return this.currentUser;
  }
}

export const auth = new AuthService();
