
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const form = document.querySelector(".auth-form");

const nameInput = document.getElementById("teacherName");
const emailInput = document.getElementById("email");
const schoolNameInput = document.getElementById("schoolName");
const schoolCodeInput = document.getElementById("schoolCode");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const submitButton = document.getElementById("registerButton");
const message = document.getElementById("registerMessage");

message.style.marginTop = "15px";
message.style.fontWeight = "600";

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#dc2626" : "#15803d";
}

form.addEventListener("submit", async (event) => {
  console.log("Teacher registration form submitted!");
  event.preventDefault();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const schoolName = schoolNameInput.value.trim();
  const schoolCode = schoolCodeInput.value.trim().toUpperCase();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (password !== confirmPassword) {
    showMessage("Passwords do not match.", true);
    return;
  }

  if (password.length < 6) {
    showMessage("Password must contain at least 6 characters.", true);
    return;
  }

  submitButton.disabled = true;
  showMessage("Submitting registration...");
  console.log("Starting registration process...");


try {
    // 1. Check school code
    const codeRef = doc(db, "schoolCodes", schoolCode);
    const codeSnapshot = await getDoc(codeRef);

    console.log("School code document exists:", codeSnapshot.exists());

    if (!codeSnapshot.exists() || codeSnapshot.data().active !== true) {
      throw new Error("Invalid or inactive school code.");
    }

    console.log("School code data:", codeSnapshot.data());

    const schoolID = codeSnapshot.data().schoolID;

    // 2. Check whether school is active
    const schoolRef = doc(db, "schools", schoolID);
    const schoolSnapshot = await getDoc(schoolRef);

    console.log("School document exists:", schoolSnapshot.exists());

    if (!schoolSnapshot.exists() ||
        schoolSnapshot.data().status !== "active") {
      throw new Error("This school is not active.");
    }

    console.log("School information:", schoolSnapshot.data());

    // 3. Check whether entered school name matches
    if (
      schoolSnapshot.data().schoolName.trim().toLowerCase() !==
      schoolName.toLowerCase()
    ) {
      throw new Error("School name does not match the school code.");
    }

    console.log("School validation successful!");

    // 4. Create teacher authentication account
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const teacherUID = credential.user.uid;

    console.log("Authentication account created:", teacherUID);

    // 5. Create teacher application in Firestore
    await setDoc(doc(db, "teachers", teacherUID), {
      name: name,
      email: credential.user.email,
      schoolID: schoolID,
      schoolCode: schoolCode,
      status: "pending",
      createdAt: serverTimestamp()
    });

    console.log("Teacher profile saved successfully!");

    showMessage(
      "Registration submitted successfully! Please wait for administrator approval."
    );

    form.reset();

  } catch (error) {
    console.error("Teacher registration error:", error);

    let errorMessage = error.message;

    if (error.code === "auth/email-already-in-use") {
      errorMessage = "This email address is already registered.";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Please enter a valid email address.";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "Please use a stronger password.";
    }

    showMessage(errorMessage, true);

  } finally {
    submitButton.disabled = false;
  }
});
