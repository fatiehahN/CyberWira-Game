import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const message = document.getElementById("dashboardMessage");
const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");

let currentTeacher = null;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#f87171" : "";
}

function average(values) {
  const validValues = values.filter(
    value => typeof value === "number" && Number.isFinite(value)
  );

  if (validValues.length === 0) return 0;

  return validValues.reduce((sum, value) => sum + value, 0)
    / validValues.length;
}

function formatNumber(value) {
  return Number(value).toFixed(1);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Check teacher login and approval with proper session persistence handling
let authInitialized = false;

onAuthStateChanged(auth, async (user) => {
    if (!authInitialized) {
        authInitialized = true;
    }

    if (!user) {
        setTimeout(() => {
            if (!auth.currentUser) {
                window.location.href = "teacher-login.html";
            }
        }, 500);
        return;
    }

    try {
        const teacherRef = doc(db, "teachers", user.uid);
        const teacherSnapshot = await getDoc(teacherRef);

        if (!teacherSnapshot.exists()) {
            await signOut(auth);
            window.location.href = "teacher-login.html";
            return;
        }

        const teacherData = teacherSnapshot.data();
        if (String(teacherData.status || "").toLowerCase() !== "approved") {
            await signOut(auth);
            window.location.href = "teacher-login.html";
            return;
        }

        currentTeacher = user;
        await loadDashboard();
    } catch (error) {
        console.error("Dashboard access error:", error);
        showMessage("Unable to verify your account. Please try again.", true);
    }
});

// Load all player records and calculate aggregate analytics
async function loadDashboard() {
  try {
    showMessage("Loading CyberWira analytics...");

    const usersSnapshot = await getDocs(collection(db, "users"));

    const allRecords = usersSnapshot.docs.map(
      document => document.data()
    );

    const players = allRecords.filter(player =>
      player.totalScore !== undefined ||
      player.preTestCompleted === true ||
      player.level1 !== undefined ||
      player.level2 !== undefined ||
      player.level3 !== undefined
    );

    if (players.length === 0) {
      resetDashboard();
      showMessage("No player data is available yet.");
      return;
    }

    // =====================================
    // 1. OVERVIEW
    // =====================================

    const totalParticipants = players.length;

    const averageGameScore = average(
      players.map(player => player.totalScore)
    );

    const highCount = players.filter(
      player => String(player.awarenessLevel || "").toLowerCase() === "high"
    ).length;

    const highPercentage =
      (highCount / totalParticipants) * 100;

    const completedLevels = players.reduce((total, player) => {
      return total +
        (player.level1?.completed === true ? 1 : 0) +
        (player.level2?.completed === true ? 1 : 0) +
        (player.level3?.completed === true ? 1 : 0);
    }, 0);

    const totalPossibleLevels = totalParticipants * 3;
    const completionRate = totalPossibleLevels > 0 ? (completedLevels / totalPossibleLevels) * 100 : 0;

    setText("totalParticipants", totalParticipants);
    setText("averageScore", formatNumber(averageGameScore));
    setText("highAwareness", highCount);
    setText("highAwarenessPercent", `${formatNumber(highPercentage)}% of participants`);

    setText("completedLevels", `${formatNumber(completionRate)}%`);
    const subEl = document.getElementById("completedLevelsSub");
    if (subEl) {
        subEl.textContent = `${completedLevels} of ${totalPossibleLevels} levels completed`;
    }

    // =====================================
    // 2. AWARENESS DISTRIBUTION
    // =====================================

    const awarenessLevels = {
      High: 0,
      Medium: 0,
      Low: 0,
      Other: 0
    };

    players.forEach(player => {
      const level = String(player.awarenessLevel || "").toLowerCase();

      if (level === "high") {
        awarenessLevels.High++;
      } else if (level === "medium") {
        awarenessLevels.Medium++;
      } else if (level === "low") {
        awarenessLevels.Low++;
      } else {
        awarenessLevels.Other++;
      }
    });

    renderAwarenessChart(awarenessLevels, totalParticipants);

    // =====================================
    // 3. LEVEL PERFORMANCE
    // =====================================

    const levelStats = [
      { key: "level1", name: "Level 1: Password Security" },
      { key: "level2", name: "Level 2: Phishing Awareness" },
      { key: "level3", name: "Level 3: Online Shopping Scams" }
    ];

    renderLevelPerformance(players, levelStats);

    // =====================================
    // 4. COMMON WEAKNESSES
    // =====================================
    const passwordReuse = players.filter(
        player => player.level1?.usedSamePassword === true
    ).length;
    const mfaMissed = players.filter(
        player => player.level1?.mfaDefended === false
    ).length;
    const phishingMistakes = players.reduce(
        (total, player) =>
            total + (Number(player.level2?.wrongCount) || 0),
        0
    );
    const shoppingMistakes = players.filter(player => {
        const mistakes = player.level3?.mistakes;
        if (Array.isArray(mistakes)) {
            return mistakes.length > 0;
        }
        return typeof mistakes === "string" &&
            mistakes.trim().length > 0;
    }).length;

    const weaknessData = {
        "Password Reuse": passwordReuse,
        "Missed MFA": mfaMissed,
        "Phishing Errors": phishingMistakes,
        "Shopping Errors": shoppingMistakes
    };
    renderWeaknessChart(weaknessData, totalParticipants);

    // =====================================
    // 5. PRE-TEST & GAMEPLAY
    // =====================================

    const preTestPlayers = players.filter(
      player => player.preTestCompleted === true &&
        typeof player.preTestScore === "number"
    );

    const averagePreTest = average(
      preTestPlayers.map(player => player.preTestScore)
    );

    const totalStars = players.map(player => {
      return (
        (Number(player.level1?.starsEarned) || 0) +
        (Number(player.level2?.starsEarned) || 0) +
        (Number(player.level3?.starsEarned) || 0)
      );
    });

    const averageStars = average(totalStars);

    setText(
      "averagePreTest",
      preTestPlayers.length > 0
        ? `${formatNumber(averagePreTest)} / 3`
        : "No data"
    );

    setText(
      "averageStars",
      `${formatNumber(averageStars)} / 9`
    );

    // =====================================
    // 6. DEMOGRAPHIC ANALYTICS (Behavioral Correlation)
    // =====================================

    const ageGroups = { "13-14": [], "15-16": [], "17-18": [] };
    const genderGroups = { "Female": [], "Male": [] };

    players.forEach(player => {
      const age = String(player.age || "").trim();
      const gender = String(player.gender || "").trim();
      const score = Number(player.totalScore) || 0;

      if (ageGroups[age] !== undefined) {
        ageGroups[age].push(score);
      }
      
      const formattedGender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
      if (genderGroups[formattedGender] !== undefined) {
        genderGroups[formattedGender].push(score);
      }
    });

    // Calculate averages for age groups (Out of 300 max score)
    const ageAverages = {};
    Object.entries(ageGroups).forEach(([age, scores]) => {
      ageAverages[age] = average(scores);
    });

    // Calculate averages for gender groups
    const genderAverages = {};
    Object.entries(genderGroups).forEach(([gender, scores]) => {
      genderAverages[gender] = average(scores);
    });

    renderDemographicScoreChart("ageScoreChart", ageAverages, 300);
    renderDemographicScoreChart("genderScoreChart", genderAverages, 300);

    showMessage(
      `Dashboard updated successfully. ${totalParticipants} participant records analysed.`
    );

  } catch (error) {
    console.error("Dashboard loading error:", error);
    showMessage(
      "Unable to load dashboard data. Please check your Firestore permissions.",
      true
    );
  }
}

// Render awareness distribution as Donut Chart with Legend
function renderAwarenessChart(levels, total) {
  const donutContainer = document.getElementById("awarenessDonut");
  const legendContainer = document.getElementById("awarenessLegend");
  
  if (!donutContainer || !legendContainer) return;
  
  const colors = {
    High: "#08d9ed",     // Cyan
    Medium: "#bd67f5",   // Purple
    Low: "#e34e68",      // Coral/Red
    Other: "#9aaac0"     // Muted grey
  };

  const donutTotalEl = document.getElementById("donutTotal");
  if (donutTotalEl) donutTotalEl.textContent = total;

  if (total === 0) {
    donutContainer.style.background = "conic-gradient(var(--line) 0deg 360deg)";
    legendContainer.innerHTML = "<p>No data available.</p>";
    return;
  }

  let currentAngle = 0;
  let gradientStops = [];
  legendContainer.innerHTML = "";

  Object.entries(levels).forEach(([name, count]) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    const nextAngle = currentAngle + angle;
    
    const color = colors[name] || "#9aaac0";
    gradientStops.push(`${color} ${currentAngle}deg ${nextAngle}deg`);

    const legendItem = document.createElement("div");
    legendItem.className = "legend-item";
    
    legendItem.innerHTML = `
      <div class="legend-left">
        <span class="legend-color" style="background: ${color};"></span>
        <span>${name}</span>
      </div>
      <span class="legend-value">${count} (${formatNumber(percentage)}%)</span>
    `;
    
    legendContainer.appendChild(legendItem);
    currentAngle = nextAngle;
  });

  donutContainer.style.background = `conic-gradient(${gradientStops.join(", ")})`;
}

// Render weakness distribution chart
function renderWeaknessChart(weaknesses, total) {
    const chart = document.getElementById("weaknessChart");
    if (!chart) return;
    chart.innerHTML = "";
    Object.entries(weaknesses).forEach(([name, count]) => {
        const percentage = total > 0 ? Math.min((count / total) * 100, 100) : 0;
        const row = document.createElement("div");
        row.className = "bar-row";
        const label = document.createElement("span");
        label.className = "bar-label";
        label.textContent = name;
        const track = document.createElement("div");
        track.className = "bar-track";
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = `${percentage}%`;
        track.appendChild(fill);
        const value = document.createElement("span");
        value.className = "bar-value";
        value.textContent = `${count}`;
        row.append(label, track, value);
        chart.appendChild(row);
    });
}

// Render demographic score comparison charts
function renderDemographicScoreChart(elementId, averagesMap, maxScore) {
  const chart = document.getElementById(elementId);
  if (!chart) return;
  chart.innerHTML = "";

  Object.entries(averagesMap).forEach(([name, avgScore]) => {
    const percentage = maxScore > 0 ? Math.min((avgScore / maxScore) * 100, 100) : 0;
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = name;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${percentage}%`;
    track.appendChild(fill);

    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = `${formatNumber(avgScore)} pts`;

    row.append(label, track, value);
    chart.appendChild(row);
  });
}

// Render performance for each game level
function renderLevelPerformance(players, levelStats) {
  const container = document.getElementById("levelPerformance");
  if (!container) return;
  container.innerHTML = "";

  levelStats.forEach(level => {
    const completedPlayers = players.filter(
      player => player[level.key]?.completed === true
    );

    const scores = completedPlayers
      .map(player => player[level.key]?.finalScore);

    const stars = completedPlayers
      .map(player => player[level.key]?.starsEarned);

    const averageScore = average(scores);
    const averageStars = average(stars);

    const card = document.createElement("article");
    card.className = "level-card";

    const title = document.createElement("h3");
    title.textContent = level.name;

    const score = document.createElement("p");
    score.className = "level-score";
    score.textContent = completedPlayers.length > 0
      ? `${formatNumber(averageScore)} / 100`
      : "No data";

    const scoreLabel = document.createElement("p");
    scoreLabel.textContent = "Average final score";

    const star = document.createElement("p");
    star.className = "level-stars";
    star.textContent = completedPlayers.length > 0
      ? `${formatNumber(averageStars)} / 3 ★`
      : "No data";

    const starLabel = document.createElement("p");
    starLabel.textContent = "Average stars earned";

    const completion = document.createElement("p");
    completion.textContent =
      `${completedPlayers.length} of ${players.length} participants completed this level`;

    card.append(
      title,
      score,
      scoreLabel,
      star,
      starLabel,
      completion
    );

    container.appendChild(card);
  });
}

// Reset displayed figures when no records are found
function resetDashboard() {
    [
        "totalParticipants",
        "averageScore",
        "highAwareness",
        "highAwarenessPercent",
        "completedLevels",
        "averagePreTest",
        "averageStars"
    ].forEach(id => setText(id, "0"));

    const subEl = document.getElementById("completedLevelsSub");
    if (subEl) subEl.textContent = "Across all participants";

    const awarenessChart = document.getElementById("awarenessDonut");
    if (awarenessChart) {
        awarenessChart.style.background = "conic-gradient(var(--line) 0deg 360deg)";
        const donutTotal = document.getElementById("donutTotal");
        if (donutTotal) donutTotal.textContent = "0";
        const awarenessLegend = document.getElementById("awarenessLegend");
        if (awarenessLegend) awarenessLegend.innerHTML = "<p>No data available.</p>";
    }

    const weaknessChart = document.getElementById("weaknessChart");
    if (weaknessChart) weaknessChart.innerHTML = "<p>No data available.</p>";

    const levelPerformance = document.getElementById("levelPerformance");
    if (levelPerformance) levelPerformance.innerHTML = "<p>No level data available.</p>";

   const ageChart = document.getElementById("ageScoreChart");
    if (ageChart) ageChart.innerHTML = "<p>No data available.</p>";

    const genderChart = document.getElementById("genderScoreChart");
    if (genderChart) genderChart.innerHTML = "<p>No data available.</p>";
}

// Refresh dashboard
refreshButton.addEventListener("click", async () => {
  if (currentTeacher) {
    await loadDashboard();
  }
});

// Teacher logout
logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "teacher-login.html";
  } catch (error) {
    console.error("Logout error:", error);
    showMessage("Unable to log out. Please try again.", true);
  }
});