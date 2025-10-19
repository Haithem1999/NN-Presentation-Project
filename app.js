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
    
    // Show EDA tabs
    $('edaTabs').style.display = 'flex';
    
    // Perform comprehensive EDA
    log('Starting EDA...', 'info');
    performComprehensiveEDA();
    
    // Process data for training
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

/* ========================================================================
   QUICK OVERVIEW
   ======================================================================== */

function displayQuickOverview() {
  const columns = Object.keys(rawData[0]);
  const numRows = rawData.length;
  const numCols = columns.length;
  
  const churnCount = rawData.filter(r => r.Churn === 'Yes' || r.Churn === '1').length;
  const churnRate = (churnCount / numRows * 100).toFixed(2);
  
  // Calculate averages
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
      • Potential revenue loss: $${(churnCount * avgMonthly * 12).toFixed(0)}/year<br>
      • Average tenure: ${avgTenure} months | Average monthly charge: $${avgMonthly}
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
    const missing = rawData.filter(row => !row[col] || row[col] === '' || row[col] === 'NA' || row[col] === 'null').length;
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
  const totalMissing = Object.values(dataQualityInfo.missingValues).reduce((sum, v) => sum + v.count, 0);
  const totalCells = dataQualityInfo.totalRows * dataQualityInfo.totalColumns;
  const completeness = ((totalCells - totalMissing) / totalCells * 100).toFixed(1);
  
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

window.showMissingValuesDetails = function() {
  const missingSummary = Object.entries(dataQualityInfo.missingValues);
  
  let modalHTML = `
    <div class="status-box warning">
      <strong>⚠️ Found ${missingSummary.length} columns with missing values</strong><br>
      Total missing cells: ${missingSummary.reduce((sum, [, info]) => sum + info.count, 0)}
    </div>
    <h4 style="margin: 20px 0;">Choose a handling method:</h4>
  `;
  
  modalHTML += `
    <div class="option-card" onclick="handleMissingValues('drop')">
      <h4>🗑️ Drop Rows with Missing Values <span class="recommendation-badge">Best for <5% missing</span></h4>
      <p><strong>When to use:</strong> When missing data is minimal (< 5%) and randomly distributed</p>
      <p><strong>Pros:</strong> Clean data, no assumptions made</p>
      <p><strong>Cons:</strong> Loss of data, reduces sample size</p>
    </div>
    <div class="option-card" onclick="handleMissingValues('mean')">
      <h4>📊 Fill with Mean/Median <span class="recommendation-badge">Recommended</span></h4>
      <p><strong>When to use:</strong> For numerical columns with missing values</p>
      <p><strong>Pros:</strong> No data loss, statistically sound</p>
      <p><strong>Cons:</strong> May slightly reduce variance</p>
    </div>
    <div class="option-card" onclick="handleMissingValues('mode')">
      <h4>📁 Fill with Most Frequent Value (Mode)</h4>
      <p><strong>When to use:</strong> For categorical columns with missing values</p>
      <p><strong>Pros:</strong> No data loss, maintains majority patterns</p>
      <p><strong>Cons:</strong> May introduce bias toward dominant category</p>
    </div>
  `;
  
  $('missingValuesOptions').innerHTML = modalHTML;
  openModal('missingValuesModal');
}

window.handleMissingValues = function(method) {
  log(`Handling missing values using: ${method}`, 'info');
  
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
    log(`Error handling missing values: ${error.message}`, 'error');
    console.error(error);
  }
}

window.showDuplicatesDetails = function() {
  let modalHTML = `
    <div class="status-box warning">
      <strong>⚠️ Found ${dataQualityInfo.duplicates} duplicate records</strong><br>
      This represents ${((dataQualityInfo.duplicates / dataQualityInfo.totalRows) * 100).toFixed(2)}% of your dataset
    </div>
    <h4 style="margin: 20px 0;">Choose a handling method:</h4>
  `;
  
  modalHTML += `
    <div class="option-card" onclick="handleDuplicates('remove')">
      <h4>🗑️ Remove All Duplicates <span class="recommendation-badge">Recommended</span></h4>
      <p><strong>When to use:</strong> When duplicates are data entry errors</p>
      <p><strong>Impact:</strong> Will remove ${dataQualityInfo.duplicates} duplicate rows</p>
      <p><strong>Pros:</strong> Clean dataset, no redundancy</p>
    </div>
    <div class="option-card" onclick="handleDuplicates('keep')">
      <h4>✅ Keep All Duplicates</h4>
      <p><strong>When to use:</strong> When duplicates are valid repeated observations</p>
      <p><strong>Pros:</strong> No data loss</p>
    </div>
  `;
  
  $('duplicatesOptions').innerHTML = modalHTML;
  openModal('duplicatesModal');
}

window.handleDuplicates = function(method) {
  log(`Handling duplicates using: ${method}`, 'info');
  
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
    log(`Error handling duplicates: ${error.message}`, 'error');
    console.error(error);
  }
}

/* ========================================================================
   NUMERICAL ANALYSIS
   ======================================================================== */

function analyzeNumericalVariables() {
  const numericalCols = ['tenure', 'MonthlyCharges', 'TotalCharges'];
  
  let html = '<div class="data-quality-grid">';
  
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
    }
  });
  
  html += '</div>';
  
  html += '<div style="margin-top: 30px;"><h4>Distribution Analysis:</h4></div>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-top: 15px;">';
  
  numericalCols.forEach((col, idx) => {
    if (rawData[0] && rawData[0][col]) {
      html += `<div class="chart-container" style="height: 250px;"><canvas id="numChart${idx}"></canvas></div>`;
    }
  });
  
  html += '</div>';
  
  $('numericalContent').innerHTML = html;
  
  setTimeout(() => {
    numericalCols.forEach((col, idx) => {
      if (rawData[0] && rawData[0][col]) {
        createDistributionChart(col, `numChart${idx}`);
      }
    });
  }, 100);
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
    const binEnd = binStart + binSize;
    labels.push(`${binStart.toFixed(0)}`);
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
          text: `${column} Distribution`
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

/* ========================================================================
   CATEGORICAL ANALYSIS
   ======================================================================== */

function analyzeCategoricalVariables() {
  const categoricalCols = ['Contract', 'InternetService', 'OnlineSecurity', 'TechSupport'];
  
  let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">';
  
  let chartIndex = 0;
  categoricalCols.forEach(col => {
    if (rawData[0] && rawData[0][col]) {
      html += `<div class="chart-container" style="height: 300px;"><canvas id="catChart${chartIndex}"></canvas></div>`;
      chartIndex++;
    }
  });
  
  html += '</div>';
  
  html += '<div style="margin-top: 30px;"><h4>Frequency Tables:</h4></div>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 15px;">';
  
  categoricalCols.forEach(col => {
    if (rawData[0] && rawData[0][col]) {
      const valueCounts = {};
      rawData.forEach(row => {
        if (row[col]) {
          valueCounts[row[col]] = (valueCounts[row[col]] || 0) + 1;
        }
      });
      
      html += `<div class="quality-card"><h4>${col}</h4><table style="width: 100%; margin-top: 10px;">`;
      
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
  
  setTimeout(() => {
    let chartIndex = 0;
    categoricalCols.forEach(col => {
      if (rawData[0] && rawData[0][col]) {
        createCategoricalChart(col, `catChart${chartIndex}`);
        chartIndex++;
      }
    });
  }, 100);
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
          text: `${column} Distribution`,
          font: { size: 16 }
        },
        legend: { position: 'bottom' }
      }
    }
  });
}

/* ========================================================================
   CORRELATION ANALYSIS
   ======================================================================== */

function analyzeCorrelations() {
  let html = '<div class="status-box"><strong>📊 Correlation Analysis</strong><br
