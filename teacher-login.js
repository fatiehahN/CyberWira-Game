import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const form = document.querySelector(".auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");

// Feedback message
const message = document.createElement("p");
message.style.marginTop = "15px";
message.style.fontWeight = "600";
form.appendChild(message);

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#dc2626" : "#15803d";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  loginButton.disabled = true;
  showMessage("Signing in...");

  try {
    // 1. Authenticate teacher
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const teacherUID = credential.user.uid;

    // 2. Retrieve teacher information
    const teacherRef = doc(db, "teachers", teacherUID);
    const teacherSnapshot = await getDoc(teacherRef);

    if (!teacherSnapshot.exists()) {
      await signOut(auth);
      throw new Error("Teacher account not found.");
    }

    const teacherData = teacherSnapshot.data();

// 3. Check administrator approval
const teacherStatus = String(teacherData.status || "").toLowerCase();
if (teacherStatus !== "approved") {
    await signOut(auth);
    if (teacherStatus === "pending") {
        throw new Error(
            "Your registration is still pending administrator approval."
        );
    }
    if (teacherStatus === "rejected") {
        throw new Error(
            "Your registration was not approved. Please contact the administrator."
        );
    }
    throw new Error(
        "Your account is not authorised to access the dashboard."
    );
}

    // 4. Redirect to dashboard
    window.location.href = "teacher-dashboard.html";

  } catch (error) {
    console.error("Teacher login error:", error);

    let errorMessage = error.message;

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      errorMessage = "Incorrect email or password.";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Please enter a valid email address.";
    } else if (error.code === "auth/too-many-requests") {
      errorMessage = "Too many attempts. Please try again later.";
    }

    showMessage(errorMessage, true);

  } finally {
    loginButton.disabled = false;
  }
});