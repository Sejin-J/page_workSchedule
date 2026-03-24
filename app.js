const STORAGE_KEY = "workScheduleDraftState";
const SHIFTS = ["A", "B", "C"];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const FOCUS_WEEKDAYS = new Set([1, 3, 6]);

const sampleEmployees = [
  { id: "E001", name: "김서연", role: "팀장", skill: 3 },
  { id: "E002", name: "이도윤", role: "일반", skill: 3 },
  { id: "E003", name: "박지후", role: "일반", skill: 2 },
  { id: "E004", name: "정하은", role: "일반", skill: 2 },
  { id: "E005", name: "최유진", role: "일반", skill: 1 },
  { id: "E006", name: "오민재", role: "일반", skill: 3 }
];

const state = loadState();

const elements = {
  yearInput: document.querySelector("#yearInput"),
  monthInput: document.querySelector("#monthInput"),
  requiredAInput: document.querySelector("#requiredAInput"),
  requiredBInput: document.querySelector("#requiredBInput"),
  requiredCInput: document.querySelector("#requiredCInput"),
  maxConsecutiveInput: document.querySelector("#maxConsecutiveInput"),
  addOverrideButton: document.querySelector("#addOverrideButton"),
  overrideList: document.querySelector("#overrideList"),
  employeeFileInput: document.querySelector("#employeeFileInput"),
  carryoverFileInput: document.querySelector("#carryoverFileInput"),
  employeeFileStatus: document.querySelector("#employeeFileStatus"),
  carryoverFileStatus: document.querySelector("#carryoverFileStatus"),
  validateButton: document.querySelector("#validateButton"),
  validationSummary: document.querySelector("#validationSummary"),
  generateDraftButton: document.querySelector("#generateDraftButton"),
  resetButton: document.querySelector("#resetButton"),
  scheduleTabs: document.querySelector("#scheduleTabs"),
  monthLabel: document.querySelector("#monthLabel"),
  employeeCountPill: document.querySelector("#employeeCountPill"),
  calendarView: document.querySelector("#calendarView"),
  requiredMonthlyStats: document.querySelector("#requiredMonthlyStats"),
  employeeMonthlyStats: document.querySelector("#employeeMonthlyStats"),
  requiredMwsStats: document.querySelector("#requiredMwsStats"),
  employeeMwsStats: document.querySelector("#employeeMwsStats")
};

bootstrap();

function bootstrap() {
  bindInputs();
  render();
}

function bindInputs() {
  elements.yearInput.addEventListener("input", (event) => updateMonthState("year", Number(event.target.value)));
  elements.monthInput.addEventListener("input", (event) => updateMonthState("month", clamp(Number(event.target.value), 1, 12)));
  elements.requiredAInput.addEventListener("input", (event) => updateRequirement("A", event.target.value));
  elements.requiredBInput.addEventListener("input", (event) => updateRequirement("B", event.target.value));
  elements.requiredCInput.addEventListener("input", (event) => updateRequirement("C", event.target.value));
  elements.maxConsecutiveInput.addEventListener("input", (event) => {
    state.maxConsecutiveDays = clamp(Number(event.target.value), 1, 14);
    state.schedule = [];
    saveAndRender();
  });

  elements.addOverrideButton.addEventListener("click", () => {
    state.overrides.push({ date: isoDate(state.year, state.month, 1), A: state.requirements.A, B: state.requirements.B, C: state.requirements.C });
    state.schedule = [];
    saveAndRender();
  });

  attachFileStatus(elements.employeeFileInput, "employee");
  attachFileStatus(elements.carryoverFileInput, "carryover");

  elements.validateButton.addEventListener("click", () => {
    state.validation = runValidation();
    saveAndRender();
  });

  elements.generateDraftButton.addEventListener("click", () => {
    state.schedule = buildDraftSchedule();
    state.validation = runValidation();
    saveAndRender();
  });

  elements.resetButton.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, buildDefaultState());
    saveAndRender();
  });
}

function updateMonthState(key, value) {
  state[key] = value;
  state.overrides = state.overrides.map((override, index) => ({
    ...override,
    date: index === 0 ? isoDate(state.year, state.month, Math.min(15, getDaysInMonth(state.year, state.month))) : override.date
  }));
  state.schedule = [];
  saveAndRender();
}

function updateRequirement(shift, value) {
  state.requirements[shift] = clamp(Number(value), 0, 20);
  state.schedule = [];
  saveAndRender();
}

function attachFileStatus(input, key) {
  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    state.uploads[key] = file ? { name: file.name, size: file.size } : null;
    saveAndRender();
  });
}

function render() {
  const schedule = buildDraftSchedule();
  state.schedule = schedule;
  elements.yearInput.value = state.year;
  elements.monthInput.value = state.month;
  elements.requiredAInput.value = state.requirements.A;
  elements.requiredBInput.value = state.requirements.B;
  elements.requiredCInput.value = state.requirements.C;
  elements.maxConsecutiveInput.value = state.maxConsecutiveDays;
  elements.employeeFileStatus.textContent = describeUpload(state.uploads.employee);
  elements.carryoverFileStatus.textContent = describeUpload(state.uploads.carryover);
  elements.validationSummary.textContent = buildValidationText();
  elements.monthLabel.textContent = `${state.year}년 ${state.month}월`;
  elements.employeeCountPill.textContent = `직원 ${sampleEmployees.length}명`;

  renderOverrideList();
  renderTabs();
  renderCalendar(schedule);
  renderStats(schedule);
  saveState();
}

function renderOverrideList() {
  if (!state.overrides.length) {
    elements.overrideList.innerHTML = `<div class="status-text">등록된 특정일 최소 필요 인원이 없습니다.</div>`;
    return;
  }

  elements.overrideList.innerHTML = state.overrides.map((override, index) => `
    <div class="override-item">
      <input type="date" value="${override.date}" data-index="${index}" data-field="date">
      <input type="number" min="0" max="20" value="${override.A}" data-index="${index}" data-field="A">
      <input type="number" min="0" max="20" value="${override.B}" data-index="${index}" data-field="B">
      <input type="number" min="0" max="20" value="${override.C}" data-index="${index}" data-field="C">
      <button class="button button-ghost button-small" data-remove-index="${index}">삭제</button>
    </div>
  `).join("");

  elements.overrideList.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      state.overrides[index][field] = field === "date" ? event.target.value : clamp(Number(event.target.value), 0, 20);
      state.schedule = [];
      saveAndRender();
    });
  });

  elements.overrideList.querySelectorAll("[data-remove-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.overrides.splice(Number(button.dataset.removeIndex), 1);
      state.schedule = [];
      saveAndRender();
    });
  });
}

function renderTabs() {
  const tabs = [
    { id: "summary", label: "종합" },
    ...sampleEmployees.map((employee) => ({ id: employee.id, label: employee.name }))
  ];

  elements.scheduleTabs.innerHTML = tabs.map((tab) => `
    <button class="tab-button ${state.selectedView === tab.id ? "is-active" : ""}" data-tab-id="${tab.id}">
      ${tab.label}
    </button>
  `).join("");

  elements.scheduleTabs.querySelectorAll("[data-tab-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedView = button.dataset.tabId;
      saveAndRender();
    });
  });
}

function renderCalendar(schedule) {
  const days = getDaysInMonth(state.year, state.month);
  const firstWeekday = new Date(state.year, state.month - 1, 1).getDay();
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(`<div class="calendar-cell is-empty"></div>`);
  }

  for (let day = 1; day <= days; day += 1) {
    const date = isoDate(state.year, state.month, day);
    const weekday = new Date(state.year, state.month - 1, day).getDay();
    const items = state.selectedView === "summary"
      ? buildSummaryItems(schedule, date)
      : buildEmployeeItems(schedule, date, state.selectedView);

    cells.push(`
      <article class="calendar-cell">
        <div class="calendar-date">
          <strong>${day}일</strong>
          <span>${WEEKDAY_LABELS[weekday]}</span>
        </div>
        <div class="calendar-list">
          ${items.length ? items.map((item) => `<div class="calendar-item ${item === "휴무" ? "off" : ""}">${item}</div>`).join("") : `<div class="calendar-item off">미배정</div>`}
        </div>
      </article>
    `);
  }

  elements.calendarView.innerHTML = cells.join("");
}

function buildSummaryItems(schedule, date) {
  return schedule
    .filter((entry) => entry.date === date && entry.shift !== "OFF")
    .map((entry) => `${entry.shift}-${findEmployee(entry.employeeId).name}`);
}

function buildEmployeeItems(schedule, date, employeeId) {
  const entry = schedule.find((item) => item.date === date && item.employeeId === employeeId);
  if (!entry) return [];
  return [entry.shift === "OFF" ? "휴무" : `${entry.shift} 근무`];
}

function renderStats(schedule) {
  const monthlyRequired = getRequiredTotals(false);
  const mwsRequired = getRequiredTotals(true);
  const monthlyEmployee = getEmployeeTotals(schedule, false);
  const mwsEmployee = getEmployeeTotals(schedule, true);

  elements.requiredMonthlyStats.innerHTML = buildSingleRowTable("구분", monthlyRequired);
  elements.requiredMwsStats.innerHTML = buildSingleRowTable("구분", mwsRequired);
  elements.employeeMonthlyStats.innerHTML = buildEmployeeTable(monthlyEmployee);
  elements.employeeMwsStats.innerHTML = buildEmployeeTable(mwsEmployee);
}

function getRequiredTotals(onlyFocusWeekdays) {
  const totals = { A: 0, B: 0, C: 0 };
  const days = getDaysInMonth(state.year, state.month);

  for (let day = 1; day <= days; day += 1) {
    const weekday = new Date(state.year, state.month - 1, day).getDay();
    if (onlyFocusWeekdays && !FOCUS_WEEKDAYS.has(weekday)) continue;

    const date = isoDate(state.year, state.month, day);
    const required = state.overrides.find((item) => item.date === date) ?? state.requirements;
    SHIFTS.forEach((shift) => {
      totals[shift] += required[shift];
    });
  }

  return totals;
}

function getEmployeeTotals(schedule, onlyFocusWeekdays) {
  return sampleEmployees.map((employee) => {
    const totals = { A: 0, B: 0, C: 0 };
    schedule
      .filter((entry) => entry.employeeId === employee.id && entry.shift !== "OFF")
      .forEach((entry) => {
        const day = new Date(entry.date).getDay();
        if (onlyFocusWeekdays && !FOCUS_WEEKDAYS.has(day)) return;
        totals[entry.shift] += 1;
      });
    return { name: employee.name, ...totals };
  });
}

function buildSingleRowTable(label, totals) {
  return `
    <table>
      <thead><tr><th>${label}</th><th>A</th><th>B</th><th>C</th></tr></thead>
      <tbody><tr><td>투입 수</td><td>${totals.A}</td><td>${totals.B}</td><td>${totals.C}</td></tr></tbody>
    </table>
  `;
}

function buildEmployeeTable(rows) {
  return `
    <table>
      <thead><tr><th>직원</th><th>A</th><th>B</th><th>C</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td>${row.name}</td><td>${row.A}</td><td>${row.B}</td><td>${row.C}</td></tr>`).join("")}</tbody>
    </table>
  `;
}

function buildValidationText() {
  const validation = state.validation ?? { errors: [], warnings: [] };
  if (!validation.errors.length && !validation.warnings.length) {
    return "샘플 데이터 기준으로 검증 가능한 기본 형식입니다.";
  }
  if (validation.errors.length) {
    return `오류 ${validation.errors.length}건 / 경고 ${validation.warnings.length}건`;
  }
  return `경고 ${validation.warnings.length}건`;
}

function runValidation() {
  const errors = [];
  const warnings = [];

  if (!state.uploads.employee) {
    warnings.push("제원 데이터 CSV가 아직 업로드되지 않았습니다.");
  }
  if (!state.uploads.carryover) {
    warnings.push("전월 근무 데이터 CSV가 아직 업로드되지 않았습니다.");
  }
  if (state.overrides.some((override) => !override.date)) {
    errors.push("특정일 최소 필요 인원에 날짜가 비어 있습니다.");
  }
  if (state.requirements.A + state.requirements.B + state.requirements.C > sampleEmployees.length) {
    warnings.push("기본 최소 필요 인원이 샘플 직원 수보다 많습니다.");
  }

  return { errors, warnings };
}

function buildDraftSchedule() {
  const days = getDaysInMonth(state.year, state.month);
  const schedule = [];

  for (let day = 1; day <= days; day += 1) {
    const date = isoDate(state.year, state.month, day);
    const required = state.overrides.find((item) => item.date === date) ?? state.requirements;
    const assignedIds = new Set();

    SHIFTS.forEach((shift) => {
      let remaining = required[shift];
      for (let index = 0; index < sampleEmployees.length && remaining > 0; index += 1) {
        const employee = sampleEmployees[(index + day + shift.charCodeAt(0)) % sampleEmployees.length];
        if (assignedIds.has(employee.id)) continue;
        if (employee.role === "팀장" && shift !== "A") continue;
        assignedIds.add(employee.id);
        schedule.push({ date, employeeId: employee.id, shift });
        remaining -= 1;
      }
    });

    sampleEmployees.forEach((employee) => {
      if (!assignedIds.has(employee.id)) {
        schedule.push({ date, employeeId: employee.id, shift: "OFF" });
      }
    });
  }

  return schedule;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultState();
    return { ...buildDefaultState(), ...JSON.parse(raw) };
  } catch {
    return buildDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveAndRender() {
  render();
}

function buildDefaultState() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    year,
    month,
    requirements: { A: 2, B: 2, C: 1 },
    maxConsecutiveDays: 5,
    overrides: [{ date: isoDate(year, month, Math.min(15, getDaysInMonth(year, month))), A: 3, B: 2, C: 1 }],
    uploads: { employee: null, carryover: null },
    validation: { errors: [], warnings: [] },
    selectedView: "summary",
    schedule: []
  };
}

function findEmployee(employeeId) {
  return sampleEmployees.find((employee) => employee.id === employeeId);
}

function describeUpload(file) {
  if (!file) return "아직 업로드하지 않음";
  return `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
