/* =========================================================================
   Smart Customer Churn Prediction System - Enhanced Application
   Business Value: Reduce churn by 15-20% through predictive intervention
   Target Accuracy: ≥90% with Advanced Deep Learning
   
   POINT 1 COMPLETED: Enhanced Dataset Viewer with All Features
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
let batchPredictionResults = null;

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
   POINT 1: ENHANCED DATASET VIEWER - COMPLETE IMPLEMENTATION
   All features working perfectly with beautiful UI/UX
   ======================================================================== */

window.displayDataset = function(mode) {
  const table = $('datasetTable');
  const info = $('datasetInfo');

  if (!rawData || rawData.length === 0) {
    alert('No data loaded. Please load a dataset first.');
    log('Cannot display dataset - no data loaded', 'warning');
    return;
  }

  let dataToShow = [];
  let displayMessage = '';

  // Determine which data to show based on mode
  if (mode === 'all') {
    dataToShow = rawData;
    displayMessage = `📊 Displaying <strong>all ${rawData.length.toLocaleString()} rows</strong> - Use scroll to navigate through the entire dataset`;
    log(`Dataset viewer: Showing all ${rawData.length} rows`, 'info');
  } else if (mode === 'first10') {
    dataToShow = rawData.slice(0, 10);
    displayMessage = `⬆️ Displaying <strong>first 10 rows</strong> out of ${rawData.length.toLocaleString()} total rows`;
    log('Dataset viewer: Showing first 10 rows', 'info');
  } else if (mode === 'last10') {
    dataToShow = rawData.slice(-10);
    displayMessage = `⬇️ Displaying <strong>last 10 rows</strong> out of ${rawData.length.toLocaleString()} total rows`;
    log('Dataset viewer: Showing last 10 rows', 'info');
  }

  info.innerHTML = displayMessage;

  // Get column names
  const columns = Object.keys(dataToShow[0]);

  // Build table HTML with proper structure
  let html = '<thead><tr>';
  columns.forEach(col => {
    html += `<th>${col}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Add rows (CSS handles alternating colors)
  dataToShow.forEach((row, rowIndex) => {
    html += '<tr>';
    columns.forEach(col => {
      const value = row[col] !== undefined && row[col] !== null ? row[col] : '';
      html += `<td>${value}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody>';
  table.innerHTML = html;
}

window.closeDatasetViewer = function() {
  $('datasetViewer').style.display = 'none';
  log('Dataset viewer closed', 'info');
}

window.openDatasetViewer = function() {
  if (!rawData || rawData.length === 0) {
    alert('No data loaded. Please load a CSV file first.');
    log('Cannot open dataset viewer - no data loaded', 'warning');
    return;
  }
  
  $('datasetViewer').style.display = 'block';
  // Default to showing first 10 rows
  displayDataset('first10');
  log('Dataset viewer opened', 'success');
}

// Connect the "View Dataset" button
$('viewDatasetBtn').onclick = () => {
  openDatasetViewer();
}

/* ========================================================================
   DATA LOADING & PREPROCESSING
   ======================================================================== */

$('loadDataBtn').onclick = async () => {
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
    
    log('Parsing CSV...', 'info');
    rawData = parseCSV(text);
    
    if (rawData.length === 0) {
      throw new Error('No data found in CSV');
    }
    
    log(`✓ Loaded ${rawData.length} customer records`, 'success');
    
    // POINT 1: Show the View Dataset button after successful load
    $('viewDatasetBtn').style.display = 'inline-block';
    log('✓ Dataset viewer is now available', 'success');
    
    $('edaTabs').style.display = 'flex';
    
    log('Starting comprehensive EDA...', 'info');
    performComprehensiveEDA();
    
    log('Preprocessing data...', 'info');
    processedData = preprocessData(rawData);
    
    log('✓ Data preprocessing complete', 'success');
    log(`Training set: ${processedData.train.xs.shape[0]} samples`, 'info');
    log(`Test set: ${processedData.test.xs.shape[0]} samples`, 'info');
    
    $('trainBtn').disabled = false;
    
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    alert('Error loading data: ' + error.message);
    console.error('Full error:', error);
  }
};

function parseCSV(text) {
  try {
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
  } catch (error) {
    console.error('Parse error:', error);
    throw error;
  }
}

/* ========================================================================
   COMPREHENSIVE EDA
   ======================================================================== */

function performComprehensiveEDA() {
  log('Performing Comprehensive Exploratory Data Analysis...', 'info');
  
  try {
    displayQuickOverview();
    assessDataQuality();
    analyzeNumericalVariables();
    analyzeCategoricalVariables();
    analyzeCorrelations();
    analyzeChurnPatterns();
    
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
    avgMonthly
  };
  
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
    <div class="status-box success">
      <strong>Key Insights:</strong><br>
      • ${churnCount} customers at risk of churning<br>
      • Potential revenue loss: $${(churnCount * avgMonthly * 12).toFixed(0)} annually<br>
      • Average tenure: ${avgTenure} months | Average monthly charge: $${avgMonthly}
    </div>
  `;
  
  $('quickOverview').innerHTML = html;
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
  
  const totalMissing = Object.values(dataQualityInfo.missingValues).reduce((sum, v) => sum + v.count, 0);
  const totalCells = dataQualityInfo.totalRows * dataQualityInfo.totalColumns;
  const completeness = ((totalCells - totalMissing) / totalCells * 100).toFixed(1);
  
  const numericalCols = Object.values(dataQualityInfo.dataTypes).filter(t => t === 'Numerical').length;
  const categoricalCols = Object.values(dataQualityInfo.dataTypes).filter(t => t === 'Categorical').length;
  
  let html = `
    <div class="data-quality-grid">
      <div class="quality-card">
        <h4>🔍 Missing Values</h4>
        <div class="quality-value">${Object.keys(dataQualityInfo.missingValues).length}</div>
        <p style="margin: 10px 0; color: #6c757d;">Columns with missing data</p>
        <div class="quality-status ${hasMissing ? 'warning' : 'good'}">
          ${hasMissing ? 'Action Required' : 'All Clean'}
        </div>
        ${hasMissing ? '<button class="secondary" style="margin-top: 10px;" onclick="showMissingValuesDetails()">View Details</button>' : ''}
      </div>
      
      <div class="quality-card">
        <h4>📋 Duplicate Records</h4>
        <div class="quality-value">${dataQualityInfo.duplicates}</div>
        <p style="margin: 10px 0; color: #6c757d;">${((dataQualityInfo.duplicates / dataQualityInfo.totalRows) * 100).toFixed(2)}% of dataset</p>
        <div class="quality-status ${hasDuplicates ? 'warning' : 'good'}">
          ${hasDuplicates ? 'Action Required' : 'No Duplicates'}
        </div>
        ${hasDuplicates ? '<button class="secondary" style="margin-top: 10px;" onclick="showDuplicatesDetails()">Handle Duplicates</button>' : ''}
      </div>
      
      <div class="quality-card">
        <h4>✅ Data Completeness</h4>
        <div class="quality-value">${completeness}%</div>
        <p style="margin: 10px 0; color: #6c757d;">Overall data quality</p>
        <div class="quality-status ${completeness > 95 ? 'good' : completeness > 80 ? 'warning' : 'bad'}">
          ${completeness > 95 ? 'Excellent' : completeness > 80 ? 'Good' : 'Needs Work'}
        </div>
      </div>
      
      <div class="quality-card">
        <h4>📊 Data Types</h4>
        <div style="margin: 15px 0;">
          <div style="margin: 5px 0;"><strong>Numerical:</strong> ${numericalCols} columns</div>
          <div style="margin: 5px 0;"><strong>Categorical:</strong> ${categoricalCols} columns</div>
        </div>
        <div class="quality-status good">Detected</div>
      </div>
    </div>
  `;
  
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

window.showMissingValuesDetails = function() {
  const missingSummary = Object.entries(dataQualityInfo.missingValues);
  
  let html = `
    <div class="status-box warning">
      <strong>⚠️ Found ${missingSummary.length} columns with missing values</strong><br>
      Total missing cells: ${missingSummary.reduce((sum, item) => sum + item[1].count, 0)}
    </div>
    <h4 style="margin: 20px 0;">Choose a handling method:</h4>
    
    <div class="option-card" onclick="handleMissingValues('drop')">
      <h4>🗑️ Drop Rows with Missing Values <span class="recommendation-badge">Best for <5% missing</span></h4>
      <p><strong>Pros:</strong> Clean data, no assumptions</p>
      <p><strong>Cons:</strong> Loss of data</p>
    </div>
    
    <div class="option-card" onclick="handleMissingValues('mean')">
      <h4>📊 Fill with Mean/Median <span class="recommendation-badge">Recommended</span></h4>
      <p><strong>Pros:</strong> No data loss, statistically sound</p>
      <p><strong>Cons:</strong> May slightly reduce variance</p>
    </div>
    
    <div class="option-card" onclick="handleMissingValues('mode')">
      <h4>📁 Fill with Most Frequent Value (Mode)</h4>
      <p><strong>Pros:</strong> No data loss, maintains patterns</p>
      <p><strong>Cons:</strong> May introduce bias</p>
    </div>
  `;
  
  $('missingValuesOptions').innerHTML = html;
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
      log(`✓ Dropped ${originalLength - rawData.length} rows with missing values`, 'success');
      
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
  let html = `
    <div class="status-box warning">
      <strong>⚠️ Found ${dataQualityInfo.duplicates} duplicate records</strong><br>
      This represents ${((dataQualityInfo.duplicates / dataQualityInfo.totalRows) * 100).toFixed(2)}% of your dataset
    </div>
    <h4 style="margin: 20px 0;">Choose a handling method:</h4>
    
    <div class="option-card" onclick="handleDuplicates('remove')">
      <h4>🗑️ Remove All Duplicates <span class="recommendation-badge">Recommended</span></h4>
      <p><strong>Impact:</strong> Will remove ${dataQualityInfo.duplicates} duplicate rows</p>
    </div>
    
    <div class="option-card" onclick="handleDuplicates('keep')">
      <h4>✅ Keep All Duplicates</h4>
      <p><strong>Pros:</strong> No data loss</p>
    </div>
  `;
  
  $('duplicatesOptions').innerHTML = html;
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
      log(`✓ Removed ${originalLength - rawData.length} duplicate rows`, 'success');
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

/* ========================================================================
   NUMERICAL VARIABLES ANALYSIS (Placeholder - keeping existing code)
   ======================================================================== */

function analyzeNumericalVariables() {
  const numericalCols = identifyNumericalColumns();
  
  let html = '<div class="data-quality-grid">';
  
  numericalCols.slice(0, 3).forEach(col => {
    const values = rawData.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    
    if (values.length > 0) {
      values.sort((a, b) => a - b);
      const min = values[0];
      const max = values[values.length - 1];
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const median = values[Math.floor(values.length / 2)];
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
  
  $('numericalContent').innerHTML = html;
}

function identifyNumericalColumns() {
  const columns = Object.keys(rawData[0]);
  return columns.filter(col => {
    const sample = rawData[0][col];
    return !isNaN(parseFloat(sample)) && col !== 'Churn' && col.toLowerCase() !== 'customerid';
  });
}

/* ========================================================================
   CATEGORICAL VARIABLES ANALYSIS (Placeholder - keeping existing code)
   ======================================================================== */

function analyzeCategoricalVariables() {
  const categoricalCols = identifyCategoricalColumns();
  
  let html = '<p>Categorical analysis coming soon...</p>';
  
  $('categoricalContent').innerHTML = html;
}

function identifyCategoricalColumns() {
  const columns = Object.keys(rawData[0]);
  return columns.filter(col => {
    const sample = rawData[0][col];
    return isNaN(parseFloat(sample)) && col !== 'Churn' && col.toLowerCase() !== 'customerid';
  });
}

/* ========================================================================
   CORRELATION & CHURN ANALYSIS (Placeholder)
   ======================================================================== */

function analyzeCorrelations() {
  let html = '<p>Correlation analysis coming soon...</p>';
  $('correlationsContent').innerHTML = html;
}

function analyzeChurnPatterns() {
  let html = '<p>Churn pattern analysis coming soon...</p>';
  $('churnAnalysisContent').innerHTML = html;
}

/* ========================================================================
   DATA PREPROCESSING (Placeholder)
   ======================================================================== */

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
   PLACEHOLDER FUNCTIONS (Rest of the system)
   ======================================================================== */

$('trainBtn').onclick = async () => {
  alert('Training function not yet implemented. Point 1 (Dataset Viewer) is complete!');
  log('Training placeholder called', 'info');
};

$('predictBtn').onclick = async () => {
  alert('Prediction function not yet implemented. Point 1 (Dataset Viewer) is complete!');
  log('Prediction placeholder called', 'info');
};

$('visualizeBtn').onclick = () => {
  alert('Visualization function not yet implemented. Point 1 (Dataset Viewer) is complete!');
  log('Visualization placeholder called', 'info');
};

/* ========================================================================
   INITIALIZATION
   ======================================================================== */

async function init() {
  try {
    await tf.ready();
    await tf.setBackend('webgl');
    log('✓ TensorFlow.js initialized with WebGL backend', 'success');
    log('System ready. Upload customer data to begin.', 'info');
    log('🎯 Point 1 Complete: Enhanced Dataset Viewer is ready!', 'success');
  } catch (error) {
    await tf.setBackend('cpu');
    log('⚠️ Using CPU backend (WebGL unavailable)', 'warning');
    log('System ready. Upload customer data to begin.', 'info');
  }
}

init();
