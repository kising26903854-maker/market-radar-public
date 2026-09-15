// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🤖 ai_prediction_model.js
// 지도학습(로지스틱 회귀) 기반 2주 상승확률 예측 모델
// - 기술적 피처(모멘텀/거래량/RSI/이평선 괴리/변동성 등) → "2주 후 +3% 이상 상승" 이진분류
// - 경사하강법으로 실제 과거 데이터에서 가중치를 학습한다 (순수 JS, 외부 ML 라이브러리 불필요)
// - 시간순으로 훈련/검증 구간을 분리(walk-forward)해서 미래 데이터 누수를 막고,
//   검증 구간에서의 실제 정확도·정밀도를 함께 저장해 화면에 정직하게 노출한다
//   (모델이 잘 맞는 척 숫자만 그럴듯하게 보여주는 것을 방지)
// - 매주 월요일 09:20 자동 재학습 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketCapUniverse } from './kospi_kosdaq_scanner.js';
import { fetchDailySeries } from './double_bottom_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, 'data', 'ai_prediction_model.json');

const KOSPI_PAGES = 3; // 시총 상위 약 300종목
const KOSDAQ_PAGES = 2; // 시총 상위 약 200종목
const MIN_MARKET_CAP = 1000; // 억원

const HISTORY_PAGES = 8; // 약 480거래일(~2년)
const SAMPLE_STEP = 3; // 훈련 샘플 추출 간격(거래일)
const SAMPLE_START_IDX = 65; // 피처 계산에 최소 60일(RSI/MA60) 필요 + 여유
const LABEL_HORIZON_DAYS = 10; // 라벨 기준: 이 시점 이후 며칠 뒤 수익률로 상승/하락 판정 (약 2주)
const LABEL_THRESHOLD_PCT = 3; // 이 이상 상승해야 "상승(1)" 라벨 (단순 +0%가 아니라 유의미한 상승만 정답으로 취급)
const TEST_SPLIT_DATE_RATIO = 0.8; // 전체 샘플의 시간순 80% 지점 이전 = 훈련, 이후 = 검증(미래 데이터로 평가)

const FEATURE_NAMES = ['ret5', 'ret10', 'ret20', 'volRatio', 'rsi14', 'gapMA20', 'gapMA60', 'distFromHigh20', 'volatility20'];

// ─── 1. 피처 엔지니어링: series[0..t] 시점까지의 데이터만으로 t 시점의 피처 벡터 계산 ───
function computeFeatures(series, t) {
  if (t < 60) return null;
  const closes = series.map(d => d.close);

  const ret = (n) => ((closes[t] - closes[t - n]) / closes[t - n]) * 100;

  const recentVols = series.slice(t - 20, t).map(d => d.volume);
  const avgVol20 = recentVols.reduce((a, b) => a + b, 0) / (recentVols.length || 1);
  const volRatio = avgVol20 > 0 ? series[t].volume / avgVol20 : 1;

  // RSI(14) — 표준 계산식
  let gains = 0, losses = 0;
  for (let i = t - 13; i <= t; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / 14, avgLoss = losses / 14;
  const rsi14 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  const ma20 = closes.slice(t - 19, t + 1).reduce((a, b) => a + b, 0) / 20;
  const ma60 = closes.slice(t - 59, t + 1).reduce((a, b) => a + b, 0) / 60;
  const gapMA20 = ((closes[t] - ma20) / ma20) * 100;
  const gapMA60 = ((closes[t] - ma60) / ma60) * 100;

  const high20 = Math.max(...series.slice(t - 19, t + 1).map(d => d.high));
  const distFromHigh20 = ((closes[t] - high20) / high20) * 100;

  const rets20 = [];
  for (let i = t - 19; i <= t; i++) rets20.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const meanR = rets20.reduce((a, b) => a + b, 0) / rets20.length;
  const variance = rets20.reduce((a, b) => a + (b - meanR) ** 2, 0) / rets20.length;
  const volatility20 = Math.sqrt(variance) * 100;

  return { ret5: ret(5), ret10: ret(10), ret20: ret(20), volRatio, rsi14, gapMA20, gapMA60, distFromHigh20, volatility20 };
}

function featureVector(f) {
  return FEATURE_NAMES.map(name => f[name]);
}

// ─── 2. 표준화(z-score) — 훈련 세트의 평균/표준편차만 사용(검증 세트 통계 누수 방지) ───
function computeNormalization(X) {
  const d = X[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(1);
  for (let j = 0; j < d; j++) {
    const col = X.map(row => row[j]);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    const variance = col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length;
    means[j] = mean;
    stds[j] = Math.sqrt(variance) || 1;
  }
  return { means, stds };
}

function normalize(X, { means, stds }) {
  return X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
}

// ─── 3. 로지스틱 회귀 — 배치 경사하강법 + L2 정규화 (순수 JS 구현, 실제로 데이터에서 학습함) ───
function sigmoid(z) {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

function trainLogisticRegression(X, y, { epochs = 400, lr = 0.15, l2 = 0.002 } = {}) {
  const n = X.length;
  const d = X[0].length;
  let w = new Array(d).fill(0);
  let b = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const z = X[i].reduce((sum, xj, j) => sum + xj * w[j], b);
      const p = sigmoid(z);
      const err = p - y[i];
      for (let j = 0; j < d; j++) gradW[j] += err * X[i][j];
      gradB += err;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gradW[j] / n + l2 * w[j]);
    b -= lr * (gradB / n);
  }
  return { w, b };
}

function predictProba(model, xNorm) {
  const z = xNorm.reduce((sum, xj, j) => sum + xj * model.w[j], model.b);
  return sigmoid(z);
}

// ─── 4. 검증 세트 평가: 정확도·정밀도·재현율 + "그냥 다 찍었을 때" 베이스라인과 비교 ───
function evaluate(model, norm, Xtest, ytest, threshold = 0.5) {
  const Xn = normalize(Xtest, norm);
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < Xn.length; i++) {
    const p = predictProba(model, Xn[i]);
    const pred = p >= threshold ? 1 : 0;
    if (pred === 1 && ytest[i] === 1) tp++;
    else if (pred === 1 && ytest[i] === 0) fp++;
    else if (pred === 0 && ytest[i] === 0) tn++;
    else fn++;
  }
  const total = tp + fp + tn + fn;
  const positiveBaseRate = (tp + fn) / (total || 1); // 실제 상승 비율(=무작위로 찍었을 때 기대 적중률)
  return {
    sampleCount: total,
    accuracy: total ? parseFloat((((tp + tn) / total) * 100).toFixed(1)) : null,
    precision: (tp + fp) ? parseFloat(((tp / (tp + fp)) * 100).toFixed(1)) : null, // "상승"이라 예측한 것 중 실제 적중률
    recall: (tp + fn) ? parseFloat(((tp / (tp + fn)) * 100).toFixed(1)) : null,
    baselinePositiveRatePct: parseFloat((positiveBaseRate * 100).toFixed(1)), // 비교 기준선
    predictedPositiveCount: tp + fp,
  };
}

// ─── 5. 전체 데이터셋 구축 + 학습 + 검증 실행 ───
let trainInFlight = null;

export function runModelTraining() {
  if (trainInFlight) {
    console.log('[AI MODEL] 이미 학습이 진행 중이라 요청을 건너뜁니다.');
    return trainInFlight;
  }
  trainInFlight = executeModelTraining().finally(() => { trainInFlight = null; });
  return trainInFlight;
}

async function executeModelTraining() {
  console.log('\n[AI MODEL] 로지스틱 회귀 상승확률 모델 학습 시작...');
  const startTime = Date.now();

  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchMarketCapUniverse(0, KOSPI_PAGES),
    fetchMarketCapUniverse(1, KOSDAQ_PAGES),
  ]);
  const universe = [...kospiStocks, ...kosdaqStocks].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[AI MODEL] 학습 유니버스: ${universe.length}종목`);

  // 종목별 피처/라벨 샘플 수집 (날짜와 함께 보관 — 이후 시간순으로 훈련/검증 분리)
  const samples = []; // { date, code, name, features, label }
  const liveInputs = []; // 오늘 시점 예측용 최신 피처 (라벨 없음)

  let processed = 0;
  const batchSize = 12;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    await Promise.all(batch.map(async (stock) => {
      const series = await fetchDailySeries(stock.code, HISTORY_PAGES);
      if (series.length < SAMPLE_START_IDX + 5) return;

      for (let t = SAMPLE_START_IDX; t < series.length; t += SAMPLE_STEP) {
        const f = computeFeatures(series, t);
        if (!f || Object.values(f).some(v => !Number.isFinite(v))) continue;

        const labelIdx = t + LABEL_HORIZON_DAYS;
        if (labelIdx < series.length) {
          const futureRet = ((series[labelIdx].close - series[t].close) / series[t].close) * 100;
          samples.push({ date: series[t].date, code: stock.code, features: f, label: futureRet >= LABEL_THRESHOLD_PCT ? 1 : 0 });
        }
      }

      // 오늘(가장 최근) 시점 피처 — 실시간 예측용
      const lastIdx = series.length - 1;
      const liveFeat = computeFeatures(series, lastIdx);
      if (liveFeat && Object.values(liveFeat).every(v => Number.isFinite(v))) {
        liveInputs.push({
          code: stock.code, name: stock.name, market: stock.market,
          price: stock.price, changePct: stock.changePct, marketCap: stock.marketCap,
          features: liveFeat, currentDate: series[lastIdx].date,
        });
      }
    }));

    processed += batch.length;
    if (i + batchSize < universe.length) await new Promise(r => setTimeout(r, 150));
    process.stdout.write(`\r[AI MODEL] 데이터 수집: ${processed}/${universe.length}종목 (샘플 ${samples.length}건)`);
  }
  console.log('');

  if (samples.length < 200) {
    throw new Error(`학습 샘플이 너무 적습니다 (${samples.length}건) — 모델 학습을 건너뜁니다.`);
  }

  // ⚠️ 시간순 분리(walk-forward): 날짜 기준으로 정렬 후 앞 80%는 훈련, 뒤 20%는 "미래" 취급해 검증.
  // 종목/날짜를 무작위로 섞어서 나누면 훈련 세트에 검증 시점 이후의 정보가 섞여 들어가는
  // 미래참조(look-ahead) 오류가 생기므로, 반드시 시간순으로만 분리한다.
  samples.sort((a, b) => a.date.localeCompare(b.date));
  const splitIdx = Math.floor(samples.length * TEST_SPLIT_DATE_RATIO);
  const splitDate = samples[splitIdx].date;
  const trainSamples = samples.slice(0, splitIdx);
  const testSamples = samples.slice(splitIdx);

  const Xtrain = trainSamples.map(s => featureVector(s.features));
  const ytrain = trainSamples.map(s => s.label);
  const Xtest = testSamples.map(s => featureVector(s.features));
  const ytest = testSamples.map(s => s.label);

  const norm = computeNormalization(Xtrain);
  const XtrainNorm = normalize(Xtrain, norm);
  const model = trainLogisticRegression(XtrainNorm, ytrain);

  const trainEval = evaluate(model, norm, Xtrain, ytrain);
  const testEval = evaluate(model, norm, Xtest, ytest);

  // 오늘 시점 유니버스 전체에 대해 상승확률 스코어링
  const scored = liveInputs.map(item => {
    const x = normalize([featureVector(item.features)], norm)[0];
    const proba = predictProba(model, x);
    return {
      code: item.code, name: item.name, market: item.market,
      price: item.price, changePct: item.changePct, marketCap: item.marketCap,
      currentDate: item.currentDate,
      upProbabilityPct: parseFloat((proba * 100).toFixed(1)),
    };
  }).sort((a, b) => b.upProbabilityPct - a.upProbabilityPct);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const result = {
    lastSyncAt: new Date().toISOString(),
    elapsedSec: parseFloat(elapsed),
    universeSize: universe.length,
    modelInfo: {
      type: '로지스틱 회귀 (경사하강법, L2 정규화)',
      features: FEATURE_NAMES,
      labelDefinition: `${LABEL_HORIZON_DAYS}거래일(약 2주) 후 종가가 +${LABEL_THRESHOLD_PCT}% 이상이면 상승(1), 아니면 0`,
      trainSampleCount: trainSamples.length,
      testSampleCount: testSamples.length,
      splitDate,
    },
    evaluation: {
      train: trainEval,
      test: testEval, // ⚠️ 실전 신뢰도는 이 수치(검증/미래 구간)를 봐야 함 — train 수치는 과최적화로 항상 더 좋게 나옴
    },
    weights: FEATURE_NAMES.map((name, i) => ({ feature: name, weight: parseFloat(model.w[i].toFixed(4)) })),
    stocks: scored.slice(0, 150),
  };

  const dir = path.dirname(MODEL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify(result, null, 2), 'utf8');

  console.log(`[AI MODEL] ✅ 학습 완료! ${elapsed}초 소요. 훈련 ${trainSamples.length}건 / 검증 ${testSamples.length}건`);
  console.log(`[AI MODEL] 검증 세트 정확도 ${testEval.accuracy}% / 정밀도 ${testEval.precision}% (기준선 ${testEval.baselinePositiveRatePct}%)`);

  return result;
}

// ─── 6. 캐시 읽기 ───
export function getModelCache() {
  try {
    if (!fs.existsSync(MODEL_PATH)) return null;
    return JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  } catch { return null; }
}

// ─── 7. 캐시 만료 확인 (7일 — 연산 비용이 크므로 주간 재학습) ───
export function isModelStale() {
  try {
    if (!fs.existsSync(MODEL_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
    const hoursSince = (Date.now() - new Date(cache.lastSyncAt).getTime()) / 3600000;
    return hoursSince > 24 * 7;
  } catch { return true; }
}

// ─── 8. 매주 월요일 09:20 자동 재학습 스케줄러 ───
export function startWeeklyModelTraining() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(9, 20, 0, 0);
    let daysUntilMonday = (1 - target.getDay() + 7) % 7;
    if (daysUntilMonday === 0 && target <= now) daysUntilMonday = 7;
    target.setDate(target.getDate() + daysUntilMonday);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[AI MODEL] 다음 자동 재학습: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      await runModelTraining();
      scheduleNext();
    }, msUntil);
  };

  if (isModelStale()) {
    console.log('[AI MODEL] 캐시 없음 또는 7일 이상 경과 → 즉시 학습 시작 (백그라운드)');
    runModelTraining().then(() => scheduleNext()).catch(e => {
      console.error('[AI MODEL] 초기 학습 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[AI MODEL] 캐시 유효. 다음 예약 시간에 재학습합니다.');
    scheduleNext();
  }
}
