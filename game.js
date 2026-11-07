(function () {
  "use strict";

  const levels = [
    {
      name: "加減小徑",
      questions: [
        { expression: "7 + 5 = ?", answer: "12", choices: ["12", "10", "13"] },
        { expression: "14 − 6 = ?", answer: "8", choices: ["7", "8", "9"] },
        { expression: "9 + 8 = ?", answer: "17", choices: ["16", "18", "17"] },
      ],
    },
    {
      name: "乘法蘑菇林",
      questions: [
        { expression: "3 × 4 = ?", answer: "12", choices: ["12", "14", "16"] },
        { expression: "5 × 6 = ?", answer: "30", choices: ["24", "30", "36"] },
        { expression: "7 × 3 = ?", answer: "21", choices: ["18", "21", "24"] },
      ],
    },
    {
      name: "除法瀑布",
      questions: [
        { expression: "24 ÷ 4 = ?", answer: "6", choices: ["6", "8", "4"] },
        { expression: "35 ÷ 5 = ?", answer: "7", choices: ["5", "7", "8"] },
        { expression: "48 ÷ 6 = ?", answer: "8", choices: ["6", "8", "9"] },
      ],
    },
    {
      name: "分數花園",
      questions: [
        { expression: "4/8 化簡為？", answer: "1/2", choices: ["1/2", "1/4", "2/3"] },
        { expression: "6/9 化簡為？", answer: "2/3", choices: ["3/4", "2/3", "1/3"] },
        { expression: "2/3 的等值分數？", answer: "4/6", choices: ["3/6", "4/6", "5/6"] },
      ],
    },
    {
      name: "終點綜合挑戰",
      questions: [
        { expression: "48 ÷ 6 + 3 = ?", answer: "11", choices: ["11", "10", "12"] },
        { expression: "3 × 7 − 5 = ?", answer: "16", choices: ["16", "21", "14"] },
        { expression: "(28 − 4) ÷ 3 = ?", answer: "8", choices: ["8", "7", "9"] },
      ],
    },
  ];

  const ui = {
    update(state) {
      const stageNumber = Math.min(state.levelIndex + 1, levels.length);
      document.getElementById("stage-label").innerHTML = "第 " + stageNumber + " 關 <i>/ 5</i>";
      document.getElementById("overall-progress").style.width = (state.completed / 15) * 100 + "%";
      document.getElementById("score-value").textContent = String(state.score);
      document.getElementById("mission-heading").textContent = state.levelName;
      document.getElementById("question-count").textContent = "第 " + (state.questionIndex + 1) + " 題 / 3";
      document.getElementById("question-text").textContent = state.expression;
      document.getElementById("board-status").textContent = "第 " + stageNumber + " 關・" + state.levelName;

      const stagePips = document.getElementById("stage-pips");
      stagePips.replaceChildren();
      levels.forEach((level, index) => {
        const pip = document.createElement("span");
        pip.className = "stage-pip" + (index < state.levelIndex ? " done" : "") + (index === state.levelIndex ? " current" : "");
        pip.title = level.name;
        stagePips.appendChild(pip);
      });

      const questionDots = document.getElementById("question-dots");
      questionDots.replaceChildren();
      levels[state.levelIndex].questions.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = "question-dot" + (index < state.questionIndex ? " done" : "") + (index === state.questionIndex ? " current" : "");
        questionDots.appendChild(dot);
      });
    },
    feedback(message, tone, icon) {
      const card = document.getElementById("feedback-card");
      card.className = "feedback-card" + (tone ? " " + tone : "");
      document.getElementById("feedback-text").textContent = message;
      document.getElementById("feedback-icon").textContent = icon || "💡";
    },
    complete(score) {
      document.getElementById("board-status").textContent = "五關全數完成！太棒了！";
      document.getElementById("overall-progress").style.width = "100%";
      document.getElementById("stage-label").innerHTML = "完成冒險 <i>/ 5</i>";
      document.querySelectorAll(".stage-pip").forEach((pip) => {
        pip.classList.remove("current");
        pip.classList.add("done");
      });
      document.querySelectorAll(".question-dot").forEach((dot) => {
        dot.classList.remove("current");
        dot.classList.add("done");
      });
      document.getElementById("final-score").textContent = score + " 分";
      document.getElementById("completion-overlay").hidden = false;
      document.getElementById("play-again-button").focus();
    },
    beginAgain() {
      document.getElementById("completion-overlay").hidden = true;
    },
  };

  window.mathAdventureUI = ui;
  window.mathAdventureControls = { up: false, down: false, left: false, right: false };

  function setupTouchControls() {
    const controls = window.mathAdventureControls;
    document.querySelectorAll(".direction-button").forEach((button) => {
      const direction = button.dataset.dir;
      const release = () => {
        controls[direction] = false;
        button.classList.remove("pressed");
      };

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        controls[direction] = true;
        button.classList.add("pressed");
        if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    });
  }

  setupTouchControls();

  if (!window.Phaser) {
    ui.feedback("遊戲引擎載入中斷，請確認網路連線後重新整理頁面。", "error", "⚠️");
    document.getElementById("board-status").textContent = "遊戲引擎尚未載入";
    return;
  }

  class AdventureScene extends Phaser.Scene {
    constructor() {
      super("AdventureScene");
      this.levelIndex = 0;
      this.questionIndex = 0;
      this.score = 0;
      this.completed = 0;
      this.answerOrbs = [];
      this.solving = false;
      this.finished = false;
    }

    create() {
      this.drawWorld();
      this.createExplorer();
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D");
      this.startQuestion();
      window.mathAdventureScene = this;
    }

    drawWorld() {
      const width = this.scale.width;
      const height = this.scale.height;

      this.add.rectangle(width / 2, height / 2, width, height, 0xc8eca8).setDepth(0);
      this.add.ellipse(245, 184, 390, 82, 0xead99d, 0.66).setAngle(-18).setDepth(1);
      this.add.ellipse(650, 361, 660, 92, 0xead99d, 0.68).setAngle(-11).setDepth(1);
      this.add.ellipse(770, 126, 295, 70, 0xddeba8, 0.8).setAngle(10).setDepth(1);

      const softPatches = [
        [65, 117, 62, 24], [435, 88, 71, 28], [872, 233, 54, 25],
        [96, 421, 75, 28], [413, 472, 88, 24], [887, 444, 64, 28],
        [330, 284, 51, 22], [683, 258, 54, 23], [115, 280, 42, 20],
      ];
      softPatches.forEach(([x, y, w, h]) => {
        this.add.ellipse(x, y, w, h, 0xa3d888, 0.42).setDepth(2);
      });

      const bushes = [
        [61, 224, 0.78], [866, 330, 0.88], [325, 86, 0.72],
        [704, 466, 0.72], [920, 88, 0.7], [145, 494, 0.68],
      ];
      bushes.forEach(([x, y, scale]) => this.addBush(x, y, scale));

      const flowers = [
        [115, 112, 0xf6c85d], [276, 445, 0xf18e85], [530, 119, 0xf18e85],
        [765, 455, 0xf7ce63], [864, 184, 0xffffff], [210, 326, 0xffffff],
        [570, 458, 0xffffff], [42, 358, 0xf6c85d], [479, 226, 0xf18e85],
      ];
      flowers.forEach(([x, y, color]) => {
        this.add.circle(x, y, 5, color, 0.9).setDepth(3);
        this.add.circle(x + 7, y + 3, 2, 0xfff8dc, 1).setDepth(3);
      });

      for (let i = 0; i < 27; i += 1) {
        const x = 26 + ((i * 137) % 908);
        const y = 24 + ((i * 83) % 492);
        this.add.circle(x, y, 2 + (i % 3), 0xffffff, 0.22).setDepth(2);
      }
    }

    addBush(x, y, scale) {
      const bush = this.add.container(x, y).setDepth(4).setScale(scale);
      bush.add([
        this.add.ellipse(0, 15, 54, 18, 0x5b9d65, 0.72),
        this.add.circle(-17, 0, 16, 0x74b976, 1),
        this.add.circle(3, -8, 20, 0x83c67c, 1),
        this.add.circle(22, 1, 15, 0x68ad6d, 1),
        this.add.circle(-3, -15, 4, 0xb4df8d, 0.75),
      ]);
    }

    createExplorer() {
      this.explorer = this.add.container(480, 278).setDepth(20);
      this.explorer.add([
        this.add.ellipse(0, 23, 42, 14, 0x47784d, 0.28),
        this.add.rectangle(-19, 0, 11, 22, 0xf0a446).setAngle(-8),
        this.add.ellipse(0, 5, 37, 34, 0x438cda, 1).setStrokeStyle(3, 0xffffff, 1),
        this.add.circle(0, -14, 15, 0xffd7ad, 1),
        this.add.ellipse(0, -26, 38, 14, 0x245d82, 1),
        this.add.rectangle(0, -22, 38, 5, 0x1b4d70),
        this.add.circle(-5, -14, 1.8, 0x34444a, 1),
        this.add.circle(5, -14, 1.8, 0x34444a, 1),
        this.add.circle(0, -8, 2, 0xe78b65, 1),
        this.add.circle(-12, -27, 3, 0xffd36b, 1),
      ]);
    }

    currentQuestion() {
      return levels[this.levelIndex].questions[this.questionIndex];
    }

    updateHud() {
      const level = levels[this.levelIndex];
      const question = this.currentQuestion();
      ui.update({
        levelIndex: this.levelIndex,
        levelName: level.name,
        questionIndex: this.questionIndex,
        expression: question.expression,
        score: this.score,
        completed: this.completed,
      });
    }

    startQuestion() {
      if (this.finished) return;
      this.solving = false;
      this.clearOrbs();
      this.updateHud();
      ui.feedback("用方向鍵移動，碰到答案球就能作答！", "", "💡");
      this.spawnOrbs();
    }

    spawnOrbs() {
      const question = this.currentQuestion();
      const choices = Phaser.Utils.Array.Shuffle(question.choices.slice());
      const positions = [
        { x: 177, y: 159 },
        { x: 480, y: 389 },
        { x: 783, y: 158 },
      ];
      const colors = [0xf3bf58, 0x73b8e5, 0xee8c82];

      choices.forEach((choice, index) => {
        const orb = this.createAnswerOrb(positions[index].x, positions[index].y, choice, colors[index]);
        orb.answerValue = choice;
        this.answerOrbs.push(orb);
      });
    }

    createAnswerOrb(x, y, value, color) {
      const orb = this.add.container(x, y).setDepth(10);
      orb.add([
        this.add.circle(0, 5, 48, color, 0.2),
        this.add.circle(0, 0, 43, color, 1),
        this.add.circle(0, 0, 36, 0xfffdf4, 1),
        this.add.circle(-13, -17, 5, 0xffffff, 0.75),
        this.add.text(0, 1, value, {
          fontFamily: '"Nunito", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
          fontSize: value.length > 3 ? "21px" : "27px",
          fontStyle: "900",
          color: "#29463a",
        }).setOrigin(0.5),
      ]);
      this.tweens.add({ targets: orb, y: y - 5, duration: 850 + x % 160, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      return orb;
    }

    clearOrbs() {
      this.answerOrbs.forEach((orb) => orb.destroy());
      this.answerOrbs = [];
    }

    update(_time, delta) {
      if (!this.explorer || this.finished || this.solving) return;

      const touch = window.mathAdventureControls;
      let x = (this.cursors.right.isDown || this.wasd.D.isDown || touch.right ? 1 : 0)
        - (this.cursors.left.isDown || this.wasd.A.isDown || touch.left ? 1 : 0);
      let y = (this.cursors.down.isDown || this.wasd.S.isDown || touch.down ? 1 : 0)
        - (this.cursors.up.isDown || this.wasd.W.isDown || touch.up ? 1 : 0);
      const magnitude = Math.hypot(x, y);

      if (magnitude > 0) {
        x /= magnitude;
        y /= magnitude;
        const step = Math.min(delta, 40) * 0.245;
        this.explorer.x = Phaser.Math.Clamp(this.explorer.x + x * step, 38, 922);
        this.explorer.y = Phaser.Math.Clamp(this.explorer.y + y * step, 43, 497);
      }

      for (const orb of this.answerOrbs) {
        if (Phaser.Math.Distance.Between(this.explorer.x, this.explorer.y, orb.x, orb.y) < 55) {
          this.collectAnswer(orb);
          break;
        }
      }
    }

    collectAnswer(orb) {
      if (this.solving) return;
      this.solving = true;
      const correct = orb.answerValue === this.currentQuestion().answer;

      if (!correct) {
        this.score -= 5;
        this.updateHud();
        ui.feedback("差一點點！−5 分，再找找看正確答案。", "error", "🌱");
        this.cameras.main.shake(100, 0.002);
        this.time.delayedCall(600, () => {
          this.solving = false;
          this.clearOrbs();
          this.spawnOrbs();
        });
        return;
      }

      this.score += 10;
      this.completed += 1;
      this.updateHud();
      ui.feedback("答對了！+10 分，繼續前進！", "success", "⭐");
      this.cameras.main.flash(150, 255, 249, 205);
      this.time.delayedCall(750, () => this.advance());
    }

    advance() {
      this.questionIndex += 1;
      if (this.questionIndex >= levels[this.levelIndex].questions.length) {
        this.levelIndex += 1;
        this.questionIndex = 0;
      }

      if (this.levelIndex >= levels.length) {
        this.finished = true;
        ui.complete(this.score);
        return;
      }

      this.startQuestion();
    }

    restartAdventure() {
      this.levelIndex = 0;
      this.questionIndex = 0;
      this.score = 0;
      this.completed = 0;
      this.finished = false;
      this.solving = false;
      this.explorer.setPosition(480, 278);
      ui.beginAgain();
      this.startQuestion();
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    backgroundColor: "#c8eca8",
    parent: "game-container",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: AdventureScene,
    render: { antialias: true, pixelArt: false },
  });

  function restart() {
    const scene = game.scene.getScene("AdventureScene");
    if (scene && scene.scene.isActive()) scene.restartAdventure();
  }

  document.getElementById("restart-button").addEventListener("click", restart);
  document.getElementById("play-again-button").addEventListener("click", restart);
})();
