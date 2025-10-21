/* =========================================================================
   Smart Customer Churn Prediction System - MLP Neural Network
   Business Value: Reduce churn by 15-20% through predictive intervention
   Target Accuracy: ≥90% with Multi-Layer Perceptron
   
   ✅ POINT 1 COMPLETED: Enhanced Dataset Viewer
   ✅ POINT 2 COMPLETED: Enhanced EDA with Variable Selection
   ✅ POINT 3: MLP Neural Network with Detailed Architecture Visualization
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
let mlpArchitecture = null;

/* ========================================================================
   UTILITY FUNCTIONS
   ======================================================================== */

window.showEDATab = function(tabName) {
  document.querySelectorAll('.eda-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.eda-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  $(tabName).classList.add('active');
};

window.closeDatasetViewer = function() {
  $('datasetViewer').style.display = 'none';
};

window.displayDataset = function(mode) {
  const table = $('datasetTable');
  const info = $('datasetInfo');
  
  let dataToShow = [];
  let infoText = '';
  
  if (mode === 'all') {
    dataToShow = rawData;
    infoText = `Displaying all ${rawData.length} rows`;
  } else if (mode === 'first10') {
    dataToShow = rawData.slice(0, 10);
    infoText = `Displaying first 10 rows of ${rawData.length}`;
  } else if (mode === 'last10') {
    dataToShow = rawData.slice(-10);
    infoText = `Displaying last 10 rows of ${rawData.length}`;
  }
  
  info.innerHTML = infoText;
  
  // Build table
  let html = '<thead><tr>';
  const columns = Object.keys(dataToShow[0] || {});
  columns.forEach(col => html += `<th>${col}</th>`);
  html += '</tr></thead><tbody>';
  
  dataToShow.forEach(row => {
    html += '<tr>';
    columns.forEach(col => {
      const value = row[col];
      html += `<td>${value !== null && value !== undefined ? value : 'N/A'}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  
  table.innerHTML = html;
};

window.closeModal = function(modalId) {
  $(modalId).style.display = 'none';
};

window.visualizeSelectedNumerical = function() {
  if (selectedNumericalVars.length === 0) {
    log('Please select at least one variable to visualize', 'warning');
    return;
  }
  
  const container = $('additionalNumericalCharts');
  container.innerHTML = '';
  
  selectedNumericalVars.forEach(varName => {
    const values = rawData.map(r => parseFloat(r[varName])).filter(v => !isNaN(v));
    
    const div = document.createElement('div');
    div.className = 'chart-container';
    div.innerHTML = `<canvas id="chart_${varName}"></canvas>`;
    container.appendChild(div);
    
    const ctx = div.querySelector('canvas').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Min', 'Q1', 'Median', 'Q3', 'Max', 'Mean'],
        datasets: [{
          label: varName,
          data: [
            Math.min(...values),
            quantile(values, 0.25),
            quantile(values, 0.5),
            quantile(values, 0.75),
            Math.max(...values),
            values.reduce((a,b) => a+b, 0) / values.length
          ],
          backgroundColor: 'rgba(102, 126, 234, 0.6)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: `${varName} Distribution Statistics` }
        }
      }
    });
  });
  
  log(`Visualized ${selectedNumericalVars.length} numerical variables`, 'success');
};

window.visualizeSelectedCategorical = function() {
  if (selectedCategoricalVars.length === 0) {
    log('Please select at least one variable to visualize', 'warning');
    return;
  }
  
  const container = $('additionalCategoricalCharts');
  container.innerHTML = '';
  
  selectedCategoricalVars.forEach(varName => {
    const valueCounts = {};
    rawData.forEach(r => {
      const val = r[varName];
      valueCounts[val] = (valueCounts[val] || 0) + 1;
    });
    
    const div = document.createElement('div');
    div.className = 'chart-container';
    div.innerHTML = `<canvas id="chart_${varName}"></canvas>`;
    container.appendChild(div);
    
    const ctx = div.querySelector('canvas').getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(valueCounts),
        datasets: [{
          data: Object.values(valueCounts),
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(72, 187, 120, 0.8)',
            'rgba(252, 129, 129, 0.8)',
            'rgba(255, 193, 7, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: `${varName} Distribution` },
          legend: { position: 'right' }
        }
      }
    });
  });
  
  log(`Visualized ${selectedCategoricalVars.length} categorical variables`, 'success');
};

function quantile(arr, q) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/* ========================================================================
   DATA LOADING & EDA
   ======================================================================== */

$('loadDataBtn').addEventListener('click', async () => {
  const file = $('dataFile').files[0];
  if (!file) {
    log('Please select a CSV file', 'error');
    return;
  }
  
  log('Loading dataset...');
  const text = await file.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  rawData = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });
  
  log(`Loaded ${rawData.length} records with ${headers.length} features`, 'success');
  
  // Show dataset viewer button
  $('viewDatasetBtn').style.display = 'inline-block';
  
  // Perform comprehensive EDA
  performComprehensiveEDA();
  
  // Enable training
  $('trainBtn').disabled = false;
});

$('viewDatasetBtn').addEventListener('click', () => {
  $('datasetViewer').style.display = 'block';
  displayDataset('first10');
});

function performComprehensiveEDA() {
  log('Performing comprehensive exploratory data analysis...');
  
  // Quick overview
  const overview = `
    <div class="status-box success">
      <strong>✅ Dataset Loaded Successfully</strong><br>
      Records: ${rawData.length} | Features: ${Object.keys(rawData[0]).length}
    </div>
  `;
  $('quickOverview').innerHTML = overview;
  
  // Show EDA tabs
  $('edaTabs').style.display = 'flex';
  
  // Analyze data quality
  analyzeDataQuality();
  
  // Analyze numerical variables
  analyzeNumericalVariables();
  
  // Analyze categorical variables
  analyzeCategoricalVariables();
  
  // Analyze correlations
  analyzeCorrelations();
  
  // Analyze churn
  analyzeChurn();
  
  log('EDA completed successfully', 'success');
}

function analyzeDataQuality() {
  const content = $('dataQualityContent');
  const totalRecords = rawData.length;
  const columns = Object.keys(rawData[0]);
  
  // Count missing values
  const missingCounts = {};
  columns.forEach(col => {
    missingCounts[col] = rawData.filter(r => 
      r[col] === '' || r[col] === null || r[col] === undefined || r[col] === 'NA'
    ).length;
  });
  
  const totalMissing = Object.values(missingCounts).reduce((a, b) => a + b, 0);
  const missingPercent = ((totalMissing / (totalRecords * columns.length)) * 100).toFixed(2);
  
  // Check duplicates
  const uniqueRows = new Set(rawData.map(r => JSON.stringify(r))).size;
  const duplicates = totalRecords - uniqueRows;
  
  dataQualityInfo = {
    totalRecords,
    totalFeatures: columns.length,
    totalMissing,
    missingPercent,
    duplicates
  };
  
  let html = '<div class="data-quality-grid">';
  
  html += `
    <div class="quality-card">
      <h4>Total Records</h4>
      <div class="quality-value">${totalRecords.toLocaleString()}</div>
      <div class="quality-status good">Dataset Size: Good</div>
    </div>
    
    <div class="quality-card">
      <h4>Total Features</h4>
      <div class="quality-value">${columns.length}</div>
      <div class="quality-status good">Feature Count: Good</div>
    </div>
    
    <div class="quality-card">
      <h4>Missing Values</h4>
      <div class="quality-value">${totalMissing}</div>
      <div class="quality-status ${totalMissing === 0 ? 'good' : totalMissing < totalRecords * 0.05 ? 'warning' : 'bad'}">
        ${missingPercent}% of data
      </div>
    </div>
    
    <div class="quality-card">
      <h4>Duplicate Records</h4>
      <div class="quality-value">${duplicates}</div>
      <div class="quality-status ${duplicates === 0 ? 'good' : 'warning'}">
        ${duplicates === 0 ? 'No duplicates' : 'Duplicates found'}
      </div>
    </div>
  `;
  
  html += '</div>';
  
  // Missing values by column
  const columnsWithMissing = Object.entries(missingCounts).filter(([col, count]) => count > 0);
  if (columnsWithMissing.length > 0) {
    html += '<h4 style="margin-top: 20px; color: #667eea;">Missing Values by Column:</h4>';
    html += '<table class="data-table"><thead><tr><th>Column</th><th>Missing Count</th><th>Percentage</th></tr></thead><tbody>';
    columnsWithMissing.forEach(([col, count]) => {
      const pct = ((count / totalRecords) * 100).toFixed(2);
      html += `<tr><td>${col}</td><td>${count}</td><td>${pct}%</td></tr>`;
    });
    html += '</tbody></table>';
  }
  
  content.innerHTML = html;
}

function analyzeNumericalVariables() {
  const content = $('numericalContent');
  const selector = $('numericalVariableSelector');
  
  // Identify numerical columns
  const columns = Object.keys(rawData[0]);
  const numericalCols = columns.filter(col => {
    const sample = rawData.slice(0, 100).map(r => r[col]).filter(v => v !== '' && v !== null);
    return sample.every(v => !isNaN(parseFloat(v)));
  });
  
  let html = `<p><strong>Numerical Variables Found:</strong> ${numericalCols.length}</p>`;
  html += '<div class="eda-stats">';
  
  numericalCols.slice(0, 4).forEach(col => {
    const values = rawData.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
    
    html += `
      <div class="metric-card">
        <div style="font-weight: 600; color: #667eea;">${col}</div>
        <div class="metric-value">${mean.toFixed(2)}</div>
        <div class="metric-label">Mean (σ: ${std.toFixed(2)})</div>
      </div>
    `;
  });
  
  html += '</div>';
  content.innerHTML = html;
  
  // Build variable selector
  let selectorHTML = '';
  numericalCols.slice(4).forEach(col => {
    selectorHTML += `
      <div class="variable-option" onclick="toggleNumericalVar('${col}', this)">
        <div class="variable-checkbox"></div>
        <span>${col}</span>
      </div>
    `;
  });
  selector.innerHTML = selectorHTML;
}

window.toggleNumericalVar = function(varName, element) {
  element.classList.toggle('selected');
  if (selectedNumericalVars.includes(varName)) {
    selectedNumericalVars = selectedNumericalVars.filter(v => v !== varName);
  } else {
    selectedNumericalVars.push(varName);
  }
};

function analyzeCategoricalVariables() {
  const content = $('categoricalContent');
  const selector = $('categoricalVariableSelector');
  
  const columns = Object.keys(rawData[0]);
  const categoricalCols = columns.filter(col => {
    const uniqueValues = new Set(rawData.map(r => r[col])).size;
    return uniqueValues < 20;
  });
  
  let html = `<p><strong>Categorical Variables Found:</strong> ${categoricalCols.length}</p>`;
  html += '<div class="eda-stats">';
  
  categoricalCols.slice(0, 4).forEach(col => {
    const uniqueCount = new Set(rawData.map(r => r[col])).size;
    html += `
      <div class="metric-card">
        <div style="font-weight: 600; color: #667eea;">${col}</div>
        <div class="metric-value">${uniqueCount}</div>
        <div class="metric-label">Unique Values</div>
      </div>
    `;
  });
  
  html += '</div>';
  content.innerHTML = html;
  
  // Build variable selector
  let selectorHTML = '';
  categoricalCols.slice(4).forEach(col => {
    selectorHTML += `
      <div class="variable-option" onclick="toggleCategoricalVar('${col}', this)">
        <div class="variable-checkbox"></div>
        <span>${col}</span>
      </div>
    `;
  });
  selector.innerHTML = selectorHTML;
}

window.toggleCategoricalVar = function(varName, element) {
  element.classList.toggle('selected');
  if (selectedCategoricalVars.includes(varName)) {
    selectedCategoricalVars = selectedCategoricalVars.filter(v => v !== varName);
  } else {
    selectedCategoricalVars.push(varName);
  }
};

function analyzeCorrelations() {
  const content = $('correlationsContent');
  content.innerHTML = '<p style="text-align: center; padding: 20px; color: #6c757d;">Correlation analysis will be available after model training</p>';
}

function analyzeChurn() {
  const content = $('churnAnalysisContent');
  
  // Find churn column
  const churnCol = Object.keys(rawData[0]).find(col => 
    col.toLowerCase().includes('churn') || col.toLowerCase().includes('exited')
  );
  
  if (!churnCol) {
    content.innerHTML = '<p style="color: #dc3545;">⚠️ Churn/target column not found in dataset</p>';
    return;
  }
  
  const churnCounts = {};
  rawData.forEach(r => {
    const val = r[churnCol];
    churnCounts[val] = (churnCounts[val] || 0) + 1;
  });
  
  const total = rawData.length;
  let html = '<div class="eda-stats">';
  
  Object.entries(churnCounts).forEach(([label, count]) => {
    const pct = ((count / total) * 100).toFixed(1);
    html += `
      <div class="metric-card">
        <div style="font-weight: 600; color: #667eea;">${label === '1' || label === 'Yes' ? 'Churned' : 'Retained'}</div>
        <div class="metric-value">${count}</div>
        <div class="metric-label">${pct}% of customers</div>
      </div>
    `;
  });
  
  html += '</div>';
  content.innerHTML = html;
}

/* ========================================================================
   MLP MODEL TRAINING - MULTI-LAYER PERCEPTRON
   ======================================================================== */

$('trainBtn').addEventListener('click', async () => {
  log('Starting MLP model training...');
  $('trainBtn').disabled = true;
  
  try {
    // Prepare data
    prepareData();
    
    // Build MLP model
    model = buildMLPModel();
    
    // Train model
    await trainModel();
    
    // Evaluate model
    await evaluateModel();
    
    // Enable prediction buttons
    $('predictBtn').disabled = false;
    $('batchPredictBtn').disabled = false;
    $('batchPredictFromFileBtn').disabled = false;
    
    // Display feature importance
    displayFeatureImportance();
    
    // Post-training analysis
    performPostTrainingAnalysis();
    
    log('MLP Model training completed successfully!', 'success');
  } catch (error) {
    log(`Training error: ${error.message}`, 'error');
    $('trainBtn').disabled = false;
  }
});

function prepareData() {
  log('Preparing data for MLP training...');
  
  // Extract features and labels
  const features = [];
  const labels = [];
  
  // Identify feature columns
  const columns = Object.keys(rawData[0]);
  const targetCol = columns.find(col => 
    col.toLowerCase().includes('churn') || col.toLowerCase().includes('exited')
  );
  
  featureNames = columns.filter(col => col !== targetCol);
  
  rawData.forEach(row => {
    const featureVector = [];
    featureNames.forEach(col => {
      let val = row[col];
      // Convert to number
      if (val === '' || val === null || val === undefined) val = 0;
      featureVector.push(parseFloat(val) || 0);
    });
    features.push(featureVector);
    labels.push(parseInt(row[targetCol]) || 0);
  });
  
  // Split data
  const splitIdx = Math.floor(features.length * 0.8);
  const trainX = features.slice(0, splitIdx);
  const trainY = labels.slice(0, splitIdx);
  const testX = features.slice(splitIdx);
  const testY = labels.slice(splitIdx);
  
  // Normalize features
  const scaler = { mean: [], std: [] };
  for (let i = 0; i < trainX[0].length; i++) {
    const column = trainX.map(row => row[i]);
    const mean = column.reduce((a, b) => a + b, 0) / column.length;
    const std = Math.sqrt(column.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / column.length) || 1;
    scaler.mean.push(mean);
    scaler.std.push(std);
  }
  
  // Apply normalization
  const normalizeData = (data) => data.map(row => 
    row.map((val, i) => (val - scaler.mean[i]) / scaler.std[i])
  );
  
  processedData = {
    train: {
      x: tf.tensor2d(normalizeData(trainX)),
      y: tf.tensor2d(trainY.map(y => [y]))
    },
    test: {
      x: tf.tensor2d(normalizeData(testX)),
      y: tf.tensor2d(testY.map(y => [y]))
    },
    scaler
  };
  
  log(`Data prepared: ${trainX.length} training, ${testX.length} test samples`, 'success');
}

function buildMLPModel() {
  log('Building Deeper Multi-Layer Perceptron (MLP) model...');
  
  const inputDim = processedData.train.x.shape[1];
  
  // Deeper MLP Architecture Configuration for Better Accuracy
  mlpArchitecture = {
    modelType: 'Deep Multi-Layer Perceptron (MLP)',
    layers: [
      { name: 'Input Layer', neurons: inputDim, activation: 'None', description: 'Receives normalized feature inputs' },
      { name: 'Hidden Layer 1', neurons: 256, activation: 'ReLU', dropout: 0.4, description: 'First hidden layer with increased capacity' },
      { name: 'Hidden Layer 2', neurons: 128, activation: 'ReLU', dropout: 0.3, description: 'Second hidden layer for pattern learning' },
      { name: 'Hidden Layer 3', neurons: 64, activation: 'ReLU', dropout: 0.3, description: 'Third hidden layer for feature refinement' },
      { name: 'Hidden Layer 4', neurons: 32, activation: 'ReLU', dropout: 0.2, description: 'Fourth hidden layer for deep representations' },
      { name: 'Hidden Layer 5', neurons: 16, activation: 'ReLU', dropout: 0.2, description: 'Fifth hidden layer for final feature extraction' },
      { name: 'Output Layer', neurons: 1, activation: 'Sigmoid', description: 'Binary classification output (0-1)' }
    ],
    totalParameters: null,
    optimizer: {
      type: 'Adam',
      learningRate: 0.001,
      description: 'Adaptive Moment Estimation - efficient for deep networks'
    },
    lossFunction: 'Binary Crossentropy',
    regularization: ['Dropout (0.2-0.4)', 'L2 Weight Decay']
  };
  
  // Build deeper model
  const model = tf.sequential();
  
  // Input + Hidden Layer 1 (256 neurons)
  model.add(tf.layers.dense({
    inputShape: [inputDim],
    units: 256,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    name: 'hidden_layer_1'
  }));
  model.add(tf.layers.dropout({ rate: 0.4 }));
  
  // Hidden Layer 2 (128 neurons)
  model.add(tf.layers.dense({
    units: 128,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    name: 'hidden_layer_2'
  }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Hidden Layer 3 (64 neurons)
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    name: 'hidden_layer_3'
  }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Hidden Layer 4 (32 neurons)
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    name: 'hidden_layer_4'
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  // Hidden Layer 5 (16 neurons)
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    name: 'hidden_layer_5'
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  // Output Layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    name: 'output_layer'
  }));
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // Calculate total parameters
  mlpArchitecture.totalParameters = model.countParams();
  
  log(`Deep MLP model built: ${mlpArchitecture.totalParameters.toLocaleString()} parameters`, 'success');
  log(`Architecture: Input(${inputDim}) → 256 → 128 → 64 → 32 → 16 → Output(1)`, 'info');
  
  return model;
}

async function trainModel() {
  log('Training Deep MLP model with 50 epochs...');
  
  const history = await model.fit(processedData.train.x, processedData.train.y, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 5 === 0) {
          log(`Epoch ${epoch + 1}/50: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}, val_acc=${logs.val_acc.toFixed(4)}`);
        }
      }
    }
  });
  
  trainingHistory = history;
  log('Model training completed - 50 epochs', 'success');
}

async function evaluateModel() {
  log('Evaluating MLP model on test set...');
  
  const result = await model.evaluate(processedData.test.x, processedData.test.y);
  const testLoss = await result[0].data();
  const testAcc = await result[1].data();
  
  log(`Test Accuracy: ${(testAcc[0] * 100).toFixed(2)}%`, 'success');
  log(`Test Loss: ${testLoss[0].toFixed(4)}`, 'info');
  
  // Calculate confusion matrix
  const predictions = await model.predict(processedData.test.x).data();
  const labels = await processedData.test.y.data();
  
  confusionMatrix = { tp: 0, tn: 0, fp: 0, fn: 0 };
  
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i] > 0.5 ? 1 : 0;
    const actual = labels[i];
    
    if (pred === 1 && actual === 1) confusionMatrix.tp++;
    else if (pred === 0 && actual === 0) confusionMatrix.tn++;
    else if (pred === 1 && actual === 0) confusionMatrix.fp++;
    else if (pred === 0 && actual === 1) confusionMatrix.fn++;
  }
  
  // Display metrics
  displayMetrics();
}

function displayMetrics() {
  const { tp, tn, fp, fn } = confusionMatrix;
  const accuracy = ((tp + tn) / (tp + tn + fp + fn) * 100).toFixed(2);
  const precision = (tp / (tp + fp) * 100).toFixed(2);
  const recall = (tp / (tp + fn) * 100).toFixed(2);
  const f1 = (2 * (precision * recall) / (parseFloat(precision) + parseFloat(recall))).toFixed(2);
  
  const html = `
    <div class="eda-stats">
      <div class="metric-card">
        <div class="metric-value">${accuracy}%</div>
        <div class="metric-label">Accuracy</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${precision}%</div>
        <div class="metric-label">Precision</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${recall}%</div>
        <div class="metric-label">Recall</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${f1}%</div>
        <div class="metric-label">F1 Score</div>
      </div>
    </div>
    
    <h4 style="margin: 20px 0; color: #667eea;">Confusion Matrix</h4>
    <div class="confusion-matrix">
      <div class="confusion-cell corner"></div>
      <div class="confusion-cell header">Predicted: No Churn</div>
      <div class="confusion-cell header">Predicted: Churn</div>
      
      <div class="confusion-cell row-label">Actual: No Churn</div>
      <div class="confusion-cell tn">${tn}<br><small>True Negative</small></div>
      <div class="confusion-cell fp">${fp}<br><small>False Positive</small></div>
      
      <div class="confusion-cell row-label">Actual: Churn</div>
      <div class="confusion-cell fn">${fn}<br><small>False Negative</small></div>
      <div class="confusion-cell tp">${tp}<br><small>True Positive</small></div>
    </div>
  `;
  
  $('trainingMetrics').innerHTML = html;
  
  // Update chart
  const ctx = $('metricsChart').getContext('2d');
  if (charts.metrics) charts.metrics.destroy();
  
  charts.metrics = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Accuracy', 'Precision', 'Recall', 'F1 Score'],
      datasets: [{
        label: 'Model Performance (%)',
        data: [accuracy, precision, recall, f1],
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(72, 187, 120, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(118, 75, 162, 0.8)'
        ],
        borderColor: [
          'rgba(102, 126, 234, 1)',
          'rgba(72, 187, 120, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(118, 75, 162, 1)'
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
            callback: function(value) {
              return value + '%';
            }
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'MLP Model Performance Metrics',
          font: { size: 16 }
        },
        legend: {
          display: false
        }
      }
    }
  });
}

function displayFeatureImportance() {
  const container = $('featureImportance');
  
  // Calculate approximate feature importance using first layer weights
  const weights = model.layers[0].getWeights()[0];
  const weightData = weights.dataSync();
  const inputDim = weights.shape[0];
  const outputDim = weights.shape[1];
  
  const importance = [];
  for (let i = 0; i < inputDim; i++) {
    let sum = 0;
    for (let j = 0; j < outputDim; j++) {
      sum += Math.abs(weightData[i * outputDim + j]);
    }
    importance.push({ feature: featureNames[i], value: sum });
  }
  
  // Sort by importance
  importance.sort((a, b) => b.value - a.value);
  
  // Normalize to 0-100 scale
  const maxImportance = importance[0].value;
  importance.forEach(item => {
    item.normalized = (item.value / maxImportance) * 100;
  });
  
  // Display top 10 features
  let html = '<h3>🎯 Top 10 Most Important Features</h3>';
  
  importance.slice(0, 10).forEach(item => {
    html += `
      <div class="feature-bar">
        <div class="feature-bar-label">${item.feature}</div>
        <div class="feature-bar-fill" style="width: ${item.normalized}%;">
          <div class="feature-bar-value">${item.normalized.toFixed(1)}%</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  log('Feature importance calculated', 'success');
}

function performPostTrainingAnalysis() {
  const container = $('postTrainingAnalysis');
  
  const { tp, tn, fp, fn } = confusionMatrix;
  const accuracy = ((tp + tn) / (tp + tn + fp + fn) * 100).toFixed(2);
  const precision = (tp / (tp + fp) * 100).toFixed(2);
  const recall = (tp / (tp + fn) * 100).toFixed(2);
  
  let html = `
    <div class="analysis-grid">
      <!-- MLP Architecture Details -->
      <div class="analysis-card">
        <h4>🧠 Deep MLP Architecture Details</h4>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
          <strong style="color: #667eea;">Model Type:</strong> ${mlpArchitecture.modelType}<br><br>
          <strong style="color: #667eea;">Total Parameters:</strong> ${mlpArchitecture.totalParameters.toLocaleString()}<br><br>
          <strong style="color: #667eea;">Optimizer:</strong> ${mlpArchitecture.optimizer.type} (LR: ${mlpArchitecture.optimizer.learningRate})<br>
          <em style="font-size: 0.85em; color: #6c757d;">${mlpArchitecture.optimizer.description}</em><br><br>
          <strong style="color: #667eea;">Loss Function:</strong> ${mlpArchitecture.lossFunction}<br><br>
          <strong style="color: #667eea;">Regularization:</strong> ${mlpArchitecture.regularization.join(', ')}
        </div>
        
        <h5 style="color: #667eea; margin-top: 20px;">Layer-by-Layer Architecture:</h5>
  `;
  
  mlpArchitecture.layers.forEach((layer, idx) => {
    html += `
      <div class="insight-item">
        <strong>Layer ${idx + 1}: ${layer.name}</strong><br>
        <span style="font-size: 0.9em;">
          Neurons: ${layer.neurons} | Activation: ${layer.activation}
          ${layer.dropout ? ` | Dropout: ${layer.dropout}` : ''}
        </span><br>
        <em style="font-size: 0.85em; color: #6c757d;">${layer.description}</em>
      </div>
    `;
  });
  
  html += `
      </div>
      
      <!-- Model Performance Insights -->
      <div class="analysis-card">
        <h4>📊 Model Performance Insights</h4>
        <div class="insight-item">
          <strong>Overall Accuracy: ${accuracy}%</strong><br>
          ${parseFloat(accuracy) >= 90 ? 
            'Excellent performance! Model exceeds 90% accuracy target.' :
            parseFloat(accuracy) >= 85 ?
            'Good performance. Consider hyperparameter tuning for improvement.' :
            'Moderate performance. Review feature engineering and data quality.'}
        </div>
        
        <div class="insight-item">
          <strong>Precision: ${precision}%</strong><br>
          Of customers predicted to churn, ${precision}% actually churned. 
          ${parseFloat(precision) >= 85 ? 'High precision - low false alarm rate.' : 'Consider threshold adjustment to reduce false positives.'}
        </div>
        
        <div class="insight-item">
          <strong>Recall: ${recall}%</strong><br>
          Model correctly identifies ${recall}% of all churning customers.
          ${parseFloat(recall) >= 85 ? 'High recall - catching most at-risk customers.' : 'Some churning customers being missed. Review feature selection.'}
        </div>
        
        <div class="insight-item">
          <strong>Training Configuration:</strong><br>
          Trained for 50 epochs with batch size 32. Deep architecture with 5 hidden layers enables learning complex customer behavior patterns.
        </div>
      </div>
      
      <!-- Business Impact Analysis -->
      <div class="analysis-card">
        <h4>💰 Business Impact Analysis</h4>
        <div class="insight-item">
          <strong>True Positives (${tp}):</strong><br>
          Successfully identified at-risk customers. Opportunity for targeted retention campaigns.
        </div>
        
        <div class="insight-item">
          <strong>False Negatives (${fn}):</strong><br>
          Missed churning customers. These represent revenue at risk. Focus on improving recall.
        </div>
        
        <div class="insight-item">
          <strong>False Positives (${fp}):</strong><br>
          Stable customers flagged as at-risk. May receive unnecessary retention offers.
        </div>
        
        <div class="insight-item">
          <strong>Campaign Efficiency:</strong><br>
          With ${tp} correct predictions and ${fp} false alarms, retention campaign efficiency is ${((tp/(tp+fp))*100).toFixed(1)}%.
        </div>
      </div>
      
      <!-- Technical Recommendations -->
      <div class="analysis-card">
        <h4>🎯 Technical Recommendations</h4>
        <div class="insight-item">
          <strong>Model Monitoring:</strong><br>
          Track model performance monthly. Retrain when accuracy drops below 85% or data distribution shifts.
        </div>
        
        <div class="insight-item">
          <strong>Feature Engineering:</strong><br>
          Review top 10 important features. Consider collecting additional behavioral data on these dimensions.
        </div>
        
        <div class="insight-item">
          <strong>Threshold Optimization:</strong><br>
          Current threshold: 0.5. Adjust based on business cost of false positives vs false negatives.
        </div>
        
        <div class="insight-item">
          <strong>Deep Architecture Benefits:</strong><br>
          5-layer MLP enables capturing non-linear interactions between customer features for better predictions.
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  log('Post-training analysis completed', 'success');
}

/* ========================================================================
   VISUALIZE TRAINING
   ======================================================================== */

$('visualizeBtn').addEventListener('click', async () => {
  if (!trainingHistory || !mlpArchitecture) {
    log('Please train the model first', 'warning');
    return;
  }
  
  // Create visualization container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '50%';
  container.style.left = '50%';
  container.style.transform = 'translate(-50%, -50%)';
  container.style.background = 'white';
  container.style.padding = '30px';
  container.style.borderRadius = '15px';
  container.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
  container.style.zIndex = '10000';
  container.style.maxWidth = '90%';
  container.style.maxHeight = '90vh';
  container.style.overflow = 'auto';
  container.style.width = '800px';
  
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e9ecef;">
      <h2 style="color: #667eea; margin: 0;">🧠 MLP Training Visualization & Architecture</h2>
      <span style="font-size: 2em; cursor: pointer; color: #6c757d;" onclick="this.parentElement.parentElement.remove()">×</span>
    </div>
    
    <!-- Architecture Overview -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0;">📐 Model Architecture Overview</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <strong>Model Type:</strong> ${mlpArchitecture.modelType}<br>
          <strong>Total Parameters:</strong> ${mlpArchitecture.totalParameters.toLocaleString()}<br>
          <strong>Optimizer:</strong> ${mlpArchitecture.optimizer.type}
        </div>
        <div>
          <strong>Learning Rate:</strong> ${mlpArchitecture.optimizer.learningRate}<br>
          <strong>Loss Function:</strong> ${mlpArchitecture.lossFunction}<br>
          <strong>Regularization:</strong> Dropout
        </div>
      </div>
    </div>
    
    <!-- Detailed Layer Architecture -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
      <h3 style="color: #667eea; margin-bottom: 15px;">🏗️ Detailed Layer Architecture</h3>
  `;
  
  mlpArchitecture.layers.forEach((layer, idx) => {
    const color = idx === 0 ? '#48bb78' : 
                  idx === mlpArchitecture.layers.length - 1 ? '#fc8181' : 
                  '#667eea';
    
    html += `
      <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 5px solid ${color};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: ${color}; font-size: 1.1em;">Layer ${idx + 1}: ${layer.name}</strong><br>
            <span style="color: #6c757d; font-size: 0.9em;">${layer.description}</span>
          </div>
          <div style="text-align: right;">
            <div style="background: ${color}; color: white; padding: 5px 12px; border-radius: 5px; font-weight: bold; margin-bottom: 5px;">
              ${layer.neurons} neurons
            </div>
            ${layer.activation !== 'None' ? `<div style="font-size: 0.85em; color: #6c757d;">Activation: ${layer.activation}</div>` : ''}
            ${layer.dropout ? `<div style="font-size: 0.85em; color: #e53e3e;">Dropout: ${layer.dropout}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += `
    </div>
    
    <!-- Architecture Flow Diagram -->
    <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #e9ecef; margin-bottom: 20px;">
      <h3 style="color: #667eea; margin-bottom: 15px;">🔄 Network Flow Diagram</h3>
      <div style="display: flex; align-items: center; justify-content: space-around; flex-wrap: wrap; gap: 10px;">
  `;
  
  mlpArchitecture.layers.forEach((layer, idx) => {
    html += `
      <div style="text-align: center;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; min-width: 80px;">
          <div style="font-weight: bold; font-size: 1.5em;">${layer.neurons}</div>
          <div style="font-size: 0.75em; margin-top: 5px;">${layer.name.replace(' Layer', '')}</div>
        </div>
        ${layer.activation !== 'None' ? `<div style="font-size: 0.7em; color: #667eea; margin-top: 5px;">${layer.activation}</div>` : ''}
      </div>
      ${idx < mlpArchitecture.layers.length - 1 ? '<div style="font-size: 2em; color: #667eea;">→</div>' : ''}
    `;
  });
  
  html += `
      </div>
    </div>
    
    <!-- Training History -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
      <h3 style="color: #667eea; margin-bottom: 15px;">📈 Training History</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 2em; font-weight: bold; color: #667eea;">
            ${trainingHistory.params.epochs}
          </div>
          <div style="color: #6c757d; margin-top: 5px;">Total Epochs</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 2em; font-weight: bold; color: #48bb78;">
            ${trainingHistory.params.batchSize}
          </div>
          <div style="color: #6c757d; margin-top: 5px;">Batch Size</div>
        </div>
      </div>
      
      <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <strong style="color: #667eea;">Training Configuration:</strong><br>
        <ul style="margin: 10px 0; padding-left: 20px; color: #2d3748;">
          <li>Validation Split: 20% of training data</li>
          <li>Optimizer: Adam with learning rate ${mlpArchitecture.optimizer.learningRate}</li>
          <li>Loss Function: Binary Crossentropy (for binary classification)</li>
          <li>Metrics: Accuracy tracked during training</li>
          <li>Regularization: Dropout layers (0.2-0.3) to prevent overfitting</li>
        </ul>
      </div>
      
      <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #3182ce;">
        <strong style="color: #3182ce;">💡 MLP Advantages for Churn Prediction:</strong><br>
        <ul style="margin: 10px 0; padding-left: 20px; color: #2d3748;">
          <li><strong>Universal Approximation:</strong> MLP can learn complex non-linear patterns in customer behavior</li>
          <li><strong>Feature Interactions:</strong> Hidden layers automatically discover feature combinations</li>
          <li><strong>Scalability:</strong> Efficiently handles large datasets with many features</li>
          <li><strong>Flexibility:</strong> Architecture can be adjusted based on data complexity</li>
        </ul>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  document.body.appendChild(container);
  
  // Add backdrop
  const backdrop = document.createElement('div');
  backdrop.style.position = 'fixed';
  backdrop.style.top = '0';
  backdrop.style.left = '0';
  backdrop.style.width = '100%';
  backdrop.style.height = '100%';
  backdrop.style.background = 'rgba(0,0,0,0.5)';
  backdrop.style.zIndex = '9999';
  backdrop.onclick = () => {
    backdrop.remove();
    container.remove();
  };
  document.body.appendChild(backdrop);
  
  log('Training visualization displayed', 'success');
});

/* ========================================================================
   PREDICTION
   ======================================================================== */

$('predictBtn').addEventListener('click', async () => {
  const tenure = parseFloat($('tenure').value);
  const monthlyCharges = parseFloat($('monthlyCharges').value);
  const totalCharges = parseFloat($('totalCharges').value);
  const contract = parseFloat($('contract').value);
  
  // Create feature vector (simplified - adjust based on your actual features)
  const features = [tenure, monthlyCharges, totalCharges, contract];
  
  // Pad or truncate to match model input
  while (features.length < featureNames.length) features.push(0);
  features.length = featureNames.length;
  
  // Normalize
  const normalized = features.map((val, i) => 
    (val - processedData.scaler.mean[i]) / processedData.scaler.std[i]
  );
  
  // Predict
  const input = tf.tensor2d([normalized]);
  const prediction = await model.predict(input).data();
  const churnProb = (prediction[0] * 100).toFixed(2);
  
  const riskLevel = prediction[0] > 0.7 ? 'high' : prediction[0] > 0.4 ? 'medium' : 'low';
  const riskClass = `risk-${riskLevel}`;
  const riskLabel = riskLevel.toUpperCase() + ' RISK';
  
  const html = `
    <div class="prediction-result ${riskClass}">
      <h3>Churn Prediction Result</h3>
      <div class="metric-value" style="font-size: 3em; margin: 20px 0;">${churnProb}%</div>
      <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 20px;">${riskLabel}</div>
      
      <div class="retention-strategy">
        <h4>💡 Recommended Retention Strategy</h4>
        ${prediction[0] > 0.7 ? 
          '<p><strong>Immediate Action Required:</strong> Offer loyalty discount, dedicated account manager, or contract upgrade incentive.</p>' :
          prediction[0] > 0.4 ?
          '<p><strong>Proactive Engagement:</strong> Send satisfaction survey, offer service optimization consultation.</p>' :
          '<p><strong>Maintain Relationship:</strong> Regular check-ins, appreciation rewards, referral incentives.</p>'}
      </div>
    </div>
  `;
  
  $('predictionResults').innerHTML = html;
  log(`Prediction completed: ${churnProb}% churn probability`, 'success');
});

/* ========================================================================
   BATCH PREDICTION
   ======================================================================== */

$('batchPredictBtn').addEventListener('click', async () => {
  log('Performing batch prediction on test set...');
  
  const predictions = await model.predict(processedData.test.x).data();
  const results = Array.from(predictions).map((prob, idx) => ({
    index: idx,
    probability: (prob * 100).toFixed(2),
    risk: prob > 0.7 ? 'HIGH' : prob > 0.4 ? 'MEDIUM' : 'LOW'
  }));
  
  // Sort by probability descending
  results.sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability));
  
  // Display top 10
  let html = '<h3 style="color: #667eea;">🎯 Top 10 At-Risk Customers</h3>';
  html += '<table class="data-table"><thead><tr><th>Rank</th><th>Customer ID</th><th>Churn Probability</th><th>Risk Level</th></tr></thead><tbody>';
  
  results.slice(0, 10).forEach((result, idx) => {
    const riskColor = result.risk === 'HIGH' ? '#dc3545' : result.risk === 'MEDIUM' ? '#ffc107' : '#28a745';
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>Customer #${result.index}</td>
        <td><strong>${result.probability}%</strong></td>
        <td style="color: ${riskColor}; font-weight: bold;">${result.risk}</td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  
  batchPredictionResults = results;
  $('predictionResults').innerHTML = html;
  log('Batch prediction completed', 'success');
});

$('batchPredictFromFileBtn').addEventListener('click', async () => {
  const file = $('batchPredictionFile').files[0];
  if (!file) {
    log('Please select a CSV file for batch prediction', 'error');
    return;
  }
  
  log('Processing batch prediction file...');
  const text = await file.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const batchData = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });
  
  // Make predictions
  const predictions = [];
  for (const row of batchData) {
    const features = featureNames.map(name => parseFloat(row[name]) || 0);
    const normalized = features.map((val, i) => 
      (val - processedData.scaler.mean[i]) / processedData.scaler.std[i]
    );
    
    const input = tf.tensor2d([normalized]);
    const pred = await model.predict(input).data();
    predictions.push({
      data: row,
      probability: (pred[0] * 100).toFixed(2),
      risk: pred[0] > 0.7 ? 'HIGH' : pred[0] > 0.4 ? 'MEDIUM' : 'LOW'
    });
  }
  
  // Display results
  predictions.sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability));
  
  let html = `<h3 style="color: #667eea;">📊 Batch Prediction Results (${predictions.length} customers)</h3>`;
  html += '<table class="data-table"><thead><tr><th>Rank</th><th>Churn Probability</th><th>Risk Level</th><th>Details</th></tr></thead><tbody>';
  
  predictions.slice(0, 20).forEach((result, idx) => {
    const riskColor = result.risk === 'HIGH' ? '#dc3545' : result.risk === 'MEDIUM' ? '#ffc107' : '#28a745';
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${result.probability}%</strong></td>
        <td style="color: ${riskColor}; font-weight: bold;">${result.risk}</td>
        <td style="font-size: 0.85em;">${JSON.stringify(result.data).substring(0, 100)}...</td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  $('predictionResults').innerHTML = html;
  log(`Batch prediction completed for ${predictions.length} customers`, 'success');
});

// Initialize
log('Smart Customer Churn Prediction System initialized', 'success');
log('Upload a CSV file to begin analysis', 'info');
