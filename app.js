/* =========================================================================
   Smart Customer Churn Prediction System - Enhanced Application
   Business Value: Reduce churn by 15-20% through predictive intervention
   Target Accuracy: 93-95%
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
let trainingHistory = null;

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
    info.textContent = `📊 Showing all ${rawData.length} rows`;
  } else if (mode === 'first10') {
    dataToShow = rawData.slice(0, 10);
    info.textContent = `📊 Showing first 10 rows of ${rawData.length} total`;
  } else if (mode === 'last10') {
    dataToShow = rawData.slice(-10);
    info.textContent = `📊 Showing last 10 rows of ${rawData.length} total`;
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

    log('Starting comprehensive EDA...', 'info');
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

/* ========================================================================
   COMPREHENSIVE EDA
   ======================================================================== */

function performComprehensiveEDA() {
  log('Performing comprehensive EDA...', 'info');

  // Analyze data quality
  analyzeDataQuality();

  // Analyze numerical variables
  analyzeNumericalVariables();

  // Analyze categorical variables
  analyzeCategoricalVariables();

  // Analyze correlations
  analyzeCorrelations();

  // Analyze churn distribution
  analyzeChurnDistribution();

  log('✓ EDA complete', 'success');
}
// Ensure global visibility in case of scope issues
window.performComprehensiveEDA = performComprehensiveEDA;

function analyzeDataQuality() {
  const totalRows = rawData.length;
  const columns = Object.keys(rawData[0]);
  const totalCells = totalRows * columns.length;

  let missingCount = 0;
  let duplicateCount = 0;
  const missingByColumn = {};

  // Check missing values
  columns.forEach(col => {
    missingByColumn[col] = 0;
    rawData.forEach(row => {
      if (!row[col] || row[col] === '' || row[col] === 'NA') {
        missingCount++;
        missingByColumn[col]++;
      }
    });
  });

  // Check duplicates (simplified)
  const uniqueRows = new Set(rawData.map(row => JSON.stringify(row)));
  duplicateCount = totalRows - uniqueRows.size;

  const missingPercent = ((missingCount / totalCells) * 100).toFixed(2);

  dataQualityInfo = {
    totalRows,
    totalColumns: columns.length,
    missingCount,
    missingPercent,
    duplicateCount,
    missingByColumn
  };

  // Display data quality
  const qualityHTML = `
    <div class="data-quality-grid">
      <div class="quality-card">
        <h4>📊 Total Rows</h4>
        <div class="quality-value">${totalRows}</div>
        <div class="quality-status good">Dataset Size</div>
      </div>
      <div class="quality-card">
        <h4>📋 Total Columns</h4>
        <div class="quality-value">${columns.length}</div>
        <div class="quality-status good">Features</div>
      </div>
      <div class="quality-card">
        <h4>❓ Missing Values</h4>
        <div class="quality-value">${missingCount}</div>
        <div class="quality-status ${missingPercent > 5 ? 'warning' : 'good'}">${missingPercent}%</div>
      </div>
      <div class="quality-card">
        <h4>🔄 Duplicates</h4>
        <div class="quality-value">${duplicateCount}</div>
        <div class="quality-status ${duplicateCount > 0 ? 'warning' : 'good'}">${duplicateCount === 0 ? 'None' : 'Found'}</div>
      </div>
    </div>
    <div style="margin-top: 20px;">
      <h4>Missing Values by Column:</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>Column</th>
            <th>Missing Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${columns.map(col => `
            <tr>
              <td>${col}</td>
              <td>${missingByColumn[col]}</td>
              <td>${((missingByColumn[col] / totalRows) * 100).toFixed(2)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  $('dataQualityContent').innerHTML = qualityHTML;
}

function analyzeNumericalVariables() {
  const numericalCols = identifyNumericalColumns();
  
  let html = '<div class="eda-stats">';
  
  // Show statistics for first 3 numerical variables
  numericalCols.slice(0, 3).forEach(col => {
    const values = rawData.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
    const stats = calculateStats(values);
    
    html += `
      <div class="metric-card">
        <h4>${col}</h4>
        <div style="text-align: left; margin-top: 10px;">
          <div><strong>Mean:</strong> ${stats.mean.toFixed(2)}</div>
          <div><strong>Median:</strong> ${stats.median.toFixed(2)}</div>
          <div><strong>Std Dev:</strong> ${stats.std.toFixed(2)}</div>
          <div><strong>Min:</strong> ${stats.min.toFixed(2)}</div>
          <div><strong>Max:</strong> ${stats.max.toFixed(2)}</div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  // Create initial visualizations
  numericalCols.slice(0, 3).forEach(col => {
    html += createNumericalChart(col);
  });
  
  $('numericalContent').innerHTML = html;
  
  // Render charts
  setTimeout(() => {
    numericalCols.slice(0, 3).forEach(col => {
      renderNumericalChart(col);
    });
  }, 100);
  
  // Setup variable selector
  setupNumericalSelector(numericalCols.slice(3));
}

function setupNumericalSelector(availableVars) {
  const selector = $('numericalVariableSelector');
  let html = '';
  
  availableVars.forEach(varName => {
    html += `
      <div class="variable-option" onclick="toggleNumericalVariable('${varName}')">
        <div class="variable-checkbox"></div>
        <span>${varName}</span>
      </div>
    `;
  });
  
  selector.innerHTML = html;
}

window.toggleNumericalVariable = function(varName) {
  const index = selectedNumericalVars.indexOf(varName);
  if (index > -1) {
    selectedNumericalVars.splice(index, 1);
  } else {
    selectedNumericalVars.push(varName);
  }
  
  // Update UI
  const options = document.querySelectorAll('#numericalVariableSelector .variable-option');
  options.forEach(opt => {
    const span = opt.querySelector('span');
    if (span && span.textContent === varName) {
      opt.classList.toggle('selected');
    }
  });
}

window.visualizeSelectedNumerical = function() {
  if (selectedNumericalVars.length === 0) {
    alert('Please select at least one variable to visualize');
    return;
  }
  
  let html = '<h4 style="color: #667eea; margin: 20px 0;">Additional Numerical Variables:</h4>';
  
  selectedNumericalVars.forEach(col => {
    html += createNumericalChart(col);
  });
  
  $('additionalNumericalCharts').innerHTML = html;
  
  // Render charts
  setTimeout(() => {
    selectedNumericalVars.forEach(col => {
      renderNumericalChart(col);
    });
  }, 100);
}

function createNumericalChart(colName) {
  return `
    <div style="margin: 20px 0;">
      <h4 style="color: #667eea;">${colName} Distribution</h4>
      <div class="chart-container">
        <canvas id="chart_${colName.replace(/\s/g, '_')}"></canvas>
      </div>
    </div>
  `;
}

function renderNumericalChart(colName) {
  const canvasId = `chart_${colName.replace(/\s/g, '_')}`;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const values = rawData.map(row => parseFloat(row[colName])).filter(v => !isNaN(v));
  if (values.length === 0) return;
  
  // Create histogram
  const bins = 15;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / bins || 1;
  
  const histogram = new Array(bins).fill(0);
  const labels = [];
  
  for (let i = 0; i < bins; i++) {
    labels.push((min + i * binSize).toFixed(1));
  }
  
  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binSize), bins - 1);
    histogram[binIndex]++;
  });
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: colName,
        data: histogram,
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Frequency' }
        },
        x: {
          title: { display: true, text: colName }
        }
      }
    }
  });
}

function analyzeCategoricalVariables() {
  const categoricalCols = identifyCategoricalColumns();
  
  let html = '';
  
  // Show statistics for first 3 categorical variables
  categoricalCols.slice(0, 3).forEach(col => {
    html += `
      <div style="margin: 20px 0;">
        <h4 style="color: #667eea;">${col}</h4>
        <div class="chart-container">
          <canvas id="cat_chart_${col.replace(/\s/g, '_')}"></canvas>
        </div>
      </div>
    `;
  });
  
  $('categoricalContent').innerHTML = html;
  
  // Render charts
  setTimeout(() => {
    categoricalCols.slice(0, 3).forEach(col => {
      renderCategoricalChart(col);
    });
  }, 100);
  
  // Setup variable selector
  setupCategoricalSelector(categoricalCols.slice(3));
}

function setupCategoricalSelector(availableVars) {
  const selector = $('categoricalVariableSelector');
  let html = '';
  
  availableVars.forEach(varName => {
    html += `
      <div class="variable-option" onclick="toggleCategoricalVariable('${varName}')">
        <div class="variable-checkbox"></div>
        <span>${varName}</span>
      </div>
    `;
  });
  
  selector.innerHTML = html;
}

window.toggleCategoricalVariable = function(varName) {
  const index = selectedCategoricalVars.indexOf(varName);
  if (index > -1) {
    selectedCategoricalVars.splice(index, 1);
  } else {
    selectedCategoricalVars.push(varName);
  }
  
  // Update UI
  const options = document.querySelectorAll('#categoricalVariableSelector .variable-option');
  options.forEach(opt => {
    const span = opt.querySelector('span');
    if (span && span.textContent === varName) {
      opt.classList.toggle('selected');
    }
  });
}

window.visualizeSelectedCategorical = function() {
  if (selectedCategoricalVars.length === 0) {
    alert('Please select at least one variable to visualize');
    return;
  }
  
  let html = '<h4 style="color: #667eea; margin: 20px 0;">Additional Categorical Variables:</h4>';
  
  selectedCategoricalVars.forEach(col => {
    html += `
      <div style="margin: 20px 0;">
        <h4 style="color: #667eea;">${col}</h4>
        <div class="chart-container">
          <canvas id="cat_chart_${col.replace(/\s/g, '_')}"></canvas>
        </div>
      </div>
    `;
  });
  
  $('additionalCategoricalCharts').innerHTML = html;
  
  // Render charts
  setTimeout(() => {
    selectedCategoricalVars.forEach(col => {
      renderCategoricalChart(col);
    });
  }, 100);
}

function renderCategoricalChart(colName) {
  const canvasId = `cat_chart_${colName.replace(/\s/g, '_')}`;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  const valueCounts = {};
  rawData.forEach(row => {
    const val = row[colName];
    valueCounts[val] = (valueCounts[val] || 0) + 1;
  });
  
  const labels = Object.keys(valueCounts);
  const data = Object.values(valueCounts);
  
  const colors = [
    'rgba(102, 126, 234, 0.7)',
    'rgba(118, 75, 162, 0.7)',
    'rgba(72, 187, 120, 0.7)',
    'rgba(255, 193, 7, 0.7)',
    'rgba(220, 53, 69, 0.7)'
  ];
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right'
        }
      }
    }
  });
}

function analyzeCorrelations() {
  const numericalCols = identifyNumericalColumns();
  
  let html = '<p style="color: #6c757d;">Correlation analysis between numerical features and churn target.</p>';
  html += '<div class="chart-container" style="height: 400px;"><canvas id="correlationChart"></canvas></div>';
  
  $('correlationsContent').innerHTML = html;
  
  setTimeout(() => {
    renderCorrelationChart(numericalCols);
  }, 100);
}

function renderCorrelationChart(numericalCols) {
  const canvas = $('correlationChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Calculate correlations with churn
  const correlations = [];
  const labels = [];
  
  numericalCols.forEach(col => {
    const values = rawData.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
    const churnValues = rawData.map(row => row['Churn'] === 'Yes' ? 1 : 0);
    
    const corr = calculateCorrelation(values, churnValues);
    correlations.push(corr);
    labels.push(col);
  });
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Correlation with Churn',
        data: correlations,
        backgroundColor: correlations.map(c => c >= 0 ? 'rgba(72, 187, 120, 0.7)' : 'rgba(220, 53, 69, 0.7)'),
        borderColor: correlations.map(c => c >= 0 ? 'rgba(72, 187, 120, 1)' : 'rgba(220, 53, 69, 1)'),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: 'Correlation Coefficient' }
        }
      }
    }
  });
}

function analyzeChurnDistribution() {
  const churnCounts = { Yes: 0, No: 0 };
  rawData.forEach(row => {
    if (row['Churn'] === 'Yes') churnCounts.Yes++;
    else churnCounts.No++;
  });
  
  const total = churnCounts.Yes + churnCounts.No;
  const churnRate = ((churnCounts.Yes / total) * 100).toFixed(2);
  
  let html = `
    <div class="eda-stats">
      <div class="metric-card">
        <div class="metric-label">Churned Customers</div>
        <div class="metric-value" style="color: #dc3545;">${churnCounts.Yes}</div>
        <div style="color: #6c757d; margin-top: 5px;">${churnRate}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Retained Customers</div>
        <div class="metric-value" style="color: #28a745;">${churnCounts.No}</div>
        <div style="color: #6c757d; margin-top: 5px;">${(100 - churnRate).toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Churn Rate</div>
        <div class="metric-value">${churnRate}%</div>
        <div style="color: #6c757d; margin-top: 5px;">Target Variable</div>
      </div>
    </div>
    <div class="chart-container">
      <canvas id="churnDistChart"></canvas>
    </div>
  `;
  
  $('churnAnalysisContent').innerHTML = html;
  
  setTimeout(() => {
    const ctx = $('churnDistChart').getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Churned', 'Retained'],
        datasets: [{
          data: [churnCounts.Yes, churnCounts.No],
          backgroundColor: ['rgba(220, 53, 69, 0.7)', 'rgba(40, 167, 69, 0.7)'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }, 100);
}

/* ========================================================================
   HELPER FUNCTIONS
   ======================================================================== */

function identifyNumericalColumns() {
  const columns = Object.keys(rawData[0]);
  return columns.filter(col => {
    const sample = rawData[0][col];
    return !isNaN(parseFloat(sample)) && col !== 'Churn';
  });
}

function identifyCategoricalColumns() {
  const columns = Object.keys(rawData[0]);
  return columns.filter(col => {
    const sample = rawData[0][col];
    return isNaN(parseFloat(sample)) && col !== 'Churn';
  });
}

function calculateStats(values) {
  if (values.length === 0) return {mean:0, median:0, std:0, min:0, max:0};
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  
  return {
    mean,
    median,
    std,
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}

function calculateCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  
  let num = 0, denX = 0, denY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  
  return num / Math.sqrt(denX * denY || 1);
}

/* ========================================================================
   DATA PREPROCESSING
   ======================================================================== */

function preprocessData(data) {
  log('Preprocessing data...', 'info');

  // Extract features and labels
  const features = [];
  const labels = [];

  featureNames = ['tenure', 'MonthlyCharges', 'TotalCharges', 'Contract'];

  data.forEach(row => {
    if (!row.tenure || !row.MonthlyCharges || !row.TotalCharges || !row.Contract || !row.Churn) {
      return;
    }

    const feature = [
      parseFloat(row.tenure) || 0,
      parseFloat(row.MonthlyCharges) || 0,
      parseFloat(row.TotalCharges) || 0,
      encodeContract(row.Contract)
    ];

    const label = row.Churn === 'Yes' ? 1 : 0;

    features.push(feature);
    labels.push(label);
  });

  log(`Processed ${features.length} samples with ${featureNames.length} features`, 'info');

  // Split data
  const splitIndex = Math.floor(features.length * 0.8);
  const trainFeatures = features.slice(0, splitIndex);
  const testFeatures = features.slice(splitIndex);
  const trainLabels = labels.slice(0, splitIndex);
  const testLabels = labels.slice(splitIndex);

  // Normalize features (standardization)
  const scaler = fitScaler(trainFeatures);
  const trainFeaturesNorm = transform(trainFeatures, scaler);
  const testFeaturesNorm = transform(testFeatures, scaler);

  return {
    train: {
      xs: tf.tensor2d(trainFeaturesNorm),
      ys: tf.tensor2d(trainLabels.map(l => [l]))
    },
    test: {
      xs: tf.tensor2d(testFeaturesNorm),
      ys: tf.tensor2d(testLabels.map(l => [l]))
    },
    scaler: scaler
  };
}

function encodeContract(contract) {
  if (!contract) return 0;
  const c = contract.toLowerCase();
  if (c.includes('month')) return 0;
  if (c.includes('one') || c.includes('1')) return 1;
  if (c.includes('two') || c.includes('2')) return 2;
  return 0;
}

function fitScaler(data) {
  const numFeatures = data[0].length;
  const means = new Array(numFeatures).fill(0);
  const stds = new Array(numFeatures).fill(0);

  // Calculate means
  data.forEach(row => {
    row.forEach((val, idx) => {
      means[idx] += val;
    });
  });
  means.forEach((sum, idx) => {
    means[idx] = sum / data.length;
  });

  // Calculate standard deviations
  data.forEach(row => {
    row.forEach((val, idx) => {
      stds[idx] += Math.pow(val - means[idx], 2);
    });
  });
  stds.forEach((sum, idx) => {
    stds[idx] = Math.sqrt(sum / data.length);
  });

  return { means, stds };
}

function transform(data, scaler) {
  return data.map(row => {
    return row.map((val, idx) => {
      const std = scaler.stds[idx] === 0 ? 1 : scaler.stds[idx];
      return (val - scaler.means[idx]) / std;
    });
  });
}

/* ========================================================================
   STEP 2: ENHANCED MODEL TRAINING (TARGET: 93-95% ACCURACY)
   ======================================================================== */

$('trainBtn').onclick = async () => {
  if (!processedData.train) {
    alert('Please load and preprocess data first');
    return;
  }

  log('Starting enhanced model training...', 'info');
  $('trainBtn').disabled = true;

  try {
    // Create enhanced model architecture
    model = createEnhancedModel();
    log('✓ Enhanced model architecture created', 'success');
    log('Architecture: 5 layers with Batch Normalization & Dropout', 'info');

    // Train model
    const epochs = 150;
    const batchSize = 32;

    log(`Training for ${epochs} epochs...`, 'info');

    const history = await model.fit(processedData.train.xs, processedData.train.ys, {
      epochs: epochs,
      batchSize: batchSize,
      validationData: [processedData.test.xs, processedData.test.ys],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            log(`Epoch ${epoch + 1}/${epochs} - Loss: ${logs.loss.toFixed(4)}, Acc: ${(logs.acc * 100).toFixed(2)}%, Val Acc: ${(logs.val_acc * 100).toFixed(2)}%`, 'info');
          }
        }
      }
    });

    trainingHistory = history;

    // Evaluate model
    const evalResult = model.evaluate(processedData.test.xs, processedData.test.ys);
    const testLoss = await evalResult[0].data();
    const testAcc = await evalResult[1].data();

    log(`✓ Training complete!`, 'success');
    log(`Test Accuracy: ${(testAcc[0] * 100).toFixed(2)}%`, 'success');
    log(`Test Loss: ${testLoss[0].toFixed(4)}`, 'info');

    // Calculate confusion matrix
    await calculateConfusionMatrix();

    // Display metrics
    displayTrainingMetrics(testAcc[0], testLoss[0]);

    // Display feature importance
    displayFeatureImportance();

    // Display post-training analysis
    displayPostTrainingAnalysis(testAcc[0], testLoss[0]);

    // Enable prediction buttons
    $('predictBtn').disabled = false;
    $('batchPredictBtn').disabled = false;
    $('batchPredictFromFileBtn').disabled = false;

    evalResult[0].dispose();
    evalResult[1].dispose();

  } catch (error) {
    log(`Training error: ${error.message}`, 'error');
    console.error(error);
    $('trainBtn').disabled = false;
  }
};

function createEnhancedModel() {
  const inputShape = [processedData.train.xs.shape[1]];
  
  const model = tf.sequential();
  
  // Input layer with batch normalization
  model.add(tf.layers.dense({
    inputShape: inputShape,
    units: 128,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Hidden layer 1
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Hidden layer 2
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  // Hidden layer 3
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));
  
  // Compile with optimized settings
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  log('Model Summary:', 'info');
  model.summary();
  
  return model;
}

async function calculateConfusionMatrix() {
  const predictions = model.predict(processedData.test.xs);
  const predArray = await predictions.data();
  const labelArray = await processedData.test.ys.data();
  
  confusionMatrix = { tp: 0, tn: 0, fp: 0, fn: 0 };
  
  for (let i = 0; i < predArray.length; i++) {
    const pred = predArray[i] > 0.5 ? 1 : 0;
    const actual = labelArray[i];
    
    if (pred === 1 && actual === 1) confusionMatrix.tp++;
    else if (pred === 0 && actual === 0) confusionMatrix.tn++;
    else if (pred === 1 && actual === 0) confusionMatrix.fp++;
    else if (pred === 0 && actual === 1) confusionMatrix.fn++;
  }
  
  predictions.dispose();
  
  log(`Confusion Matrix - TP: ${confusionMatrix.tp}, TN: ${confusionMatrix.tn}, FP: ${confusionMatrix.fp}, FN: ${confusionMatrix.fn}`, 'info');
}

function displayTrainingMetrics(accuracy, loss) {
  const precision = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fp) || 0;
  const recall = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fn) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
  
  const html = `
    <div class="eda-stats">
      <div class="metric-card">
        <div class="metric-label">Accuracy</div>
        <div class="metric-value">${(accuracy * 100).toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Precision</div>
        <div class="metric-value">${(precision * 100).toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Recall</div>
        <div class="metric-value">${(recall * 100).toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">F1 Score</div>
        <div class="metric-value">${(f1Score * 100).toFixed(2)}%</div>
      </div>
    </div>
  `;
  
  $('trainingMetrics').innerHTML = html;
}

function displayFeatureImportance() {
  // Calculate feature importance based on weights
  const weights = model.layers[0].getWeights()[0];
  const weightsData = weights.dataSync();
  
  const importance = [];
  const numFeatures = featureNames.length;
  const unitsFirstLayer = weightsData.length / numFeatures;
  
  for (let i = 0; i < numFeatures; i++) {
    let sum = 0;
    for (let j = 0; j < unitsFirstLayer; j++) {
      sum += Math.abs(weightsData[i * unitsFirstLayer + j]);
    }
    importance.push({ feature: featureNames[i], importance: sum });
  }
  
  // Normalize to percentages
  const total = importance.reduce((sum, item) => sum + item.importance, 0);
  importance.forEach(item => {
    item.percentage = (item.importance / total) * 100;
  });
  
  // Sort by importance
  importance.sort((a, b) => b.percentage - a.percentage);
  
  let html = '<h3>🎯 Top Features Driving Churn Prediction</h3>';
  
  importance.forEach(item => {
    html += `
      <div class="feature-bar">
        <div class="feature-bar-label">${item.feature}</div>
        <div class="feature-bar-fill" style="width: ${item.percentage}%">
          <div class="feature-bar-value">${item.percentage.toFixed(1)}%</div>
        </div>
      </div>
    `;
  });
  
  $('featureImportance').innerHTML = html;
  
  weights.dispose();
}

function displayPostTrainingAnalysis(accuracy, loss) {
  const precision = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fp) || 0;
  const recall = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fn) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
  const specificity = confusionMatrix.tn / (confusionMatrix.tn + confusionMatrix.fp) || 0;
  
  let html = `
    <div class="analysis-grid">
      <!-- Confusion Matrix -->
      <div class="analysis-card">
        <h4>📊 Confusion Matrix</h4>
        <div class="confusion-matrix">
          <div class="confusion-cell corner"></div>
          <div class="confusion-cell header">Predicted No</div>
          <div class="confusion-cell header">Predicted Yes</div>
          
          <div class="confusion-cell row-label">Actual No</div>
          <div class="confusion-cell tn">
            <div>${confusionMatrix.tn}</div>
            <div style="font-size: 0.7em; margin-top: 5px;">True Negative</div>
          </div>
          <div class="confusion-cell fp">
            <div>${confusionMatrix.fp}</div>
            <div style="font-size: 0.7em; margin-top: 5px;">False Positive</div>
          </div>
          
          <div class="confusion-cell row-label">Actual Yes</div>
          <div class="confusion-cell fn">
            <div>${confusionMatrix.fn}</div>
            <div style="font-size: 0.7em; margin-top: 5px;">False Negative</div>
          </div>
          <div class="confusion-cell tp">
            <div>${confusionMatrix.tp}</div>
            <div style="font-size: 0.7em; margin-top: 5px;">True Positive</div>
          </div>
        </div>
      </div>
      
      <!-- Model Performance -->
      <div class="analysis-card">
        <h4>📈 Detailed Performance Metrics</h4>
        <table class="data-table">
          <tbody>
            <tr>
              <td><strong>Accuracy</strong></td>
              <td>${(accuracy * 100).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><strong>Precision</strong></td>
              <td>${(precision * 100).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><strong>Recall (Sensitivity)</strong></td>
              <td>${(recall * 100).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><strong>Specificity</strong></td>
              <td>${(specificity * 100).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><strong>F1 Score</strong></td>
              <td>${(f1Score * 100).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><strong>Test Loss</strong></td>
              <td>${loss.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Actionable Insights -->
      <div class="analysis-card" style="grid-column: 1 / -1;">
        <h4>💡 Actionable Business Insights</h4>
        ${generateActionableInsights(accuracy, precision, recall)}
      </div>
    </div>
  `;
  
  $('postTrainingAnalysis').innerHTML = html;
}

function generateActionableInsights(accuracy, precision, recall) {
  let insights = '<div>';
  
  // Insight 1: Model Performance
  if (accuracy >= 0.93) {
    insights += `
      <div class="insight-item">
        <strong>✅ Excellent Model Performance:</strong> The model achieves ${(accuracy * 100).toFixed(2)}% accuracy, 
        meeting our target of 93-95%. This provides reliable predictions for identifying at-risk customers.
      </div>
    `;
  } else if (accuracy >= 0.85) {
    insights += `
      <div class="insight-item">
        <strong>⚠️ Good Model Performance:</strong> The model achieves ${(accuracy * 100).toFixed(2)}% accuracy. 
        Consider collecting more data or feature engineering to reach the 93-95% target.
      </div>
    `;
  } else {
    insights += `
      <div class="insight-item">
        <strong>🔴 Model Needs Improvement:</strong> Current accuracy is ${(accuracy * 100).toFixed(2)}%. 
        Recommend: (1) More training data, (2) Additional features, (3) Hyperparameter tuning.
      </div>
    `;
  }
  
  // Insight 2: Precision interpretation
  insights += `
    <div class="insight-item">
      <strong>🎯 Precision Analysis:</strong> When the model predicts churn, it's correct ${(precision * 100).toFixed(2)}% of the time. 
      This means ${(precision * 100).toFixed(0)} out of 100 customers flagged as at-risk will actually churn, 
      making retention campaigns cost-effective.
    </div>
  `;
  
  // Insight 3: Recall interpretation
  insights += `
    <div class="insight-item">
      <strong>🔍 Recall Analysis:</strong> The model catches ${(recall * 100).toFixed(2)}% of all customers who will churn. 
      ${recall >= 0.80 ? 'This high recall ensures we identify most at-risk customers before they leave.' : 
      'Consider adjusting the prediction threshold to catch more potential churners.'}
    </div>
  `;
  
  // Insight 4: Business recommendations
  insights += `
    <div class="insight-item">
      <strong>💼 Recommended Actions:</strong>
      <ul style="margin-left: 20px; margin-top: 10px;">
        <li>Focus retention efforts on customers with churn probability > 70%</li>
        <li>Deploy personalized interventions 30-60 days before predicted churn</li>
        <li>Monitor model performance monthly and retrain quarterly with new data</li>
        <li>A/B test retention campaigns using model predictions vs. control group</li>
      </ul>
    </div>
  `;
  
  // Insight 5: ROI estimation
  const totalCustomers = rawData.length;
  const estimatedChurners = Math.round(totalCustomers * 0.27); // Typical churn rate
  const savedCustomers = Math.round(estimatedChurners * recall * 0.20); // 20% retention improvement
  
  insights += `
    <div class="insight-item">
      <strong>💰 Estimated ROI Impact:</strong> With ${totalCustomers} customers and this model's performance, 
      you could potentially save ${savedCustomers} customers from churning through targeted interventions, 
      protecting significant revenue and reducing acquisition costs.
    </div>
  `;
  
  insights += '</div>';
  return insights;
}

/* ========================================================================
   STEP 3: REAL-TIME PREDICTION
   ======================================================================== */

$('predictBtn').onclick = async () => {
  if (!model) {
    alert('Please train the model first');
    return;
  }

  const tenure = parseFloat($('tenure').value);
  const monthlyCharges = parseFloat($('monthlyCharges').value);
  const totalCharges = parseFloat($('totalCharges').value);
  const contract = parseInt($('contract').value);

  const features = [[tenure, monthlyCharges, totalCharges, contract]];
  const normalized = transform(features, processedData.scaler);
  const input = tf.tensor2d(normalized);

  const prediction = model.predict(input);
  const probability = (await prediction.data())[0];

  input.dispose();
  prediction.dispose();

  displayPredictionResult(probability, {
    tenure,
    monthlyCharges,
    totalCharges,
    contract
  });
};

function displayPredictionResult(probability, customerData) {
  const riskLevel = probability > 0.7 ? 'high' : probability > 0.4 ? 'medium' : 'low';
  const riskClass = `risk-${riskLevel}`;
  
  const contractTypes = ['Month-to-month', 'One year', 'Two year'];
  
  let html = `
    <div class="prediction-result ${riskClass}">
      <h3>🎯 Prediction Result</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
        <div>
          <strong>Churn Probability:</strong><br>
          <span style="font-size: 2em; font-weight: bold;">${(probability * 100).toFixed(2)}%</span>
        </div>
        <div>
          <strong>Risk Level:</strong><br>
          <span style="font-size: 1.5em; font-weight: bold; text-transform: uppercase;">${riskLevel}</span>
        </div>
      </div>
      
      <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h4>Customer Profile:</h4>
        <ul style="list-style: none; padding: 0;">
          <li>📅 Tenure: ${customerData.tenure} months</li>
          <li>💵 Monthly Charges: ${customerData.monthlyCharges}</li>
          <li>💰 Total Charges: ${customerData.totalCharges}</li>
          <li>📋 Contract: ${contractTypes[customerData.contract]}</li>
        </ul>
      </div>
      
      ${generateRetentionStrategy(probability, riskLevel, customerData)}
    </div>
  `;
  
  $('predictionResults').innerHTML = html;
}

function generateRetentionStrategy(probability, riskLevel, customerData) {
  let strategy = '<div class="retention-strategy">';
  strategy += '<h4>🎯 Recommended Retention Strategy</h4>';
  
  if (riskLevel === 'high') {
    strategy += `
      <p><strong>Immediate Action Required!</strong></p>
      <ul>
        <li>🎁 Offer 20-30% discount for next 3 months</li>
        <li>📞 Priority outreach from account manager within 48 hours</li>
        <li>🔄 Upgrade to longer contract with incentives</li>
        <li>💎 Exclusive premium features or loyalty rewards</li>
        <li>📊 Personalized service review and optimization</li>
      </ul>
    `;
  } else if (riskLevel === 'medium') {
    strategy += `
      <p><strong>Proactive Engagement Recommended</strong></p>
      <ul>
        <li>📧 Send personalized email with product tips and value highlights</li>
        <li>🎁 10-15% discount offer for contract renewal</li>
        <li>📊 Quarterly check-in to ensure satisfaction</li>
        <li>🌟 Showcase new features aligned with their usage patterns</li>
        <li>💬 Gather feedback through survey with small incentive</li>
      </ul>
    `;
  } else {
    strategy += `
      <p><strong>Maintain Positive Relationship</strong></p>
      <ul>
        <li>✅ Customer is in good standing - continue excellent service</li>
        <li>📈 Monitor usage patterns for any changes</li>
        <li>🎉 Acknowledge loyalty with thank-you communications</li>
        <li>💡 Share relevant product updates and best practices</li>
        <li>🤝 Annual satisfaction check-in</li>
      </ul>
    `;
  }
  
  strategy += '</div>';
  return strategy;
}

/* ========================================================================
   BATCH PREDICTION
   ======================================================================== */

$('batchPredictBtn').onclick = async () => {
  if (!model) {
    alert('Please train the model first');
    return;
  }
  
  log('Running batch prediction on test set...', 'info');
  
  // Get predictions for all test samples
  const predictions = model.predict(processedData.test.xs);
  const probabilities = await predictions.data();
  const testLabels = await processedData.test.ys.data();
  
  // Get original feature values for test set
  const splitIndex = Math.floor(rawData.length * 0.8);
  const testData = rawData.slice(splitIndex);
  
  // Find top 10 at-risk customers
  const results = [];
  for (let i = 0; i < Math.min(10, probabilities.length); i++) {
    results.push({
      index: i,
      probability: probabilities[i],
      actual: testLabels[i],
      data: testData[i]
    });
  }
  
  // Sort by probability descending
  results.sort((a, b) => b.probability - a.probability);
  
  displayBatchResults(results.slice(0, 10));
  
  predictions.dispose();
  
  log('✓ Batch prediction complete', 'success');
};

$('batchPredictFromFileBtn').onclick = async () => {
  if (!model) {
    alert('Please train the model first');
    return;
  }
  
  const file = $('batchPredictionFile').files[0];
  if (!file) {
    alert('Please select a CSV file for batch prediction');
    return;
  }
  
  log('Reading batch prediction file...', 'info');
  
  try {
    const text = await file.text();
    const batchData = parseCSV(text);
    
    log(`Processing ${batchData.length} customers...`, 'info');
    
    // Extract features and normalize
    const features = [];
    const validData = [];
    
    batchData.forEach(row => {
      if (!row.tenure || !row.MonthlyCharges || !row.TotalCharges || !row.Contract) {
        return;
      }
      
      const feature = [
        parseFloat(row.tenure) || 0,
        parseFloat(row.MonthlyCharges) || 0,
        parseFloat(row.TotalCharges) || 0,
        encodeContract(row.Contract)
      ];
      
      features.push(feature);
      validData.push(row);
    });
    
    const normalized = transform(features, processedData.scaler);
    const input = tf.tensor2d(normalized);
    
    // Make predictions
    const predictions = model.predict(input);
    const probabilities = await predictions.data();
    
    // Prepare results
    const results = [];
    for (let i = 0; i < probabilities.length; i++) {
      results.push({
        index: i,
        probability: probabilities[i],
        data: validData[i]
      });
    }
    
    // Sort by probability descending
    results.sort((a, b) => b.probability - a.probability);
    
    displayBatchResults(results);
    
    input.dispose();
    predictions.dispose();
    
    log(`✓ Predicted churn for ${results.length} customers`, 'success');
    
  } catch (error) {
    log(`Error processing batch file: ${error.message}`, 'error');
    alert('Error processing file: ' + error.message);
  }
};

function displayBatchResults(results) {
  let html = '<h3>📊 Batch Prediction Results - Top At-Risk Customers</h3>';
  html += '<p style="color: #6c757d; margin-bottom: 15px;">Customers ranked by churn probability (highest risk first)</p>';
  
  html += '<table class="data-table">';
  html += '<thead><tr>';
  html += '<th>Rank</th>';
  html += '<th>Customer ID</th>';
  html += '<th>Churn Probability</th>';
  html += '<th>Risk Level</th>';
  html += '<th>Tenure</th>';
  html += '<th>Monthly Charges</th>';
  html += '<th>Contract</th>';
  html += '</tr></thead><tbody>';
  
  results.forEach((result, index) => {
    const riskLevel = result.probability > 0.7 ? '🔴 HIGH' : result.probability > 0.4 ? '🟡 MEDIUM' : '🟢 LOW';
    const riskColor = result.probability > 0.7 ? '#dc3545' : result.probability > 0.4 ? '#ffc107' : '#28a745';
    
    html += '<tr>';
    html += `<td><strong>${index + 1}</strong></td>`;
    html += `<td>${result.data.customerID || 'N/A'}</td>`;
    html += `<td><strong style="font-size: 1.1em;">${(result.probability * 100).toFixed(2)}%</strong></td>`;
    html += `<td style="color: ${riskColor}; font-weight: bold;">${riskLevel}</td>`;
    html += `<td>${result.data.tenure} months</td>`;
    html += `<td>${result.data.MonthlyCharges}</td>`;
    html += `<td>${result.data.Contract}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  
  // Summary statistics
  const highRisk = results.filter(r => r.probability > 0.7).length;
  const mediumRisk = results.filter(r => r.probability > 0.4 && r.probability <= 0.7).length;
  const lowRisk = results.filter(r => r.probability <= 0.4).length;
  
  html += `
    <div class="eda-stats" style="margin-top: 20px;">
      <div class="metric-card">
        <div class="metric-label">High Risk</div>
        <div class="metric-value" style="color: #dc3545;">${highRisk}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Medium Risk</div>
        <div class="metric-value" style="color: #ffc107;">${mediumRisk}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Low Risk</div>
        <div class="metric-value" style="color: #28a745;">${lowRisk}</div>
      </div>
    </div>
  `;
  
  $('predictionResults').innerHTML = html;
}

/* ========================================================================
   VISUALIZATION
   ======================================================================== */

$('visualizeBtn').onclick = () => {
  if (!trainingHistory) {
    alert('Please train the model first to see training visualizations');
    return;
  }
  
  const surface = { name: 'Training Progress', tab: 'Training' };
  
  tfvis.show.history(surface, trainingHistory, ['loss', 'val_loss', 'acc', 'val_acc'], {
    width: 800,
    height: 600
  });
  
  log('✓ Training visualization opened', 'info');
};

/* ========================================================================
   INITIALIZATION
   ======================================================================== */

async function init() {
  try {
    await tf.ready();
    await tf.setBackend('webgl');
    log('✓ TensorFlow.js initialized with WebGL backend', 'success');
    log('System ready. Upload data to begin.', 'info');
    log('Enhanced model targets 93-95% accuracy', 'info');
  } catch (err) {
    await tf.setBackend('cpu');
    log('⚠️ Using CPU backend (WebGL unavailable)', 'warning');
    log('System ready. Upload data to begin.', 'info');
  }
}

init();
