/* =========================================================================
   Smart Customer Churn Prediction System - Main Application
   Business Value: Reduce churn by 15-20% through predictive intervention
   ========================================================================= */

const $ = id => document.getElementById(id);
const log = (msg, type = 'info') => {
  const logEl = $('logs');
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
  logEl.textContent += `[${timestamp}] ${prefix} ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg);
};

let rawData = [];
let processedData = { train: null, test: null, scaler: null };
let model = null;
let featureNames = [];
let stats = {};
let dataQualityInfo = {};
let charts = {};
let selectedNumericalVars = [];
let selectedCategoricalVars = [];
let confusionMatrix = { tp: 0, tn: 0, fp: 0, fn: 0 };

/* ========================================================================
   UTILITY FUNCTIONS
   ======================================================================== */

window.showEDATab = function(tabName) {
  document.querySelectorAll('.eda-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.eda-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
}

window.openModal = function(modalId) {
  document.getElementById(modalId).style.display = 'block';
}

window.closeModal = function(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
}

/* ========================================================================
   DATASET VIEWER FUNCTIONS
   ======================================================================== */

window.displayDataset = function(mode) {
  const table = $('datasetTable');
  const info = $('datasetInfo');

  let dataToShow = [];

  if (mode === 'all') {
    dataToShow = rawData;
    info.textContent = `Showing all ${rawData.length} rows`;
  } else if (mode === 'first10') {
    dataToShow = rawData.slice(0, 10);
    info.textContent = `Showing first 10 rows of ${rawData.length}`;
  } else if (mode === 'last10') {
    dataToShow = rawData.slice(-10);
    info.textContent = `Showing last 10 rows of ${rawData.length}`;
  }

  if (dataToShow.length === 0) return;

  const columns = Object.keys(dataToShow[0]);

  let html = '<thead><tr>';
  columns.forEach(col => {
    html += '<th>' + col + '</th>';
  });
  html += '</tr></thead><tbody>';

  dataToShow.forEach(row => {
    html += '<tr>';
    columns.forEach(col => {
      html += '<td>' + (row[col] || '') + '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody>';
  table.innerHTML = html;
}

window.closeDatasetViewer = function() {
  $('datasetViewer').style.display = 'none';
}

$('viewDatasetBtn').onclick = () => {
  $('datasetViewer').style.display = 'block';
  displayDataset('first10');
}

/* ========================================================================
   STEP 1: DATA LOADING & COMPREHENSIVE EDA
   ======================================================================== */

$('loadDataBtn').onclick = async () => {
  console.log('Button clicked!');
  const file = $('dataFile').files[0];

  if (!file) {
    alert('Please select a CSV file');
    log('No file selected', 'error');
    return;
  }

  log('Starting data load...', 'info');

  try {
    log('Reading file...', 'info');
    const text = await file.text();
    console.log('File read, length:', text.length);

    log('Parsing CSV...', 'info');
    rawData = parseCSV(text);
    console.log('Parsed rows:', rawData.length);

    if (rawData.length === 0) {
      throw new Error('No data found in CSV');
    }

    log(`✓ Loaded ${rawData.length} customer records`, 'success');

    $('edaTabs').style.display = 'flex';

    log('Starting EDA...', 'info');
    performComprehensiveEDA();

    log('Preprocessing data...', 'info');
    processedData = preprocessData(rawData);

    log('✓ Data preprocessing complete', 'success');
    log(`Training set: ${processedData.train.xs.shape[0]} samples`, 'info');
    log(`Test set: ${processedData.test.xs.shape[0]} samples`, 'info');

    $('trainBtn').disabled = false;
    $('viewDatasetBtn').style.display = 'inline-block';

  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    alert('Error loading data: ' + error.message);
    console.error('Full error:', error);
  }
};

function parseCSV(text) {
  try {
    const lines = text.trim().split('\n');
    console.log('Total lines:', lines.length);

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('Headers:', headers);

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length !== headers.length) continue;

      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      data.push(row);
    }

    console.log('Parsed data rows:', data.length);
    return data;
  } catch (error) {
    console.error('Parse error:', error);
    throw error;
  }
}

/* --------------  (TRUNCATED FOR BREVITY IN THIS EXAMPLE) --------------
   The full code continues with all the functions you provided in your
   message, including EDA, model training, prediction, batch prediction,
   visualization, and initialization logic.
   -------------------------------------------------------------------- */

/* ========================================================================
   INITIALIZATION
   ======================================================================== */

async function init() {
  try {
    await tf.ready();
    await tf.setBackend('webgl');
    log('✓ TensorFlow.js initialized', 'success');
    log('System ready. Upload data to begin.', 'info');
  } catch (error) {
    log('⚠️ Using CPU backend', 'warning');
  }
}

init();
