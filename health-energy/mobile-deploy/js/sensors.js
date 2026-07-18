class SensorSimulator {
  constructor() {
    this.reset();
    this.onUpdateCallback = null;
    this.intervalId = null;
    this.speedMultiplier = 1.0; // speed simulator multiplier
  }

  reset() {
    this.isTracking = false;
    this.steps = 0;
    this.distance = 0.0;
    this.calories = 0;
    this.duration = 0; // in seconds
    this.speed = 0.0;
  }

  start(onUpdate) {
    if (this.isTracking) return;
    this.isTracking = true;
    this.onUpdateCallback = onUpdate;
    this.speed = 4.2; // starting walking speed in km/h

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  stop() {
    if (!this.isTracking) return;
    this.isTracking = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  tick() {
    this.duration += 1;
    
    // Calculate new steps based on current speed and multiplier
    const stepIncrement = Math.round((this.speed / 3.6) * 1.4 * this.speedMultiplier); 
    this.steps += stepIncrement;

    // Distance in km (average step size 0.7m)
    this.distance += (stepIncrement * 0.7) / 1000;

    // Calories: approx 0.05 kcal per step
    this.calories += Math.round(stepIncrement * 0.045);

    // Add slight random fluctuation to speed
    const fluctuation = (Math.random() - 0.5) * 0.2;
    this.speed = Math.max(1.0, parseFloat((this.speed + fluctuation).toFixed(1)));

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getData());
    }
  }

  increaseSpeed() {
    if (!this.isTracking) return;
    if (this.speedMultiplier === 1.0) {
      this.speedMultiplier = 2.0;
      this.speed = 8.5; // Running speed
    } else {
      this.speedMultiplier = 1.0;
      this.speed = 4.5; // Walking speed
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
      speedMultiplier: this.speedMultiplier
    };
  }
}

// Make globally available
window.sensorSimulator = new SensorSimulator();
