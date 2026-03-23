const STORAGE_KEY = "workScheduleDraftState";
const SHIFTS = ["A", "B", "C"];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const sampleEmployees = [
  { id: "E001", name: "김서연", role: "팀장", skill: 3, preferences: [], targetRatio: 1.0 },
  { id: "E002", name: "이도윤", role: "일반", skill: 3, preferences: ["A", "B", "C"], targetRatio: 1.0 },
  { id: "E003", name: "박지후", role: "일반", skill: 2, preferences: ["B", "A", "C"], targetRatio: 0.95 },
  { id: "E004", name: "정하은", role: "일반", skill: 2, preferences: ["C", "B", "A"], targetRatio: 0.92 },
  { id: "E005", name: "최유진", role: "일반", skill: 1, preferences: ["A", "C", "B"], targetRatio: 0.9 },
  { id: "E006", name: "오민재", role: "일반", skill: 3, preferences: ["B", "C", "A"], targetRatio: 0.97 }
];

const state = loadState();

const elements = {
  yearInput: document.querySelector("#yearInput"),
  monthInput: document.querySelector("#monthInput"),
  maxConsecutiveInput: document.querySelector("#maxConsecutiveInput"),
  holidayCalendar: document.querySelector("#holidayCalendar"),
  requirementTable: document.querySelector("#requirementTable"),
  overrideList: document.querySelector("#overrideList"),
  addOverrideButton: document.querySelector("#addOverrideButton"),
  employeeFileInput: document.querySelector("#employeeFileInput"),
  fixedFileInput: document.querySelector("#fixedFileInput"),
  carryoverFileInput: document.querySelector("#carryoverFileInput"),
  employeeFileStatus: document.querySelector("#employeeFileStatus"),
  fixedFileStatus: document.querySelector("#fixedFileStatus"),
  carryoverFileStatus: document.querySelector("#carryoverFileStatus"),
  validationSummary: document.querySelector("#validationSummary"),
  constraintList: document.querySelector("#constraintList"),
  storageStatus: document.querySelector("#storageStatus"),
  generateDraftButton: document.querySelector("#generateDraftButton"),
  validateButton: document.querySelector("#validateButton"),
  resetButton: document.querySelector("#resetButton"),
  monthLabel: document.querySelector("#monthLabel"),
  employeeCountPill: document.querySelector("#employeeCountPill"),
  holidayCountPill: document.querySelector("#holidayCountPill"),
  scheduleMatrix: document.querySelector("#scheduleMatrix"),
  personalPreview: document.querySelector("#personalPreview"),
  statsPanel: document.querySelector("#statsPanel"),
  warningList: document.querySelector("#warningList"),
  downloadButton: document.querySelector("#downloadButton"),
  printButton: document.querySelector("#printButton")
};

bootstrap();

function bootstrap() {
  bindInputs();
  render();
}

function bindInputs() {
  elements.yearInput.addEventListener("input", (event) => {
    state.year = Number(event.target.value);
    state.holidays = getWeekendDates(state.year, state.month);
    saveAndRender();
  });

  elements.monthInput.addEventListener("input", (event) => {
    state.month = clamp(Number(event.target.value), 1, 12);
    state.holidays = getWeekendDates(state.year, state.month);
    saveAndRender();
  });

  elements.maxConsecutiveInput.addEventListener("input", (event) => {
    state.maxConsecutiveDays = clamp(Number(event.target.value), 1, 14);
    saveAndRender();
  });

  elements.addOverrideButton.addEventListener("click", () => {
    state.overrides.push({ date: isoDate(state.year, state.month, 1), A: 1, B: 1, C: 1 });
    saveAndRender();
  });

  attachFileStatus(elements.employeeFileInput, "employee");
  attachFileStatus(elements.fixedFileInput, "fixed");
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

  elements.downloadButton.addEventListener("click", downloadScheduleCsv);
  elements.printButton.addEventListener("click", () => window.print());
}

function attachFileStatus(input, key) {
  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    state.uploads[key] = file ? { name: file.name, size: file.size } : null;
    saveAndRender();
  });
}

function render() {
  elements.yearInput.value = state.year;
  elements.monthInput.value = state.month;
  elements.maxConsecutiveInput.value = state.maxConsecutiveDays;
  renderHolidayCalendar();
  renderRequirementTable();
  renderOverrideList();
  renderUploads();
  renderValidation();
  renderConstraints();
  renderOutputs();
  saveState();
}

function renderHolidayCalendar() {
  const days = getDaysInMonth(state.year, state.month);
  const holidaySet = new Set(state.holidays);
  const markup = [];

  for (let day = 1; day <= days; day += 1) {
    const date = isoDate(state.year, state.month, day);
    const weekday = new Date(state.year, state.month - 1, day).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = holidaySet.has(date);

    markup.push(`
      <button class="day-chip ${isWeekend ? "is-weekend" : ""} ${isHoliday ? "is-holiday" : ""}" data-date="${date}">
        <strong>${day}일</strong>
        <small>${WEEKDAY_LABELS[weekday]}요일 ${isHoliday ? "휴일" : "근무일"}</small>
      </button>
    `);
  }

  elements.holidayCalendar.innerHTML = markup.join("");
  elements.holidayCalendar.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleHoliday(button.dataset.date);
      saveAndRender();
    });
  });
}

function renderRequirementTable() {
  const rows = Object.entries(state.requirements).map(([dayType, requirement]) => `
    <tr>
      <td>${dayType}</td>
      ${SHIFTS.map((shift) => `
        <td><input type="number" min="0" max="9" value="${requirement[shift]}" data-day-type="${dayType}" data-shift="${shift}" class="cell-input"></td>
      `).join("")}
    </tr>
  `).join("");

  elements.requirementTable.innerHTML = `
    <table>
      <thead><tr><th>요일 유형</th><th>A</th><th>B</th><th>C</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  elements.requirementTable.querySelectorAll(".cell-input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const { dayType, shift } = event.target.dataset;
      state.requirements[dayType][shift] = clamp(Number(event.target.value), 0, 9);
      saveAndRender();
    });
  });
}

function renderOverrideList() {
  if (!state.overrides.length) {
    elements.overrideList.innerHTML = `<div class="empty-state">아직 등록된 특정일 예외 인원이 없습니다.</div>`;
    return;
  }

  elements.overrideList.innerHTML = state.overrides.map((override, index) => `
    <div class="override-item">
      <input type="date" value="${override.date}" data-index="${index}" data-field="date">
      <input type="number" min="0" max="9" value="${override.A}" data-index="${index}" data-field="A">
      <input type="number" min="0" max="9" value="${override.B}" data-index="${index}" data-field="B">
      <input type="number" min="0" max="9" value="${override.C}" data-index="${index}" data-field="C">
      <button class="button button-ghost button-small" data-remove-index="${index}">삭제</button>
    </div>
  `).join("");

  elements.overrideList.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      state.overrides[index][field] = field === "date" ? event.target.value : clamp(Number(event.target.value), 0, 9);
      saveAndRender();
    });
  });

  elements.overrideList.querySelectorAll("[data-remove-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.overrides.splice(Number(button.dataset.removeIndex), 1);
      saveAndRender();
    });
  });
}

function renderUploads() {
  elements.employeeFileStatus.textContent = describeUpload(state.uploads.employee);
  elements.fixedFileStatus.textContent = describeUpload(state.uploads.fixed);
  elements.carryoverFileStatus.textContent = describeUpload(state.uploads.carryover);
}

function renderValidation() {
  const validation = state.validation ?? { errors: [], warnings: [] };
  if (!validation.errors.length && !validation.warnings.length) {
    elements.validationSummary.textContent = "오류 없음. 샘플 데이터 기준으로 기본 구조가 준비되었습니다.";
  } else if (validation.errors.length) {
    elements.validationSummary.textContent = `오류 ${validation.errors.length}건, 경고 ${validation.warnings.length}건`;
  } else {
    elements.validationSummary.textContent = `경고 ${validation.warnings.length}건`;
  }

  elements.warningList.innerHTML = [...validation.errors, ...validation.warnings]
    .map((message) => `<div class="warning-item">${message}</div>`)
    .join("") || `<div class="empty-state">현재 표시할 경고가 없습니다.</div>`;
}

function renderConstraints() {
  const constraints = [
    "일자/근무별 최소 필요 인원 충족",
    "사전 지정 근무 고정 유지",
    "팀장은 A 근무만 배정",
    "팀장 월·수·토 최소 7~8회 확인 필요",
    "초급 단독 배정 금지",
    "부재일/기간 외 배정 금지",
    "C 다음 날 A/B 금지",
    `최대 연속 근무 ${state.maxConsecutiveDays}일 제한`
  ];

  elements.constraintList.innerHTML = constraints.map((item) => `<li>${item}</li>`).join("");
  elements.storageStatus.textContent = `마지막 저장 시각: ${new Date().toLocaleString("ko-KR")}`;
}

function renderOutputs() {
  const days = getDaysInMonth(state.year, state.month);
  const schedule = state.schedule.length ? state.schedule : buildDraftSchedule();
  const holidayCount = state.holidays.length;

  elements.monthLabel.textContent = `${state.year}년 ${state.month}월`;
  elements.employeeCountPill.textContent = `직원 ${sampleEmployees.length}명`;
  elements.holidayCountPill.textContent = `휴일 ${holidayCount}일`;

  const headCells = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const weekday = new Date(state.year, state.month - 1, day).getDay();
    return `<th>${day}<br><small>${WEEKDAY_LABELS[weekday]}</small></th>`;
  }).join("");

  const rows = sampleEmployees.map((employee) => `
    <tr>
      <td>${employee.name}<br><small>${employee.role} / 숙련도 ${employee.skill}</small></td>
      ${schedule.filter((entry) => entry.employeeId === employee.id).map((entry) => `<td>${entry.shift}</td>`).join("")}
    </tr>
  `).join("");

  elements.scheduleMatrix.innerHTML = `
    <table>
      <thead><tr><th>직원</th>${headCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  elements.personalPreview.innerHTML = sampleEmployees.slice(0, 3).map((employee) => {
    const summary = summarizeAssignments(schedule.filter((entry) => entry.employeeId === employee.id));
    return `<article class="preview-card"><strong>${employee.name}</strong><div>A ${summary.A}회 · B ${summary.B}회 · C ${summary.C}회 · 휴무 ${summary.OFF}회</div></article>`;
  }).join("");

  const totals = buildStats(schedule);
  const labels = [
    `총 A 근무 ${totals.A}회`,
    `총 B 근무 ${totals.B}회`,
    `총 C 근무 ${totals.C}회`,
    `총 휴무 ${totals.OFF}회`,
    `예외 인원 ${state.overrides.length}건`,
    `업로드 파일 ${Object.values(state.uploads).filter(Boolean).length}건`
  ];
  elements.statsPanel.innerHTML = labels.map((label) => `<div class="stat-card"><strong>${label}</strong><span>초안 기준 집계</span></div>`).join("");
}

function runValidation() {
  const errors = [];
  const warnings = [];

  const duplicatePreferenceEmployee = sampleEmployees.find((employee) => employee.preferences.length && new Set(employee.preferences).size !== employee.preferences.length);
  if (duplicatePreferenceEmployee) {
    errors.push(`${duplicatePreferenceEmployee.name}: 근무 선호도 중복이 있습니다.`);
  }
  if (!sampleEmployees.some((employee) => employee.role === "팀장")) {
    errors.push("팀장 데이터가 없습니다. 팀장 전담 룰을 검증할 수 없습니다.");
  }
  if (state.maxConsecutiveDays < 3) {
    warnings.push("최대 연속 근무 제한이 매우 낮아 생성 불가 가능성이 커집니다.");
  }
  if (!state.uploads.employee) {
    warnings.push("직원 CSV가 아직 업로드되지 않았습니다. 현재는 샘플 데이터로 화면을 채웁니다.");
  }
  if (state.overrides.some((override) => !override.date)) {
    errors.push("특정일 예외 인원에 날짜가 비어 있는 항목이 있습니다.");
  }

  return { errors, warnings };
}

function buildDraftSchedule() {
  const days = getDaysInMonth(state.year, state.month);
  const schedule = [];

  for (let day = 1; day <= days; day += 1) {
    const weekday = new Date(state.year, state.month - 1, day).getDay();
    const date = isoDate(state.year, state.month, day);
    const dayType = state.holidays.includes(date) ? "휴일" : (weekday === 0 || weekday === 6 ? "주말" : "평일");
    const override = state.overrides.find((item) => item.date === date);
    const required = override ?? state.requirements[dayType];
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

function buildStats(schedule) {
  return schedule.reduce((accumulator, entry) => {
    accumulator[entry.shift] = (accumulator[entry.shift] ?? 0) + 1;
    return accumulator;
  }, { A: 0, B: 0, C: 0, OFF: 0 });
}

function summarizeAssignments(assignments) {
  return assignments.reduce((accumulator, entry) => {
    accumulator[entry.shift] = (accumulator[entry.shift] ?? 0) + 1;
    return accumulator;
  }, { A: 0, B: 0, C: 0, OFF: 0 });
}

function downloadScheduleCsv() {
  const schedule = state.schedule.length ? state.schedule : buildDraftSchedule();
  const grouped = new Map(sampleEmployees.map((employee) => [employee.id, { name: employee.name, shifts: [] }]));
  schedule.forEach((entry) => grouped.get(entry.employeeId)?.shifts.push(entry.shift));

  const header = ["직원", ...Array.from({ length: getDaysInMonth(state.year, state.month) }, (_, index) => `${index + 1}일`)];
  const lines = [header.join(",")];
  grouped.forEach((value) => lines.push([value.name, ...value.shifts].join(",")));

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `schedule-draft-${state.year}-${String(state.month).padStart(2, "0")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function toggleHoliday(date) {
  const holidays = new Set(state.holidays);
  if (holidays.has(date)) holidays.delete(date);
  else holidays.add(date);
  state.holidays = Array.from(holidays).sort();
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
    maxConsecutiveDays: 5,
    holidays: getWeekendDates(year, month),
    requirements: {
      평일: { A: 2, B: 2, C: 1 },
      주말: { A: 1, B: 1, C: 1 },
      휴일: { A: 1, B: 1, C: 0 }
    },
    overrides: [{ date: isoDate(year, month, 15), A: 3, B: 2, C: 1 }],
    uploads: { employee: null, fixed: null, carryover: null },
    validation: { errors: [], warnings: [] },
    schedule: []
  };
}

function getWeekendDates(year, month) {
  const result = [];
  for (let day = 1; day <= getDaysInMonth(year, month); day += 1) {
    const weekday = new Date(year, month - 1, day).getDay();
    if (weekday === 0 || weekday === 6) result.push(isoDate(year, month, day));
  }
  return result;
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function describeUpload(file) {
  if (!file) return "아직 업로드하지 않음";
  return `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
