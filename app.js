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

/* ========================================================================
   UTILITY FUNCTIONS
   ======================================================================== */

function showEDATab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.eda-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.eda-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  $(tabName).classList.add('active');
  event.target.classList.add('active');
}

function openModal(modalId) {
  $(modalId).style.display = 'block';
}

function closeModal(modalId) {
  $(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
}

/* ========================================================================
   STEP 1: DATA LOADING & COMPREHENSIVE EDA
   ======================================================================== */

$('loadDataBtn').onclick = async () => {
  const file = $('dataFile').files[0];
  if (!file) return alert('Please select a CSV file');
  
  try {
    log('Loading customer data...', 'info');
    const text = await file.text();
    rawData = parseCSV(text);
    
    if (rawData.length === 0) throw new Error('No data found in CSV');
    
    log(`✓ Loaded ${rawData.length} customer records`, 'success');
    
    // Show EDA tabs
    $('edaTabs').style.display = 'flex';
    
    // Perform comprehensive EDA
    await performComprehensiveEDA();
    
    // Process data for training
    processedData = preprocessData(rawData);
    
    log('✓ Data preprocessing complete', 'success');
    log(`Training set: ${processedData.train.xs.shape[0]} samples`, 'info');
    log(`Test set: ${processedData.test.xs.shape[0]} samples`, 'info');
    
    $('trainBtn').disabled = false;
    
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    alert('Error loading data: ' + error.message);
    console.error(error);
  }
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
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
  
  return data;
}

async function performComprehensiveEDA() {
  log('Performing Comprehensive Exploratory Data Analysis...', 'info');
  
  // 1. Quick Overview
  displayQuickOverview();
  
  // 2. Data Quality Assessment
  assessDataQuality();
  
  // 3. Numerical Analysis
  analyzeNumericalVariables();
  
  // 4. Categorical Analysis
  analyzeCategoricalVariables();
  
  // 5. Correlation Analysis
  analyzeCorrelations();
  
  // 6. Churn Analysis
  analyzeChurnPatterns();
  
  log('✓ Comprehensive EDA complete', 'success');
}

/* ========================================================================
   QUICK OVERVIEW
   ======================================================================== */

function displayQuickOverview() {
  const columns = Object.keys(rawData[0]);
  const numRows = rawData.length;
  const numCols = columns.length;
  
  const churnCount = rawData.filter(r => r.Churn === 'Yes' || r.Churn === '1').length;
  const churnRate = (churnCount / numRows * 100).toFixed(2);
  
  const html = `
    <div class="eda-stats">
      <div class="metric-card">
        <div class="metric-value">${numRows.toLocaleString()}</div>
        <div class="metric-label">Total Records</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${numCols}</div>
        <div class="metric-label">Features</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color: #dc3545">${churnRate}%</div>
        <div class="metric-label">Churn Rate</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${churnCount.toLocaleString()}</div>
        <div class="metric-label">At-Risk Customers</div>
      </div>
    </div>
  `;
  
  $('quickOverview').innerHTML = html;
}

/* ========================================================================
   DATA QUALITY ASSESSMENT
   ======================================================================== */

function assessDataQuality() {
  const columns = Object.keys(rawData[0]);
  
  // Check missing values
  const missingValues = {};
  columns.forEach(col => {
    const missing = rawData.filter(row => !row[col] || row[col] === '' || row[col] === 'NA').length;
    if (missing > 0) {
      missingValues[col] = {
        count: missing,
        percentage: (missing / rawData.length * 100).toFixed(2)
      };
    }
  });
  
  // Check duplicates
  const uniqueRows = new Set(rawData.map(r => JSON.stringify(r)));
  const duplicates = rawData.length - uniqueRows.size;
  
  // Check data types
  const dataTypes = {};
  columns.forEach(col => {
    const sample = rawData[0][col];
    dataTypes[col] = isNaN(sample) ? 'Categorical' : 'Numerical';
  });
  
  dataQualityInfo = {
    missingValues,
    duplicates,
    dataTypes,
    totalRows: rawData.length,
    totalColumns: columns.length
  };
  
  displayDataQuality();
}

function displayDataQuality() {
  const hasMissing = Object.keys(dataQualityInfo.missingValues).length > 0;
  const hasDuplicates = dataQualityInfo.duplicates > 0;
  
  let html = '<div class="data-quality-grid">';
  
  // Missing Values Card
  html += `
    <div class="quality-card">
      <h4>🔍 Missing Values</h4>
      <div class="quality-value">${Object.keys(dataQualityInfo.missingValues).length}</div>
      <p style="margin: 10px 0; color: #6c757d;">Columns with missing data</p>
      <div class="quality-status ${hasMissing ? 'warning' : 'good'}">
        ${hasMissing ? 'Action Required' : 'All Clean'}
      </div>
      ${hasMissing ? '<button class="secondary" style="margin-top: 10px;" onclick="showMissingValuesDetails()">View Details</button>' : ''}
    </div>
  `;
  
  // Duplicates Card
  html += `
    <div class="quality-card">
      <h4>📋 Duplicate Records</h4>
      <div class="quality-value">${dataQualityInfo.duplicates}</div>
      <p style="margin: 10px 0; color: #6c757d;">${((dataQualityInfo.duplicates / dataQualityInfo.totalRows) * 100).toFixed(2)}% of dataset</p>
      <div class="quality-status ${hasDuplicates ? 'warning' : 'good'}">
        ${hasDuplicates ? 'Action Required' : 'No Duplicates'}
      </div>
      ${hasDuplicates ? '<button class="secondary" style="margin-top: 10px;" onclick="showDuplicatesDetails()">Handle Duplicates</button>' : ''}
    </div>
  `;
  
  // Data Completeness Card
  const completeness = ((dataQualityInfo.totalRows - Object.values(dataQualityInfo.missingValues).reduce((sum, v) => sum + v.count, 0) / dataQualityInfo.totalColumns) / dataQualityInfo.totalRows * 100).toFixed(1);
  html += `
    <div class="quality-card">
      <h4>✅ Data Completeness</h4>
      <div class="quality-value">${completeness}%</div>
      <p style="margin: 10px 0; color: #6c757d;">Overall data quality</p>
      <div class="quality-status ${completeness > 95 ? 'good' : completeness > 80 ? 'warning' : 'bad'}">
        ${completeness > 95 ? 'Excellent' : completeness > 80 ? 'Good' : 'Needs Work'}
      </div>
    </div>
  `;
  
  // Data Types Card
  const numericalCols = Object.values(dataQualityInfo.dataTypes).filter(t => t === 'Numerical').length;
  const categoricalCols = Object.values(dataQualityInfo.dataTypes).filter(t => t === 'Categorical').length;
  html += `
    <div class="quality-card">
      <h4>📊 Data Types</h4>
      <div style="margin: 15px 0;">
        <div style="margin: 5px 0;"><strong>Numerical:</strong> ${numericalCols} columns</div>
        <div style="margin: 5px 0;"><strong>Categorical:</strong> ${categoricalCols} columns</div>
      </div>
      <div class="quality-status good">Detected</div>
    </div>
  `;
  
  html += '</div>';
  
  // Add detailed table
  if (hasMissing) {
    html += '<div style="margin: 20px 0;"><h4>Missing Values by Column:</h4>';
    html += '<table class="data-table"><thead><tr><th>Column</th><th>Missing Count</th><th>Percentage</th></tr></thead><tbody>';
    Object.entries(dataQualityInfo.missingValues).forEach(([col, info]) => {
      html += `<tr><td>${col}</td><td>${info.count}</td><td>${info.percentage}%</td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  $('dataQualityContent').innerHTML = html;
}

function showMissingValuesDetails() {
  const missingSummary = Object.entries(dataQualityInfo.missingValues);
  
  let modalHTML = `
    <div class="status-box warning">
      <strong>⚠️ Found ${missingSummary.length} columns with missing values</strong><br>
      Total missing cells: ${missingSummary.reduce((sum, [, info]) => sum + info.count, 0)}
    </div>
    <h4 style="margin: 20px 0;">Choose a handling method:</h4>
  `;
  
  // Option 1: Drop rows with missing values
  modalHTML += `
    <div class="option-card" onclick="handleMissingValues('drop')">
      <h4>🗑️ Drop Rows with Missing Values <span class="recommendation-badge">Best for <5% missing</span></h4>
      <p><strong>When to use:</strong> When missing data is minimal (< 5%) and randomly distributed</p>
      <p><strong>Impact:</strong> Will remove ${Math.max(...missingSummary.map(([, info]) => info.count))} rows (worst case)</p>
      <p><strong>Pros:</strong> Clean data, no assumptions made</p>
      <p><strong>Cons:</strong> Loss of data, reduces sample size</p>
    </div>
  `;
  
  // Option 2: Fill with mean/median (numerical)
  modalHTML += `
    <div class="option-card" onclick="handleMissingValues('mean')">
      <h4>📊 Fill with Mean/Median <span class="recommendation-badge">Recommended</span></h4>
      <p><strong>When to use:</strong> For numerical columns with missing values</p>
      <p><strong>Impact:</strong> Preserves all rows, maintains distribution</p>
      <p><strong>Pros:</strong> No data loss, statistically sound</p>
      <p><strong>Cons:</strong> May slightly reduce variance</p>
    </div>
  `;
  
  // Option 3: Fill with mode (categorical)
  modalHTML += `
    <div class="option-card" onclick="handleMissingValues('mode')">
      <h4>📁 Fill with Most Frequent Value (Mode)</h4>
      <p><strong>When to use:</strong> For categorical columns with missing values</p>
      <p><strong>Impact:</strong> Preserves all rows, uses most common category</p>
      <p><strong>Pros:</strong> No data loss, maintains majority patterns</p>
      <p><strong>Cons:</strong> May introduce bias toward dominant category</p>
    </div>
  `;
  
  // Option 4: Forward fill
  modalHTML += `
    <div class="option-card" onclick="handleMissingValues('forward')">
      <h4>➡️ Forward Fill</h4>
      <p><strong>When to use:</strong> For time-series or sequential data</p>
      <p><strong>Impact:</strong> Uses previous valid value</p>
      <p><strong>Pros:</strong> Works well for temporal data</p>
      <p><strong>Cons:</strong> Not suitable for non-sequential data</p>
    </div>
  `;
  
  $('missingValuesOptions').innerHTML = modalHTML;
  openModal('missingValuesModal');
}

function handleMissingValues(method) {
  log(`Handling missing values using: ${method}`, 'info');
  
  const columns = Object.keys(rawData[0]);
  
  if (method === 'drop') {
    // Remove rows with any missing values
    const originalLength = rawData.length;
    rawData = rawData.filter(row => {
      return columns.every(col => row[col] && row[col] !== '' && row[col] !== 'NA');
    });
    log(`✓ Dropped ${originalLength - rawData.length} rows with missing values`, 'success');
    
  } else if (method === 'mean') {
    // Fill numerical columns with mean
    columns.forEach(col => {
      const values = rawData.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        rawData.forEach(row => {
          if (!row[col] || row[col] === '' || row[col] === 'NA' || isNaN(parseFloat(row[col]))) {
            row[col] = mean.toFixed(2);
          }
        });
      }
    });
    log('✓ Filled numerical missing values with mean', 'success');
    
  } else if (method === 'mode') {
    // Fill categorical columns with mode
    columns.forEach(col => {
      const valueCounts = {};
      rawData.forEach(row => {
        if (row[col] && row[col] !== '' && row[col] !== 'NA') {
          valueCounts[row[col]] = (valueCounts[row[col]] || 0) + 1;
        }
      });
      const mode = Object.keys(valueCounts).reduce((a, b) => valueCounts[a] > valueCounts[b] ? a : b, '');
      rawData.forEach(row => {
        if (!row[col] || row[col] === '' || row[col] === 'NA') {
          row[col] = mode;
        }
      });
    });
    log('✓ Filled categorical missing values with mode', 'success');
    
  } else if (method === 'forward') {
    // Forward fill
    columns.forEach(col => {
      let lastValid = rawData[0][col];
      rawData.forEach(row => {
        if (!row[col] || row[col] === '' || row[col] === 'NA') {
          row[col] = lastValid;
        } else {
          lastValid = row[col];
        }
      });
    });
    log('✓ Applied forward fill for missing values', 'success');
  }
  
  closeModal('missingValuesModal');
  assessDataQuality();
  displayQuickOverview();
}

function showDuplicatesDetails() {
  let modalHTML = `
    <div class="status-box warning">
      <strong>⚠️ Found ${dataQualityInfo.duplicates} duplicate records</strong><br>
      This represents ${((dataQualityInfo.duplicates / dataQualityInfo.totalRows) * 100).toFixed(2)}% of your dataset
    </div>
    <h4 style="margin: 20px 0;">Choose a handling method:</h4>
  `;
  
  // Option 1: Remove all duplicates
  modalHTML += `
    <div class="option-card" onclick="handleDuplicates('remove')">
      <h4>🗑️ Remove All Duplicates <span class="recommendation-badge">Recommended</span></h4>
      <p><strong>When to use:</strong> When duplicates are data entry errors</p>
      <p><strong>Impact:</strong> Will remove ${dataQualityInfo.duplicates} duplicate rows</p>
      <p><strong>Pros:</strong> Clean dataset, no redundancy</p>
      <p><strong>Cons:</strong> May lose valid repeated observations</p>
    </div>
  `;
  
  // Option 2: Keep first occurrence
  modalHTML += `
    <div class="option-card" onclick="handleDuplicates('first')">
      <h4>⬆️ Keep First Occurrence</h4>
      <p><strong>When to use:</strong> When first record is most reliable</p>
      <p><strong>Impact:</strong> Keeps earliest entry for each duplicate</p>
      <p><strong>Pros:</strong> Preserves chronological priority</p>
      <p><strong>Cons:</strong> May keep outdated information</p>
    </div>
  `;
  
  // Option 3: Keep last occurrence
  modalHTML += `
    <div class="option-card" onclick="handleDuplicates('last')">
      <h4>⬇️ Keep Last Occurrence</h4>
      <p><strong>When to use:</strong> When latest record is most accurate</p>
      <p><strong>Impact:</strong> Keeps most recent entry for each duplicate</p>
      <p><strong>Pros:</strong> Preserves most up-to-date information</p>
      <p><strong>Cons:</strong> May discard valuable historical data</p>
    </div>
  `;
  
  // Option 4: Keep all (no action)
  modalHTML += `
    <div class="option-card" onclick="handleDuplicates('keep')">
      <h4>✅ Keep All Duplicates</h4>
      <p><strong>When to use:</strong> When duplicates are valid repeated observations</p>
      <p><strong>Impact:</strong> No changes to dataset</p>
      <p><strong>Pros:</strong> No data loss</p>
      <p><strong>Cons:</strong> May introduce bias in analysis</p>
    </div>
  `;
  
  $('duplicatesOptions').innerHTML = modalHTML;
  openModal('duplicatesModal');
}

function handleDuplicates(method) {
  log(`Handling duplicates using: ${method}`, 'info');
  
  if (method === 'remove' || method === 'first') {
    const seen = new Set();
    const originalLength = rawData.length;
    rawData = rawData.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    log(`✓ Removed ${originalLength - rawData.length} duplicate rows`, 'success');
    
  } else if (method === 'last') {
    const seen = new Map();
    rawData.forEach((row, idx) => {
      const key = JSON.stringify(row);
      seen.set(key, idx);
    });
    rawData = rawData.filter((row, idx) => {
      const key = JSON.stringify(row);
      return seen.get(key) === idx;
    });
    log('✓ Kept last occurrence of duplicates', 'success');
    
  } else if (method === 'keep') {
    log('✓ Kept all duplicate records', 'info');
  }
  
  closeModal('duplicatesModal');
  assessDataQuality();
  displayQuickOverview();
}

/* ========================================================================
   NUMERICAL ANALYSIS
   ======================================================================== */

function analyzeNumericalVariables() {
  const numericalCols = ['tenure', 'MonthlyCharges', 'TotalCharges'];
  
  let html = '<div class="data-quality-grid">';
  
  numericalCols.forEach(col => {
    const values = rawData.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    
    if (values.length > 0) {
      values.sort((a, b) => a - b);
      const min = values[0];
      const max = values[values.length - 1];
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const median = values[Math.floor(values.length / 2)];
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
      
      html += `
        <div class="quality-card">
          <h4>📊 ${col}</h4>
          <div style="margin: 10px 0; text-align: left;">
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
              <span>Mean:</span><strong>${mean.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
              <span>Median:</span><strong>${median.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
              <span>Std Dev:</span><strong>${std.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
              <span>Range:</span><strong>${min.toFixed(2)} - ${max.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      `;
    }
  });
  
  html += '</div>';
  
  // Create distribution charts
  html += '<div style="margin-top: 30px;"><h4>Distribution Analysis:</h4></div>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-top: 15px;">';
  
  numericalCols.forEach((col, idx) => {
    html += `
      <div class="chart-container" style="height: 250px;">
        <canvas id="numChart${idx}"></canvas>
      </div>
    `;
  });
  
  html += '</div>';
  
  $('numericalContent').innerHTML = html;
  
  // Draw charts
  setTimeout(() => {
    numericalCols.forEach((col, idx) => {
      createDistributionChart(col, `numChart${idx}`);
    });
  }, 100);
}

function createDistributionChart(column, canvasId) {
  const values = rawData.map(r => parseFloat(r[column])).filter(v => !isNaN(v));
  
  // Create histogram bins
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = 15;
  const binSize = (max - min) / binCount;
  const bins = Array(binCount).fill(0);
  const labels = [];
  
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binSize;
    const binEnd = binStart + binSize;
    labels.push(`${binStart.toFixed(0)}-${binEnd.toFixed(0)}`);
  }
  
  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[binIndex]++;
  });
  
  const ctx = $(canvasId).getContext('2d');
  if (charts[canvasId]) charts[canvasId].destroy();
  
  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: column,
        data: bins,
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${column} Distribution`
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Frequency'
          }
        },
        x: {
          title: {
            display: true,
            text: column
          }
        }
      }
    }
  });
}

/* ========================================================================
   CATEGORICAL ANALYSIS
   ======================================================================== */

function analyzeCategoricalVariables() {
  const categoricalCols = ['Contract', 'InternetService', 'OnlineSecurity', 'TechSupport'];
  
  let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">';
  
  categoricalCols.forEach((col, idx) => {
    if (rawData[0][col]) {
      html += `
        <div class="chart-container" style="height: 300px;">
          <canvas id="catChart${idx}"></canvas>
        </div>
      `;
    }
  });
  
  html += '</div>';
  
  // Add frequency tables
  html += '<div style="margin-top: 30px;"><h4>Frequency Tables:</h4></div>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 15px;">';
  
  categoricalCols.forEach(col => {
    if (rawData[0][col]) {
      const valueCounts = {};
      rawData.forEach(row => {
        if (row[col]) {
          valueCounts[row[col]] = (valueCounts[row[col]] || 0) + 1;
        }
      });
      
      html += `
        <div class="quality-card">
          <h4>${col}</h4>
          <table style="width: 100%; margin-top: 10px;">
      `;
      
      Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([value, count]) => {
          const percentage = (count / rawData.length * 100).toFixed(1);
          html += `
            <tr style="border-bottom: 1px solid #e9ecef;">
              <td style="padding: 8px 0;">${value}</td>
              <td style="text-align: right; font-weight: bold;">${count}</td>
              <td style="text-align: right; color: #667eea;">${percentage}%</td>
            </tr>
          `;
        });
      
      html += `</table></div>`;
    }
  });
  
  html += '</div>';
  
  $('categoricalContent').innerHTML = html;
  
  // Draw charts
  setTimeout(() => {
    categoricalCols.forEach((col, idx) => {
      if (rawData[0][col]) {
        createCategoricalChart(col, `catChart${idx}`);
      }
    });
  }, 100);
}

function createCategoricalChart(column, canvasId) {
  const valueCounts = {};
  rawData.forEach(row => {
    if (row[column]) {
      valueCounts[row[column]] = (valueCounts[row[column]] || 0) + 1;
    }
  });
  
  const labels = Object.keys(valueCounts);
  const data = Object.values(valueCounts);
  
  const ctx = $(canvasId).getContext('2d');
  if (charts[canvasId]) charts[canvasId].destroy();
  
  charts[canvasId] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(118, 75, 162, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 206, 86, 0.8)'
        ],
        borderWidth: 2,
        borderColor: 'white'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${column} Distribution`,
          font: { size: 16 }
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

/* ========================================================================
   CORRELATION ANALYSIS
   ======================================================================== */

function analyzeCorrelations() {
  const numericalCols = ['tenure', 'MonthlyCharges', 'TotalCharges'];
  
  let html = '<div class="status-box"><strong>📊 Correlation Matrix</strong><br>Shows relationships between numerical variables and churn</div>';
  
  html += '<table class="data-table" style="margin-top: 20px;"><thead><tr><th>Feature Pair</th><th>Correlation</th><th>Strength</th></tr></thead><tbody>';
  
  // Calculate correlations
  const correlations = [];
  
  for (let i = 0; i < numericalCols.length; i++) {
    for (let j = i + 1; j < numericalCols.length; j++) {
      const col1 = numericalCols[i];
      const col2 = numericalCols[j];
      
      const values1 = rawData.map(r => parseFloat(r[col1])).filter(v => !isNaN(v));
      const values2 = rawData.map(r => parseFloat(r[col2])).filter(v => !isNaN(v));
      
      const corr = calculateCorrelation(values1, values2);
      correlations.push({ pair: `${col1} ↔ ${col2}`, value: corr });
    }
  }
  
  correlations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  
  correlations.forEach(({ pair, value }) => {
    const strength = Math.abs(value) > 0.7 ? 'Strong' : Math.abs(value) > 0.4 ? 'Moderate' : 'Weak';
    const color = Math.abs(value) > 0.7 ? '#dc3545' : Math.abs(value) > 0.4 ? '#ffc107' : '#28a745';
    
    html += `
      <tr>
        <td>${pair}</td>
        <td><strong style="color: ${color}">${value.toFixed(3)}</strong></td>
        <td><span class="quality-status" style="background: ${color}20; color: ${color}">${strength}</span></td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  
  // Add visual correlation heatmap
  html += '<div style="margin-top: 30px;"><h4>Correlation Heatmap:</h4>';
  html += '<div class="chart-container" style="height: 400px;"><canvas id="corrChart"></canvas></div></div>';
  
  $('correlationsContent').innerHTML = html;
  
  setTimeout(() => createCorrelationChart(numericalCols), 100);
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
  
  return num / Math.sqrt(denX * denY);
}

function createCorrelationChart(columns) {
  const matrix = [];
  
  for (let i = 0; i < columns.length; i++) {
    const row = [];
    for (let j = 0; j < columns.length; j++) {
      if (i === j) {
        row.push(1);
      } else {
        const values1 = rawData.map(r => parseFloat(r[columns[i]])).filter(v => !isNaN(v));
        const values2 = rawData.map(r => parseFloat(r[columns[j]])).filter(v => !isNaN(v));
        row.push(calculateCorrelation(values1, values2));
      }
    }
    matrix.push(row);
  }
  
  const ctx = $('corrChart').getContext('2d');
  if (charts.corrChart) charts.corrChart.destroy();
  
  const data = {
    labels: columns,
    datasets: columns.map((col, i) => ({
      label: col,
      data: matrix[i].map((val, j) => ({ x: columns[j], y: col, v: val })),
      backgroundColor: matrix[i].map(val => {
        const intensity = Math.abs(val);
        return `rgba(102, 126, 234, ${intensity})`;
      })
    }))
  };
  
  charts.corrChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: columns,
      datasets: [{
        label: 'Correlation Strength',
        data: matrix[0],
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Feature Correlations'
        }
      }
    }
  });
}

/* ========================================================================
   CHURN ANALYSIS
   ======================================================================== */

function analyzeChurnPatterns() {
  const churnYes = rawData.filter(r => r.Churn === 'Yes' || r.Churn === '1');
  const churnNo = rawData.filter(r => r.Churn === 'No' || r.Churn === '0');
  
  const churnRate = (churnYes.length / rawData.length * 100).toFixed(2);
  
  let html = `
    <div class="eda-stats">
      <div class="metric-card">
        <div class="metric-value" style="color: #dc3545">${churnYes.length}</div>
        <div class="metric-label">Churned Customers</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color: #28a745">${churnNo.length}</div>
        <div class="metric-label">Retained Customers</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color: #667eea">${churnRate}%</div>
        <div class="metric-label">Churn Rate</div>
      </div>
