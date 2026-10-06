<div align="center">

# 💧 water-elf

**在 Claude Code 裡養一隻喝水精靈。**

你寫 code，它在旁邊陪你；你喝水，它就開心；你連續達標，它會進化。

[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](.claude-plugin/plugin.json)
[![Tests](https://img.shields.io/badge/tests-11%20passing-brightgreen)](hooks/water.test.ts)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

[安裝](#-安裝) •
[使用](#-使用) •
[設定](#%EF%B8%8F-設定) •
[精靈進化](#-精靈進化) •
[開發](#%EF%B8%8F-開發) •
[致謝](#-致謝)

</div>

---

```
┌ 💧 喝水精靈 ─────────────────────────┐
│                                      │
│   ▄▀▀▀▀▄     ← 像素精靈會依心情動     │
│  ▀▄▄▄▄▄▀                             │
│                                      │
│   ☆ 今日進行中                        │
│   ▰▰▰▰▰▰▱▱▱▱▱▱ 4/8 杯                 │
│   💧 1000 / 2000ml                    │
│   連續 3 天達標                       │
│   水精靈 · 累計達標 5 天              │
│   水水的好舒服 ✨                     │
│   再達標 2 天進化成「晨光精靈」       │
└──────────────────────────────────────┘
```

> 想先看達標畫面？裝好後打 `/water-elf demo`，播 10 秒慶祝動畫，不會寫入任何紀錄。

## ✨ 特色

- **一個指令記一杯**：`/water`，不用離開終端機、不用開 App。
- **會動的像素精靈**：右側面板用終端機彩色字元畫出精靈，剛喝水會跳、久沒喝會攤平。
- **達標慶祝畫面**：喝滿當日目標，精靈在水波和星星中跳舞 🎉
- **養成系統**：累計達標天數讓精靈進化，共 4 個階段。
- **貼心提醒**：超過設定時間沒喝，跳出 toast 提醒你。
- **純本機**：紀錄只存在 Claude Code 的本機 store，不連網。

## 📦 安裝

在 Claude Code 終端機的提示列輸入：

```
/plugin install water-elf --marketplace VagrantPi/water-eif
```

1. 問 `Add marketplace?` 時按 `y`
2. 選安裝範圍（建議 user，按 Enter）
3. 設定每日目標等選項（可直接用預設）

看到 `Installed water-elf. Plugin is now active.` 就完成了，當下的 session 立刻生效。

> [!NOTE]
> 像素精靈只在**終端機**畫得出來；在桌面 App 的 Code 分頁裡，面板只顯示文字進度。

## 🚀 使用

| 指令 | 作用 |
| --- | --- |
| `/water` | 記 1 份（預設 250ml） |
| `/water 2` | 記 2 份，可用小數，例如 `/water 0.5`（上限 20） |
| `/water-elf` | 顯示／隱藏右側精靈面板（會記住你的選擇） |
| `/water-elf demo` | 預覽 10 秒「今日完成」慶祝畫面，不寫入紀錄 |

狀態列會常駐今日進度，例如 `💧 4/8 杯 (1000/2000ml)`。

### 精靈的心情

| 心情 | 什麼時候 | 精靈說 |
| --- | --- | --- |
| 🥤 cheer | 剛記完一杯的 3 秒 | 咕嘟咕嘟～好喝！ |
| 😊 happy | 30 分鐘內有喝 | 水水的好舒服 ✨ |
| 😐 idle | 平常 | 在旁邊陪你寫 code |
| 🫠 thirsty | 超過提醒間隔沒喝 | 好渴…快融化了… |
| 🎉 done | 今日目標達成 | 今天喝夠了，精靈閃閃發亮 🎉 |

> 今天還沒喝過時，口渴計時從 session 啟動開始算，早上一開終端機不會馬上看到口渴臉。

## ⚙️ 設定

安裝時會問，之後可在 `/plugin` 的設定選單修改，改完立刻重載。

| 選項 | 預設 | 說明 |
| --- | --- | --- |
| `dailyGoalMl` | `2000` | 每日目標（ml） |
| `servingMl` | `250` | `/water` 一份的容量（ml） |
| `servingUnit` | `杯` | 文案用「杯」或「瓶」 |
| `remindMinutes` | `90` | 超過幾分鐘沒喝就提醒；`0` = 不提醒 |

<details>
<summary>例：用 600ml 水瓶、一天 3 瓶</summary>

| 選項 | 值 |
| --- | --- |
| `dailyGoalMl` | `1800` |
| `servingMl` | `600` |
| `servingUnit` | `瓶` |

之後 `/water` 一次記一瓶，狀態列顯示 `💧 1/3 瓶 (600/1800ml)`。

</details>

## 🌱 精靈進化

累計達標天數（不必連續）決定精靈的樣子：

| 累計達標 | 階段 | 顏色 |
| :---: | --- | --- |
| 0 天 | 青苔寶寶 | 🟢 綠 |
| 3 天 | 水精靈 | 🔵 藍 |
| 7 天 | 晨光精靈 | 🟡 黃 |
| 14 天 | 珊瑚精靈 | 🔴 紅 |

「連續達標」另外計算：昨天或今天有達標才算連續中，斷一天就從 1 重新開始。

## 🛠️ 開發

需要 Claude Code CLI。

```bash
git clone git@github.com:VagrantPi/water-eif.git
cd water-eif

# 直接從資料夾載入，存檔就熱重載
claude --plugin-dir .

# 檢查 manifest 與 hooks
claude plugin validate .

# 跑測試
claude plugin test .
```

<details>
<summary>專案結構</summary>

```
.
├── .claude-plugin/
│   ├── plugin.json        # 名稱、版本、使用者設定欄位
│   └── marketplace.json   # 讓這個 repo 能直接 /plugin install
├── hooks/
│   ├── hooks.json         # 指向 register.tsx
│   ├── register.tsx       # 指令、計時器、面板繪製
│   ├── sprites.ts         # 像素精靈資料（由腳本產生，勿手改）
│   └── water.test.ts      # 測試
└── types/index.d.ts       # $.state 型別契約
```

</details>

<details>
<summary>運作方式</summary>

- **紀錄**：每天一筆 `day:YYYY-MM-DD`（本機時區），存在 `$.store`，跨 session 保留。
- **計時**：每分鐘檢查換日、更新心情、決定是否提醒；每 150ms 推一格動畫。
- **繪圖**：一個字元格放上下兩個像素（`▀` 前景是上、背景是下），14×16 像素的精靈剛好佔 14×8 格。

</details>

## 🙏 致謝

- 精靈圖素：["Animated Slime"](https://opengameart.org/content/animated-slime) by **Calciumtrice**，以 [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) 授權。裁切成 14×16 像素並轉為終端機彩色字元格，詳見 [CREDITS.md](CREDITS.md)。

## 📄 授權

程式碼以 [MIT](LICENSE) 授權。精靈圖素另依 CC-BY 3.0，轉載請保留上方署名。

<div align="center">

**喝水了沒？ 💧** 打一下 `/water` 吧。

</div>
