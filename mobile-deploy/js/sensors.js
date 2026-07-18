class SensorSimulator {
  constructor() {
    this.reset();
    this.onUpdateCallback = null;
    this.intervalId = null;
    this.speedMultiplier = 1.0; // 시뮬레이션 대체 모드에서만 사용되는 가속 배율

    this.exerciseName = '';
    this.useGPS = false;
    this.runningShakeMode = false;
    this.realMotionActive = false;
    this.realGPSActive = false;
    this.simulationFallback = false;
    this.sensorUnavailable = false;

    this._motionHandler = null;
    this._geoWatchId = null;
    this._lastStepTime = 0;
    this._magHistory = [];
    this._motionBaseline = null;
    this._shakeArmed = true;
    this._lastPos = null;
    this._lastPosTime = null;
  }

  reset() {
    this.isTracking = false;
    this.steps = 0;
    this.distance = 0.0;
    this.calories = 0;
    this.duration = 0; // in seconds
    this.speed = 0.0;

    this._lastStepTime = 0;
    this._magHistory = [];
    this._motionBaseline = null;
    this._shakeArmed = true;
    this._lastPos = null;
    this._lastPosTime = null;
    this.sensorUnavailable = false;
  }

  // 기기가 가속도계(흔들림) 센서를 지원하는지 여부
  static isMotionSupported() {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  }

  // 기기가 GPS(위치) 센서를 지원하는지 여부
  static isGPSSupported() {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  // iOS 13+ 등 일부 브라우저는 사용자의 명시적 동작(버튼 클릭) 직후에만
  // 가속도계 사용 권한을 요청할 수 있으므로, 시작 버튼 클릭 시점에 호출한다.
  async requestMotionPermission() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const result = await DeviceMotionEvent.requestPermission();
        return result === 'granted';
      }
      return SensorSimulator.isMotionSupported();
    } catch (e) {
      console.warn('가속도계 권한 요청에 실패했습니다:', e);
      return false;
    }
  }

  // 사용자가 "시작" 버튼을 눌렀을 때만 호출됨 (자동 시작되지 않음)
  // 달리기는 스마트폰의 반복적인 흔들림만으로 걸음 수를 측정한다.
  async start(onUpdate, exerciseName = '') {
    if (this.isTracking) return;
    this.isTracking = true;
    this.onUpdateCallback = onUpdate;
    this.exerciseName = exerciseName;
    this.runningShakeMode = (exerciseName === '달리기');
    this.useGPS = false;
    this.speed = 0.0;

    const motionGranted = await this.requestMotionPermission();
    this.realMotionActive = motionGranted && SensorSimulator.isMotionSupported();
    if (this.realMotionActive) {
      this._motionHandler = (e) => this._onDeviceMotion(e);
      window.addEventListener('devicemotion', this._motionHandler);
    }

    this.realGPSActive = false;
    if (this.useGPS && SensorSimulator.isGPSSupported()) {
      this.realGPSActive = true;
      this._geoWatchId = navigator.geolocation.watchPosition(
        (pos) => this._onGeoUpdate(pos),
        (err) => {
          // GPS 신호를 못 받는 경우, 걸음 수 기반 거리 추정으로 자동 전환
          console.warn('GPS 신호를 받을 수 없어 걸음 수 기반 거리 추정으로 전환합니다:', err.message);
          this.realGPSActive = false;
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
      );
    }

    // 실제 센서(가속도계/GPS)를 전혀 사용할 수 없는 환경(예: PC 브라우저, 권한 거부)에서는
    // 앱 데모/테스트가 가능하도록 기존 시뮬레이션 방식으로 자동 대체 동작한다.
    // 달리기는 센서가 없을 때 임의의 걸음을 생성하지 않는다.
    this.sensorUnavailable = this.runningShakeMode && !this.realMotionActive;
    this.simulationFallback = !this.runningShakeMode && !this.realMotionActive && !this.realGPSActive;
    if (this.simulationFallback) {
      this.speed = this.useGPS ? 4.2 : 0.0;
    }

    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (!this.isTracking) return;
    this.isTracking = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler);
      this._motionHandler = null;
    }
    if (this._geoWatchId !== null && SensorSimulator.isGPSSupported()) {
      navigator.geolocation.clearWatch(this._geoWatchId);
      this._geoWatchId = null;
    }
    this.realMotionActive = false;
    this.realGPSActive = false;
  }

  // 가속도계 값에서 걸음/동작 횟수를 검출한다 (임계값 기반 피크 검출).
  // 달리기의 걸음 수는 물론, 스쿼트 등 다른 반복 동작 횟수 측정에도 동일하게 활용된다.
  _onDeviceMotion(e) {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc || acc.x === null || acc.x === undefined) return;

    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);

    if (this.runningShakeMode) {
      // 기기 방향과 무관하게 전체 가속도 크기를 사용한다. 천천히 변하는 중력/자세 변화는
      // 이동 평균으로 제거하고, 달릴 때 생기는 짧고 반복적인 충격만 한 걸음으로 센다.
      if (this._motionBaseline === null) {
        this._motionBaseline = mag;
        return;
      }

      this._motionBaseline = (this._motionBaseline * 0.94) + (mag * 0.06);
      const shakeStrength = Math.abs(mag - this._motionBaseline);
      const now = Date.now();
      const triggerThreshold = 1.3;
      const releaseThreshold = 0.55;
      const minStepInterval = 260;

      if (shakeStrength < releaseThreshold) this._shakeArmed = true;

      if (this._shakeArmed && shakeStrength > triggerThreshold && (now - this._lastStepTime) > minStepInterval) {
        this._shakeArmed = false;
        this._lastStepTime = now;
        this.steps += 1;
        // 달리기 평균 보폭을 0.8m로 잡아 센서 걸음 수로 거리를 추정한다.
        this.distance += 0.0008;
      }
      return;
    }

    this._magHistory.push(mag);
    if (this._magHistory.length > 5) this._magHistory.shift();
    const avg = this._magHistory.reduce((a, b) => a + b, 0) / this._magHistory.length;

    const threshold = 1.8; // 기기 흔들림 임계 변화량 (필요 시 기기별 보정 가능)
    const now = Date.now();
    const minInterval = 280; // 중복 카운트를 막기 위한 최소 검출 간격(ms)

    if (Math.abs(mag - avg) > threshold && (now - this._lastStepTime) > minInterval) {
      this._lastStepTime = now;
      this.steps += 1;

      if (!this.realGPSActive) {
        // GPS가 없을 때는 걸음 수 기반으로 이동거리를 근사 추정 (평균 보폭 0.7m)
        this.distance += 0.0007;
      }
    }
  }

  // GPS 좌표 변화를 이용해 실제 이동 거리(Haversine 공식)와 속도를 계산한다.
  _onGeoUpdate(pos) {
    const { latitude, longitude, speed } = pos.coords;
    const now = pos.timestamp || Date.now();

    if (this._lastPos) {
      const distKm = this._haversine(this._lastPos.latitude, this._lastPos.longitude, latitude, longitude);
      if (distKm < 0.2) { // GPS 튐(순간 이동) 값 필터링
        this.distance += distKm;
      }
    }

    if (typeof speed === 'number' && speed !== null && !isNaN(speed)) {
      this.speed = Math.max(0, parseFloat((speed * 3.6).toFixed(1))); // m/s -> km/h
    } else if (this._lastPos && this._lastPosTime) {
      const dtSec = (now - this._lastPosTime) / 1000;
      if (dtSec > 0) {
        const distKm = this._haversine(this._lastPos.latitude, this._lastPos.longitude, latitude, longitude);
        this.speed = Math.max(0, parseFloat(((distKm / dtSec) * 3600).toFixed(1)));
      }
    }

    this._lastPos = { latitude, longitude };
    this._lastPosTime = now;
  }

  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // 지구 반지름(km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  tick() {
    this.duration += 1;

    if (this.simulationFallback) {
      // 실제 센서를 사용할 수 없는 환경을 위한 대체(시뮬레이션) 동작 (기존 로직 유지)
      const stepIncrement = Math.round((this.speed / 3.6) * 1.4 * this.speedMultiplier);
      this.steps += stepIncrement;
      this.distance += (stepIncrement * 0.7) / 1000;

      const fluctuation = (Math.random() - 0.5) * 0.2;
      this.speed = Math.max(1.0, parseFloat((this.speed + fluctuation).toFixed(1)));
    } else if (!this.realGPSActive) {
      // 가속도계는 있지만 GPS가 없는 경우(실내 동작 등): 누적 거리/시간으로 속도를 근사
      this.speed = parseFloat(((this.distance / (this.duration / 3600)) || 0).toFixed(1));
    }

    // 칼로리 소모량: MET 공식 근사치 (체중 미입력 시 65kg 가정)
    const weight = (window.app && window.app.userProfile && window.app.userProfile.weight) || 65;
    const met = this.runningShakeMode ? (this.speed > 7 ? 9.8 : 6.0) : (this.useGPS ? 3.8 : 4.0);
    this.calories = Math.round(met * weight * (this.duration / 3600));

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getData());
    }
  }

  getData() {
    return {
      isTracking: this.isTracking,
      steps: this.steps,
      distance: parseFloat(this.distance.toFixed(2)),
      calories: this.calories,
      duration: this.duration,
      speed: this.speed,
      speedMultiplier: this.speedMultiplier,
      realMotionActive: this.realMotionActive,
      realGPSActive: this.realGPSActive,
      simulationFallback: this.simulationFallback,
      runningShakeMode: this.runningShakeMode,
      sensorUnavailable: this.sensorUnavailable
    };
  }
}

// 전역에서 사용 가능하도록 등록
window.sensorSimulator = new SensorSimulator();
