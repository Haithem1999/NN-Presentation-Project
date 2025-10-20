/* =========================================================================
   Smart Customer Churn Prediction System - Enhanced Application
   Business Value: Reduce churn by 15-20% through predictive intervention
   Target Accuracy: ≥90% with Advanced Deep Learning
   
   ✅ POINT 1 COMPLETED: Enhanced Dataset Viewer
   ✅ POINT 2 COMPLETED: Enhanced EDA with Variable Selection
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
  document.querySelectorAll('.
