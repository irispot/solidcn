/** Common final-state policy. It never changes styles or pixel comparison rules. */
export async function settleCapture(page, timeoutMs = 2500) {
  return page.evaluate(async (timeoutMs) => {
    const deadline = performance.now() + timeoutMs;
    const observed = new Map();
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let quietFrames = 0;
    while (quietFrames < 2) {
      if (performance.now() > deadline)
        throw new Error('Finite animations did not finish before static capture.');
      let pending = false;
      for (const animation of document.getAnimations()) {
        const timing = animation.effect?.getComputedTiming();
        if (!timing) continue;
        if (!observed.has(animation))
          observed.set(animation, {
            name: animation.animationName ?? animation.transitionProperty ?? animation.id,
            timeline: animation.timeline?.constructor.name ?? null,
            initialTime: String(animation.currentTime),
            infinite: timing.iterations === Infinity,
            initialState: animation.playState,
            policy:
              animation.timeline && !(animation.timeline instanceof DocumentTimeline)
                ? 'preserve-progress-timeline'
                : animation.playState === 'paused'
                  ? 'preserve-source-pose'
                  : timing.iterations === Infinity
                    ? 'pause-at-time-zero'
                    : 'wait-for-completion',
          });
        if (observed.get(animation).policy.startsWith('preserve-')) continue;
        if (timing.iterations === Infinity) {
          // Keep one declared pose across both screenshots. Per-screenshot
          // cancellation restarts CSS spinners between the two captures.
          if (animation.playState !== 'paused' || animation.currentTime !== 0) {
            animation.pause();
            animation.currentTime = 0;
            pending = true;
          }
        } else if (animation.playState === 'running' || animation.pending) {
          pending = true;
        }
      }
      quietFrames = pending ? 0 : quietFrames + 1;
      await frame();
    }
    return { animations: [...observed.values()], timeoutMs };
  }, timeoutMs);
}
