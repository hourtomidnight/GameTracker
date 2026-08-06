# 3-Phase Game Flow Implementation Plan

## Problem
- Text inputs (Notes, How Did You Hear "Other") are laggy/unusable
- Component re-renders interrupting typing

## Solution
Split game into 3 distinct phases with separate screens:

### Phase 1: PRE-GAME (Done ✓)
**Screen:** PreGameScreen
**Purpose:** Collect all info before game starts
**Fields:**
- Game Master (required, dropdown)
- Date & Time (with "Now" button)
- Players (Experienced + New counters)
- How Did You Hear (dropdown + Other option)
- Notes (textarea)

**Button:** "Start Game →" goes to Phase 2

### Phase 2: GAME (To Modify)
**Screen:** GameScreen  
**Purpose:** Run the actual game
**Show:**
- Timer (starts when phase begins)
- Puzzles with hint buttons
- Objects found tracking
- **Editable Notes section** (in sidebar/bottom)

**Buttons:**
- "🏆 Win" → goes to PostGameScreen with result='win'
- "❌ Lose" → goes to PostGameScreen with result='lose'

**Remove from GameScreen:**
- Game Master selection
- Date/Time
- Player counters  
- How Did You Hear
(All handled in Pre-Game now)

### Phase 3: POST-GAME (To Create)
**Screen:** PostGameScreen
**Purpose:** Review everything before final submit
**Show (READ-ONLY):**
- Game result (Win/Lose badge)
- Game Master
- Date & Time
- Players (Exp + New)
- Time Elapsed
- Hints Used (by puzzle + other)
- How Did You Hear
- Notes

**Buttons:**
- "← Edit" → back to Phase 2 (game)
- "✓ Submit & Save" → Save to CSV + Google Sheets, return to main menu

## Key Changes Needed

### 1. GameScreen Simplification
- Remove all pre-game fields
- Add Win/Lose buttons
- Keep timer + hints
- Add small notes editor

### 2. Create PostGameScreen
- Display all data read-only
- Calculate totals
- Handle final submission

### 3. State Management
- gameSession.gameResult = 'win'|'lose'|null
- gameSession.endTime = timestamp when game ends

## Benefits
1. **No More Typing Lag** - Pre-game screen has no timers/re-renders
2. **Clearer Workflow** - Each phase has clear purpose
3. **Review Before Submit** - Catch errors before saving
4. **Better UX** - Less overwhelming, step-by-step process
