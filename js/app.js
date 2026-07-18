class HealthEnergyApp {
  constructor() {
    this.userProfile = null;
    this.logs = [];
    this.activeScreen = 'onboarding';
    this.reportTimeframe = 'weekly';
    this.selectedTimelineDate = 'all';
    this.selectedHomeDate = 'today';
    
    // Camera Mock State
    this.cameraReps = 0;
    this.cameraScores = [];
    this.cameraLiveScore = null;
    this.cameraFlexibilityDistance = null;
    this.cameraHandFootDistance = null;
    this.cameraBestFlexibilityDistance = null;
    this.cameraStartedAt = null;
    this.cameraElapsedIntervalId = null;
    this.webcamStream = null;
    this.cameraSocket = null;
    this.frameIntervalId = null;
    this.localMotionIntervalId = null;
    this.previousMotionFrame = null;
    this.motionPhase = 'idle';
    this.motionStartedAt = 0;
    this.motionPeak = 0;
    this.lastMotionRepAt = 0;
    this.cameraSessionId = 0;
    this.poseLandmarker = null;
    this.poseAnalysisIntervalId = null;
    this.poseLastVideoTime = -1;
    this.posePhase = 'waitingStart';
    this.poseStableFrames = 0;
    this.poseInvalidFrames = 0;
    this.fullBodyStableFrames = 0;
    this.poseRepStartedAt = 0;
    this.poseVisibleSide = 'both';
    this.cameraFacingMode = 'user';
    this.wakeLock = null;
    
    // Bind methods
    this.onboardingSubmit = this.onboardingSubmit.bind(this);
    this.saveGoalsEdit = this.saveGoalsEdit.bind(this);
    this.saveDirectWorkout = this.saveDirectWorkout.bind(this);
    this.handleCameraSquat = this.handleCameraSquat.bind(this);
    this.handleCameraBadSquat = this.handleCameraBadSquat.bind(this);
    this.finishCameraWorkout = this.finishCameraWorkout.bind(this);
    this.startWebcam = this.startWebcam.bind(this);
    this.stopWebcam = this.stopWebcam.bind(this);
    this.handleSensorUpdate = this.handleSensorUpdate.bind(this);
    this.toggleSensorTracking = this.toggleSensorTracking.bind(this);
    this.finishAutoWorkout = this.finishAutoWorkout.bind(this);
    
    this.init();
  }

  init() {
    this.registerMobileApp();

    // Load data from LocalStorage
    const savedProfile = localStorage.getItem('he_user_profile');
    const savedLogs = localStorage.getItem('he_exercise_logs');

    if (savedProfile) {
      this.userProfile = JSON.parse(savedProfile);
      this.logs = savedLogs ? JSON.parse(savedLogs) : [];
      // Remove the four legacy demonstration records that earlier versions created automatically.
      const legacyDemoRecords = new Set([
        '35|160|auto|4200', '8|32|camera|40', '50|220|direct|', '45|210|auto|6200'
      ]);
      const retainedLogs = this.logs.filter(log => !legacyDemoRecords.has(`${log.duration}|${log.calories}|${log.method}|${log.steps ?? log.reps ?? ''}`));
      if (retainedLogs.length !== this.logs.length) {
        this.logs = retainedLogs;
        localStorage.setItem('he_exercise_logs', JSON.stringify(this.logs));
      }
      
      this.activeScreen = 'home';
    } else {
      this.activeScreen = 'onboarding';
    }

    // Bind DOM events
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupDOMEventListeners();
        this.updateUI();
      });
    } else {
      this.setupDOMEventListeners();
      this.updateUI();
    }
  }

  setupDOMEventListeners() {
    // Onboarding Form
    const onboardingForm = document.getElementById('form-onboarding');
    if (onboardingForm) {
      onboardingForm.addEventListener('submit', this.onboardingSubmit);
    }

    // Onboarding Step Navigation
    const btnOnboardingNext = document.getElementById('btn-onboarding-next');
    if (btnOnboardingNext) {
      btnOnboardingNext.addEventListener('click', () => {
        const inputName = document.getElementById('input-name');
        const inputAge = document.getElementById('input-age');
        const inputGender = document.getElementById('input-gender');
        const inputHeight = document.getElementById('input-height');
        const inputWeight = document.getElementById('input-weight');

        if (!inputName.reportValidity() || !inputAge.reportValidity() || !inputGender.reportValidity() || !inputHeight.reportValidity() || !inputWeight.reportValidity()) {
          return;
        }

        const step1 = document.getElementById('onboarding-step-1');
        const step2 = document.getElementById('onboarding-step-2');
        if (step1 && step2) {
          step1.style.display = 'none';
          step2.style.display = 'block';
        }
      });
    }

    const btnOnboardingBack = document.getElementById('btn-onboarding-back');
    if (btnOnboardingBack) {
      btnOnboardingBack.addEventListener('click', () => {
        const step1 = document.getElementById('onboarding-step-1');
        const step2 = document.getElementById('onboarding-step-2');
        if (step1 && step2) {
          step1.style.display = 'block';
          step2.style.display = 'none';
        }
      });
    }

    // Direct Input Form
    const directForm = document.getElementById('form-direct-workout');
    if (directForm) {
      directForm.addEventListener('submit', this.saveDirectWorkout);
    }

    const selectType = document.getElementById('select-exercise-type');
    if (selectType) {
      selectType.addEventListener('change', () => {
        const selectedOption = selectType.options[selectType.selectedIndex];
        const unit = selectedOption.getAttribute('data-unit');
        const name = selectedOption.getAttribute('data-name');
        
        const measureGroup = document.getElementById('direct-measurement-group');
        const measureLabel = document.getElementById('label-direct-measurement');
        const measureInput = document.getElementById('input-direct-measurement');
        
        const repsGroup = document.getElementById('direct-reps-group');
        const repsInput = document.getElementById('input-direct-reps');
        
        if (measureGroup && measureLabel && measureInput && repsGroup && repsInput) {
          if (unit === '회') {
            // Show Reps input
            repsGroup.style.display = 'block';
            repsInput.setAttribute('required', 'required');
            repsInput.placeholder = `${name} 횟수 입력`;
            
            // Hide Measurement input
            measureGroup.style.display = 'none';
            measureInput.value = '';
            measureInput.removeAttribute('required');
          } else if (unit && name) {
            // Show Measurement input (non-rep like seconds, cm, kg, steps)
            measureGroup.style.display = 'block';
            measureLabel.textContent = `${name} (${unit})`;
            measureInput.placeholder = `${name} 수치 입력`;
            measureInput.setAttribute('required', 'required');
            
            // Hide Reps input
            repsGroup.style.display = 'none';
            repsInput.value = '';
            repsInput.removeAttribute('required');
          } else {
            // Hide both
            measureGroup.style.display = 'none';
            measureInput.value = '';
            measureInput.removeAttribute('required');
            
            repsGroup.style.display = 'none';
            repsInput.value = '';
            repsInput.removeAttribute('required');
          }
        }
      });
    }

    // Profile button: reuse the onboarding form as an edit screen without deleting activity logs.
    const profileBtn = document.getElementById('btn-profile');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        const profile = this.userProfile || {};
        const values = {
          'input-name': profile.name,
          'input-age': profile.age,
          'input-gender': profile.gender,
          'input-height': profile.height,
          'input-weight': profile.weight,
          'input-calorie-goal': profile.calorieGoal,
          'input-duration-goal': profile.durationGoal,
          'input-step-goal': profile.stepGoal
        };
        Object.entries(values).forEach(([id, value]) => {
          const input = document.getElementById(id);
          if (input && value !== undefined && value !== null) input.value = value;
        });

        const step1 = document.getElementById('onboarding-step-1');
        const step2 = document.getElementById('onboarding-step-2');
        if (step1 && step2) {
          step1.style.display = 'block';
          step2.style.display = 'none';
        }

        this.navigateTo('onboarding');
      });
    }

    // Quick Add FAB
    const fabAdd = document.getElementById('fab-add-workout');
    if (fabAdd) {
      fabAdd.addEventListener('click', () => {
        this.navigateTo('choose-workout');
      });
    }

    // Log Clear Button
    const clearBtn = document.getElementById('btn-clear-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('모든 운동 기록을 초기화하시겠습니까?')) {
          this.logs = [];
          localStorage.setItem('he_exercise_logs', JSON.stringify(this.logs));
          this.updateUI();
        }
      });
    }

    // Camera Simulation Buttons
    const btnSimSquat = document.getElementById('btn-sim-squat');
    if (btnSimSquat) btnSimSquat.addEventListener('click', this.handleCameraSquat);

    const btnSimBadSquat = document.getElementById('btn-sim-bad-squat');
    if (btnSimBadSquat) btnSimBadSquat.addEventListener('click', this.handleCameraBadSquat);

    const btnFinishCamera = document.getElementById('btn-finish-camera-workout');
    if (btnFinishCamera) btnFinishCamera.addEventListener('click', this.finishCameraWorkout);

    const btnSwitchCamera = document.getElementById('btn-switch-camera');
    if (btnSwitchCamera) btnSwitchCamera.addEventListener('click', () => this.switchCamera());

    const selectCameraEx = document.getElementById('select-camera-exercise');
    if (selectCameraEx) {
      selectCameraEx.addEventListener('change', () => {
        const val = selectCameraEx.value;
        const workspace = document.getElementById('camera-workspace-container');
        const placeholder = document.getElementById('camera-exercise-placeholder');
        const repLabel = document.getElementById('camera-rep-label');
        const btnSim = document.getElementById('btn-sim-squat');
        
        if (workspace && placeholder) {
          if (val) {
            workspace.style.display = 'block';
            placeholder.style.display = 'none';
            const isFlexibility = this.isCameraFlexibilityExercise(val);
            if (repLabel) repLabel.textContent = isFlexibility ? '운동시간' : `${val} 횟수`;
            if (btnSim) btnSim.textContent = `${val} 1회 성공`;
            const distanceBox = document.getElementById('camera-flexibility-distance-box');
            const distanceLabel = document.getElementById('camera-flexibility-distance-label');
            if (distanceBox) distanceBox.style.display = isFlexibility ? '' : 'none';
            if (distanceLabel) distanceLabel.textContent = val === '서서 윗몸 앞으로 굽히기'
              ? '측정 중 바닥 거리 최솟값'
              : '바닥까지 추정 거리';
            
            // Reset camera values
            this.cameraReps = 0;
            this.cameraScores = [];
            this.cameraLiveScore = null;
            this.cameraFlexibilityDistance = null;
            this.cameraHandFootDistance = null;
            this.cameraBestFlexibilityDistance = null;
            this.cameraStartedAt = null;
            this.updateCameraDisplay();
            
            const statusMsg = document.getElementById('camera-status-msg');
            if (statusMsg) {
              statusMsg.textContent = `${val} 준비 자세를 취하세요.`;
              statusMsg.style.color = 'var(--text-primary)';
            }

            this.startWebcam();
          } else {
            workspace.style.display = 'none';
            placeholder.style.display = 'flex';
            this.stopWebcam();
          }
        }
      });
    }

    // Auto Tracking Buttons
    const btnSensorToggle = document.getElementById('btn-sensor-toggle');
    if (btnSensorToggle) btnSensorToggle.addEventListener('click', this.toggleSensorTracking);

    const btnFinishAuto = document.getElementById('btn-finish-auto-workout');
    if (btnFinishAuto) btnFinishAuto.addEventListener('click', this.finishAutoWorkout);

    const selectAutoEx = document.getElementById('select-auto-exercise');
    if (selectAutoEx) {
      selectAutoEx.addEventListener('change', () => {
        const val = selectAutoEx.value;
        const workspace = document.getElementById('auto-workspace-container');
        const placeholder = document.getElementById('auto-exercise-placeholder');
        const stepsLabel = document.getElementById('auto-steps-label');
        
        if (workspace && placeholder) {
          if (val) {
            workspace.style.display = 'block';
            placeholder.style.display = 'none';
            if (stepsLabel) stepsLabel.textContent = val === '달리기' ? '흔들림 감지 걸음 수' : `${val} 횟수`;
            
            // Reset sensor simulator variables
            window.sensorSimulator.reset();
            const min = "00";
            const sec = "00";
            document.getElementById('auto-duration').textContent = `${min}:${sec}`;
            document.getElementById('auto-steps').textContent = val === '달리기' ? '0 걸음' : '0 회';
            document.getElementById('auto-distance').textContent = `0.00 km`;
            document.getElementById('auto-calories').textContent = `0 kcal`;
            document.getElementById('auto-speed').innerHTML = `0.0 <span style="font-size: 1rem; font-weight: 500; color: var(--text-secondary);">km/h</span>`;
            
            const statusMsg = document.getElementById('auto-tracking-status');
            if (statusMsg) statusMsg.innerHTML = val === '달리기'
              ? '<i class="fa-solid fa-mobile-screen"></i> 시작 후 스마트폰을 들거나 주머니에 넣고 달려주세요'
              : '<i class="fa-solid fa-pause"></i> 일시 정지됨';
          } else {
            workspace.style.display = 'none';
            placeholder.style.display = 'flex';
          }
        }
      });
    }

    // Toggle Energy Details
    const toggleDetailsBtn = document.getElementById('btn-toggle-energy-details');
    if (toggleDetailsBtn) {
      toggleDetailsBtn.addEventListener('click', () => {
        const container = document.getElementById('energy-details-container');
        if (container) {
          if (container.style.display === 'none') {
            container.style.display = 'block';
            toggleDetailsBtn.innerHTML = '<i class="fa-solid fa-circle-chevron-up"></i> 상세 정보 접기';
            this.updateEnergyDetails();
          } else {
            container.style.display = 'none';
            toggleDetailsBtn.innerHTML = '<i class="fa-solid fa-circle-info"></i> 자세히 알아보기';
          }
        }
      });
    }
    // Home Date Lookback Arrows
    const btnHomePrev = document.getElementById('btn-home-prev-date');
    if (btnHomePrev) {
      btnHomePrev.addEventListener('click', () => this.navigateHomeDate(1));
    }
    
    const btnHomeNext = document.getElementById('btn-home-next-date');
    if (btnHomeNext) {
      btnHomeNext.addEventListener('click', () => this.navigateHomeDate(-1));
    }

    // Goal Edit Modal event listeners
    const btnEditGoals = document.getElementById('btn-edit-goals');
    const modalEditGoals = document.getElementById('modal-edit-goals');
    const btnCloseEditGoals = document.getElementById('btn-close-edit-goals');
    const formEditGoals = document.getElementById('form-edit-goals');

    if (btnEditGoals && modalEditGoals) {
      btnEditGoals.addEventListener('click', () => {
        // Pre-fill fields with current goals
        const editCalorie = document.getElementById('edit-calorie-goal');
        const editDuration = document.getElementById('edit-duration-goal');
        const editStep = document.getElementById('edit-step-goal');

        if (editCalorie && this.userProfile) editCalorie.value = this.userProfile.calorieGoal || 500;
        if (editDuration && this.userProfile) editDuration.value = this.userProfile.durationGoal || 60;
        if (editStep && this.userProfile) editStep.value = this.userProfile.stepGoal || 10000;

        modalEditGoals.style.display = 'flex';
      });
    }

    if (btnCloseEditGoals && modalEditGoals) {
      btnCloseEditGoals.addEventListener('click', () => {
        modalEditGoals.style.display = 'none';
      });
    }

    if (formEditGoals) {
      formEditGoals.addEventListener('submit', this.saveGoalsEdit);
    }
  }

  seedMockLogs() {
    const today = new Date();
    const formatDate = (daysAgo) => {
      const d = new Date(today);
      d.setDate(today.getDate() - daysAgo);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    this.logs = [
      {
        id: Date.now() - 400000000,
        type: "야외 걷기/달리기",
        duration: 35,
        calories: 160,
        date: formatDate(4),
        time: "08:15",
        intensity: "medium",
        memo: "상쾌한 아침 조깅! 야외 날씨가 정말 좋습니다.",
        method: "auto",
        steps: 4200,
        distance: 2.9
      },
      {
        id: Date.now() - 300000000,
        type: "스쿼트",
        duration: 8,
        calories: 32,
        date: formatDate(3),
        time: "18:40",
        intensity: "medium",
        memo: "스쿼트 40회 완료. 허벅지 근육 자극이 확실히 오네요.",
        method: "camera",
        reps: 40,
        postureScore: 92
      },
      {
        id: Date.now() - 200000000,
        type: "웨이트 트레이닝",
        duration: 50,
        calories: 220,
        date: formatDate(2),
        time: "20:00",
        intensity: "high",
        memo: "헬스장에서 하체 및 어깨 집중 훈련.",
        method: "direct"
      },
      {
        id: Date.now() - 100000000,
        type: "야외 걷기/달리기",
        duration: 45,
        calories: 210,
        date: formatDate(1),
        time: "19:30",
        intensity: "medium",
        memo: "저녁 가벼운 산책으로 6000보 걸음 달성.",
        method: "auto",
        steps: 6200,
        distance: 4.3
      }
    ];

    localStorage.setItem('he_exercise_logs', JSON.stringify(this.logs));
  }

  navigateTo(screenId, presetExerciseType) {
    this.activeScreen = screenId;
    
    // Manage sensor simulator state if leaving auto-tracking screen
    if (screenId !== 'auto-tracking' && window.sensorSimulator.isTracking) {
      window.sensorSimulator.stop();
    }

    // Stop webcam if leaving camera screen
    if (screenId !== 'camera-workout') {
      this.stopWebcam();
    }

    // Reset camera simulation state if entering camera screen
    if (screenId === 'camera-workout') {
      const selectCameraEx = document.getElementById('select-camera-exercise');
      if (selectCameraEx) selectCameraEx.value = "";
      
      const workspace = document.getElementById('camera-workspace-container');
      const placeholder = document.getElementById('camera-exercise-placeholder');
      if (workspace) workspace.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';

      this.cameraReps = 0;
      this.cameraScores = [];
      this.cameraFlexibilityDistance = null;
      this.cameraHandFootDistance = null;
      this.cameraBestFlexibilityDistance = null;
      const distanceBox = document.getElementById('camera-flexibility-distance-box');
      if (distanceBox) distanceBox.style.display = 'none';
      this.updateCameraDisplay();
      
      const statusMsg = document.getElementById('camera-status-msg');
      if (statusMsg) {
        statusMsg.textContent = "자세를 잡고 대기하세요.";
        statusMsg.style.color = "var(--text-primary)";
      }
    }

    // Reset auto-tracking screen state if entering auto-tracking screen
    if (screenId === 'auto-tracking') {
      const selectAutoEx = document.getElementById('select-auto-exercise');
      if (selectAutoEx) selectAutoEx.value = "";
      
      const workspace = document.getElementById('auto-workspace-container');
      const placeholder = document.getElementById('auto-exercise-placeholder');
      if (workspace) workspace.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
      
      window.sensorSimulator.reset();
      
      // Reset button UI
      const toggleBtn = document.getElementById('btn-sensor-toggle');
      if (toggleBtn) {
        toggleBtn.textContent = "시작";
        toggleBtn.style.background = "var(--color-primary)";
      }
      document.getElementById('auto-duration').textContent = "00:00";
      document.getElementById('auto-steps').textContent = "0 회";
      document.getElementById('auto-distance').textContent = "0.00 km";
      document.getElementById('auto-calories').textContent = "0 kcal";
      document.getElementById('auto-speed').innerHTML = `0.0 <span style="font-size: 1rem; font-weight: 500; color: var(--text-secondary);">km/h</span>`;
      
      const statusMsg = document.getElementById('auto-tracking-status');
      if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-pause"></i> 일시 정지됨';
    }

    if (screenId === 'direct-input') {
      const form = document.getElementById('form-direct-workout');
      if (form) form.reset();
      
      const measureGroup = document.getElementById('direct-measurement-group');
      if (measureGroup) measureGroup.style.display = 'none';
      
      const repsGroup = document.getElementById('direct-reps-group');
      if (repsGroup) repsGroup.style.display = 'none';

      if (presetExerciseType) {
        setTimeout(() => {
          const selectType = document.getElementById('select-exercise-type');
          if (selectType) {
            selectType.value = presetExerciseType;
            selectType.dispatchEvent(new Event('change'));
          }
        }, 50);
      }
    }

    this.updateUI();
    const screenWrapper = document.querySelector('.screen-wrapper');
    if (screenWrapper) screenWrapper.scrollTop = 0;
  }

  onboardingSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('input-name').value;
    const age = parseInt(document.getElementById('input-age').value);
    const gender = document.getElementById('input-gender').value;
    const height = parseInt(document.getElementById('input-height').value);
    const weight = parseInt(document.getElementById('input-weight').value);
    
    const calorieGoal = parseInt(document.getElementById('input-calorie-goal').value) || 500;
    const durationGoal = parseInt(document.getElementById('input-duration-goal').value) || 60;
    const stepGoal = parseInt(document.getElementById('input-step-goal').value) || 10000;

    this.userProfile = { name, age, gender, height, weight, calorieGoal, durationGoal, stepGoal };
    localStorage.setItem('he_user_profile', JSON.stringify(this.userProfile));
    
    this.navigateTo('home');
  }

  saveGoalsEdit(e) {
    e.preventDefault();

    if (!this.userProfile) return;

    const calorieGoal = parseInt(document.getElementById('edit-calorie-goal').value) || 500;
    const durationGoal = parseInt(document.getElementById('edit-duration-goal').value) || 60;
    const stepGoal = parseInt(document.getElementById('edit-step-goal').value) || 10000;

    this.userProfile.calorieGoal = calorieGoal;
    this.userProfile.durationGoal = durationGoal;
    this.userProfile.stepGoal = stepGoal;

    localStorage.setItem('he_user_profile', JSON.stringify(this.userProfile));

    // Hide Modal
    const modalEditGoals = document.getElementById('modal-edit-goals');
    if (modalEditGoals) {
      modalEditGoals.style.display = 'none';
    }

    // Refresh UI
    this.renderHome();
  }

  saveDirectWorkout(e) {
    e.preventDefault();

    const selectType = document.getElementById('select-exercise-type');
    const type = selectType.value;
    const selectedOption = selectType.options[selectType.selectedIndex];
    const unit = selectedOption.getAttribute('data-unit');
    const name = selectedOption.getAttribute('data-name');

    const duration = parseInt(document.getElementById('input-direct-duration').value);
    const intensity = document.getElementById('select-direct-intensity').value;
    let memo = document.getElementById('input-direct-memo').value || '기록 완료';

    let measurementValue = null;
    let measurementUnit = null;
    let reps = null;

    if (unit === '회') {
      const inputReps = document.getElementById('input-direct-reps');
      if (inputReps && inputReps.value !== '') {
        reps = parseInt(inputReps.value);
        measurementValue = reps;
        measurementUnit = '회';
        memo = `[체력측정] ${name}: ${reps} 회. ${memo}`;
      }
    } else if (unit && name) {
      const inputMeasure = document.getElementById('input-direct-measurement');
      if (inputMeasure && inputMeasure.value !== '') {
        measurementValue = parseFloat(inputMeasure.value);
        measurementUnit = unit;
        memo = `[체력측정] ${name}: ${measurementValue} ${unit}. ${memo}`;
      }
    }

    // Simple calorie estimation
    let calFactor = 3; // low
    if (intensity === 'medium') calFactor = 6;
    if (intensity === 'high') calFactor = 9;
    const calories = Math.round(duration * calFactor * (this.userProfile?.weight || 65) / 60);

    const now = new Date();
    const newLog = {
      id: Date.now(),
      type,
      duration,
      calories,
      intensity,
      memo,
      method: 'direct',
      measurementValue,
      measurementUnit,
      reps,
      date: now.toISOString().split('T')[0],
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };

    this.logs.push(newLog);
    localStorage.setItem('he_exercise_logs', JSON.stringify(this.logs));

    // Reset Form
    document.getElementById('form-direct-workout').reset();
    
    const measureGroup = document.getElementById('direct-measurement-group');
    if (measureGroup) measureGroup.style.display = 'none';

    const repsGroup = document.getElementById('direct-reps-group');
    if (repsGroup) repsGroup.style.display = 'none';

    this.navigateTo('home');
  }

  selectWorkoutPreset(preset) {
    if (preset === 'Squats') {
      this.navigateTo('camera-workout');
    } else if (preset === 'Walking') {
      this.navigateTo('auto-tracking');
    }
  }

  // Speak TTS (Audio feedback mockup)
  speakFeedback(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // cancel any active speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  // Camera Workout: good squat count
  handleCameraSquat() {
    this.cameraReps++;
    const score = Math.round(85 + Math.random() * 13); // 85-98 points
    this.cameraScores.push(score);

    this.updateCameraDisplay();
    
    // Animate SVG skeleton (simulate squatting bend)
    this.animateSkeleton(true);

    const statusMsg = document.getElementById('camera-status-msg');
    if (statusMsg) {
      statusMsg.textContent = "좋은 자세입니다! 그대로 반복하세요.";
      statusMsg.style.color = "var(--color-primary)";
    }

    // Voice count + positive feedback
    this.speakFeedback(`${this.cameraReps}회, 좋습니다!`);
  }

  // Camera Workout: bad squat count
  handleCameraBadSquat() {
    this.cameraReps++;
    const score = Math.round(50 + Math.random() * 20); // 50-70 points
    this.cameraScores.push(score);

    this.updateCameraDisplay();
    this.animateSkeleton(false); // different skeleton animation or just red pulse

    const statusMsg = document.getElementById('camera-status-msg');
    const warnings = [
      "허리가 둥글게 굽어있습니다. 곧게 펴주세요!",
      "무릎이 발끝보다 앞으로 쏠렸습니다. 엉덩이를 뒤로 빼세요!",
      "조금 더 일정한 속도로 내려가주세요."
    ];
    const warnText = warnings[Math.floor(Math.random() * warnings.length)];
    if (statusMsg) {
      statusMsg.textContent = warnText;
      statusMsg.style.color = "var(--color-accent)";
    }

    // Voice warning feedback
    this.speakFeedback(`${warnText}`);
  }

  animateSkeleton(isGood) {
    const leftHipKnee = document.getElementById('leg-left-hip-knee');
    const rightHipKnee = document.getElementById('leg-right-hip-knee');
    const leftKneeFoot = document.getElementById('leg-left-knee-foot');
    const rightKneeFoot = document.getElementById('leg-right-knee-foot');

    if (!leftHipKnee || !rightHipKnee || !leftKneeFoot || !rightKneeFoot) return;

    // Squatting state
    leftHipKnee.setAttribute('x2', '30');
    leftHipKnee.setAttribute('y2', '75');
    leftKneeFoot.setAttribute('x1', '30');
    leftKneeFoot.setAttribute('y1', '75');

    rightHipKnee.setAttribute('x2', '70');
    rightHipKnee.setAttribute('y2', '75');
    rightKneeFoot.setAttribute('x1', '70');
    rightKneeFoot.setAttribute('y1', '75');

    const color = isGood ? 'var(--color-primary)' : 'var(--color-accent)';
    [leftHipKnee, rightHipKnee, leftKneeFoot, rightKneeFoot].forEach(line => {
      line.style.stroke = color;
      line.style.transition = 'all 0.15s ease';
    });

    // Rise up state (after 300ms)
    setTimeout(() => {
      leftHipKnee.setAttribute('x2', '38');
      leftHipKnee.setAttribute('y2', '70');
      leftKneeFoot.setAttribute('x1', '38');
      leftKneeFoot.setAttribute('y1', '70');

      rightHipKnee.setAttribute('x2', '62');
      rightHipKnee.setAttribute('y2', '70');
      rightKneeFoot.setAttribute('x1', '62');
      rightKneeFoot.setAttribute('y1', '70');

      [leftHipKnee, rightHipKnee, leftKneeFoot, rightKneeFoot].forEach(line => {
        line.style.stroke = 'var(--color-primary)';
      });
    }, 400);
  }

  updateCameraDisplay() {
    const repCountEl = document.getElementById('camera-rep-count');
    const postureScoreEl = document.getElementById('camera-posture-score');
    const distanceEl = document.getElementById('camera-flexibility-distance');
    const selectedExercise = document.getElementById('select-camera-exercise')?.value;
    const isFlexibility = this.isCameraFlexibilityExercise(selectedExercise);
    const displayedDistance = selectedExercise === '서서 윗몸 앞으로 굽히기'
      ? this.cameraBestFlexibilityDistance
      : this.cameraFlexibilityDistance;

    if (repCountEl) {
      repCountEl.innerHTML = isFlexibility ? this.formatCameraElapsed() : `${this.cameraReps} <span style="font-size: 1rem;">회</span>`;
    }

    if (postureScoreEl) {
      if (isFlexibility && this.cameraLiveScore !== null) {
        postureScoreEl.innerHTML = `${this.cameraLiveScore} <span style="font-size: 1rem;">점</span>`;
      } else if (this.cameraScores.length > 0) {
        const avg = Math.round(this.cameraScores.reduce((a, b) => a + b, 0) / this.cameraScores.length);
        postureScoreEl.innerHTML = `${avg} <span style="font-size: 1rem;">점</span>`;
      } else {
        postureScoreEl.innerHTML = `-- <span style="font-size: 1rem;">점</span>`;
      }
    }

    if (distanceEl) {
      distanceEl.innerHTML = isFlexibility && displayedDistance !== null
        ? `${displayedDistance.toFixed(1)} <span style="font-size: 1rem;">cm</span>`
        : `-- <span style="font-size: 1rem;">cm</span>`;
    }
  }

  finishCameraWorkout() {
    const selectCameraEx = document.getElementById('select-camera-exercise');
    const workoutType = selectCameraEx ? selectCameraEx.value : "스쿼트";
    const isFlexibility = this.isCameraFlexibilityExercise(workoutType);

    if ((!isFlexibility && this.cameraReps === 0) || (isFlexibility && this.cameraScores.length === 0)) {
      alert(`적어도 1회 이상 ${workoutType}를 수행해야 저장됩니다!`);
      return;
    }

    const avgScore = Math.round(this.cameraScores.reduce((a, b) => a + b, 0) / this.cameraScores.length);
    const duration = isFlexibility ? Math.max(1, Math.ceil(this.getCameraElapsedSeconds() / 60)) : Math.ceil(this.cameraReps * 3.5 / 60);
    const calories = isFlexibility ? Math.max(1, Math.round(duration * 2.5)) : Math.round(this.cameraReps * 0.7);

    const now = new Date();
    const newLog = {
      id: Date.now(),
      type: workoutType,
      duration,
      calories,
      intensity: avgScore > 80 ? "medium" : "low",
      memo: isFlexibility ? `[카메라] ${workoutType} ${this.formatCameraElapsed()} 측정 완료. 바닥까지 최단 거리: ${this.cameraBestFlexibilityDistance?.toFixed(1) ?? '--'}cm, 손끝과 발끝 거리: ${this.cameraHandFootDistance?.toFixed(1) ?? '--'}cm, 평균 점수: ${avgScore}점.` : `[카메라] ${workoutType} ${this.cameraReps}회 완료. 평균 점수: ${avgScore}점.`,
      method: "camera",
      reps: this.cameraReps,
      postureScore: avgScore,
      measurementValue: isFlexibility && this.cameraBestFlexibilityDistance !== null ? Number(this.cameraBestFlexibilityDistance.toFixed(1)) : null,
      measurementUnit: isFlexibility ? 'cm' : null,
      handFootDistance: isFlexibility && this.cameraHandFootDistance !== null ? Number(this.cameraHandFootDistance.toFixed(1)) : null,
      date: now.toISOString().split('T')[0],
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };

    this.logs.push(newLog);
    localStorage.setItem('he_exercise_logs', JSON.stringify(this.logs));

    this.navigateTo('home');
  }

  getCameraElapsedSeconds() {
    return this.cameraStartedAt ? Math.max(0, Math.floor((Date.now() - this.cameraStartedAt) / 1000)) : 0;
  }

  formatCameraElapsed() {
    const seconds = this.getCameraElapsedSeconds();
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  startFlexibilityTimer() {
    if (!this.isCameraFlexibilityExercise(document.getElementById('select-camera-exercise')?.value)) return;
    this.cameraStartedAt = Date.now();
    if (this.cameraElapsedIntervalId) clearInterval(this.cameraElapsedIntervalId);
    this.cameraElapsedIntervalId = setInterval(() => this.updateCameraDisplay(), 1000);
    this.updateCameraDisplay();
  }

  isCameraFlexibilityExercise(exercise) {
    return exercise === '서서 윗몸 앞으로 굽히기';
  }

  async startWebcam() {
    const video = document.getElementById('webcam-video');
    if (!video) return;

    this.stopWebcam();
    const sessionId = ++this.cameraSessionId;
    const statusMsg = document.getElementById('camera-status-msg');

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      if (statusMsg) {
        statusMsg.textContent = '이 브라우저에서는 카메라를 사용할 수 없습니다. localhost 또는 HTTPS에서 열어주세요.';
        statusMsg.style.color = 'var(--color-accent)';
      }
      return;
    }

    try {
      if (statusMsg) statusMsg.textContent = '카메라 권한을 확인하는 중입니다...';

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: this.cameraFacingMode }
          },
          audio: false
        });
      } catch (error) {
        // Some desktop cameras reject facingMode/size constraints. Retry with
        // the browser's default camera before treating it as a permission error.
        if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw error;
        }
      }

      if (sessionId !== this.cameraSessionId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      this.webcamStream = stream;
      video.srcObject = stream;
      const skeletonCanvas = document.getElementById('skeleton-canvas');
      const cameraTransform = this.cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none';
      video.style.transform = cameraTransform;
      if (skeletonCanvas) skeletonCanvas.style.transform = cameraTransform;
      await video.play();
      this.startFlexibilityTimer();
      await this.requestWakeLock();

      if (statusMsg) {
        statusMsg.textContent = '카메라 연결 완료 · 움직임을 인식하는 중입니다.';
        statusMsg.style.color = 'var(--color-primary)';
      }

      this.startPoseAnalysis(sessionId);
    } catch (err) {
      console.error('Camera access error:', err);
      const messages = {
        NotAllowedError: '카메라 권한이 차단되었습니다. 주소창의 카메라 권한을 허용한 뒤 다시 선택해주세요.',
        NotReadableError: '카메라가 다른 앱에서 사용 중입니다. 다른 앱을 닫고 다시 시도해주세요.',
        AbortError: '카메라 연결이 중단되었습니다. 운동을 다시 선택해주세요.',
        NotFoundError: '사용 가능한 카메라를 찾지 못했습니다.'
      };
      if (statusMsg) {
        statusMsg.textContent = messages[err.name] || `카메라 연결 실패: ${err.message || '장치와 권한을 확인해주세요.'}`;
        statusMsg.style.color = 'var(--color-accent)';
      }
    }
  }

  async switchCamera() {
    this.cameraFacingMode = this.cameraFacingMode === 'user' ? 'environment' : 'user';
    const statusMsg = document.getElementById('camera-status-msg');
    if (statusMsg) {
      statusMsg.textContent = this.cameraFacingMode === 'user'
        ? '전면 카메라로 전환하는 중입니다...'
        : '후면 카메라로 전환하는 중입니다...';
    }
    if (this.webcamStream) await this.startWebcam();
  }

  async requestWakeLock() {
    if (!('wakeLock' in navigator) || this.wakeLock) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch (error) {
      console.info('Screen wake lock is unavailable.', error);
    }
  }

  registerMobileApp() {
    const canRegister = 'serviceWorker' in navigator &&
      (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));
    if (canRegister) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(error => {
          console.warn('Service worker registration failed:', error);
        });
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.webcamStream) this.requestWakeLock();
    });
  }

  async startPoseAnalysis(sessionId) {
    const statusMsg = document.getElementById('camera-status-msg');
    this.resetPoseExerciseState();

    try {
      if (statusMsg) {
        statusMsg.textContent = '전신 자세 인식 모델을 준비하는 중입니다...';
        statusMsg.style.color = 'var(--text-primary)';
      }

      if (!this.poseLandmarker) {
        const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs');
        const fileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
        const poseOptions = {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.6,
          minPosePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6
        };
        try {
          this.poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
            ...poseOptions,
            baseOptions: { ...poseOptions.baseOptions, delegate: 'GPU' }
          });
        } catch (gpuError) {
          console.warn('GPU pose detection unavailable; retrying on CPU.', gpuError);
          this.poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, poseOptions);
        }
      }

      if (sessionId !== this.cameraSessionId || !this.webcamStream) return;
      if (statusMsg) {
        statusMsg.textContent = '전신이 보이도록 카메라에서 조금 떨어져 주세요.';
        statusMsg.style.color = 'var(--color-secondary)';
      }
      this.poseLastVideoTime = -1;
      this.poseAnalysisIntervalId = setInterval(() => this.analyzePoseFrame(), 100);
    } catch (error) {
      console.error('Pose model initialization failed:', error);
      if (statusMsg) {
        statusMsg.textContent = '자세 인식 모델을 불러오지 못했습니다. 인터넷 연결 후 다시 시도해주세요.';
        statusMsg.style.color = 'var(--color-accent)';
      }
    }
  }

  analyzePoseFrame() {
    const video = document.getElementById('webcam-video');
    if (!video || !this.poseLandmarker || video.readyState < 2 || video.currentTime === this.poseLastVideoTime) return;

    this.poseLastVideoTime = video.currentTime;
    let result;
    try {
      result = this.poseLandmarker.detectForVideo(video, performance.now());
    } catch (error) {
      console.warn('Pose frame detection failed:', error);
      return;
    }

    const landmarks = result.landmarks?.[0];
    const statusMsg = document.getElementById('camera-status-msg');
    if (!landmarks) {
      this.fullBodyStableFrames = 0;
      this.resetPoseExerciseState(false);
      if (statusMsg) statusMsg.textContent = '사람을 찾지 못했습니다. 밝은 곳에서 전신을 보여주세요.';
      this.clearPoseCanvas();
      return;
    }

    this.drawLiveSkeleton(landmarks.map(point => [point.x * 320, point.y * 240]));
    const select = document.getElementById('select-camera-exercise');
    const exercise = select?.value || '스쿼트';
    const fullBodyCheck = this.checkFullBodyVisible(landmarks, exercise);
    if (!fullBodyCheck.visible) {
      this.fullBodyStableFrames = 0;
      this.resetPoseExerciseState(false);
      if (statusMsg) {
        statusMsg.textContent = fullBodyCheck.message;
        statusMsg.style.color = 'var(--color-accent)';
      }
      return;
    }

    this.fullBodyStableFrames++;
    if (this.fullBodyStableFrames < 2) {
      if (statusMsg) {
        statusMsg.textContent = `신체 확인 중... ${this.fullBodyStableFrames}/2`;
        statusMsg.style.color = 'var(--color-secondary)';
      }
      return;
    }

    this.evaluateExercisePose(exercise, landmarks);
  }

  checkFullBodyVisible(landmarks, exercise) {
    const groups = this.getRequiredPoseSideGroups(exercise);
    const isUsable = index => {
      const point = landmarks[index];
      return point && (point.visibility ?? 0) >= 0.22 && point.x >= -0.03 && point.x <= 1.03 && point.y >= -0.03 && point.y <= 1.03;
    };
    const leftVisible = groups.left.every(isUsable);
    const rightVisible = groups.right.every(isUsable);

    if (!leftVisible && !rightVisible) {
      this.poseVisibleSide = 'both';
      return { visible: false, message: `${exercise}에 필요한 한쪽 주요 관절이 보이도록 자세나 카메라 각도를 조정하세요.` };
    }

    this.poseVisibleSide = leftVisible && rightVisible ? 'both' : leftVisible ? 'left' : 'right';
    const required = this.poseVisibleSide === 'both'
      ? [...new Set([...groups.left, ...groups.right])]
      : groups[this.poseVisibleSide];
    const visiblePoints = required.map(index => landmarks[index]);
    const xs = visiblePoints.map(point => point.x);
    const ys = visiblePoints.map(point => point.y);
    const bodyWidth = Math.max(...xs) - Math.min(...xs);
    const bodyHeight = Math.max(...ys) - Math.min(...ys);
    if (Math.max(bodyWidth, bodyHeight) < 0.2) {
      return { visible: false, message: `${exercise}에 필요한 주요 부위가 너무 작게 보입니다. 카메라 위치를 조정하세요.` };
    }
    return { visible: true, message: '' };
  }

  getRequiredPoseSideGroups(exercise) {
    const upperBody = { left: [11, 13, 15, 23], right: [12, 14, 16, 24] };
    const lowerBody = { left: [11, 23, 25, 27], right: [12, 24, 26, 28] };
    const flexibility = { left: [11, 23, 25, 27, 19, 31], right: [12, 24, 26, 28, 20, 32] };
    const pushUp = { left: [11, 13, 15, 23, 27], right: [12, 14, 16, 24, 28] };
    const crunch = { left: [11, 23, 25], right: [12, 24, 26] };
    if (['바이셉 컬', '레터럴 레이즈', '오버헤드 프레스'].includes(exercise)) return upperBody;
    if (exercise === '팔굽혀펴기') return pushUp;
    if (exercise === '크런치') return crunch;
    if (this.isCameraFlexibilityExercise(exercise)) return flexibility;
    return lowerBody;
  }

  getRequiredPoseLandmarks(exercise) {
    const requiredByExercise = {
      '바이셉 컬': [11, 12, 13, 14, 15, 16, 23, 24],
      '레터럴 레이즈': [11, 12, 13, 14, 15, 16, 23, 24],
      '오버헤드 프레스': [11, 12, 13, 14, 15, 16, 23, 24],
      '스쿼트': [11, 12, 23, 24, 25, 26, 27, 28],
      '팔굽혀펴기': [11, 12, 13, 14, 15, 16, 23, 24, 27, 28],
      '윗몸일으키기': [11, 12, 23, 24, 25, 26, 27, 28],
      '레그레이즈': [11, 12, 23, 24, 25, 26, 27, 28],
      '니 레이즈': [11, 12, 23, 24, 25, 26, 27, 28],
      '니 프레스': [11, 12, 23, 24, 25, 26, 27, 28],
      '크런치': [11, 12, 23, 24, 25, 26],
      '서서 윗몸 앞으로 굽히기': [11, 12, 23, 24, 25, 26, 27, 28, 19, 20, 31, 32]
    };
    return requiredByExercise[exercise] || requiredByExercise['스쿼트'];
  }

  evaluateExercisePose(exercise, p) {
    if (this.isCameraFlexibilityExercise(exercise)) {
      this.evaluateFlexibilityPose(p);
      return;
    }
    const angle = (a, b, c) => this.calculateJointAngle(p[a], p[b], p[c]);
    const sideValue = (left, right) => this.poseVisibleSide === 'left'
      ? left
      : this.poseVisibleSide === 'right' ? right : (left + right) / 2;
    const leftKnee = angle(23, 25, 27);
    const rightKnee = angle(24, 26, 28);
    const leftHip = angle(11, 23, 25);
    const rightHip = angle(12, 24, 26);
    const knee = sideValue(leftKnee, rightKnee);
    const hip = sideValue(leftHip, rightHip);
    const elbow = sideValue(angle(11, 13, 15), angle(12, 14, 16));
    const shoulder = sideValue(angle(23, 11, 13), angle(24, 12, 14));
    const bodyLine = sideValue(angle(11, 23, 27), angle(12, 24, 28));
    const shoulderPoint = this.poseVisibleSide === 'right' ? p[12] : p[11];
    const anklePoint = this.poseVisibleSide === 'right' ? p[28] : p[27];
    const wristsAboveShoulders = this.poseVisibleSide === 'left'
      ? p[15].y < p[11].y
      : this.poseVisibleSide === 'right'
        ? p[16].y < p[12].y
        : p[15].y < p[11].y && p[16].y < p[12].y;
    const symmetry = this.poseVisibleSide === 'both' ? Math.abs(leftKnee - rightKnee) : 0;
    const torsoOffset = sideValue(Math.abs(p[11].x - p[23].x), Math.abs(p[12].x - p[24].x));
    let start = false;
    let end = false;
    let postureValid = false;
    let cue = '시작 자세를 잡아주세요.';
    let formScore = 85;

    switch (exercise) {
      case '바이셉 컬':
        start = elbow > 115 && shoulder < 70;
        end = elbow < 105 && shoulder < 75;
        postureValid = shoulder < 85;
        cue = '팔꿈치를 몸통 옆에 고정하고 양팔을 함께 굽히세요.';
        formScore = 96 - Math.max(0, shoulder - 20) * 0.5;
        break;
      case '레터럴 레이즈':
        start = shoulder < 55 && elbow > 110;
        end = shoulder > 45 && shoulder < 140 && elbow > 110;
        postureValid = elbow > 105;
        cue = '팔꿈치를 편 채 양팔을 어깨 높이까지만 올리세요.';
        formScore = 96 - Math.abs(90 - shoulder) * 0.25;
        break;
      case '오버헤드 프레스':
        start = elbow > 25 && elbow < 145 && !wristsAboveShoulders;
        end = elbow > 125 && wristsAboveShoulders;
        postureValid = torsoOffset < 0.35;
        cue = '몸통을 세우고 양손을 머리 위로 끝까지 밀어 올리세요.';
        formScore = 96 - Math.max(0, 170 - elbow) * 0.25;
        break;
      case '팔굽혀펴기': {
        const horizontal = Math.abs(shoulderPoint.y - anklePoint.y) < 0.42;
        start = elbow > 120 && bodyLine > 130 && horizontal;
        end = elbow > 35 && elbow < 125 && bodyLine > 125 && horizontal;
        postureValid = bodyLine > 120 && horizontal;
        cue = '머리부터 발목까지 일직선을 유지하며 가슴을 낮추세요.';
        formScore = 96 - Math.max(0, 175 - bodyLine) * 0.6;
        break;
      }
      case '윗몸일으키기':
        start = hip > 115 && knee > 30 && knee < 170;
        end = hip > 30 && hip < 135 && knee > 30 && knee < 170;
        postureValid = knee > 20 && knee < 178;
        cue = '무릎을 고정하고 상체 전체를 골반 쪽으로 일으키세요.';
        formScore = 94 - symmetry * 0.3;
        break;
      case '레그레이즈':
        start = hip > 115 && knee > 120;
        end = hip > 30 && hip < 135 && knee > 115;
        postureValid = knee > 110;
        cue = '양 무릎을 편 채 다리를 함께 들어 올리세요.';
        formScore = 96 - Math.max(0, 170 - knee) * 0.5;
        break;
      case '니 레이즈':
        start = hip > 120 && knee > 120;
        end = hip < 125 && knee < 145;
        postureValid = this.poseVisibleSide !== 'both' || Math.abs(leftHip - rightHip) < 65;
        cue = '양 무릎을 함께 굽혀 골반 높이까지 당기세요.';
        formScore = 94 - symmetry * 0.3;
        break;
      case '니 프레스':
        start = hip < 135 && knee < 145;
        end = hip > 120 && knee > 130;
        postureValid = symmetry < 60;
        cue = '양 무릎을 가슴 쪽에서 시작해 같은 속도로 끝까지 펴세요.';
        formScore = 95 - symmetry * 0.4;
        break;
      case '크런치':
        start = hip > 120 && knee > 30 && knee < 170;
        end = hip > 55 && hip < 125 && knee > 30 && knee < 170;
        postureValid = knee > 20 && knee < 178;
        cue = '허리를 과하게 들지 말고 어깨뼈만 바닥에서 들어 올리세요.';
        formScore = 92 - symmetry * 0.25;
        break;
      case '스쿼트':
      default:
        start = knee > 125 && hip > 115;
        end = knee > 45 && knee < 145 && hip > 25 && hip < 155;
        postureValid = knee > 25 && hip > 15 && symmetry < 65;
        cue = '양 무릎 높이를 맞추고 엉덩이를 뒤로 내려 허벅지가 충분히 낮아지게 하세요.';
        formScore = 96 - symmetry * 0.5 - Math.abs(92 - knee) * 0.12;
        break;
    }

    const statusMsg = document.getElementById('camera-status-msg');
    if (!postureValid) {
      this.poseInvalidFrames++;
      this.poseStableFrames = 0;
      if (this.poseInvalidFrames >= 8) this.resetPoseExerciseState(false);
      if (statusMsg) {
        statusMsg.textContent = `자세를 교정하세요 · ${cue}`;
        statusMsg.style.color = 'var(--color-accent)';
      }
      return;
    }

    this.poseInvalidFrames = 0;
    const targetReached = this.posePhase === 'waitingStart' ? start : end;
    this.poseStableFrames = targetReached ? this.poseStableFrames + 1 : 0;

    if (this.posePhase === 'waitingStart') {
      if (this.poseStableFrames >= 2) {
        this.posePhase = 'waitingEnd';
        this.poseStableFrames = 0;
        this.poseRepStartedAt = Date.now();
      }
      if (statusMsg) {
        statusMsg.textContent = start ? '시작 자세 확인 · 동작을 진행하세요.' : cue;
        statusMsg.style.color = start ? 'var(--color-secondary)' : 'var(--text-primary)';
      }
      return;
    }

    if (Date.now() - this.poseRepStartedAt > 8000) {
      this.resetPoseExerciseState(false);
      if (statusMsg) statusMsg.textContent = `동작 시간이 너무 깁니다. ${cue}`;
      return;
    }

    if (this.poseStableFrames >= 2) {
      this.cameraReps++;
      this.cameraScores.push(Math.max(60, Math.min(98, Math.round(formScore))));
      this.updateCameraDisplay();
      this.speakFeedback(`${this.cameraReps}회`);
      this.posePhase = 'waitingStart';
      this.poseStableFrames = 0;
      if (statusMsg) {
        statusMsg.textContent = `${this.cameraReps}회 성공 · 시작 자세로 돌아가세요.`;
        statusMsg.style.color = 'var(--color-primary)';
      }
    } else if (statusMsg) {
      statusMsg.textContent = end ? '끝 자세 확인 중...' : cue;
      statusMsg.style.color = 'var(--text-primary)';
    }
  }

  evaluateFlexibilityPose(p) {
    const pick = (left, right) => this.poseVisibleSide === 'left' ? left : this.poseVisibleSide === 'right' ? right : (left + right) / 2;
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const leftFinger = p[19] || p[15];
    const rightFinger = p[20] || p[16];
    const leftToe = p[31] || p[27];
    const rightToe = p[32] || p[28];
    const fingertipDistance = pick(distance(leftFinger, leftToe), distance(rightFinger, rightToe));
    const bodyLength = pick(distance(p[11], p[27]), distance(p[12], p[28]));
    const fingerY = pick(leftFinger.y, rightFinger.y);
    const floorY = pick(Math.max(leftToe.y, p[27].y), Math.max(rightToe.y, p[28].y));
    const shoulderY = pick(p[11].y, p[12].y);
    const noseVisible = p[0] && (p[0].visibility ?? 0) >= 0.2;
    const estimatedHeadY = noseVisible ? p[0].y : shoulderY - Math.max(0.04, (floorY - shoulderY) * 0.18);
    const visibleBodyHeight = Math.max(0.25, floorY - estimatedHeadY);
    const userHeightCm = Number(this.userProfile?.height) || 165;
    const cmPerFrameUnit = Math.max(100, Math.min(500, userHeightCm / visibleBodyHeight));
    const floorGapCm = Math.max(0, floorY - fingerY) * cmPerFrameUnit;
    const handFootDistanceCm = fingertipDistance * cmPerFrameUnit;
    const kneeAngle = pick(this.calculateJointAngle(p[23], p[25], p[27]), this.calculateJointAngle(p[24], p[26], p[28]));
    const hipAngle = pick(this.calculateJointAngle(p[11], p[23], p[25]), this.calculateJointAngle(p[12], p[24], p[26]));
    const normalizedDistance = fingertipDistance / Math.max(bodyLength, 0.1);
    const reachScore = Math.max(0, Math.min(100, 100 - floorGapCm * 3.5));
    const kneeScore = Math.max(0, Math.min(100, 100 - Math.max(0, 150 - kneeAngle) * 1.2));
    const hingeScore = Math.max(0, Math.min(100, 100 - Math.max(0, hipAngle - 115) * 0.9));
    const score = Math.round(reachScore * 0.7 + kneeScore * 0.15 + hingeScore * 0.15);
    const statusMsg = document.getElementById('camera-status-msg');

    this.cameraLiveScore = score;
    this.cameraFlexibilityDistance = floorGapCm;
    this.cameraHandFootDistance = handFootDistanceCm;
    this.cameraBestFlexibilityDistance = this.cameraBestFlexibilityDistance === null
      ? floorGapCm
      : Math.min(this.cameraBestFlexibilityDistance, floorGapCm);
    this.cameraScores.push(score);
    if (this.cameraScores.length > 300) this.cameraScores.shift();
    this.updateCameraDisplay();

    if (statusMsg) {
      const selectedExercise = document.getElementById('select-camera-exercise')?.value;
      const minimumText = selectedExercise === '서서 윗몸 앞으로 굽히기'
        ? ` · 최솟값 ${this.cameraBestFlexibilityDistance.toFixed(1)}cm`
        : '';
      if (floorGapCm < 8 && kneeAngle > 150) {
        statusMsg.textContent = `아주 좋습니다 · 현재 ${floorGapCm.toFixed(1)}cm${minimumText} · 손끝-발끝 ${handFootDistanceCm.toFixed(1)}cm`;
        statusMsg.style.color = 'var(--color-primary)';
      } else {
        statusMsg.textContent = `현재 바닥 거리 ${floorGapCm.toFixed(1)}cm${minimumText} · 손끝-발끝 ${handFootDistanceCm.toFixed(1)}cm`;
        statusMsg.style.color = 'var(--text-primary)';
      }
    }

    this.drawFlexibilityDistanceLine(p, floorY, floorGapCm);
  }

  drawFlexibilityDistanceLine(p, floorY, floorGapCm) {
    const canvas = document.getElementById('skeleton-canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const finger = this.poseVisibleSide === 'right' ? (p[20] || p[16]) : (p[19] || p[15]);
    if (!finger) return;

    const x = finger.x * canvas.width;
    const handY = finger.y * canvas.height;
    const groundY = floorY * canvas.height;
    ctx.save();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x, handY);
    ctx.lineTo(x, groundY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(Math.max(0, x - 25), groundY);
    ctx.lineTo(Math.min(canvas.width, x + 25), groundY);
    ctx.stroke();
    ctx.restore();
  }

  calculateJointAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let degrees = Math.abs(radians * 180 / Math.PI);
    if (degrees > 180) degrees = 360 - degrees;
    return degrees;
  }

  resetPoseExerciseState(resetFullBody = true) {
    this.posePhase = 'waitingStart';
    this.poseStableFrames = 0;
    this.poseInvalidFrames = 0;
    this.poseRepStartedAt = 0;
    if (resetFullBody) this.fullBodyStableFrames = 0;
  }

  clearPoseCanvas() {
    const canvas = document.getElementById('skeleton-canvas');
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  connectPoseServer(sessionId) {
    const selectCameraEx = document.getElementById('select-camera-exercise');
    const activeEx = selectCameraEx ? selectCameraEx.value : '스쿼트';
    let opened = false;

    try {
      this.cameraSocket = new WebSocket('ws://127.0.0.1:8765');
    } catch (error) {
      console.warn('AI Pose Server unavailable; using local motion detection.', error);
      this.startLocalMotionAnalysis();
      return;
    }

    const fallbackTimer = setTimeout(() => {
      if (!opened && sessionId === this.cameraSessionId) this.startLocalMotionAnalysis();
    }, 1200);

    this.cameraSocket.onopen = () => {
      if (sessionId !== this.cameraSessionId) return;
      opened = true;
      clearTimeout(fallbackTimer);
      this.stopLocalMotionAnalysis();
      this.cameraSocket.send(`reset:${activeEx}`);
      this.frameIntervalId = setInterval(() => this.sendFrameLoop(), 100);
    };

    this.cameraSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.status === "reset_done") {
              console.log("Pose server reset confirmed for exercise:", data.exercise);
              return;
            }

            // Update rep count
            if (typeof data.counter === 'number') {
              if (data.counter > this.cameraReps) {
                this.speakFeedback(`${data.counter}회!`);
              }
              this.cameraReps = data.counter;
            }

            // Update posture score
            if (typeof data.posture_score === 'number') {
              this.cameraScores.push(data.posture_score);
            }

            // Update UI display
            this.updateCameraDisplay();

            // Update status text based on stage
            const statusMsg = document.getElementById('camera-status-msg');
            if (statusMsg) {
              if (data.stage === "down") {
                statusMsg.textContent = "최대로 구부렸습니다! 일어나세요.";
                statusMsg.style.color = "var(--color-secondary)";
              } else if (data.stage === "up") {
                statusMsg.textContent = "좋은 자세입니다! 다시 진행하세요.";
                statusMsg.style.color = "var(--color-primary)";
              } else {
                statusMsg.textContent = "정확한 궤적으로 동작을 계속하세요.";
                statusMsg.style.color = "var(--text-primary)";
              }
            }

            // Draw skeleton joints on canvas overlay
            if (data.keypoints) {
              this.drawLiveSkeleton(data.keypoints);
            }
          } catch (e) {
            console.error('Error reading WebSocket message:', e);
          }
    };

    this.cameraSocket.onerror = () => {
      if (sessionId === this.cameraSessionId) this.startLocalMotionAnalysis();
    };

    this.cameraSocket.onclose = () => {
      clearTimeout(fallbackTimer);
      if (this.frameIntervalId) {
        clearInterval(this.frameIntervalId);
        this.frameIntervalId = null;
      }
      if (sessionId === this.cameraSessionId && this.webcamStream) {
        this.startLocalMotionAnalysis();
      }
    };
  }

  startLocalMotionAnalysis() {
    if (this.localMotionIntervalId || !this.webcamStream) return;

    const statusMsg = document.getElementById('camera-status-msg');
    if (statusMsg) {
      statusMsg.textContent = '로컬 동작 감지 모드 · 한 동작마다 잠깐 멈춰주세요.';
      statusMsg.style.color = 'var(--color-secondary)';
    }

    this.previousMotionFrame = null;
    this.motionPhase = 'idle';
    this.motionPeak = 0;
    this.localMotionIntervalId = setInterval(() => this.analyzeLocalMotionFrame(), 140);
  }

  stopLocalMotionAnalysis() {
    if (this.localMotionIntervalId) {
      clearInterval(this.localMotionIntervalId);
      this.localMotionIntervalId = null;
    }
    this.previousMotionFrame = null;
    this.motionPhase = 'idle';
    this.motionPeak = 0;
  }

  analyzeLocalMotionFrame() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('processing-canvas');
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const sample = new Uint8Array((canvas.width / 8) * (canvas.height / 8));
    let sampleIndex = 0;

    for (let y = 0; y < canvas.height; y += 8) {
      for (let x = 0; x < canvas.width; x += 8) {
        const index = (y * canvas.width + x) * 4;
        sample[sampleIndex++] = Math.round(
          pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
        );
      }
    }

    if (!this.previousMotionFrame) {
      this.previousMotionFrame = sample;
      return;
    }

    let difference = 0;
    for (let i = 0; i < sample.length; i++) {
      difference += Math.abs(sample[i] - this.previousMotionFrame[i]);
    }
    this.previousMotionFrame = sample;
    const motion = difference / sample.length;
    const now = Date.now();

    if (this.motionPhase === 'idle' && motion > 8.5 && now - this.lastMotionRepAt > 700) {
      this.motionPhase = 'moving';
      this.motionStartedAt = now;
      this.motionPeak = motion;
    } else if (this.motionPhase === 'moving') {
      this.motionPeak = Math.max(this.motionPeak, motion);
      const longEnough = now - this.motionStartedAt > 300;
      const timedOut = now - this.motionStartedAt > 2500;

      if ((longEnough && motion < 4.5) || timedOut) {
        this.cameraReps++;
        const score = Math.max(60, Math.min(95, Math.round(68 + this.motionPeak * 1.5)));
        this.cameraScores.push(score);
        this.lastMotionRepAt = now;
        this.motionPhase = 'idle';
        this.motionPeak = 0;
        this.updateCameraDisplay();
        this.speakFeedback(`${this.cameraReps}회`);

        const statusMsg = document.getElementById('camera-status-msg');
        if (statusMsg) statusMsg.textContent = `${this.cameraReps}회 인식 · 다음 동작을 시작하세요.`;
      }
    }
  }

  sendFrameLoop() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('processing-canvas');
    if (!video || !canvas || !this.cameraSocket || this.cameraSocket.readyState !== WebSocket.OPEN) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to hidden canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas content to JPEG blob and send as binary
    canvas.toBlob(blob => {
      if (blob && this.cameraSocket && this.cameraSocket.readyState === WebSocket.OPEN) {
        this.cameraSocket.send(blob);
      }
    }, 'image/jpeg', 0.7);
  }

  drawLiveSkeleton(keypoints) {
    const canvas = document.getElementById('skeleton-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!keypoints || keypoints.length === 0) return;

    const connections = [
      [0, 1], [0, 2], [1, 3], [2, 4], // face
      [5, 6], [5, 11], [6, 12], [11, 12], // torso
      [5, 7], [7, 9], [6, 8], [8, 10], // arms
      [11, 13], [13, 15], [12, 14], [14, 16] // legs
    ];

    const scaleX = canvas.width / 320;
    const scaleY = canvas.height / 240;

    // Draw bones
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#059669';

    connections.forEach(([p1, p2]) => {
      const pt1 = keypoints[p1];
      const pt2 = keypoints[p2];

      if (pt1 && pt2 && pt1[0] !== 0 && pt1[1] !== 0 && pt2[0] !== 0 && pt2[1] !== 0) {
        ctx.beginPath();
        ctx.moveTo(pt1[0] * scaleX, pt1[1] * scaleY);
        ctx.lineTo(pt2[0] * scaleX, pt2[1] * scaleY);
        ctx.stroke();
      }
    });

    // Draw joints
    ctx.shadowBlur = 0;
    const selectedExercise = document.getElementById('select-camera-exercise')?.value || '스쿼트';
    const sideGroups = this.getRequiredPoseSideGroups(selectedExercise);
    const highlightedIndexes = this.poseVisibleSide === 'both'
      ? [...new Set([...sideGroups.left, ...sideGroups.right])]
      : sideGroups[this.poseVisibleSide];
    const requiredPoints = new Set(highlightedIndexes);
    keypoints.forEach((pt, index) => {
      if (pt && pt[0] !== 0 && pt[1] !== 0) {
        const isRequired = requiredPoints.has(index);
        ctx.fillStyle = isRequired ? '#3B82F6' : '#34D399';
        ctx.shadowBlur = isRequired ? 8 : 0;
        ctx.shadowColor = '#2563EB';
        ctx.beginPath();
        ctx.arc(pt[0] * scaleX, pt[1] * scaleY, isRequired ? 7 : 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
  }

  stopWebcam() {
    this.cameraSessionId++;

    if (this.cameraElapsedIntervalId) {
      clearInterval(this.cameraElapsedIntervalId);
      this.cameraElapsedIntervalId = null;
    }

    if (this.poseAnalysisIntervalId) {
      clearInterval(this.poseAnalysisIntervalId);
      this.poseAnalysisIntervalId = null;
    }
    this.resetPoseExerciseState();

    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }

    if (this.frameIntervalId) {
      clearInterval(this.frameIntervalId);
      this.frameIntervalId = null;
    }

    this.stopLocalMotionAnalysis();

    if (this.cameraSocket) {
      this.cameraSocket.close();
      this.cameraSocket = null;
    }

    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }

    const video = document.getElementById('webcam-video');
    if (video) video.srcObject = null;

    const canvas = document.getElementById('skeleton-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Auto Tracking
  async toggleSensorTracking() {
    const btn = document.getElementById('btn-sensor-toggle');
    const statusMsg = document.getElementById('auto-tracking-status');
    const selectAutoEx = document.getElementById('select-auto-exercise');

    if (!btn) return;

    if (window.sensorSimulator.isTracking) {
      // Pause
      window.sensorSimulator.stop();
      btn.textContent = "계속";
      btn.style.background = "var(--color-primary)";
      if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-pause"></i> 일시 정지됨';
      this.speakFeedback("측정이 일시정지되었습니다.");
    } else {
      // Start: 사용자가 버튼을 누른 시점에만 센서 권한 요청 및 측정이 시작됨
      const exerciseName = selectAutoEx ? selectAutoEx.value : '';

      btn.disabled = true;
      btn.textContent = "센서 준비 중...";
      if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> 센서 권한 확인 중...';

      await window.sensorSimulator.start(this.handleSensorUpdate, exerciseName);

      btn.disabled = false;
      btn.textContent = "일시 정지";
      btn.style.background = "var(--color-warning)";

      const data = window.sensorSimulator.getData();

      if (data.sensorUnavailable) {
        window.sensorSimulator.stop();
        btn.textContent = "다시 시도";
        btn.style.background = "var(--color-primary)";
        if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 스마트폰 움직임 센서 권한이 필요합니다';
        this.speakFeedback("달리기 측정을 위해 스마트폰 움직임 센서 권한을 허용해주세요.");
      } else if (data.runningShakeMode) {
        if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> 스마트폰 흔들림으로 달리기 걸음을 측정 중...';
        this.speakFeedback("스마트폰 흔들림으로 달리기 측정을 시작합니다.");
      } else if (data.simulationFallback) {
        if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 센서를 사용할 수 없어 시뮬레이션으로 진행합니다';
        this.speakFeedback("기기 센서를 사용할 수 없어 시뮬레이션으로 측정을 시작합니다.");
      } else if (data.realGPSActive) {
        if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> GPS와 가속도 센서로 실시간 측정 중...';
        this.speakFeedback("GPS와 가속도 센서로 측정을 시작합니다.");
      } else {
        if (statusMsg) statusMsg.innerHTML = '<i class="fa-solid fa-person-running"></i> 가속도 센서로 실시간 측정 중...';
        this.speakFeedback("측정을 시작합니다.");
      }
    }
  }

  handleSensorUpdate(data) {
    // Format duration
    const min = String(Math.floor(data.duration / 60)).padStart(2, '0');
    const sec = String(data.duration % 60).padStart(2, '0');

    const selectAutoEx = document.getElementById('select-auto-exercise');
    const workoutType = selectAutoEx ? selectAutoEx.value : "수행";
    
    document.getElementById('auto-duration').textContent = `${min}:${sec}`;
    document.getElementById('auto-steps').textContent = data.runningShakeMode
      ? `${data.steps.toLocaleString()} 걸음`
      : `${data.steps.toLocaleString()} 회`;
    document.getElementById('auto-distance').textContent = `${data.distance} km`;
    document.getElementById('auto-calories').textContent = `${data.calories} kcal`;
    document.getElementById('auto-speed').innerHTML = `${data.speed} <span style="font-size: 1rem; font-weight: 500; color: var(--text-secondary);">km/h</span>`;
  }

  finishAutoWorkout() {
    const selectAutoEx = document.getElementById('select-auto-exercise');
    const workoutType = selectAutoEx ? selectAutoEx.value : "스쿼트";

    const data = window.sensorSimulator.getData();
    window.sensorSimulator.stop();
    window.sensorSimulator.reset();

    // Enable button styles resets
    const toggleBtn = document.getElementById('btn-sensor-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = "시작";
      toggleBtn.style.background = "var(--color-primary)";
    }
    if (data.duration < 5 && data.steps < 10) {
      alert("기록할 데이터가 충분하지 않습니다 (최소 5초 이상 작동).");
      this.navigateTo('choose-workout');
      return;
    }

    const durationMin = Math.ceil(data.duration / 60);
    const now = new Date();
    const newLog = {
      id: Date.now(),
      type: workoutType,
      duration: durationMin,
      calories: data.calories,
      steps: data.steps,
      distance: data.distance,
      intensity: data.speedMultiplier > 1.5 ? "high" : "medium",
      memo: `실시간 자동 측정 완료: ${workoutType} 동작을 약 ${data.steps}회 수행하였으며, ${data.distance}km 수준의 열량을 소비했습니다.`,
      method: "auto",
      date: now.toISOString().split('T')[0],
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };

    this.logs.push(newLog);
    localStorage.setItem('he_exercise_logs', JSON.stringify(this.logs));

    this.navigateTo('home');
  }

  // Calculate Health Energy based on logs and streak
  calculateHealthEnergy() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Base starter points
    let score = 30; 

    // 2. Add points from today's workouts
    const todayLogs = this.logs.filter(log => log.date === todayStr);
    let todayWorkoutDuration = 0;
    let cameraScoreSum = 0;
    let cameraScoreCount = 0;

    todayLogs.forEach(log => {
      todayWorkoutDuration += log.duration;
      
      // Calories contribution
      score += Math.round(log.calories * 0.15);

      // Duration contribution based on intensity
      let durationFactor = 1.0;
      if (log.intensity === 'medium') durationFactor = 1.5;
      if (log.intensity === 'high') durationFactor = 2.5;
      score += Math.round(log.duration * durationFactor);

      // Posture contribution
      if (log.method === 'camera' && log.postureScore) {
        cameraScoreSum += log.postureScore;
        cameraScoreCount++;
      }
    });

    // 3. Add points from steps (auto tracking step count)
    let totalStepsToday = 0;
    todayLogs.forEach(log => {
      if (log.steps) {
        totalStepsToday += log.steps;
      }
    });

    const stepGoal = this.userProfile?.stepGoal || 10000;
    const stepRatio = Math.min(1.0, totalStepsToday / stepGoal);
    score += Math.round(stepRatio * 20); // max 20 points from steps

    // 4. Streak bonus
    const streak = this.calculateStreak();
    if (streak > 0) {
      if (streak <= 2) score += 8;
      else if (streak <= 5) score += 16;
      else score += 30; // Max streak bonus
    }

    // 5. Posture average check
    if (cameraScoreCount > 0) {
      const avgPosture = cameraScoreSum / cameraScoreCount;
      if (avgPosture >= 88) score += 10;
      else if (avgPosture < 70) score -= 15;
    }

    // Cap score at 100, min 0
    return Math.max(0, Math.min(100, score));
  }

  calculateStreak() {
    if (this.logs.length === 0) return 0;

    const uniqueDates = [...new Set(this.logs.map(log => log.date))].sort().reverse();
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Check if user has logs today or yesterday
    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
      return 0;
    }

    let streak = 0;
    let checkDate = new Date();

    while (true) {
      const checkStr = checkDate.toISOString().split('T')[0];
      if (uniqueDates.includes(checkStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1); // move back
      } else {
        // If we checked today and they haven't exercised today, keep going to check yesterday
        if (checkStr === todayStr) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    return streak;
  }

  // Dynamically update elements inside active screens
  updateUI() {
    // Hide all screens, show active one
    document.querySelectorAll('.app-screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const activeEl = document.getElementById(`screen-${this.activeScreen}`);
    if (activeEl) {
      activeEl.classList.add('active');
    }

    // Show/Hide top header and bottom nav based on activeScreen
    const appHeader = document.getElementById('app-header');
    const appNavbar = document.getElementById('app-navbar');
    const fabAdd = document.getElementById('fab-add-workout');

    if (this.activeScreen === 'onboarding') {
      if (appHeader) appHeader.style.display = 'none';
      if (appNavbar) appNavbar.style.display = 'none';
      if (fabAdd) fabAdd.style.display = 'none';
    } else {
      if (appHeader) appHeader.style.display = 'flex';
      if (appNavbar) appNavbar.style.display = 'flex';
      
      // Floating button shows everywhere except during active workouts and choices
      if (['choose-workout', 'camera-workout', 'auto-tracking', 'direct-input'].includes(this.activeScreen)) {
        if (fabAdd) fabAdd.style.display = 'none';
      } else {
        if (fabAdd) fabAdd.style.display = 'flex';
      }

      // Update Navigation active tab
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      const navItem = document.getElementById(`nav-${this.activeScreen === 'choose-workout' || this.activeScreen === 'camera-workout' || this.activeScreen === 'auto-tracking' || this.activeScreen === 'direct-input' ? 'choose' : this.activeScreen}`);
      if (navItem) {
        navItem.classList.add('active');
      }
    }

    // Update screen specific contents
    if (this.activeScreen === 'home') {
      this.renderHome();
    } else if (this.activeScreen === 'timeline') {
      this.renderTimeline();
    } else if (this.activeScreen === 'report') {
      this.renderReports();
    } else if (this.activeScreen === 'recommendation') {
      this.renderRecommendation();
    }
  }

  navigateHomeDate(offset) {
    const todayStr = new Date().toISOString().split('T')[0];
    const uniqueDates = [...new Set(this.logs.map(log => log.date))].sort(); // ascending: old to new
    
    if (!uniqueDates.includes(todayStr)) {
      uniqueDates.push(todayStr);
      uniqueDates.sort();
    }

    const currentDateStr = this.selectedHomeDate === 'today' ? todayStr : this.selectedHomeDate;
    let currentIndex = uniqueDates.indexOf(currentDateStr);
    
    if (currentIndex === -1) currentIndex = uniqueDates.length - 1;

    const newIndex = currentIndex + offset;
    if (newIndex >= 0 && newIndex < uniqueDates.length) {
      const newDateStr = uniqueDates[newIndex];
      this.selectedHomeDate = newDateStr === todayStr ? 'today' : newDateStr;
      this.renderHome();
    }
  }

  renderHome() {
    if (!this.userProfile) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateStr = this.selectedHomeDate === 'today' ? todayStr : this.selectedHomeDate;

    // 1. Update Arrow Navigation state and label inside the Card
    const uniqueDates = [...new Set(this.logs.map(log => log.date))].sort(); // ascending
    if (!uniqueDates.includes(todayStr)) {
      uniqueDates.push(todayStr);
      uniqueDates.sort();
    }

    const currentIndex = uniqueDates.indexOf(targetDateStr);

    const btnHomePrev = document.getElementById('btn-home-prev-date');
    const btnHomeNext = document.getElementById('btn-home-next-date');
    const labelEl = document.getElementById('home-selected-date-label');

    if (btnHomePrev) btnHomePrev.disabled = currentIndex >= uniqueDates.length - 1;
    if (btnHomeNext) btnHomeNext.disabled = currentIndex <= 0;

    if (labelEl) {
      if (targetDateStr === todayStr) {
        labelEl.textContent = '오늘';
      } else {
        const parts = targetDateStr.split('-');
        if (parts.length === 3) {
          labelEl.textContent = `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
        } else {
          labelEl.textContent = targetDateStr;
        }
      }
    }

    // Welcome text
    document.getElementById('user-display-name').textContent = this.userProfile.name;

    // Get target date's stats
    const targetLogs = this.logs.filter(log => log.date === targetDateStr);

    let totalCalories = 0;
    let totalSteps = 0;
    let totalDuration = 0;

    targetLogs.forEach(log => {
      totalCalories += log.calories;
      totalDuration += log.duration;
      if (log.steps) totalSteps += log.steps;
    });

    document.getElementById('today-calories').textContent = totalCalories;
    const elGoalCalories = document.getElementById('goal-calories');
    if (elGoalCalories) elGoalCalories.textContent = (this.userProfile.calorieGoal || 500).toLocaleString();

    document.getElementById('today-steps').textContent = totalSteps.toLocaleString();
    document.getElementById('goal-steps').textContent = (this.userProfile.stepGoal || 10000).toLocaleString();

    document.getElementById('today-duration').textContent = totalDuration;
    const elGoalDuration = document.getElementById('goal-duration');
    if (elGoalDuration) elGoalDuration.textContent = (this.userProfile.durationGoal || 60).toLocaleString();

    document.getElementById('user-streak').textContent = this.calculateStreak(targetDateStr);

    // Render Health Energy score and progress ring
    const energyScore = this.calculateHealthEnergy(targetDateStr);
    document.getElementById('energy-score-val').textContent = energyScore;

    // SVG gauge animation
    const circle = document.getElementById('energy-gauge-fill');
    if (circle) {
      // stroke-dasharray = 440 (2 * pi * r => 2 * 3.14 * 70 = 439.6)
      const offset = 440 - (energyScore / 100) * 440;
      circle.style.strokeDashoffset = offset;
    }

    // Energy Status Text
    const statusText = document.getElementById('energy-status-text');
    if (statusText) {
      if (energyScore < 40) {
        statusText.textContent = "에너지 방전! 회복 필요 🔋";
        statusText.style.color = "var(--color-accent)";
        statusText.style.borderColor = "rgba(244, 63, 94, 0.3)";
        statusText.style.background = "rgba(244, 63, 94, 0.1)";
      } else if (energyScore < 70) {
        statusText.textContent = "충전 중 / 안정적 상태 ⚡";
        statusText.style.color = "var(--color-secondary)";
        statusText.style.borderColor = "rgba(99, 102, 241, 0.3)";
        statusText.style.background = "rgba(99, 102, 241, 0.1)";
      } else {
        statusText.textContent = "에너지 최고조! 매우 활발 🔥";
        statusText.style.color = "var(--color-primary)";
        statusText.style.borderColor = "rgba(16, 185, 129, 0.3)";
        statusText.style.background = "rgba(16, 185, 129, 0.1)";
      }
    }

    // Update energy details if currently open
    const detailsContainer = document.getElementById('energy-details-container');
    if (detailsContainer && detailsContainer.style.display === 'block') {
      this.updateEnergyDetails(targetDateStr);
    }

    // 2. Render dynamic recommended workouts based on weakest past 1-week energy details
    const energyDetails = this.getEnergyDetailsData(targetDateStr);
    const elements = [
      { key: 'strength', name: '근력', val: energyDetails.strength },
      { key: 'endurance', name: '근지구력', val: energyDetails.endurance },
      { key: 'cardio', name: '심폐지구력', val: energyDetails.cardio },
      { key: 'flexibility', name: '유연성', val: energyDetails.flexibility }
    ];
    // Sort ascending to find the minimum
    elements.sort((a, b) => a.val - b.val);
    const weakest = elements[0];

    const reasonEl = document.getElementById('home-recommendation-reason');
    if (reasonEl) {
      reasonEl.innerHTML = `최근 1주일간 분석 결과 <strong>${weakest.name} (${weakest.val}%)</strong>이 가장 부족합니다. 관련 보충 운동을 권장합니다.`;
    }

    const recListContainer = document.getElementById('home-recommendation-list');
    if (recListContainer) {
      recListContainer.innerHTML = '';
      
      let recs = [];
      if (weakest.key === 'strength') {
        recs = [
          {
            name: "팔굽혀펴기 (Push-ups)",
            meta: "상체(가슴/팔) 근력 보강 | 측정 변수: 팔굽혀펴기 최대횟수",
            icon: "fa-hand-fist",
            color: "rgba(239, 68, 68, 0.15)",
            textColor: "var(--color-accent)",
            action: "app.navigateTo('direct-input', '팔굽혀펴기')"
          },
          {
            name: "턱걸이 & 친업 (Pull-ups)",
            meta: "등/어깨 보충근력 보강 | 측정 변수: 턱걸이/친업 최대횟수",
            icon: "fa-dumbbell",
            color: "rgba(99, 102, 241, 0.15)",
            textColor: "var(--color-secondary)",
            action: "app.navigateTo('direct-input', '턱걸이')"
          },
          {
            name: "딥스 (Dips)",
            meta: "상체 삼두/어깨 보강 | 측정 변수: 딥스 최대횟수",
            icon: "fa-child",
            color: "rgba(16, 185, 129, 0.15)",
            textColor: "var(--color-primary)",
            action: "app.navigateTo('direct-input', '딥스')"
          }
        ];
      } else if (weakest.key === 'endurance') {
        recs = [
          {
            name: "스쿼트 (Squats)",
            meta: "하체 근지구력 보강 | 측정 변수: 스쿼트 최대반복횟수",
            icon: "fa-child",
            color: "rgba(16, 185, 129, 0.15)",
            textColor: "var(--color-primary)",
            action: "app.selectWorkoutPreset('Squats')"
          },
          {
            name: "플랭크 (Plank)",
            meta: "코어 근지구력 보강 | 측정 변수: 플랭크 최대유지시간",
            icon: "fa-clock",
            color: "rgba(245, 158, 11, 0.15)",
            textColor: "var(--color-warning)",
            action: "app.navigateTo('direct-input', '플랭크')"
          },
          {
            name: "윗몸말아올리기 (Crunches)",
            meta: "복부 코어 지구력 보강 | 측정 변수: 윗몸말아올리기 최대횟수",
            icon: "fa-person-running",
            color: "rgba(99, 102, 241, 0.15)",
            textColor: "var(--color-secondary)",
            action: "app.navigateTo('direct-input', '윗몸일으키기')"
          }
        ];
      } else if (weakest.key === 'cardio') {
        recs = [
          {
            name: "왕복오래달리기 (Shuttle Run)",
            meta: "호흡 순환/심폐능력 강화 | 측정 변수: 왕복오래달리기 기록",
            icon: "fa-person-running",
            color: "rgba(99, 102, 241, 0.15)",
            textColor: "var(--color-secondary)",
            action: "app.selectWorkoutPreset('Walking')"
          },
          {
            name: "계단 오르기 / 스텝 훈련",
            meta: "심폐지구력 및 하체 보강 | 측정 변수: 스텝검사 단계",
            icon: "fa-stairs",
            color: "rgba(16, 185, 129, 0.15)",
            textColor: "var(--color-primary)",
            action: "app.navigateTo('direct-input', '계단오르기')"
          }
        ];
      } else if (weakest.key === 'flexibility') {
        recs = [
          {
            name: "앉아윗몸앞으로굽히기 스트레칭",
            meta: "햄스트링/척추 유연성 증가 | 측정 변수: 앉아윗몸앞으로굽히기",
            icon: "fa-person-running",
            color: "rgba(16, 185, 129, 0.15)",
            textColor: "var(--color-primary)",
            action: "app.navigateTo('direct-input', '요가/스트레칭')"
          }
        ];
      }

      recs.forEach(rec => {
        recListContainer.innerHTML += `
          <div class="exercise-item" onclick="${rec.action}">
            <div class="exercise-info">
              <div class="exercise-icon" style="background: ${rec.color}; color: ${rec.textColor};"><i class="fa-solid ${rec.icon}"></i></div>
              <div>
                <div class="exercise-name">${rec.name}</div>
                <div class="exercise-meta">${rec.meta}</div>
              </div>
            </div>
            <i class="fa-solid fa-chevron-right" style="font-size: 0.8rem; color: var(--text-secondary);"></i>
          </div>
        `;
      });
    }
  }

  renderTimeline() {
    const container = document.getElementById('timeline-items-container');
    const emptyState = document.getElementById('timeline-empty-state');
    
    if (!container) return;

    container.innerHTML = '';

    if (this.logs.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      const filterContainer = document.getElementById('timeline-date-filters');
      if (filterContainer) filterContainer.innerHTML = '';
      return;
    }

    // 1. Render date filter buttons
    const uniqueDates = [...new Set(this.logs.map(log => log.date))].sort().reverse();
    if (this.selectedTimelineDate !== 'all' && !uniqueDates.includes(this.selectedTimelineDate)) {
      this.selectedTimelineDate = 'all';
    }

    const filterContainer = document.getElementById('timeline-date-filters');
    if (filterContainer) {
      filterContainer.innerHTML = '';
      
      // All button
      const allBtn = document.createElement('button');
      allBtn.className = `btn-date-filter ${this.selectedTimelineDate === 'all' ? 'active' : ''}`;
      allBtn.textContent = '전체';
      allBtn.onclick = () => {
        this.selectedTimelineDate = 'all';
        this.renderTimeline();
      };
      filterContainer.appendChild(allBtn);

      // Date buttons
      uniqueDates.forEach(dateStr => {
        const btn = document.createElement('button');
        btn.className = `btn-date-filter ${this.selectedTimelineDate === dateStr ? 'active' : ''}`;
        
        // Format e.g., "2026-07-18" -> "7/18"
        const parts = dateStr.split('-');
        const formatted = parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : dateStr;
        btn.textContent = formatted;
        
        btn.onclick = () => {
          this.selectedTimelineDate = dateStr;
          this.renderTimeline();
        };
        filterContainer.appendChild(btn);
      });
    }

    // 2. Filter logs
    let filteredLogs = [...this.logs];
    if (this.selectedTimelineDate !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.date === this.selectedTimelineDate);
    }

    const sortedLogs = filteredLogs.sort((a, b) => b.id - a.id);

    if (sortedLogs.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // 3. Render items
    sortedLogs.forEach(log => {
      const item = document.createElement('div');
      item.className = 'timeline-item';

      let methodIcon = '<i class="fa-solid fa-dumbbell"></i>';
      if (log.method === 'camera') methodIcon = '<i class="fa-solid fa-camera"></i>';
      if (log.method === 'auto') methodIcon = '<i class="fa-solid fa-person-running"></i>';

      let statsHTML = `<span>⏱️ ${log.duration}분</span> | <span>🔥 ${log.calories} kcal</span>`;
      if (log.steps) {
        statsHTML += ` | <span>👣 ${log.steps.toLocaleString()}보</span>`;
      }
      if (log.reps) {
        statsHTML += ` | <span>🔢 ${log.reps}회</span>`;
      }
      if (log.postureScore) {
        statsHTML += ` | <span>🎯 평균 ${log.postureScore}점</span>`;
      }
      if (log.measurementValue) {
        statsHTML += ` | <span style="color: var(--color-primary); font-weight: 700;">🎯 측정: ${log.measurementValue} ${log.measurementUnit}</span>`;
      }

      item.innerHTML = `
        <div class="timeline-item-dot" style="background: ${log.method === 'camera' ? 'var(--color-primary)' : log.method === 'auto' ? 'var(--color-secondary)' : 'var(--color-accent)'}"></div>
        <div class="timeline-item-content">
          <div class="timeline-item-header">
            <span class="timeline-item-title">${methodIcon} ${log.type}</span>
            <span class="timeline-item-time">${log.date} ${log.time}</span>
          </div>
          <div class="timeline-item-meta">
            ${statsHTML}
          </div>
          <div class="timeline-item-memo">
            ${log.memo}
          </div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  renderRecommendation() {
    const loadingEl = document.getElementById('recommendation-loading');
    const resultEl = document.getElementById('recommendation-result');
    if (!loadingEl || !resultEl) return;

    loadingEl.style.display = 'block';
    resultEl.style.display = 'none';

    setTimeout(() => {
      loadingEl.style.display = 'none';
      
      const energyScore = this.calculateHealthEnergy();
      let recommendationHtml = '';

      if (energyScore < 40) {
        recommendationHtml = `
          <div class="glass-card" style="border-left: 4px solid var(--color-accent);">
            <div style="font-size: 0.8rem; color: var(--color-accent); font-weight: 700; margin-bottom: 8px;">에너지 방전 상태! 무리하지 마세요</div>
            <h3 style="font-size: 1.2rem; margin-bottom: 12px;"><i class="fa-solid fa-bed"></i> 휴식 및 가벼운 스트레칭</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
              현재 신체 피로도가 높은 것으로 분석됩니다. 격렬한 운동보다는 근육을 풀어주는 <strong>스트레칭(햄스트링, 어깨 등)</strong> 또는 <strong>폼롤러 마사지</strong>를 추천합니다. 충분한 수면도 중요합니다.
            </p>
            <button class="btn-primary" onclick="app.navigateTo('direct-input')" style="width: 100%; padding: 10px; font-size: 0.9rem;">운동 기록하러 가기</button>
          </div>
        `;
      } else if (energyScore < 70) {
        recommendationHtml = `
          <div class="glass-card" style="border-left: 4px solid var(--color-secondary);">
            <div style="font-size: 0.8rem; color: var(--color-secondary); font-weight: 700; margin-bottom: 8px;">안정적인 에너지, 균형을 맞추세요</div>
            <h3 style="font-size: 1.2rem; margin-bottom: 12px;"><i class="fa-solid fa-person-running"></i> 야외 달리기 및 코어 운동</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
              에너지 레벨이 안정적입니다. 심폐 지구력을 기르는 <strong>야외 달리기/걷기</strong>와 함께 <strong>플랭크, 크런치</strong> 등 코어를 단단하게 잡아주는 복합 운동을 30분 정도 진행해보세요.
            </p>
            <button class="btn-primary" onclick="app.navigateTo('direct-input')" style="width: 100%; padding: 10px; font-size: 0.9rem;">운동 기록하러 가기</button>
          </div>
        `;
      } else {
        recommendationHtml = `
          <div class="glass-card" style="border-left: 4px solid var(--color-primary);">
            <div style="font-size: 0.8rem; color: var(--color-primary); font-weight: 700; margin-bottom: 8px;">에너지 최고조! 근력 향상의 기회</div>
            <h3 style="font-size: 1.2rem; margin-bottom: 12px;"><i class="fa-solid fa-dumbbell"></i> 전신 고강도 근력 훈련</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
              컨디션이 매우 좋습니다! <strong>스쿼트, 푸쉬업, 풀업</strong> 등 대근육을 사용하는 근력 운동이나 <strong>버피</strong> 같은 전신 고강도 인터벌 트레이닝(HIIT)을 수행하여 근육량을 효과적으로 늘려보세요.
            </p>
            <button class="btn-primary" onclick="app.navigateTo('direct-input')" style="width: 100%; padding: 10px; font-size: 0.9rem;">운동 기록하러 가기</button>
          </div>
        `;
      }

      resultEl.innerHTML = recommendationHtml;
      resultEl.style.display = 'block';
    }, 1500); // 1.5초 로딩 시뮬레이션
  }

  renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const monthYearEl = document.getElementById('calendar-month-year');
    if (monthYearEl) {
      monthYearEl.textContent = `${year}년 ${month + 1}월`;
    }
    
    grid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Log dates mapping
    const logDates = {};
    this.logs.forEach(log => {
      if (!logDates[log.date]) logDates[log.date] = [];
      logDates[log.date].push(log);
    });

    // Empty slots before 1st
    for (let i = 0; i < firstDay; i++) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'calendar-day empty';
      grid.appendChild(emptyDiv);
    }
    
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      dayDiv.textContent = i;
      
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      if (dateStr === today.toISOString().split('T')[0]) {
        dayDiv.classList.add('today');
      }
      
      if (logDates[dateStr]) {
        const dot = document.createElement('div');
        dot.className = 'calendar-dot';
        dayDiv.appendChild(dot);
        dayDiv.classList.add('has-workout');
      }
      
      dayDiv.onclick = () => {
        document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
        dayDiv.classList.add('selected');
        this.renderCalendarLogs(dateStr, logDates[dateStr] || []);
      };
      
      grid.appendChild(dayDiv);
    }
  }

  renderCalendarLogs(dateStr, logs) {
    const container = document.getElementById('calendar-selected-logs');
    if (!container) return;
    
    if (logs.length === 0) {
      container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center;">${dateStr} 기록이 없습니다.</p>`;
      return;
    }
    
    let html = `<div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 10px;">${dateStr} 운동 내역</div>`;
    logs.forEach(log => {
      html += `
        <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.8rem; font-weight: 500;">${log.type} <span style="color: var(--text-secondary); font-size: 0.7rem; margin-left: 4px;">${log.time}</span></div>
          <div style="font-size: 0.75rem; color: var(--color-primary);">${log.duration}분 | ${log.calories}kcal</div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }

  setReportTimeframe(timeframe) {
    this.reportTimeframe = timeframe;
    
    // Update active button styling
    document.querySelectorAll('.btn-timeframe').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`btn-tf-${timeframe}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update labels
    const scoreTitle = document.getElementById('label-energy-score-title');
    const durationTitle = document.getElementById('label-workout-duration-title');
    const scoreDesc = document.getElementById('desc-energy-score');
    const durationDesc = document.getElementById('desc-workout-duration');

    if (timeframe === 'weekly') {
      if (scoreTitle) scoreTitle.textContent = '주간 건강 에너지 점수';
      if (durationTitle) durationTitle.textContent = '주간 운동 시간 (분)';
      if (scoreDesc) scoreDesc.textContent = '요일별 오늘 하루 최종 축적된 에너지 점수입니다.';
      if (durationDesc) durationDesc.textContent = '요일별 운동 수행 총 합산 시간(분)입니다.';
    } else if (timeframe === 'monthly') {
      if (scoreTitle) scoreTitle.textContent = '월간 건강 에너지 점수';
      if (durationTitle) durationTitle.textContent = '월간 운동 시간 (분)';
      if (scoreDesc) scoreDesc.textContent = '최근 4주간 주차별 평균 건강 에너지 레벨입니다.';
      if (durationDesc) durationDesc.textContent = '최근 4주간 주차별 운동 총합 시간(분)입니다.';
    } else if (timeframe === 'yearly') {
      if (scoreTitle) scoreTitle.textContent = '연간 건강 에너지 점수';
      if (durationTitle) durationTitle.textContent = '연간 운동 시간 (분)';
      if (scoreDesc) scoreDesc.textContent = '월별 평균 건강 에너지 점수 추이입니다.';
      if (durationDesc) durationDesc.textContent = '월별 누적 운동 시간(분)입니다.';
    }

    this.renderTimeframeCharts();
  }

  renderTimeframeCharts() {
    const scoreContainer = document.getElementById('chart-energy-score');
    const durationContainer = document.getElementById('chart-workout-duration');
    if (!scoreContainer || !durationContainer) return;

    scoreContainer.innerHTML = '';
    durationContainer.innerHTML = '';

    const today = new Date();
    const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const scoreFor = logs => {
      if (!logs.length) return 0;
      const duration = logs.reduce((sum, log) => sum + (Number(log.duration) || 0), 0);
      const calories = logs.reduce((sum, log) => sum + (Number(log.calories) || 0), 0);
      const posture = logs.filter(log => Number.isFinite(log.postureScore));
      const postureBonus = posture.length ? posture.reduce((sum, log) => sum + log.postureScore, 0) / posture.length * 0.12 : 0;
      return Math.min(100, Math.round(duration * 0.7 + calories * 0.08 + postureBonus));
    };
    let buckets = [];

    if (this.reportTimeframe === 'weekly') {
      const monday = new Date(today);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      buckets = Array.from({ length: 7 }, (_, index) => {
        const start = new Date(monday); start.setDate(monday.getDate() + index);
        return { label: ['월', '화', '수', '목', '금', '토', '일'][index], logs: this.logs.filter(log => log.date === localDate(start)) };
      });
    } else if (this.reportTimeframe === 'monthly') {
      buckets = Array.from({ length: 4 }, (_, index) => {
        const end = new Date(today); end.setHours(23, 59, 59, 999); end.setDate(today.getDate() - (3 - index) * 7);
        const start = new Date(end); start.setHours(0, 0, 0, 0); start.setDate(end.getDate() - 6);
        return { label: `${index + 1}주차`, logs: this.logs.filter(log => { const d = new Date(`${log.date}T00:00:00`); return d >= start && d <= end; }) };
      });
    } else {
      const year = today.getFullYear();
      buckets = Array.from({ length: 12 }, (_, index) => ({
        label: `${index + 1}월`,
        logs: this.logs.filter(log => { const d = new Date(`${log.date}T00:00:00`); return d.getFullYear() === year && d.getMonth() === index; })
      }));
    }

    const labels = buckets.map(bucket => bucket.label);
    const durations = buckets.map(bucket => bucket.logs.reduce((sum, log) => sum + (Number(log.duration) || 0), 0));
    const scores = buckets.map(bucket => scoreFor(bucket.logs));
    const maxDuration = Math.max(1, ...durations);

    // Render Scores
    scores.forEach((score, index) => {
      scoreContainer.innerHTML += `
        <div class="chart-bar-wrapper">
          <div class="chart-bar-bg" style="width: 10px; height: 100px;">
            <div class="chart-bar-fill" style="height: ${score}%; background: linear-gradient(to top, var(--color-secondary), var(--color-primary)); transition: height 0.5s ease;"></div>
          </div>
          <div style="font-size: 0.55rem; color: var(--text-secondary); transform: scale(0.85); margin-top: 2px;">${score}점</div>
          <span class="chart-bar-label" style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 2px;">${labels[index]}</span>
        </div>
      `;
    });

    // Render Durations
    durations.forEach((dur, index) => {
      const pct = Math.min(100, Math.round((dur / maxDuration) * 100));
      durationContainer.innerHTML += `
        <div class="chart-bar-wrapper">
          <div class="chart-bar-bg" style="width: 10px; height: 100px;">
            <div class="chart-bar-fill" style="height: ${pct}%; background: linear-gradient(to top, var(--color-accent), var(--color-warning)); transition: height 0.5s ease;"></div>
          </div>
          <div style="font-size: 0.55rem; color: var(--text-secondary); transform: scale(0.85); margin-top: 2px;">${dur}분</div>
          <span class="chart-bar-label" style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 2px;">${labels[index]}</span>
        </div>
      `;
    });
  }

  renderReports() {
    this.renderCalendar();
    this.renderTimeframeCharts();

    // Update textual feedbacks based on stats
    const totalDurationWeek = this.logs.reduce((acc, curr) => acc + curr.duration, 0);
    const streak = this.calculateStreak();
    
    // Consistency evaluation text
    const consistencyText = document.getElementById('report-text-consistency');
    if (consistencyText) {
      if (streak === 0) {
        consistencyText.textContent = "최근 운동 실천 기록이 저조합니다. 하루 15분이라도 시작해 루틴을 만드세요!";
      } else if (streak <= 2) {
        consistencyText.textContent = `현재 ${streak}일 연속 운동 중입니다! 습관이 형성되는 과정이니 포기하지 마세요.`;
      } else {
        consistencyText.textContent = `${streak}일 연속 목표 달성! 일관된 운동 습관은 뇌 건강 및 에너지 대사량 향상에 매우 긍정적입니다.`;
      }
    }

    // Volume evaluation text
    const volumeText = document.getElementById('report-text-volume');
    if (volumeText) {
      if (totalDurationWeek < 60) {
        volumeText.textContent = `주간 누적 운동 시간이 ${totalDurationWeek}분으로 WHO 권장치(150분)보다 부족합니다. 시간을 점차 늘려보세요.`;
      } else if (totalDurationWeek < 180) {
        volumeText.textContent = `주간 총 ${totalDurationWeek}분 운동을 달성하였습니다. 적정 신체 활동량을 아주 잘 지키고 계십니다!`;
      } else {
        volumeText.textContent = `주간 총 ${totalDurationWeek}분의 고강도 활동을 감지했습니다. 과훈련(Overtraining)을 막기 위해 가벼운 휴식일을 권장합니다.`;
      }
    }

    // Posture evaluation text
    const postureText = document.getElementById('report-text-posture');
    if (postureText) {
      const cameraLogs = this.logs.filter(log => log.method === 'camera' && log.postureScore);
      if (cameraLogs.length === 0) {
        postureText.textContent = "스쿼트 카메라 피드백 기록이 없습니다. 정확한 자세 분석과 관절 정렬 상태 진단을 받아보세요.";
      } else {
        const avgPosture = Math.round(cameraLogs.reduce((acc, curr) => acc + curr.postureScore, 0) / cameraLogs.length);
        if (avgPosture >= 85) {
          postureText.textContent = `스쿼트 평균 자세 점수 ${avgPosture}점입니다. 관절과 척추가 바르게 정렬되어 무릎 부상 위험이 극히 낮습니다.`;
        } else {
          postureText.textContent = `스쿼트 평균 자세 점수 ${avgPosture}점입니다. 하강 시 상체가 과도하게 굽어 무릎 및 허리에 가해지는 압박이 큽니다.`;
        }
      }
    }
  }

  getEnergyDetailsData(targetDateStr) {
    if (!targetDateStr) {
      targetDateStr = this.selectedHomeDate === 'today' ? new Date().toISOString().split('T')[0] : this.selectedHomeDate;
    }

    // 1. Baselines
    let strength = 35;
    let endurance = 30;
    let cardio = 40;
    let flexibility = 25;

    // 2. Scan past 7 days of logs relative to targetDateStr
    const endDate = new Date(targetDateStr);
    const past7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      past7Days.push(d.toISOString().split('T')[0]);
    }

    const recentLogs = this.logs.filter(log => past7Days.includes(log.date));

    recentLogs.forEach(log => {
      const type = log.type.toLowerCase();
      const intensityMultiplier = log.intensity === 'high' ? 2.0 : log.intensity === 'medium' ? 1.2 : 0.6;
      const points = log.duration * intensityMultiplier;

      // Classify exercise
      if (type.includes('스쿼트') || type.includes('푸쉬업') || type.includes('풀업') || type.includes('친업') || type.includes('딥스') || type.includes('웨이트') || type.includes('로우') || type.includes('바이셉') || type.includes('레터럴') || type.includes('오버헤드') || type.includes('프레스')) {
        strength += points * 0.8;
        endurance += points * 0.4;
      }
      if (type.includes('플랭크') || type.includes('크런치') || type.includes('레그레이즈') || type.includes('런지') || type.includes('버피') || type.includes('계단') || type.includes('윗몸일으키기') || type.includes('윗몸말아올리기') || type.includes('니 레이즈') || type.includes('니 프레스')) {
        endurance += points * 0.9;
        cardio += points * 0.3;
      }
      if (type.includes('달리기') || type.includes('걷기') || type.includes('자전거') || type.includes('수영') || type.includes('조깅') || type.includes('클라이머')) {
        cardio += points * 0.9;
        endurance += points * 0.2;
      }
      if (type.includes('스트레칭') || type.includes('요가') || type.includes('필라테스') || type.includes('돌리기') || type.includes('암서클')) {
        flexibility += points * 1.5;
        endurance += points * 0.1;
      }
    });

    return {
      strength: Math.round(Math.max(10, Math.min(100, strength))),
      endurance: Math.round(Math.max(10, Math.min(100, endurance))),
      cardio: Math.round(Math.max(10, Math.min(100, cardio))),
      flexibility: Math.round(Math.max(10, Math.min(100, flexibility)))
    };
  }

  updateEnergyDetails(targetDateStr) {
    if (!targetDateStr) {
      targetDateStr = this.selectedHomeDate === 'today' ? new Date().toISOString().split('T')[0] : this.selectedHomeDate;
    }

    // 1. Baselines
    let strength = 35;
    let endurance = 30;
    let cardio = 40;
    let flexibility = 25;

    // 2. Scan past 7 days of logs relative to targetDateStr
    const endDate = new Date(targetDateStr);
    const past7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      past7Days.push(d.toISOString().split('T')[0]);
    }

    const recentLogs = this.logs.filter(log => past7Days.includes(log.date));

    recentLogs.forEach(log => {
      const type = log.type.toLowerCase();
      const intensityMultiplier = log.intensity === 'high' ? 2.0 : log.intensity === 'medium' ? 1.2 : 0.6;
      const points = log.duration * intensityMultiplier;

      // Classify exercise
      if (type.includes('스쿼트') || type.includes('푸쉬업') || type.includes('풀업') || type.includes('친업') || type.includes('딥스') || type.includes('웨이트') || type.includes('로우') || type.includes('바이셉') || type.includes('레터럴') || type.includes('오버헤드') || type.includes('프레스')) {
        strength += points * 0.8;
        endurance += points * 0.4;
      }
      if (type.includes('플랭크') || type.includes('크런치') || type.includes('레그레이즈') || type.includes('런지') || type.includes('버피') || type.includes('계단') || type.includes('윗몸일으키기') || type.includes('윗몸말아올리기') || type.includes('니 레이즈') || type.includes('니 프레스')) {
        endurance += points * 0.9;
        cardio += points * 0.3;
      }
      if (type.includes('달리기') || type.includes('걷기') || type.includes('자전거') || type.includes('수영') || type.includes('조깅') || type.includes('클라이머')) {
        cardio += points * 0.9;
        endurance += points * 0.2;
      }
      if (type.includes('스트레칭') || type.includes('요가') || type.includes('필라테스') || type.includes('돌리기') || type.includes('암서클')) {
        flexibility += points * 1.5;
        endurance += points * 0.1;
      }
    });

    // 3. Cap at 100, min 10
    strength = Math.round(Math.max(10, Math.min(100, strength)));
    endurance = Math.round(Math.max(10, Math.min(100, endurance)));
    cardio = Math.round(Math.max(10, Math.min(100, cardio)));
    flexibility = Math.round(Math.max(10, Math.min(100, flexibility)));

    // 4. Update DOM
    const elStrengthVal = document.getElementById('score-strength');
    const elStrengthBar = document.getElementById('bar-strength');
    if (elStrengthVal && elStrengthBar) {
      elStrengthVal.textContent = `${strength}%`;
      elStrengthBar.style.width = `${strength}%`;
    }

    const elEnduranceVal = document.getElementById('score-endurance');
    const elEnduranceBar = document.getElementById('bar-endurance');
    if (elEnduranceVal && elEnduranceBar) {
      elEnduranceVal.textContent = `${endurance}%`;
      elEnduranceBar.style.width = `${endurance}%`;
    }

    const elCardioVal = document.getElementById('score-cardio');
    const elCardioBar = document.getElementById('bar-cardio');
    if (elCardioVal && elCardioBar) {
      elCardioVal.textContent = `${cardio}%`;
      elCardioBar.style.width = `${cardio}%`;
    }

    const elFlexibilityVal = document.getElementById('score-flexibility');
    const elFlexibilityBar = document.getElementById('bar-flexibility');
    if (elFlexibilityVal && elFlexibilityBar) {
      elFlexibilityVal.textContent = `${flexibility}%`;
      elFlexibilityBar.style.width = `${flexibility}%`;
    }
  }
}

// Instantiate App
window.app = new HealthEnergyApp();
