// The approved desktop modules remain unchanged; phones use their own framing.
const mobile = matchMedia('(max-width:700px), (pointer:coarse) and (max-width:1024px)');
mobile.addEventListener('change', () => location.reload());
document.documentElement.dataset.layout = mobile.matches ? 'mobile' : 'desktop';
await import('./intro-ui.js?v=5');
await import('./journey.js?v=22');
if (mobile.matches) {
  await Promise.all([import('./mobile-scroll-player.js?v=5'), import('./mobile-interactions.js')]);
  const {mountMotionTuner}=await import('./mobile-motion-tuning.js?v=1');
  mountMotionTuner();
} else {
  await Promise.all([import('./scroll-player.js?v=2'), import('./scene.js')]);
}
