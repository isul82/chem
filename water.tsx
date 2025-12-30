import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Rocket } from 'lucide-react';

const WaterRocketSimulator = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // 초기 설정값
  const [stage1Water, setStage1Water] = useState(500);
  const [stage1Pressure, setStage1Pressure] = useState(5);
  const [stage2Water, setStage2Water] = useState(400);
  const [stage2Pressure, setStage2Pressure] = useState(4.5);
  const [stage3Water, setStage3Water] = useState(300);
  const [stage3Pressure, setStage3Pressure] = useState(4);
  
  const [isRunning, setIsRunning] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  
  // 물리 상수
  const g = 9.81; // 중력가속도 (m/s²)
  const rho_water = 1000; // 물 밀도 (kg/m³)
  const rho_air = 1.225; // 공기 밀도 (kg/m³)
  const Cd = 0.75; // 항력계수
  const nozzle_area = 0.0001; // 노즐 면적 (m²)
  
  // 각 단의 사양 (실제 물로켓 기준)
  const stages = [
    { mass: 0.15, volume: 0.0015, area: 0.0079, separationTime: 3 },
    { mass: 0.12, volume: 0.0012, area: 0.0063, separationTime: 6 },
    { mass: 0.10, volume: 0.001, area: 0.005, separationTime: null }
  ];
  
  // 시뮬레이션 실행
  const runSimulation = () => {
    const dt = 0.01; // 시간 간격
    const maxTime = 30;
    
    let t = 0;
    let currentStage = 0;
    let y = 0; // 높이
    let v = 0; // 속도
    
    const trajectory = [];
    const events = [];
    
    // 각 단의 물과 압력 설정
    const stageConfigs = [
      { water: stage1Water / 1000, pressure: stage1Pressure * 101325 },
      { water: stage2Water / 1000, pressure: stage2Pressure * 101325 },
      { water: stage3Water / 1000, pressure: stage3Pressure * 101325 }
    ];
    
    let water_mass = stageConfigs[currentStage].water;
    let pressure = stageConfigs[currentStage].pressure;
    let rocket_mass = stages[currentStage].mass + water_mass;
    
    while (t < maxTime && y >= 0) {
      // 추력 계산 (물이 있고 압력이 있을 때)
      let thrust = 0;
      if (water_mass > 0 && pressure > 101325) {
        const v_exit = Math.sqrt(2 * (pressure - 101325) / rho_water);
        const mass_flow = rho_water * nozzle_area * v_exit;
        thrust = mass_flow * v_exit;
        
        water_mass -= mass_flow * dt;
        if (water_mass < 0) water_mass = 0;
        
        // 압력 감소 (단열 팽창 근사)
        const volume_water = water_mass / rho_water;
        const volume_air = stages[currentStage].volume - volume_water;
        pressure = pressure * Math.pow(stages[currentStage].volume / volume_air, 1.4);
      }
      
      // 항력 계산
      const drag = 0.5 * rho_air * v * Math.abs(v) * Cd * stages[currentStage].area;
      
      // 가속도 계산
      const a = (thrust - rocket_mass * g - drag) / rocket_mass;
      
      // 속도 및 위치 업데이트
      v += a * dt;
      y += v * dt;
      
      // 단 분리 체크
      if (currentStage < 2 && t >= stages[currentStage].separationTime && water_mass <= 0) {
        events.push({
          time: t,
          type: 'separation',
          stage: currentStage + 1,
          height: y,
          velocity: v
        });
        
        currentStage++;
        water_mass = stageConfigs[currentStage].water;
        pressure = stageConfigs[currentStage].pressure;
        rocket_mass = stages[currentStage].mass + water_mass;
      }
      
      trajectory.push({
        time: t,
        height: y,
        velocity: v,
        acceleration: a,
        stage: currentStage + 1,
        thrust: thrust,
        waterMass: water_mass
      });
      
      t += dt;
    }
    
    // 최고 높이 찾기
    const maxHeight = Math.max(...trajectory.map(d => d.height));
    const maxHeightPoint = trajectory.find(d => d.height === maxHeight);
    
    // 성공 여부 판단 (50m 이상을 성공으로 가정)
    const success = maxHeight >= 50;
    
    setSimulationData({
      trajectory,
      events,
      maxHeight,
      maxHeightTime: maxHeightPoint.time,
      success,
      totalTime: t
    });
    
    setIsRunning(true);
    setCurrentTime(0);
  };
  
  // 애니메이션
  useEffect(() => {
    if (!isRunning || !simulationData) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    let animationTime = currentTime;
    const animationSpeed = 1; // 실시간 속도
    
    const animate = () => {
      animationTime += 0.016 * animationSpeed;
      
      if (animationTime >= simulationData.totalTime) {
        setIsRunning(false);
        return;
      }
      
      setCurrentTime(animationTime);
      
      // 현재 상태 찾기
      const currentIndex = Math.floor(animationTime / 0.01);
      const currentState = simulationData.trajectory[currentIndex] || simulationData.trajectory[simulationData.trajectory.length - 1];
      
      // 캔버스 클리어
      ctx.fillStyle = '#e6f3ff';
      ctx.fillRect(0, 0, width, height);
      
      // 그리드 그리기
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = (height - 100) * i / 10 + 50;
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(width - 50, y);
        ctx.stroke();
      }
      
      // 높이 스케일 (최대 높이의 120%를 화면에 표시)
      const scale = (height - 150) / (simulationData.maxHeight * 1.2);
      const rocketY = height - 100 - (currentState.height * scale);
      const rocketX = width / 2;
      
      // 발사대 그리기
      ctx.fillStyle = '#666';
      ctx.fillRect(rocketX - 20, height - 100, 40, 10);
      
      // 로켓 그리기
      const rocketWidth = 20;
      const rocketHeight = 60;
      
      // 로켓 본체
      ctx.fillStyle = currentState.stage === 1 ? '#ff6b6b' : currentState.stage === 2 ? '#4ecdc4' : '#45b7d1';
      ctx.fillRect(rocketX - rocketWidth/2, rocketY - rocketHeight, rocketWidth, rocketHeight);
      
      // 로켓 노즈콘
      ctx.beginPath();
      ctx.moveTo(rocketX - rocketWidth/2, rocketY - rocketHeight);
      ctx.lineTo(rocketX, rocketY - rocketHeight - 20);
      ctx.lineTo(rocketX + rocketWidth/2, rocketY - rocketHeight);
      ctx.fillStyle = '#fff';
      ctx.fill();
      
      // 날개
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(rocketX - rocketWidth/2, rocketY - 10);
      ctx.lineTo(rocketX - rocketWidth/2 - 10, rocketY);
      ctx.lineTo(rocketX - rocketWidth/2, rocketY);
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(rocketX + rocketWidth/2, rocketY - 10);
      ctx.lineTo(rocketX + rocketWidth/2 + 10, rocketY);
      ctx.lineTo(rocketX + rocketWidth/2, rocketY);
      ctx.fill();
      
      // 추력 분사 효과
      if (currentState.thrust > 0) {
        const flameLength = Math.min(currentState.thrust / 10, 40);
        const flameWidth = rocketWidth * 0.7;
        
        ctx.fillStyle = 'rgba(255, 150, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(rocketX - flameWidth/2, rocketY);
        ctx.lineTo(rocketX, rocketY + flameLength);
        ctx.lineTo(rocketX + flameWidth/2, rocketY);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
        ctx.beginPath();
        ctx.moveTo(rocketX - flameWidth/3, rocketY);
        ctx.lineTo(rocketX, rocketY + flameLength * 0.7);
        ctx.lineTo(rocketX + flameWidth/3, rocketY);
        ctx.fill();
      }
      
      // 궤적 그리기
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= currentIndex && i < simulationData.trajectory.length; i++) {
        const point = simulationData.trajectory[i];
        const px = rocketX;
        const py = height - 100 - (point.height * scale);
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      
      // 높이 라벨
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 5; i++) {
        const h = (simulationData.maxHeight * 1.2) * i / 5;
        const y = height - 100 - (h * scale);
        ctx.fillText(h.toFixed(0) + 'm', 45, y + 4);
      }
      
      // 정보 패널
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(10, 10, 200, 150);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(10, 10, 200, 150);
      
      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('시뮬레이션 정보', 20, 30);
      
      ctx.font = '12px Arial';
      ctx.fillText(`시간: ${currentState.time.toFixed(2)}초`, 20, 50);
      ctx.fillText(`높이: ${currentState.height.toFixed(2)}m`, 20, 70);
      ctx.fillText(`속도: ${currentState.velocity.toFixed(2)}m/s`, 20, 90);
      ctx.fillText(`현재 단: ${currentState.stage}단`, 20, 110);
      ctx.fillText(`추력: ${currentState.thrust.toFixed(2)}N`, 20, 130);
      ctx.fillText(`물: ${(currentState.waterMass * 1000).toFixed(0)}mL`, 20, 150);
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, simulationData, currentTime]);
  
  const reset = () => {
    setIsRunning(false);
    setSimulationData(null);
    setCurrentTime(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
  
  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <Rocket className="text-blue-600" />
          3단 물로켓 시뮬레이션
        </h1>
        <p className="text-gray-600 mt-2">물의 양과 압력을 조정하여 최적의 발사 조건을 찾아보세요</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 1단 설정 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-bold text-lg mb-3 text-red-600 flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            1단 로켓
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                물의 양: {stage1Water}mL
              </label>
              <input
                type="range"
                min="100"
                max="1000"
                value={stage1Water}
                onChange={(e) => setStage1Water(Number(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                압력: {stage1Pressure}기압
              </label>
              <input
                type="range"
                min="2"
                max="8"
                step="0.5"
                value={stage1Pressure}
                onChange={(e) => setStage1Pressure(Number(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* 2단 설정 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-bold text-lg mb-3 text-teal-600 flex items-center gap-2">
            <div className="w-3 h-3 bg-teal-600 rounded-full"></div>
            2단 로켓
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                물의 양: {stage2Water}mL
              </label>
              <input
                type="range"
                min="100"
                max="800"
                value={stage2Water}
                onChange={(e) => setStage2Water(Number(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                압력: {stage2Pressure}기압
              </label>
              <input
                type="range"
                min="2"
                max="8"
                step="0.5"
                value={stage2Pressure}
                onChange={(e) => setStage2Pressure(Number(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* 3단 설정 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-bold text-lg mb-3 text-blue-600 flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            3단 로켓
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                물의 양: {stage3Water}mL
              </label>
              <input
                type="range"
                min="100"
                max="600"
                value={stage3Water}
                onChange={(e) => setStage3Water(Number(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                압력: {stage3Pressure}기압
              </label>
              <input
                type="range"
                min="2"
                max="8"
                step="0.5"
                value={stage3Pressure}
                onChange={(e) => setStage3Pressure(Number(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* 제어 버튼 */}
      <div className="flex gap-4 mb-6 justify-center">
        <button
          onClick={runSimulation}
          disabled={isRunning}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Play size={20} />
          발사 시뮬레이션
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-700 transition-colors"
        >
          <RotateCcw size={20} />
          초기화
        </button>
      </div>
      
      {/* 시뮬레이션 결과 */}
      {simulationData && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="font-bold text-lg mb-3">시뮬레이션 결과</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {simulationData.maxHeight.toFixed(2)}m
              </div>
              <div className="text-sm text-gray-600">최고 높이</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {simulationData.maxHeightTime.toFixed(2)}초
              </div>
              <div className="text-sm text-gray-600">최고 도달 시간</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {simulationData.events.length}회
              </div>
              <div className="text-sm text-gray-600">단 분리 횟수</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${simulationData.success ? 'text-green-600' : 'text-red-600'}`}>
                {simulationData.success ? '성공' : '실패'}
              </div>
              <div className="text-sm text-gray-600">발사 결과 (50m 기준)</div>
            </div>
          </div>
          
          {simulationData.events.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">단 분리 이벤트:</h4>
              <div className="space-y-1">
                {simulationData.events.map((event, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    • {event.time.toFixed(2)}초: {event.stage}단 분리 (높이: {event.height.toFixed(2)}m, 속도: {event.velocity.toFixed(2)}m/s)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 캔버스 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full border border-gray-300 rounded"
        />
      </div>
      
      {/* 설명 */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold text-lg mb-2">💡 사용 방법</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• 각 단의 물의 양과 압력을 슬라이더로 조정하세요</li>
          <li>• "발사 시뮬레이션" 버튼을 클릭하면 실시간 애니메이션이 시작됩니다</li>
          <li>• 물의 양이 많을수록 추력이 오래 지속되지만 무게가 증가합니다</li>
          <li>• 압력이 높을수록 초기 추력이 강하지만 빠르게 소진됩니다</li>
          <li>• 각 단은 물이 소진되면 자동으로 분리됩니다</li>
          <li>• 최적의 조합을 찾아 최고 높이에 도전해보세요!</li>
        </ul>
      </div>
    </div>
  );
};

export default WaterRocketSimulator;