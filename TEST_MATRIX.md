# Mobile Fixes Test Matrix

Test verification plan for PRs #9, #10, #11 (v13 mobile support).
All three PRs are identical duplicates of the same v12-to-v13 changeset.

Last Updated: 2026-03-17

---

## A. Settings Cog Interaction on Mobile

The settings interceptor detects `m.youtube.com` via hostname check and intercepts the mobile bottom sheet menu instead of the desktop `.ytp-settings-menu`. When the user taps "Playback speed" in the bottom sheet, the extension closes the sheet and renders a custom full-width bottom-sheet-style speed panel (0.25x to 8x).

### Test Scenarios

| # | Browser | OS | Scenario | Steps | Expected Behavior | Pass/Fail Criteria |
|---|---------|-----|----------|-------|--------------------|--------------------|
| A1 | Chrome | Android 13+ | Open speed panel from bottom sheet | 1. Open m.youtube.com, play a video. 2. Tap the 3-dot menu. 3. Tap "Playback speed". | YouTube's native speed menu is intercepted. A custom full-width bottom sheet panel appears with speeds 0.25x to 8x. | Panel renders at bottom of screen, full-width, border-radius 12px top corners, max-height 60vh, current speed highlighted. |
| A2 | Chrome | Android 13+ | Select speed from custom panel | Continue from A1. Tap a speed (e.g., 3x). | Video speed changes to 3x. Panel closes. Speed persists on refresh. | `video.playbackRate === 3`. GM storage updated. On page reload, speed is restored. |
| A3 | Chrome | Android 13+ | Back button in custom panel | Continue from A1. Tap the back arrow in the panel header. | Panel closes. The mobile 3-dot menu re-opens (via `button.player-settings-icon` click). | Panel removed from DOM. YouTube's settings bottom sheet reappears. |
| A4 | Chrome | Android 13+ | Dismiss panel by tapping outside | Continue from A1. Tap outside the panel (on the video area). | Panel closes. | Panel removed from DOM. No speed change. |
| A5 | Firefox | Android 13+ | Open and use speed panel | Same as A1-A2. | Same as A1-A2. Firefox Android supports Tampermonkey via add-ons. | Panel renders correctly, speed changes, persists. |
| A6 | Kiwi Browser | Android | Open and use speed panel | Same as A1-A2. Kiwi supports Chrome extensions natively. | Same as A1-A2. | Panel renders correctly, speed changes, persists. |
| A7 | Safari | iOS 16+ | Open and use speed panel | Same as A1-A2 using Userscripts app (App Store) or Stay extension. | Same as A1-A2. iOS uses m.youtube.com in Safari. | Panel renders, speed changes. Note: GM_getValue/GM_setValue support varies by userscript manager on iOS. |
| A8 | Safari | iOS 16+ | Panel scroll on small screen | Open panel on a phone with small viewport. | Panel scrolls vertically within 60vh constraint. All speed options accessible. | `overflow-y: auto` works. No content cut off. |
| A9 | Chrome | Android | SPA navigation resets interception | 1. Use speed panel on a video. 2. Navigate to another video via suggestion. 3. Open 3-dot menu again. | Bottom sheet interception re-attaches after `yt-navigate-finish`. Speed panel works on the new video. | `_ytsIntercepted` flag cleared and re-attached. Panel functional on second video. |

---

## B. Long-Press 2x Toggle

v13 extended the Shorts-only tap-to-toggle to a long-press toggle on all videos. On Shorts, behavior is unchanged (tap left half toggles). On regular mobile videos, a 400ms long-press on the video area toggles 2x speed on/off.

### Test Scenarios: Regular Videos

| # | Browser | OS | Scenario | Steps | Expected Behavior | Pass/Fail Criteria |
|---|---------|-----|----------|-------|--------------------|--------------------|
| B1 | Chrome | Android 13+ | Long-press activates 2x | 1. Play a regular video on m.youtube.com. 2. Long-press (hold 400ms+) on the video area. | Speed changes to 2x. Blue-bordered overlay shows "2.0x". | `video.playbackRate === 2`. Overlay visible with `.yt-speed-boost-active` class. |
| B2 | Chrome | Android 13+ | Long-press deactivates 2x | Continue from B1. Long-press again on the video area. | Speed restores to saved speed (from GM storage, e.g., 1.5x). Overlay hides. | `video.playbackRate === getSpeed()`. Overlay hidden. |
| B3 | Chrome | Android 13+ | Touch on controls excluded | 1. Play a video. 2. Long-press on the player controls bar (play/pause, seekbar, fullscreen). | No speed change. YouTube's native control behavior works normally. | `isExcludedTarget` returns true. No boost toggle. |
| B4 | Chrome | Android 13+ | Touch on comments excluded | Scroll to comments section. Long-press on a comment. | No speed change. Native text selection or context menu behavior. | `ytm-comment-section-renderer` matched by exclusion selector. |
| B5 | Chrome | Android 13+ | Swipe cancels long-press | 1. Start long-press on video. 2. Move finger >10px before 400ms. | Long-press timer cancelled. No speed change. | `swipedAway` flag set, `longPressTimer` cleared. |
| B6 | Chrome | Android 13+ | Deactivate restores saved speed | 1. Set speed to 1.75x via settings panel. 2. Long-press to activate 2x. 3. Long-press to deactivate. | Speed returns to 1.75x (not 1.0x). | `deactivateBoost()` calls `getSpeed()` for regular videos, not `DEFAULT_SPEED`. |
| B7 | Firefox | Android | Long-press toggle works | Same as B1-B2. | Same as B1-B2. | Touch events fire correctly in Firefox Android. |
| B8 | Safari | iOS 16+ | Long-press toggle works | Same as B1-B2. | Same as B1-B2. Note: iOS may have different touch event timing. | Verify 400ms threshold is sufficient on iOS (no premature firing). |

### Test Scenarios: Shorts

| # | Browser | OS | Scenario | Steps | Expected Behavior | Pass/Fail Criteria |
|---|---------|-----|----------|-------|--------------------|--------------------|
| B9 | Chrome | Android 13+ | Tap left half activates 2x | 1. Open a Short. 2. Tap the left half of the screen. | Speed changes to 2x. Overlay shows "2.0x". | `video.playbackRate === 2`. Tap registered (`elapsed < 300ms`, no movement). |
| B10 | Chrome | Android 13+ | Tap left half deactivates 2x | Continue from B9. Tap left half again. | Speed returns to 1.0x. Overlay hides. | `deactivateBoost()` uses `DEFAULT_SPEED` (1.0) for Shorts. |
| B11 | Chrome | Android 13+ | Long-press on Shorts deactivates | 1. Activate boost via tap. 2. Long-press left half (400ms+). | Speed returns to 1.0x. `gestureConsumed` flag prevents tap-on-release from re-activating. | No double-toggle. Boost cleanly off after one long-press. |
| B12 | Chrome | Android 13+ | Right half tap ignored | Tap the right half of a Short. | No speed change. YouTube handles the tap normally (like/share panel, etc). | `touch.clientX >= window.innerWidth / 2` check blocks the gesture. |
| B13 | Chrome | Android 13+ | Double-tap guard | Double-tap the left half quickly (<250ms between taps). | First tap's toggle is cancelled. YouTube's native double-tap (seek forward) fires instead. | `tapDebounceTimer` cleared on second tap. No speed toggle. |
| B14 | Chrome | Android 13+ | Swipe between Shorts resets | 1. Activate boost on Short A. 2. Swipe up to Short B. | Boost deactivates on Short A. Short B plays at normal speed. | MutationObserver detects active video change, calls `resetBoostState()`. |
| B15 | Chrome | Android 13+ | SPA navigation resets | 1. Activate boost on a Short. 2. Navigate away (tap Home, search, etc). | Boost deactivates. | `yt-navigate-finish` event triggers `resetBoostState()`. |

---

## C. Speed Persistence Across Navigation

| # | Browser | OS | Scenario | Steps | Expected Behavior | Pass/Fail Criteria |
|---|---------|-----|----------|-------|--------------------|--------------------|
| C1 | Chrome | Android | Speed persists: video to video | 1. Set speed to 2.5x on video A. 2. Click a suggested video (SPA nav). | Video B plays at 2.5x. | GM_getValue returns 2.5. `applySpeedToAll` called on new video detection. |
| C2 | Chrome | Android | Speed persists: video to Shorts | 1. Set speed to 2x. 2. Navigate to Shorts. | Short plays at 2x (the saved speed, applied via MutationObserver). | Speed maintained across content types. |
| C3 | Chrome | Android | Speed persists: page refresh | 1. Set speed to 3x. 2. Refresh the page (pull-to-refresh or browser refresh). | Video resumes at 3x after reload. | GM_setValue stores 3x. On reload, GM_getValue retrieves it. |
| C4 | Chrome | Android | Speed persists: close and reopen | 1. Set speed to 1.5x. 2. Close the tab. 3. Open a new YouTube video. | New video plays at 1.5x. | GM storage survives tab close. |
| C5 | Chrome | Android | Boost does not persist | 1. Long-press to activate 2x boost. 2. Navigate to another video. | New video plays at saved speed (not 2x). Boost state resets. | `boostState` reset to `idle` on navigation. Saved speed (not boost speed) applied. |
| C6 | Safari | iOS | Speed persists across sessions | Same as C3-C4. | Same results, assuming the userscript manager supports persistent GM storage. | Verify Userscripts app / Stay extension supports GM_getValue/GM_setValue persistence. |

---

## D. Mobile Bottom Sheet Selector Validity

The following selectors are used to find and interact with YouTube's mobile bottom sheet menu. YouTube changes these periodically.

### Current Selectors (as of 2026-03-17)

| Selector | Purpose | Known DOM Context | Risk Level |
|----------|---------|-------------------|------------|
| `ytm-bottom-sheet-renderer` | Primary bottom sheet container on m.youtube.com | Custom element. Wraps the slide-up menu when tapping 3-dot on mobile player. | **Medium**: YouTube has used this element name since ~2023. Could be renamed in major mobile web redesigns. |
| `ytm-menu-renderer` | Fallback menu container | Older/alternate menu renderer. Sometimes used for non-player menus. | **Medium**: May not always contain speed options. Acts as fallback. |
| `.bottom-sheet` | Generic fallback class | CSS class-based fallback for any bottom-sheet-like UI. | **Low risk of false positive, high risk of miss**: YouTube may use different class names. |
| `ytm-menu-service-item-renderer` | Primary menu item in bottom sheet | Custom element for each action row (Speed, Quality, Captions, etc). Contains icon + text. | **Medium**: Main target. Name tied to YouTube's internal component naming. |
| `ytm-menu-item` | Fallback menu item | Simpler menu item variant. | **Low**: Rarely used in current DOM, kept as fallback. |
| `[class*="menu-item"]` | Broad class-based fallback | Matches any element with "menu-item" in a class name. | **High false positive risk**: Could match unrelated elements. The text-content check (`includes('speed')`) mitigates this. |
| `button` (inside sheet) | Last-resort fallback | Matches any button in the sheet. | **High false positive risk**: Same mitigation via text-content matching. |

### Known YouTube Mobile DOM Structure (m.youtube.com, 2026-03)

```
<ytm-app>
  <ytm-mobile-topbar-renderer>  (top navigation bar)
  <ytm-browse-feed-renderer>    (home feed / search results)
  <ytm-single-column-watch-next-renderer>  (watch page wrapper)
    <ytm-player>
      <div class="player-container">
        <video>                  (the actual video element)
      </div>
      <div class="player-controls-top">
        <button class="player-settings-icon">  (3-dot / settings)
      </div>
      <div class="player-controls-bottom">
        <div class="progress-bar">
      </div>
    </ytm-player>
    <ytm-item-section-renderer>  (video info, comments)
      <ytm-slim-owner-renderer>  (channel info)
      <ytm-comment-section-renderer>  (comments)
    </ytm-item-section-renderer>
  </ytm-single-column-watch-next-renderer>

  <!-- Bottom sheet appears as overlay when 3-dot tapped -->
  <ytm-bottom-sheet-renderer>
    <div class="bottom-sheet-header">
      <button class="close-button">  (X to dismiss)
    </div>
    <div class="bottom-sheet-content">
      <ytm-menu-service-item-renderer>  (Playback speed)
      <ytm-menu-service-item-renderer>  (Quality)
      <ytm-menu-service-item-renderer>  (Captions)
      <ytm-menu-service-item-renderer>  (Report)
    </div>
  </ytm-bottom-sheet-renderer>
  <div class="bottom-sheet-scrim">  (dark overlay behind sheet)
</ytm-app>
```

**Verification notes:**
- The DOM structure above is based on inspection patterns documented in v13 development. It should be verified against the live m.youtube.com site, as YouTube ships mobile web updates frequently (often weekly).
- `ytm-bottom-sheet-renderer` has been stable since at least mid-2023 but is not guaranteed.
- The `button.player-settings-icon` selector for the mobile settings button is less stable; YouTube has used various class names for this button across updates.
- The `bottom-sheet-scrim` class for the dismiss overlay is a common pattern but may be renamed.

---

## E. YouTube Native Long-Press Conflicts

YouTube has its own long-press behaviors on mobile that may conflict with the extension's 400ms long-press toggle.

### Known Native Long-Press Behaviors

| Platform | Context | Native Behavior | Conflict Risk | Mitigation in v13 |
|----------|---------|-----------------|---------------|-------------------|
| Android Chrome | Regular video | Long-press shows video preview / "picture in picture" prompt (varies by Android version and Chrome flags). | **Medium**: Both the extension and Chrome may respond to the same gesture. | The extension uses `passive: true` listeners, so it does not call `preventDefault()`. Chrome's native behavior may still fire alongside the boost toggle. |
| Android Chrome | Regular video | Long-press on the progress bar opens a seek scrubber. | **None**: Progress bar is in `.player-controls-bottom`, which is in the `touchExcluded` list. | Excluded via `isExcludedTarget`. |
| Android Chrome | Shorts | Long-press and hold shows a preview/share sheet (YouTube's own feature, rolled out mid-2025). | **High**: On Shorts, the extension listens for long-press on the left half. YouTube's native long-press preview also fires on the video area. | Partial mitigation: extension uses `gestureConsumed` flag and doesn't call `preventDefault()`. However, both the extension's speed toggle and YouTube's preview may fire simultaneously. |
| iOS Safari | Regular video | Long-press shows a context menu (Open Link, Share, etc) if the video is inside a link wrapper. | **Low**: YouTube's mobile web player video element is typically not wrapped in an anchor tag. | If it does fire, the extension's boost toggle will also fire (no conflict prevention). |
| iOS Safari | Regular video | Long-press triggers haptic feedback and text selection on nearby text elements. | **None**: Text elements, buttons, and interactive elements are in the `touchExcluded` list. | Excluded via `isExcludedTarget`. |
| Android Firefox | Regular video | Similar to Chrome but Firefox's long-press behavior varies. May show "Open in new tab" or context menu. | **Low**: Firefox Android touch event handling is generally compatible. | Same passive listener approach. |

### Recommendations

1. **Shorts long-press preview conflict**: YouTube's native long-press preview on Shorts (showing a share/preview card) is the most likely conflict. Consider increasing the extension's long-press threshold from 400ms to 500-600ms to reduce overlap with YouTube's gesture, or adding detection for YouTube's preview overlay appearing.

2. **Android PiP conflict**: Some Android devices trigger Picture-in-Picture on long-press. This is OS-level and cannot be intercepted by the extension. Users may see both PiP activation and speed boost. The workaround is to disable PiP in Android settings if it conflicts.

3. **No `preventDefault()` by design**: The extension intentionally uses `passive: true` on all touch listeners, meaning it cannot block native behaviors. This is a deliberate trade-off: blocking native gestures would break scrolling and other touch interactions. The downside is that native long-press behaviors may fire alongside the extension's speed toggle.

4. **Testing priority**: The Shorts long-press conflict (row 3 above) should be tested first, as it is the most user-visible and most likely to cause confusion.
