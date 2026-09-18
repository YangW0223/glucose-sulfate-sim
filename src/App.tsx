import { Canvas } from '@react-three/fiber';
import { LabScene } from './scene/LabScene';
import { ExperimentPanel } from './ui/ExperimentPanel';
import './styles.css';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">WEB 3D LAB SIMULATION</div>
          <h1>葡萄糖中硫酸盐的检查</h1>
        </div>
        <div className="status-chip">称量 + 刻度吸管 · 自由操作 · 多物质守恒 · 实时流体</div>
      </header>

      <main className="workspace">
        <section className="scene-card">
          <div className="shelf-hint">
            <span>3D 实验操作台</span>
            <small>称取供试品 → 配制供试液 → 吸取 2.0 ml 标准液 → 配制对照液</small>
          </div>
          <div className="canvas-wrap">
            <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
              <LabScene />
            </Canvas>
          </div>
          <div className="stepbar">
            <div>
              <span className="step-label">当前仿真 PoC</span>
              <strong>供试液 + 对照液前半段配制：称量、量水、刻度吸管吸液/放液都由实际操作决定</strong>
            </div>
            <span className="step-tip">先从仪器架拖到实验台；Space 吸液/取粉/挤水；Shift 放液；滚轮控制倾斜或高度</span>
          </div>
        </section>

        <ExperimentPanel />
      </main>
    </div>
  );
}
