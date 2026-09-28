/** Smooth-scrolls to a slide by id (instant under reduced motion) and moves
 * keyboard focus to its heading, so Tab continues from the new section and
 * screen readers announce where the user landed. */
function scrollToSlide(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
  const heading = section.querySelector<HTMLElement>("h1, h2");
  if (heading) {
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

export { scrollToSlide };
