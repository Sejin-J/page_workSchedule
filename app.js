const STORAGE_KEY = "workScheduleDraftState";
const SHIFTS = ["A", "B", "C"];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CALENDAR_HEADER_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const FOCUS_WEEKDAYS = new Set([1, 3, 6]);

const sampleEmployees = [
  { id: "E001", name: "김서연", role: "팀장", skill: 3, preferences: [], absences: ["2026-03-12"] },
  { id: "E002", name: "이도윤", role: "일반", skill: 3, preferences: ["A", "B", "C"], absences: ["2026-03-07", "2026-03-18"] },
  { id: "E003", name: "박지후", role: "일반", skill: 2, preferences: ["B", "A", "C"], absences: ["2026-03-10"] },
  { id: "E004", name: "정하은", role: "일반", skill: 2, preferences: ["C", "B", "A"], absences: ["2026-03-03", "2026-03-20"] },
  { id: "E005", name: "최유진", role: "일반", skill: 1, preferences: ["A", "C", "B"], absences: ["2026-03-18"] },
  { id: "E006", name: "오민재", role: "일반", skill: 3, preferences: ["B", "C", "A"], absences: [] },
  { id: "E007", name: "한지민", role: "일반", skill: 2, preferences: ["C", "A", "B"], absences: ["2026-03-01", "2026-03-26"] },
  { id: "E008", name: "윤태호", role: "일반", skill: 1, preferences: ["A", "B", "C"], absences: ["2026-03-15"] }
];

const sampleFixedAssignments = [
  { date: "2026-03-04", employeeId: "E001", shift: "A" },
  { date: "2026-03-10", employeeId: "E003", shift: "B" },
  { date: "2026-03-18", employeeId: "E005", shift: "C" }
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
  downloadEmployeeFormatButton: document.querySelector("#downloadEmployeeFormatButton"),
  downloadCarryoverFormatButton: document.querySelector("#downloadCarryoverFormatButton"),
  employeeFileStatus: document.querySelector("#employeeFileStatus"),
  carryoverFileStatus: document.querySelector("#carryoverFileStatus"),
  validateButton: document.querySelector("#validateButton"),
  validationSummary: document.querySelector("#validationSummary"),
  generateDraftButton: document.querySelector("#generateDraftButton"),
  saveResultButton: document.querySelector("#saveResultButton"),
  resetButton: document.querySelector("#resetButton"),
  scheduleTabs: document.querySelector("#scheduleTabs"),
  monthLabel: document.querySelector("#monthLabel"),
  employeeCountPill: document.querySelector("#employeeCountPill"),
  preferenceSummary: document.querySelector("#preferenceSummary"),
  calendarView: document.querySelector("#calendarView"),
  combinedMonthlyStats: document.querySelector("#combinedMonthlyStats"),
  combinedMwsStats: document.querySelector("#combinedMwsStats")
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
  elements.downloadEmployeeFormatButton.addEventListener("click", () => downloadCsvTemplate("employee"));
  elements.downloadCarryoverFormatButton.addEventListener("click", () => downloadCsvTemplate("carryover"));

  elements.validateButton.addEventListener("click", () => {
    state.validation = runValidation();
    saveAndRender();
  });

  elements.generateDraftButton.addEventListener("click", () => {
    state.schedule = buildDraftSchedule();
    state.validation = runValidation();
    saveAndRender();
  });

  elements.saveResultButton.addEventListener("click", downloadCurrentSchedule);

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
  if (!state.schedule.length) {
    state.schedule = buildDraftSchedule();
  }
  const schedule = state.schedule;
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
  renderPreferenceSummary();
  renderCalendar(schedule);
  renderStats(schedule);
  saveState();
}

function renderOverrideList() {
  if (!state.overrides.length) {
    state.overrides.push({
      date: isoDate(state.year, state.month, 1),
      A: state.requirements.A,
      B: state.requirements.B,
      C: state.requirements.C
    });
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
    ...sampleEmployees.map((employee) => ({ id: employee.id, label: formatEmployeeName(employee) }))
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
  const firstWeekday = toMondayFirstIndex(new Date(state.year, state.month - 1, 1).getDay());
  const cells = CALENDAR_HEADER_LABELS.map((label, index) => `
    <div class="calendar-weekday ${isFocusColumn(index) ? "is-focus-day" : ""}">${label}</div>
  `);

  for (let index = 0; index < firstWeekday; index += 1) {
    const columnIndex = index % 7;
    cells.push(`<div class="calendar-cell is-empty ${isFocusColumn(columnIndex) ? "is-focus-day" : ""}"></div>`);
  }

  for (let day = 1; day <= days; day += 1) {
    const date = isoDate(state.year, state.month, day);
    const items = state.selectedView === "summary"
      ? buildSummaryItems(schedule, date)
      : buildEmployeeItems(schedule, date, state.selectedView);
    const columnIndex = (firstWeekday + day - 1) % 7;

    cells.push(`
      <article class="calendar-cell ${isFocusColumn(columnIndex) ? "is-focus-day" : ""}">
        <div class="calendar-date">
          <strong>${day}일</strong>
        </div>
        <div class="calendar-list">
          ${items.length ? items.map((item) => renderCalendarItem(item)).join("") : `<div class="calendar-item shift-OFF">미배정</div>`}
        </div>
      </article>
    `);
  }

  elements.calendarView.innerHTML = cells.join("");

  elements.calendarView.querySelectorAll("[data-entry-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const { entryDate, employeeId } = button.dataset;
      const isSame = state.editing?.date === entryDate && state.editing?.employeeId === employeeId;
      state.editing = isSame ? null : { date: entryDate, employeeId };
      saveAndRender();
    });
  });

  elements.calendarView.querySelectorAll("[data-edit-shift]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      updateShift(button.dataset.entryDate, button.dataset.employeeId, button.dataset.editShift);
    });
  });
}

function renderPreferenceSummary() {
  if (state.selectedView === "summary") {
    elements.preferenceSummary.innerHTML = "";
    return;
  }

  const employee = findEmployee(state.selectedView);
  const preferences = employee?.preferences ?? [];
  if (!preferences.length) {
    elements.preferenceSummary.innerHTML = `<span class="preference-chip">팀장은 선호도 입력 없음</span>`;
    return;
  }

  elements.preferenceSummary.innerHTML = preferences.map((shift, index) => `
    <span class="preference-chip shift-${shift}">${index + 1}순위 ${shift}</span>
  `).join("");
}

function buildSummaryItems(schedule, date) {
  return sampleEmployees.map((employee) => {
    const entry = schedule.find((item) => item.date === date && item.employeeId === employee.id);
    return {
      date,
      employeeId: employee.id,
      label: `${formatShift(entry?.shift ?? "OFF")}-${formatEmployeeName(employee)}`,
      shift: entry?.shift ?? "OFF",
      fixed: Boolean(entry?.fixed)
    };
  });
}

function buildEmployeeItems(schedule, date, employeeId) {
  const entry = schedule.find((item) => item.date === date && item.employeeId === employeeId);
  if (!entry) return [];
  return [{
    date,
    employeeId,
    label: entry.shift === "OFF" ? "휴" : `${entry.shift} 근무`,
    shift: entry.shift,
    fixed: Boolean(entry.fixed)
  }];
}

function renderStats(schedule) {
  const monthlyRequired = getRequiredTotals(false);
  const mwsRequired = getRequiredTotals(true);
  const monthlyEmployee = getEmployeeTotals(schedule, false);
  const mwsEmployee = getEmployeeTotals(schedule, true);
  const monthlyAbsence = getEmployeeAbsenceTotals(false);
  const mwsAbsence = getEmployeeAbsenceTotals(true);

  elements.combinedMonthlyStats.innerHTML = buildCombinedStatsTable("월 전체", monthlyRequired, monthlyEmployee, monthlyAbsence);
  elements.combinedMwsStats.innerHTML = buildCombinedStatsTable("월수토 전체", mwsRequired, mwsEmployee, mwsAbsence);
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
    return { name: formatEmployeeName(employee), ...totals };
  });
}

function getEmployeeAbsenceTotals(onlyFocusWeekdays) {
  return sampleEmployees.map((employee) => {
    const count = (employee.absences ?? []).filter((date) => {
      if (!onlyFocusWeekdays) return true;
      return FOCUS_WEEKDAYS.has(new Date(date).getDay());
    }).length;
    return { name: formatEmployeeName(employee), count };
  });
}

function buildCombinedStatsTable(totalLabel, requiredTotals, employeeRows, absenceRows) {
  const header = [totalLabel, ...employeeRows.map((row) => row.name)];
  const totalRequired = SHIFTS.reduce((sum, shift) => sum + requiredTotals[shift], 0);
  const totalAbsence = absenceRows.reduce((sum, row) => sum + row.count, 0);
  return `
    <table>
      <thead>
        <tr>
          <th>근무</th>
          ${header.map((label) => `<th>${label}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${SHIFTS.map((shift) => `
          <tr>
            <td>${shift}</td>
            <td>${requiredTotals[shift]}</td>
            ${employeeRows.map((row) => {
              const employee = sampleEmployees.find((item) => formatEmployeeName(item) === row.name);
              const preferenceClass = employee ? getPreferenceCellClass(employee, shift) : "";
              return `<td class="${preferenceClass}">${row[shift]}</td>`;
            }).join("")}
          </tr>
        `).join("")}
        <tr>
          <td>합계</td>
          <td>${totalRequired}</td>
          ${employeeRows.map((row) => `<td>${SHIFTS.reduce((sum, shift) => sum + row[shift], 0)}</td>`).join("")}
        </tr>
        <tr>
          <td>부재</td>
          <td class="absence-cell">${totalAbsence}</td>
          ${absenceRows.map((row) => `<td class="absence-cell">${row.count}</td>`).join("")}
        </tr>
      </tbody>
    </table>
  `;
}

function renderCalendarItem(item) {
  const isEditing = state.editing?.date === item.date && state.editing?.employeeId === item.employeeId;
  return `
    <div class="calendar-item shift-${item.shift} ${item.fixed ? "is-fixed" : ""} ${isEditing ? "is-editing" : ""}" data-entry-date="${item.date}" data-employee-id="${item.employeeId}">
      <div>${item.label}</div>
      ${isEditing ? `
        <div class="edit-popover">
          ${["A", "B", "C", "OFF"].map((shift) => `
            <button class="edit-choice choice-${shift}" data-entry-date="${item.date}" data-employee-id="${item.employeeId}" data-edit-shift="${shift}">
              ${formatShift(shift)}
            </button>
          `).join("")}
        </div>
      ` : ""}
    </div>
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
    const fixedAssignments = getFixedAssignmentsForDate(date);

    fixedAssignments.forEach((assignment) => {
      assignedIds.add(assignment.employeeId);
      schedule.push({ ...assignment, fixed: true });
    });

    SHIFTS.forEach((shift) => {
      let remaining = Math.max(0, required[shift] - fixedAssignments.filter((item) => item.shift === shift).length);
      for (let index = 0; index < sampleEmployees.length && remaining > 0; index += 1) {
        const employee = sampleEmployees[(index + day + shift.charCodeAt(0)) % sampleEmployees.length];
        if (assignedIds.has(employee.id)) continue;
        if (employee.role === "팀장" && shift !== "A") continue;
        assignedIds.add(employee.id);
        schedule.push({ date, employeeId: employee.id, shift, fixed: false });
        remaining -= 1;
      }
    });

    sampleEmployees.forEach((employee) => {
      if (!assignedIds.has(employee.id)) {
        schedule.push({ date, employeeId: employee.id, shift: "OFF", fixed: false });
      }
    });
  }

  return schedule;
}

function updateShift(date, employeeId, shift) {
  const target = state.schedule.find((entry) => entry.date === date && entry.employeeId === employeeId);
  if (!target) return;
  target.shift = shift;
  state.editing = null;
  saveAndRender();
}

function downloadCsvTemplate(type) {
  const templates = {
    employee: {
      filename: "제원데이터-양식.csv",
      rows: [
        ["작성안내", "선호도는 한 칸에 A/B/C 순서를 붙여 적습니다. 예: ACB 또는 BCA", "", "", "", "", "", "", "", "", ""],
        ["작성안내", "부재일정은 날짜를 &(앤드)로 구분합니다. 예: 2026-03-11&2026-03-18", "", "", "", "", "", "", "", "", ""],
        ["작성안내", "사전지정근무는 날짜와 근무를 2026-03-05(A)&2026-03-12(C) 형태로 적습니다.", "", "", "", "", "", "", "", "", ""],
        ["이름", "사번", "직책(팀장/일반)", "성숙도(1/2/3)", "선호도(예:ACB)", "근무가능시작(YYYY-MM-DD)", "근무가능종료(YYYY-MM-DD)", "부재일정(YYYY-MM-DD&YYYY-MM-DD)", "사전지정근무(YYYY-MM-DD(A)&YYYY-MM-DD(B))", "비고", ""],
        ["홍길동", "E001", "팀장", "3", "", "2026-03-01", "2026-03-31", "2026-03-11&2026-03-18", "2026-03-05(A)", "", ""],
        ["김영희", "E002", "일반", "2", "BCA", "2026-03-01", "2026-03-31", "2026-03-07&2026-03-21", "2026-03-09(B)&2026-03-25(A)", "", ""]
      ]
    },
    carryover: {
      filename: "전월근무데이터-양식.csv",
      rows: [
        ["작성안내", "첫 행 첫 칸에는 기준 연월을 적습니다. 예: 2026년 2월", "", "", "", ""],
        ["2026년 2월", "1일", "2일", "3일", "4일", "5일"],
        ["홍길동", "A", "휴", "A", "B", "휴"],
        ["김영희", "B", "C", "휴", "A", "A"]
      ]
    }
  };

  const template = templates[type];
  const csv = "\uFEFF" + template.rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = template.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCurrentSchedule() {
  const days = getDaysInMonth(state.year, state.month);
  const header = [`${state.year}년 ${state.month}월`, ...Array.from({ length: days }, (_, index) => `${index + 1}일`)];
  const rows = sampleEmployees.map((employee) => {
    const shifts = Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const date = isoDate(state.year, state.month, day);
      const entry = state.schedule.find((item) => item.date === date && item.employeeId === employee.id);
      return formatShift(entry?.shift ?? "OFF");
    });
    return [formatEmployeeName(employee), ...shifts];
  });
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `근무표-결과-${state.year}-${String(state.month).padStart(2, "0")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
    editing: null,
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

function formatShift(shift) {
  return shift === "OFF" ? "휴" : shift;
}

function formatEmployeeName(employee) {
  const tags = [];
  if (employee.role === "팀장") tags.push("T");
  if (employee.skill === 1) tags.push("N");
  return tags.length ? `${employee.name}${tags.join("")}` : employee.name;
}

function getPreferenceCellClass(employee, shift) {
  const rank = employee.preferences.indexOf(shift);
  if (rank === -1) return "";
  return `preference-cell shift-${shift} rank-${rank + 1}`;
}

function getFixedAssignmentsForDate(date) {
  return sampleFixedAssignments
    .filter((assignment) => assignment.date === date)
    .map((assignment) => ({ ...assignment }));
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

function toMondayFirstIndex(dayIndex) {
  return dayIndex === 0 ? 6 : dayIndex - 1;
}

function isFocusColumn(columnIndex) {
  return columnIndex === 0 || columnIndex === 2 || columnIndex === 5;
}
