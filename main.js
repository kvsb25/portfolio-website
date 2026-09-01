/* ==========================================================================
   The only JavaScript on the site.

   Three jobs, in order of importance:
     1. play the Morpheus timeline from firing to resolved
     2. fade-and-rise sections on entry
     3. add a copy control next to the contact email

   Everything here is an enhancement. With JS off the timeline renders in its
   resolved state, sections are simply visible, and the email is still a
   mailto link — which is why the copy button is created here rather than
   sitting in the HTML doing nothing.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canObserve = "IntersectionObserver" in window;

  /* ------------------------------------------------------------------
     1. Morpheus timeline
     Nodes illuminate top to bottom as the section scrolls through, the
     spine grows behind them, and when the last node lands the whole thing
     transitions to resolved. Plays exactly once.
     ------------------------------------------------------------------ */

  function playTimeline() {
    var section = document.getElementById("morpheus");
    var timeline = document.querySelector("[data-timeline]");
    if (!section || !timeline) return;

    var nodes = Array.prototype.slice.call(timeline.querySelectorAll(".tl"));
    if (!nodes.length) return;

    // hand the section over to its firing state; the stylesheet's default is
    // resolved, which is what a no-JS visitor keeps
    section.classList.add("is-firing");

    var spine = document.createElement("span");
    spine.className = "tl__spine";
    timeline.appendChild(spine);

    var statusText = section.querySelector("[data-status-text]");
    if (statusText) statusText.textContent = "Firing";

    var queue = [];
    var timer = null;
    var highest = -1;

    function resolve() {
      // the incident is no longer firing — dropping the class keeps the two
      // states mutually exclusive instead of relying on cascade order
      section.classList.remove("is-firing");
      section.classList.add("is-resolved");
      spine.style.transform = "scaleY(1)";
      if (statusText) statusText.textContent = "Resolved";
    }

    function light(node) {
      var i = nodes.indexOf(node);
      node.classList.add("is-lit");
      if (i > highest) {
        highest = i;
        spine.style.transform = "scaleY(" + (i + 1) / nodes.length + ")";
      }
      // the last node landing is what resolves the incident
      if (highest === nodes.length - 1) window.setTimeout(resolve, 400);
    }

    function flush() {
      if (!queue.length) {
        timer = null;
        return;
      }
      // entries can arrive together when the section is already in view;
      // sorting keeps the sequence top-to-bottom rather than whatever order
      // the observer happened to report
      queue.sort(function (a, b) {
        return nodes.indexOf(a) - nodes.indexOf(b);
      });
      light(queue.shift());
      timer = window.setTimeout(flush, 140);
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          queue.push(entry.target);
          if (!timer) timer = window.setTimeout(flush, 0);
        });
      },
      // Cropping the bottom half of the root puts the trigger line at the
      // middle of the viewport, so a node lights as it reaches the centre of
      // the screen rather than while it is still down near the fold.
      //
      // Cropping only the bottom — rather than collapsing the root to a line
      // with "-50% 0px -50% 0px" — means everything already above the centre
      // counts as intersecting. A node can then never be skipped by a fast
      // scroll or an anchor jump, which would otherwise leave the spine part
      // grown and the incident stuck firing.
      { rootMargin: "0px 0px -50% 0px", threshold: 0 }
    );

    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  /* ------------------------------------------------------------------
     2. Section entry — 16px rise, 400ms, once each
     ------------------------------------------------------------------ */

  function revealSections() {
    var blocks = document.querySelectorAll("main > section, main > aside");
    if (!blocks.length) return;

    // the hidden state is added here, not in the stylesheet, so that a
    // failure to load this file can never leave the page blank
    root.classList.add("js-reveal");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 }
    );

    Array.prototype.forEach.call(blocks, function (block) {
      observer.observe(block);
    });
  }

  /* ------------------------------------------------------------------
     3. Demo capture
     The file is 2.8MB, so it ships with preload="none" and is not fetched
     until it is about to be seen. It plays muted on entry and pauses on
     exit — a recruiter should not have to decide to press play, and a
     phone should not spend the data if they never scroll this far.
     ------------------------------------------------------------------ */

  function playDemoInView() {
    var video = document.querySelector("[data-demo]");
    if (!video) return;

    var started = false;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (!started) {
              started = true;
              video.preload = "auto";
            }
            // play() rejects on its own if the browser declines; muted
            // autoplay is allowed, but there is no reason to make noise
            // in the console when it is not
            var attempt = video.play();
            if (attempt && attempt.catch) attempt.catch(function () {});
          } else if (started) {
            video.pause();
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(video);
  }

  /* ------------------------------------------------------------------
     4. Copy the email
     ------------------------------------------------------------------ */

  function addCopyControl() {
    var host = document.querySelector("[data-copy-target]");
    var link = host && host.querySelector("a[href^='mailto:']");
    if (!link || !navigator.clipboard) return;

    var address = link.href.replace("mailto:", "");
    var button = document.createElement("button");
    button.type = "button";
    button.className = "copy-btn";
    button.textContent = "Copy";

    var restore = null;
    button.addEventListener("click", function () {
      navigator.clipboard.writeText(address).then(
        function () {
          button.textContent = "Copied";
          button.setAttribute("data-copied", "");
          window.clearTimeout(restore);
          restore = window.setTimeout(function () {
            button.textContent = "Copy";
            button.removeAttribute("data-copied");
          }, 2000);
        },
        function () {
          button.textContent = "Press ⌘C";
        }
      );
    });

    host.appendChild(button);
  }

  addCopyControl();

  if (!reduced && canObserve) {
    revealSections();
    playTimeline();
    // under reduced motion the poster and controls stay, so the demo is
    // still there to be watched — it just is not started for anyone
    playDemoInView();
  }
})();
