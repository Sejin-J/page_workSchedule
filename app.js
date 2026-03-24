const STORAGE_KEY = "workScheduleDraftState";
const SHIFTS = ["A", "B", "C"];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CALENDAR_HEADER_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const FOCUS_WEEKDAYS = new Set([1, 3, 6]);

const defaultEmployees = [
  { id: "E001", name: "김서연", role: "팀장", skill: 3, preferences: [], absences: ["2026-03-12"] },
  { id: "E002", name: "이도윤", role: "일반", skill: 3, preferences: ["A", "B", "C"], absences: ["2026-03-07", "2026-03-18"] },
  { id: "E003", name: "박지후", role: "일반", skill: 2, preferences: ["B", "A", "C"], absences: ["2026-03-10"] },
  { id: "E004", name: "정하은", role: "일반", skill: 2, preferences: ["C", "B", "A"], absences: ["2026-03-03", "2026-03-20"] },
  { id: "E005", name: "최유진", role: "일반", skill: 1, preferences: ["A", "C", "B"], absences: ["2026-03-18"] },
  { id: "E006", name: "오민재", role: "일반", skill: 3, preferences: ["B", "C", "A"], absences: [] },
  { id: "E007", name: "한지민", role: "일반", skill: 2, preferences: ["C", "A", "B"], absences: ["2026-03-01", "2026-03-26"] },
  { id: "E008", name: "윤태호", role: "일반", skill: 1, preferences: ["A", "B", "C"], absences: ["2026-03-15"] }
];

const defaultFixedAssignments = [
  { date: "2026-03-04", employeeId: "E001", shift: "A" },
  { date: "2026-03-10", employeeId: "E003", shift: "B" },
  { date: "2026-03-18", employeeId: "E005", shift: "C" }
];

const uploadedFileCache = {
  employee: null,
  carryover: null
};

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
  clearEmployeeFileButton: document.querySelector("#clearEmployeeFileButton"),
  clearCarryoverFileButton: document.querySelector("#clearCarryoverFileButton"),
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
  combinedStatsTable: document.querySelector("#combinedStatsTable")
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
  elements.clearEmployeeFileButton.addEventListener("click", () => clearUploadedFile("employee"));
  elements.clearCarryoverFileButton.addEventListener("click", () => clearUploadedFile("carryover"));

  elements.validateButton.addEventListener("click", handleValidateUploads);

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
    uploadedFileCache[key] = file ?? null;
    state.uploads[key] = file ? { name: file.name, size: file.size } : null;
    if (!file && key === "employee") {
      state.importedEmployees = null;
      state.importedFixedAssignments = null;
    }
    if (!file && key === "carryover") {
      state.importedCarryover = null;
    }
    saveAndRender();
  });
}

function render() {
  if (!state.schedule.length) {
    state.schedule = buildDraftSchedule();
  }
  const schedule = state.schedule;
  const employees = getActiveEmployees();
  if (state.selectedView !== "summary" && !employees.some((employee) => employee.id === state.selectedView)) {
    state.selectedView = "summary";
  }
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
  elements.employeeCountPill.textContent = `직원 ${employees.length}명`;

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
  const employees = getActiveEmployees();
  const tabs = [
    { id: "summary", label: "종합" },
    ...employees.map((employee) => ({ id: employee.id, label: formatEmployeeName(employee) }))
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
    const carryoverDate = getCarryoverDateForLeadCell(index, firstWeekday);
    if (carryoverDate) {
      const source = state.importedCarryover ?? [];
      const items = state.selectedView === "summary"
        ? buildSummaryItems(source, carryoverDate)
        : buildEmployeeItems(source, carryoverDate, state.selectedView);
      cells.push(`
        <article class="calendar-cell is-carryover ${isFocusColumn(columnIndex) ? "is-focus-day" : ""}">
          <div class="calendar-date">
            <strong>${new Date(carryoverDate).getDate()}일</strong>
          </div>
          <div class="calendar-list">
            ${items.length ? items.map((item) => renderCalendarItem(item)).join("") : `<div class="calendar-item shift-OFF">미배정</div>`}
          </div>
        </article>
      `);
    } else {
      cells.push(`<div class="calendar-cell is-empty ${isFocusColumn(columnIndex) ? "is-focus-day" : ""}"></div>`);
    }
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
  return getActiveEmployees().map((employee) => {
    const entry = schedule.find((item) => (
      item.date === date && (
        item.employeeId === employee.id ||
        normalizeName(item.name) === normalizeName(formatEmployeeName(employee)) ||
        normalizeName(item.name) === normalizeName(employee.name)
      )
    ));
    return {
      date,
      employeeId: employee.id,
      label: `${formatShift(entry?.shift ?? "OFF")}-${formatEmployeeName(employee)}`,
      shift: entry?.shift ?? "OFF",
      fixed: Boolean(entry?.fixed),
      absent: isEmployeeAbsentOnDate(employee.id, date)
    };
  });
}

function buildEmployeeItems(schedule, date, employeeId) {
  const employee = findEmployee(employeeId);
  const entry = schedule.find((item) => (
    item.date === date && (
      item.employeeId === employeeId ||
      normalizeName(item.name) === normalizeName(formatEmployeeName(employee)) ||
      normalizeName(item.name) === normalizeName(employee.name)
    )
  ));
  if (!entry) return [];
  return [{
    date,
    employeeId,
    label: entry.shift === "OFF" ? "휴" : `${entry.shift} 근무`,
    shift: entry.shift,
    fixed: Boolean(entry.fixed),
    absent: isEmployeeAbsentOnDate(employeeId, date)
  }];
}

function renderStats(schedule) {
  const monthlyRequired = getRequiredTotals(false);
  const mwsRequired = getRequiredTotals(true);
  const monthlyEmployee = getEmployeeTotals(schedule, false);
  const mwsEmployee = getEmployeeTotals(schedule, true);
  const monthlyAbsence = getEmployeeAbsenceTotals(false);
  const mwsAbsence = getEmployeeAbsenceTotals(true);

  elements.combinedStatsTable.innerHTML = buildCombinedStatsTable([
    { label: "전체", requiredTotals: monthlyRequired, employeeRows: monthlyEmployee, absenceRows: monthlyAbsence },
    { label: "월수토", requiredTotals: mwsRequired, employeeRows: mwsEmployee, absenceRows: mwsAbsence }
  ]);
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
  return getActiveEmployees().map((employee) => {
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
  return getActiveEmployees().map((employee) => {
    const count = (employee.absences ?? []).filter((date) => {
      if (!onlyFocusWeekdays) return true;
      return FOCUS_WEEKDAYS.has(new Date(date).getDay());
    }).length;
    return { name: formatEmployeeName(employee), count };
  });
}

function buildCombinedStatsTable(sections) {
  const header = ["구분", "근무", "전체", ...sections[0].employeeRows.map((row) => row.name)];
  return `
    <table class="stats-table">
      <thead>
        <tr>
          ${header.map((label, index) => `<th class="${index === 1 ? "divider-right" : ""}">${label}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${sections.map((section) => {
          const totalRequired = SHIFTS.reduce((sum, shift) => sum + section.requiredTotals[shift], 0);
          const totalAbsence = section.absenceRows.reduce((sum, row) => sum + row.count, 0);
          const shiftRows = SHIFTS.map((shift, index) => `
            <tr class="stats-row ${index === 0 ? "section-start" : ""}">
              ${index === 0 ? `<td rowspan="5" class="section-label">${section.label}</td>` : ""}
              <td class="metric-label divider-right">${shift}</td>
              <td class="total-cell">${section.requiredTotals[shift]}</td>
              ${section.employeeRows.map((row) => `<td>${row[shift]}</td>`).join("")}
            </tr>
          `).join("");

          return `
            ${shiftRows}
            <tr class="summary-row">
              <td class="metric-label divider-right">합계</td>
              <td class="total-cell">${totalRequired}</td>
              ${section.employeeRows.map((row) => `<td class="total-cell">${SHIFTS.reduce((sum, shift) => sum + row[shift], 0)}</td>`).join("")}
            </tr>
            <tr class="absence-row">
              <td class="metric-label divider-right">부재</td>
              <td class="absence-cell">${totalAbsence}</td>
              ${section.absenceRows.map((row) => `<td class="absence-cell">${row.count}</td>`).join("")}
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderCalendarItem(item) {
  const isEditing = state.editing?.date === item.date && state.editing?.employeeId === item.employeeId;
  return `
    <div class="calendar-item shift-${item.shift} ${item.fixed ? "is-fixed" : ""} ${item.absent ? "is-absence" : ""} ${isEditing ? "is-editing" : ""}" data-entry-date="${item.date}" data-employee-id="${item.employeeId}">
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
  if (validation.summary) {
    return validation.summary;
  }
  if (!validation.errors.length && !validation.warnings.length) {
    return "샘플 데이터 기준으로 검증 가능한 기본 형식입니다.";
  }
  if (validation.errors.length) {
    return `오류 ${validation.errors.length}건 / 경고 ${validation.warnings.length}건`;
  }
  return `경고 ${validation.warnings.length}건`;
}

async function handleValidateUploads() {
  const employeeFile = elements.employeeFileInput.files?.[0] ?? uploadedFileCache.employee;
  const carryoverFile = elements.carryoverFileInput.files?.[0] ?? uploadedFileCache.carryover;

  if (!employeeFile || !carryoverFile) {
    state.validation = {
      errors: ["제원 데이터와 전월 근무 데이터 파일을 모두 업로드해야 합니다."],
      warnings: [],
      summary: "오류 1건 / 파일 2개를 모두 업로드해주세요."
    };
    saveAndRender();
    return;
  }

  elements.validationSummary.textContent = "검증 중...";

  try {
    const [employeeText, carryoverText] = await Promise.all([employeeFile.text(), carryoverFile.text()]);
    const employeeValidation = validateEmployeeCsv(employeeText);
    const carryoverValidation = validateCarryoverCsv(carryoverText);

    state.validation = {
      errors: [...employeeValidation.errors, ...carryoverValidation.errors],
      warnings: [...employeeValidation.warnings, ...carryoverValidation.warnings]
    };

    if (!state.validation.errors.length) {
      state.importedEmployees = employeeValidation.employees;
      state.importedFixedAssignments = employeeValidation.fixedAssignments;
      state.importedCarryover = carryoverValidation.schedule;
      state.schedule = [];
    }

    const employeeCount = employeeValidation.employees.length;
    const carryoverRows = carryoverValidation.schedule.length;
    state.validation.summary = state.validation.errors.length
      ? `오류 ${state.validation.errors.length}건 / 경고 ${state.validation.warnings.length}건`
      : `검증 완료: 제원 ${employeeCount}명, 전월 데이터 ${carryoverRows}행`;
  } catch (error) {
    state.validation = {
      errors: ["CSV 읽기 중 오류가 발생했습니다."],
      warnings: [],
      summary: `검증 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
    };
  }

  saveAndRender();
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
  if (state.requirements.A + state.requirements.B + state.requirements.C > getActiveEmployees().length) {
    warnings.push("기본 최소 필요 인원이 샘플 직원 수보다 많습니다.");
  }

  return { errors, warnings };
}

function clearUploadedFile(key) {
  if (key === "employee") {
    elements.employeeFileInput.value = "";
    uploadedFileCache.employee = null;
    state.uploads.employee = null;
    state.importedEmployees = null;
    state.importedFixedAssignments = null;
  }
  if (key === "carryover") {
    elements.carryoverFileInput.value = "";
    uploadedFileCache.carryover = null;
    state.uploads.carryover = null;
    state.importedCarryover = null;
  }
  state.validation = { errors: [], warnings: [], summary: "업로드 파일이 제거되었습니다." };
  state.schedule = [];
  saveAndRender();
}

function validateEmployeeCsv(text) {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
  const headerIndex = rows.findIndex((row) => row[0]?.trim() === "이름");
  const errors = [];
  const warnings = [];

  if (headerIndex === -1) {
    return { employees: [], fixedAssignments: [], errors: ["제원 데이터 헤더 행을 찾지 못했습니다."], warnings };
  }

  const dataRows = rows.slice(headerIndex + 1);
  const employees = [];
  const fixedAssignments = [];
  const ids = new Set();

  dataRows.forEach((row, index) => {
    if (!row[0]?.trim()) return;
    const line = index + headerIndex + 2;
    const [name, id, role, skillRaw, preferenceRaw, start, end, absencesRaw, fixedRaw] = row;
    const skill = Number(skillRaw);

    if (!name || !id) errors.push(`제원 데이터 ${line}행: 이름과 사번은 필수입니다.`);
    if (!["팀장", "일반"].includes(role)) errors.push(`제원 데이터 ${line}행: 직책은 팀장/일반만 가능합니다.`);
    if (![1, 2, 3].includes(skill)) errors.push(`제원 데이터 ${line}행: 성숙도는 1/2/3만 가능합니다.`);
    if (ids.has(id)) errors.push(`제원 데이터 ${line}행: 사번 ${id}가 중복됩니다.`);
    ids.add(id);
    if (!isValidDateString(start) || !isValidDateString(end)) errors.push(`제원 데이터 ${line}행: 근무 가능 시작/종료일 형식이 올바르지 않습니다.`);

    const preferences = role === "팀장" || !preferenceRaw ? [] : preferenceRaw.trim().split("");
    if (role !== "팀장") {
      if (preferences.length !== 3 || new Set(preferences).size !== 3 || preferences.some((value) => !SHIFTS.includes(value))) {
        errors.push(`제원 데이터 ${line}행: 선호도는 A/B/C를 한 번씩 포함한 3글자여야 합니다.`);
      }
    }

    const absences = parseAmpersandDates(absencesRaw, line, "부재일정", errors);
    const fixed = parseFixedAssignments(fixedRaw, id, line, errors);
    fixedAssignments.push(...fixed);

    employees.push({
      id,
      name,
      role,
      skill,
      preferences,
      absences
    });
  });

  if (!employees.length) warnings.push("제원 데이터에 직원 행이 없습니다.");
  return { employees, fixedAssignments, errors, warnings };
}

function validateCarryoverCsv(text) {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
  const errors = [];
  const warnings = [];

  if (!rows.length) {
    return { schedule: [], errors: ["전월 근무 데이터가 비어 있습니다."], warnings };
  }

  const header = rows[0];
  const days = header.slice(1).filter(Boolean);
  const yearMonthMatch = header[0]?.match(/(\d{4})년\s*(\d{1,2})월/);
  if (!yearMonthMatch) errors.push("전월 근무 데이터 첫 칸에는 기준 연월이 필요합니다. 예: 2026년 2월");
  if (!days.length) errors.push("전월 근무 데이터에는 일자 헤더가 필요합니다.");
  const carryoverYear = yearMonthMatch ? Number(yearMonthMatch[1]) : state.year;
  const carryoverMonth = yearMonthMatch ? Number(yearMonthMatch[2]) : state.month;

  const schedule = [];
  rows.slice(1).forEach((row, rowIndex) => {
    const name = row[0]?.trim();
    if (!name) return;
    row.slice(1).forEach((shift, dayIndex) => {
      const value = shift?.trim();
      if (!["A", "B", "C", "휴"].includes(value)) {
        errors.push(`전월 근무 데이터 ${rowIndex + 2}행 ${dayIndex + 2}열: 근무는 A/B/C/휴만 가능합니다.`);
      } else {
        schedule.push({
          date: isoDate(carryoverYear, carryoverMonth, dayIndex + 1),
          name,
          shift: value === "휴" ? "OFF" : value,
          fixed: false
        });
      }
    });
  });

  return { schedule, errors, warnings };
}

function parseCsv(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const lines = normalized.split("\n");
  return lines.map(parseCsvLine);
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseAmpersandDates(rawValue, line, label, errors) {
  if (!rawValue?.trim()) return [];
  return rawValue.split("&").map((value) => value.trim()).filter(Boolean).filter((value) => {
    const valid = isValidDateString(value);
    if (!valid) errors.push(`제원 데이터 ${line}행: ${label} 날짜 형식이 올바르지 않습니다.`);
    return valid;
  });
}

function parseFixedAssignments(rawValue, employeeId, line, errors) {
  if (!rawValue?.trim()) return [];
  return rawValue.split("&").map((value) => value.trim()).filter(Boolean).flatMap((value) => {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})\(([ABC])\)$/);
    if (!matched) {
      errors.push(`제원 데이터 ${line}행: 사전지정근무 형식은 YYYY-MM-DD(A) 이어야 합니다.`);
      return [];
    }
    return [{ date: matched[1], employeeId, shift: matched[2] }];
  });
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test((value ?? "").trim());
}

function buildDraftSchedule() {
  const employees = getActiveEmployees();
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
      for (let index = 0; index < employees.length && remaining > 0; index += 1) {
        const employee = employees[(index + day + shift.charCodeAt(0)) % employees.length];
        if (assignedIds.has(employee.id)) continue;
        if (employee.role === "팀장" && shift !== "A") continue;
        assignedIds.add(employee.id);
        schedule.push({ date, employeeId: employee.id, shift, fixed: false });
        remaining -= 1;
      }
    });

    employees.forEach((employee) => {
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
        ["작성안내", "선호도는 한 칸에 A/B/C 순서를 붙여 적습니다. 예: ACB, BCA 등", "", "", "", "", "", "", "", "", ""],
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
        ["2026년 2월", "1일", "2일", "3일", "4일", "5일", "6일", "7일"],
        ["김서연T", "A", "휴", "A", "A", "휴", "A", "휴"],
        ["이도윤", "B", "C", "휴", "A", "A", "B", "휴"],
        ["박지후", "휴", "B", "B", "휴", "C", "A", "휴"],
        ["정하은", "C", "휴", "A", "B", "휴", "C", "B"]
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
  const employees = getActiveEmployees();
  const header = [`${state.year}년 ${state.month}월`, ...Array.from({ length: days }, (_, index) => `${index + 1}일`)];
  const rows = employees.map((employee) => {
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
    importedEmployees: null,
    importedFixedAssignments: null,
    importedCarryover: null,
    selectedView: "summary",
    editing: null,
    schedule: []
  };
}

function getActiveEmployees() {
  return state.importedEmployees?.length ? state.importedEmployees : defaultEmployees;
}

function findEmployee(employeeId) {
  return getActiveEmployees().find((employee) => employee.id === employeeId);
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


function getFixedAssignmentsForDate(date) {
  const source = state.importedFixedAssignments?.length ? state.importedFixedAssignments : defaultFixedAssignments;
  return source
    .filter((assignment) => assignment.date === date)
    .map((assignment) => ({ ...assignment }));
}

function isEmployeeAbsentOnDate(employeeId, date) {
  const employee = findEmployee(employeeId);
  return Boolean(employee?.absences?.includes(date));
}

function getCarryoverDateForLeadCell(index, firstWeekday) {
  if (!state.importedCarryover?.length) return null;
  const firstDate = new Date(state.year, state.month - 1, 1);
  const carryoverDate = new Date(firstDate);
  carryoverDate.setDate(firstDate.getDate() - (firstWeekday - index));
  return isoDate(carryoverDate.getFullYear(), carryoverDate.getMonth() + 1, carryoverDate.getDate());
}

function normalizeName(value) {
  return (value ?? "").replace(/\s+/g, "").trim();
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
