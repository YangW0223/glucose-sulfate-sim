import { useMemo } from 'react';
import {
  INITIAL_GLUCOSE_BOTTLE_MASS_G,
  INITIAL_STANDARD_FLASK_VOLUME_ML,
  useSimulationStore,
} from '../store/useSimulationStore';

function getStage(input: {
  paperOnBalance: boolean;
  balanceReading: number;
  tareG: number;
  paperGlucoseG: number;
  tubeGlucoseG: number;
  cylinderMl: number;
  tubeMl: number;
  bulbAttached: boolean;
  pipetteMl: number;
  controlStandardMl: number;
  controlTubeMl: number;
}) {
  const {
    paperOnBalance,
    balanceReading,
    tareG,
    paperGlucoseG,
    tubeGlucoseG,
    cylinderMl,
    tubeMl,
    bulbAttached,
    pipetteMl,
    controlStandardMl,
    controlTubeMl,
  } = input;

  if (tubeGlucoseG > 2.05) {
    return { name: '供试管称样过量', hint: '供试管中的葡萄糖已经超过 2.05 g。该误差会被保留，不会自动回退。' };
  }

  if (tubeGlucoseG < 1.95) {
    if (paperGlucoseG > 2.05) {
      return { name: '称样量偏多', hint: '称量纸中的葡萄糖已超过 2.05 g。仿真不会自动修正，重置实验或继续保留该误差。' };
    }
    if (paperGlucoseG >= 1.95 && paperGlucoseG <= 2.05) {
      return { name: '称量完成', hint: '拿起称量纸，用滚轮倾斜，将葡萄糖粉末真实转移到供试管。' };
    }
    if (paperOnBalance && Math.abs(tareG) < 0.1 && balanceReading > 0.5) {
      return { name: '先去皮', hint: '称量纸已放在天平上。点击天平右前方蓝色按钮去皮，再添加葡萄糖。' };
    }
    if (paperOnBalance) {
      return { name: '称取葡萄糖 2.0 g', hint: '拿药勺伸入葡萄糖瓶并按住 Space 取粉，再移到称量纸上方，用滚轮逐渐倾倒。' };
    }
    return { name: '放置称量纸', hint: '先将称量纸拖到电子天平称量盘上，再点击蓝色去皮按钮。' };
  }

  if (tubeMl < 39) {
    if (cylinderMl >= 39 && cylinderMl <= 41) {
      return { name: '量筒已量取约 40 ml', hint: '拿起量筒，用滚轮倾斜，将水倒入含葡萄糖的供试纳氏比色管。' };
    }
    if (cylinderMl > 41) {
      return { name: '量筒水量偏多', hint: '当前没有自动纠正。继续操作会保留实际体积误差。' };
    }
    return { name: '量取供试液用水', hint: '拿起洗瓶并按住 Space 挤压，将水加入 50 ml 量筒至约 40 ml。' };
  }

  if (!bulbAttached) {
    return { name: '连接洗耳球', hint: '把红色洗耳球拖到 5 ml 刻度吸管上端。接近接口后松开即可连接。' };
  }

  if (controlStandardMl < 1.95) {
    if (pipetteMl < 4.92) {
      return {
        name: '吸取标准硫酸钾溶液',
        hint: '拿起 5 ml 刻度吸管，用滚轮调低高度，让吸管尖端进入 100 ml 容量瓶液面内，然后按住 Space 吸至 0 刻度。',
      };
    }
    return {
      name: '向对照管放出 2.0 ml 标准液',
      hint: '把吸管移到对照管上方，用滚轮调整高度，按住 Shift 连续放液；当吸管刻度读数达到 2.00 ml 时松开。',
    };
  }

  if (controlStandardMl > 2.05) {
    return { name: '标准液加入过量', hint: `对照管已实际加入 ${controlStandardMl.toFixed(2)} ml 标准液。仿真保留该误差，不会自动回退。` };
  }

  if (controlTubeMl < 39) {
    if (cylinderMl >= 37 && cylinderMl <= 41) {
      return { name: '向对照管加水约至 40 ml', hint: '拿起 50 ml 量筒并用滚轮倾倒，让水柱真实落入右侧对照管。' };
    }
    return { name: '再次量取蒸馏水', hint: '对照管已加入约 2.0 ml 标准液。用洗瓶向 50 ml 量筒重新量取所需蒸馏水。' };
  }

  return {
    name: '供试液与对照液基础配制完成',
    hint: '两支纳氏比色管已完成前半段配制。下一阶段可继续实现稀盐酸、25% 氯化钡、混匀、静置和浑浊度比较。',
  };
}

export function ExperimentPanel() {
  const washBottle = useSimulationStore((s) => s.washBottleVolumeMl);
  const source = useSimulationStore((s) => s.sourceVolumeMl);
  const target = useSimulationStore((s) => s.targetVolumeMl);
  const controlTube = useSimulationStore((s) => s.controlTubeVolumeMl);
  const spilled = useSimulationStore((s) => s.spilledVolumeMl);
  const rate = useSimulationStore((s) => s.pourRateMlPerSec);
  const tilt = useSimulationStore((s) => s.tiltDeg);
  const pressure = useSimulationStore((s) => s.squeezePressure);
  const destination = useSimulationStore((s) => s.streamDestination);
  const operation = useSimulationStore((s) => s.activeOperation);

  const standardFlask = useSimulationStore((s) => s.standardFlaskVolumeMl);
  const pipette = useSimulationStore((s) => s.pipetteVolumeMl);
  const controlStandard = useSimulationStore((s) => s.controlStandardVolumeMl);
  const standardSpilled = useSimulationStore((s) => s.standardSpilledVolumeMl);
  const bulbAttached = useSimulationStore((s) => s.pipetteBulbAttached);
  const pipetteSuction = useSimulationStore((s) => s.pipetteSuction01);
  const pipetteDispense = useSimulationStore((s) => s.pipetteDispense01);
  const pipetteFlowRate = useSimulationStore((s) => s.pipetteFlowRateMlPerSec);
  const pipetteOperation = useSimulationStore((s) => s.pipetteOperation);

  const bottleGlucose = useSimulationStore((s) => s.glucoseBottleMassG);
  const spatulaGlucose = useSimulationStore((s) => s.spatulaPowderMassG);
  const paperGlucose = useSimulationStore((s) => s.paperGlucoseMassG);
  const tubeGlucose = useSimulationStore((s) => s.tubeGlucoseMassG);
  const powderSpilled = useSimulationStore((s) => s.powderSpilledMassG);
  const balanceReading = useSimulationStore((s) => s.balanceReadingG);
  const tareG = useSimulationStore((s) => s.balanceTareG);
  const paperOnBalance = useSimulationStore((s) => s.paperOnBalance);
  const powderRate = useSimulationStore((s) => s.powderRateGPerSec);
  const powderOperation = useSimulationStore((s) => s.powderOperation);

  const events = useSimulationStore((s) => s.events);
  const reset = useSimulationStore((s) => s.reset);

  const stage = useMemo(
    () => getStage({
      paperOnBalance,
      balanceReading,
      tareG,
      paperGlucoseG: paperGlucose,
      tubeGlucoseG: tubeGlucose,
      cylinderMl: source,
      tubeMl: target,
      bulbAttached,
      pipetteMl: pipette,
      controlStandardMl: controlStandard,
      controlTubeMl: controlTube,
    }),
    [paperOnBalance, balanceReading, tareG, paperGlucose, tubeGlucose, source, target, bulbAttached, pipette, controlStandard, controlTube],
  );

  const controlWater = Math.max(0, controlTube - controlStandard);
  const volumeError = 180 - (washBottle + source + target + controlWater + spilled);
  const glucoseError = INITIAL_GLUCOSE_BOTTLE_MASS_G - (bottleGlucose + spatulaGlucose + paperGlucose + tubeGlucose + powderSpilled);
  const standardError = INITIAL_STANDARD_FLASK_VOLUME_ML - (standardFlask + pipette + controlStandard + standardSpilled);
  const pipetteReading = Math.max(0, 5 - pipette);

  const destinationText = destination === 'cylinder'
    ? '50 ml 量筒'
    : destination === 'tube'
      ? '供试管'
      : destination === 'control-tube'
        ? '对照管'
        : destination === 'bench'
          ? '实验台'
          : '—';
  const operationText = operation === 'wash-to-cylinder'
    ? '洗瓶 → 量筒'
    : operation === 'cylinder-to-tube'
      ? '量筒 → 供试管'
      : operation === 'cylinder-to-control'
        ? '量筒 → 对照管'
        : '—';
  const powderOperationText = powderOperation === 'scoop'
    ? '试剂瓶 → 药勺'
    : powderOperation === 'spatula-to-paper'
      ? '药勺 → 称量纸'
      : powderOperation === 'paper-to-tube'
        ? '称量纸 → 供试管'
        : '—';
  const pipetteOperationText = pipetteOperation === 'attach-bulb'
    ? '洗耳球已连接'
    : pipetteOperation === 'aspirate'
      ? '吸液'
      : pipetteOperation === 'dispense'
        ? '放液'
        : '—';

  return (
    <aside className="info-panel">
      <div className="panel-section">
        <div className="panel-kicker">当前实验任务</div>
        <h2>{stage.name}</h2>
        <p>{stage.hint}</p>
      </div>

      <div className="panel-section simulator-block">
        <div className="panel-kicker">标准液 / 刻度吸管仿真</div>
        <div className="metric-grid compact">
          <div className="metric emphasis"><span>吸管刻度读数</span><strong>{pipetteReading.toFixed(2)} ml</strong></div>
          <div className="metric"><span>吸管内液体</span><strong>{pipette.toFixed(2)} ml</strong></div>
          <div className="metric"><span>对照管标准液</span><strong>{controlStandard.toFixed(2)} ml</strong></div>
          <div className="metric"><span>对照管总液量</span><strong>{controlTube.toFixed(2)} ml</strong></div>
          <div className="metric"><span>容量瓶余量</span><strong>{standardFlask.toFixed(2)} ml</strong></div>
          <div className="metric"><span>洗耳球</span><strong className="metric-text">{bulbAttached ? '已连接' : '未连接'}</strong></div>
          <div className="metric"><span>当前动作</span><strong className="metric-text">{pipetteOperationText}</strong></div>
          <div className="metric"><span>吸力 / 放液</span><strong>{Math.round(Math.max(pipetteSuction, pipetteDispense) * 100)}%</strong></div>
          <div className="metric"><span>吸管流量</span><strong>{pipetteFlowRate.toFixed(2)} ml/s</strong></div>
          <div className="metric"><span>标准液洒落</span><strong>{standardSpilled.toFixed(3)} ml</strong></div>
          <div className="metric"><span>标准液守恒误差</span><strong>{standardError.toFixed(4)} ml</strong></div>
        </div>
      </div>

      <div className="panel-section simulator-block">
        <div className="panel-kicker">称量仿真</div>
        <div className="metric-grid compact">
          <div className="metric emphasis"><span>天平读数</span><strong>{balanceReading.toFixed(3)} g</strong></div>
          <div className="metric"><span>称量纸葡萄糖</span><strong>{paperGlucose.toFixed(3)} g</strong></div>
          <div className="metric"><span>药勺载粉</span><strong>{spatulaGlucose.toFixed(3)} g</strong></div>
          <div className="metric"><span>供试管葡萄糖</span><strong>{tubeGlucose.toFixed(3)} g</strong></div>
          <div className="metric"><span>粉末洒落</span><strong>{powderSpilled.toFixed(3)} g</strong></div>
          <div className="metric"><span>粉末流量</span><strong>{powderRate.toFixed(3)} g/s</strong></div>
          <div className="metric"><span>粉末操作</span><strong className="metric-text">{powderOperationText}</strong></div>
          <div className="metric"><span>质量守恒误差</span><strong>{glucoseError.toFixed(4)} g</strong></div>
        </div>
      </div>

      <div className="panel-section simulator-block">
        <div className="panel-kicker">蒸馏水 / 倾倒仿真</div>
        <div className="metric-grid compact">
          <div className="metric"><span>洗瓶余量</span><strong>{washBottle.toFixed(1)} ml</strong></div>
          <div className="metric"><span>量筒液体</span><strong>{source.toFixed(2)} ml</strong></div>
          <div className="metric"><span>供试管液量</span><strong>{target.toFixed(2)} ml</strong></div>
          <div className="metric"><span>对照管水量</span><strong>{controlWater.toFixed(2)} ml</strong></div>
          <div className="metric"><span>累计水洒液</span><strong>{spilled.toFixed(2)} ml</strong></div>
          <div className="metric"><span>当前操作</span><strong className="metric-text">{operationText}</strong></div>
          <div className="metric"><span>液柱落点</span><strong className="metric-text">{destinationText}</strong></div>
          <div className="metric"><span>瞬时流量</span><strong>{rate.toFixed(1)} ml/s</strong></div>
          <div className="metric"><span>洗瓶挤压力</span><strong>{Math.round(pressure * 100)}%</strong></div>
          <div className="metric"><span>量筒倾角</span><strong>{tilt.toFixed(1)}°</strong></div>
          <div className="metric"><span>蒸馏水守恒误差</span><strong>{volumeError.toFixed(3)} ml</strong></div>
        </div>
      </div>

      <div className="panel-section rule-box">
        <div className="panel-kicker">仿真原则</div>
        <p>
          标准液吸取、放液、蒸馏水转移和葡萄糖称量都按连续量变化。吸不足、放过量、倒偏或洒落都会保留真实结果，并进入各自的守恒统计。
        </p>
      </div>

      <div className="panel-section operation-help">
        <div className="panel-kicker">操作</div>
        <div className="help-row"><kbd>拖动</kbd><span>拿起并移动仪器、称量纸、药勺</span></div>
        <div className="help-row"><kbd>蓝色按钮</kbd><span>电子天平去皮</span></div>
        <div className="help-row"><kbd>Space</kbd><span>药勺取粉、洗瓶挤水；吸管尖端入液后吸标准液</span></div>
        <div className="help-row"><kbd>Shift</kbd><span>拿住刻度吸管时连续放液</span></div>
        <div className="help-row"><kbd>滚轮</kbd><span>药勺/称量纸/量筒控制倾斜；刻度吸管控制上下高度</span></div>
        <div className="help-row"><kbd>空白区拖动</kbd><span>调整观察视角</span></div>
      </div>

      <div className="panel-section">
        <div className="panel-kicker">最近事件</div>
        <div className="event-list">
          {events.slice(-8).reverse().map((event) => (
            <div className="event" key={event.id}>
              <span>{event.type}</span>
              {'target' in event.payload && <small>{String(event.payload.target)}</small>}
            </div>
          ))}
          {events.length === 0 && <div className="event muted">尚无操作</div>}
        </div>
      </div>

      <button className="reset-btn" onClick={reset}>重置实验</button>
    </aside>
  );
}
