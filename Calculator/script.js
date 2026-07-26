const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const keys = document.querySelector('.calculator__keys');

const state = {
  currentInput: '0',
  storedValue: null,
  pendingOperator: null,
  expressionParts: [],
  lastAction: 'clear',
  error: false,
};

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return 'Error';
  }

  const absolute = Math.abs(value);
  if ((absolute !== 0 && absolute < 1e-9) || absolute >= 1e12) {
    return value.toExponential(6).replace(/0+e/, 'e').replace(/\.e/, 'e');
  }

  const compact = Number(value.toPrecision(12)).toString();
  return compact.length > 14 ? Number(value).toExponential(6) : compact;
}

function normalizeInput(input) {
  if (input === '-0') {
    return '0';
  }

  return input.endsWith('.') ? input.slice(0, -1) : input;
}

function getCurrentValue() {
  return Number(normalizeInput(state.currentInput));
}

function calculate(left, operator, right) {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return right === 0 ? Number.NaN : left / right;
    default:
      return right;
  }
}

function buildExpressionText() {
  if (state.error) {
    return 'Error';
  }

  if (state.expressionParts.length === 0) {
    return state.currentInput;
  }

  const parts = [...state.expressionParts];
  if (state.lastAction !== 'operator' && state.lastAction !== 'equals') {
    parts.push(state.currentInput);
  }

  return parts.join(' ');
}

function render() {
  expressionEl.textContent = buildExpressionText();
  resultEl.textContent = state.error ? 'Error' : state.currentInput;
}

function resetAll() {
  state.currentInput = '0';
  state.storedValue = null;
  state.pendingOperator = null;
  state.expressionParts = [];
  state.lastAction = 'clear';
  state.error = false;
  render();
}

function setError() {
  state.currentInput = 'Error';
  state.storedValue = null;
  state.pendingOperator = null;
  state.expressionParts = [];
  state.lastAction = 'error';
  state.error = true;
  render();
}

function appendDigit(digit) {
  if (state.error) {
    resetAll();
  }

  if (state.lastAction === 'equals') {
    state.currentInput = digit;
    state.storedValue = null;
    state.pendingOperator = null;
    state.expressionParts = [];
  } else if (state.lastAction === 'operator') {
    state.currentInput = digit;
  } else if (state.currentInput === '0') {
    state.currentInput = digit;
  } else if (state.currentInput === '-0') {
    state.currentInput = `-${digit}`;
  } else {
    state.currentInput += digit;
  }

  state.lastAction = 'digit';
  render();
}

function appendDecimal() {
  if (state.error) {
    resetAll();
  }

  if (state.lastAction === 'equals') {
    state.currentInput = '0.';
    state.storedValue = null;
    state.pendingOperator = null;
    state.expressionParts = [];
  } else if (state.lastAction === 'operator') {
    state.currentInput = '0.';
  } else if (!state.currentInput.includes('.')) {
    state.currentInput = `${state.currentInput}.`;
  }

  state.lastAction = 'digit';
  render();
}

function clearEntry() {
  if (state.error) {
    resetAll();
    return;
  }

  state.currentInput = '0';
  state.lastAction = 'clear';
  render();
}

function backspace() {
  if (state.error || state.lastAction === 'equals') {
    resetAll();
    return;
  }

  if (state.currentInput.length <= 1 || (state.currentInput.length === 2 && state.currentInput.startsWith('-'))) {
    state.currentInput = '0';
  } else {
    state.currentInput = state.currentInput.slice(0, -1);
  }

  state.lastAction = 'digit';
  render();
}

function toggleNegative() {
  if (state.currentInput === '0') {
    state.currentInput = '-0';
  } else if (state.currentInput.startsWith('-')) {
    state.currentInput = state.currentInput.slice(1);
  } else {
    state.currentInput = `-${state.currentInput}`;
  }

  state.lastAction = 'digit';
  render();
}

function seedExpression(operator) {
  state.storedValue = getCurrentValue();
  state.pendingOperator = operator;
  state.expressionParts = [normalizeInput(state.currentInput), operator];
  state.lastAction = 'operator';
  render();
}

function handleOperator(operator) {
  if (state.error) {
    resetAll();
  }

  if (state.currentInput === '0' && state.storedValue === null && operator === '-') {
    toggleNegative();
    return;
  }

  if (state.lastAction === 'operator' && state.expressionParts.length > 0) {
    state.pendingOperator = operator;
    state.expressionParts[state.expressionParts.length - 1] = operator;
    render();
    return;
  }

  if (state.lastAction === 'equals') {
    seedExpression(operator);
    return;
  }

  if (state.storedValue === null) {
    seedExpression(operator);
    return;
  }

  const leftValue = state.storedValue;
  const rightValue = getCurrentValue();
  const computed = calculate(leftValue, state.pendingOperator, rightValue);

  if (!Number.isFinite(computed)) {
    setError();
    return;
  }

  state.storedValue = computed;
  state.currentInput = formatNumber(computed);
  state.expressionParts = [...state.expressionParts, normalizeInput(String(rightValue)), operator];
  state.pendingOperator = operator;
  state.lastAction = 'operator';
  render();
}

function equals() {
  if (state.error) {
    resetAll();
    return;
  }

  if (state.pendingOperator === null || state.lastAction === 'operator') {
    render();
    return;
  }

  const leftValue = state.storedValue ?? getCurrentValue();
  const rightValue = getCurrentValue();
  const computed = calculate(leftValue, state.pendingOperator, rightValue);

  if (!Number.isFinite(computed)) {
    setError();
    return;
  }

  if (state.expressionParts.length === 0) {
    state.expressionParts = [normalizeInput(String(leftValue)), state.pendingOperator, normalizeInput(String(rightValue)), '='];
  } else {
    state.expressionParts = [...state.expressionParts, normalizeInput(String(rightValue)), '='];
  }

  state.currentInput = formatNumber(computed);
  state.storedValue = computed;
  state.pendingOperator = null;
  state.lastAction = 'equals';
  render();
}

function flashKey(keyElement) {
  keyElement.classList.add('is-pressed');
  window.setTimeout(() => keyElement.classList.remove('is-pressed'), 120);
}

keys.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  flashKey(button);
  const { action, value, operator } = button.dataset;

  switch (action) {
    case 'digit':
      appendDigit(value);
      break;
    case 'decimal':
      appendDecimal();
      break;
    case 'operator':
      handleOperator(operator);
      break;
    case 'equals':
      equals();
      break;
    case 'clear':
      clearEntry();
      break;
    case 'ac':
      resetAll();
      break;
    case 'backspace':
      backspace();
      break;
    default:
      break;
  }
});

document.addEventListener('keydown', (event) => {
  const { key } = event;

  if (/^[0-9]$/.test(key)) {
    appendDigit(key);
    return;
  }

  if (key === '.') {
    appendDecimal();
    return;
  }

  if (key === '+' || key === '-' || key === '*' || key === '/') {
    event.preventDefault();
    handleOperator(key);
    return;
  }

  if (key === 'Enter' || key === '=') {
    event.preventDefault();
    equals();
    return;
  }

  if (key === 'Backspace') {
    event.preventDefault();
    backspace();
    return;
  }

  if (key === 'Escape') {
    event.preventDefault();
    resetAll();
  }
});

resetAll();
