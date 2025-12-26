# youtubeSpeedSetAndRemember
Lets you set speeds up to 8x and remembers preset speed when you return to the page.

# 🚀 YouTube Native Speed Menu Hack

![Version](https://img.shields.io/badge/version-7.0-blue.svg) ![YouTube](https://img.shields.io/badge/YouTube-Compatible-red.svg) ![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Supported-green.svg)

A powerful Tampermonkey userscript that replaces the standard YouTube playback speed menu with a high-precision control panel. It integrates seamlessly into the native YouTube settings UI, allowing playback speeds from **0.1x up to 8.0x**.

## ✨ Features

* **Integrated UI:** Does not create ugly floating boxes. It completely replaces the contents of the native "Playback speed" settings submenu.
* **Granular Slider:** Precision control slider ranging from `0.1x` to `8.0x`.
* **Quick-Select Buttons:** Preset buttons for common speeds (`0.25x`, `0.5x`, `1x`, `1.25x`, `1.5x`, `2x`, `2.5x`, `3x`, `4x`).
* **Speed Persistence:** Includes a **"Remember Speed"** toggle switch.
    * **On (Default):** YouTube will automatically apply your last used speed to every new video you watch.
    * **Off:** Videos start at normal speed, but the slider remains available for manual adjustment.
* **Smart Labeling:** Updates the main Settings menu label to show the exact speed (e.g., `3.45x`) instead of the generic "Custom".
* **TrustedHTML Safe:** Uses strict DOM creation methods to bypass YouTube's security policies and prevent console errors.
* **Aggressive Persistence:** Uses `MutationObservers` to ensure the controls stay visible even when YouTube dynamically re-renders the player.

## 📥 Installation

1.  **Install a Userscript Manager:**
    * [Tampermonkey](https://www.tampermonkey.net/) (Recommended for Chrome/Edge/Firefox)
    * [Violentmonkey](https://violentmonkey.github.io/)

2.  **Add the Script:**
    * Click on the Tampermonkey icon in your browser.
    * Select **"Create a new script..."**.
    * Delete any default code and paste the content of `script.js` (or the latest version provided).
    * Press `Ctrl+S` or `Cmd+S` to save.

## 🎮 How to Use

1.  Open any YouTube video.
2.  Click the **Settings (Gear Icon)** ⚙️ in the video player.
3.  Click on **Playback speed**.
4.  You will see the new **Speed Control** interface:
    * **Slider:** Drag to set any speed between 0.1x and 8x.
    * **Buttons:** Click for instant preset speeds.
    * **Toggle:** Switch "Remember speed" on or off.

## 🛠 Technical Details

YouTube uses a complex Single Page Application (SPA) architecture (Polymer/Lit) and strict Content Security Policies (Trusted Types).

* **Bypassing TrustedHTML:** This script avoids `.innerHTML` entirely, using `document.createElement` to build the UI programmatically.
* **Handling Re-renders:** YouTube frequently wipes the settings menu DOM. This script uses a `MutationObserver` to detect when the speed menu is opened and immediately re-injects the custom controls before the user notices.
* **State Management:** Speed preferences are stored in the browser's `localStorage` (`yt-custom-speed-value` and `yt-custom-speed-remember`).

## 🤝 Troubleshooting

* **The menu disappeared:** Close the settings menu and open it again. The observer usually re-attaches immediately.
* **Video stuttering:** Speeds above 4x may cause buffering or stuttering depending on your internet connection and computer hardware.
* **Script not loading:** Ensure Tampermonkey is enabled and the script is toggled "On".

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Disclaimer: This script is not affiliated with or endorsed by YouTube or Google.*
