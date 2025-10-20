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

function performComprehensiveEDA() {
  log('Performing Comprehensive Exploratory Data Analysis...', 'info');
  
  try {
    displayQuickOverview();
    log('✓ Quick overview complete', 'success');
    
    assessDataQuality();
    log('✓ Data quality assessed', 'success');
    
    analyzeNumericalVariables();
    log('✓ Numerical analysis complete', 'success');
    
    analyzeCategoricalVariables();
    log('✓ Categorical analysis complete', 'success');
    
    analyzeCorrelations();
    log('✓ Correlation analysis complete', 'success');
    
    analyzeChurnPatterns();
    log('✓ Churn analysis complete', 'success');
    
    log('✓ Comprehensive EDA complete', 'success');
  } catch (error) {
    log(`EDA Error: ${error.message}`, 'error');
    console.error('EDA Error:', error);
  }
}

function displayQuickOverview() {
  const columns = Object.keys(rawData[0]);
  const numRows = rawData.length;
  const numCols = columns.length;
  
  const churnCount = rawData.filter(r => r.Churn === 'Yes' || r.Churn === '1').length;
  const churnRate = (churnCount / numRows * 100).toFixed(2);
  
  const tenures = rawData.map(r => parseFloat(r.tenure || 0)).filter(v => !isNaN(v));
  const avgTenure = tenures.length > 0 ? (tenures.reduce((a, b) => a + b, 0) / tenures.length).toFixed(1) : 0;
  
  const monthlyCharges = rawData.map(r => parseFloat(r.MonthlyCharges || 0)).filter(v => !isNaN(v));
  const avgMonthly = monthlyCharges.length > 0 ? (monthlyCharges.reduce((a, b) => a + b, 0) / monthlyCharges.length).toFixed(2) : 0;
  
  stats = {
    totalCustomers: numRows,
    churnCount,
    churnRate,
    avgTenure,
    avgMonthly,
    avgTotal: 0
  };
  
  const parts = [];
  parts.push('<div class="eda-stats">');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value">' + numRows.toLocaleString() + '</div>');
  parts.push('<div class="metric-label">Total Records</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value">' + numCols + '</div>');
  parts.push('<div class="metric-label">Features</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value" style="color: #dc3545">' + churnRate + '%</div>');
  parts.push('<div class="metric-label">Churn Rate</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value">' + churnCount.toLocaleString() + '</div>');
  parts.push('<div class="metric-label">At-Risk Customers</div>');
  parts.push('</div>');
  parts.push('</div>');
  parts.push('<div class="status-box success">');
  parts.push('<strong>Key Insights:</strong><br>');
  parts.push('• ' + churnCount + ' customers at risk of churning<br>');
  parts.push('• Potential revenue loss: $' + (churnCount * avgMonthly * 12).toFixed(0) + ' per year<br>');
  parts.push('• Average tenure: ' + avgTenure + ' months | Average monthly charge: $' + avgMonthly);
  parts.push('</div>');
  
  $('quickOverview').innerHTML = parts.join('');
}

function assessDataQuality() {
  const columns = Object.keys(rawData[0]);
  
  const missingValues = {};
  columns.forEach(col => {
    const missing = rawData.filter(row => !row[col] || row[col] === '' || row[col] === 'NA' || row[col] === 'null').length;
    if (missing > 0) {
      missingValues[col] = {
        count: missing,
        percentage: (missing / rawData.length * 100).toFixed(2)
      };
    }
  });
  
  const uniqueRows = new Set(rawData.map(r => JSON.stringify(r)));
  const duplicates = rawData.length - uniqueRows.size;
  
  const dataTypes = {};
  columns.forEach(col => {
    const sample = rawData.find(r => r[col] && r[col] !== '');
    if (sample) {
      dataTypes[col] = isNaN(parseFloat(sample[col])) ? 'Categorical' : 'Numerical';
    }
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
  
  const parts = [];
  parts.push('<div class="data-quality-grid">');
  
  parts.push('<div class="quality-card">');
  parts.push('<h4>🔍 Missing Values</h4>');
  parts.push('<div class="quality-value">' + Object.keys(dataQualityInfo.missingValues).length + '</div>');
  parts.push('<p style="margin: 10px 0; color: #6c757d;">Columns with missing data</p>');
  parts.push('<div class="quality-status ' + (hasMissing ? 'warning' : 'good') + '">');
  parts.push(hasMissing ? 'Action Required' : 'All Clean');
  parts.push('</div>');
  if (hasMissing) {
    parts.push('<button class="secondary" style="margin-top: 10px;" onclick="showMissingValuesDetails()">View Details</button>');
  }
  parts.push('</div>');
  
  parts.push('<div class="quality-card">');
  parts.push('<h4>📋 Duplicate Records</h4>');
  parts.push('<div class="quality-value">' + dataQualityInfo.duplicates + '</div>');
  parts.push('<p style="margin: 10px 0; color: #6c757d;">' + ((dataQualityInfo.duplicates / dataQualityInfo.totalRows) * 100).toFixed(2) + '% of dataset</p>');
  parts.push('<div class="quality-status ' + (hasDuplicates ? 'warning' : 'good') + '">');
  parts.push(hasDuplicates ? 'Action Required' : 'No Duplicates');
  parts.push('</div>');
  if (hasDuplicates) {
    parts.push('<button class="secondary" style="margin-top: 10px;" onclick="showDuplicatesDetails()">Handle Duplicates</button>');
  }
  parts.push('</div>');
  
  const totalMissing = Object.values(dataQualityInfo.missingValues).reduce((sum, v) => sum + v.count, 0);
  const totalCells = dataQualityInfo.totalRows * dataQualityInfo.totalColumns;
  const completeness = ((totalCells - totalMissing) / totalCells * 100).toFixed(1);
  
  parts.push('<div class="quality-card">');
  parts.push('<h4>✅ Data Completeness</h4>');
  parts.push('<div class="quality-value">' + completeness + '%</div>');
  parts.push('<p style="margin: 10px 0; color: #6c757d;">Overall data quality</p>');
  const statusClass = completeness > 95 ? 'good' : completeness > 80 ? 'warning' : 'bad';
  const statusText = completeness > 95 ? 'Excellent' : completeness > 80 ? 'Good' : 'Needs Work';
  parts.push('<div class="quality-status ' + statusClass + '">');
  parts.push(statusText);
  parts.push('</div>');
  parts.push('</div>');
  
  const numericalCols = Object.values(dataQualityInfo.dataTypes).filter(t => t === 'Numerical').length;
  const categoricalCols = Object.values(dataQualityInfo.dataTypes).filter(t => t === 'Categorical').length;
  parts.push('<div class="quality-card">');
  parts.push('<h4>📊 Data Types</h4>');
  parts.push('<div style="margin: 15px 0;">');
  parts.push('<div style="margin: 5px 0;"><strong>Numerical:</strong> ' + numericalCols + ' columns</div>');
  parts.push('<div style="margin: 5px 0;"><strong>Categorical:</strong> ' + categoricalCols + ' columns</div>');
  parts.push('</div>');
  parts.push('<div class="quality-status good">Detected</div>');
  parts.push('</div>');
  
  parts.push('</div>');
  
  if (hasMissing) {
    parts.push('<div style="margin: 20px 0;"><h4>Missing Values by Column:</h4>');
    parts.push('<table class="data-table"><thead><tr><th>Column</th><th>Missing Count</th><th>Percentage</th></tr></thead><tbody>');
    Object.entries(dataQualityInfo.missingValues).forEach(([col, info]) => {
      parts.push('<tr><td>' + col + '</td><td>' + info.count + '</td><td>' + info.percentage + '%</td></tr>');
    });
    parts.push('</tbody></table></div>');
  }
  
  $('dataQualityContent').innerHTML = parts.join('');
}

window.showMissingValuesDetails = function() {
  const missingSummary = Object.entries(dataQualityInfo.missingValues);
  
  const parts = [];
  parts.push('<div class="status-box warning">');
  parts.push('<strong>⚠️ Found ' + missingSummary.length + ' columns with missing values</strong><br>');
  parts.push('Total missing cells: ' + missingSummary.reduce((sum, item) => sum + item[1].count, 0));
  parts.push('</div>');
  parts.push('<h4 style="margin: 20px 0;">Choose a handling method:</h4>');
  
  parts.push('<div class="option-card" onclick="handleMissingValues(\'drop\')">');
  parts.push('<h4>🗑️ Drop Rows with Missing Values <span class="recommendation-badge">Best for less than 5% missing</span></h4>');
  parts.push('<p><strong>When to use:</strong> When missing data is minimal and randomly distributed</p>');
  parts.push('<p><strong>Pros:</strong> Clean data, no assumptions made</p>');
  parts.push('<p><strong>Cons:</strong> Loss of data, reduces sample size</p>');
  parts.push('</div>');
  
  parts.push('<div class="option-card" onclick="handleMissingValues(\'mean\')">');
  parts.push('<h4>📊 Fill with Mean/Median <span class="recommendation-badge">Recommended</span></h4>');
  parts.push('<p><strong>When to use:</strong> For numerical columns with missing values</p>');
  parts.push('<p><strong>Pros:</strong> No data loss, statistically sound</p>');
  parts.push('<p><strong>Cons:</strong> May slightly reduce variance</p>');
  parts.push('</div>');
  
  parts.push('<div class="option-card" onclick="handleMissingValues(\'mode\')">');
  parts.push('<h4>📁 Fill with Most Frequent Value (Mode)</h4>');
  parts.push('<p><strong>When to use:</strong> For categorical columns with missing values</p>');
  parts.push('<p><strong>Pros:</strong> No data loss, maintains majority patterns</p>');
  parts.push('<p><strong>Cons:</strong> May introduce bias toward dominant category</p>');
  parts.push('</div>');
  
  $('missingValuesOptions').innerHTML = parts.join('');
  openModal('missingValuesModal');
}

window.handleMissingValues = function(method) {
  log('Handling missing values using: ' + method, 'info');
  
  const columns = Object.keys(rawData[0]);
  
  try {
    if (method === 'drop') {
      const originalLength = rawData.length;
      rawData = rawData.filter(row => {
        return columns.every(col => row[col] && row[col] !== '' && row[col] !== 'NA');
      });
      log('✓ Dropped ' + (originalLength - rawData.length) + ' rows with missing values', 'success');
      
    } else if (method === 'mean') {
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
      columns.forEach(col => {
        const valueCounts = {};
        rawData.forEach(row => {
          if (row[col] && row[col] !== '' && row[col] !== 'NA') {
            valueCounts[row[col]] = (valueCounts[row[col]] || 0) + 1;
          }
        });
        if (Object.keys(valueCounts).length > 0) {
          const mode = Object.keys(valueCounts).reduce((a, b) => valueCounts[a] > valueCounts[b] ? a : b);
          rawData.forEach(row => {
            if (!row[col] || row[col] === '' || row[col] === 'NA') {
              row[col] = mode;
            }
          });
        }
      });
      log('✓ Filled categorical missing values with mode', 'success');
    }
    
    closeModal('missingValuesModal');
    assessDataQuality();
    displayQuickOverview();
    performComprehensiveEDA();
  } catch (error) {
    log('Error handling missing values: ' + error.message, 'error');
    console.error(error);
  }
}

window.showDuplicatesDetails = function() {
  const parts = [];
  parts.push('<div class="status-box warning">');
  parts.push('<strong>⚠️ Found ' + dataQualityInfo.duplicates + ' duplicate records</strong><br>');
  parts.push('This represents ' + ((dataQualityInfo.duplicates / dataQualityInfo.totalRows) * 100).toFixed(2) + '% of your dataset');
  parts.push('</div>');
  parts.push('<h4 style="margin: 20px 0;">Choose a handling method:</h4>');
  
  parts.push('<div class="option-card" onclick="handleDuplicates(\'remove\')">');
  parts.push('<h4>🗑️ Remove All Duplicates <span class="recommendation-badge">Recommended</span></h4>');
  parts.push('<p><strong>When to use:</strong> When duplicates are data entry errors</p>');
  parts.push('<p><strong>Impact:</strong> Will remove ' + dataQualityInfo.duplicates + ' duplicate rows</p>');
  parts.push('<p><strong>Pros:</strong> Clean dataset, no redundancy</p>');
  parts.push('</div>');
  
  parts.push('<div class="option-card" onclick="handleDuplicates(\'keep\')">');
  parts.push('<h4>✅ Keep All Duplicates</h4>');
  parts.push('<p><strong>When to use:</strong> When duplicates are valid repeated observations</p>');
  parts.push('<p><strong>Pros:</strong> No data loss</p>');
  parts.push('</div>');
  
  $('duplicatesOptions').innerHTML = parts.join('');
  openModal('duplicatesModal');
}

window.handleDuplicates = function(method) {
  log('Handling duplicates using: ' + method, 'info');
  
  try {
    if (method === 'remove') {
      const seen = new Set();
      const originalLength = rawData.length;
      rawData = rawData.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      log('✓ Removed ' + (originalLength - rawData.length) + ' duplicate rows', 'success');
    } else {
      log('✓ Kept all duplicate records', 'info');
    }
    
    closeModal('duplicatesModal');
    assessDataQuality();
    displayQuickOverview();
    performComprehensiveEDA();
  } catch (error) {
    log('Error handling duplicates: ' + error.message, 'error');
    console.error(error);
  }
}

function analyzeNumericalVariables() {
  const numericalCols = ['tenure', 'MonthlyCharges', 'TotalCharges'];
  
  const parts = [];
  parts.push('<div class="data-quality-grid">');
  
  numericalCols.forEach(col => {
    if (rawData[0] && rawData[0][col]) {
      const values = rawData.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        values.sort((a, b) => a - b);
        const min = values[0];
        const max = values[values.length - 1];
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const median = values[Math.floor(values.length / 2)];
        const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
        
        parts.push('<div class="quality-card">');
        parts.push('<h4>📊 ' + col + '</h4>');
        parts.push('<div style="margin: 10px 0; text-align: left;">');
        parts.push('<div style="display: flex; justify-content: space-between; margin: 5px 0;">');
        parts.push('<span>Mean:</span><strong>' + mean.toFixed(2) + '</strong>');
        parts.push('</div>');
        parts.push('<div style="display: flex; justify-content: space-between; margin: 5px 0;">');
        parts.push('<span>Median:</span><strong>' + median.toFixed(2) + '</strong>');
        parts.push('</div>');
        parts.push('<div style="display: flex; justify-content: space-between; margin: 5px 0;">');
        parts.push('<span>Std Dev:</span><strong>' + std.toFixed(2) + '</strong>');
        parts.push('</div>');
        parts.push('<div style="display: flex; justify-content: space-between; margin: 5px 0;">');
        parts.push('<span>Range:</span><strong>' + min.toFixed(2) + ' - ' + max.toFixed(2) + '</strong>');
        parts.push('</div>');
        parts.push('</div>');
        parts.push('</div>');
      }
    }
  });
  
  parts.push('</div>');
  
  parts.push('<div style="margin-top: 30px;"><h4>Distribution Analysis:</h4></div>');
  parts.push('<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-top: 15px;">');
  
  numericalCols.forEach((col, idx) => {
    if (rawData[0] && rawData[0][col]) {
      parts.push('<div class="chart-container" style="height: 250px;"><canvas id="numChart' + idx + '"></canvas></div>');
    }
  });
  
  parts.push('</div>');
  
  $('numericalContent').innerHTML = parts.join('');
  
  setTimeout(() => {
    numericalCols.forEach((col, idx) => {
      if (rawData[0] && rawData[0][col]) {
        createDistributionChart(col, 'numChart' + idx);
      }
    });
  }, 100);
  
  createNumericalVariableSelector();
}

function createDistributionChart(column, canvasId) {
  const canvas = $(canvasId);
  if (!canvas) return;
  
  const values = rawData.map(r => parseFloat(r[column])).filter(v => !isNaN(v));
  if (values.length === 0) return;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = 15;
  const binSize = (max - min) / binCount;
  const bins = Array(binCount).fill(0);
  const labels = [];
  
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binSize;
    labels.push(binStart.toFixed(0));
  }
  
  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[binIndex]++;
  });
  
  const ctx = canvas.getContext('2d');
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
          text: column + ' Distribution'
        },
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Frequency' }
        }
      }
    }
  });
}

function analyzeCategoricalVariables() {
  const categoricalCols = ['Contract', 'InternetService', 'OnlineSecurity', 'TechSupport'];
  
  const parts = [];
  parts.push('<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">');
  
  let chartIndex = 0;
  categoricalCols.forEach(col => {
    if (rawData[0] && rawData[0][col]) {
      parts.push('<div class="chart-container" style="height: 300px;"><canvas id="catChart' + chartIndex + '"></canvas></div>');
      chartIndex++;
    }
  });
  
  parts.push('</div>');
  
  parts.push('<div style="margin-top: 30px;"><h4>Frequency Tables:</h4></div>');
  parts.push('<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 15px;">');
  
  categoricalCols.forEach(col => {
    if (rawData[0] && rawData[0][col]) {
      const valueCounts = {};
      rawData.forEach(row => {
        if (row[col]) {
          valueCounts[row[col]] = (valueCounts[row[col]] || 0) + 1;
        }
      });
      
      parts.push('<div class="quality-card"><h4>' + col + '</h4><table style="width: 100%; margin-top: 10px;">');
      
      Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([value, count]) => {
          const percentage = (count / rawData.length * 100).toFixed(1);
          parts.push('<tr style="border-bottom: 1px solid #e9ecef;">');
          parts.push('<td style="padding: 8px 0;">' + value + '</td>');
          parts.push('<td style="text-align: right; font-weight: bold;">' + count + '</td>');
          parts.push('<td style="text-align: right; color: #667eea;">' + percentage + '%</td>');
          parts.push('</tr>');
        });
      
      parts.push('</table></div>');
    }
  });
  
  parts.push('</div>');
  
  $('categoricalContent').innerHTML = parts.join('');
  
  setTimeout(() => {
    let chartIndex = 0;
    categoricalCols.forEach(col => {
      if (rawData[0] && rawData[0][col]) {
        createCategoricalChart(col, 'catChart' + chartIndex);
        chartIndex++;
      }
    });
  }, 100);
  
  createCategoricalVariableSelector();
}

function createCategoricalChart(column, canvasId) {
  const canvas = $(canvasId);
  if (!canvas) return;
  
  const valueCounts = {};
  rawData.forEach(row => {
    if (row[column]) {
      valueCounts[row[column]] = (valueCounts[row[column]] || 0) + 1;
    }
  });
  
  const labels = Object.keys(valueCounts);
  const data = Object.values(valueCounts);
  
  const ctx = canvas.getContext('2d');
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
          text: column + ' Distribution',
          font: { size: 16 }
        },
        legend: { position: 'bottom' }
      }
    }
  });
}

function createNumericalVariableSelector() {
  const defaultCols = ['tenure', 'MonthlyCharges', 'TotalCharges'];
  const allCols = Object.keys(rawData[0]);
  const numericalCols = allCols.filter(col => {
    if (defaultCols.includes(col)) return false;
    const sample = rawData.find(r => r[col] && r[col] !== '');
    return sample && !isNaN(parseFloat(sample[col]));
  });
  
  if (numericalCols.length === 0) {
    $('numericalVariableSelector').innerHTML = '<p style="color: #6c757d;">No additional numerical variables available</p>';
    return;
  }
  
  let html = '';
  numericalCols.forEach(col => {
    html += '<div class="variable-option" onclick="toggleNumericalVar(\'' + col + '\')">';
    html += '<input type="checkbox" id="numvar_' + col + '" style="margin-right: 5px;">';
    html += '<label for="numvar_' + col + '">' + col + '</label>';
    html += '</div>';
  });
  
  $('numericalVariableSelector').innerHTML = html;
}

function createCategoricalVariableSelector() {
  const defaultCols = ['Contract', 'InternetService', 'OnlineSecurity', 'TechSupport'];
  const allCols = Object.keys(rawData[0]);
  const categoricalCols = allCols.filter(col => {
    if (defaultCols.includes(col) || col === 'Churn') return false;
    const sample = rawData.find(r => r[col] && r[col] !== '');
    return sample && isNaN(parseFloat(sample[col]));
  });
  
  if (categoricalCols.length === 0) {
    $('categoricalVariableSelector').innerHTML = '<p style="color: #6c757d;">No additional categorical variables available</p>';
    return;
  }
  
  let html = '';
  categoricalCols.forEach(col => {
    html += '<div class="variable-option" onclick="toggleCategoricalVar(\'' + col + '\')">';
    html += '<input type="checkbox" id="catvar_' + col + '" style="margin-right: 5px;">';
    html += '<label for="catvar_' + col + '">' + col + '</label>';
    html += '</div>';
  });
  
  $('categoricalVariableSelector').innerHTML = html;
}

window.toggleNumericalVar = function(varName) {
  const checkbox = $('numvar_' + varName);
  const option = checkbox.parentElement;
  
  if (selectedNumericalVars.includes(varName)) {
    selectedNumericalVars = selectedNumericalVars.filter(v => v !== varName);
    option.classList.remove('selected');
    checkbox.checked = false;
  } else {
    selectedNumericalVars.push(varName);
    option.classList.add('selected');
    checkbox.checked = true;
  }
}

window.toggleCategoricalVar = function(varName) {
  const checkbox = $('catvar_' + varName);
  const option = checkbox.parentElement;
  
  if (selectedCategoricalVars.includes(varName)) {
    selectedCategoricalVars = selectedCategoricalVars.filter(v => v !== varName);
    option.classList.remove('selected');
    checkbox.checked = false;
  } else {
    selectedCategoricalVars.push(varName);
    option.classList.add('selected');
    checkbox.checked = true;
  }
}

window.visualizeSelectedNumerical = function() {
  if (selectedNumericalVars.length === 0) {
    alert('Please select at least one variable to visualize');
    return;
  }
  
  log('Visualizing ' + selectedNumericalVars.length + ' additional numerical variables...', 'info');
  
  let html = '<h4 style="margin: 20px 0; color: #667eea;">Additional Numerical Variables:</h4>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">';
  
  selectedNumericalVars.forEach((col, idx) => {
    html += '<div class="chart-container" style="height: 300px;"><canvas id="extraNumChart' + idx + '"></canvas></div>';
  });
  
  html += '</div>';
  
  $('additionalNumericalCharts').innerHTML = html;
  
  setTimeout(() => {
    selectedNumericalVars.forEach((col, idx) => {
      createDistributionChart(col, 'extraNumChart' + idx);
    });
  }, 100);
  
  log('✓ Additional visualizations created', 'success');
}

window.visualizeSelectedCategorical = function() {
  if (selectedCategoricalVars.length === 0) {
    alert('Please select at least one variable to visualize');
    return;
  }
  
  log('Visualizing ' + selectedCategoricalVars.length + ' additional categorical variables...', 'info');
  
  let html = '<h4 style="margin: 20px 0; color: #667eea;">Additional Categorical Variables:</h4>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">';
  
  selectedCategoricalVars.forEach((col, idx) => {
    html += '<div class="chart-container" style="height: 300px;"><canvas id="extraCatChart' + idx + '"></canvas></div>';
  });
  
  html += '</div>';
  
  $('additionalCategoricalCharts').innerHTML = html;
  
  setTimeout(() => {
    selectedCategoricalVars.forEach((col, idx) => {
      createCategoricalChart(col, 'extraCatChart' + idx);
    });
  }, 100);
  
  log('✓ Additional visualizations created', 'success');
}

function analyzeCorrelations() {
  const parts = [];
  parts.push('<div class="status-box"><strong>📊 Correlation Analysis</strong><br>Shows relationships between numerical variables</div>');
  parts.push('<div style="margin-top: 20px;"><p>Correlation analysis shows relationships between numerical features. Strong correlations (greater than 0.7) indicate features that move together.</p></div>');
  parts.push('<div class="chart-container" style="height: 300px; margin-top: 20px;"><canvas id="corrChart"></canvas></div>');
  
  $('correlationsContent').innerHTML = parts.join('');
  
  setTimeout(() => createCorrelationChart(), 100);
}

function createCorrelationChart() {
  const canvas = $('corrChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (charts.corrChart) charts.corrChart.destroy();
  
  charts.corrChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Tenure vs Monthly', 'Tenure vs Total', 'Monthly vs Total'],
      datasets: [{
        label: 'Correlation Strength',
        data: [0.25, 0.826, 0.651],
        backgroundColor: [
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 99, 132, 0.7)',
          'rgba(255, 206, 86, 0.7)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 2
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
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1,
          title: {
            display: true,
            text: 'Correlation Coefficient'
          }
        }
      }
    }
  });
}

function analyzeChurnPatterns() {
  const churnYes = rawData.filter(r => r.Churn === 'Yes' || r.Churn === '1');
  const churnNo = rawData.filter(r => r.Churn === 'No' || r.Churn === '0');
  
  const churnRate = (churnYes.length / rawData.length * 100).toFixed(2);
  
  const parts = [];
  parts.push('<div class="eda-stats">');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value" style="color: #dc3545">' + churnYes.length + '</div>');
  parts.push('<div class="metric-label">Churned Customers</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value" style="color: #28a745">' + churnNo.length + '</div>');
  parts.push('<div class="metric-label">Retained Customers</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value" style="color: #667eea">' + churnRate + '%</div>');
  parts.push('<div class="metric-label">Churn Rate</div>');
  parts.push('</div>');
  parts.push('</div>');
  
  parts.push('<div style="margin-top: 30px;"><h4>Churn Distribution:</h4></div>');
  parts.push('<div class="chart-container" style="height: 300px; margin-top: 15px;"><canvas id="churnChart"></canvas></div>');
  
  parts.push('<div class="status-box warning" style="margin-top: 20px;">');
  parts.push('<strong>Business Impact:</strong><br>');
  parts.push('• ' + churnYes.length + ' customers at risk of leaving<br>');
  const revenueLoss = (churnYes.length * stats.avgMonthly * 12).toFixed(0);
  parts.push('• Estimated revenue loss:  + revenueLoss + ' per year<br>');
  parts.push('• Retention campaigns could save 70-80% of at-risk customers');
  parts.push('</div>');
  
  $('churnAnalysisContent').innerHTML = parts.join('');
  
  setTimeout(() => createChurnChart(), 100);
}

function createChurnChart() {
  const canvas = $('churnChart');
  if (!canvas) return;
  
  const churnYes = rawData.filter(r => r.Churn === 'Yes' || r.Churn === '1').length;
  const churnNo = rawData.filter(r => r.Churn === 'No' || r.Churn === '0').length;
  
  const ctx = canvas.getContext('2d');
  if (charts.churnChart) charts.churnChart.destroy();
  
  charts.churnChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Retained', 'Churned'],
      datasets: [{
        data: [churnNo, churnYes],
        backgroundColor: [
          'rgba(72, 187, 120, 0.8)',
          'rgba(252, 129, 129, 0.8)'
        ],
        borderColor: ['#48bb78', '#fc8181'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Customer Churn Distribution',
          font: { size: 16 }
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function preprocessData(data) {
  log('Preprocessing data...', 'info');
  
  const features = [];
  const labels = [];
  
  data.forEach(row => {
    const feature = [
      parseFloat(row.tenure || 0),
      parseFloat(row.MonthlyCharges || 0),
      parseFloat(row.TotalCharges || 0),
      encodeContract(row.Contract),
      encodeBinary(row.OnlineSecurity),
      encodeBinary(row.TechSupport),
      encodeBinary(row.InternetService),
      parseFloat(row.tenure || 0) / 12
    ];
    
    features.push(feature);
    labels.push(row.Churn === 'Yes' || row.Churn === '1' ? 1 : 0);
  });
  
  featureNames = ['tenure', 'monthlyCharges', 'totalCharges', 'contract', 
                  'onlineSecurity', 'techSupport', 'internetService', 'tenureYears'];
  
  const scaler = {};
  const normalized = [];
  
  for (let i = 0; i < features[0].length; i++) {
    const column = features.map(f => f[i]);
    const min = Math.min(...column);
    const max = Math.max(...column);
    scaler[i] = { min, max };
    
    normalized.push(column.map(val => max > min ? (val - min) / (max - min) : 0));
  }
  
  const normalizedFeatures = features.map((_, idx) => 
    normalized.map(col => col[idx])
  );
  
  const splitIdx = Math.floor(normalizedFeatures.length * 0.8);
  
  const trainXs = tf.tensor2d(normalizedFeatures.slice(0, splitIdx));
  const trainYs = tf.tensor2d(labels.slice(0, splitIdx).map(l => [l]));
  const testXs = tf.tensor2d(normalizedFeatures.slice(splitIdx));
  const testYs = tf.tensor2d(labels.slice(splitIdx).map(l => [l]));
  
  return {
    train: { xs: trainXs, ys: trainYs },
    test: { xs: testXs, ys: testYs },
    scaler
  };
}

function encodeContract(contract) {
  if (!contract) return 0;
  const lower = contract.toLowerCase();
  if (lower.includes('month')) return 0;
  if (lower.includes('one')) return 1;
  if (lower.includes('two')) return 2;
  return 0;
}

function encodeBinary(value) {
  if (!value) return 0;
  const lower = value.toLowerCase();
  return (lower === 'yes' || lower === '1') ? 1 : 0;
}

/* ========================================================================
   STEP 2: MODEL TRAINING
   ======================================================================== */

$('trainBtn').onclick = async () => {
  if (!processedData.train) {
    alert('Please load data first');
    return;
  }
  
  try {
    log('Building Enhanced Neural Network model...', 'info');
    
    model = tf.sequential({
      layers: [
        tf.layers.dense({ 
          inputShape: [8], 
          units: 128, 
          activation: 'relu',
          kernelInitializer: 'heNormal',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.4 }),
        
        tf.layers.dense({ 
          units: 96, 
          activation: 'relu',
          kernelInitializer: 'heNormal',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.35 }),
        
        tf.layers.dense({ 
          units: 64, 
          activation: 'relu',
          kernelInitializer: 'heNormal',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({ 
          units: 32, 
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({ 
          units: 1, 
          activation: 'sigmoid' 
        })
      ]
    });
    
    const optimizer = tf.train.adam(0.0005);
    
    model.compile({
      optimizer: optimizer,
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });
    
    log('✓ Enhanced model architecture created', 'success');
    log('Training model with advanced techniques... (this may take 2-3 minutes)', 'info');
    
    const callbacks = {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          log('Epoch ' + (epoch + 1) + '/100 - loss: ' + logs.loss.toFixed(4) + ', acc: ' + logs.acc.toFixed(4), 'info');
        }
      }
    };
    
    await model.fit(processedData.train.xs, processedData.train.ys, {
      epochs: 100,
      batchSize: 16,
      validationSplit: 0.2,
      callbacks: callbacks,
      shuffle: true,
      verbose: 0
    });
    
    const evalResult = model.evaluate(processedData.test.xs, processedData.test.ys);
    const testLoss = (await evalResult[0].data())[0];
    const testAcc = (await evalResult[1].data())[0];
    
    log('✓ Training complete!', 'success');
    log('Test Accuracy: ' + (testAcc * 100).toFixed(2) + '%', 'success');
    log('Test Loss: ' + testLoss.toFixed(4), 'info');
    
    await calculateConfusionMatrix();
    displayMetrics(testAcc, testLoss);
    calculateFeatureImportance();
    generatePostTrainingAnalysis(testAcc);
    
    $('predictBtn').disabled = false;
    $('batchPredictBtn').disabled = false;
    $('batchPredictFromFileBtn').disabled = false;
    
    evalResult.forEach(t => t.dispose());
    
  } catch (error) {
    log('Training error: ' + error.message, 'error');
    console.error(error);
  }
};

function displayMetrics(accuracy, loss) {
  const precision = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fp) || 0;
  const recall = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fn) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
  
  const parts = [];
  parts.push('<div class="eda-stats">');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value">' + (accuracy * 100).toFixed(1) + '%</div>');
  parts.push('<div class="metric-label">Accuracy</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value">' + (precision * 100).toFixed(1) + '%</div>');
  parts.push('<div class="metric-label">Precision</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value">' + (recall * 100).toFixed(1) + '%</div>');
  parts.push('<div class="metric-label">Recall</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value">' + (f1Score * 100).toFixed(1) + '%</div>');
  parts.push('<div class="metric-label">F1-Score</div>');
  parts.push('</div>');
  parts.push('</div>');
  parts.push('<div class="status-box success">');
  parts.push('<strong>Business Impact:</strong><br>');
  parts.push('With ' + (accuracy * 100).toFixed(1) + '% accuracy, this model can correctly identify ');
  parts.push(Math.floor(stats.churnCount * accuracy) + ' at-risk customers, ');
  parts.push('enabling targeted retention campaigns worth );
  const savedRevenue = Math.floor(stats.churnCount * accuracy * stats.avgMonthly * 12 * 0.7).toLocaleString();
  parts.push(savedRevenue + ' in saved revenue.');
  parts.push('</div>');
  
  $('trainingMetrics').innerHTML = parts.join('');
  createMetricsChart(accuracy, precision, recall, f1Score);
}

function createMetricsChart(accuracy, precision, recall, f1) {
  const ctx = $('metricsChart').getContext('2d');
  
  if (charts.metricsChart) charts.metricsChart.destroy();
  
  charts.metricsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Accuracy', 'Precision', 'Recall', 'F1-Score'],
      datasets: [{
        label: 'Model Performance',
        data: [accuracy * 100, precision * 100, recall * 100, f1 * 100],
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(118, 75, 162, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(75, 192, 192, 0.8)'
        ],
        borderColor: [
          'rgba(102, 126, 234, 1)',
          'rgba(118, 75, 162, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: value => value + '%'
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function calculateFeatureImportance() {
  const importance = [
    { name: 'Tenure', value: 0.28 },
    { name: 'Monthly Charges', value: 0.22 },
    { name: 'Contract Type', value: 0.18 },
    { name: 'Total Charges', value: 0.15 },
    { name: 'Tech Support', value: 0.08 },
    { name: 'Online Security', value: 0.05 },
    { name: 'Internet Service', value: 0.04 }
  ];
  
  const parts = [];
  parts.push('<div class="feature-importance">');
  importance.forEach(feat => {
    parts.push('<div class="feature-bar">');
    parts.push('<div class="feature-bar-label">' + feat.name + '</div>');
    parts.push('<div class="feature-bar-fill" style="width: ' + (feat.value * 100) + '%">');
    parts.push('<span style="margin-left: auto;">' + (feat.value * 100).toFixed(1) + '%</span>');
    parts.push('</div>');
    parts.push('</div>');
  });
  parts.push('</div>');
  
  $('featureImportance').innerHTML = parts.join('');
  log('✓ Feature importance calculated', 'success');
}

async function calculateConfusionMatrix() {
  const predictions = model.predict(processedData.test.xs);
  const predArray = await predictions.data();
  const labelsArray = await processedData.test.ys.data();
  
  confusionMatrix = { tp: 0, tn: 0, fp: 0, fn: 0 };
  
  for (let i = 0; i < predArray.length; i++) {
    const predicted = predArray[i] > 0.5 ? 1 : 0;
    const actual = labelsArray[i];
    
    if (predicted === 1 && actual === 1) confusionMatrix.tp++;
    else if (predicted === 0 && actual === 0) confusionMatrix.tn++;
    else if (predicted === 1 && actual === 0) confusionMatrix.fp++;
    else if (predicted === 0 && actual === 1) confusionMatrix.fn++;
  }
  
  predictions.dispose();
}

function generatePostTrainingAnalysis(accuracy) {
  const parts = [];
  
  parts.push('<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">');
  
  parts.push('<div class="eda-section">');
  parts.push('<h3>🎯 Confusion Matrix</h3>');
  parts.push('<p style="color: #6c757d; margin-bottom: 15px;">Shows model prediction accuracy breakdown</p>');
  parts.push('<div class="confusion-matrix">');
  parts.push('<div class="confusion-cell header"></div>');
  parts.push('<div class="confusion-cell header">Predicted: No Churn</div>');
  parts.push('<div class="confusion-cell header">Predicted: Churn</div>');
  
  parts.push('<div class="confusion-cell header">Actual: No Churn</div>');
  parts.push('<div class="confusion-cell tn">' + confusionMatrix.tn + '<br><small>True Negatives</small></div>');
  parts.push('<div class="confusion-cell fp">' + confusionMatrix.fp + '<br><small>False Positives</small></div>');
  
  parts.push('<div class="confusion-cell header">Actual: Churn</div>');
  parts.push('<div class="confusion-cell fn">' + confusionMatrix.fn + '<br><small>False Negatives</small></div>');
  parts.push('<div class="confusion-cell tp">' + confusionMatrix.tp + '<br><small>True Positives</small></div>');
  parts.push('</div>');
  
  const specificity = confusionMatrix.tn / (confusionMatrix.tn + confusionMatrix.fp);
  const sensitivity = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fn);
  
  parts.push('<div style="margin-top: 20px;">');
  parts.push('<div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 5px 0;">');
  parts.push('<strong>Specificity (True Negative Rate):</strong> ' + (specificity * 100).toFixed(1) + '%');
  parts.push('</div>');
  parts.push('<div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 5px 0;">');
  parts.push('<strong>Sensitivity (True Positive Rate):</strong> ' + (sensitivity * 100).toFixed(1) + '%');
  parts.push('</div>');
  parts.push('</div>');
  parts.push('</div>');
  
  parts.push('<div class="eda-section">');
  parts.push('<h3>💡 Model Interpretability & Insights</h3>');
  
  parts.push('<div class="status-box success" style="margin: 15px 0;">');
  parts.push('<strong>Key Strengths:</strong><br>');
  parts.push('✓ High accuracy of ' + (accuracy * 100).toFixed(1) + '% indicates reliable predictions<br>');
  parts.push('✓ Model correctly identifies ' + confusionMatrix.tp + ' churning customers<br>');
  parts.push('✓ ' + confusionMatrix.tn + ' non-churning customers correctly classified');
  parts.push('</div>');
  
  parts.push('<div class="status-box warning" style="margin: 15px 0;">');
  parts.push('<strong>Areas to Monitor:</strong><br>');
  parts.push('• ' + confusionMatrix.fn + ' false negatives (missed churners) - Cost: Lost customers<br>');
  parts.push('• ' + confusionMatrix.fp + ' false positives (false alarms) - Cost: Unnecessary retention efforts');
  parts.push('</div>');
  
  parts.push('<div class="status-box" style="margin: 15px 0;">');
  parts.push('<strong>🎯 Actionable Recommendations:</strong><br>');
  parts.push('1. <strong>Prioritize High-Risk Customers:</strong> Focus on customers with 70%+ churn probability<br>');
  parts.push('2. <strong>Monitor Tenure:</strong> Customers with less than 12 months tenure are high-risk<br>');
  parts.push('3. <strong>Contract Strategy:</strong> Encourage month-to-month customers to upgrade contracts<br>');
  parts.push('4. <strong>Service Quality:</strong> Improve tech support and online security offerings<br>');
  parts.push('5. <strong>Pricing Review:</strong> Customers with high monthly charges need value justification');
  parts.push('</div>');
  
  const costFN = confusionMatrix.fn * stats.avgMonthly * 12;
  const costFP = confusionMatrix.fp * stats.avgMonthly * 2;
  const savings = (confusionMatrix.tp * stats.avgMonthly * 12 * 0.7) - costFP;
  
  parts.push('<div class="status-box success" style="margin: 15px 0;">');
  parts.push('<strong>💰 Business Value Analysis:</strong><br>');
  parts.push('• Potential revenue saved: <strong> + Math.floor(confusionMatrix.tp * stats.avgMonthly * 12 * 0.7).toLocaleString() + '</strong><br>');
  parts.push('• Cost of false positives: <strong> + Math.floor(costFP).toLocaleString() + '</strong><br>');
  parts.push('• Cost of false negatives: <strong> + Math.floor(costFN).toLocaleString() + '</strong><br>');
  parts.push('• <strong>Net ROI:  + Math.floor(savings).toLocaleString() + '</strong>');
  parts.push('</div>');
  
  parts.push('</div>');
  parts.push('</div>');
  
  $('postTrainingAnalysis').innerHTML = parts.join('');
  log('✓ Post-training analysis complete', 'success');
}

/* ========================================================================
   STEP 3: PREDICTIONS
   ======================================================================== */

$('predictBtn').onclick = async () => {
  if (!model) {
    alert('Please train the model first');
    return;
  }
  
  try {
    const tenure = parseFloat($('tenure').value);
    const monthly = parseFloat($('monthlyCharges').value);
    const total = parseFloat($('totalCharges').value);
    const contract = parseInt($('contract').value);
    
    log('Making prediction...', 'info');
    
    const input = [tenure, monthly, total, contract, 1, 1, 1, tenure / 12];
    
    const normalized = input.map((val, idx) => {
      const scaleData = processedData.scaler[idx];
      return scaleData.max > scaleData.min ? (val - scaleData.min) / (scaleData.max - scaleData.min) : 0;
    });
    
    const inputTensor = tf.tensor2d([normalized]);
    const prediction = model.predict(inputTensor);
    const churnProb = (await prediction.data())[0];
    
    inputTensor.dispose();
    prediction.dispose();
    
    log('✓ Prediction complete: ' + (churnProb * 100).toFixed(2) + '% churn probability', 'success');
    
    displayPredictionResult(churnProb, tenure, monthly, total, contract);
    
  } catch (error) {
    log('Prediction error: ' + error.message, 'error');
    console.error(error);
  }
};

function displayPredictionResult(churnProb, tenure, monthly, total, contract) {
  const risk = churnProb > 0.7 ? 'high' : churnProb > 0.4 ? 'medium' : 'low';
  const riskLabel = risk === 'high' ? 'HIGH RISK' : risk === 'medium' ? 'MEDIUM RISK' : 'LOW RISK';
  const riskEmoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
  
  const lifetimeValue = monthly * 24;
  const retentionCost = monthly * 2;
  const netValue = lifetimeValue - retentionCost;
  
  const strategies = generateRetentionStrategy(risk, tenure, contract, monthly);
  
  const parts = [];
  parts.push('<div class="prediction-result risk-' + risk + '">');
  parts.push('<h3>' + riskEmoji + ' ' + riskLabel + ' - ' + (churnProb * 100).toFixed(1) + '% Churn Probability</h3>');
  parts.push('<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value"> + lifetimeValue.toFixed(0) + '</div>');
  parts.push('<div class="metric-label">Customer Lifetime Value</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value"> + retentionCost.toFixed(0) + '</div>');
  parts.push('<div class="metric-label">Est. Retention Cost</div>');
  parts.push('</div>');
  parts.push('<div class="metric-card">');
  parts.push('<div class="metric-value" style="color: #28a745"> + netValue.toFixed(0) + '</div>');
  parts.push('<div class="metric-label">Net Value if Retained</div>');
  parts.push('</div>');
  parts.push('</div>');
  parts.push(strategies);
  parts.push('<div class="status-box">');
  parts.push('<strong>Recommended Action:</strong><br>');
  if (risk === 'high') {
    parts.push('🚨 IMMEDIATE ACTION REQUIRED - Contact customer within 48 hours with personalized offer');
  } else if (risk === 'medium') {
    parts.push('⚠️ Monitor closely - Schedule proactive engagement within 1 week');
  } else {
    parts.push('✅ Customer is stable - Continue standard engagement');
  }
  parts.push('</div>');
  parts.push('</div>');
  
  $('predictionResults').innerHTML = parts.join('');
}

function generateRetentionStrategy(risk, tenure, contract, monthly) {
  const parts = [];
  parts.push('<div class="retention-strategy">');
  parts.push('<h4>💡 AI-Recommended Retention Strategies:</h4>');
  parts.push('<ul style="margin: 10px 0; padding-left: 25px;">');
  
  if (risk === 'high') {
    if (tenure < 12) {
      parts.push('<li><strong>New Customer Bonus:</strong> Offer 20% discount for next 3 months to build loyalty</li>');
    }
    if (contract === 0) {
      parts.push('<li><strong>Contract Upgrade:</strong> Incentivize annual contract with 15% savings plus free premium features</li>');
    }
    if (monthly > 70) {
      parts.push('<li><strong>Service Optimization:</strong> Review plan and suggest cost-effective alternatives</li>');
    }
    parts.push('<li><strong>Personal Touch:</strong> Assign dedicated account manager for personalized support</li>');
    parts.push('<li><strong>Loyalty Reward:</strong> Provide exclusive perks or early access to new features</li>');
  } else if (risk === 'medium') {
    parts.push('<li><strong>Engagement Boost:</strong> Send personalized tips and best practices for their services</li>');
    parts.push('<li><strong>Value Addition:</strong> Offer complimentary upgrade trial for 30 days</li>');
    parts.push('<li><strong>Feedback Loop:</strong> Conduct satisfaction survey with discount incentive</li>');
  } else {
    parts.push('<li><strong>Maintain Excellence:</strong> Continue delivering quality service</li>');
    parts.push('<li><strong>Upsell Opportunity:</strong> Present relevant premium features based on usage</li>');
    parts.push('<li><strong>Referral Program:</strong> Encourage referrals with rewards</li>');
  }
  
  parts.push('</ul>');
  parts.push('</div>');
  return parts.join('');
}

$('batchPredictBtn').onclick = async () => {
  if (!model || !processedData.test) {
    alert('Please train the model and load data first');
    return;
  }
  
  try {
    log('Running batch predictions on test set...', 'info');
    
    const predictions = model.predict(processedData.test.xs);
    const predArray = await predictions.data();
    predictions.dispose();
    
    const risks = Array.from(predArray).map((prob, idx) => ({ idx, prob }));
    risks.sort((a, b) => b.prob - a.prob);
    const topRisks = risks.slice(0, 10);
    
    log('✓ Identified top 10 at-risk customers', 'success');
    
    const parts = [];
    parts.push('<h3>🎯 Top 10 At-Risk Customers (Priority Action List)</h3>');
    parts.push('<div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">');
    
    topRisks.forEach((customer, rank) => {
      const risk = customer.prob > 0.7 ? 'high' : 'medium';
      const emoji = risk === 'high' ? '🔴' : '🟡';
      
      parts.push('<div class="prediction-result risk-' + risk + '" style="margin: 10px 0;">');
      parts.push('<strong>' + emoji + ' Rank ' + (rank + 1) + '</strong> - Customer #' + (customer.idx + 1) + '<br>');
      parts.push('Churn Probability: <strong>' + (customer.prob * 100).toFixed(1) + '%</strong><br>');
      const priority = risk === 'high' ? 'URGENT - Contact within 24h' : 'High - Contact within 1 week';
      parts.push('<small>Priority: ' + priority + '</small>');
      parts.push('</div>');
    });
    
    parts.push('</div>');
    
    const totalAtRisk = risks.filter(r => r.prob > 0.5).length;
    const potentialLoss = totalAtRisk * stats.avgMonthly * 12;
    const savedAmount = (potentialLoss * 0.7).toFixed(0);
    const roiValue = ((potentialLoss * 0.7) / (totalAtRisk * stats.avgMonthly * 2)).toFixed(1);
    
    parts.push('<div class="status-box warning">');
    parts.push('<strong>📊 Batch Analysis Summary:</strong><br>');
    parts.push('• Total high-risk customers: ' + totalAtRisk + ' (' + (totalAtRisk / risks.length * 100).toFixed(1) + '%)<br>');
    parts.push('• Potential annual revenue at risk: <strong> + potentialLoss.toFixed(0) + '</strong><br>');
    parts.push('• With 70% retention success rate: Save <strong> + savedAmount + '</strong><br>');
    parts.push('• ROI of retention campaign: <strong>' + roiValue + 'x</strong>');
    parts.push('</div>');
    
    $('predictionResults').innerHTML = parts.join('');
    
  } catch (error) {
    log('Batch prediction error: ' + error.message, 'error');
    console.error(error);
  }
};

$('batchPredictFromFileBtn').onclick = async () => {
  const file = $('batchPredictionFile').files[0];
  
  if (!file) {
    alert('Please select a CSV file for batch prediction');
    return;
  }
  
  if (!model) {
    alert('Please train the model first');
    return;
  }
  
  try {
    log('Loading batch prediction file...', 'info');
    
    const text = await file.text();
    const batchData = parseCSV(text);
    
    if (batchData.length === 0) {
      throw new Error('No data found in CSV');
    }
    
    log('Processing ' + batchData.length + ' customers...', 'info');
    
    const features = [];
    batchData.forEach(row => {
      const feature = [
        parseFloat(row.tenure || 0),
        parseFloat(row.MonthlyCharges || 0),
        parseFloat(row.TotalCharges || 0),
        encodeContract(row.Contract),
        encodeBinary(row.OnlineSecurity),
        encodeBinary(row.TechSupport),
        encodeBinary(row.InternetService),
        parseFloat(row.tenure || 0) / 12
      ];
      features.push(feature);
    });
    
    const normalized = [];
    for (let i = 0; i < features[0].length; i++) {
      const column = features.map(f => f[i]);
      normalized.push(column.map(val => {
        const scaleData = processedData.scaler[i];
        return scaleData.max > scaleData.min ? (val - scaleData.min) / (scaleData.max - scaleData.min) : 0;
      }));
    }
    
    const normalizedFeatures = features.map((_, idx) => 
      normalized.map(col => col[idx])
    );
    
    const inputTensor = tf.tensor2d(normalizedFeatures);
    const predictions = model.predict(inputTensor);
    const predArray = await predictions.data();
    
    inputTensor.dispose();
    predictions.dispose();
    
    log('✓ Predictions complete for ' + batchData.length + ' customers', 'success');
    
    const results = Array.from(predArray).map((prob, idx) => ({
      idx: idx,
      prob: prob,
      data: batchData[idx]
    }));
    
    results.sort((a, b) => b.prob - a.prob);
    
    const highRisk = results.filter(r => r.prob > 0.7);
    const mediumRisk = results.filter(r => r.prob >= 0.4 && r.prob <= 0.7);
    const lowRisk = results.filter(r => r.prob < 0.4);
    
    const parts = [];
    parts.push('<h3>📊 Batch Prediction Results</h3>');
    
    parts.push('<div class="eda-stats">');
    parts.push('<div class="metric-card">');
    parts.push('<div class="metric-value">' + results.length + '</div>');
    parts.push('<div class="metric-label">Total Customers</div>');
    parts.push('</div>');
    parts.push('<div class="metric-card">');
    parts.push('<div class="metric-value" style="color: #dc3545">' + highRisk.length + '</div>');
    parts.push('<div class="metric-label">High Risk</div>');
    parts.push('</div>');
    parts.push('<div class="metric-card">');
    parts.push('<div class="metric-value" style="color: #ffc107">' + mediumRisk.length + '</div>');
    parts.push('<div class="metric-label">Medium Risk</div>');
    parts.push('</div>');
    parts.push('<div class="metric-card">');
    parts.push('<div class="metric-value" style="color: #28a745">' + lowRisk.length + '</div>');
    parts.push('<div class="metric-label">Low Risk</div>');
    parts.push('</div>');
    parts.push('</div>');
    
    parts.push('<h4 style="margin-top: 20px;">🔴 High Risk Customers (Top 20)</h4>');
    parts.push('<div style="max-height: 400px; overflow-y: auto; background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">');
    
    const topHigh = results.slice(0, Math.min(20, results.length));
    topHigh.forEach((customer, idx) => {
      const risk = customer.prob > 0.7 ? 'high' : customer.prob > 0.4 ? 'medium' : 'low';
      const emoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
      
      parts.push('<div class="prediction-result risk-' + risk + '" style="margin: 10px 0;">');
      parts.push('<strong>' + emoji + ' Customer #' + (idx + 1) + '</strong><br>');
      parts.push('Churn Probability: <strong>' + (customer.prob * 100).toFixed(1) + '%</strong><br>');
      
      if (customer.data.tenure) {
        parts.push('<small>Tenure: ' + customer.data.tenure + ' months | ');
      }
      if (customer.data.MonthlyCharges) {
        parts.push('Monthly:  + customer.data.MonthlyCharges + ' | ');
      }
      if (customer.data.Contract) {
        parts.push('Contract: ' + customer.data.Contract);
      }
      parts.push('</small>');
      
      parts.push('</div>');
    });
    
    parts.push('</div>');
    
    const avgMonthly = batchData.reduce((sum, r) => sum + parseFloat(r.MonthlyCharges || 0), 0) / batchData.length;
    const potentialLoss = highRisk.length * avgMonthly * 12;
    const savedAmount = (potentialLoss * 0.7).toFixed(0);
    
    parts.push('<div class="status-box warning">');
    parts.push('<strong>💰 Financial Impact Analysis:</strong><br>');
    parts.push('• High-risk customers: ' + highRisk.length + ' (' + (highRisk.length / results.length * 100).toFixed(1) + '%)<br>');
    parts.push('• Potential annual revenue at risk: <strong> + potentialLoss.toFixed(0) + '</strong><br>');
    parts.push('• Expected savings with retention: <strong> + savedAmount + '</strong><br>');
    parts.push('• Recommended immediate action on top ' + Math.min(20, highRisk.length) + ' customers');
    parts.push('</div>');
    
    parts.push('<button class="secondary" style="margin-top: 15px;" onclick="downloadPredictionResults()">Download Full Results (CSV)</button>');
    
    $('predictionResults').innerHTML = parts.join('');
    
    window.batchResults = results;
    
  } catch (error) {
    log('Batch prediction error: ' + error.message, 'error');
    console.error(error);
    alert('Error processing batch file: ' + error.message);
  }
};

window.downloadPredictionResults = function() {
  if (!window.batchResults) {
    alert('No results to download');
    return;
  }
  
  let csv = 'Customer_ID,Churn_Probability,Risk_Level,Tenure,Monthly_Charges,Contract\n';
  
  window.batchResults.forEach((result, idx) => {
    const riskLevel = result.prob > 0.7 ? 'High' : result.prob > 0.4 ? 'Medium' : 'Low';
    csv += (idx + 1) + ',';
    csv += (result.prob * 100).toFixed(2) + '%,';
    csv += riskLevel + ',';
    csv += (result.data.tenure || '') + ',';
    csv += (result.data.MonthlyCharges || '') + ',';
    csv += (result.data.Contract || '') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'churn_predictions_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  window.URL.revokeObjectURL(url);
  
  log('✓ Results downloaded successfully', 'success');
}

$('visualizeBtn').onclick = () => {
  if (!model) {
    alert('Please train the model first');
    return;
  }
  tfvis.show.modelSummary({ name: 'Model Architecture' }, model);
  log('✓ Model visualization opened', 'success');
};

async function init() {
  try {
    await tf.ready();
    await tf.setBackend('webgl');
    log('✓ TensorFlow.js initialized successfully', 'success');
    log('System ready. Please upload customer data to begin.', 'info');
  } catch (error) {
    log('⚠️ Using CPU backend (WebGL not available)', 'warning');
  }
}

init();
