# Quick Reference: Manual QA Testing Guide (2-Page Printable)

## Page 1: Test Setup & Key Points

### Pre-Test Checklist (5 min)
- [ ] Clear Safari cache: Settings → History → Clear Data
- [ ] Device: iPhone 12/13/14/15 Pro Max on iOS 17.x
- [ ] Backend running: `cd backend && make run`
- [ ] Frontend running: `cd frontend && npm run dev`
- [ ] API health: `curl http://localhost:8000/api/health` ✅
- [ ] Logged into app with test account
- [ ] Note device model, iOS version, time started

### 8 Feature Areas to Test (~45 minutes total)

| # | Feature | Time | Key Test |
|---|---------|------|----------|
| 1 | **Messaging** | 5 min | Messages wrap at 430px, readable, no overflow |
| 2 | **Navigation** | 5 min | Header/sidebar/tabs accessible, tap targets ≥44px |
| 3 | **Input** | 6 min | Input field works, keyboard appears/dismisses, send works |
| 4 | **Sidebar** | 5 min | Sidebar width appropriate, scrollable, easy to close |
| 5 | **Modals/Forms** | 6 min | Modals fit screen, inputs tappable, forms work |
| 6 | **Touch/Tap** | 5 min | All buttons ≥44x44px, tap feedback instant, gestures work |
| 7 | **Performance** | 6 min | Smooth scrolling (60 FPS), animations fluid, no jank |
| 8 | **Edge Cases** | 5 min | Dark mode, large text, long messages, landscape |

### The Golden Rule
**Every interactive element must be ≥44×44 pixels** (iOS accessibility standard)

---

## Page 2: Issue Reporting & Decision

### Issue Severity Definitions

| Severity | Definition | Examples | Action |
|----------|-----------|----------|--------|
| 🔴 **CRITICAL** | Feature completely broken | Can't send message, UI unresponsive | FAIL test |
| 🟠 **MAJOR** | Significant usability issue | Input hidden by keyboard, text unreadable | Multiple = FAIL |
| 🟡 **MINOR** | Cosmetic/edge case issue | Spacing slightly off, rare edge case | Document, accept |

### Issue Template (Copy this for each issue found)
```
Issue #: [1, 2, 3...]
Feature: [Which test area from above]
Severity: CRITICAL / MAJOR / MINOR

Device: [iPhone model] [iOS version]
Steps to Reproduce:
1. [First action]
2. [Second action]
3. [What happens]

Expected: [What should happen]
Actual: [What actually happened]

Screenshot: [Yes/No] [Location if attached]
```

### Example Issues

❌ **Issue 1: Message Input Overflow** (CRITICAL)
- Feature: Input & Keyboard (Area 3)
- Steps: Type very long message, send
- Expected: Input clears and returns to empty
- Actual: Input retains text after send, needs manual clear
- Fix: Validate input state in message send handler

✅ **Issue 2: Button Spacing (MINOR)**
- Feature: Touch Targets (Area 6)
- Steps: Look at sidebar close button
- Expected: 8px padding minimum between elements
- Actual: Buttons 4px apart, still tappable but tight
- Fix: Adjust margin in next design pass

### Quick Performance Targets
- Page load: < 2 seconds
- Message send feedback: < 100ms (optimistic update)
- Scroll smoothness: 60 FPS (no visible jank)
- Animation duration: 200-400ms
- Network on 3G: Functional but slower

### Pass/Fail Decision Tree

```
START
  ↓
Any CRITICAL issues?
  → YES: FAIL ❌
  → NO: Continue
  ↓
Any MAJOR issues on core features?
  (messaging, input, navigation)
  → YES (multiple): FAIL ❌
  → NO or only 1: Continue
  ↓
More than 2 MINOR issues?
  → YES: CONDITIONAL PASS ⚠️
  → NO: Continue
  ↓
All Acceptance Criteria met?
  → YES: PASS ✅
  → NO: Review specifics
```

### Final Verdict Options

✅ **PASS** - Ready for production
- All core features work
- No critical/major issues
- Performance acceptable
- **Action**: Deploy to production

❌ **FAIL** - Needs developer fixes
- Critical or multiple major issues
- Core feature broken
- **Action**: Return to dev team, re-test after fixes

⚠️ **CONDITIONAL PASS** - Release with known issues
- Only 1-2 minor cosmetic issues
- All core features work
- **Action**: Release, create backlog ticket for future fix

---

## Desktop Regression Check (5 min)

Test on 1920×1080 to ensure no breakage:
- [ ] Messages display and wrap correctly
- [ ] Sidebar works
- [ ] All buttons clickable
- [ ] Modals appear properly
- [ ] Dark mode works
- [ ] Performance acceptable

**Expected**: Desktop behaves exactly as before. If different → potential mobile CSS breaking desktop.

---

## Testing Workflow

### Step 1: Setup (5 min)
✓ Clear cache, start backend/frontend, verify login

### Step 2: Test by Area (30-40 min)
✓ Work through areas 1-8 in order
✓ For each scenario: read, test, verify, record issues

### Step 3: Summarize (5 min)
✓ Count issues by severity
✓ Review Acceptance Criteria
✓ Apply Decision Tree
✓ Document result

### Step 4: Sign-Off (1 min)
```
Result: [PASS / FAIL / CONDITIONAL PASS]
Tester: [Name]
Date: [Date/Time]
Device: [iPhone model, iOS version]
Issues: Critical=__ Major=__ Minor=__
```

---

## Quick Troubleshooting

### App crashes or won't load
- Verify backend is running: `ps aux | grep java`
- Check frontend: `ps aux | grep node`
- Clear browser cache completely
- Try private/incognito window

### Keyboard doesn't appear
- Verify input field has proper focus state
- Check if other apps are interfering
- Restart browser/app

### Slow performance
- Check network: is LTE/WiFi connected?
- Close other apps
- Check browser console for JS errors
- Try throttling to 3G to simulate real conditions

### Touch targets too small
- Measure with DevTools inspector or measure tool
- Should be ≥44×44 px for tappable elements
- Report if smaller

---

## Key Metrics to Track

| Metric | Target | Acceptable | Problem |
|--------|--------|-----------|---------|
| **Page Load** | < 1s | < 2s | > 2s 🔴 |
| **Send Response** | < 50ms | < 100ms | > 200ms 🔴 |
| **Scrolling FPS** | 60 FPS | 50+ FPS | < 50 FPS 🔴 |
| **Text Size** | Readable | Works at +2 sizes | Unreadable 🔴 |
| **Button Size** | 44×44px+ | 40×40px+ | < 40px 🔴 |
| **Contrast Ratio** | 4.5:1 | 4:1 | < 3:1 🔴 |

---

## Tester Notes
```
[Space for hand-written notes during testing]

Device: _______________
iOS: _______________
Time Started: _______________
Issues Found: Critical___ Major___ Minor___
Result: PASS / FAIL / CONDITIONAL PASS (circle one)
```

---

**Print this page as a 2-page reference guide**
**Estimated testing time: 45-55 minutes**
**Target: iPhone 12-15 Pro Max at 430px width**

