import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioHaptics } from '../../src/utils/audioHaptics.js';

test('AudioHaptics - Autoplay & Haptic Synthesizer', async (t) => {
  await t.test('initializes safely in Node/headless environment without crashing', () => {
    const haptics = new AudioHaptics();
    assert.equal(haptics.isEnabled(), false);
    assert.equal(haptics.isMuted(), true);

    const state = haptics.getState();
    assert.equal(state.enabled, false);
    assert.equal(state.muted, true);
    assert.equal(state.contextState, 'uninitialized');
  });

  await t.test('toggles mute and unmute state deterministically', () => {
    const haptics = new AudioHaptics();
    assert.equal(haptics.isMuted(), true);

    // Unmute
    const enabled1 = haptics.setMuted(false);
    assert.equal(enabled1, true);
    assert.equal(haptics.isEnabled(), true);
    assert.equal(haptics.isMuted(), false);

    // Mute
    const enabled2 = haptics.setMuted(true);
    assert.equal(enabled2, false);
    assert.equal(haptics.isEnabled(), false);
    assert.equal(haptics.isMuted(), true);

    // Toggle
    const toggled = haptics.toggle();
    assert.equal(toggled, true);
    assert.equal(haptics.isEnabled(), true);
  });

  await t.test('notifies subscribers on state changes', () => {
    const haptics = new AudioHaptics();
    const notifications = [];

    const unsubscribe = haptics.subscribe((state) => {
      notifications.push(state);
    });

    haptics.setMuted(false);
    haptics.setMuted(true);

    assert.equal(notifications.length, 2);
    assert.equal(notifications[0].enabled, true);
    assert.equal(notifications[1].enabled, false);

    unsubscribe();
    haptics.setMuted(false);
    assert.equal(notifications.length, 2); // No new events after unsubscribe
  });

  await t.test('sound playback methods execute safely when muted or uninitialized', () => {
    const haptics = new AudioHaptics();
    
    // Should be no-ops and not throw
    assert.doesNotThrow(() => {
      haptics.playTick();
      haptics.playMechanicalClick();
      haptics.playLockTone();
    });
  });
});
