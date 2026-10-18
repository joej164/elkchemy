import { initializeApp } from "firebase/app";
import "./style.css";

const firebaseConfig = {
  apiKey: "AIzaSyAUzpnHJlRDuwoZ8z2R1uUuHeFfSrmoqmc",
  authDomain: "elkchemy.firebaseapp.com",
  projectId: "elkchemy",
  storageBucket: "elkchemy.firebasestorage.app",
  messagingSenderId: "361997464390",
  appId: "1:361997464390:web:5ba33526986023b3b5ab47",
};

let statusMessage = "Initializing\u2026";
let statusOk = false;

try {
  initializeApp(firebaseConfig);
  statusMessage = "Firebase SDK initialized";
  statusOk = true;
} catch (err) {
  statusMessage = `Firebase SDK init failed: ${err.message}`;
}

let count = 0;

document.querySelector("#app").innerHTML = `
  <main>
    <h1>Elkchemy</h1>
    <p class="tagline">Smoke-test deployment</p>

    <div class="card">
      <div id="firebase-status" class="status ${statusOk ? "ok" : "error"}">
        ${statusMessage}
      </div>
      <p class="status-note">SDK initialized only &mdash; no database or backend connection verified.</p>
    </div>

    <div class="card">
      <button id="counter" type="button">Clicked 0 times</button>
    </div>
  </main>
`;

document.querySelector("#counter").addEventListener("click", () => {
  count++;
  document.querySelector("#counter").textContent = `Clicked ${count} time${count === 1 ? "" : "s"}`;
});
