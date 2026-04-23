# void-chat Mobile UX Manual QA Checklist
## iPhone 430px (iPhone 12/13/14/15 Pro Max) Testing Guide

---

## Device Setup & Environment

### Recommended Devices
- **Primary**: iPhone 14 or 15 Pro Max (430px width)
- **Secondary**: iPhone 12, 13 (for cross-version compatibility)
- **Fallback**: Safari DevTools on macOS with iPhone 430px viewport emulation

### System Configuration
| Setting | Recommended Value | Purpose |
|---------|------------------|---------|
| **iOS Version** | Latest available (17.x+) | Baseline compatibility |
| **Display Zoom** | Standard (not Zoomed) | Accurate viewport sizing |
| **Font Size** | Default | Consistent text rendering |
| **Brightness** | Auto (day/night mix) | Test readability in various lighting |
| **Network** | WiFi + 4G LTE (test both) | Identify network-dependent issues |
| **Accessibility** | Default + VoiceOver (one test) | Basic a11y validation |

### Testing Conditions
- **Time**: Test during both day and night modes
- **Orientation**: Portrait primary, Landscape for edge cases
- **Keyboard**: Both system keyboard and 3rd-party keyboards (Gboard)
- **Network**: WiFi stable, then throttled 3G/LTE via dev console

### Pre-Test Checklist
- [ ] Backend is running (`npm run dev` in frontend, `make run` in backend)
- [ ] Frontend dev server at `http://localhost:5173`
- [ ] Backend API responding at `http://localhost:8000/api/health`
- [ ] Redis is running (for sessions and chat)
- [ ] PostgreSQL has test data loaded
- [ ] Clear browser cache and localStorage before starting
- [ ] Disable any browser extensions that inject CSS/JS

---

## Test Scenarios by Feature Area

### 1. MESSAGING & TEXT DISPLAY

#### 1.1 Message Rendering on Small Screen
**What to Test:**
1. Load a room with existing messages
2. Scroll through the message list
3. Verify message text wraps correctly
4. Check messages with different lengths (short, medium, long)
5. Test messages with URLs, mentions (@user), and code blocks

**Expected Behavior:**
- Messages fit within the 430px width with no horizontal scrolling
- Text wraps at word boundaries
- Mentions are highlighted in cyan/blue
- URLs are clickable and visibly distinct
- Long words (URLs, mentions) break gracefully without overflow

**Acceptance Criteria:**
- ✅ No horizontal scrolling in message list
- ✅ All text is readable at default font size
- ✅ Line length doesn't exceed container width
- ✅ Mentions and links are visually distinct and interactive

**Common Issues to Watch:**
- ❌ Text overflow causing horizontal scrollbar
- ❌ Code blocks or URLs breaking layout
- ❌ Mentions not highlighted
- ❌ Links not clickable on touch

---

#### 1.2 Message Timestamps & Metadata
**What to Test:**
1. Send a new message and verify timestamp appears
2. Hover/tap message to see full timestamp
3. Check user avatars and names display
4. Verify system messages (user joined, left) format correctly

**Expected Behavior:**
- Timestamps display in compact format (e.g., "2:34 PM")
- Timestamps are readable and don't cause message height to collapse
- User names appear next to avatars
- System messages are visually distinct (gray/dim color)

**Acceptance Criteria:**
- ✅ Timestamps readable and properly positioned
- ✅ User names don't overflow or wrap awkwardly
- ✅ System messages visually distinct
- ✅ Message spacing is consistent

**Common Issues to Watch:**
- ❌ Timestamps stacking or hiding messages
- ❌ User names overflowing avatar container
- ❌ System messages indistinguishable from regular messages

---

#### 1.3 Image & File Message Display
**What to Test:**
1. Send/receive an image message
2. Verify image fits within 430px width
3. Tap image to expand/preview (if applicable)
4. Test file messages with various file types
5. Verify download links are accessible

**Expected Behavior:**
- Images display at max 400px width (leaving margins)
- Images maintain aspect ratio
- File messages show clear file icon and name
- Download/open links are functional
- File sizes are visible

**Acceptance Criteria:**
- ✅ Images scale to fit screen without overflow
- ✅ Image quality is acceptable
- ✅ File messages clearly labeled with type icon
- ✅ File operations (download/preview) work

**Common Issues to Watch:**
- ❌ Images extending beyond screen width
- ❌ Image distortion or aspect ratio issues
- ❌ File links not tappable
- ❌ Missing file type indicators

---

### 2. NAVIGATION & HEADER

#### 2.1 Top Navigation Bar
**What to Test:**
1. Load any page and verify header is visible
2. Check header height is appropriate for touch (44px minimum tap target)
3. Verify room name/title in header is readable
4. Test back button (if navigation stack exists)
5. Check menu button position and accessibility

**Expected Behavior:**
- Header stays visible at top of screen
- Room name is clearly displayed and truncates if too long
- Back button appears when appropriate
- Menu/options button is easily tappable
- No header content overlaps with messages

**Acceptance Criteria:**
- ✅ Header height ≥ 44px for touch targets
- ✅ Room name readable, not cut off
- ✅ All buttons easily tappable (min 44x44px touch target)
- ✅ No overlap or visual clipping

**Common Issues to Watch:**
- ❌ Header too small for comfortable tapping
- ❌ Room name truncated or overflowing
- ❌ Buttons too close together
- ❌ Header blocking message content

---

#### 2.2 Sidebar/Navigation Menu
**What to Test:**
1. Open sidebar/navigation drawer
2. Verify it opens from left edge and doesn't cover content
3. Check room list displays correctly in sidebar
4. Test scrolling within sidebar
5. Verify close button or tap-to-close works
6. Test switching between rooms from sidebar

**Expected Behavior:**
- Sidebar slides in smoothly without blocking messages
- Room list is scrollable if > 5 rooms
- Current room is visually highlighted
- Closing sidebar returns to message view
- Switching rooms loads new room immediately

**Acceptance Criteria:**
- ✅ Sidebar gesture is responsive (swipe from left edge)
- ✅ Room list readable with clear visual hierarchy
- ✅ Current room clearly marked
- ✅ Sidebar close is intuitive (back button or swipe)

**Common Issues to Watch:**
- ❌ Sidebar covers message area
- ❌ Room list text too small or cramped
- ❌ Difficult to close sidebar
- ❌ Slow room switching

---

#### 2.3 Bottom Tab Navigation (if applicable)
**What to Test:**
1. Verify tabs are at bottom of screen
2. Check tab touch targets (44px minimum)
3. Test switching between tabs
4. Verify active tab is highlighted
5. Check badge notifications appear on tabs

**Expected Behavior:**
- Tabs are positioned at bottom, easily reachable with thumb
- Active tab is clearly highlighted
- Tab switching is instant with no lag
- Badges show unread counts clearly
- Icons are intuitive and recognizable

**Acceptance Criteria:**
- ✅ Tab bar height ≥ 44px
- ✅ Tab icons clear and recognizable
- ✅ Active state visually distinct
- ✅ Tab switching is smooth and instantaneous

**Common Issues to Watch:**
- ❌ Tabs too small or close together
- ❌ Active state unclear
- ❌ Badge counts not updating
- ❌ Lag when switching tabs

---

### 3. INPUT & KEYBOARD INTERACTION

#### 3.1 Message Input Box
**What to Test:**
1. Tap message input field
2. Verify keyboard appears and input is focused
3. Type a message and verify text appears
4. Check input height grows for multi-line messages (optional)
5. Verify input doesn't overlap with keyboard
6. Test send button position and accessibility

**Expected Behavior:**
- Input field has clear focus state (border highlight)
- Keyboard appears and input is visible above it
- Text input is smooth with no lag
- Send button is clearly visible and tappable
- Multi-line input works if supported

**Acceptance Criteria:**
- ✅ Input field minimum 44px height
- ✅ Send button ≥ 44x44px touch target
- ✅ Input visible above keyboard (no overlap)
- ✅ No typing lag or jank

**Common Issues to Watch:**
- ❌ Input field too small to tap easily
- ❌ Keyboard covers input or messages
- ❌ Send button not visible or tappable
- ❌ Typing lag or character loss

---

#### 3.2 Keyboard Handling & Dismissal
**What to Test:**
1. Open keyboard and type a message
2. Tap send button and verify keyboard dismisses
3. Scroll message list and verify keyboard dismisses
4. Tap input again and verify keyboard reopens
5. Test with hardware keyboard (if available)

**Expected Behavior:**
- Keyboard dismisses automatically after sending
- Keyboard dismisses when scrolling message list
- Keyboard reopens immediately when tapping input
- No keyboard state issues or stuck focus

**Acceptance Criteria:**
- ✅ Keyboard behavior is predictable and consistent
- ✅ Keyboard dismisses appropriately
- ✅ No stuck or floating keyboard
- ✅ Focus state is correct after actions

**Common Issues to Watch:**
- ❌ Keyboard doesn't dismiss after send
- ❌ Keyboard blocks message list while scrolling
- ❌ Keyboard reopens unexpectedly
- ❌ Input focus lost after action

---

#### 3.3 Text Input Features (Emoji, Copy/Paste)
**What to Test:**
1. Type emoji using system keyboard
2. Copy and paste text into input
3. Long-press input field for edit menu
4. Test text selection and formatting
5. Verify clear/reset input works

**Expected Behavior:**
- Emoji picker is accessible and works
- Copy/paste operations work smoothly
- Long-press menu appears with standard options
- Text selection works without issues
- Input can be cleared easily

**Acceptance Criteria:**
- ✅ Emoji input works and displays correctly
- ✅ Copy/paste is reliable
- ✅ Edit menu is accessible
- ✅ No text corruption or encoding issues

**Common Issues to Watch:**
- ❌ Emoji not displaying or rendering
- ❌ Copy/paste breaking layout or encoding
- ❌ Edit menu not appearing
- ❌ Text selection not working

---

### 4. SIDEBAR & USER LIST

#### 4.1 Sidebar Display & Scrolling
**What to Test:**
1. Open sidebar and verify width is appropriate (not too wide)
2. Check room list is readable with good spacing
3. Test scrolling in room list if > 5 rooms
4. Verify room list doesn't have horizontal scrolling
5. Check search/filter if available

**Expected Behavior:**
- Sidebar width is 60-70% of screen or fixed ~260px
- Room items have clear visual separation
- Scrolling is smooth and doesn't lag
- No horizontal scrolling in room list
- Search results display correctly

**Acceptance Criteria:**
- ✅ Sidebar width appropriate for 430px screen
- ✅ Room names readable without truncation (or with ellipsis)
- ✅ Scrolling is smooth
- ✅ No overflow or horizontal scrolling

**Common Issues to Watch:**
- ❌ Sidebar too wide (>50% of screen)
- ❌ Room names truncated without ellipsis
- ❌ Scrolling lag or stutter
- ❌ Unread badges misaligned

---

#### 4.2 User List in Room
**What to Test:**
1. Open user list (if available in header or settings)
2. Verify user avatars and names display correctly
3. Check user status indicators (online/offline)
4. Test scrolling if room has many users
5. Verify tap user for profile/DM works

**Expected Behavior:**
- User list displays clearly with avatars
- User names are readable
- Status indicators are visible and correct
- Scrolling is smooth if many users
- User actions (profile, DM) work

**Acceptance Criteria:**
- ✅ User avatars are visible and well-sized (32-40px)
- ✅ User names readable without truncation
- ✅ Status indicators clear
- ✅ User list is scrollable if needed

**Common Issues to Watch:**
- ❌ User avatars too small or overlapping
- ❌ User names truncated or overflowing
- ❌ Status indicators missing or unclear
- ❌ Difficult to tap user for actions

---

### 5. MODALS & FORMS

#### 5.1 Modal Dialogs (Create Room, Settings, etc.)
**What to Test:**
1. Open a modal from the UI (e.g., create room, user profile)
2. Verify modal content fits within 430px
3. Check modal close button is accessible
4. Verify form fields are properly sized for touch
5. Test scrolling within modal if content overflows

**Expected Behavior:**
- Modal appears centered and doesn't exceed screen width
- Close button (X) is visible and tappable
- Form inputs are at least 44px tall
- Modal content is readable and well-organized
- Scrolling within modal works smoothly

**Acceptance Criteria:**
- ✅ Modal doesn't exceed screen width
- ✅ Close button is tappable (≥44x44px)
- ✅ Form inputs are touch-friendly (≥44px height)
- ✅ Modal content is readable and scrollable

**Common Issues to Watch:**
- ❌ Modal extends beyond screen edges
- ❌ Close button too small or hard to find
- ❌ Form inputs too small for comfortable typing
- ❌ Modal content cut off or unscrollable

---

#### 5.2 Form Input Fields
**What to Test:**
1. Tap each form input to verify focus state
2. Type in text fields and verify character input
3. Test input validation and error messages
4. Check dropdown/select fields
5. Verify submit button is visible and accessible

**Expected Behavior:**
- Input fields show clear focus state (border highlight)
- Typing is smooth with no lag
- Validation errors display clearly below input
- Error text is red and readable
- Submit button is visible and properly positioned

**Acceptance Criteria:**
- ✅ Input fields minimum 44px height
- ✅ Focus state clearly visible
- ✅ Error messages readable and actionable
- ✅ Submit button ≥44x44px touch target

**Common Issues to Watch:**
- ❌ Input fields too small for comfortable use
- ❌ Focus state unclear or missing
- ❌ Error messages hidden or unreadable
- ❌ Submit button overlapped by keyboard

---

#### 5.3 Dropdowns & Selectors
**What to Test:**
1. Tap dropdown field to open options
2. Verify all options are visible and scrollable
3. Tap an option to select and verify result
4. Test multi-select if available
5. Check dropdown closes properly

**Expected Behavior:**
- Dropdown opens smoothly with options visible
- Options are clearly readable
- Selecting an option closes dropdown
- Selected value displays correctly
- No options are cut off or hidden

**Acceptance Criteria:**
- ✅ Dropdown options are readable and accessible
- ✅ Selected value displays correctly
- ✅ Dropdown behavior is predictable
- ✅ No options hidden or cut off

**Common Issues to Watch:**
- ❌ Dropdown extends off-screen
- ❌ Options too small or unreadable
- ❌ Dropdown doesn't close after selection
- ❌ Selected value not displaying

---

### 6. TOUCH & TAP TARGETS

#### 6.1 Button & Interactive Element Sizing
**What to Test:**
1. Identify all buttons and interactive elements
2. Verify each button is at least 44x44px (iOS standard)
3. Test spacing between buttons (minimum 8px)
4. Verify buttons are easily tappable without accidentally tapping neighbors
5. Check visual feedback on tap (highlight, ripple, etc.)

**Expected Behavior:**
- All buttons are minimum 44x44px
- Buttons have visible press/tap feedback
- Buttons are well-spaced to avoid mis-taps
- Visual feedback is instant and clear
- No buttons are too close together

**Acceptance Criteria:**
- ✅ All interactive elements ≥44px in both dimensions
- ✅ Tap feedback is immediate and visible
- ✅ Button spacing prevents mis-taps
- ✅ Tap targets have adequate padding

**Common Issues to Watch:**
- ❌ Buttons smaller than 44x44px
- ❌ Buttons too close together
- ❌ No tap feedback or delayed feedback
- ❌ Accidental taps triggering wrong action

---

#### 6.2 Touch Gestures
**What to Test:**
1. Test swipe left/right to close modals
2. Test long-press for context menus
3. Test pinch to zoom (if supported)
4. Test double-tap to like/react (if supported)
5. Verify gesture responses are smooth

**Expected Behavior:**
- Swipe gestures are responsive and smooth
- Long-press shows context menu after ~0.5s
- Zoom gestures work without breaking layout
- Double-tap actions work reliably
- No conflicting gesture behaviors

**Acceptance Criteria:**
- ✅ Swipe gestures are responsive
- ✅ Long-press context menu appears reliably
- ✅ Gestures don't interfere with scrolling
- ✅ No gesture conflicts or unexpected behavior

**Common Issues to Watch:**
- ❌ Gesture not recognized or ignored
- ❌ Gesture response lag or delay
- ❌ Gestures interfering with scrolling
- ❌ Multiple gestures triggering simultaneously

---

#### 6.3 Scrolling Performance
**What to Test:**
1. Scroll message list rapidly
2. Scroll sidebar room list
3. Verify scrolling is smooth at 60 FPS
4. Check for jank or frame drops
5. Test scroll momentum and deceleration

**Expected Behavior:**
- Scrolling is smooth and responsive
- Content scrolls at high frame rate (no drops)
- Scroll momentum feels natural
- No jank when scrolling past images/media
- Scrolling stops cleanly without bounce

**Acceptance Criteria:**
- ✅ Scrolling smooth at 60 FPS (no visible jank)
- ✅ Responsive to touch
- ✅ Momentum scrolling feels natural
- ✅ Performance maintained with many messages

**Common Issues to Watch:**
- ❌ Scrolling jank or frame drops
- ❌ Lag when scrolling
- ❌ Scroll stops suddenly
- ❌ Performance degradation with many messages

---

### 7. PERFORMANCE & ANIMATIONS

#### 7.1 Page Load & Navigation Performance
**What to Test:**
1. Load room view and measure time to interactive
2. Switch between rooms and verify load time
3. Send a message and verify immediate feedback
4. Navigate to different pages/views
5. Monitor for memory leaks (check dev tools)

**Expected Behavior:**
- Room loads within 1-2 seconds
- Message appears immediately on send (optimistic update)
- Room switching is quick (<500ms)
- No noticeable lag or jank
- App remains responsive

**Acceptance Criteria:**
- ✅ Initial load < 2s
- ✅ Message send feedback < 100ms
- ✅ Room switch < 500ms
- ✅ No visible lag or freezing

**Common Issues to Watch:**
- ❌ Slow page load (>2s)
- ❌ Delayed message send feedback
- ❌ Long room switching time
- ❌ Memory leaks or crashes

---

#### 7.2 Animation & Transition Smoothness
**What to Test:**
1. Open/close sidebar and verify animation is smooth
2. Open/close modals and verify animation smoothness
3. Message list scrolling animation
4. Message arrival animations (if present)
5. Button press/hover animations

**Expected Behavior:**
- Animations are smooth at 60 FPS
- Animations complete within 200-400ms
- No jank or stuttering
- Animations feel responsive to user input
- No animation delays or hangs

**Acceptance Criteria:**
- ✅ Animations smooth and fluid
- ✅ Animation duration 200-400ms (appropriate)
- ✅ No jank or frame drops during animation
- ✅ Responsive feel

**Common Issues to Watch:**
- ❌ Animations stuttering or janky
- ❌ Animations too slow or too fast
- ❌ Animation delays or hangs
- ❌ Frame drops during animation

---

#### 7.3 Network Performance
**What to Test:**
1. Test on WiFi and verify data loading
2. Test on 4G LTE network
3. Throttle network to 3G (via DevTools) and test
4. Send a message on slow network and verify behavior
5. Test offline behavior if supported

**Expected Behavior:**
- App works smoothly on WiFi
- App functional on 4G LTE (slight delay acceptable)
- App usable on 3G (slower but responsive)
- Message send retries or queues on slow network
- Clear indication of network status

**Acceptance Criteria:**
- ✅ WiFi: No noticeable lag
- ✅ 4G: Acceptable performance with minor delays
- ✅ 3G: Functional, slower but not broken
- ✅ Network status indicated to user

**Common Issues to Watch:**
- ❌ Broken on slow networks
- ❌ Message loss on poor connection
- ❌ No network status indication
- ❌ Excessive data usage

---

### 8. EDGE CASES & ACCESSIBILITY

#### 8.1 Long Content Handling
**What to Test:**
1. Send a very long message (500+ characters)
2. Send message with very long URL
3. Send message with many emoji
4. Test room with 100+ messages
5. Test user list with 50+ users

**Expected Behavior:**
- Long messages wrap correctly
- URLs break gracefully (don't cause overflow)
- Many emoji render without issues
- App doesn't slow down with many messages
- User list remains scrollable and responsive

**Acceptance Criteria:**
- ✅ Long content handled gracefully
- ✅ No overflow or layout breaking
- ✅ Performance maintained
- ✅ Content remains readable

**Common Issues to Watch:**
- ❌ Content overflow breaking layout
- ❌ Performance degradation
- ❌ Memory issues
- ❌ Unreadable content

---

#### 8.2 Various Text Sizes & Fonts
**What to Test:**
1. Test with iOS default font size
2. Test with iOS large font size setting (+2 sizes)
3. Test with bold text setting (if available)
4. Verify no text clipping or overflow
5. Check emoji render correctly

**Expected Behavior:**
- Text remains readable at all sizes
- Layout doesn't break with larger fonts
- Bold text displays correctly
- No text clipping or truncation
- Emoji render properly

**Acceptance Criteria:**
- ✅ Text readable at all default system sizes
- ✅ Layout adapts to font size changes
- ✅ No clipping or overflow
- ✅ Emoji displays correctly

**Common Issues to Watch:**
- ❌ Text too small at large system sizes
- ❌ Layout broken with larger fonts
- ❌ Text clipping
- ❌ Emoji rendering issues

---

#### 8.3 Dark Mode
**What to Test:**
1. Enable Dark Mode in iOS settings
2. Verify app uses dark color scheme
3. Check contrast is readable (WCAG AA minimum)
4. Test all pages and modals in dark mode
5. Verify images/media display correctly

**Expected Behavior:**
- App automatically switches to dark theme
- Colors are readable in dark mode
- Text contrast meets accessibility standards
- No white-on-white or black-on-black issues
- Media displays properly

**Acceptance Criteria:**
- ✅ Dark mode enabled automatically
- ✅ Adequate contrast (WCAG AA: 4.5:1 for normal text)
- ✅ All UI elements visible and readable
- ✅ No glaring colors or broken images

**Common Issues to Watch:**
- ❌ Dark mode not enabled
- ❌ Poor contrast in dark mode
- ❌ White text on light background in dark mode
- ❌ Images too dark or invisible

---

#### 8.4 Landscape Orientation (iPad or Rotated iPhone)
**What to Test:**
1. Rotate device to landscape
2. Verify layout adapts (sidebar might hide, content widens)
3. Check landscape keyboard handling
4. Test all major pages in landscape
5. Verify message input works in landscape

**Expected Behavior:**
- Layout adapts gracefully to landscape
- Content uses available width effectively
- Sidebar may hide or compress
- Keyboard doesn't cover input
- All features work in landscape

**Acceptance Criteria:**
- ✅ Layout responsive to landscape orientation
- ✅ Content properly distributed
- ✅ Keyboard behavior is correct
- ✅ All features accessible in landscape

**Common Issues to Watch:**
- ❌ Layout broken in landscape
- ❌ Content too narrow or wasted space
- ❌ Keyboard covering input
- ❌ Features unavailable in landscape

---

## Regression Testing Checklist

### Desktop (1920×1080)
Test the following on desktop to ensure no breakage:

- [ ] Message rendering and wrapping
- [ ] Sidebar and navigation
- [ ] Message input and sending
- [ ] Modal dialogs (all modals)
- [ ] Dark mode toggle
- [ ] Page load performance
- [ ] Scrolling smoothness
- [ ] All buttons clickable with mouse
- [ ] Keyboard shortcuts (if any)
- [ ] Copy/paste functionality

**Expected**: All desktop features work as before, no mobile styles affecting desktop.

### Tablet/iPad (if available)
Test the following on iPad/tablet at 768px width or larger:

- [ ] Sidebar visibility (might show permanently)
- [ ] Message list width (might be wider)
- [ ] Form fields and inputs
- [ ] Modal dialogs
- [ ] Navigation transitions
- [ ] Landscape orientation

**Expected**: Responsive layout scales appropriately, sidebar and message area balance at tablet size.

---

## Test Execution Workflow

### Pre-Test Setup (5 minutes)
1. [ ] Clear browser cache and localStorage
2. [ ] Log in with test user account
3. [ ] Verify backend is running and responsive
4. [ ] Note starting time and device info
5. [ ] Take baseline screenshot of home/room view

### Test Execution (30-45 minutes)
1. [ ] Work through each feature area in order
2. [ ] For each test scenario:
   - [ ] Read the "What to Test" instructions carefully
   - [ ] Perform the steps on device
   - [ ] Compare actual behavior to "Expected Behavior"
   - [ ] Verify "Acceptance Criteria" are met
   - [ ] Note any issues in the issue log (see below)
3. [ ] Watch for "Common Issues" and document if found

### Issue Documentation
When you find a problem, record:
- **Issue #**: Sequential number (Issue 1, Issue 2, etc.)
- **Feature Area**: Which test scenario area (e.g., "Input & Keyboard")
- **Severity**: CRITICAL (breaks feature) | MAJOR (significant issue) | MINOR (cosmetic)
- **Device**: Device model and iOS version
- **Steps to Reproduce**: Exact steps to make it happen again
- **Expected**: What should happen
- **Actual**: What actually happens
- **Screenshot/Video**: Visual evidence if possible

### Example Issue Log
```
Issue 1: Message Input Box
- Severity: MAJOR
- Device: iPhone 14, iOS 17.2
- Steps: Type a very long message (200+ chars), send
- Expected: Input clears and returns to empty state
- Actual: Input retains some text after send
- Note: Intermittent, happens ~50% of the time
- Screenshot: [attached]
```

### Post-Test Completion (5 minutes)
1. [ ] Complete all test scenarios
2. [ ] Count total pass/fail
3. [ ] Document any blockers or critical issues
4. [ ] Note estimated time spent
5. [ ] Prepare pass/fail decision (see below)

---

## Pass/Fail Decision Matrix

### PASS Criteria (Release Ready)
- ✅ All "Acceptance Criteria" met for all test scenarios
- ✅ No CRITICAL severity issues
- ✅ No MAJOR issues affecting core functionality (messaging, input, navigation)
- ✅ Performance is acceptable (no noticeable lag, jank, or delays)
- ✅ Device works on iPhone 12/13/14/15 Pro Max at 430px

**Decision: PASS** → Ready for production release

### FAIL Criteria (Requires Fixes)
- ❌ Any CRITICAL severity issues (feature broken)
- ❌ Multiple MAJOR issues affecting core paths
- ❌ Performance significantly degraded
- ❌ Core features (messaging, input) not working reliably

**Decision: FAIL** → Return to development team with issue list
→ Re-test after fixes applied
→ Consider re-running full test or focused regression tests

### CONDITIONAL PASS (Optional)
- ⚠️ 1-2 MINOR cosmetic issues
- ⚠️ Edge case issues (very long messages, many users, etc.)
- ⚠️ Accepted accessibility gaps (if documented)

**Decision: CONDITIONAL PASS** → Can release with known issues logged for future sprint
→ Create backlog tickets for minor issues
→ Plan follow-up testing/fixes

---

## Testing Time Estimate

| Phase | Time | Notes |
|-------|------|-------|
| Setup | 5 min | Prepare device, backend, browser |
| Feature Areas (1-7) | 30-40 min | ~5-6 min per area |
| Issue Documentation | 5 min | If issues found |
| Decision & Summary | 5 min | Compile results |
| **Total** | **~45-55 min** | Thorough, comprehensive test |

**Express Test (20 min):** Cover essential features only:
- Message rendering and input
- Navigation and sidebar
- Modal/form usability
- Scrolling performance
- Touch targets

---

## Next Steps After Testing

### If PASS
1. [ ] Document test results and date
2. [ ] Take screenshots/video of passing state
3. [ ] Commit to repository: `test: manual QA passed on iPhone`
4. [ ] Deploy to production
5. [ ] Monitor for user issues post-release

### If FAIL
1. [ ] Export issue list and create GitHub issues
2. [ ] Triage by severity (CRITICAL first)
3. [ ] Assign to development team
4. [ ] Estimate fix timeline
5. [ ] Schedule re-test after fixes
6. [ ] Consider partial release (if only minor features broken)

### If CONDITIONAL PASS
1. [ ] Document accepted issues and limitations
2. [ ] Create backlog tickets for future fixes
3. [ ] Plan accessibility/edge case testing for next release
4. [ ] Release to production with known caveats
5. [ ] Monitor user feedback

---

## Device Information Reference

### iPhone Screen Sizes
| Model | Screen | Width | Notes |
|-------|--------|-------|-------|
| iPhone 12/13 | 6.1" | 390px | Older standard |
| iPhone 14 | 6.1" | 390px | Current standard |
| iPhone 15 | 6.1" | 390px | Current standard |
| **iPhone 15 Pro Max** | **6.7"** | **430px** | **TARGET: Largest screen** |
| iPhone SE | 4.7" | 375px | Smallest for testing |

### iOS Version Support
| Version | Support | Notes |
|---------|---------|-------|
| iOS 15 | ⚠️ Test | Legacy |
| iOS 16 | ✅ Full | Core support |
| iOS 17 | ✅ Full | Current |
| iOS 18+ | ✅ Full | Future versions |

---

## Accessibility Compliance Notes

### WCAG 2.1 Level AA Targets
- Text contrast: minimum 4.5:1 (normal text), 3:1 (large text)
- Touch targets: minimum 44×44px (iOS standard)
- Focus indicators: visible on all interactive elements
- Text sizing: supports system text size changes

### Quick a11y Spot Check
1. [ ] Text is readable at standard system text size
2. [ ] Text contrast is adequate (not too light/faint)
3. [ ] All buttons are tappable (≥44px)
4. [ ] Focus states are visible when using keyboard/screen reader
5. [ ] Forms have labels and error messages are clear

---

## Notes & Observations

Use this section to record general observations during testing:

```
### Device Setup
- Device: [iPhone model, iOS version]
- Network: [WiFi/LTE]
- Browser: [Safari version]
- Test Date: [Date/Time]
- Tester: [Name]

### General Observations
- [Smooth/laggy, fast/slow, responsive/sluggish]
- [First impression of mobile experience]
- [Any immediate issues noticed]

### Performance Notes
- Page load time (approx): [seconds]
- Scrolling smoothness: [60 FPS / drops to X FPS]
- Animation feel: [smooth / slight stutter / laggy]
- Memory usage (if visible): [stable / increasing / crashes]

### Issues Found Summary
- Critical: [count]
- Major: [count]
- Minor: [count]
- Total: [count]

### Recommendations for Next Release
- [Suggested improvements or follow-up testing]
```

---

## Tester Checklist

Before starting, verify you have:
- [ ] Access to iPhone device (12/13/14/15 Pro Max)
- [ ] Device is on latest iOS
- [ ] Safari browser is latest version
- [ ] Backend running locally
- [ ] Frontend dev server running
- [ ] Test user account ready
- [ ] This checklist printed or accessible
- [ ] Device connected to stable WiFi
- [ ] Optional: Ability to record screen/video
- [ ] Optional: Access to DevTools (Safari on macOS)

---

**Document Version**: 1.0  
**Created**: 2024  
**Last Updated**: 2024  
**Target Viewport**: 430px (iPhone 15 Pro Max)  
**Primary Use**: Manual QA testing on real iOS devices

