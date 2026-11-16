
import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Authorised administrator UID
const ADMIN_UID = "0CARYBv1DpRArJvJZOl6GGxpbj43";

// HTML elements
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("adminLoginForm");
const emailInput = document.getElementById("adminEmail");
const passwordInput = document.getElementById("adminPassword");
const loginMessage = document.getElementById("loginMessage");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

const logoutBtn = document.getElementById("logoutBtn");

const schoolForm = document.getElementById("schoolForm");
const schoolNameInput = document.getElementById("schoolName");
const schoolMessage = document.getElementById("schoolMessage");

const schoolCount = document.getElementById("schoolCount");
const teacherCount = document.getElementById("teacherCount");
const pendingCount = document.getElementById("pendingCount");

const schoolsList = document.getElementById("schoolsList");
const teachersList = document.getElementById("teachersList");

// Show or hide sections
function showLogin() {
  loginSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
}

function showDashboard() {
  loginSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
}

// Display messages
function showMessage(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#dc2626" : "#15803d";
}

// Generate random school code
function generateSchoolCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomValues = new Uint8Array(8);

  crypto.getRandomValues(randomValues);

  let code = "CW-";

  for (const value of randomValues) {
    code += characters[value % characters.length];
  }

  return code;
}

// Create HTML text elements safely
function createTextElement(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}

// ADMIN FORGOT PASSWORD
forgotPasswordBtn.addEventListener("click", async () => {

  const email = emailInput.value.trim();

  if (!email) {
    showMessage(
      loginMessage,
      "Please enter your admin email first.",
      true
    );
    return;
  }

  forgotPasswordBtn.disabled = true;

  showMessage(loginMessage, "Sending password reset email...");

  try {
    await sendPasswordResetEmail(auth, email);

    showMessage(
      loginMessage,
      "Password reset email sent! Please check your inbox."
    );

  } catch (error) {
    console.error("Password reset error:", error);

    showMessage(
      loginMessage,
      "Unable to send reset email. Please check your email and try again.",
      true
    );

  } finally {
    forgotPasswordBtn.disabled = false;
  }
});
// ADMIN LOGIN
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  showMessage(loginMessage, "Signing in...");

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);

      showMessage(
        loginMessage,
        "Access denied. Administrator account required.",
        true
      );

      return;
    }

    // onAuthStateChanged will show the dashboard

  } catch (error) {
    console.error("Admin login error:", error);

    showMessage(
      loginMessage,
      "Login failed: " + error.message,
      true
    );
  }
});

// CHECK LOGIN SESSION
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  if (user.uid !== ADMIN_UID) {
    await signOut(auth);
    showLogin();

    showMessage(
      loginMessage,
      "Access denied. Administrator account required.",
      true
    );

    return;
  }

  showDashboard();

  await loadDashboard();
});

// ADMIN LOGOUT
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showLogin();
  } catch (error) {
    console.error("Logout error:", error);
    alert("Unable to log out. Please try again.");
  }
});

// REGISTER NEW SCHOOL
schoolForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const schoolName = schoolNameInput.value.trim();

  if (!schoolName) {
    showMessage(schoolMessage, "Please enter a school name.", true);
    return;
  }

  const submitButton = schoolForm.querySelector('button[type="submit"]');

  if (submitButton) submitButton.disabled = true;

  showMessage(schoolMessage, "Registering school...");

  try {
    // Create school document reference
    const schoolRef = doc(collection(db, "schools"));
    const schoolID = schoolRef.id;

    // Generate unique school code
    let schoolCode;
    let codeRef;
    let uniqueCodeFound = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      schoolCode = generateSchoolCode();
      codeRef = doc(db, "schoolCodes", schoolCode);

      const existingCode = await getDoc(codeRef);

      if (!existingCode.exists()) {
        uniqueCodeFound = true;
        break;
      }
    }

    if (!uniqueCodeFound) {
      throw new Error("Unable to generate a unique school code.");
    }

    // Save school and code together
    const batch = writeBatch(db);

    batch.set(schoolRef, {
      schoolName: schoolName,
      status: "active",
      createdAt: serverTimestamp()
    });

    batch.set(codeRef, {
      schoolID: schoolID,
      active: true
    });

    await batch.commit();

    showMessage(
      schoolMessage,
      `School registered successfully! School Code: ${schoolCode}`
    );

    schoolForm.reset();

    await loadDashboard();

  } catch (error) {
    console.error("School registration error:", error);

    showMessage(
      schoolMessage,
      "Registration failed: " + error.message,
      true
    );

  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

// LOAD DASHBOARD
async function loadDashboard() {
  try {
    const [
      schoolsSnapshot,
      teachersSnapshot,
      codesSnapshot
    ] = await Promise.all([
      getDocs(collection(db, "schools")),
      getDocs(collection(db, "teachers")),
      getDocs(collection(db, "schoolCodes"))
    ]);

    const schools = schoolsSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    const teachers = teachersSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    const codes = codesSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    // Update statistics
    schoolCount.textContent = schools.length;
    teacherCount.textContent = teachers.length;

   pendingCount.textContent = teachers.filter(
  (teacher) => String(teacher.status).toLowerCase() === "pending"
).length;

    // Match school codes with schools
    const codeBySchoolID = {};

    codes.forEach((code) => {
      codeBySchoolID[code.schoolID] = code.id;
    });

    renderSchools(schools, codeBySchoolID);
    renderTeachers(teachers, schools);

  } catch (error) {
    console.error("Dashboard loading error:", error);

    alert(
      "Unable to load dashboard. Please check Firestore permissions. " +
      error.message
    );
  }
}

// DISPLAY REGISTERED SCHOOLS
function renderSchools(schools, codeBySchoolID) {
  schoolsList.replaceChildren();

  if (schools.length === 0) {
    schoolsList.appendChild(
      createTextElement("p", "No schools registered yet.")
    );
    return;
  }

  schools.forEach((school) => {
    const row = createTextElement("div", "", "item-row");
    const details = document.createElement("div");

    details.appendChild(
      createTextElement("strong", school.schoolName || "Unnamed school")
    );

    details.appendChild(
      createTextElement("p", `School ID: ${school.id}`)
    );

    details.appendChild(
      createTextElement(
        "p",
        `School Code: ${codeBySchoolID[school.id] || "Not found"}`
      )
    );

    details.appendChild(
      createTextElement("p", `Status: ${school.status || "Unknown"}`)
    );

    row.appendChild(details);
    schoolsList.appendChild(row);
  });
}

// DISPLAY TEACHER APPLICATIONS
function renderTeachers(teachers, schools) {
  teachersList.replaceChildren();

  if (teachers.length === 0) {
    teachersList.appendChild(
      createTextElement("p", "No teacher applications yet.")
    );
    return;
  }

  const schoolNames = {};
  schools.forEach((school) => {
    schoolNames[school.id] = school.schoolName;
  });

  teachers.forEach((teacher) => {
    const row = createTextElement("div", "", "item-row");
    const details = document.createElement("div");

    details.appendChild(
      createTextElement("strong", teacher.name || "Unnamed teacher")
    );
    details.appendChild(
      createTextElement("p", `Email: ${teacher.email || "Not provided"}`)
    );
    details.appendChild(
      createTextElement(
        "p",
        `School: ${schoolNames[teacher.schoolID] || teacher.schoolID || "Unknown"}`
      )
    );
    details.appendChild(
      createTextElement("p", `Status: ${teacher.status || "Unknown"}`)
    );

    row.appendChild(details);

    // Check status case-insensitively and attach buttons INSIDE the if block
    if (String(teacher.status || "").trim().toLowerCase() === "pending") {
      const actions = document.createElement("div");
      actions.className = "teacher-actions";

      const approveButton = createTextElement("button", "Approve", "approve-btn");
      approveButton.type = "button";
      approveButton.addEventListener("click", () => {
        updateTeacherStatus(teacher.id, "approved");
      });

      const rejectButton = createTextElement("button", "Reject", "reject-btn");
      rejectButton.type = "button";
      rejectButton.addEventListener("click", () => {
        updateTeacherStatus(teacher.id, "rejected");
      });

      actions.append(approveButton, rejectButton);
      row.appendChild(actions);
    }

    teachersList.appendChild(row);
  });
}

// APPROVE OR REJECT TEACHER
async function updateTeacherStatus(teacherUID, newStatus) {
  const action = newStatus === "approved" ? "approve" : "reject";
  if (!confirm(`Are you sure you want to ${action} this teacher?`)) {
    return;
  }

  try {
    await updateDoc(doc(db, "teachers", teacherUID), {
      status: newStatus
    });
    alert(`Teacher ${newStatus} successfully.`);
    await loadDashboard();
  } catch (error) {
    console.error("Teacher update error:", error);
    alert("Failed to update teacher: " + error.message);
  }
}

// Initially show login until Firebase checks the session
showLogin();
